/**
 * PaperTool.ts — Paper/lined-page element.
 * State in _craftoolsMeta (complex nested object with margins, sidebar, watermark, logo, pageSettings).
 * Calls updatePaperSVG() directly after each property change.
 */
import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection, flipAlternateSection } from '../../utils/CommonSchema';
import { PaperPatterns } from './PaperPatterns';
import type { PropertySchema } from '../../types/PropertySchema';

export type PaperMeta = {
  paperType: string;
  paperSize: string;
  theme: string;
  lineColor: string;
  /**
   * Only meaningful when `lineColor` is a gradient ColorPickerValue.
   * 'per-line' (default): the same gradient repeats identically on every
   * line. 'per-page': each line gets a single solid color, interpolated
   * through the gradient's stops from the first line (first stop) to the
   * last line (last stop). See PaperPatterns.ts's generateSVG()/
   * _sampleGradientColor().
   */
  lineGradientMode: string;
  lineStyle: string;
  lineSpacing: number;
  lineWidth: number;
  margins: { top: number; right: number; bottom: number; left: number };
  sidebar: { enabled: boolean };
  bgColor: string;
  bgPattern: string;
  watermark: { enabled: boolean };
  logo: { enabled: boolean };
  pageSettings: { showPageNumber: boolean };
  /** Checkbox glyph drawn at the start of each line -- only read when paperType === 'todo_list'. */
  checkboxShape: string;
  /**
   * 'left' (default) or 'right' -- horizontally mirrors the drawn pattern
   * (writing pattern + sidebar, NOT logo/watermark/page number -- see
   * PaperPatterns.ts's generateContent() for why those three are excluded)
   * within the page. Independent of, and composes with, CommonSchema.ts's
   * `flipAlternate` toggle (mirrors the WHOLE element on alternate pages) --
   * see that field's own doc comment for how the two combine. Useful for
   * asymmetric patterns like todo_list, where this is the only way to move
   * the checkboxes to the other side.
   */
  orientation: 'left' | 'right';
};

const getMeta = (el: HTMLElement): Partial<PaperMeta> =>
  (el as HTMLElement & { _craftoolsMeta?: Partial<PaperMeta> })._craftoolsMeta ?? {};

// Exported for PageTool.ts's "Papel personalizado" page-settings tab (see
// its own header comment: Paper is no longer a separate draggable sidebar
// tool -- all of its controls now live inside Page Settings instead,
// reusing this exact option list/meta shape/rendering rather than
// duplicating it).
export const PAPER_TYPES = [
  { value: 'lined',                   label: 'Lined' },
  { value: 'vertical_lined',          label: 'Vertical lined' },
  { value: 'grid',                    label: 'Grid' },
  { value: 'dot',                     label: 'Dot' },
  { value: 'pink_millimeter_grid',    label: 'Millimeter (pink)' },
  { value: 'grid_lined_split',        label: 'Grid + lined split' },
  { value: 'todo_list',               label: 'To-do list' },
  { value: 'blank',                   label: 'Blank' },
  { value: 'music',                   label: 'Music staff' },
  { value: 'guitar_tab',              label: 'Guitar tab' },
  { value: 'ukulele_staff_tab',       label: 'Ukulele staff tab' },
  { value: 'guitar_chord_treble_staff', label: 'Guitar chord/treble' },
  { value: 'calligraphy',             label: 'Calligraphy' },
  { value: 'cornell',                 label: 'Cornell' },
  { value: 'isometric',               label: 'Isometric' },
  { value: 'perspective_sketch',      label: 'Perspective sketch' },
  { value: 'hexagonal',               label: 'Hexagonal' },
  { value: 'seyes',                   label: 'Séyes' },
  { value: 'storyboard',              label: 'Storyboard' },
];

export const PAPER_SIZES = [
  { value: 'a4',        label: 'A4 (210 × 297 mm)' },
  { value: 'a5',        label: 'A5 (148 × 210 mm)' },
  { value: 'a3',        label: 'A3 (297 × 420 mm)' },
  { value: 'b4',        label: 'B4 (250 × 353 mm)' },
  { value: 'b5',        label: 'B5 (176 × 250 mm)' },
  { value: 'letter',    label: 'Letter (216 × 279 mm)' },
  { value: 'legal',     label: 'Legal (216 × 356 mm)' },
  { value: 'tabloid',   label: 'Tabloid (279 × 432 mm)' },
  { value: 'executive', label: 'Executive (184 × 267 mm)' },
  { value: 'custom',    label: 'Custom' },
];

export const THEMES = [
  { value: 'default',    label: 'Default' },
  { value: 'night',      label: 'Night' },
  { value: 'sepia',      label: 'Sepia' },
  { value: 'vintage',    label: 'Vintage' },
  { value: 'pastel',     label: 'Pastel' },
  { value: 'classic',    label: 'Classic' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'ocean',      label: 'Ocean' },
  { value: 'forest',     label: 'Forest' },
  { value: 'sunset',     label: 'Sunset' },
  { value: 'tech',       label: 'Tech' },
  { value: 'elegant',    label: 'Elegant' },
  { value: 'creative',   label: 'Creative' },
];

// Re-exported for PaperPatterns.ts, which imports PaperThemes from this
// module (import { PaperThemes } from "./PaperTool.js") to resolve each
// theme's bg/line colors when generating the pattern SVG. Recovered
// verbatim from the pre-migration PaperTool.js -- dropping these when this
// file was ported would break PaperPatterns.ts's build (missing export).
export const PaperThemes: Record<string, { bg: string; line: string }> = {
  default: { bg: '#ffffff', line: '#a1a1aa' },
  night: { bg: '#1e1e2f', line: '#4a4a6a' },
  sepia: { bg: '#faf0d8', line: '#cca785' },
  vintage: { bg: '#fbf6e3', line: '#cca633' },
  pastel: { bg: '#faf5ff', line: '#d8b4fe' },
  classic: { bg: '#fefcf0', line: '#d2c7b5' },
  minimalist: { bg: '#fafafa', line: '#eaeaea' },
  ocean: { bg: '#f0f9ff', line: '#bae6fd' },
  forest: { bg: '#f0fdf4', line: '#bbf7d0' },
  sunset: { bg: '#fff7ed', line: '#fed7aa' },
  tech: { bg: '#09090b', line: '#14b8a6' },
  elegant: { bg: '#fafaf9', line: '#e7e5e4' },
  creative: { bg: '#fff7fe', line: '#f0abfc' },
};

export const PaperPresets: Record<string, { name: string; w: number; h: number; unit: string }> = {
  a4: { name: 'A4 (210 × 297 mm)', w: 210, h: 297, unit: 'mm' },
  a5: { name: 'A5 (148 × 210 mm)', w: 148, h: 210, unit: 'mm' },
  a3: { name: 'A3 (297 × 420 mm)', w: 297, h: 420, unit: 'mm' },
  b4: { name: 'B4 (250 × 353 mm)', w: 250, h: 353, unit: 'mm' },
  b5: { name: 'B5 (176 × 250 mm)', w: 176, h: 250, unit: 'mm' },
  letter: { name: 'Letter (216 × 279 mm)', w: 216, h: 279, unit: 'mm' },
  legal: { name: 'Legal (216 × 356 mm)', w: 216, h: 356, unit: 'mm' },
  tabloid: { name: 'Tabloid (279 × 432 mm)', w: 279, h: 432, unit: 'mm' },
  executive: { name: 'Executive (184 × 267 mm)', w: 184, h: 267, unit: 'mm' },
  custom: { name: 'Custom Size', w: 210, h: 297, unit: 'mm' },
};

export class PaperTool extends BaseTool {

  static getCtxOptions(): Array<{ icon: string; label: string; command: (element: HTMLElement) => void }> {
    return [];
  }

  /**
   * Default meta for a freshly-created paper element. Recovered from the
   * pre-migration PaperTool.js (deleted by the "Purge legacy JS" commit).
   */
  public static getDefaultMeta(): PaperMeta {
    return {
      paperType: 'lined',
      paperSize: 'a4',
      theme: 'default',
      lineColor: '#a1a1aa',
      lineGradientMode: 'per-line',
      lineStyle: 'solid',
      lineSpacing: 8,
      lineWidth: 0.5,
      margins: { top: 25, right: 20, bottom: 25, left: 20 },
      sidebar: { enabled: false },
      bgColor: '#ffffff',
      bgPattern: 'none',
      watermark: { enabled: false },
      logo: { enabled: false },
      pageSettings: { showPageNumber: false },
      checkboxShape: 'square',
      orientation: 'left',
    };
  }

  /**
   * Builds a fresh craftools-element (data-craftool="paper") sized to
   * the active page, with its pattern SVG inside. Recovered from the
   * pre-migration PaperTool.js (deleted by the "Purge legacy JS" commit
   * without this logic being ported) -- the previous file had no
   * createElement() at all, throwing "createElement is not a function"
   * for every paper/background element creation.
   */
  public static createElement(_type: string, editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsMeta?: PaperMeta };
    el.setAttribute('data-craftool', 'paper');
    // The background paper is locked by default -- unlike every other tool
    // (which start unlocked) -- so it isn't accidentally moved/resized on
    // top of the page. See CommonSchema.ts's lock toggle and Element.ts's
    // _syncLockUI() for the generic locking mechanism.
    el.setAttribute('data-locked', 'true');

    const meta = PaperTool.getDefaultMeta();
    el._craftoolsMeta = meta;

    // If there's an active page in the editor, size the paper to match it.
    const editorEl = editor as (HTMLElement & { activePage?: Element | null }) | undefined;
    const activePage = (editorEl?.activePage ?? editorEl?.querySelector?.('.craftools-page')) as HTMLElement | null | undefined;
    let width = 210;
    let height = 297;
    let unit = 'mm';

    if (activePage) {
      const pageW = activePage.style.width || '210mm';
      const pageH = activePage.style.minHeight || '297mm';
      unit = pageW.replace(/[0-9.-]/g, '') || 'mm';
      width = parseFloat(pageW) || 210;
      height = parseFloat(pageH) || 297;
    }

    el.setAttribute('x', `0${unit}`);
    el.setAttribute('y', `0${unit}`);
    el.setAttribute('w', `${width}${unit}`);
    el.setAttribute('h', `${height}${unit}`);

    // The paper sits behind everything (low z-index)
    el.style.zIndex = '1';
    el.style.pointerEvents = 'none';

    const innerDiv = document.createElement('div');
    innerDiv.className = 'paper-content-area';
    innerDiv.style.cssText = 'width:100%; height:100%; position:relative; overflow:hidden;';

    innerDiv.innerHTML = (PaperPatterns as unknown as { generateSVG: (meta: PaperMeta, w: number, h: number) => string }).generateSVG(meta, width, height);
    el.appendChild(innerDiv);

    return el;
  }

  /** Rebuilds the pattern SVG from the element's current _craftoolsMeta and size. */
  public static updatePaperSVG(element: HTMLElement & { _craftoolsMeta?: PaperMeta; pw?: number; ph?: number }): void {
    const meta = element._craftoolsMeta;
    if (!meta) return;

    const container = element.querySelector<HTMLElement>('.paper-content-area') ?? (element.firstElementChild as HTMLElement | null);
    if (container) {
      const w = element.pw || parseFloat(element.getAttribute('w') || '') || 210;
      const h = element.ph || parseFloat(element.getAttribute('h') || '') || 297;
      container.innerHTML = (PaperPatterns as unknown as { generateSVG: (meta: PaperMeta, w: number, h: number) => string }).generateSVG(meta, w, h);
    }

    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }

  protected static _syncFromDOM(element: HTMLElement): void {
    element.style.pointerEvents = 'none';
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};

    if (!('paperType'   in existing)) patch.paperType   = meta.paperType   ?? 'lined';
    if (!('paperSize'   in existing)) patch.paperSize   = meta.paperSize   ?? 'a4';
    if (!('theme'       in existing)) patch.theme       = meta.theme       ?? 'default';
    if (!('lineColor'   in existing)) patch.lineColor   = meta.lineColor   ?? '#a1a1aa';
    if (!('lineGradientMode' in existing)) patch.lineGradientMode = meta.lineGradientMode ?? 'per-line';
    if (!('lineStyle'   in existing)) patch.lineStyle   = meta.lineStyle   ?? 'solid';
    if (!('lineSpacing' in existing)) patch.lineSpacing = meta.lineSpacing ?? 8;
    if (!('lineWidth'   in existing)) patch.lineWidth   = meta.lineWidth   ?? 0.5;
    if (!('bgColor'     in existing)) patch.bgColor     = meta.bgColor     ?? '#ffffff';
    if (!('bgPattern'   in existing)) patch.bgPattern   = meta.bgPattern   ?? 'none';
    if (!('checkboxShape' in existing)) patch.checkboxShape = meta.checkboxShape ?? 'square';
    if (!('orientation'   in existing)) patch.orientation   = meta.orientation   ?? 'left';

    const m = meta.margins ?? { top: 25, right: 20, bottom: 25, left: 20 };
    if (!('marginTop'    in existing)) patch.marginTop    = m.top;
    if (!('marginRight'  in existing)) patch.marginRight  = m.right;
    if (!('marginBottom' in existing)) patch.marginBottom = m.bottom;
    if (!('marginLeft'   in existing)) patch.marginLeft   = m.left;

    if (!('sidebarEnabled'    in existing)) patch.sidebarEnabled    = meta.sidebar?.enabled   ?? false;
    if (!('watermarkEnabled'  in existing)) patch.watermarkEnabled  = meta.watermark?.enabled ?? false;
    if (!('logoEnabled'       in existing)) patch.logoEnabled       = meta.logo?.enabled      ?? false;
    if (!('showPageNumber'    in existing)) patch.showPageNumber    = meta.pageSettings?.showPageNumber ?? false;

    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Paper',
        i18nKey: 'paperTool.sectionPaper',
        icon: 'description',
        defaultOpen: true,
        fields: [
          { type: 'select', key: 'paperType', label: 'Type',  i18nKey: 'paperTool.paperType',  options: PAPER_TYPES },
          { type: 'select', key: 'paperSize', label: 'Size',  i18nKey: 'paperTool.paperSize',  options: PAPER_SIZES },
          { type: 'select', key: 'theme',     label: 'Theme', i18nKey: 'paperTool.theme',      options: THEMES },
        ],
      },
      {
        section: 'Lines',
        i18nKey: 'paperTool.sectionLines',
        icon: 'table_rows',
        fields: [
          { type: 'color-picker', key: 'lineColor', label: 'Line color', i18nKey: 'paperTool.lineColor' },
          { type: 'select', key: 'lineGradientMode', label: 'Gradient mode', i18nKey: 'paperTool.lineGradientMode',
            options: [
              { value: 'per-line', label: 'Same gradient on every line', i18nKey: 'paperTool.lineGradientPerLine' },
              { value: 'per-page', label: 'Gradient across the page',    i18nKey: 'paperTool.lineGradientPerPage' },
            ] },
          { type: 'select', key: 'lineStyle', label: 'Line style', i18nKey: 'paperTool.lineStyle',
            options: [
              { value: 'solid',  label: 'Solid',  i18nKey: 'paperTool.solid' },
              { value: 'dashed', label: 'Dashed', i18nKey: 'paperTool.dashed' },
              { value: 'dotted', label: 'Dotted', i18nKey: 'paperTool.dotted' },
            ] },
          { type: 'slider', key: 'lineSpacing', label: 'Spacing', i18nKey: 'paperTool.lineSpacing', min: 4,   max: 20, step: 0.5 },
          { type: 'slider', key: 'lineWidth',   label: 'Width',   i18nKey: 'paperTool.lineWidth',   min: 0.1, max: 5,  step: 0.1 },
          {
            type: 'select', key: 'checkboxShape', label: 'Checkbox shape', i18nKey: 'paperTool.checkboxShape',
            options: [
              { value: 'square', label: 'Square', i18nKey: 'paperTool.checkboxSquare' },
              { value: 'circle', label: 'Circle',  i18nKey: 'paperTool.checkboxCircle' },
              { value: 'star',   label: 'Star',    i18nKey: 'paperTool.checkboxStar' },
              { value: 'heart',  label: 'Heart',   i18nKey: 'paperTool.checkboxHeart' },
            ],
            hidden: (el) => PropertyRenderer._readState(el).paperType !== 'todo_list',
          },
        ],
      },
      {
        section: 'Margins (mm)',
        i18nKey: 'paperTool.sectionMargins',
        icon: 'straighten',
        fields: [
          { type: 'number', key: 'marginTop',    label: 'Top',    i18nKey: 'paperTool.topMargin',    min: 0, max: 50, step: 1 },
          { type: 'number', key: 'marginRight',  label: 'Right',  i18nKey: 'paperTool.rightMargin',  min: 0, max: 50, step: 1 },
          { type: 'number', key: 'marginBottom', label: 'Bottom', i18nKey: 'paperTool.bottomMargin', min: 0, max: 50, step: 1 },
          { type: 'number', key: 'marginLeft',   label: 'Left',   i18nKey: 'paperTool.leftMargin',   min: 0, max: 50, step: 1 },
        ],
      },
      {
        section: 'Background',
        i18nKey: 'paperTool.sectionBackground',
        icon: 'gradient',
        fields: [
          { type: 'color-picker', key: 'bgColor',   label: 'Color',   i18nKey: 'paperTool.bgColor' },
          { type: 'select',       key: 'bgPattern',  label: 'Pattern', i18nKey: 'paperTool.bgPattern',
            options: [
              { value: 'none',       label: 'None',       i18nKey: 'paperTool.none' },
              { value: 'grid',       label: 'Grid',       i18nKey: 'paperTool.grid' },
              { value: 'dots',       label: 'Dots',       i18nKey: 'paperTool.dots' },
              { value: 'lines',      label: 'Lines',      i18nKey: 'paperTool.lines' },
              { value: 'crosshatch', label: 'Crosshatch', i18nKey: 'paperTool.crosshatch' },
              { value: 'graph',      label: 'Graph',      i18nKey: 'paperTool.graph' },
            ],
          },
        ],
      },
      {
        section: 'Extras',
        i18nKey: 'paperTool.sectionExtras',
        icon: 'more_horiz',
        fields: [
          { type: 'toggle', key: 'sidebarEnabled',   label: 'Side bar',    i18nKey: 'paperTool.enableSidebar' },
          { type: 'toggle', key: 'watermarkEnabled', label: 'Watermark',   i18nKey: 'paperTool.enableWatermark' },
          { type: 'toggle', key: 'logoEnabled',      label: 'Logo',        i18nKey: 'paperTool.enableLogo' },
          { type: 'toggle', key: 'showPageNumber',   label: 'Page numbers', i18nKey: 'paperTool.showPageNumber' },
          {
            type: 'select', key: 'orientation', label: 'Orientation', i18nKey: 'paperTool.orientation',
            options: [
              { value: 'left',  label: 'Left',  i18nKey: 'paperTool.orientationLeft' },
              { value: 'right', label: 'Right', i18nKey: 'paperTool.orientationRight' },
            ],
          },
        ],
      },
      flipAlternateSection(),
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const e = element as HTMLElement & { _craftoolsMeta?: PaperMeta };
    const meta = e._craftoolsMeta;
    if (key === 'zIndex') { element.style.zIndex = String(value); return; }
    if (meta) {
      switch (key) {
        case 'paperType':         meta.paperType        = String(value); break;
        case 'paperSize':         meta.paperSize        = String(value); break;
        case 'theme':             meta.theme            = String(value); break;
        case 'lineColor':         meta.lineColor        = String(value); break;
        case 'lineGradientMode':  meta.lineGradientMode = String(value); break;
        case 'lineStyle':         meta.lineStyle        = String(value); break;
        case 'lineSpacing':       meta.lineSpacing      = Number(value); break;
        case 'lineWidth':         meta.lineWidth        = Number(value); break;
        case 'bgColor':           meta.bgColor          = String(value); break;
        case 'bgPattern':         meta.bgPattern        = String(value); break;
        case 'checkboxShape':     meta.checkboxShape    = String(value); break;
        case 'orientation':       meta.orientation      = value === 'right' ? 'right' : 'left'; break;
        case 'marginTop':         meta.margins.top      = Number(value); break;
        case 'marginRight':       meta.margins.right    = Number(value); break;
        case 'marginBottom':      meta.margins.bottom   = Number(value); break;
        case 'marginLeft':        meta.margins.left     = Number(value); break;
        case 'sidebarEnabled':    meta.sidebar.enabled  = Boolean(value); break;
        case 'watermarkEnabled':  meta.watermark.enabled = Boolean(value); break;
        case 'logoEnabled':       meta.logo.enabled     = Boolean(value); break;
        case 'showPageNumber':    meta.pageSettings.showPageNumber = Boolean(value); break;
      }
      // Calls updatePaperSVG() directly (previously dispatched an
      // unlistened 'craftools-paper-regenerate' custom event, so panel
      // edits never actually rebuilt the rendered pattern).
      PaperTool.updatePaperSVG(e);
    }
  }
}

PaperTool.registeredKeys = ['paper'];
// label/icon previously matched a desktop sidebar entry (index.html
// #pwa-sidebar-papeis, since removed) -- 'editor.paper' ("Artes impressas")
// and 'description' were a different, unrelated i18n key/icon that made
// this tool's title and the mobile footer show the wrong text/glyph.
//
// draggable: false -- Paper used to be a standalone element the user
// dragged onto the canvas like Shape/Icon/Emoji, which also meant clicking
// a page that already had one hijacked the click to select the raw paper
// element instead of showing Page Settings (PageTool.ts's own click
// handler used to special-case this). It's now created/edited entirely
// through Page Settings' own "Papel personalizado" tab (see PageTool.ts),
// so it's no longer something to drag from the sidebar -- this registry
// entry (and the class below) still exist purely as the implementation
// PageTool.ts calls into (createElement/updatePaperSVG/getDefaultMeta),
// and so ToolRegistry.get('paper') still resolves correctly for any
// paper element already sitting in a page (from an existing session) that
// needs its z-index/ctx handling.
ToolRegistry.register({ key: 'paper', label: 'editor.papers2', icon: 'layers', tool: PaperTool, draggable: false, showInFooterNav: false, category: 'elements' });
