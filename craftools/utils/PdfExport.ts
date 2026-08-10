/**
 * PdfExport.ts
 *
 * Responsável por serializar todas as páginas do editor em um HTML autocontido,
 * aplicar as diretivas CSS @page corretas por tamanho de página, e disparar
 * window.print() via blob URL em uma nova janela.
 */
import { Notify }       from './Notify.js';
import { I18n }         from '../settings/Translations.js';
import { SYSTEM_FONTS } from './FontList.js';
import { CropMarks }    from './CropMarks.js';
import './PdfExport_Translations.js';

/** Always loaded regardless of what the document actually uses -- CalendarRenderer.ts,
 *  PaperPatterns.ts and a few other generated-markup helpers hardcode 'DM Sans' inline
 *  without going through a craftools-element's own font-family style, so there's no
 *  reliable way to detect their usage by scanning the DOM the way _collectUsedFonts()
 *  does for everything else. Kept as a static baseline like before this fix. */
const BASELINE_FONTS = ['DM Sans', 'DM Serif Display', 'DM Mono'];

/** Weight/style combinations of BASELINE_FONTS actually bundled/used across
 *  the app's own generated markup (bold Titles, italic captions, ...) --
 *  mirrors AgendaSvgExport.ts's CORE_FONTS weight/style coverage for the
 *  same 3 families. Passed to _wrapDocument() so the print window's
 *  explicit document.fonts.load() calls (see that method) cover these even
 *  when a given export has no other elements that happen to declare an
 *  inline font-family (e.g. calendar/paper generated markup, which sets
 *  'DM Sans' via CSS text without ever going through _collectUsedFontFaces's
 *  inline-style scan). */
const BASELINE_FONT_FACES: Array<{ family: string; weight: string; style: string }> = [
  { family: 'DM Sans',          weight: '400', style: 'normal' },
  { family: 'DM Sans',          weight: '700', style: 'normal' },
  { family: 'DM Sans',          weight: '400', style: 'italic' },
  { family: 'DM Serif Display', weight: '400', style: 'normal' },
  { family: 'DM Serif Display', weight: '400', style: 'italic' },
  { family: 'DM Mono',          weight: '400', style: 'normal' },
  { family: 'DM Mono',          weight: '500', style: 'normal' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PageSize {
  width:      string;
  height:     string;
  background: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export class PdfExport {

  // ── Entry point ─────────────────────────────────────────────────────────────
  static print(editor: HTMLElement): void {
    const pages = [...editor.querySelectorAll<HTMLElement>('.craftools-page')];
    if (!pages.length) {
      Notify.toast(I18n.t('pdfExport.noPagesFound'), 'error');
      return;
    }

    const pageSizes     = pages.map(p => this._parsePageSize(p));
    // Crop-marks/bleed can enlarge a page's OUTPUT canvas beyond its
    // authored (trim) size -- @page's paper size needs to match that
    // enlarged size, so _buildCSS() is fed the effective (post-bleed)
    // sizes rather than the raw trim sizes. `wrapHtmlWithBleed()` is
    // called here with an empty innerHtml just to read back the sizing
    // math (same helper _serializePage() below uses for real, with the
    // actual content); its own internal config read is deterministic off
    // `pageEl.dataset`, so both calls agree.
    const effectiveSizes = pages.map((p, i) => {
      const size = pageSizes[i];
      const probe = CropMarks.wrapHtmlWithBleed('', size.width, size.height, size.background, p);
      if (probe.marginPx <= 0) return size;
      return { width: `${probe.totalWidthPx}px`, height: `${probe.totalHeightPx}px`, background: size.background };
    });
    const css           = this._buildCSS(effectiveSizes);
    const pagesHtml     = pages.map((page, i) => this._serializePage(page, pageSizes[i])).join('\n');
    const usedFonts     = this._collectUsedFonts(pages);
    const usedFontFaces = this._collectUsedFontFaces(pages);
    const fullHtml      = this._wrapDocument(css, pagesHtml, { usedFonts, usedFontFaces });

    this._openPrintWindow(fullHtml);
  }

  /**
   * Walks `roots` (and everything inside them) collecting every distinct
   * PRIMARY font-family actually referenced -- via inline `style="font-family:
   * ..."` (set by TextTool/VariableContentTool/LetteringGenerator/etc, always
   * through EmojiFont.ts's withEmojiFallback(), so the raw value is a full
   * `'Chosen Font', 'Noto Color Emoji', ..., sans-serif` fallback stack) or an
   * SVG `font-family="..."` XML attribute (CurvedTextTool). Only the first
   * name in each stack is kept -- that's always the user's actually-chosen
   * font, everything after it is the shared emoji/system fallback tail.
   *
   * Used to build the print window's own `<link>` (see _wrapDocument()) --
   * that window opens a brand-new blank `document`, completely separate from
   * the live editor's `document.head`, so it never inherits whatever
   * `<link id="craftools-dynamic-fonts">` FontList.ts injected there for
   * whatever fonts the user actually picked. Previously _wrapDocument() only
   * ever requested the 3 baseline app-chrome fonts (DM Sans/DM Serif Display/
   * DM Mono) regardless of what the document's own text/title/variable
   * content elements were set to -- any OTHER font (Pacifico, a font pulled
   * from the API catalog, ...) had no @font-face in the print document at
   * all, so the browser silently substituted a generic system font at print
   * time. Visually that reads as exactly what it is: wrong glyph widths (so
   * a letter-spacing value tuned against the real font looks off), a
   * system font's synthetic bold/italic faking a weight/style the fallback
   * doesn't actually have (the "smeared/doubled" look), and boxes sized for
   * the real font's metrics clipping or blanking content sized for a
   * differently-proportioned substitute.
   */
  static _collectUsedFonts(roots: HTMLElement[]): Set<string> {
    const families = new Set<string>();
    const addFromValue = (raw: string | null | undefined) => {
      if (!raw) return;
      const primary = raw.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
      if (primary) families.add(primary);
    };
    roots.forEach(root => {
      addFromValue(root.style?.fontFamily);
      addFromValue(root.getAttribute?.('font-family'));
      root.querySelectorAll<HTMLElement>('[style*="font-family"]').forEach(el => addFromValue(el.style.fontFamily));
      root.querySelectorAll('[font-family]').forEach(el => addFromValue(el.getAttribute('font-family')));
    });
    return families;
  }

  /**
   * Like _collectUsedFonts() but also captures the exact WEIGHT/STYLE each
   * family is actually used at on the page (a bold Title, an italic
   * caption, ...), not just the family name. Used to fire explicit
   * `document.fonts.load('700 16px "DM Sans"')`-style calls in the print
   * window (see _wrapDocument()'s print script) for precisely the faces the
   * document needs, instead of only the more passive/general-purpose
   * `document.fonts.ready` -- which resolves once whatever the browser
   * already decided to fetch settles, but never forces a fetch on its own
   * and gives no per-face confirmation. Explicitly loading each real face
   * removes the guesswork from "did the bold weight actually finish
   * downloading before print() fired" -- previously the only signal was a
   * blind race against a fixed timeout.
   */
  static _collectUsedFontFaces(roots: HTMLElement[]): Array<{ family: string; weight: string; style: string }> {
    const seen  = new Set<string>();
    const faces: Array<{ family: string; weight: string; style: string }> = [];
    const addFromElement = (rawFamily: string | null | undefined, rawWeight: string | null | undefined, rawStyle: string | null | undefined) => {
      if (!rawFamily) return;
      const family = rawFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
      if (!family) return;
      const weightStr = (rawWeight || '').trim().toLowerCase();
      const weight = weightStr === 'bold' ? '700'
        : /^\d+$/.test(weightStr) ? weightStr
        : '400';
      const style = /italic|oblique/i.test(rawStyle || '') ? 'italic' : 'normal';
      const key = `${family}|${weight}|${style}`;
      if (seen.has(key)) return;
      seen.add(key);
      faces.push({ family, weight, style });
    };
    roots.forEach(root => {
      addFromElement(root.style?.fontFamily, root.style?.fontWeight, root.style?.fontStyle);
      root.querySelectorAll<HTMLElement>('[style*="font-family"]').forEach(el =>
        addFromElement(el.style.fontFamily, el.style.fontWeight, el.style.fontStyle));
    });
    return faces;
  }

  /**
   * Builds the `<link>`(s) that load every family in `usedFonts` (minus
   * SYSTEM_FONTS, which are assumed pre-installed and never fetched
   * remotely -- same rule FontList.ts's loadCraftoolsFonts() uses for the
   * live editor).
   *
   * IMPORTANT: this used to be a strict either/or -- self-hosted API link
   * OR Google Fonts link, never both, chosen purely by whether an API base
   * URL is configured at all (not by whether the API actually has the
   * requested family/weight). That is NOT a real fallback despite the old
   * comment here claiming it was: fonts.css.php (see craftools_api's
   * public/v1/fonts.css.php) only emits an `@font-face` rule for a
   * weight/style combination that actually has an uploaded file for it --
   * if a family was registered with only its Regular file (no Bold ever
   * uploaded), the self-hosted response simply omits `font-weight: 700`
   * entirely, silently, with nothing else ever requested to cover that gap.
   * The browser then has no choice but to synthesize a fake/faux bold from
   * the Regular outline for that text -- which reads exactly like the
   * reported "garbled/oversized/clipped" bold Title text, and is
   * indistinguishable from font-loading failing outright.
   *
   * Now both links are emitted together whenever an API base is
   * configured, self-hosted FIRST: per the CSS Fonts spec, multiple
   * `@font-face` rules that declare the exact same family/weight/style are
   * tried in DECLARATION ORDER as alternative sources for that one face
   * (this is how the common `local()` + web-font-fallback trick works) --
   * it is not a normal cascade override. So for any weight/style the
   * self-hosted catalog actually has, its file is tried first (preferred,
   * since it's the source the live editor itself uses via FontList.ts);
   * for any weight/style it doesn't have a rule for at all, Google's rule
   * for that same weight/style becomes the ONLY candidate and is used
   * without the browser ever needing to synthesize a substitute.
   */
  static _buildFontLink(usedFonts: Iterable<string>): string {
    const families = [...new Set(usedFonts)].filter(f => !SYSTEM_FONTS.has(f));
    if (!families.length) return '';

    const googleFontQuery = families
      .map(f => `family=${f.replace(/\s+/g, '+')}:ital,wght@0,400;0,700;1,400;1,700`)
      .join('&');
    const googleLink = `<link href="https://fonts.googleapis.com/css2?${googleFontQuery}&display=swap" rel="stylesheet">`;

    const apiBase = (window as any).CRAFTOOLS_CONFIG?.apiBase?.replace(/\/$/, '');
    if (!apiBase) return googleLink;

    // No :weight specifiers -- fonts.css.php returns EVERY registered
    // weight/style for a family when none are given.
    const selfHostedQuery = families.map(f => f.replace(/\s+/g, '+')).join('|');
    const selfHostedLink = `<link href="${apiBase}/v1/fonts.css.php?family=${selfHostedQuery}" rel="stylesheet">`;

    return `${selfHostedLink}\n    ${googleLink}`;
  }

  // ── Detecta o tamanho real da página ────────────────────────────────────────
  static _parsePageSize(pageEl: HTMLElement): PageSize {
    const w  = pageEl.style.width       || '210mm';
    const h  = pageEl.style.minHeight   || '297mm';
    const bg = pageEl.style.background  || pageEl.style.backgroundColor || '#ffffff';
    return { width: w, height: h, background: bg };
  }

  // ── CSS de impressão ─────────────────────────────────────────────────────────
  static _buildCSS(pageSizes: PageSize[]): string {
    // Indexa tamanhos únicos para criar @page nomeados
    const sizeIndex = new Map<string, { name: string; width: string; height: string }>();
    pageSizes.forEach(size => {
      const key = `${size.width}|${size.height}`;
      if (!sizeIndex.has(key)) {
        sizeIndex.set(key, {
          name:   `ct${sizeIndex.size}`,
          width:  size.width,
          height: size.height,
        });
      }
    });

    let pageRules = '';
    sizeIndex.forEach(({ name, width, height }) => {
      pageRules += `
@page ${name} {
    size: ${width} ${height};
    margin: 0;
}
.print-page-${name} {
    page: ${name};
    width: ${width} !important;
    min-height: ${height} !important;
}`;
    });

    // Fallback global
    if (sizeIndex.size === 1) {
      const first = [...sizeIndex.values()][0];
      pageRules += `\n@page { size: ${first.width} ${first.height}; margin: 0; }`;
    } else {
      pageRules += `\n@page { margin: 0; }`;
    }

    return `
/* ─── Reset ─────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }
html, body {
    margin: 0;
    padding: 0;
    background: #ccc;
    font-family: 'DM Sans', 'Helvetica Neue', Arial, sans-serif;
}

/* ─── Página ─────────────────────────────────────────────────────────── */
.print-page {
    position: relative;
    overflow: hidden;
    background: white;
    break-after: page;
    page-break-after: always;
    /* Centraliza no preview */
    margin: 0 auto;
}
.print-page:last-child {
    break-after: avoid;
    page-break-after: avoid;
}

/* ─── Elemento (equivale ao craftools-element flattened) ────────────── */
.ct-el {
    position: absolute;
    top: 0;
    left: 0;
    overflow: hidden;
}
.ct-el-inner {
    position: absolute;
    inset: 0;
    overflow: hidden;
}

/* ─── Album Grid ─────────────────────────────────────────────────────── */
.craftools-grid-container {
    position: absolute;
    display: grid;
}
.craftools-grid-cell {
    position: relative;
    overflow: hidden;
}
.craftools-element-blur-bg {
    position: absolute;
    inset: -20px;
    background-size: cover;
    background-position: center;
    opacity: 0.6;
    pointer-events: none;
    z-index: -1;
}

/* ─── Imagem interna (zoom/pan via transform) ────────────────────────── */
img {
    display: block;
    max-width: none;
    pointer-events: none;
    user-select: none;
}

/* ─── Texto ──────────────────────────────────────────────────────────── */
[contenteditable] {
    outline: none;
    white-space: pre-wrap;
    word-break: break-word;
}

/* ─── @page nomeados ─────────────────────────────────────────────────── */
${pageRules}

/* ─── Garante que a tela de preview mostre as páginas separadas ──────── */
@media screen {
    body { padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
    .print-page { box-shadow: 0 4px 32px rgba(0,0,0,0.18); }
}
@media print {
    body { background: white !important; padding: 0; }
    .print-page { margin: 0; box-shadow: none; }
    /* Chrome (and other browsers) drop CSS backgrounds -- solid colors,
       gradients, background-images -- from the printed/PDF output by
       default UNLESS the page explicitly opts in here, regardless of
       what actually renders on screen. Most users never touch the print
       dialog's own "Background graphics" checkbox, so without this every
       element painted via a background (any shape/page/element fill, and
       critically gradient TEXT -- see BaseTool._paintTextColor(), which
       fakes a gradient text color with background-clip:text +
       transparent text-fill-color) silently came out BLANK in the
       exported PDF even though it was fully visible in the editor and in
       the (unaffected, since it vectorizes fills directly instead of
       relying on this browser print behavior) SVG export. */
    *, *::before, *::after {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
    }
}
    `;
  }

  // ── Serializa 1 página ───────────────────────────────────────────────────────
  static _serializePage(pageEl: HTMLElement, size: PageSize): string {
    const clone = pageEl.cloneNode(true) as HTMLElement;

    // Remove elementos exclusivos da UI do editor
    clone.querySelectorAll([
      '.craftools-ctrlbar',
      '.album-drag-handle',
      '.slot-drag-handle',
      '.craftools-sidebar-overlay',
      '.cell-edit-btn',
    ].join(',')).forEach(el => el.remove());

    clone.querySelectorAll<HTMLElement>('craftools-element').forEach(el => this._flattenElement(el));

    // Album grid-aligned crop marks (independent of the page-level ones
    // below) -- appends an overlay <svg> directly onto `clone`, so it must
    // run before `clone.innerHTML` is captured. No-op if this page has no
    // `.craftools-grid-container` or the feature is off.
    CropMarks.applyGridMarksToClone(pageEl, clone, size.width, size.height);

    const inner = clone.innerHTML;

    // Crop marks / bleed -- see CropMarks.ts's doc comment for the model.
    // No-op (returns `inner` unchanged, marginPx: 0) when this page has
    // neither enabled.
    const wrap = CropMarks.wrapHtmlWithBleed(inner, size.width, size.height, size.background, pageEl);
    if (wrap.marginPx > 0) {
      const effWidth  = `${wrap.totalWidthPx}px`;
      const effHeight = `${wrap.totalHeightPx}px`;
      const pageClass = `ct${this._sizeKey(effWidth, effHeight)}`;
      return `<div class="print-page print-page-${pageClass}" style="width:${effWidth}; min-height:${effHeight};">${wrap.html}</div>`;
    }

    const pageClass = `ct${this._sizeKey(size.width, size.height)}`;
    const bgStyle   = size.background ? `background: ${size.background};` : '';

    return `<div class="print-page print-page-${pageClass}" style="width:${size.width}; min-height:${size.height}; ${bgStyle}">${inner}</div>`;
  }

  // ── Achata um <craftools-element> em divs regulares ─────────────────────────
  static _flattenElement(elNode: HTMLElement): void {
    const replacement = document.createElement('div');
    replacement.className = 'ct-el';
    // Preserve all styles from the parent element (e.g. background, opacity, transform)
    replacement.style.cssText = elNode.style.cssText;

    // 1. Check for Background Blur Layer
    const blurLayer = elNode.querySelector<HTMLElement>('.craftools-element-blur-bg');
    if (blurLayer) {
      replacement.appendChild(blurLayer.cloneNode(true));
    }

    // 2. Identify _content div (it's the one that is NOT a UI layer)
    let contentDiv: Element | null = null;
    for (const child of elNode.children) {
      if (
        !child.classList.contains('craftools-element-blur-bg') &&
        !child.classList.contains('craftools-ctrlbar') &&
        !child.classList.contains('craftools-sidebar-overlay')
      ) {
        contentDiv = child;
        break;
      }
    }

    if (contentDiv) {
      const inner = document.createElement('div');
      inner.className = 'ct-el-inner';
      // Preserve all styles from the content div (e.g. font, color, border radius)
      inner.style.cssText = (contentDiv as HTMLElement).style.cssText || '';
      
      [...contentDiv.childNodes].forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE || child.nodeType === Node.TEXT_NODE) {
          inner.appendChild(child.cloneNode(true));
        }
      });
      replacement.appendChild(inner);
    }

    elNode.replaceWith(replacement);
  }

  // ── Envolve tudo num documento HTML completo ─────────────────────────────────
  /**
   * @param opts.autoPrint  Whether to include the `<script>` that fires
   *   `window.print()` on load. Default `true` (every existing caller --
   *   this is a real print/export document meant to open its own window
   *   and prompt the print dialog). Pass `false` when the same markup/CSS
   *   is instead being embedded read-only somewhere else (e.g.
   *   AgendaExport.ts's buildPreviewHtml(), shown in an iframe inside the
   *   properties panel) -- without this, that embed would silently pop the
   *   browser's print dialog for whatever iframe/window it's loaded into.
   */
  static _wrapDocument(css: string, body: string, opts: { autoPrint?: boolean; usedFonts?: Iterable<string>; usedFontFaces?: Array<{ family: string; weight: string; style: string }> } = {}): string {
    const htmlLangMap: Record<string, string> = { 'pt-br': 'pt-BR', 'en': 'en', 'es': 'es' };
    const htmlLang = htmlLangMap[I18n.currentLang] || 'pt-BR';
    const autoPrint = opts.autoPrint !== false;

    /**
     * "Preview shows blank/missing emoji, but the actually-saved PDF has
     * them" bug: window.print()'s live preview pane is a snapshot taken
     * whenever the browser last repainted the document, while the final
     * output (fired when the user clicks Save/Print) is rendered fresh at
     * that later moment. 'Noto Color Emoji' -- the only entry in
     * EmojiFont.ts's EMOJI_FONT_STACK that's an actual web font (the rest
     * are OS-installed fallbacks like Apple/Segoe UI Emoji) -- is a large
     * file, and nothing was ever forcing the browser to fetch + wait for it
     * specifically: _collectUsedFonts()/_collectUsedFontFaces() deliberately
     * keep only the FIRST family in each element's font-family stack (the
     * user's actually-chosen font), so 'Noto Color Emoji' never made it
     * into the explicit document.fonts.load() calls below even though a
     * `<link>` for it could still land in <head>. It was purely a passive,
     * lazy fetch (font-display:swap) triggered only once the browser
     * decided some glyph on the page actually needed that fallback -- with
     * no explicit wait, print()'s 150ms-after-fonts.ready timing routinely
     * fired the preview snapshot before that fetch finished, while the
     * user's own delay before clicking Save gave it enough time to land
     * for the real output.
     *
     * Fix: scan the serialized body for any emoji glyph and, if present,
     * treat 'Noto Color Emoji' exactly like every other real font used on
     * the page -- request its `<link>` (previously this was ALSO wrongly
     * skipped entirely whenever a self-hosted font API base was configured,
     * see the old apiBase-gated emojiFontLink this replaces) and add it to
     * the explicit document.fonts.load() list so print() genuinely waits
     * for it before firing, same as every other face.
     */
    const hasEmoji = /\p{Extended_Pictographic}/u.test(body);
    const usedFonts = new Set(opts.usedFonts ?? []);
    const usedFontFacesInput = [...(opts.usedFontFaces ?? [])];
    if (hasEmoji) {
      usedFonts.add('Noto Color Emoji');
      usedFontFacesInput.push({ family: 'Noto Color Emoji', weight: '400', style: 'normal' });
    }

    // Dedupe against BASELINE_FONT_FACES + whatever the actual pages use
    // (mirrors the family-only dedupe below for _buildFontLink).
    const faceKey = (f: { family: string; weight: string; style: string }) => `${f.family}|${f.weight}|${f.style}`;
    const facesByKey = new Map<string, { family: string; weight: string; style: string }>();
    [...BASELINE_FONT_FACES, ...usedFontFacesInput].forEach(f => facesByKey.set(faceKey(f), f));
    const usedFontFacesJson = JSON.stringify([...facesByKey.values()]);

    const printScript = autoPrint ? `
<script>
    // Dispara o print assim que as fontes e imagens carregarem
    window.addEventListener('load', () => {
        // Ajusta o título do documento
        document.title =  "${this.createTitle()}" +  window.location.href.split('/').reverse()[0];

        // window.load fires once the <link rel="stylesheet"> requests below
        // finish (browsers block load on stylesheet fetches), but the actual
        // WEB FONT FILES those stylesheets' @font-face rules point at are
        // NOT guaranteed to have finished downloading/parsing by then --
        // @font-face fetches lazily, only once something on the page
        // actually needs to paint with that font, and with font-display:swap
        // (used by both the self-hosted fonts.css.php endpoint and the
        // Google Fonts fallback) the browser paints with a FALLBACK font
        // first and swaps in the real one whenever it finishes loading.
        //
        // Waiting on document.fonts.ready alone is only a SOFT signal: it
        // resolves once whatever the browser already decided to fetch has
        // settled, but never forces a fetch on its own and gives no
        // per-face confirmation that e.g. the BOLD weight specifically ever
        // loaded (only that *something* did). This blob: print window is a
        // cold, uncached, cross-origin fetch every single time (unlike the
        // long-lived live editor tab), so it's the worst-case timing for
        // that kind of soft race. Explicitly forcing + confirming every
        // face the document actually needs via document.fonts.load()
        // removes that guesswork entirely -- each call resolves once THAT
        // exact family/weight/style has loaded or failed, no assumptions.
        const usedFontFaces = ${usedFontFacesJson};
        const explicitLoads = (window.document.fonts && window.document.fonts.load)
            ? Promise.all(usedFontFaces.map(function (f) {
                return window.document.fonts.load(f.style + ' ' + f.weight + ' 16px "' + f.family + '"').catch(function () { return null; });
              }))
            : Promise.resolve();
        const whenFontsSettled = explicitLoads.then(function () {
            return (window.document.fonts && window.document.fonts.ready) ? window.document.fonts.ready : Promise.resolve();
        });
        // Still capped by a hard timeout as a safety net in case a font
        // request hangs (offline API, blocked CDN, ...) so export never
        // silently hangs forever. Raised from 4s to 6s: the self-hosted API
        // is a single small server with no CDN, genuinely slower under a
        // cold cross-origin fetch than Google Fonts' infrastructure.
        const safetyTimeout = new Promise((resolve) => setTimeout(resolve, 6000));
        Promise.race([whenFontsSettled, safetyTimeout]).then(() => {
            // Small extra delay so the browser has a chance to actually
            // repaint/reflow with the now-settled fonts before print() --
            // fonts.ready resolving doesn't itself guarantee a frame has
            // been painted with them yet.
            setTimeout(() => window.print(), 150);
        });
    });
<\/script>` : '';
    // BASELINE_FONTS always included (see its own comment above) + whatever
    // fonts the actual pages use (Text/Title/Variable Content/Lettering/...)
    // -- see _collectUsedFonts()'s doc comment for why this print window
    // can't just inherit the live editor's own <head> fonts. 'Noto Color
    // Emoji' rides along here too now (via `usedFonts`, see the hasEmoji
    // block above) instead of the old separate apiBase-gated emojiFontLink
    // -- _buildFontLink() already emits both the self-hosted AND Google
    // Fonts links together whenever an API base is configured, so this
    // covers the emoji font the exact same reliable way as any real font.
    const fontLink = this._buildFontLink(new Set([...BASELINE_FONTS, ...usedFonts]));

    return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Craftools</title>
    ${fontLink}
    <style>${css}</style>
</head>
<body>
${body}${printScript}
</body>
</html>`;
  }

  // ── Abre o blob em nova aba ──────────────────────────────────────────────────
  static _openPrintWindow(html: string): void {
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url  = URL.createObjectURL(blob);

    const win = window.open(url, '_blank');
    if (!win) {
      Notify.toast(I18n.t('pdfExport.popupBlocked'), 'error', 6000);
      URL.revokeObjectURL(url);
      return;
    }

    // Limpa o blob após 60s (tempo suficiente para o print dialog)
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  // ── Helper: chave para map/class a partir de um tamanho ─────────────────────
  static _sizeKey(w: string, h: string): string {
    const str = `${w}|${h}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash.toString(36);
  }

  static createTitle(): string {
    const n   = new Date();
    const pad = (v: number) => String(v).padStart(2, '0');
    return `Craftools - ${String(n.getFullYear()).slice(-2)}${pad(n.getMonth() + 1)}${pad(n.getDate())}${pad(n.getHours())}${pad(n.getMinutes())} - `;
  }
}
