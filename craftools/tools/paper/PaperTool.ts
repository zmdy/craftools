/**
 * PaperTool.ts — Paper/lined-page element.
 * State in _craftoolsMeta (complex nested object with margins, sidebar, watermark, logo, pageSettings).
 * Dispatches 'craftools-paper-regenerate' after each property change.
 */
import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
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
  pageSettings: { pageCount: number; showPageNumber: boolean };
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

export class PaperTool extends BaseTool {

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

    // Flatten margins
    const m = meta.margins ?? { top: 25, right: 20, bottom: 25, left: 20 };
    if (!('marginTop'    in existing)) patch.marginTop    = m.top;
    if (!('marginRight'  in existing)) patch.marginRight  = m.right;
    if (!('marginBottom' in existing)) patch.marginBottom = m.bottom;
    if (!('marginLeft'   in existing)) patch.marginLeft   = m.left;

    // Flatten booleans
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
        defaultOpen: true,
        fields: [
          { type: 'select', key: 'paperType', label: 'Type',  options: PAPER_TYPES },
          { type: 'select', key: 'paperSize', label: 'Size',  options: PAPER_SIZES },
          { type: 'select', key: 'theme',     label: 'Theme', options: THEMES },
        ],
      },
      {
        section: 'Lines',
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
        fields: [
          { type: 'number', key: 'marginTop',    label: 'Top',    min: 0, max: 50, step: 1 },
          { type: 'number', key: 'marginRight',  label: 'Right',  min: 0, max: 50, step: 1 },
          { type: 'number', key: 'marginBottom', label: 'Bottom', min: 0, max: 50, step: 1 },
          { type: 'number', key: 'marginLeft',   label: 'Left',   min: 0, max: 50, step: 1 },
        ],
      },
      {
        section: 'Background',
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
    }
    element.dispatchEvent(new CustomEvent('craftools-paper-regenerate', { bubbles: false }));
  }
}

PaperTool.registeredKeys = ['papeis'];
ToolRegistry.register({ key: 'papeis', label: 'editor.paper', icon: 'description', tool: PaperTool, draggable: true, showInFooterNav: false, category: 'elements' });
