import { Notify }           from './Notify.js';
import { I18n }             from '../settings/Translations.js';
import { PdfExport }        from './PdfExport.js';
import { VariableEngine, type VariableBinding, type ResolveContext, type ApiCache } from './VariableEngine.js';
import { QrCode }           from './QrCode.js';
import { BarcodeGenerator } from './BarcodeGenerator.js';
import { QRCodeTool }       from '../tools/qrcode/QRCodeTool.js';
import { CalendarRenderer } from './CalendarRenderer.js';
import { MiniCalendarTool } from '../tools/minicalendar/MiniCalendarTool.js';

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
    const pages = [...editor.querySelectorAll<HTMLElement>('.craftools-page')];
    if (!pages.length) {
      Notify.toast(I18n.t('agendaExportTool.noPagesFound'), 'error');
      return;
    }

    // 1. Pré-busca (uma única vez) todos os recursos de API referenciados por
    //    variáveis "Frase da API" em qualquer página -- passando TODOS os
    //    índices de repetição que serão de fato renderizados abaixo (0..
    //    repeatCount-1 de cada página), para que uma variável "Emoji Kitchen"
    //    sem emoji direito fixo tenha, no cache, exatamente os combos que
    //    cada repetição vai precisar (ver o próprio comentário de
    //    prefetchApiResources() -- sem isso, páginas além do que fosse
    //    prefetched ficariam com a imagem do combo vazia/quebrada).
    const allBindings: (VariableBinding | null)[] = [];
    const repetitionIndicesSet = new Set<number>();
    pages.forEach(page => {
      this._collectBindings(page).forEach(({ binding }) => allBindings.push(binding));
      const repeatCount = this._repeatCount(page);
      for (let i = 0; i < repeatCount; i++) repetitionIndicesSet.add(i);
    });
    const apiCache: ApiCache = await VariableEngine.prefetchApiResources(allBindings, {
      repetitionIndices: [...repetitionIndicesSet],
    });

    const totalOutputPages = pages.reduce((sum, p) => sum + this._repeatCount(p), 0);

    // 2. Gera o HTML de cada página (ou repetição).
    const pageSizes:       ReturnType<typeof PdfExport._parsePageSize>[] = [];
    const pagesHtmlParts:  string[] = [];
    let outputPageNumber = 0;

    for (const page of pages) {
      const size        = PdfExport._parsePageSize(page);
      const repeatCount = this._repeatCount(page);
      const origEls     = [...page.querySelectorAll<CraftoolsEl>('craftools-element')];

      for (let i = 0; i < repeatCount; i++) {
        outputPageNumber++;
        pageSizes.push(size);

        const clone = page.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(UI_STRIP_SELECTORS).forEach(n => n.remove());

        const cloneEls = [...clone.querySelectorAll<CraftoolsEl>('craftools-element')];
        const context: ResolveContext = {
          repetitionIndex: i,
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
        origEls.forEach((origEl, idx) => {
          if (origEl.getAttribute('data-craftool') !== 'minicalendario') return;
          this._advanceStandaloneMiniCalendar(cloneEls[idx], origEl._craftoolsMeta, i);
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
    const fullHtml = PdfExport._wrapDocument(css, pagesHtmlParts.join('\n'));

    // 3. Abre o blob/janela de impressão
    PdfExport._openPrintWindow(fullHtml);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  static _repeatCount(page: HTMLElement): number {
    return Math.max(1, parseInt(page.dataset['agendaRepeat'] ?? '1', 10) || 1);
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
    if (type === 'conteudovariavel') return el._craftoolsVariable ?? null;
    if (type === 'qrcode' || type === 'barcode') {
      const meta = el._craftoolsMeta as (Record<string, unknown> & { variableBinding?: VariableBinding }) | undefined;
      return meta?.variableBinding ?? null;
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
    if (toolType === 'conteudovariavel') {
      const ce = cloneEl.querySelector('[contenteditable]') as HTMLElement | null;
      if (ce) {
        if (binding.type === 'emojiKitchen') {
          ce.innerHTML = resolved
            ? `<img src="${this._escAttr(resolved)}" style="max-width:100%; max-height:100%; display:block; margin:0 auto; object-fit:contain;">`
            : '';
        } else if (binding.type === 'miniCalendar') {
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
