/**
 * ShapeTool.ts — Schema-based TypeScript migration of ShapeTool.
 *
 * State is stored in element._craftoolsMeta (a plain JS object).
 * _syncFromDOM() copies it into dataset.ctState so PropertyRenderer can read values.
 * _applyProperty() writes back to _craftoolsMeta AND calls _regenerate() to update the SVG.
 */

import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import { ShapeGenerator, type ShapeMeta } from '../../utils/ShapeGenerator';
import { I18n } from '../../settings/Translations.js';
// Registers the 'shapeTool.*' i18n keys used by renderPickerPanel()'s
// per-shape button titles and panelTitle lookups elsewhere (Editor.ts).
import './ShapeTool_Translations.js';
import type { PropertySchema } from '../../types/PropertySchema';

const getMeta = (element: HTMLElement): ShapeMeta =>
  (element as HTMLElement & { _craftoolsMeta?: ShapeMeta })._craftoolsMeta ?? {
    shapeType: 'square', fillColor: '#6366f1', strokeColor: '#1a1a1a', strokeWidth: 0,
  };

const setMeta = (element: HTMLElement, patch: Partial<ShapeMeta>): ShapeMeta => {
  const el = element as HTMLElement & { _craftoolsMeta?: ShapeMeta };
  el._craftoolsMeta = { ...getMeta(element), ...patch };
  return el._craftoolsMeta;
};

const SHAPE_LABEL_KEYS: Record<string, string> = {
  square: 'shapeSquare', circle: 'shapeCircle', triangle: 'shapeTriangle',
  polygon: 'shapePolygon', star: 'shapeStar', heart: 'shapeHeart',
  blob: 'shapeBlob', flower: 'shapeFlower',
};

const PICKER_STYLE_ID = 'ct-shape-picker-styles';

function ensurePickerStyles(): void {
  if (document.getElementById(PICKER_STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = PICKER_STYLE_ID;
  s.textContent = `
    .ct-shape-grid {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 8px; padding: 10px 12px 14px;
    }
    .ct-shape-btn {
      background: var(--bg-input, #f4f4f5); border: 1px solid var(--border, #e4e4e7);
      cursor: grab; border-radius: 8px; padding: 10px;
      display: flex; align-items: center; justify-content: center;
      aspect-ratio: 1; transition: background 0.12s, transform 0.12s, border-color 0.12s;
    }
    .ct-shape-btn:hover { background: var(--bg-hover, rgba(0,0,0,.06)); border-color: var(--accent, #f97316); transform: scale(1.05); }
    .ct-shape-btn:active { cursor: grabbing; transform: scale(0.94); }
    .ct-shape-btn svg { width: 100%; height: 100%; pointer-events: none; }
    .ct-shape-preview {
      display: flex; align-items: center; justify-content: center;
      padding: 14px 0 6px;
    }
    .ct-shape-preview svg { width: 84px; height: 84px; }
    .ct-shape-change-picker { max-height: 260px; overflow-y: auto; }
  `;
  document.head.appendChild(s);
}

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

  /**
   * Builds a `<craftools-element>` containing an SVG shape. Recovered from
   * the pre-migration ShapeTool.js (deleted by the "Purge legacy JS"
   * commit without this logic being ported) -- the previous file had no
   * createElement() at all, throwing "createElement is not a function"
   * for every shape element creation.
   */
  public static createElement(shapeType: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsMeta?: ShapeMeta };
    el.setAttribute('w', '120');
    el.setAttribute('h', '120');
    el.setAttribute('data-craftool', 'shape');

    el._craftoolsMeta = ShapeGenerator.defaultMeta(shapeType);

    const svg = ShapeGenerator.buildSvgElement(el._craftoolsMeta);
    svg.style.userSelect = 'none';
    svg.style.pointerEvents = 'none';
    el.appendChild(svg);

    return el;
  }

  /**
   * Renders the shape picker (grid of draggable/clickable shape buttons)
   * into `panelBody`. Recovered from the pre-migration ShapeTool.js --
   * this method didn't exist anywhere post-migration, so opening the
   * "Shape" sidebar/footer-nav entry rendered an empty panel (Editor.ts's
   * `m.ShapeTool.renderPickerPanel(panelBody, this)` silently did nothing,
   * since the imported module had no such export).
   *
   * If `targetElement` is given, clicking a shape swaps that element's
   * shape instead of creating a new one (used by the "Change shape"
   * context-bar action). `onApplied` runs after swapping an existing
   * element (used to re-render the properties panel for the new type).
   */
  public static renderPickerPanel(
    panelBody: HTMLElement,
    editor: HTMLElement,
    targetElement: (HTMLElement & { _craftoolsMeta?: ShapeMeta; select?: () => void }) | null = null,
    onApplied: (() => void) | null = null,
  ): void {
    ensurePickerStyles();

    const applyShape = (shapeType: string): void => {
      if (targetElement) {
        targetElement._craftoolsMeta = ShapeGenerator.defaultMeta(shapeType);
        ShapeTool._regenerate(targetElement);
        if (onApplied) onApplied();
      } else {
        const page = editor.querySelector('.craftools-page') as HTMLElement | null;
        if (!page) return;
        const rect = page.getBoundingClientRect();
        const scale = window.craftoolsZoomLevel || 1;
        const el = ShapeTool.createElement(shapeType, editor) as HTMLElement & { select?: () => void };
        el.setAttribute('x', String(Math.round(rect.width / scale / 2 - 60)));
        el.setAttribute('y', String(Math.round(rect.height / scale / 2 - 60)));
        page.appendChild(el);
        requestAnimationFrame(() => { setTimeout(() => el.select?.(), 20); });
        const ph = page.querySelector('div[style*="font-size: 14px"]');
        if (ph) ph.remove();
      }
    };

    panelBody.innerHTML = `
      <div class="ct-shape-grid" id="ct-shape-grid">
        ${ShapeGenerator.SHAPE_TYPES.map(t => `
          <button class="ct-shape-btn" data-shape="${t}" draggable="true"
            title="${I18n.t('shapeTool.' + SHAPE_LABEL_KEYS[t])}">
            ${ShapeGenerator.buildSvgString({ ...ShapeGenerator.defaultMeta(t), fillColor: '#a1a1aa', strokeWidth: 0 })}
          </button>
        `).join('')}
      </div>
    `;

    panelBody.querySelectorAll<HTMLButtonElement>('.ct-shape-btn').forEach(btn => {
      const shapeType = btn.dataset.shape as string;
      btn.addEventListener('click', (e) => { e.preventDefault(); applyShape(shapeType); });
      btn.addEventListener('dragstart', (ev: DragEvent) => {
        ev.dataTransfer?.setData('ToolType', 'shape');
        ev.dataTransfer?.setData('ShapeType', shapeType);
        if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
      });
    });
  }

  static getPropertySchema(element: HTMLElement): PropertySchema {
    const state = PropertyRenderer._readState(element);
    const shapeType = String(state.shapeType ?? 'square');

    return [
      {
        section: 'Fill & Stroke',
        icon: 'format_shapes',
        defaultOpen: true,
        fields: [
          { type: 'color-picker', key: 'fillColor',   label: 'Fill' },
          { type: 'color-picker', key: 'strokeColor', label: 'Stroke' },
          { type: 'slider', key: 'strokeWidth',  label: 'Stroke width', min: 0, max: 10, step: 0.5 },
        ],
      },
      {
        section: 'Shape',
        icon: 'category',
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
    ] as PropertySchema;
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    setMeta(element, { [key]: value } as Partial<ShapeMeta>);
    ShapeTool._regenerate(element);
  }

  /**
   * Re-renders the SVG from the current _craftoolsMeta. Recovered from the
   * pre-migration ShapeTool.js -- previously this only dispatched a
   * 'craftools-shape-regenerate' custom event with a comment claiming
   * "ShapeTool.js listens for this", but ShapeTool.js no longer exists
   * (deleted by the "Purge legacy JS" commit), so nothing ever handled it
   * and shape edits never touched the rendered SVG.
   */
  private static _regenerate(element: HTMLElement): void {
    const meta = (element as HTMLElement & { _craftoolsMeta?: ShapeMeta })._craftoolsMeta;
    if (!meta) return;

    const svgString = ShapeGenerator.buildSvgString(meta);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = svgString;
    const fresh = wrapper.firstElementChild as SVGElement;

    const svg = element.querySelector<SVGElement>('svg');
    if (svg) {
      // Keeps the same <svg> node (preserves border/radius applied via CommonSchema)
      svg.setAttribute('viewBox', fresh.getAttribute('viewBox') ?? '');
      svg.innerHTML = fresh.innerHTML;
    } else {
      fresh.style.userSelect = 'none';
      fresh.style.pointerEvents = 'none';
      element.appendChild(fresh);
    }

    ShapeTool._triggerChange(element);
  }

  private static _triggerChange(element: HTMLElement): void {
    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }
}

// ── Self-registration ─────────────────────────────────────────────────────────

ShapeTool.registeredKeys = ['shape'];

// label matches the desktop sidebar (index.html #pwa-sidebar-shape) --
// 'editor.shape' isn't a registered key, only 'shapeTool.panelTitle' is.
ToolRegistry.register({
  key:             'shape',
  label:           'shapeTool.panelTitle',
  icon:            'category',
  tool:            ShapeTool,
  draggable:       true,
  showInFooterNav: true,
  category:        'elements',
});
