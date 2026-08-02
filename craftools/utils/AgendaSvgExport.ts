/**
 * AgendaSvgExport.ts
 *
 * EXPERIMENTAL. Renders Agenda output pages to standalone vector .svg files
 * (one per page) via @tooooools/html-to-svg, instead of a rasterized PNG
 * (ImageExport.ts) or the browser's own print-to-PDF pipeline
 * (PdfExport.ts / AgendaExport.ts). Added specifically so real Agenda page
 * content can be tested against that library's actual fidelity/coverage --
 * see its README (github.com/tooooools/html-to-svg): it renders a generic
 * element's background-color + border-radius, vectorizes text via
 * Opentype.js, and passes through <img>/<canvas>/inline <svg> as embedded
 * images. It does NOT (yet) support box-shadow, text-decoration, or CSS
 * `transform: skew()`. Per the user's own confirmation this project
 * doesn't use skew or box-shadow, so those two gaps shouldn't matter here
 * -- everything else (gradients, rotation, photos, custom fonts) is
 * genuinely untested until this button is actually used.
 *
 * Border handling: the vendored library's DivRenderer DOES read and draw
 * border-*-color/width/style (its own dist source has real border logic --
 * dashed/dotted dash patterns, a stroked rounded-rect when border-radius is
 * set), contrary to what an earlier revision of this comment claimed. The
 * actual bug was structural: the library draws that border geometry as a
 * CHILD of the very same clip-path `<g>` it creates for that element's own
 * `overflow: hidden`, with the clip rect set to EXACTLY the element's own
 * bounding box. Every grid cell in this app (Table/Calendar/Agenda day
 * boxes, header cells, ...) wraps its content in `overflow:hidden` sized
 * identically to its own border box -- a thin (often 1px) border sitting
 * exactly on that clip boundary gets partially or fully clipped away by
 * sub-pixel rounding in whatever renders the final SVG, which reliably
 * produced "no border at all" with no error anywhere. _extractClippedBorders()/
 * _drawBorderOverlays() below work around this by neutralizing (not
 * removing -- see their own doc comments) each affected element's CSS
 * border before handing off to html-to-svg, then redrawing the exact same
 * geometry as unclipped overlays appended directly to the finished SVG's
 * root, where nothing clips them.
 *
 * Font handling: the renderer vectorizes every glyph via Opentype.js
 * (bundled inside @tooooools/html-to-svg, pinned at v1.3.4), which needs a
 * REAL font FILE per family/weight/style declared up front -- it cannot
 * reuse whatever @font-face the live app already has loaded from Google
 * Fonts' CSS2 API, because that endpoint serves WOFF2 to modern browsers
 * and this Opentype.js version only parses raw TTF/OTF or WOFF1 (zlib
 * inflate, via its own tiny-inflate dependency) -- confirmed by grepping
 * its source for a WOFF2 ('wOF2') signature branch: there isn't one, only
 * 'wOFF' (WOFF1). WOFF1 builds of the app's 3 core families (DM Sans, DM
 * Serif Display, DM Mono -- see PdfExport.ts's _wrapDocument()) are bundled
 * locally under assets/fonts/ instead (sourced from the @fontsource npm
 * mirrors, which unlike fonts.googleapis.com's CSS2 API still ship a WOFF1
 * variant per family/weight/style). Any OTHER font used on a given Agenda
 * page (a different Google Font chosen per element, or a "type a locally
 * installed font name" entry -- see FontList.ts) has no matching
 * declaration here and will make the renderer throw for that page; caught
 * per-page below so one bad page doesn't abort the whole batch. Extending
 * font coverage (e.g. deriving declarations dynamically from whatever
 * fonts a given document actually uses) is expected follow-up once this
 * first pass has actually been tested against real content.
 */
import { Notify }            from './Notify.js';
import { I18n }              from '../settings/Translations.js';
import { AgendaExport }      from './AgendaExport.js';
import { withEmojiFallback } from './EmojiFont.js';
import HtmlToSvg              from '@tooooools/html-to-svg';
import html2canvas            from 'html2canvas';
import './AgendaSvgExport_Translations.js';

import dmSansRegularUrl         from '../../assets/fonts/DMSans-Regular.woff?url';
import dmSansBoldUrl            from '../../assets/fonts/DMSans-Bold.woff?url';
import dmSansItalicUrl          from '../../assets/fonts/DMSans-Italic.woff?url';
import dmSerifDisplayRegularUrl from '../../assets/fonts/DMSerifDisplay-Regular.woff?url';
import dmSerifDisplayItalicUrl  from '../../assets/fonts/DMSerifDisplay-Italic.woff?url';
import dmMonoRegularUrl         from '../../assets/fonts/DMMono-Regular.woff?url';
import dmMonoMediumUrl          from '../../assets/fonts/DMMono-Medium.woff?url';

// ── Font declarations -- see file header for why these must be real files ──
//
// @tooooools/html-to-svg's text renderer matches a font declaration against
// a text node's computed font-family via EXACT STRING EQUALITY (confirmed
// by reading its source, matchFont() in dist/html-to-svg.module.js) --
// `family === computedStyle.getPropertyValue('font-family').replace(/['"]/g, '')`.
// It does NOT parse the value as a CSS font-family fallback LIST and match
// any single name in it. Every text-bearing element in this app sets its
// font-family via EmojiFont.ts's withEmojiFallback() (see that file), which
// always appends the emoji fallback stack -- so the computed value for a
// "DM Sans" text box is never just `DM Sans`, it's the full stack string
// (`DM Sans, Noto Color Emoji, Apple Color Emoji, Segoe UI Emoji, Segoe UI
// Symbol, Android Emoji, sans-serif` once getComputedStyle's quotes are
// stripped). Declaring `family: 'DM Sans'` alone -- what this looked like
// before actually testing it against a real page -- never matches anything
// real, hence every text node failing with "Cannot find font" and every
// exported SVG coming out blank. Building the SAME stack string here via
// the app's own withEmojiFallback() (rather than hand-copying it) keeps
// this in sync automatically if that fallback stack ever changes.
import { loadFontCatalog } from './ApiDataLoader.ts';

const fontFamilyKey = (primary: string): string => withEmojiFallback(primary).replace(/['"]/g, '');

const CORE_FONTS = [
  { family: fontFamilyKey('DM Sans'),          url: dmSansRegularUrl },
  { family: fontFamilyKey('DM Sans'),          url: dmSansBoldUrl,            weight: '700' },
  { family: fontFamilyKey('DM Sans'),          url: dmSansItalicUrl,          style: 'italic' },
  { family: fontFamilyKey('DM Serif Display'), url: dmSerifDisplayRegularUrl },
  { family: fontFamilyKey('DM Serif Display'), url: dmSerifDisplayItalicUrl,  style: 'italic' },
  { family: fontFamilyKey('DM Mono'),          url: dmMonoRegularUrl },
  { family: fontFamilyKey('DM Mono'),          url: dmMonoMediumUrl,          weight: '500' },
];

/**
 * Resolve as declarações de fonte para o @tooooools/html-to-svg.
 * Tenta buscar o catálogo de fontes da API (arquivos TTF/OTF/WOFF) e montar os objetos;
 * se a API não retornar dados, utiliza o fallback estático CORE_FONTS.
 */
async function resolveSvgExportFonts(): Promise<Array<{ family: string; url: string; weight?: string; style?: string }>> {
  const apiCatalog = await loadFontCatalog();
  const apiBase = (window as any).CRAFTOOLS_CONFIG?.apiBase?.replace(/\/$/, '');

  if (apiCatalog && apiCatalog.length > 0 && apiBase) {
    const dynamicFonts: Array<{ family: string; url: string; weight?: string; style?: string }> = [];
    for (const fam of apiCatalog) {
      const famKey = fontFamilyKey(fam.name);
      for (const file of fam.files) {
        // Opentype.js (usado pelo html-to-svg) suporta ttf, otf, woff (não woff2).
        if (['ttf', 'otf', 'woff'].includes(file.format)) {
          dynamicFonts.push({
            family: famKey,
            url: apiBase + file.api_url,
            weight: String(file.weight),
            style: file.style,
          });
        }
      }
    }
    if (dynamicFonts.length > 0) {
      return dynamicFonts;
    }
  }

  return CORE_FONTS;
}

// Minimal, hand-picked subset of PdfExport._buildCSS()'s rules -- only the
// ones that actually affect a flattened page's layout (absolute positioning
// of .ct-el/.ct-el-inner, grid/album/blur-bg support, image/text resets).
// Deliberately NOT the full stylesheet: that also carries a global
// `html, body { ... background:#ccc; ... }` reset and @page/@media rules
// meant for a print window's own standalone document -- injecting THOSE
// into the live app's <head> (this render happens directly on the running
// page, not inside a freshly opened blob document like Pdf/AgendaExport)
// would visibly flash the whole editor UI grey for as long as the render
// takes. None of these class names are used anywhere in the live editor's
// own normal (non-flattened) markup, so scoping isn't needed.
const SVG_STAGE_CSS = `
.print-page { position: relative; overflow: hidden; background: white; }
.ct-el { position: absolute; top: 0; left: 0; overflow: hidden; }
.ct-el-inner { position: absolute; inset: 0; overflow: hidden; }
.craftools-grid-container { position: absolute; display: grid; }
.craftools-grid-cell { position: relative; overflow: hidden; }
.craftools-element-blur-bg { position: absolute; inset: -20px; background-size: cover; background-position: center; opacity: 0.6; pointer-events: none; z-index: -1; }
img { display: block; max-width: none; pointer-events: none; user-select: none; }
[contenteditable] { outline: none; white-space: pre-wrap; word-break: break-word; }
`;

const t = (key: string): string => I18n.t('agendaSvgExport.' + key);

export class AgendaSvgExport {

  /**
   * Entry point -- called from AgendaExportTool.ts's "Exportar SVG" button
   * (Actions tab), right next to the existing PDF button. Renders every
   * configured output page (same `data-agenda-repeat`/alternate/sequence
   * config from the Pages tab that AgendaExport.print() itself reads --
   * no separate/lower default here, this mirrors the PDF button's "export
   * everything" behavior exactly) unless `opts.maxOutputPages` caps it.
   * By default (`opts.merge !== false`) all rendered pages are combined
   * into a SINGLE downloaded .svg, stacked vertically -- SVG has no native
   * concept of "pages" the way PDF does, so this is the standard
   * convention for representing several pages in one file (one tall
   * canvas, one page-height's worth of content per section). Pass
   * `merge: false` to get one file per page instead.
   *
   * Still EXPERIMENTAL -- see this file's header comment for what
   * @tooooools/html-to-svg does/doesn't support yet. A large agenda (many
   * repeated pages) hasn't been performance-tested with this renderer the
   * way the PDF path has; if it's noticeably slow or a page's font isn't
   * covered by CORE_FONTS, that failure is caught per-page (see the loop
   * below) so one bad page doesn't abort the whole run.
   */
  static async print(editor: HTMLElement, opts: { maxOutputPages?: number; merge?: boolean } = {}): Promise<void> {
    const merge = opts.merge !== false;

    const pages = await AgendaExport.buildFlattenedOutputPages(editor, { maxOutputPages: opts.maxOutputPages });
    if (!pages || !pages.length) {
      Notify.toast(t('noPagesFound'), 'error');
      return;
    }

    // Persistent progress toast, updated in place (see Notify.ts's
    // ToastHandle.update()) as each page finishes instead of spawning a new
    // toast per page -- with a few hundred pages that would otherwise be a
    // few hundred stacked/animating toasts. `duration: 0` means it never
    // auto-dismisses; explicitly dismissed in `finally` below once the real
    // done/error toast is about to show.
    const totalPages   = pages.length;
    const progressToast = Notify.toast(this._progressText(0, totalPages), 'info', 0);

    const styleTag = document.createElement('style');
    styleTag.id = 'agenda-svg-export-css';
    styleTag.textContent = SVG_STAGE_CSS;
    document.head.appendChild(styleTag);

    // Off-screen stage, attached to the live document so fonts/computed
    // layout resolve exactly like the real canvas.
    const stage = document.createElement('div');
    stage.style.cssText = 'position:fixed; left:-99999px; top:0; z-index:-1;';
    document.body.appendChild(stage);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any = null;
    let okCount  = 0;
    let errCount = 0;
    const rendered: SVGSVGElement[] = [];

    try {
      const fontsToUse = await resolveSvgExportFonts();
      renderer = new HtmlToSvg({ fonts: fontsToUse });
      await renderer.preload();

      let i = 0;
      for (const { el, size } of pages) {
        i++;
        el.classList.add('print-page');
        el.style.width     = size.width;
        el.style.minHeight = size.height;
        if (size.background) el.style.background = size.background;

        // craftools.css runs every `.craftools-page` through a `pageIn`
        // entrance animation (opacity 0 -> 1 over .25s, see @keyframes
        // pageIn) -- the class survives on this clone since only the
        // individual `<craftools-element>`s get flattened/replaced, not the
        // page container itself. html-to-svg reads the element's real
        // COMPUTED opacity at the moment render() runs (synchronously,
        // right after insertion) and bakes it into the SVG's root <g> --
        // catching the animation still at or near its `from { opacity:0 }`
        // keyframe, so every export came out as a fully present but
        // opacity="0" (i.e. fully transparent/invisible) SVG. Killing the
        // animation outright avoids the whole timing race instead of
        // trying to wait it out.
        el.style.animation = 'none';

        stage.innerHTML = '';
        stage.appendChild(el);

        // Fix rendering issues for emoji, icon, image, album and emoji-kitchen
        // tools before handing the DOM to html-to-svg (see _preprocessForSvgExport).
        await this._preprocessForSvgExport(el);

        // Neutralize (not remove -- see its own doc comment) borders that
        // would otherwise get clipped away by html-to-svg's own rendering
        // of that same element's `overflow:hidden` (see this file's header
        // comment). Must run AFTER _preprocessForSvgExport (reads whatever
        // DOM state the other passes left behind) and its geometry must be
        // captured BEFORE render() -- the actual overlay elements get drawn
        // onto the finished SVG below instead.
        const clippedBorders = this._extractClippedBorders(el);

        try {
          const svg = await renderer.render(
            el,
            { rasterizeNestedSVG: true },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            async (_from: any, to: any) => to,
          );
          this._drawBorderOverlays(svg, clippedBorders);
          if (merge) {
            rendered.push(svg);
          } else {
            this._download(svg.outerHTML, `craftools-agenda-p${i}.svg`);
          }
          okCount++;
        } catch (err) {
          console.error('[AgendaSvgExport] Failed to render page', i, err);
          errCount++;
        }

        progressToast.update(this._progressText(i, totalPages));
      }

      if (merge && rendered.length) {
        progressToast.update(t('merging'));
        this._download(this._mergePages(rendered), 'craftools-agenda.svg');
      }

      progressToast.dismiss();
      if (okCount > 0)  Notify.toast(t('done').replace('{n}', String(okCount)), 'success', 5000);
      if (errCount > 0) Notify.toast(t('someFailed').replace('{n}', String(errCount)), 'error', 8000);

    } catch (err) {
      console.error('[AgendaSvgExport] Export failed:', err);
      progressToast.dismiss();
      Notify.toast(t('exportError'), 'error', 6000);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (renderer as any)?.destroy?.();
      stage.remove();
      styleTag.remove();
    }
  }

  /** "Gerando SVG(s)… 42/365 (12%)" -- used both for the initial 0% state and every update. */
  private static _progressText(done: number, total: number): string {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return `${t('generating')} ${done}/${total} (${pct}%)`;
  }

  /**
   * Combines several independently-rendered page SVGs into a single
   * document, stacked vertically (SVG has no native "pages" the way PDF
   * does -- one tall canvas with each page's content translated to its own
   * vertical band is the standard convention for this). Namespaces every
   * id in each page first (see _namespaceIds()): html-to-svg's own ids are
   * short content-derived hashes (e.g. "clip_d75afb83a7e"), which collide
   * across pages that render near-identical content -- extremely likely
   * here, since Agenda pages are usually the same template repeated with
   * only a few resolved variables differing. Left unprefixed, merging
   * would silently point later pages' clip-path/filter references at an
   * earlier page's <defs> entries.
   */
  private static _mergePages(svgs: SVGSVGElement[], gap = 24): string {
    const NS = 'http://www.w3.org/2000/svg';
    const widths  = svgs.map(s => parseFloat(s.getAttribute('width')  || '0') || 0);
    const heights = svgs.map(s => parseFloat(s.getAttribute('height') || '0') || 0);
    const totalWidth  = Math.max(...widths, 1);
    const totalHeight = heights.reduce((sum, h) => sum + h, 0) + gap * Math.max(0, svgs.length - 1);

    const root = document.createElementNS(NS, 'svg');
    root.setAttribute('xmlns', NS);
    root.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
    root.setAttribute('width',  String(totalWidth));
    root.setAttribute('height', String(totalHeight));

    // Purely cosmetic backdrop so stacked pages read as separate sheets
    // instead of bleeding into each other -- mirrors how PdfExport's own
    // on-screen print preview shows pages on a grey background with a gap.
    const backdrop = document.createElementNS(NS, 'rect');
    backdrop.setAttribute('width',  String(totalWidth));
    backdrop.setAttribute('height', String(totalHeight));
    backdrop.setAttribute('fill', '#e4e4e7');
    root.appendChild(backdrop);

    const defs = document.createElementNS(NS, 'defs');
    root.appendChild(defs);

    let offsetY = 0;
    svgs.forEach((svg, i) => {
      this._namespaceIds(svg, `p${i + 1}`);

      const pageDefs = svg.querySelector('defs');
      if (pageDefs) [...pageDefs.children].forEach(child => defs.appendChild(child));

      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${(totalWidth - (widths[i] || 0)) / 2}, ${offsetY})`);
      [...svg.childNodes].forEach(node => {
        if ((node as Element).tagName?.toLowerCase() === 'defs') return;
        g.appendChild(node.cloneNode(true));
      });
      root.appendChild(g);

      offsetY += (heights[i] || 0) + gap;
    });

    return new XMLSerializer().serializeToString(root);
  }

  /** Prefixes every `id` in `svg` with `prefix`, rewriting every attribute
   *  that references one of those ids (`url(#id)` on clip-path/filter/mask/
   *  fill/stroke, and `href`/`xlink:href="#id"`) to match -- see
   *  _mergePages()'s doc comment for why this matters. */
  private static _namespaceIds(svg: SVGSVGElement, prefix: string): void {
    const idMap = new Map<string, string>();
    svg.querySelectorAll('[id]').forEach(el => {
      const oldId = el.getAttribute('id');
      if (!oldId) return;
      const newId = `${prefix}-${oldId}`;
      idMap.set(oldId, newId);
      el.setAttribute('id', newId);
    });
    if (!idMap.size) return;

    const URL_REF_ATTRS = ['clip-path', 'filter', 'mask', 'fill', 'stroke'];
    svg.querySelectorAll('*').forEach(el => {
      for (const attr of URL_REF_ATTRS) {
        const val = el.getAttribute(attr);
        if (val && val.startsWith('url(#') && val.endsWith(')')) {
          const newId = idMap.get(val.slice(5, -1));
          if (newId) el.setAttribute(attr, `url(#${newId})`);
        }
      }
      for (const attr of ['href', 'xlink:href']) {
        const val = el.getAttribute(attr);
        if (val && val.startsWith('#')) {
          const newId = idMap.get(val.slice(1));
          if (newId) el.setAttribute(attr, `#${newId}`);
        }
      }
    });
  }

  // ── SVG pre-processing ───────────────────────────────────────────────────

  /**
   * Fixes known html-to-svg rendering failures for specific tool types,
   * applied directly to the flattened page element while it is in the
   * off-screen stage (so offsetWidth/offsetHeight return real computed values).
   *
   * Four passes:
   *
   * 1. **Emoji** — EmojiTool renders a `<div data-emoji-char="😀">` with
   *    `font-family: 'Noto Color Emoji'`. That family is not in the
   *    html-to-svg Opentype catalog, so the text renderer silently drops
   *    every glyph and the element comes out blank. The browser's canvas API
   *    DOES have the system emoji font, so we rasterise each emoji at the
   *    container's pixel size and swap it for an `<img src="data:image/png">`.
   *
   * 2. **Icons** — IconTool builds `<svg viewBox="…">` with no `width` or
   *    `height` attribute and no CSS dimensions. An SVG without explicit
   *    dimensions is a replaced element that defaults to 300 × 150 px in the
   *    browser, which makes html-to-svg embed it at those wrong dimensions
   *    instead of the actual container size. Setting `width/height:100%` via
   *    CSS makes the computed size match the parent `.ct-el-inner`, so the
   *    embedded SVG image is sized correctly.
   *
   * 3. **External images** — EmojiKitchen stores a Google CDN URL in the
   *    `<img src>`. html-to-svg's ImageRenderer copies the src directly into
   *    the SVG `<image href>`, producing an SVG that depends on network
   *    access and may be blocked by SVG viewers (Inkscape, Illustrator).
   *    We pre-fetch every non-data-URL image via a temporary `<img>` +
   *    canvas and replace its src with a base64 data URL. Upload images
   *    (ImageTool, AlbumTool) are already data URLs from FileReader, so they
   *    skip this path entirely.
   *
   * 4. **Gradient text** — BaseTool._paintTextColor()'s gradient mode (used
   *    by Text/Title/Variable Content whenever the shared color-gradient
   *    picker is set to "gradient") fakes a gradient text color with
   *    `background: <gradient>; background-clip: text;
   *    -webkit-text-fill-color: transparent`. html-to-svg's text renderer
   *    reads the plain (transparent) fill color for glyphs and doesn't
   *    special-case `background-clip: text`, so every gradient-colored text
   *    node -- including a date/number variable styled that way -- came out
   *    fully invisible instead of gradient-filled. Since the browser itself
   *    (unlike html-to-svg) renders this combination correctly on screen, we
   *    rasterize just that element via html2canvas (already vendored for
   *    ImageExport.ts/TableTool.ts) and swap it for a plain `<img>`, then
   *    clear the gradient-text styles so html-to-svg doesn't also try to
   *    paint the (unsupported) clipped background behind our raster.
   */
  private static async _preprocessForSvgExport(pageEl: HTMLElement): Promise<void> {

    // ── Pass 1: emoji ────────────────────────────────────────────────────
    pageEl.querySelectorAll<HTMLElement>('[data-emoji-char]').forEach(emojiDiv => {
      const char = emojiDiv.dataset.emojiChar || emojiDiv.textContent?.trim() || '';
      if (!char) return;

      const parent = emojiDiv.parentElement;
      const pw = parent ? parent.offsetWidth  : 0;
      const ph = parent ? parent.offsetHeight : 0;
      // Use the larger dimension to keep the emoji square; fall back to 80.
      const boxSize = Math.max(pw, ph, 80);
      const dpr = 2; // render at 2× for sharper output in high-DPI contexts

      const canvas = document.createElement('canvas');
      canvas.width  = boxSize * dpr;
      canvas.height = boxSize * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      // Scale emoji font to ~85% of the box, capped at the declared fontSize.
      const declaredPx = parseFloat(emojiDiv.style.fontSize) || 64;
      const fontPx = Math.min(declaredPx, boxSize * 0.85);
      ctx.font = `${fontPx}px 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char, boxSize / 2, boxSize / 2);

      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png');
      img.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;user-select:none;pointer-events:none;';
      emojiDiv.replaceWith(img);
    });

    // ── Pass 2: icon SVGs ────────────────────────────────────────────────
    pageEl.querySelectorAll<SVGSVGElement>('svg').forEach(svg => {
      // Only patch SVGs without any explicit size already set.
      if (svg.style.width || svg.getAttribute('width') || svg.style.height || svg.getAttribute('height')) return;
      // Fill the parent container (.ct-el-inner or .craftools-grid-cell).
      svg.style.width   = '100%';
      svg.style.height  = '100%';
      svg.style.display = 'block';
    });

    // ── Pass 3: external image URLs ──────────────────────────────────────
    const imgEls = [...pageEl.querySelectorAll<HTMLImageElement>('img')];
    await Promise.all(imgEls.map(async img => {
      const src = img.getAttribute('src') || img.src || '';
      if (!src || src.startsWith('data:')) return; // already embedded
      try {
        img.src = await this._toDataUrl(src);
      } catch {
        // Non-fatal: keep original src (SVG will have an external reference).
        console.warn('[AgendaSvgExport] Could not inline img src:', src.slice(0, 100));
      }
    }));

    // ── Pass 4: gradient text (background-clip: text) ──────────────────
    // Runs last so it captures anything the earlier passes already fixed
    // (e.g. a gradient-colored heading containing an emoji rasterized by
    // Pass 1). See this method's own doc comment, item 4, for why this is
    // needed at all -- html-to-svg doesn't understand background-clip:text,
    // so without this every gradient-colored text node (including a
    // gradient-styled date/number) rendered fully blank.
    const gradientTextEls = [...pageEl.querySelectorAll<HTMLElement>('*')]
      .filter(el => el.style.webkitTextFillColor === 'transparent');
    await Promise.all(gradientTextEls.map(async el => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return; // nothing visible to rasterize
      try {
        const scale  = 3; // sharp enough for a vector-quality export
        const canvas = await html2canvas(el, {
          scale,
          backgroundColor: null, // keep transparency around the glyphs
          useCORS:         true,
          allowTaint:       true,
          logging:          false,
        });
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.style.cssText = `display:block; width:${w}px; height:${h}px; user-select:none; pointer-events:none;`;

        // Clear the gradient-text styles so html-to-svg's own background
        // renderer doesn't ALSO try (and fail) to paint the clipped
        // gradient as a plain rect behind our raster.
        el.style.background           = '';
        el.style.webkitBackgroundClip = '';
        el.style.backgroundClip       = '';
        el.style.webkitTextFillColor  = '';
        el.replaceChildren(img);
      } catch (err) {
        console.warn('[AgendaSvgExport] Could not rasterize gradient text:', err);
      }
    }));
  }

  // ── Border-vs-overflow:hidden clipping workaround ────────────────────────
  // See this file's header comment for the full root-cause explanation.

  private static _isTransparentColor(color: string): boolean {
    if (!color || color === 'none' || color === 'transparent') return true;
    if (color.startsWith('rgba')) {
      const nums = color.match(/[\d.]+/g);
      if (nums && nums[3] === '0') return true;
    }
    return false;
  }

  /** Mirrors html-to-svg's own (dist source) `parseBorders()` exactly, so
   *  a border we decide to redraw ourselves matches one it would have. */
  private static _parseVisibleBorders(cs: CSSStyleDeclaration): Partial<Record<'top' | 'right' | 'bottom' | 'left', { color: string; width: number; style: string }>> | null {
    let borders: Partial<Record<'top' | 'right' | 'bottom' | 'left', { color: string; width: number; style: string }>> | null = null;
    (['top', 'right', 'bottom', 'left'] as const).forEach(dir => {
      const color = cs.getPropertyValue(`border-${dir}-color`);
      const width = parseInt(cs.getPropertyValue(`border-${dir}-width`));
      const style = cs.getPropertyValue(`border-${dir}-style`);
      if (this._isTransparentColor(color)) return;
      if (!width || Number.isNaN(width)) return;
      if (style === 'none' || style === 'hidden') return;
      if (!borders) borders = {};
      borders[dir] = { color, width, style };
    });
    return borders;
  }

  /**
   * Scans `pageEl` for every element that has BOTH a visible CSS border AND
   * computed `overflow: hidden` on itself -- exactly the combination that
   * makes html-to-svg's own border rendering get clipped away (see this
   * file's header comment). For each match: records a geometry descriptor
   * (position/size relative to `pageEl`, per-side color/width/style, and
   * border-radius) for _drawBorderOverlays() to redraw AFTER rendering, then
   * neutralizes the element's OWN border by setting each affected side's
   * `border-*-color` to `transparent` -- deliberately NOT `border: none`,
   * which (under the `box-sizing: border-box` every one of these tools
   * uses) would shrink the border's own box-model footprint and shift
   * inner content inward by border-width on every affected side. Leaving
   * width/style untouched and only blanking the color keeps html-to-svg's
   * own `isTransparent()` check skipping it (so it draws nothing, avoiding
   * a doubled-up border) with zero layout side effects.
   *
   * Skips any element whose `getBoundingClientRect()` doesn't match its own
   * `offsetWidth`/`offsetHeight` -- a cheap, if imperfect, signal that a
   * rotation/transform is active somewhere in its ancestor chain. The
   * overlay geometry below is drawn in flat, unrotated root coordinates, so
   * a genuinely transformed element would land in the wrong place; better
   * to leave the native (still imperfect, but no worse than before)
   * clipped rendering for that rare case than draw a confidently-wrong
   * border.
   */
  private static _extractClippedBorders(pageEl: HTMLElement): Array<{
    x: number; y: number; width: number; height: number; radius: number;
    borders: Partial<Record<'top' | 'right' | 'bottom' | 'left', { color: string; width: number; style: string }>>;
  }> {
    const rootRect = pageEl.getBoundingClientRect();
    const descriptors: Array<{
      x: number; y: number; width: number; height: number; radius: number;
      borders: Partial<Record<'top' | 'right' | 'bottom' | 'left', { color: string; width: number; style: string }>>;
    }> = [];

    const candidates = [pageEl, ...Array.from(pageEl.querySelectorAll<HTMLElement>('*'))];
    for (const el of candidates) {
      const cs = window.getComputedStyle(el);
      if (cs.getPropertyValue('overflow') !== 'hidden') continue;
      const borders = this._parseVisibleBorders(cs);
      if (!borders) continue;

      const rect = el.getBoundingClientRect();
      if (Math.abs(rect.width - el.offsetWidth) > 1 || Math.abs(rect.height - el.offsetHeight) > 1) continue;

      const radius = parseInt(cs.getPropertyValue('border-radius')) || 0;
      descriptors.push({
        x: rect.left - rootRect.left,
        y: rect.top  - rootRect.top,
        width:  rect.width,
        height: rect.height,
        radius,
        borders,
      });

      (['top', 'right', 'bottom', 'left'] as const).forEach(dir => {
        if (borders[dir]) el.style.setProperty(`border-${dir}-color`, 'transparent');
      });
    }

    return descriptors;
  }

  /**
   * Draws the geometry _extractClippedBorders() recorded directly onto the
   * finished SVG's root -- OUTSIDE every clip-path context html-to-svg
   * created while rendering, so none of it can clip these strokes away.
   * The formulas are a straight port of html-to-svg's own DivRenderer
   * border-drawing code (dist source): a stroked rounded-rect (inset by
   * half the representative side's width, matching how the library only
   * supports ONE uniform border when border-radius is set) when
   * `radius > 0`, otherwise one `<line>` per visible side with the same
   * dotted/dashed `stroke-dasharray` patterns it uses.
   */
  private static _drawBorderOverlays(
    svg: SVGSVGElement,
    descriptors: Array<{
      x: number; y: number; width: number; height: number; radius: number;
      borders: Partial<Record<'top' | 'right' | 'bottom' | 'left', { color: string; width: number; style: string }>>;
    }>,
  ): void {
    if (!descriptors.length) return;
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'ct-svg-border-overlay');

    for (const d of descriptors) {
      if (d.radius > 0) {
        const rep = d.borders.top ?? d.borders.right ?? d.borders.bottom ?? d.borders.left;
        if (!rep) continue;
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', String(d.x + rep.width / 2));
        rect.setAttribute('y', String(d.y + rep.width / 2));
        rect.setAttribute('width',  String(Math.max(0, d.width  - rep.width)));
        rect.setAttribute('height', String(Math.max(0, d.height - rep.width)));
        rect.setAttribute('rx', String(Math.max(0, d.radius - rep.width / 2)));
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', rep.color);
        rect.setAttribute('stroke-width', String(rep.width));
        g.appendChild(rect);
        continue;
      }

      (['top', 'right', 'bottom', 'left'] as const).forEach(dir => {
        const b = d.borders[dir];
        if (!b) return;
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
        switch (dir) {
          case 'top':    x1 = d.x; x2 = d.x + d.width; y1 = y2 = d.y + b.width / 2; break;
          case 'bottom': x1 = d.x; x2 = d.x + d.width; y1 = y2 = d.y + d.height - b.width / 2; break;
          case 'left':   y1 = d.y; y2 = d.y + d.height; x1 = x2 = d.x + b.width / 2; break;
          case 'right':  y1 = d.y; y2 = d.y + d.height; x1 = x2 = d.x + d.width - b.width / 2; break;
        }
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        line.setAttribute('stroke', b.color);
        line.setAttribute('stroke-width', String(b.width));
        if (b.style === 'dotted') {
          line.setAttribute('stroke-dasharray', `0 ${b.width * 2}`);
          line.setAttribute('stroke-dashoffset', '1');
          line.setAttribute('stroke-linejoin', 'round');
          line.setAttribute('stroke-linecap', 'round');
        } else if (b.style === 'dashed') {
          line.setAttribute('stroke-dasharray', `${b.width * 2} 4`);
        }
        g.appendChild(line);
      });
    }

    if (g.children.length) svg.appendChild(g);
  }

  /**
   * Loads `url` into a temporary `<img>` element (with `crossOrigin =
   * 'anonymous'` for CORS-enabled CDN images), then draws it onto a canvas
   * and returns `canvas.toDataURL('image/png')`.
   *
   * Throws if the image fails to load, the URL times out (8 s), or the
   * canvas is tainted (cross-origin image without CORS headers) -- the
   * caller should catch and fall back to the original URL.
   */
  private static _toDataUrl(url: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => {
        img.src = '';
        reject(new Error('timeout'));
      }, 8000);
      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width  = img.naturalWidth  || 64;
          canvas.height = img.naturalHeight || 64;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('canvas ctx unavailable')); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          reject(e); // canvas taint or other drawing error
        }
      };
      img.onerror = () => { clearTimeout(timer); reject(new Error('load error')); };
      img.src = url;
    });
  }

  private static _download(svgMarkup: string, filename: string): void {
    const full = svgMarkup.startsWith('<?xml')
      ? svgMarkup
      : `<?xml version="1.0" encoding="UTF-8"?>\n${svgMarkup}`;
    const blob = new Blob([full], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
  }
}
