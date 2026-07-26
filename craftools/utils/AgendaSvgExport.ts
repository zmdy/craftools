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
 * images. It does NOT (yet) support box-shadow, border STYLES (only
 * background-color/radius), text-decoration, or CSS `transform: skew()`.
 * Per the user's own confirmation this project doesn't use skew or
 * box-shadow, so those two gaps shouldn't matter here -- everything else
 * (gradients, borders-as-color, rotation, photos, custom fonts) is
 * genuinely untested until this button is actually used.
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
   * Entry point -- called from AgendaSvgExportTool.ts. Renders up to
   * `opts.maxOutputPages` resolved output pages (default 1: this is an
   * experimental "see how it looks" export, not meant to churn through a
   * multi-hundred-page agenda). By default (`opts.merge !== false`) all
   * rendered pages are combined into a SINGLE downloaded .svg, stacked
   * vertically -- SVG has no native concept of "pages" the way PDF does,
   * so this is the standard convention for representing several pages in
   * one file (one tall canvas, one page-height's worth of content per
   * section). Pass `merge: false` to get the original one-file-per-page
   * behavior instead.
   */
  static async print(editor: HTMLElement, opts: { maxOutputPages?: number; merge?: boolean } = {}): Promise<void> {
    const limit = opts.maxOutputPages ?? 1;
    const merge = opts.merge !== false;

    const pages = await AgendaExport.buildFlattenedOutputPages(editor, { maxOutputPages: limit });
    if (!pages || !pages.length) {
      Notify.toast(t('noPagesFound'), 'error');
      return;
    }

    Notify.toast(t('generating'), 'info', 4000);

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
      renderer = new HtmlToSvg({ fonts: CORE_FONTS });
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

        try {
          const svg = await renderer.render(
            el,
            { rasterizeNestedSVG: true },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            async (_from: any, to: any) => to,
          );
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
      }

      if (merge && rendered.length) {
        this._download(this._mergePages(rendered), 'craftools-agenda.svg');
      }

      if (okCount > 0)  Notify.toast(t('done').replace('{n}', String(okCount)), 'success', 5000);
      if (errCount > 0) Notify.toast(t('someFailed').replace('{n}', String(errCount)), 'error', 8000);

    } catch (err) {
      console.error('[AgendaSvgExport] Export failed:', err);
      Notify.toast(t('exportError'), 'error', 6000);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (renderer as any)?.destroy?.();
      stage.remove();
      styleTag.remove();
    }
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
