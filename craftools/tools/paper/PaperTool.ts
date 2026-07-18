/**
 * PaperTool.ts — Paper/lined-page element.
 * State in _craftoolsMeta (complex nested object with margins, sidebar, watermark, logo, pageSettings).
 * Calls updatePaperSVG() directly after each property change.
 */
import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import { PaperPatterns } from './PaperPatterns';
import type { PropertySchema } from '../../types/PropertySchema';

type PaperMeta = {
  paperType: string;
  paperSize: string;
  theme: string;
  lineColor: string;
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
};

const getMeta = (el: HTMLElement): Partial<PaperMeta> =>
  (el as HTMLElement & { _craftoolsMeta?: Partial<PaperMeta> })._craftoolsMeta ?? {};

const PAPER_TYPES = [
  { value: 'lined',                   label: 'Lined' },
  { value: 'vertical_lined',          label: 'Vertical lined' },
  { value: 'grid',                    label: 'Grid' },
  { value: 'dot',                     label: 'Dot' },
  { value: 'pink_millimeter_grid',    label: 'Millimeter (pink)' },
  { value: 'grid_lined_split',        label: 'Grid + lined split' },
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

const PAPER_SIZES = [
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

const THEMES = [
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
    };
  }

  /**
   * Builds a fresh craftools-element (data-craftool="papeis") sized to
   * the active page, with its pattern SVG inside. Recovered from the
   * pre-migration PaperTool.js (deleted by the "Purge legacy JS" commit
   * without this logic being ported) -- the previous file had no
   * createElement() at all, throwing "createElement is not a function"
   * for every paper/background element creation.
   */
  public static createElement(_type: string, editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsMeta?: PaperMeta };
    el.setAttribute('data-craftool', 'papeis');
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
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};

    if (!('paperType'   in existing)) patch.paperType   = meta.paperType   ?? 'lined';
    if (!('paperSize'   in existing)) patch.paperSize   = meta.paperSize   ?? 'a4';
    if (!('theme'       in existing)) patch.theme       = meta.theme       ?? 'default';
    if (!('lineColor'   in existing)) patch.lineColor   = meta.lineColor   ?? '#a1a1aa';
    if (!('lineStyle'   in existing)) patch.lineStyle   = meta.lineStyle   ?? 'solid';
    if (!('lineSpacing' in existing)) patch.lineSpacing = meta.lineSpacing ?? 8;
    if (!('lineWidth'   in existing)) patch.lineWidth   = meta.lineWidth   ?? 0.5;
    if (!('bgColor'     in existing)) patch.bgColor     = meta.bgColor     ?? '#ffffff';
    if (!('bgPattern'   in existing)) patch.bgPattern   = meta.bgPattern   ?? 'none';

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
        icon: 'description',
        defaultOpen: true,
        fields: [
          { type: 'select', key: 'paperType', label: 'Type',  options: PAPER_TYPES },
          { type: 'select', key: 'paperSize', label: 'Size',  options: PAPER_SIZES },
          { type: 'select', key: 'theme',     label: 'Theme', options: THEMES },
        ],
      },
      {
        section: 'Lines',
        icon: 'table_rows',
        fields: [
          { type: 'color',  key: 'lineColor',   label: 'Line color' },
          { type: 'select', key: 'lineStyle',   label: 'Line style',
            options: [{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }] },
          { type: 'slider', key: 'lineSpacing', label: 'Spacing',   min: 4, max: 20, step: 0.5 },
          { type: 'slider', key: 'lineWidth',   label: 'Width',     min: 0.1, max: 5, step: 0.1 },
        ],
      },
      {
        section: 'Margins (mm)',
        icon: 'straighten',
        fields: [
          { type: 'number', key: 'marginTop',    label: 'Top',    min: 0, max: 50, step: 1 },
          { type: 'number', key: 'marginRight',  label: 'Right',  min: 0, max: 50, step: 1 },
          { type: 'number', key: 'marginBottom', label: 'Bottom', min: 0, max: 50, step: 1 },
          { type: 'number', key: 'marginLeft',   label: 'Left',   min: 0, max: 50, step: 1 },
        ],
      },
      {
        section: 'Background',
        icon: 'gradient',
        fields: [
          { type: 'color',  key: 'bgColor',   label: 'Color' },
          { type: 'select', key: 'bgPattern', label: 'Pattern',
            options: [
              { value: 'none',       label: 'None' },
              { value: 'grid',       label: 'Grid' },
              { value: 'dots',       label: 'Dots' },
              { value: 'lines',      label: 'Lines' },
              { value: 'crosshatch', label: 'Crosshatch' },
              { value: 'graph',      label: 'Graph' },
            ],
          },
        ],
      },
      {
        section: 'Extras',
        icon: 'more_horiz',
        fields: [
          { type: 'toggle', key: 'sidebarEnabled',   label: 'Side bar' },
          { type: 'toggle', key: 'watermarkEnabled', label: 'Watermark' },
          { type: 'toggle', key: 'logoEnabled',      label: 'Logo' },
          { type: 'toggle', key: 'showPageNumber',   label: 'Page numbers' },
        ],
      },
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
        case 'lineStyle':         meta.lineStyle        = String(value); break;
        case 'lineSpacing':       meta.lineSpacing      = Number(value); break;
        case 'lineWidth':         meta.lineWidth        = Number(value); break;
        case 'bgColor':           meta.bgColor          = String(value); break;
        case 'bgPattern':         meta.bgPattern        = String(value); break;
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

PaperTool.registeredKeys = ['papeis'];
// label/icon match the desktop sidebar entry exactly (index.html
// #pwa-sidebar-papeis) -- 'editor.paper' ("Artes impressas") and
// 'description' were a different, unrelated i18n key/icon that made this
// tool's title and the mobile footer show the wrong text/glyph.
ToolRegistry.register({ key: 'papeis', label: 'editor.papers2', icon: 'layers', tool: PaperTool, draggable: true, showInFooterNav: false, category: 'elements' });
