/**
 * TextTool.ts — Schema-based TypeScript migration of TextTool.
 *
 * Handles both 'titulo' (heading) and 'paragrafo' (paragraph) element types.
 * The DOM manipulation logic remains in TextTool.js for backward compat with
 * the existing Editor.js. This file adds:
 *   - getPropertySchema()  → declarative field definitions
 *   - _syncFromDOM()       → bridges CSS state → dataset.ctState
 *   - _applyProperty()     → writes state AND updates CSS
 *   - ToolRegistry.register() × 2
 */

import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { formaSection, sizePositionSection, pageAlignSection } from '../../utils/CommonSchema';
import { AutoFitText } from '../../utils/AutoFitText.js';
import { normalizeValue as normalizeColorValue, cssFromValue as colorPickerCss, type ColorPickerValue } from '../../utils/ColorPickerUI';
import type { PropertySchema } from '../../types/PropertySchema';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the [contenteditable] child of a craftools-element, or null. */
const getTextEl = (element: HTMLElement): HTMLElement | null =>
  element.querySelector<HTMLElement>('[contenteditable]');

/** Converts rgb(r,g,b) → #rrggbb. Returns the input unchanged if not rgb. */
const rgbToHex = (rgb: string): string => {
  const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!m) return rgb;
  return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
};

// ── Tool class ────────────────────────────────────────────────────────────────

export class TextTool extends BaseTool {

  /**
   * Builds a fresh `<craftools-element data-craftool="titulo|paragrafo">`
   * with a contenteditable heading/paragraph inside. Recovered from the
   * pre-migration TextTool.js (deleted by the "Purge legacy JS" commit
   * without this logic being ported) — the previous `createElement()` here
   * was a broken stub that called itself (`new this().createElement()`,
   * but createElement was never an instance method), throwing
   * "createElement is not a function" for every text element creation.
   */
  static createElement(type: string, _editor?: unknown): HTMLElement {
    let tag = 'p', size = 16, weight = 400, w = 200, h = 40;
    const text = 'Editar texto...';

    if (type === 'titulo') {
      tag = 'h1'; size = 48; weight = 700; w = 300; h = 70;
    } else if (type === 'paragrafo') {
      tag = 'p'; size = 16; weight = 400; w = 200; h = 40;
    }

    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsAutoResize?: boolean };
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', String(w));
    el.setAttribute('h', String(h));
    el.setAttribute('data-craftool', type);
    // Auto-fit starts OFF (see AutoFitText.ts / CommonSchema.ts's
    // sizePositionSection({ autoFit: true })) -- only `true` turns it on.
    el._craftoolsAutoResize = false;

    const content = document.createElement(tag);
    content.setAttribute('contenteditable', 'true');
    content.setAttribute('spellcheck', 'false');
    content.style.cssText = `
      font-size: ${size}px;
      font-weight: ${weight};
      color: #1a1a1a;
      font-family: 'DM Sans', 'Noto Color Emoji', sans-serif;
      display: block;
      width: 100%;
      height: 100%;
      white-space: pre-wrap;
      word-break: break-word;
      cursor: text;
      line-height: 1.3;
      margin: 0;
      outline: none;
    `;
    content.innerHTML = text;

    el.appendChild(content);

    return el;
  }

  // ── State sync (CSS → dataset.ctState) ──────────────────────────────────────

  protected static _syncFromDOM(element: HTMLElement): void {
    const textEl = getTextEl(element);
    if (!textEl) return;

    const existing = PropertyRenderer._readState(element);
    // Only populate keys that aren't already stored
    const patch: Record<string, unknown> = {};

    if (!('font' in existing)) {
      patch.font = (textEl.style.fontFamily || 'DM Sans')
        .replace(/['"]/g, '').split(',')[0].trim();
    }
    if (!('fontSize' in existing)) {
      patch.fontSize = parseFloat(textEl.style.fontSize) || 16;
    }
    if (!('lineHeight' in existing)) {
      patch.lineHeight = parseFloat(textEl.style.lineHeight) || 1.4;
    }
    if (!('textAlign' in existing)) {
      patch.textAlign = textEl.style.textAlign || 'left';
    }
    if (!('bold' in existing)) {
      patch.bold = textEl.style.fontWeight === 'bold' || textEl.style.fontWeight === '700';
    }
    if (!('italic' in existing)) {
      patch.italic = textEl.style.fontStyle === 'italic';
    }
    if (!('underline' in existing)) {
      patch.underline = textEl.style.textDecoration?.includes('underline') ?? false;
    }

    // Color: detect gradient from webkitTextFillColor, migrate into the
    // standardized ColorPickerValue shape (see utils/ColorPickerUI.ts).
    // Only gates on the single 'color' key now -- a session saved before
    // this migration may still have the old flat `color` (bare hex string)
    // plus separate `colorMode`/`gradient` keys sitting in dataset.ctState;
    // those are simply left as harmless orphaned JSON and never read again
    // (normalizeColorValue() below already treats a bare string value as a
    // solid color, so old saved sessions keep rendering correctly either way).
    if (!('color' in existing)) {
      const isGradient = textEl.style.webkitTextFillColor === 'transparent';
      let colorValue: ColorPickerValue;
      if (isGradient) {
        const m = textEl.style.background?.match(
          /linear-gradient\((\d+)deg,\s*(#[\da-fA-F]+),\s*(#[\da-fA-F]+)\)/
        );
        colorValue = normalizeColorValue({
          mode: 'gradient',
          gradient: m
            ? { type: 'linear', angle: Number(m[1]), stops: [m[2], m[3]] }
            : { type: 'linear', angle: 90, stops: ['#f97316', '#ec4899'] },
        });
      } else {
        colorValue = normalizeColorValue({ mode: 'solid', solid: rgbToHex(textEl.style.color || '#1a1a1a') });
      }
      patch.color = JSON.stringify(colorValue);
    }

    if (Object.keys(patch).length) {
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
    }
  }

  // ── Style bar target ─────────────────────────────────────────────────────────

  // Border/radius/margin styling lives on the [contenteditable] child, not
  // the outer craftools-element (see _applyProperty()'s border*/margin*
  // cases below) -- so the Copy/Paste bar (BaseTool.ts's _renderStyleBar())
  // must read/write cssText there too, or it would copy/paste nothing
  // meaningful from the outer element.
  protected static _getStyleTarget(element: HTMLElement): HTMLElement {
    return getTextEl(element) ?? element;
  }

  // ── Schema ────────────────────────────────────────────────────────────────────

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Typography',
        i18nKey: 'textTool.typography',
        icon: 'text_fields',
        defaultOpen: true,
        fields: [
          { type: 'font-select', key: 'font',       label: 'Font' },
          { type: 'slider',      key: 'fontSize',   label: 'Size', min: 8, max: 200, step: 1 },
          { type: 'slider',      key: 'lineHeight',  label: 'Line height', min: 1, max: 4, step: 0.05 },
          { type: 'align',       key: 'textAlign' },
          { type: 'toggle',      key: 'bold',       label: 'Bold' },
          { type: 'toggle',      key: 'italic',     label: 'Italic' },
          { type: 'toggle',      key: 'underline',  label: 'Underline' },
        ],
      },
      {
        section: 'Color',
        i18nKey: 'textTool.color',
        icon: 'palette',
        defaultOpen: true,
        fields: [
          // Standardized solid-or-gradient picker (see color-picker.field.ts) --
          // owns its own Cor/Gradiente toggle internally, so no separate mode
          // field or hidden-field pair is needed here anymore.
          // defaultSolid: '#18181b' -- text defaults to near-black (matches
          // createElement()'s `color: #1a1a1a`), not the shared white default
          // used by page/shape backgrounds.
          { type: 'color-picker', key: 'color', label: 'Color', defaultSolid: '#18181b' },
        ],
      },
      formaSection({ margin: true }),
      sizePositionSection({ autoFit: true }),
      pageAlignSection(),
    ];
  }

  // ── Apply ─────────────────────────────────────────────────────────────────────

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    // 'pageAlign' (pageAlignSection()) is a fire-and-forget action with no
    // stored value -- delegate to BaseTool's shared SnapEngine.align()
    // wiring and skip the state write below entirely.
    if (key === 'pageAlign') {
      super._applyProperty(element, key, value);
      return;
    }

    // Persist to state store
    PropertyRenderer.applyChange(element, key, value);

    const textEl = getTextEl(element);
    if (!textEl) return;

    const state = PropertyRenderer._readState(element);

    switch (key) {
      case 'autoFit': {
        (element as unknown as { _craftoolsAutoResize?: boolean })._craftoolsAutoResize = !!value;
        if (value) AutoFitText.applyAutoSize(element, textEl);
        break;
      }

      case 'width':
        element.style.width = `${value}px`;
        if (typeof (element as unknown as { pw?: number }).pw === 'number') {
          (element as unknown as { pw?: number }).pw = parseFloat(String(value)) || 0;
        }
        break;
      case 'height':
        element.style.height = `${value}px`;
        if (typeof (element as unknown as { ph?: number }).ph === 'number') {
          (element as unknown as { ph?: number }).ph = parseFloat(String(value)) || 0;
        }
        break;
      case 'x':
        element.style.left = `${value}px`;
        element.setAttribute('x', String(value));
        break;
      case 'y':
        element.style.top = `${value}px`;
        element.setAttribute('y', String(value));
        break;

      case 'marginTop':
        textEl.style.marginTop = `${value}px`;
        break;
      case 'marginRight':
        textEl.style.marginRight = `${value}px`;
        break;
      case 'marginBottom':
        textEl.style.marginBottom = `${value}px`;
        break;
      case 'marginLeft':
        textEl.style.marginLeft = `${value}px`;
        break;
      case 'font':
        textEl.style.fontFamily = `'${value}', sans-serif`;
        break;

      case 'fontSize':
        textEl.style.fontSize = `${value}px`;
        break;

      case 'lineHeight':
        textEl.style.lineHeight = String(value);
        break;

      case 'textAlign':
        textEl.style.textAlign = String(value);
        break;

      case 'bold':
        textEl.style.fontWeight = value ? 'bold' : 'normal';
        break;

      case 'italic':
        textEl.style.fontStyle = value ? 'italic' : 'normal';
        break;

      case 'underline':
        textEl.style.textDecoration = value ? 'underline' : 'none';
        break;

      case 'color':
        TextTool._applyColor(textEl, state);
        break;

      case 'borderWidth':
        textEl.style.borderWidth  = `${value}px`;
        textEl.style.borderStyle  = String(state.borderStyle  ?? 'solid');
        textEl.style.borderColor  = String(state.borderColor  ?? '#000');
        break;
      case 'borderStyle':
        textEl.style.borderStyle = String(value);
        break;
      case 'borderColor':
        textEl.style.borderColor = String(value);
        break;
      case 'borderRadius':
        textEl.style.borderRadius = `${value}px`;
        break;
      case 'zIndex':
        element.style.zIndex = String(value);
        break;
    }
  }

  /** Applies the correct color or gradient to the text element. */
  private static _applyColor(textEl: HTMLElement, state: Record<string, unknown>): void {
    const value = normalizeColorValue(state.color);
    if (value.mode === 'gradient') {
      textEl.style.background           = colorPickerCss(value);
      textEl.style.webkitBackgroundClip = 'text';
      textEl.style.webkitTextFillColor  = 'transparent';
      textEl.style.backgroundClip       = 'text';
    } else {
      textEl.style.background           = '';
      textEl.style.webkitBackgroundClip = '';
      textEl.style.webkitTextFillColor  = '';
      textEl.style.backgroundClip       = '';
      textEl.style.color                = value.solid;
    }
  }
}

// ── Self-registration ─────────────────────────────────────────────────────────

TextTool.registeredKeys = ['titulo', 'paragrafo'];

ToolRegistry.register({
  key:             'titulo',
  label:           'editor.toolTitle',
  icon:            'title',
  tool:            TextTool,
  draggable:       true,
  showInFooterNav: true,
  category:        'text',
});

ToolRegistry.register({
  key:             'paragrafo',
  label:           'editor.text',
  icon:            'notes',
  tool:            TextTool,
  draggable:       true,
  showInFooterNav: true,
  category:        'text',
});
