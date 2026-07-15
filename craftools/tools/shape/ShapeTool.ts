/**
 * ShapeTool.ts — Schema-based TypeScript migration of ShapeTool.
 *
 * State is stored in element._craftoolsMeta (a plain JS object set by ShapeTool.js).
 * _syncFromDOM() copies it into dataset.ctState so PropertyRenderer can read values.
 * _applyProperty() writes back to _craftoolsMeta AND calls _regenerate() to update the SVG.
 */

import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import type { PropertySchema } from '../../types/PropertySchema';

// ── Meta type (mirrors ShapeGenerator.defaultMeta output) ────────────────────

interface ShapeMeta {
  shapeType:      string;
  fillColor:      string;
  strokeColor:    string;
  strokeWidth:    number;
  // square
  cornerRadius?:  number;
  // polygon
  sides?:         number;
  // star
  points?:        number;
  innerRatio?:    number;
  // blob
  blobPoints?:    number;
  blobRandomness?: number;
  blobSeed?:      number;
  // flower
  petals?:        number;
}

const getMeta = (element: HTMLElement): ShapeMeta =>
  (element as HTMLElement & { _craftoolsMeta?: ShapeMeta })._craftoolsMeta ?? {
    shapeType: 'square', fillColor: '#6366f1', strokeColor: '#1a1a1a', strokeWidth: 0,
  };

const setMeta = (element: HTMLElement, patch: Partial<ShapeMeta>): ShapeMeta => {
  const el = element as HTMLElement & { _craftoolsMeta?: ShapeMeta };
  el._craftoolsMeta = { ...getMeta(element), ...patch };
  return el._craftoolsMeta;
};

// ── Tool ──────────────────────────────────────────────────────────────────────

export class ShapeTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};

    const keys: (keyof ShapeMeta)[] = [
      'shapeType', 'fillColor', 'strokeColor', 'strokeWidth',
      'cornerRadius', 'sides', 'points', 'innerRatio',
      'blobPoints', 'blobRandomness', 'petals',
    ];

    keys.forEach(k => {
      if (!(k in existing) && meta[k] !== undefined) patch[k] = meta[k];
    });

    if (Object.keys(patch).length) {
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
    }
  }

  static getPropertySchema(element: HTMLElement): PropertySchema {
    const state = PropertyRenderer._readState(element);
    const shapeType = String(state.shapeType ?? 'square');

    return [
      {
        section: 'Fill & Stroke',
        defaultOpen: true,
        fields: [
          { type: 'color',  key: 'fillColor',    label: 'Fill' },
          { type: 'color',  key: 'strokeColor',  label: 'Stroke' },
          { type: 'slider', key: 'strokeWidth',  label: 'Stroke width', min: 0, max: 10, step: 0.5 },
        ],
      },
      {
        section: 'Shape',
        defaultOpen: true,
        fields: [
          // square
          {
            type: 'slider', key: 'cornerRadius', label: 'Corner radius',
            min: 0, max: 50, step: 1,
            hidden: shapeType !== 'square',
          },
          // polygon
          {
            type: 'slider', key: 'sides', label: 'Sides',
            min: 3, max: 12, step: 1,
            hidden: shapeType !== 'polygon',
          },
          // star
          {
            type: 'slider', key: 'points', label: 'Points',
            min: 3, max: 12, step: 1,
            hidden: shapeType !== 'star',
          },
          {
            type: 'slider', key: 'innerRatio', label: 'Inner ratio',
            min: 0.15, max: 0.85, step: 0.05,
            hidden: shapeType !== 'star',
          },
          // blob
          {
            type: 'slider', key: 'blobPoints', label: 'Points',
            min: 5, max: 20, step: 1,
            hidden: shapeType !== 'blob',
          },
          {
            type: 'slider', key: 'blobRandomness', label: 'Randomness',
            min: 0, max: 1, step: 0.05,
            hidden: shapeType !== 'blob',
          },
          // flower
          {
            type: 'slider', key: 'petals', label: 'Petals',
            min: 4, max: 16, step: 1,
            hidden: shapeType !== 'flower',
          },
        ].filter(f => !f.hidden),
      },
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    setMeta(element, { [key]: value } as Partial<ShapeMeta>);
    ShapeTool._regenerate(element);
  }

  /** Re-renders the SVG from the current _craftoolsMeta. */
  private static _regenerate(element: HTMLElement): void {
    // Delegate to the JS side via a custom event — ShapeTool.js listens for this.
    element.dispatchEvent(
      new CustomEvent('craftools-shape-regenerate', { bubbles: false }),
    );
  }
}

// ── Self-registration ─────────────────────────────────────────────────────────

ShapeTool.registeredKeys = ['shape'];

ToolRegistry.register({
  key:             'shape',
  label:           'editor.shape',
  icon:            'category',
  tool:            ShapeTool,
  draggable:       true,
  showInFooterNav: true,
  category:        'elements',
});
