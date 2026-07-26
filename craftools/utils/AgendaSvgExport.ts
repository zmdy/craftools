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
   * multi-hundred-page agenda) to individually downloaded .svg files.
   */
  static async print(editor: HTMLElement, opts: { maxOutputPages?: number } = {}): Promise<void> {
    const limit = opts.maxOutputPages ?? 1;

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

        stage.innerHTML = '';
        stage.appendChild(el);

        try {
          const svg = await renderer.render(
            el,
            { rasterizeNestedSVG: true },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            async (_from: any, to: any) => to,
          );
          this._download(svg.outerHTML, `craftools-agenda-p${i}.svg`);
          okCount++;
        } catch (err) {
          console.error('[AgendaSvgExport] Failed to render page', i, err);
          errCount++;
        }
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
