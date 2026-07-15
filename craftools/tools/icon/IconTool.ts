/**
 * IconTool.ts — Schema-based TypeScript migration of IconTool.
 *
 * State is stored in element._craftoolsMeta (set by IconTool.js / IconLibrary.js).
 * _syncFromDOM() copies fillColor, strokeColor, strokeWidth into dataset.ctState.
 * _applyProperty() writes back to _craftoolsMeta and dispatches regenerate event.
 */

import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import type { PropertySchema } from '../../types/PropertySchema';

interface IconMeta {
  packId:      string;
  iconId:      string;
  fillColor:   string;
  strokeColor: string;
  strokeWidth: number;
}

const getMeta = (element: HTMLElement): IconMeta =>
  (element as HTMLElement & { _craftoolsMeta?: IconMeta })._craftoolsMeta ?? {
    packId: 'material-symbols', iconId: 'star',
    fillColor: '#1a1a1a', strokeColor: 'none', strokeWidth: 0,
  };

// ── Tool ──────────────────────────────────────────────────────────────────────

export class IconTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};

    if (!('fillColor'   in existing)) patch.fillColor   = meta.fillColor;
    if (!('strokeColor' in existing)) patch.strokeColor = meta.strokeColor;
    if (!('strokeWidth' in existing)) patch.strokeWidth = meta.strokeWidth;

    if (Object.keys(patch).length) {
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
    }
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Icon Style',
        defaultOpen: true,
        fields: [
          { type: 'color',  key: 'fillColor',   label: 'Fill color' },
          { type: 'color',  key: 'strokeColor', label: 'Stroke color' },
          { type: 'slider', key: 'strokeWidth', label: 'Stroke width', min: 0, max: 10, step: 0.5 },
        ],
      },
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const el = element as HTMLElement & { _craftoolsMeta?: IconMeta };
    if (el._craftoolsMeta) {
      (el._craftoolsMeta as unknown as Record<string, unknown>)[key] = value;
    }
    element.dispatchEvent(new CustomEvent('craftools-icon-regenerate', { bubbles: false }));
  }
}

// ── Self-registration ─────────────────────────────────────────────────────────

IconTool.registeredKeys = ['icone'];

ToolRegistry.register({
  key:             'icone',
  label:           'editor.icon',
  icon:            'emoji_symbols',
  tool:            IconTool,
  draggable:       true,
  showInFooterNav: true,
  category:        'elements',
});
