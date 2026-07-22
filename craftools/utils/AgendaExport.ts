import { Notify }           from './Notify.js';
import { I18n }             from '../settings/Translations.js';
import { PdfExport }        from './PdfExport.js';
import { VariableEngine, type VariableBinding, type ResolveContext, type ApiCache } from './VariableEngine.js';
import { QrCode }           from './QrCode.js';
import { BarcodeGenerator } from './BarcodeGenerator.js';
import { QRCodeTool }       from '../tools/qrcode/QRCodeTool.js';
import { CalendarRenderer } from './CalendarRenderer.js';
import { MiniCalendarTool } from '../tools/minicalendar/MiniCalendarTool.js';
import { PropertyRenderer } from './PropertyRenderer.js';
import { parseVariableBinding } from './fields/variable-binding.field.js';

// ── Types ─────────────────────────────────────────────────────────────────────

/** craftools-element extended with runtime-only in-memory properties. */
interface CraftoolsEl extends HTMLElement {
  _craftoolsMeta?:     Record<string, unknown>;
  _craftoolsVariable?: VariableBinding | null;
  _craftoolsVarId?:    string;
}

interface BindingJob {
  origEl:   CraftoolsEl;
  cloneEl:  CraftoolsEl;
  toolType: string | null;
  binding:  VariableBinding;
  id:       string;
}

const UI_STRIP_SELECTORS = [
  '.craftools-ctrlbar',
  '.album-drag-handle',
  '.slot-drag-handle',
  '.craftools-sidebar-overlay',
  '.cell-edit-btn',
].join(',');

// ─────────────────────────────────────────────────────────────────────────────

/**
 * AgendaExport.ts
 *
 * Gera o HTML de impressão de uma "Agenda": como PdfExport, mas páginas
 * marcadas com `data-agenda-repeat="N"` são repetidas N vezes, com o conteúdo
 * de qualquer elemento vinculado a uma variável resolvido de forma diferente a
 * cada repetição, ANTES de abrir a janela de impressão do navegador.
 *
 * Reaproveita a infraestrutura de PdfExport via chamadas estáticas cruzadas.
 */
export class AgendaExport {

  static async print(editor: HTMLElement): Promise<void> {
    const built = await this._buildDocument(editor);
    if (!built) return;
    PdfExport._openPrintWindow(built.fullHtml);
  }

  /**
   * Builds the same self-contained print HTML print() sends to the
   * browser, without opening the print window -- shared by print() itself
   * and buildPreviewHtml() (AgendaExportTool.ts's visual preview tab,
   * embedded in an iframe instead of a new window).
   *
   * @param opts.maxOutputPages  Caps how many OUTPUT pages (after repeats,
   *   in document order) are actually rendered/resolved. Omit to render
   *   everything (print()'s own real-export case) -- the preview's
   *   "first 5 pages" mode passes 5 so previewing a large agenda doesn't
   *   have to render (and resolve every variable binding for) potentially
   *   hundreds of repetitions just to show a preview. `totalPages` in each
   *   page's ResolveContext (and so e.g. a "page N of TOTAL" variable)
   *   always reflects the REAL total regardless of this cap.
   * @param opts.autoPrint  Passed straight through to
   *   PdfExport._wrapDocument() -- `false` for the preview embed (an
   *   iframe popping its own print dialog would be very unexpected),
   *   default `true` for the real export.
   */
  static async _buildDocument(
    editor: HTMLElement,
    opts: { maxOutputPages?: number; autoPrint?: boolean } = {},
  ): Promise<{ fullHtml: string; totalOutputPages: number } | null> {
    const pages = [...editor.querySelectorAll<HTMLElement>('.craftools-page')];
    if (!pages.length) {
      Notify.toast(I18n.t('agendaExportTool.noPagesFound'), 'error');
      return null;
    }

    const totalOutputPages = pages.reduce((sum, p) => sum + this._repeatCount(p), 0);
    const renderLimit      = Math.min(opts.maxOutputPages ?? totalOutputPages, totalOutputPages);

    // 1. Pré-busca (uma única vez) todos os recursos de API referenciados por
    //    variáveis "Frase da API" em qualquer página que será de fato
    //    renderizada abaixo -- passando TODOS os índices de repetição que
    //    serão realmente usados (respeitando `renderLimit`), para que uma
    //    variável "Emoji Kitchen" sem emoji direito fixo tenha, no cache,
    //    exatamente os combos que cada repetição vai precisar (ver o
    //    próprio comentário de prefetchApiResources() -- sem isso, páginas
    //    além do que fosse prefetched ficariam com a imagem do combo
    //    vazia/quebrada).
    const allBindings: (VariableBinding | null)[] = [];
    const repetitionIndicesSet = new Set<number>();
    let prefetchCounted = 0;
    for (const page of pages) {
      if (prefetchCounted >= renderLimit) break;
      this._collectBindings(page).forEach(({ binding }) => allBindings.push(binding));
      const repeatCount = this._repeatCount(page);
      for (let i = 0; i < repeatCount && prefetchCounted < renderLimit; i++, prefetchCounted++) {
        // `prefetchCounted` is the GLOBAL running index across every output
        // page in the whole document (0-based) -- the same value the main
        // render loop below now uses as `repetitionIndex` (see its own
        // comment). Adding the local `i` here instead used to only ever
        // queue combos for indices 0..repeatCount-1 of THIS page, so any
        // emoji-kitchen "variable" binding without a fixed right emoji on a
        // document with multiple distinct pages had its combo image missing
        // for every page beyond the first one's own repeat count.
        repetitionIndicesSet.add(prefetchCounted);
      }
    }
    const apiCache: ApiCache = await VariableEngine.prefetchApiResources(allBindings, {
      repetitionIndices: [...repetitionIndicesSet],
    });

    // 2. Gera o HTML de cada página (ou repetição), até `renderLimit`.
    const pageSizes:       ReturnType<typeof PdfExport._parsePageSize>[] = [];
    const pagesHtmlParts:  string[] = [];
    let outputPageNumber = 0;

    outer:
    for (const page of pages) {
      const size        = PdfExport._parsePageSize(page);
      const repeatCount = this._repeatCount(page);
      const origEls     = [...page.querySelectorAll<CraftoolsEl>('craftools-element')];

      for (let i = 0; i < repeatCount; i++) {
        if (outputPageNumber >= renderLimit) break outer;
        outputPageNumber++;
        pageSizes.push(size);

        const clone = page.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(UI_STRIP_SELECTORS).forEach(n => n.remove());

        const cloneEls = [...clone.querySelectorAll<CraftoolsEl>('craftools-element')];

        // Root cause of "variable keeps the same value on every page": `i`
        // is only the LOCAL index within the CURRENT page's own repeat
        // batch (0..repeatCount-1) -- it resets to 0 for every distinct
        // `.craftools-page` in the document. A date/sequence/pageNumber
        // variable is meant to advance across the WHOLE generated document
        // (that's the entire point of an "Agenda"), whether that advance
        // comes from repeating one page N times or from simply having N
        // separate pages -- so it must use a GLOBAL running index instead.
        // `outputPageNumber` already increments exactly once per rendered
        // output page across the entire loop (see above), so `- 1` gives
        // the correct 0-based global equivalent of the old (buggy) `i`.
        const globalRepetitionIndex = outputPageNumber - 1;

        // Alternância de layout (Frente e Verso espelhados)
        if (page.dataset['agendaAlternate'] === 'true' && globalRepetitionIndex % 2 !== 0) {
          this._applyAlternateLayout(page, cloneEls);
        }

        const context: ResolveContext = {
          repetitionIndex: globalRepetitionIndex,
          pageNumber:      outputPageNumber,
          totalPages:      totalOutputPages,
          now:             new Date(),
        };

        // "picks" é recriado a cada repetição
        const picks = VariableEngine.newLinkRegistry();

        const jobs: BindingJob[] = origEls
          .map((origEl, idx) => {
            const cloneEl  = cloneEls[idx];
            const toolType = origEl.getAttribute('data-craftool');
            const binding  = this._getBinding(origEl, toolType);
            return { origEl, cloneEl, toolType, binding, id: this._getVarId(origEl) };
          })
          .filter((j): j is BindingJob => !!(j.cloneEl && j.binding && j.binding.type));

        // 1ª passada: líderes (sem linkedTo) primeiro
        const leaders   = jobs.filter(j => !j.binding.linkedTo);
        const followers = jobs.filter(j =>  j.binding.linkedTo);

        [...leaders, ...followers].forEach(j => {
          const resolved = VariableEngine.resolve(j.binding, context, apiCache, { id: j.id, picks });
          this._applyResolvedValue(j.cloneEl, j.toolType, j.origEl, resolved, j.binding);
        });

        // Mini Calendário "solto" — avança o mês em +1 a cada repetição
        // (globalRepetitionIndex, not the local `i` -- see the comment
        // above; otherwise a standalone Mini Calendar on a document with
        // multiple distinct pages showed the same month on every page
        // beyond the first).
        origEls.forEach((origEl, idx) => {
          if (origEl.getAttribute('data-craftool') !== 'minicalendar') return;
          this._advanceStandaloneMiniCalendar(cloneEls[idx], origEl._craftoolsMeta, globalRepetitionIndex);
        });

        // Achata todos os <craftools-element>
        clone.querySelectorAll<HTMLElement>('craftools-element')
          .forEach(el => PdfExport._flattenElement(el));

        const pageClass = `ct${PdfExport._sizeKey(size.width, size.height)}`;
        const bgStyle   = size.background ? `background: ${size.background};` : '';
        pagesHtmlParts.push(
          `<div class="print-page print-page-${pageClass}" style="width:${size.width}; min-height:${size.height}; ${bgStyle}">${clone.innerHTML}</div>`
        );
      }
    }

    const css      = PdfExport._buildCSS(pageSizes);
    const fullHtml = PdfExport._wrapDocument(css, pagesHtmlParts.join('\n'), { autoPrint: opts.autoPrint });

    return { fullHtml, totalOutputPages };
  }

  /**
   * Builds the print-ready HTML for a live visual preview (embedded in an
   * iframe by AgendaExportTool.ts's preview tab) without opening the print
   * window or triggering the browser's print dialog. See
   * _buildDocument()'s own doc comment for `maxOutputPages`.
   */
  static async buildPreviewHtml(editor: HTMLElement, opts: { maxOutputPages?: number } = {}): Promise<string | null> {
    const built = await this._buildDocument(editor, { ...opts, autoPrint: false });
    return built?.fullHtml ?? null;
  }

  /**
   * Runs the same variable-resolution pipeline as _buildDocument() but
   * instead of wrapping everything in a print document, returns each resolved
   * output page as a raw innerHTML string (no print CSS, no wrapper div).
   *
   * Used by AgendaExportTool.ts's canvas preview to inject each output page
   * directly into main-page one at a time, exactly like CalendarTool's live
   * canvas preview -- so the user sees real pages on the actual canvas
   * instead of a tiny zoomed iframe.
   */
  static async buildOutputPages(
    editor: HTMLElement,
    opts: { maxOutputPages?: number } = {},
  ): Promise<string[] | null> {
    const pages = [...editor.querySelectorAll<HTMLElement>('.craftools-page')];
    if (!pages.length) return null;

    const totalOutputPages = pages.reduce((sum, p) => sum + this._repeatCount(p), 0);
    const renderLimit      = Math.min(opts.maxOutputPages ?? totalOutputPages, totalOutputPages);

    // Prefetch API resources
    const allBindings: (VariableBinding | null)[] = [];
    const repetitionIndicesSet = new Set<number>();
    let prefetchCounted = 0;
    for (const page of pages) {
      if (prefetchCounted >= renderLimit) break;
      this._collectBindings(page).forEach(({ binding }) => allBindings.push(binding));
      const repeatCount = this._repeatCount(page);
      for (let i = 0; i < repeatCount && prefetchCounted < renderLimit; i++, prefetchCounted++) {
        repetitionIndicesSet.add(prefetchCounted);
      }
    }
    const apiCache: ApiCache = await VariableEngine.prefetchApiResources(allBindings, {
      repetitionIndices: [...repetitionIndicesSet],
    });

    const outputInnerHtmls: string[] = [];
    let outputPageNumber = 0;

    outer:
    for (const page of pages) {
      const repeatCount = this._repeatCount(page);
      const origEls = [...page.querySelectorAll<CraftoolsEl>('craftools-element')];

      for (let i = 0; i < repeatCount; i++) {
        if (outputPageNumber >= renderLimit) break outer;
        outputPageNumber++;

        const clone = page.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(UI_STRIP_SELECTORS).forEach(n => n.remove());

        const cloneEls = [...clone.querySelectorAll<CraftoolsEl>('craftools-element')];
        const globalRepetitionIndex = outputPageNumber - 1;

        // Alternância de layout (Frente e Verso espelhados)
        if (page.dataset['agendaAlternate'] === 'true' && globalRepetitionIndex % 2 !== 0) {
          this._applyAlternateLayout(page, cloneEls);
        }

        const context: ResolveContext = {
          repetitionIndex: globalRepetitionIndex,
          pageNumber:      outputPageNumber,
          totalPages:      totalOutputPages,
          now:             new Date(),
        };

        const picks = VariableEngine.newLinkRegistry();

        const jobs: BindingJob[] = origEls
          .map((origEl, idx) => {
            const cloneEl  = cloneEls[idx];
            const toolType = origEl.getAttribute('data-craftool');
            const binding  = this._getBinding(origEl, toolType);
            return { origEl, cloneEl, toolType, binding, id: this._getVarId(origEl) };
          })
          .filter((j): j is BindingJob => !!(j.cloneEl && j.binding && j.binding.type));

        const leaders   = jobs.filter(j => !j.binding.linkedTo);
        const followers = jobs.filter(j =>  j.binding.linkedTo);
        [...leaders, ...followers].forEach(j => {
          const resolved = VariableEngine.resolve(j.binding, context, apiCache, { id: j.id, picks });
          this._applyResolvedValue(j.cloneEl, j.toolType, j.origEl, resolved, j.binding);
        });

        origEls.forEach((origEl, idx) => {
          if (origEl.getAttribute('data-craftool') !== 'minicalendar') return;
          this._advanceStandaloneMiniCalendar(cloneEls[idx], origEl._craftoolsMeta, globalRepetitionIndex);
        });

        // Return the pre-flatten innerHTML — the canvas renders live
        // craftools-element tags natively (no need to flatten for display).
        // Strip only UI-only nodes (ctrlbar, overlays) which were already
        // removed above via UI_STRIP_SELECTORS.
        outputInnerHtmls.push(clone.innerHTML);
      }
    }

    return outputInnerHtmls.length ? outputInnerHtmls : null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  static _repeatCount(page: HTMLElement): number {
    return Math.max(1, parseInt(page.dataset['agendaRepeat'] ?? '1', 10) || 1);
  }

  /**
   * Converts a page's authored CSS width (e.g. "210mm", "800px") into the
   * given target unit. Needed because most craftools-elements are created
   * with UNITLESS x/y/w/h (implicitly px, from mouse-drag math), but
   * PaperTool.createElement() deliberately authors the background Paper
   * element's x/w in the PAGE's own unit (matching pageEl.style.width --
   * commonly "mm", since that's PageTool.ts's default page size unit) so
   * it lines up exactly with the page regardless of unit. Mirroring math
   * that always treats pageWidth as px (see _applyAlternateLayout() below)
   * silently subtracted raw mm numbers as if they were px, producing a
   * nonsense mirrored X (e.g. "793 - 0 - 210" written back as "583mm" --
   * more than half a meter off the physical page) that pushed the paper
   * entirely outside the visible page on any alternated/mirrored page.
   */
  private static _pageWidthInUnit(rawPageWidth: string, targetUnit: string): number {
    const PX_PER_UNIT: Record<string, number> = { mm: 3.7795, cm: 37.795, in: 96, px: 1, '': 1 };
    const sourceUnit = rawPageWidth.replace(/[0-9.-]/g, '') || 'px';
    const sourceNum  = parseFloat(rawPageWidth) || 0;
    const tUnit      = targetUnit || 'px';
    if (sourceUnit === tUnit) return sourceNum;
    const px = sourceNum * (PX_PER_UNIT[sourceUnit] ?? 1);
    return px / (PX_PER_UNIT[tUnit] ?? 1);
  }

  /**
   * Espelha horizontalmente os elementos de um clone de página:
   * - Inverte a coordenada X: novo_x = largura_da_pagina - x - largura_do_elemento
   * - Inverte a rotação: novo_r = -r
   *
   * Usa offsetWidth quando disponível (DOM montado) e cai para o parse
   * de style.width (que sempre está na folha de estilo inline do CrafTools)
   * quando o elemento não está renderizado em tela (geração headless).
   */
  private static _applyAlternateLayout(page: HTMLElement, cloneEls: HTMLElement[]): void {
    const rawPageWidth = page.style.width || '210mm';

    // offsetWidth é zero em elementos não visíveis; nesses casos extraímos
    // a largura do atributo de estilo inline (ex: '210mm', '794px').
    let pageWidthPx = page.offsetWidth;
    if (!pageWidthPx) {
      const num = parseFloat(rawPageWidth);
      if (!isNaN(num)) {
        // Converte mm/cm para px usando 96dpi (padrão CSS)
        if (rawPageWidth.endsWith('mm'))      pageWidthPx = num * 3.7795;
        else if (rawPageWidth.endsWith('cm')) pageWidthPx = num * 37.795;
        else if (rawPageWidth.endsWith('in')) pageWidthPx = num * 96;
        else                                  pageWidthPx = num; // px ou unitless
      }
    }
    if (!pageWidthPx) return; // Proteção final

    for (const cl of cloneEls) {
      const px    = parseFloat(cl.getAttribute('x') || '0');
      const pw    = parseFloat(cl.getAttribute('w') || '100');
      const pr    = parseFloat(cl.getAttribute('r') || '0');
      const unitX = (cl.getAttribute('x') || '').replace(/[0-9.-]/g, '') || 'px';

      // Use the page's width IN THIS ELEMENT'S OWN UNIT (see
      // _pageWidthInUnit()'s doc comment) instead of always the px value
      // above, so e.g. the Paper element (authored in mm) mirrors
      // correctly instead of subtracting a px pageWidth from mm coords.
      const effectivePageWidth = unitX === 'px' ? pageWidthPx : this._pageWidthInUnit(rawPageWidth, unitX);

      cl.setAttribute('x', String(Math.round(effectivePageWidth - px - pw)) + unitX);
      if (pr !== 0) cl.setAttribute('r', String(-pr));
      else cl.removeAttribute('r');
    }
  }

  static _collectBindings(page: HTMLElement): Array<{ el: CraftoolsEl; toolType: string | null; binding: VariableBinding }> {
    const results: Array<{ el: CraftoolsEl; toolType: string | null; binding: VariableBinding }> = [];
    page.querySelectorAll<CraftoolsEl>('craftools-element').forEach(el => {
      const toolType = el.getAttribute('data-craftool');
      const binding  = this._getBinding(el, toolType);
      if (binding && binding.type) results.push({ el, toolType, binding });
    });
    return results;
  }

  static _getBinding(el: CraftoolsEl, toolType: string | null): VariableBinding | null {
    const type = toolType || el.getAttribute('data-craftool');

    // `_craftoolsVariable` / `_craftoolsMeta.variableBinding` are each
    // tool's own in-memory fast-path cache, but they're plain JS
    // properties -- they do NOT survive DOM replacement via innerHTML.
    // HistoryManager (undo/redo) and SessionManager (session restore) both
    // rebuild pages that way, which silently drops these for every element
    // the user hasn't re-selected since that replacement (re-selecting is
    // what re-primes them, via each tool's own _syncFromDOM()). That's
    // exactly why generating an Agenda PDF could "not detect" variables
    // that were configured perfectly correctly: after even one undo/redo
    // (or a reload), any binding on an element the user didn't happen to
    // click back into looked completely unset to this method.
    //
    // Falls back to `dataset.ctState` -- a real `data-ct-state` HTML
    // attribute, so it DOES survive innerHTML replacement -- whenever the
    // in-memory value comes back empty. Every tool's _applyProperty()
    // already writes the binding there unconditionally on every edit (via
    // PropertyRenderer.applyChange()), so it's always at least as current
    // as whatever the user last configured through the panel.
    if (type === 'variablecontent') {
      if (el._craftoolsVariable) return el._craftoolsVariable;
      const state = PropertyRenderer._readState(el);
      return 'variableBinding' in state ? parseVariableBinding(state.variableBinding) : null;
    }
    if (type === 'qrcode' || type === 'barcode') {
      const meta = el._craftoolsMeta as (Record<string, unknown> & { variableBinding?: VariableBinding }) | undefined;
      if (meta?.variableBinding) return meta.variableBinding;
      const state = PropertyRenderer._readState(el);
      return 'variableBinding' in state ? parseVariableBinding(state.variableBinding) : null;
    }
    return null;
  }

  /**
   * Id estável (em memória) usado para casar "Vincular a" entre elementos.
   * Criado aqui por segurança caso o elemento nunca tenha aberto o painel.
   */
  static _getVarId(el: CraftoolsEl): string {
    if (!el._craftoolsVarId) el._craftoolsVarId = 'v' + Math.random().toString(36).slice(2, 9);
    return el._craftoolsVarId;
  }

  /**
   * Aplica o valor resolvido de uma variável num clone ainda não achatado.
   */
  static _applyResolvedValue(
    cloneEl:  CraftoolsEl,
    toolType: string | null,
    origEl:   CraftoolsEl,
    resolved: string,
    binding:  VariableBinding,
  ): void {
    if (toolType === 'variablecontent') {
      const ce = (cloneEl.querySelector('.ct-content') || cloneEl.querySelector('div[contenteditable]') || [...cloneEl.children].find(c => !c.classList.contains('ct-bg-layer') && !c.classList.contains('craftools-ctrlbar') && !c.classList.contains('craftools-sidebar-overlay'))) as HTMLElement | null;
      if (ce) {
        if (binding.type === 'emojiKitchen') {
          ce.innerHTML = resolved
            ? `<img src="${this._escAttr(resolved)}" style="max-width:100%; max-height:100%; display:block; margin:0 auto; object-fit:contain;">`
            : '';
        } else if (binding.type === 'miniCalendar' || (binding.type === 'date' && binding.format === 'CAIXA_DIAS')) {
          // VariableEngine's CAIXA_DIAS date format returns real markup (a
          // row of day-letter boxes), not typed text -- was falling into
          // the plain-text branch below, which rendered the exported
          // Agenda page with the literal "<div style=...>S</div>..." tags
          // visible as text instead of the actual days strip.
          ce.innerHTML = resolved || '';
        } else {
          ce.textContent = resolved;
        }
      }
      return;
    }

    const meta = (origEl._craftoolsMeta || {}) as Record<string, unknown>;

    if (toolType === 'qrcode') {
      if (meta['payloadType'] === 'spotify') {
        this._applyResolvedSpotify(cloneEl, meta, resolved);
        return;
      }
      const svg = cloneEl.querySelector('svg');
      if (!svg) return;
      const svgString = (QrCode as unknown as { buildSvgString: (v: string, o?: Record<string, unknown>) => string })
        .buildSvgString(resolved, {
          ecLevel:    meta['ecLevel'],
          darkColor:  meta['darkColor'],
          lightColor: meta['lightColor'],
        } as Record<string, unknown>);
      this._swapSvgContent(svg, svgString);
      return;
    }

    if (toolType === 'barcode') {
      const svg = cloneEl.querySelector('svg');
      if (!svg) return;
      const svgString = (BarcodeGenerator as unknown as { buildSvgString: (v: string, o?: Record<string, unknown>) => string })
        .buildSvgString(resolved, {
          format:     meta['format'],
          color:      meta['color'],
          background: meta['background'],
          showText:   meta['showText'],
        } as Record<string, unknown>);
      this._swapSvgContent(svg, svgString);
    }
  }

  /**
   * Recalcula e substitui o card do Mini Calendário "solto" para o mês
   * `meta.month + repetitionIndex` (com virada de ano).
   */
  static _advanceStandaloneMiniCalendar(
    cloneEl:          CraftoolsEl | undefined,
    meta:             Record<string, unknown> | undefined,
    repetitionIndex:  number,
  ): void {
    if (!cloneEl || !meta) return;
    const card = cloneEl.querySelector('.cal-month-card');
    if (!card) return;

    let year  = meta['year']  as number;
    let month = (meta['month'] as number) + repetitionIndex;
    while (month > 12) { month -= 12; year += 1; }
    while (month < 1)  { month += 12; year -= 1; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { parts } = (MiniCalendarTool as any)._currentMode(meta);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    card.outerHTML = (CalendarRenderer as any).buildCardHtml(year, month, { theme: meta['theme'], parts });
  }

  static _escAttr(val: unknown): string {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  static _swapSvgContent(svgNode: SVGElement, svgString: string): void {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = svgString;
    const fresh = wrapper.firstElementChild as SVGElement | null;
    if (!fresh) return;
    svgNode.setAttribute('viewBox', fresh.getAttribute('viewBox') ?? '');
    svgNode.innerHTML = fresh.innerHTML;
  }

  static _applyResolvedSpotify(cloneEl: CraftoolsEl, meta: Record<string, unknown>, resolved: string): void {
    const img = cloneEl.querySelector<HTMLImageElement>('img[data-spotify-code]');
    if (!img) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tool = QRCodeTool as unknown as any;
    const uri  = tool.buildSpotifyUri(resolved);
    const url  = uri ? tool.buildSpotifyCodeUrl(uri, { bg: meta['spotifyBg'], barColor: meta['spotifyBarColor'] }) : '';
    if (url) img.setAttribute('src', url);
    else      img.removeAttribute('src');
  }
}
