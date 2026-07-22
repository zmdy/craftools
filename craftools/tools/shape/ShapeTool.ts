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
import { ShapeGenerator, LINE_SHAPE_TYPES, type ShapeMeta } from '../../utils/ShapeGenerator';
import {
  SHAPE_COLLECTIONS, isAssetShapeType, assetShapeTypeFor, assetIdFromShapeType, findShapeAsset,
  loadAssetSvgText, recolorAssetSvgMarkup,
  type ShapeAsset,
} from '../../utils/ShapeAssetLoader';
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

// Per-element bookkeeping for asset shapes: which asset is currently loaded
// (`_ctAssetId`) and its pristine, never-recolored SVG markup
// (`_ctAssetSvgRaw`, populated once the fetch in _loadAndPaintAsset()
// resolves). Recoloring always starts from this pristine copy rather than
// the currently-painted DOM -- re-running recolorAssetSvgMarkup() against
// markup that's already been recolored once would still work (it only ever
// looks for "is this non-'none'", not "is this the original color"), but
// keeping one clean source of truth avoids any accidental double-transform
// drift if that assumption ever stops holding.
type AssetTrackedElement = HTMLElement & {
  _craftoolsMeta?: ShapeMeta;
  _ctAssetId?: string;
  _ctAssetSvgRaw?: string;
};

const SHAPE_LABEL_KEYS: Record<string, string> = {
  square: 'shapeSquare', circle: 'shapeCircle', triangle: 'shapeTriangle',
  polygon: 'shapePolygon', star: 'shapeStar', heart: 'shapeHeart',
  blob: 'shapeBlob', flower: 'shapeFlower',
  diamond: 'shapeDiamond', cross: 'shapeCross', ring: 'shapeRing',
  arrow: 'shapeArrow', arc: 'shapeArc', speechBubble: 'shapeSpeechBubble',
  line: 'shapeLine', elbowConnector: 'shapeElbowConnector',
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

    .ct-shape-tab-bar {
      display: flex; gap: 2px; overflow-x: auto; padding: 8px 10px 0;
      border-bottom: 1px solid var(--border, #e4e4e7); scrollbar-width: none;
    }
    .ct-shape-tab-bar::-webkit-scrollbar { display: none; }
    .ct-shape-tab {
      background: none; border: none; cursor: pointer; white-space: nowrap;
      font-size: 11px; font-weight: 600; color: var(--text-secondary, #71717a);
      padding: 7px 9px; border-radius: 6px 6px 0 0; flex-shrink: 0;
      transition: background 0.12s, color 0.12s;
      border-bottom: 2px solid transparent;
    }
    .ct-shape-tab.active {
      color: var(--text-primary, #18181b);
      background: var(--bg-hover, rgba(0,0,0,.06));
      border-bottom-color: var(--accent, #f97316);
    }
    .ct-shape-tab:hover { background: var(--bg-hover, rgba(0,0,0,.06)); }
    .ct-shape-asset-grid {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 8px; padding: 10px 12px 14px; max-height: 320px; overflow-y: auto;
    }
    .ct-shape-asset-btn {
      background: var(--bg-input, #f4f4f5); border: 1px solid var(--border, #e4e4e7);
      cursor: grab; border-radius: 8px; padding: 8px;
      display: flex; align-items: center; justify-content: center;
      aspect-ratio: 1; transition: background 0.12s, transform 0.12s, border-color 0.12s;
    }
    .ct-shape-asset-btn:hover { background: var(--bg-hover, rgba(0,0,0,.06)); border-color: var(--accent, #f97316); transform: scale(1.05); }
    .ct-shape-asset-btn:active { cursor: grabbing; transform: scale(0.94); }
    .ct-shape-asset-btn img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; user-select: none; }
    .ct-shape-asset-empty {
      grid-column: 1/-1; text-align: center; font-size: 12px;
      color: var(--text-secondary, #71717a); padding: 20px 0;
    }
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
      'armThickness', 'ringThickness', 'arrowStart', 'arrowEnd', 'dashed',
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

    // defaultMeta() falls through to its `default:` branch for asset shape
    // types ("asset:pack_01/vector_g10", matched by no case) -- still gives
    // a real ShapeMeta object with shapeType set, just without any of the
    // procedural fields the asset image doesn't use. Using it here for both
    // branches keeps this in sync with renderPickerPanel()'s "change shape"
    // path below, which also always goes through defaultMeta().
    el._craftoolsMeta = ShapeGenerator.defaultMeta(shapeType);

    if (isAssetShapeType(shapeType)) {
      const assetId = assetIdFromShapeType(shapeType);
      (el as AssetTrackedElement)._ctAssetId = assetId;
      ShapeTool._loadAndPaintAsset(el, shapeType, assetId);
    } else {
      const svg = ShapeGenerator.buildSvgElement(el._craftoolsMeta);
      svg.style.userSelect = 'none';
      svg.style.pointerEvents = 'none';
      el.appendChild(svg);
    }

    return el;
  }

  /**
   * Builds the placeholder `<img>` shown for an asset-pack shape while its
   * real SVG markup is being fetched (see _loadAndPaintAsset()) -- shows the
   * file's native, unrecolored appearance immediately (same URL the picker
   * thumbnails use, so it's very likely already cached by the browser) so
   * the element is never blank, then gets swapped for the recolorable
   * inlined `<svg>` once the fetch resolves.
   */
  private static _buildAssetPlaceholderImg(asset: ShapeAsset): HTMLImageElement {
    const img = document.createElement('img');
    img.dataset.shapeAssetPlaceholder = '1';
    img.src = asset.url;
    img.alt = asset.name;
    img.draggable = false;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.display = 'block';
    img.style.userSelect = 'none';
    img.style.pointerEvents = 'none';
    img.style.objectFit = 'contain';
    return img;
  }

  /**
   * Fetches an asset's raw SVG text (ShapeAssetLoader.ts's cached
   * loadAssetSvgText()), recolors it for the element's CURRENT fillColor/
   * strokeColor, and swaps it in for the placeholder `<img>`. Kicked off
   * from both createElement() (new element) and _regenerate() (asset
   * switched via "Change shape").
   */
  private static _loadAndPaintAsset(element: HTMLElement, shapeType: string, assetId: string): void {
    const asset = findShapeAsset(assetId);
    if (!asset) return;

    element.appendChild(ShapeTool._buildAssetPlaceholderImg(asset));

    loadAssetSvgText(asset.url).then(rawMarkup => {
      const tracked = element as AssetTrackedElement;
      // The element may have been deleted, or moved on to a different
      // asset/shape entirely, while this fetch was in flight -- bail rather
      // than resurrecting stale content onto it.
      if (tracked._ctAssetId !== assetId || tracked._craftoolsMeta?.shapeType !== shapeType) return;
      tracked._ctAssetSvgRaw = rawMarkup;
      ShapeTool._paintAssetSvg(element, rawMarkup, tracked._craftoolsMeta!);
    }).catch(() => {
      // Network/parsing failure -- leave the <img> placeholder showing
      // (still a valid, if unrecolored, rendering of the shape) rather than
      // leaving the element blank.
    });
  }

  /**
   * Recolors `rawMarkup` for the given meta's fillColor/strokeColor and
   * writes the result into `element`, replacing the placeholder `<img>`
   * (first paint) or updating the existing asset `<svg>` in place (later
   * Fill/Stroke edits -- same "keep the node, swap its content" contract
   * _regenerate()'s procedural branch uses for its own <svg>).
   */
  private static _paintAssetSvg(element: HTMLElement, rawMarkup: string, meta: ShapeMeta): void {
    const recolored = recolorAssetSvgMarkup(rawMarkup, meta.fillColor, meta.strokeColor);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = recolored;
    const fresh = wrapper.firstElementChild as SVGElement | null;
    if (!fresh) return;

    fresh.dataset.shapeAsset = '1';
    fresh.style.userSelect = 'none';
    fresh.style.pointerEvents = 'none';
    fresh.style.display = 'block';
    fresh.style.width = '100%';
    fresh.style.height = '100%';
    // Asset packs don't share ShapeGenerator's fixed 100x100
    // preserveAspectRatio="none" viewBox -- each file keeps its own native
    // aspect ratio, so letterboxing (the SVG equivalent of object-fit:
    // contain) avoids stretching/cropping when the element's box doesn't
    // match the source SVG's proportions.
    fresh.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    element.querySelector('img[data-shape-asset-placeholder]')?.remove();
    const existing = element.querySelector<SVGElement>('svg[data-shape-asset]');
    if (existing) {
      existing.setAttribute('viewBox', fresh.getAttribute('viewBox') ?? existing.getAttribute('viewBox') ?? '');
      existing.innerHTML = fresh.innerHTML;
    } else {
      element.appendChild(fresh);
    }
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

    // Bind-once/repaint-many container, same contract as EmojiPickerUI.ts's
    // renderEmojiPicker(): the active-tab state lives on the container
    // itself so re-invoking this function (every time the picker is opened)
    // doesn't reset back to the "Basic" tab. `_ctShapeBound` guards the
    // delegated listener set so it's only attached once per panelBody node.
    type BoundPanel = HTMLElement & { _ctShapeActiveTab?: string; _ctShapeBound?: boolean };
    const panel = panelBody as BoundPanel;
    if (panel._ctShapeActiveTab === undefined) panel._ctShapeActiveTab = 'basic';

    const basicGridHtml = (): string => `
      <div class="ct-shape-grid" data-part="asset-results">
        ${ShapeGenerator.SHAPE_TYPES.map(t => `
          <button class="ct-shape-btn" data-shape="${t}" draggable="true"
            title="${I18n.t('shapeTool.' + SHAPE_LABEL_KEYS[t])}">
            ${ShapeGenerator.buildSvgString({ ...ShapeGenerator.defaultMeta(t), fillColor: '#a1a1aa', strokeWidth: 0 })}
          </button>
        `).join('')}
      </div>
    `;

    const collectionGridHtml = (collectionId: string): string => {
      const collection = SHAPE_COLLECTIONS.find(c => c.id === collectionId);
      if (!collection || !collection.assets.length) {
        return `<div class="ct-shape-asset-grid"><div class="ct-shape-asset-empty">${I18n.t('shapeTool.noAssets')}</div></div>`;
      }
      return `
        <div class="ct-shape-asset-grid" data-part="asset-results">
          ${collection.assets.map(a => `
            <button class="ct-shape-asset-btn" data-asset-id="${a.id}" draggable="true" title="${a.name}">
              <img src="${a.url}" alt="${a.name}" loading="lazy" draggable="false">
            </button>
          `).join('')}
        </div>
      `;
    };

    const resultsHtml = (): string =>
      panel._ctShapeActiveTab === 'basic' ? basicGridHtml() : collectionGridHtml(panel._ctShapeActiveTab!);

    const bindResultsEvents = (): void => {
      panelBody.querySelectorAll<HTMLButtonElement>('.ct-shape-btn').forEach(btn => {
        const shapeType = btn.dataset.shape as string;
        btn.addEventListener('click', (e) => { e.preventDefault(); applyShape(shapeType); });
        btn.addEventListener('dragstart', (ev: DragEvent) => {
          ev.dataTransfer?.setData('ToolType', 'shape');
          ev.dataTransfer?.setData('ShapeType', shapeType);
          if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
        });
      });
      panelBody.querySelectorAll<HTMLButtonElement>('.ct-shape-asset-btn').forEach(btn => {
        const shapeType = assetShapeTypeFor(btn.dataset.assetId as string);
        btn.addEventListener('click', (e) => { e.preventDefault(); applyShape(shapeType); });
        btn.addEventListener('dragstart', (ev: DragEvent) => {
          ev.dataTransfer?.setData('ToolType', 'shape');
          ev.dataTransfer?.setData('ShapeType', shapeType);
          if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
        });
      });
    };

    const paint = (): void => {
      panelBody.innerHTML = `
        <div class="ct-shape-tab-bar" data-part="tabs">
          <button type="button" class="ct-shape-tab ${panel._ctShapeActiveTab === 'basic' ? 'active' : ''}"
            data-tab="basic">${I18n.t('shapeTool.tabBasic')}</button>
          ${SHAPE_COLLECTIONS.map(c => `
            <button type="button" class="ct-shape-tab ${panel._ctShapeActiveTab === c.id ? 'active' : ''}"
              data-tab="${c.id}">${c.label}</button>
          `).join('')}
        </div>
        <div data-part="results">${resultsHtml()}</div>
      `;
      bindResultsEvents();
    };

    paint();

    if (!panel._ctShapeBound) {
      panel._ctShapeBound = true;
      panelBody.addEventListener('click', (e) => {
        const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
        if (!tab) return;
        panel._ctShapeActiveTab = tab.dataset.tab;
        paint();
      });
    }
  }

  static getPropertySchema(element: HTMLElement): PropertySchema {
    const state = PropertyRenderer._readState(element);
    const shapeType = String(state.shapeType ?? 'square');

    // Asset-pack shapes (assets/shapes/<pack>/*.svg) get a Fill/Stroke pair
    // too (recolorAssetSvgMarkup() in ShapeAssetLoader.ts overrides whatever
    // non-"none" fill/stroke each element in the source SVG already has),
    // but none of ShapeGenerator's shape-specific fields (corner radius,
    // sides, arm thickness, ...) apply -- there's no procedural meta for
    // ShapeGenerator to read, and no strokeWidth field either, since the
    // source file's own relative stroke widths are preserved rather than
    // forced to one uniform value.
    if (isAssetShapeType(shapeType)) {
      return [
        {
          section: 'Fill & Stroke',
          icon: 'format_shapes',
          defaultOpen: true,
          fields: [
            { type: 'color-picker', key: 'fillColor',   label: 'Fill' },
            { type: 'color-picker', key: 'strokeColor', label: 'Stroke' },
          ],
        },
        zIndexSection(),
      ] as PropertySchema;
    }

    const isLineShape = LINE_SHAPE_TYPES.includes(shapeType);

    const shapeSpecificFields = [
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
      // cross
      {
        type: 'slider', key: 'armThickness', label: 'Arm thickness', i18nKey: 'shapeTool.armThickness',
        min: 10, max: 40, step: 1,
        hidden: shapeType !== 'cross',
      },
      // ring
      {
        type: 'slider', key: 'ringThickness', label: 'Ring thickness', i18nKey: 'shapeTool.ringThickness',
        min: 5, max: 45, step: 1,
        hidden: shapeType !== 'ring',
      },
      // line / elbowConnector
      {
        type: 'toggle', key: 'arrowStart', label: 'Arrow at start', i18nKey: 'shapeTool.arrowStart',
        hidden: !isLineShape,
      },
      {
        type: 'toggle', key: 'arrowEnd', label: 'Arrow at end', i18nKey: 'shapeTool.arrowEnd',
        hidden: !isLineShape,
      },
      {
        type: 'toggle', key: 'dashed', label: 'Dashed', i18nKey: 'shapeTool.dashed',
        // Only _line() reads `dashed` (an elbow connector's bent path
        // dashing isn't implemented -- would need per-segment dash-offset
        // math to look right around the corner, not a simple attribute).
        hidden: shapeType !== 'line',
      },
    ].filter(f => !f.hidden);

    return [
      {
        section: 'Fill & Stroke',
        icon: 'format_shapes',
        defaultOpen: true,
        fields: [
          // Lines/connectors have no enclosed area -- "Fill" drives the
          // (fill-less-by-default) arrowhead triangles' color instead, and
          // "Stroke" drives the segment itself, so both fields are relabeled
          // to describe what they actually control for these two types (see
          // LINE_SHAPE_TYPES in ShapeGenerator.ts).
          {
            type: 'color-picker', key: 'fillColor',
            label: isLineShape ? 'Arrowhead color' : 'Fill',
            i18nKey: isLineShape ? 'shapeTool.arrowheadColor' : undefined,
          },
          {
            type: 'color-picker', key: 'strokeColor',
            label: isLineShape ? 'Line color' : 'Stroke',
            i18nKey: isLineShape ? 'shapeTool.lineColor' : undefined,
          },
          { type: 'slider', key: 'strokeWidth',  label: isLineShape ? 'Line width' : 'Stroke width', min: isLineShape ? 1 : 0, max: 10, step: 0.5 },
        ],
      },
      // Circle/Triangle/Heart have no shape-specific parameters at all --
      // this section used to always be included regardless, so selecting
      // one of those three rendered a "Shape" accordion that expanded to a
      // completely empty body (no fields ever matched their hidden
      // conditions above). Only include the section when it actually has
      // something to show.
      ...(shapeSpecificFields.length ? [{
        section: 'Shape',
        icon: 'category',
        defaultOpen: true,
        fields: shapeSpecificFields,
      }] : []),
      zIndexSection(),
    ] as PropertySchema;
  }

  /**
   * "Change shape" ctx-bar action -- swaps the selected element's shape
   * type via the same picker grid used to add a new one, in "change" mode
   * (renderPickerPanel()'s `targetElement` param, which has existed since
   * this tool's migration but was never actually reachable: this
   * getCtxOptions() override didn't exist at all, so BaseTool's default
   * (an empty array) applied and the ctx-bar never offered a "change
   * shape" button in the first place. iconTool.changeIcon/shapeTool.
   * changeShape's translations already existed for exactly this feature,
   * confirming it was planned but never wired up.
   */
  static getCtxOptions(): Array<{ icon: string; label: string; command: (element: HTMLElement) => void }> {
    return [
      {
        icon: 'published_with_changes',
        label: I18n.t('shapeTool.changeShape'),
        command: (element: HTMLElement) => {
          const panelTitle = document.getElementById('panel-title');
          const panelBody  = document.getElementById('panel-body');
          if (!panelBody) return;
          if (panelTitle) panelTitle.textContent = I18n.t('shapeTool.pickerTitle');
          // `editor` (2nd param) is only read by renderPickerPanel()'s
          // "create a brand-new element" branch -- unused whenever
          // `targetElement` (3rd param) is passed, as it is here, so
          // reusing `element` in that slot is safe.
          ShapeTool.renderPickerPanel(panelBody, element, element, () => {
            // Picker grid replaced panelBody's contents wholesale, bypassing
            // renderPropertiesPanel()'s own "same element, don't re-clear"
            // tracking -- clear it explicitly so the properties panel
            // rebuilds cleanly instead of appending its sections after the
            // stale picker grid markup.
            panelBody.innerHTML = '';
            if (panelTitle) panelTitle.textContent = I18n.t('shapeTool.panelTitle');
            ShapeTool.renderPropertiesPanel(panelBody, element);
          });
        },
      },
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    // 'zIndex' (from CommonSchema.ts's zIndexSection()) is a plain CSS
    // stacking property, not part of the shape's own SVG meta -- routing it
    // through setMeta()/_regenerate() below persisted the value but never
    // actually touched element.style.zIndex, so the manual Z-Index field
    // visibly did nothing for this tool. Apply it directly instead, same as
    // every other tool's 'zIndex' case.
    if (key === 'zIndex') { element.style.zIndex = String(value); return; }
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
    const tracked = element as AssetTrackedElement;
    const meta = tracked._craftoolsMeta;
    if (!meta) return;

    if (isAssetShapeType(meta.shapeType)) {
      const assetId = assetIdFromShapeType(meta.shapeType!);

      if (tracked._ctAssetId === assetId && tracked._ctAssetSvgRaw) {
        // Same asset already fetched (a Fill/Stroke edit, not a shape
        // swap) -- repaint from the cached pristine markup, no network
        // round-trip needed.
        ShapeTool._paintAssetSvg(element, tracked._ctAssetSvgRaw, meta);
        ShapeTool._triggerChange(element);
        return;
      }

      // First time this element shows an asset shape, or "Change shape"
      // switched it to a different asset -- drop whatever was there
      // (procedural <svg>, a different asset's <svg>, or a stale
      // placeholder) and start a fresh fetch-and-paint cycle.
      element.querySelector('svg:not([data-shape-asset])')?.remove();
      element.querySelector('svg[data-shape-asset]')?.remove();
      element.querySelector('img[data-shape-asset-placeholder]')?.remove();
      tracked._ctAssetId = assetId;
      delete tracked._ctAssetSvgRaw;
      ShapeTool._loadAndPaintAsset(element, meta.shapeType!, assetId);
      ShapeTool._triggerChange(element);
      return;
    }

    // Swapping OUT of (or never having been) an asset shape -- clear the
    // asset-tracking state and drop any asset-specific DOM nodes before
    // building the procedural SVG.
    delete tracked._ctAssetId;
    delete tracked._ctAssetSvgRaw;
    element.querySelector('svg[data-shape-asset]')?.remove();
    element.querySelector('img[data-shape-asset-placeholder]')?.remove();

    const svgString = ShapeGenerator.buildSvgString(meta);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = svgString;
    const fresh = wrapper.firstElementChild as SVGElement;

    const svg = element.querySelector<SVGElement>('svg:not([data-shape-asset])');
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
