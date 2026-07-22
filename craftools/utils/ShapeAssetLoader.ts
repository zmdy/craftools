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
