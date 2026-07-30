/**
 * CurvedTextTool.ts — CurvedTextTool stores state in dataset.ctState (and
 * mirrored onto element._ctState), so _syncFromDOM is a no-op.
 * _applyProperty persists the change and re-renders the SVG in place.
 */
import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection, fontStyleField } from '../../utils/CommonSchema';
import { withEmojiFallback } from '../../utils/EmojiFont.js';
import { normalizeValue as normalizeColorValue, type ColorPickerValue } from '../../utils/ColorPickerUI';
import type { PropertySchema } from '../../types/PropertySchema';

interface CurvedTextState {
  text:          string;
  mode:          string; // 'arc-top' | 'arc-bottom' | 'full-circle'
  radius:        number;
  fontSize:      number;
  fontFamily:    string;
  /**
   * JSON-stringified ColorPickerValue (utils/ColorPickerUI.ts) -- stored as
   * a string, not the object itself, for the same reason
   * variable-binding.field.ts's value is: this whole state object gets
   * JSON.stringify()'d again into dataset.ctState, and PropertyRenderer's
   * re-render diffing compares String(value) -- a nested plain object would
   * always stringify to "[object Object]" either way, so the color field
   * would never refresh after the very first render. Parse with
   * normalizeColorValue() before use (handles the old flat hex-string shape
   * from before this field existed too, so old saved sessions still render).
   */
  color:         string;
  letterSpacing: number;
  startOffset:   number; // 0-100, only used in full-circle mode
  bold:          boolean;
  italic:        boolean;
}

const DEFAULT_STATE = (): CurvedTextState => ({
  text:          'MINHA EMPRESA',
  mode:          'arc-top',
  radius:        70,
  fontSize:      13,
  fontFamily:    'Arial',
  color:         JSON.stringify(normalizeColorValue({ mode: 'solid', solid: '#000000' })),
  letterSpacing: 2,
  startOffset:   50,
  bold:          false,
  italic:        false,
});

/** Escapes XML special characters for safe SVG embedding */
const escXml = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export class CurvedTextTool extends BaseTool {

  // _syncFromDOM: no-op -- dataset.ctState already populated by createElement()

  /**
   * Returns the SVG path `d` for the requested mode. Origin of the SVG is
   * (0,0); centrepoint is always (100,100).
   *
   * SVG arc geometry cheat-sheet (Y-axis points DOWN):
   *   sweep=1 -> visually clockwise -> text placed OUTSIDE (above path)
   *   sweep=0 -> visually CCW       -> text placed INSIDE  (above path = toward centre)
   *
   * We use:
   *   arc-top:     M left A r r 0 0 1 right  (CW small-arc via top)      -> outside top, L->R
   *   arc-bottom:  M left A r r 0 0 0 right  (CCW small-arc via bottom)  -> outside bottom, L->R
   *   full-circle: two CW large-arcs -- startOffset controls position
   */
  private static _pathD(mode: string, r: number, _startOffset: number): string {
    const cx = 100, cy = 100;
    const lx = cx - r, rx = cx + r;

    if (mode === 'arc-top') {
      return `M ${lx},${cy} A ${r},${r} 0 0,1 ${rx},${cy}`;
    }
    if (mode === 'arc-bottom') {
      return `M ${lx},${cy} A ${r},${r} 0 0,0 ${rx},${cy}`;
    }
    return `M ${lx},${cy} A ${r},${r} 0 1,1 ${rx},${cy} A ${r},${r} 0 1,1 ${lx},${cy}`;
  }

  /** Builds the <linearGradient>/<radialGradient> <defs> entry for a gradient color value, or '' for solid. */
  private static _gradientDefSVG(value: ColorPickerValue, gradId: string): string {
    if (value.mode !== 'gradient') return '';
    const stops = value.gradient.stops;
    const stopsXml = stops.map((c, i) => {
      const offset = stops.length > 1 ? (i / (stops.length - 1)) * 100 : 0;
      return `<stop offset="${offset}%" stop-color="${c}"/>`;
    }).join('');

    if (value.gradient.type === 'radial') {
      return `<radialGradient id="${gradId}" cx="50%" cy="50%" r="50%">${stopsXml}</radialGradient>`;
    }

    const rad = (Number(value.gradient.angle) || 0) * (Math.PI / 180);
    const x1 = 50 - Math.cos(rad) * 50;
    const y1 = 50 - Math.sin(rad) * 50;
    const x2 = 50 + Math.cos(rad) * 50;
    const y2 = 50 + Math.sin(rad) * 50;
    return `<linearGradient id="${gradId}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsXml}</linearGradient>`;
  }

  public static buildSVG(state: CurvedTextState, uid: string): string {
    const {
      text, mode, radius, fontSize, fontFamily,
      letterSpacing, startOffset, bold, italic,
    } = state;

    const colorValue = normalizeColorValue(state.color);
    const pathId  = `tc-path-${uid}`;
    const gradId  = `tc-grad-${uid}`;
    const fontWeight = bold   ? 'bold'   : 'normal';
    const fontStyle  = italic ? 'italic' : 'normal';

    const gradDef  = CurvedTextTool._gradientDefSVG(colorValue, gradId);
    const fillAttr = colorValue.mode === 'gradient' ? `fill="url(#${gradId})"` : `fill="${colorValue.solid}"`;
    const pathD = CurvedTextTool._pathD(mode, radius, startOffset);

    const offset = mode === 'full-circle'
      ? `${Math.max(0, Math.min(100, startOffset))}%`
      : '50%';

    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" overflow="visible">
      <defs>
        ${gradDef}
        <path id="${pathId}" d="${pathD}"/>
      </defs>
      <text
        font-size="${fontSize}"
        font-family="${withEmojiFallback(escXml(fontFamily))}"
        font-weight="${fontWeight}"
        font-style="${fontStyle}"
        letter-spacing="${letterSpacing}"
        ${fillAttr}
      >
        <textPath href="#${pathId}" startOffset="${offset}" text-anchor="middle">
          ${escXml(text)}
        </textPath>
      </text>
    </svg>`;
  }

  /**
   * Builds a fresh `<craftools-element data-craftool="curvedtext">` with
   * its curved-text SVG inside. Recovered from the pre-migration
   * CurvedTextTool.js (deleted by the "Purge legacy JS" commit without
   * this logic being ported) -- the previous file had no createElement()
   * at all, throwing "createElement is not a function" for every
   * curved-text element creation.
   */
  public static createElement(_type: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _ctState?: CurvedTextState };
    const uid = Math.random().toString(36).slice(2, 8);

    el.setAttribute('data-craftool', 'curvedtext');
    el.setAttribute('data-ct-uid',   uid);
    el.setAttribute('w',  '160');
    el.setAttribute('h',  '160');
    el.setAttribute('x',  '20');
    el.setAttribute('y',  '20');

    const state = DEFAULT_STATE();
    el.dataset.ctState = JSON.stringify(state);
    el._ctState = state;

    el.innerHTML = CurvedTextTool.buildSVG(state, uid);
    return el;
  }

  /** Updates the element's SVG and persisted state in-place. */
  public static updateElement(el: HTMLElement & { _ctState?: CurvedTextState; contentArea?: HTMLElement }, state: CurvedTextState): void {
    el._ctState = state;
    el.dataset.ctState = JSON.stringify(state);

    const uid = el.getAttribute('data-ct-uid') || 'x';
    const svgHtml = CurvedTextTool.buildSVG(state, uid);

    // Replace the SVG child (works whether content is in contentArea or directly in el)
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

  static getPropertySchema(element: HTMLElement): PropertySchema {
    const state = PropertyRenderer._readState(element);

    return [
      {
        section: 'Text',
        i18nKey: 'curvedTextTool.sectionText',
        icon: 'text_fields',
        defaultOpen: true,
        fields: [
          { type: 'text',        key: 'text',         label: 'Text',    i18nKey: 'curvedTextTool.text' },
          { type: 'font-select', key: 'fontFamily',   label: 'Font',    i18nKey: 'curvedTextTool.fontFamily' },
          { type: 'number',      key: 'fontSize',     label: 'Size',    i18nKey: 'curvedTextTool.fontSize',     min: 6, max: 100, unit: 'pt' },
          { type: 'number',      key: 'letterSpacing', label: 'Spacing', i18nKey: 'curvedTextTool.letterSpacing', min: -10, max: 30, step: 0.5 },
          fontStyleField([
            { key: 'bold',   style: 'bold',   i18nKey: 'curvedTextTool.bold' },
            { key: 'italic', style: 'italic', i18nKey: 'curvedTextTool.italic' },
          ]),
        ],
      },
      {
        section: 'Arc',
        i18nKey: 'curvedTextTool.sectionArc',
        icon: 'architecture',
        fields: [
          {
            type: 'select', key: 'mode', label: 'Mode', i18nKey: 'curvedTextTool.mode',
            options: [
              { value: 'arc-top',     label: 'Arc top',     i18nKey: 'curvedTextTool.modeArcTop' },
              { value: 'arc-bottom',  label: 'Arc bottom',  i18nKey: 'curvedTextTool.modeArcBottom' },
              { value: 'full-circle', label: 'Full circle', i18nKey: 'curvedTextTool.modeCircle' },
            ],
          },
          { type: 'slider', key: 'radius',      label: 'Radius',      i18nKey: 'curvedTextTool.radius',      min: 20, max: 200 },
          { type: 'slider', key: 'startOffset', label: 'Start offset', i18nKey: 'curvedTextTool.startOffset', min: 0,  max: 100,
            hidden: state.mode !== 'full-circle' },
        ],
      },
      {
        section: 'Color',
        i18nKey: 'curvedTextTool.sectionColor',
        icon: 'palette',
        fields: [
          // No explicit defaultSolid needed: ColorPickerUI.ts's shared
          // default is already near-black (#18181b).
          { type: 'color-picker', key: 'color', label: 'Color', i18nKey: 'curvedTextTool.color' },
        ],
      },
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const e = element as HTMLElement & { _ctState?: CurvedTextState };
    if (key === 'zIndex') { element.style.zIndex = String(value); return; }
    if (!e._ctState) e._ctState = DEFAULT_STATE();
    // 'color' arrives as a JSON string already (see color-picker.field.ts /
    // CurvedTextState.color's own doc comment) -- plain assignment is correct.
    (e._ctState as unknown as Record<string, unknown>)[key] = value;
    // Calls updateElement() directly (previously dispatched an unlistened
    // 'craftools-curvedtext-regenerate' custom event, so panel edits never
    // actually rebuilt the rendered SVG).
    CurvedTextTool.updateElement(e, e._ctState);
  }
}

CurvedTextTool.registeredKeys = ['curvedtext'];
// icon matches the desktop sidebar (index.html #pwa-sidebar-curvedtext).
ToolRegistry.register({ key: 'curvedtext', label: 'editor.curvedText', icon: 'change_history', tool: CurvedTextTool, draggable: true, showInFooterNav: false, category: 'text' });
