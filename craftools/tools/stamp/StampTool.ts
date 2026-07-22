/**
 * StampTool.ts — Stamp tool. Stores state in dataset.ctState (and
 * mirrored onto element._ctState), so _syncFromDOM is a no-op.
 */
import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import { normalizeValue, svgPaintFromValue } from '../../utils/ColorPickerUI';
import { I18n } from '../../settings/Translations.js';
import './StampTool_Translations.js';
import type { PropertySchema } from '../../types/PropertySchema';

interface StampState {
  outerText:      string;
  outerFontSize:  number;
  outerBold:      boolean;
  showInnerText:  boolean;
  innerText:      string;
  innerFontSize:  number;
  centerType:     string; // 'text' | 'none'
  centerText:     string;
  centerFontSize: number;
  centerBold:     boolean;
  outerRadius:    number; // controls overall stamp size inside 200x200 viewBox
  rings:          number; // 1 | 2 | 3
  ringWidth:      number;
  separator:      string; // 'star' | 'dot' | 'diamond' | 'none'
  fontFamily:     string;
  color:          string;
}

const DEFAULT_STATE = (): StampState => ({
  outerText:     I18n.t('stamp.defaultOuterText'),
  outerFontSize: 11,
  outerBold:     true,
  showInnerText: true,
  innerText:     I18n.t('stamp.defaultInnerText'),
  innerFontSize: 9,
  centerType:    'text',
  centerText:    I18n.t('stamp.defaultCenterText'),
  centerFontSize: 14,
  centerBold:    true,
  outerRadius:   85,
  rings:         2,
  ringWidth:     1.5,
  separator:     'star',
  fontFamily:    'Arial',
  color:         '#1a1a2e',
});

const escXml = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const SEP_GLYPHS: Record<string, string> = { star: '★', dot: '●', diamond: '◆', none: '' };

export class StampTool extends BaseTool {

  // _syncFromDOM: no-op -- dataset.ctState already populated by createElement()

  /**
   * Builds the complete stamp SVG from a state object.
   *
   * Layout (viewBox 0 0 200 200, centre = 100,100):
   *
   *   [outerBorderR]  -- outermost ring  (outerRadius)
   *   [outerBorderR2] -- second thin ring (outerRadius - 4)
   *   [outerTextR]    -- outer text arc   (outerRadius - 10)
   *   sep glyphs        -- at (cx +/- outerTextR, cy)
   *   [innerTextR]    -- inner text arc   (outerRadius - 33)
   *   [innerBorderR]  -- inner thin ring  (outerRadius - 37) if rings=3
   *   CENTER TEXT     -- at (cx, cy)
   */
  public static buildSVG(state: StampState, uid: string): string {
    const {
      outerText, outerFontSize, outerBold,
      showInnerText, innerText, innerFontSize,
      centerType, centerText, centerFontSize, centerBold,
      outerRadius, rings, ringWidth,
      separator, fontFamily, color,
    } = state;

    const cx = 100, cy = 100;
    const r = Math.max(30, Math.min(93, outerRadius)); // clamp

    const outerBorderR  = r;
    const outerBorderR2 = r - 4;
    const outerTextR    = r - 10;
    const innerTextR    = r - 33;
    const innerBorderR  = r - 37;

    const outerPathId = `cb-op-${uid}`;
    const innerPathId = `cb-ip-${uid}`;

    // `color` holds whatever the standardized color-picker field reports: a
    // bare hex string (legacy value / DEFAULT_STATE()) or a JSON
    // ColorPickerValue string when the user has picked a gradient -- same
    // technique as ShapeGenerator.ts/IconLibrary.ts. Resolved once and
    // reused everywhere below (rings, both text arcs, separators, center
    // text) so the whole stamp shares a single gradient definition instead
    // of one per element.
    const colorPaint = svgPaintFromValue(normalizeValue(color), `cb-color-${uid}`);
    const paint = colorPaint.paint;

    // Arc paths (see CurvedTextTool.ts for the geometry proof):
    //   Top arc (CW, sweep=1):  M left A r r 0 0,1 right -> outside top, L->R
    //   Bot arc (CCW, sweep=0): M left A r r 0 0,0 right -> outside bottom, L->R
    const outerTopPath = `M ${cx - outerTextR},${cy} A ${outerTextR},${outerTextR} 0 0,1 ${cx + outerTextR},${cy}`;
    const innerBotPath = `M ${cx - innerTextR},${cy} A ${innerTextR},${innerTextR} 0 0,0 ${cx + innerTextR},${cy}`;

    const ring1 = `<circle cx="${cx}" cy="${cy}" r="${outerBorderR}" fill="none" stroke="${paint}" stroke-width="${ringWidth}"/>`;
    const ring2 = rings >= 2
      ? `<circle cx="${cx}" cy="${cy}" r="${outerBorderR2}" fill="none" stroke="${paint}" stroke-width="${ringWidth * 0.4}"/>`
      : '';
    const ring3 = rings >= 3
      ? `<circle cx="${cx}" cy="${cy}" r="${innerBorderR}" fill="none" stroke="${paint}" stroke-width="${ringWidth * 0.4}"/>`
      : '';

    const glyph = SEP_GLYPHS[separator] || '';
    const sepHtml = glyph ? `
      <text font-size="8" fill="${paint}" font-family="${escXml(fontFamily)},sans-serif"
            text-anchor="middle" dominant-baseline="middle">
        <tspan x="${cx - outerTextR}" y="${cy}">${glyph}</tspan>
      </text>
      <text font-size="8" fill="${paint}" font-family="${escXml(fontFamily)},sans-serif"
            text-anchor="middle" dominant-baseline="middle">
        <tspan x="${cx + outerTextR}" y="${cy}">${glyph}</tspan>
      </text>` : '';

    let centerHtml = '';
    if (centerType === 'text' && centerText) {
      const lines = String(centerText).split(/\\n|\n/);
      const lineH = Number(centerFontSize) * 1.25;
      const totalH = lines.length * lineH;
      const startY = cy - totalH / 2 + lineH * 0.45;
      centerHtml = `
      <text font-family="${escXml(fontFamily)},sans-serif"
            font-size="${centerFontSize}"
            font-weight="${centerBold ? 'bold' : 'normal'}"
            fill="${paint}"
            text-anchor="middle">
        ${lines.map((line, i) =>
          `<tspan x="${cx}" y="${startY + i * lineH}">${escXml(line)}</tspan>`
        ).join('')}
      </text>`;
    }

    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
                 width="100%" height="100%" overflow="visible">
      <defs>
        <path id="${outerPathId}" d="${outerTopPath}"/>
        <path id="${innerPathId}" d="${innerBotPath}"/>
        ${colorPaint.defs}
      </defs>

      ${ring1}
      ${ring2}
      ${ring3}

      <text font-size="${outerFontSize}"
            font-family="${escXml(fontFamily)},sans-serif"
            font-weight="${outerBold ? 'bold' : 'normal'}"
            fill="${paint}">
        <textPath href="#${outerPathId}" startOffset="50%" text-anchor="middle">
          ${escXml(outerText)}
        </textPath>
      </text>

      ${showInnerText ? `
      <text font-size="${innerFontSize}"
            font-family="${escXml(fontFamily)},sans-serif"
            fill="${paint}">
        <textPath href="#${innerPathId}" startOffset="50%" text-anchor="middle">
          ${escXml(innerText)}
        </textPath>
      </text>` : ''}

      ${sepHtml}
      ${centerHtml}
    </svg>`;
  }

  /**
   * Builds a fresh `<craftools-element data-craftool="stamp">` with its
   * stamp SVG inside. Recovered from the pre-migration StampTool.js
   * (deleted by the "Purge legacy JS" commit without this logic being
   * ported) -- the previous file had no createElement() at all, throwing
   * "createElement is not a function" for every stamp element creation.
   */
  public static createElement(_type: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _ctState?: StampState };
    const uid = Math.random().toString(36).slice(2, 8);

    el.setAttribute('data-craftool', 'stamp');
    el.setAttribute('data-ct-uid',   uid);
    el.setAttribute('w',  '160');
    el.setAttribute('h',  '160');
    el.setAttribute('x',  '20');
    el.setAttribute('y',  '20');

    const state = DEFAULT_STATE();
    el.dataset.ctState = JSON.stringify(state);
    el._ctState = state;

    el.innerHTML = StampTool.buildSVG(state, uid);
    return el;
  }

  /** Updates the element's SVG and persisted state in-place. */
  public static updateElement(el: HTMLElement & { _ctState?: StampState; contentArea?: HTMLElement }, state: StampState): void {
    el._ctState = state;
    el.dataset.ctState = JSON.stringify(state);

    const uid = el.getAttribute('data-ct-uid') || 'x';
    const svgHtml = StampTool.buildSVG(state, uid);

    const container = el.contentArea || el;
    const existing = container.querySelector('svg');
    if (existing) {
      existing.outerHTML = svgHtml;
    } else {
      container.innerHTML = svgHtml;
    }
  }

  static getCtxOptions(): Array<{ icon: string; label: string; command: (element: HTMLElement) => void }> {
    return [];
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Outer text',
        icon: 'text_rotation_none',
        defaultOpen: true,
        fields: [
          { type: 'text',   key: 'outerText',     label: 'Text' },
          { type: 'number', key: 'outerFontSize',  label: 'Size', min: 4, max: 30, step: 0.5 },
          { type: 'toggle', key: 'outerBold',      label: 'Bold' },
        ],
      },
      {
        section: 'Inner text',
        icon: 'text_format',
        fields: [
          { type: 'toggle', key: 'showInnerText',  label: 'Show inner text' },
          { type: 'text',   key: 'innerText',      label: 'Text' },
          { type: 'number', key: 'innerFontSize',  label: 'Size', min: 4, max: 20, step: 0.5 },
        ],
      },
      {
        section: 'Center',
        icon: 'center_focus_weak',
        fields: [
          {
            type: 'select', key: 'centerType', label: 'Center type',
            options: [{ value: 'text', label: 'Text' }, { value: 'none', label: 'None' }],
          },
          { type: 'text',   key: 'centerText',     label: 'Text' },
          { type: 'number', key: 'centerFontSize',  label: 'Size', min: 4, max: 40, step: 0.5 },
          { type: 'toggle', key: 'centerBold',      label: 'Bold' },
        ],
      },
      {
        section: 'Style',
        icon: 'style',
        fields: [
          { type: 'font-select', key: 'fontFamily',  label: 'Font' },
          { type: 'color-picker', key: 'color',      label: 'Color' },
          { type: 'slider',      key: 'outerRadius',  label: 'Radius',    min: 45, max: 93, step: 1 },
          { type: 'select',      key: 'rings',         label: 'Rings',
            options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }] },
          { type: 'slider',      key: 'ringWidth',    label: 'Ring width', min: 0.5, max: 5, step: 0.5 },
          {
            type: 'select', key: 'separator', label: 'Separator',
            options: [
              { value: 'star',    label: 'Star' },
              { value: 'dot',     label: 'Dot' },
              { value: 'diamond', label: 'Diamond' },
              { value: 'none',    label: 'None' },
            ],
          },
        ],
      },
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const e = element as HTMLElement & { _ctState?: StampState };
    if (key === 'zIndex') { element.style.zIndex = String(value); return; }
    if (!e._ctState) e._ctState = DEFAULT_STATE();
    (e._ctState as unknown as Record<string, unknown>)[key] = value;
    // Calls updateElement() directly (previously dispatched an unlistened
    // 'craftools-stamp-regenerate' custom event, so panel edits never
    // actually rebuilt the rendered SVG).
    StampTool.updateElement(e, e._ctState);
  }
}

StampTool.registeredKeys = ['stamp'];
// icon matches the desktop sidebar (index.html #pwa-sidebar-stamp).
ToolRegistry.register({ key: 'stamp', label: 'editor.stamp', icon: 'verified', tool: StampTool, draggable: true, showInFooterNav: false, category: 'elements' });
