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
import { borderSection, radiusSection, zIndexSection } from '../../utils/CommonSchema';
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

    // Color mode: detect gradient from webkitTextFillColor
    const isGradient = textEl.style.webkitTextFillColor === 'transparent';
    if (!('colorMode' in existing)) patch.colorMode = isGradient ? 'gradient' : 'solid';

    if (!('color' in existing)) {
      patch.color = isGradient
        ? '#1a1a1a'
        : rgbToHex(textEl.style.color || '#1a1a1a');
    }

    if (!('gradient' in existing) && isGradient && textEl.style.background) {
      const m = textEl.style.background.match(
        /linear-gradient\((\d+)deg,\s*(#[\da-fA-F]+),\s*(#[\da-fA-F]+)\)/
      );
      patch.gradient = m
        ? { from: m[2], to: m[3], angle: Number(m[1]) }
        : { from: '#f97316', to: '#ec4899', angle: 90 };
    } else if (!('gradient' in existing)) {
      patch.gradient = { from: '#f97316', to: '#ec4899', angle: 90 };
    }

    if (Object.keys(patch).length) {
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
    }
  }

  // ── Schema ────────────────────────────────────────────────────────────────────

  static getPropertySchema(element: HTMLElement): PropertySchema {
    const state = PropertyRenderer._readState(element);
    const isGradient = state.colorMode === 'gradient';

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
          {
            type: 'select',
            key: 'colorMode',
            label: 'Mode',
            options: [
              { value: 'solid',    label: 'Solid color' },
              { value: 'gradient', label: 'Gradient' },
            ],
          },
          { type: 'color',          key: 'color',    label: 'Color',    hidden: isGradient },
          { type: 'color-gradient', key: 'gradient', label: 'Gradient', hidden: !isGradient },
        ],
      },
      borderSection(),
      radiusSection(),
      zIndexSection(),
    ];
  }

  // ── Apply ─────────────────────────────────────────────────────────────────────

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    // Persist to state store
    PropertyRenderer.applyChange(element, key, value);

    const textEl = getTextEl(element);
    if (!textEl) return;

    const state = PropertyRenderer._readState(element);

    switch (key) {
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

      case 'colorMode':
      case 'color':
      case 'gradient':
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
    if (state.colorMode === 'gradient') {
      const g = state.gradient as { from: string; to: string; angle: number } | undefined;
      const from  = g?.from  ?? '#f97316';
      const to    = g?.to    ?? '#ec4899';
      const angle = g?.angle ?? 90;
      textEl.style.background           = `linear-gradient(${angle}deg, ${from}, ${to})`;
      textEl.style.webkitBackgroundClip = 'text';
      textEl.style.webkitTextFillColor  = 'transparent';
      textEl.style.backgroundClip       = 'text';
    } else {
      textEl.style.background           = '';
      textEl.style.webkitBackgroundClip = '';
      textEl.style.webkitTextFillColor  = '';
      textEl.style.backgroundClip       = '';
      textEl.style.color                = String(state.color ?? '#1a1a1a');
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
