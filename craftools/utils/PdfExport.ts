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
import './PdfExport_Translations.js';

/** Always loaded regardless of what the document actually uses -- CalendarRenderer.ts,
 *  PaperPatterns.ts and a few other generated-markup helpers hardcode 'DM Sans' inline
 *  without going through a craftools-element's own font-family style, so there's no
 *  reliable way to detect their usage by scanning the DOM the way _collectUsedFonts()
 *  does for everything else. Kept as a static baseline like before this fix. */
const BASELINE_FONTS = ['DM Sans', 'DM Serif Display', 'DM Mono'];

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

    const pageSizes = pages.map(p => this._parsePageSize(p));
    const css       = this._buildCSS(pageSizes);
    const pagesHtml = pages.map((page, i) => this._serializePage(page, pageSizes[i])).join('\n');
    const usedFonts = this._collectUsedFonts(pages);
    const fullHtml  = this._wrapDocument(css, pagesHtml, { usedFonts });

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
   * Builds the `<link>` that loads every family in `usedFonts` (minus
   * SYSTEM_FONTS, which are assumed pre-installed and never fetched
   * remotely -- same rule FontList.ts's loadCraftoolsFonts() uses for the
   * live editor). Mirrors that same self-hosted-API-first, Google-Fonts-
   * fallback strategy so the print window's fonts come from wherever the
   * live editor's own fonts come from.
   */
  static _buildFontLink(usedFonts: Iterable<string>): string {
    const families = [...new Set(usedFonts)].filter(f => !SYSTEM_FONTS.has(f));
    if (!families.length) return '';

    const apiBase = (window as any).CRAFTOOLS_CONFIG?.apiBase?.replace(/\/$/, '');
    if (apiBase) {
      // No :weight specifiers -- fonts.css.php returns EVERY registered
      // weight/style for a family when none are given, which is safer here
      // than guessing (an arbitrary API-catalog font might not even have a
      // 700/italic file, unlike the 3 hand-picked baseline families the old
      // code hardcoded weights for).
      const fontQuery = families.map(f => f.replace(/\s+/g, '+')).join('|');
      return `<link href="${apiBase}/v1/fonts.css.php?family=${fontQuery}" rel="stylesheet">`;
    }

    const fontQuery = families
      .map(f => `family=${f.replace(/\s+/g, '+')}:ital,wght@0,400;0,700;1,400;1,700`)
      .join('&');
    return `<link href="https://fonts.googleapis.com/css2?${fontQuery}&display=swap" rel="stylesheet">`;
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

    const pageClass = `ct${this._sizeKey(size.width, size.height)}`;
    const bgStyle   = size.background ? `background: ${size.background};` : '';
    const inner     = clone.innerHTML;

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
  static _wrapDocument(css: string, body: string, opts: { autoPrint?: boolean; usedFonts?: Iterable<string> } = {}): string {
    const htmlLangMap: Record<string, string> = { 'pt-br': 'pt-BR', 'en': 'en', 'es': 'es' };
    const htmlLang = htmlLangMap[I18n.currentLang] || 'pt-BR';
    const autoPrint = opts.autoPrint !== false;
    const printScript = autoPrint ? `
<script>
    // Dispara o print assim que as fontes e imagens carregarem
    window.addEventListener('load', () => {
        // Ajusta o título do documento
        document.title =  "${this.createTitle()}" +  window.location.href.split('/').reverse()[0];

        // Pequeno delay para garantir renderização completa
        setTimeout(() => window.print(), 600);
    });
<\/script>` : '';
    const apiBase = (window as any).CRAFTOOLS_CONFIG?.apiBase?.replace(/\/$/, '');
    // BASELINE_FONTS always included (see its own comment above) + whatever
    // fonts the actual pages use (Text/Title/Variable Content/Lettering/...)
    // -- see _collectUsedFonts()'s doc comment for why this print window
    // can't just inherit the live editor's own <head> fonts.
    const fontLink       = this._buildFontLink(new Set([...BASELINE_FONTS, ...(opts.usedFonts ?? [])]));
    const emojiFontLink  = apiBase ? '' : `<link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap" rel="stylesheet">`;

    return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Craftools</title>
    ${fontLink}
    ${emojiFontLink}
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
