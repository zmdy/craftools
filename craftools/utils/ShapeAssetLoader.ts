/**
 * ShapeAssetLoader.ts — enumerates the ready-made SVG shape packs under
 * assets/shapes/ (one subfolder per collection, e.g. assets/shapes/pack_01/,
 * assets/shapes/frames/, assets/shapes/dividers/) via Vite's
 * import.meta.glob(), so dropping a new folder/SVG in there shows up in
 * ShapeTool's picker after a rebuild -- no manifest file to hand-maintain.
 *
 * `{ query: '?url', import: 'default' }` resolves each match to its build
 * URL (small string) instead of inlining the raw SVG text into the JS
 * bundle -- these Inkscape-exported files carry a multi-KB embedded ICC
 * color-profile blob each, so eagerly inlining every one of them (`?raw`)
 * across every collection would bloat the bundle for files that are only
 * ever rendered lazily, one at a time, inside a scrollable picker grid.
 * They're used as opaque <img> sources (ShapeTool.ts), never recolored or
 * inlined into the page's own SVG.
 */

import { normalizeValue, svgPaintFromValue } from './ColorPickerUI.js';

const SHAPE_ASSET_MODULES: Record<string, string> = import.meta.glob(
  '/assets/shapes/*/*.svg',
  { eager: true, query: '?url', import: 'default' },
);

export interface ShapeAsset {
  /** Stable id used as the `asset:<id>` shapeType value, e.g. "pack_01/vector_g10". */
  id:         string;
  collection: string;
  /** Filename without extension, e.g. "vector_g10". */
  name:       string;
  /** Resolved build URL, suitable for an <img src>. */
  url:        string;
}

export interface ShapeCollection {
  /** Folder name under assets/shapes/, e.g. "pack_01". */
  id:     string;
  /** Humanized display label, e.g. "Pack 01". */
  label:  string;
  assets: ShapeAsset[];
}

/** Every shapeType value pointing at an asset pack SVG starts with this. */
export const ASSET_SHAPE_PREFIX = 'asset:';

export function isAssetShapeType(shapeType: string | undefined | null): boolean {
  return typeof shapeType === 'string' && shapeType.startsWith(ASSET_SHAPE_PREFIX);
}

export function assetShapeTypeFor(assetId: string): string {
  return ASSET_SHAPE_PREFIX + assetId;
}

export function assetIdFromShapeType(shapeType: string): string {
  return shapeType.slice(ASSET_SHAPE_PREFIX.length);
}

function humanizeCollectionId(id: string): string {
  return id
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildCollections(): ShapeCollection[] {
  const byCollection = new Map<string, ShapeAsset[]>();

  for (const path in SHAPE_ASSET_MODULES) {
    // path looks like "/assets/shapes/pack_01/vector_g10.svg"
    const match = path.match(/\/assets\/shapes\/([^/]+)\/([^/]+)\.svg$/i);
    if (!match) continue;
    const [, collection, name] = match;
    const asset: ShapeAsset = {
      id: `${collection}/${name}`,
      collection,
      name,
      url: SHAPE_ASSET_MODULES[path],
    };
    if (!byCollection.has(collection)) byCollection.set(collection, []);
    byCollection.get(collection)!.push(asset);
  }

  return [...byCollection.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, assets]) => ({
      id,
      label: humanizeCollectionId(id),
      assets: assets.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    }));
}

/** All discovered shape packs, sorted by folder name; each pack's assets sorted by filename. */
export const SHAPE_COLLECTIONS: ShapeCollection[] = buildCollections();

export function findShapeAsset(assetId: string): ShapeAsset | null {
  for (const collection of SHAPE_COLLECTIONS) {
    const found = collection.assets.find((a) => a.id === assetId);
    if (found) return found;
  }
  return null;
}

// ── Recolorable asset SVGs ───────────────────────────────────────────────
//
// findShapeAsset()'s `url` is what ShapeTool.ts's picker thumbnails use
// directly (plain <img src>, browsing-only, never recolored). But letting
// the USER pick a Fill/Stroke for an asset shape (same as every procedural
// ShapeGenerator shape) needs the actual SVG markup in the DOM to rewrite --
// an <img> is opaque to CSS/JS. The `?url` glob query deliberately doesn't
// give us that text (see the file-header comment: these are Inkscape
// exports with multi-KB embedded ICC profiles, too heavy to eagerly inline
// for every file in every pack up front). Fetching the handful of files the
// user actually places on the canvas, on demand, gets the same DOM access
// without that bundle-size cost -- browsers cache the response anyway
// because the picker's <img> already requested the same URL.

const svgTextCache = new Map<string, Promise<string>>();

/**
 * Fetches (and caches) an asset SVG's raw markup as text, for inlining +
 * recoloring. Failed fetches are evicted from the cache so a transient
 * network error doesn't permanently poison later retries for the same URL.
 */
export function loadAssetSvgText(url: string): Promise<string> {
  let cached = svgTextCache.get(url);
  if (!cached) {
    cached = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`ShapeAssetLoader: failed to fetch "${url}" (${res.status})`);
        return res.text();
      })
      .catch((err) => {
        svgTextCache.delete(url);
        throw err;
      });
    svgTextCache.set(url, cached);
  }
  return cached;
}

/**
 * Recolors an asset SVG's markup in place, mirroring ShapeGenerator.ts's
 * fill/stroke handling (solid OR gradient, via the same
 * normalizeValue()/svgPaintFromValue() pipeline as the standardized
 * color-picker field) -- but applied to an existing multi-element SVG
 * instead of generated geometry.
 *
 * Unlike ShapeGenerator's single `<g fill="..." stroke="...">` wrapper
 * (which works because every procedural shape's geometry has no fill/stroke
 * of its own to conflict with), these Inkscape exports set fill/stroke
 * explicitly per-element (attribute or inline `style="fill:...;stroke:..."`)
 * -- an inherited wrapper color would never win the CSS cascade against
 * those. Each element is rewritten individually instead, and ONLY where it
 * already had a real (non-"none") fill or stroke -- an element drawn with
 * `fill:none` (pure line art, e.g. a dashed corner-crop-mark frame) stays
 * fill-less rather than gaining a fill the source never had, and vice
 * versa. This means the two color pickers only ever affect channels the
 * artwork actually uses -- a pure-line-art pack reacts only to Stroke, a
 * silhouette pack only to Fill, matching what the asset visually is.
 */
export function recolorAssetSvgMarkup(svgMarkup: string, fillColor?: string, strokeColor?: string): string {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = svgMarkup;
  const svg = wrapper.firstElementChild as SVGSVGElement | null;
  if (!svg) return svgMarkup;

  const fillPaint   = fillColor   !== undefined ? svgPaintFromValue(normalizeValue(fillColor),   'shape-asset-fill')   : null;
  const strokePaint = strokeColor !== undefined ? svgPaintFromValue(normalizeValue(strokeColor), 'shape-asset-stroke') : null;

  svg.querySelectorAll<SVGElement>('*').forEach((node) => {
    if (fillPaint) {
      const attrFill = node.getAttribute('fill');
      if (attrFill && attrFill !== 'none') node.setAttribute('fill', fillPaint.paint);
      // `.style.fill` reads/writes the `fill:` component of a `style="..."`
      // attribute specifically (not the `fill` presentation attribute
      // above) -- Inkscape puts color info here, not as bare attributes.
      if (node.style.fill && node.style.fill !== 'none') node.style.fill = fillPaint.paint;
    }
    if (strokePaint) {
      const attrStroke = node.getAttribute('stroke');
      if (attrStroke && attrStroke !== 'none') node.setAttribute('stroke', strokePaint.paint);
      if (node.style.stroke && node.style.stroke !== 'none') node.style.stroke = strokePaint.paint;
    }
  });

  const extraDefs = (fillPaint?.defs ?? '') + (strokePaint?.defs ?? '');
  if (extraDefs) {
    let defsEl = svg.querySelector('defs');
    if (!defsEl) {
      defsEl = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.insertBefore(defsEl, svg.firstChild);
    }
    defsEl.insertAdjacentHTML('beforeend', extraDefs);
  }

  return svg.outerHTML;
}
