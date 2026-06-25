# CrafTools Grid Utility Documentation

## Overview
The `Craftools_LayoutGrid` utility is a highly modular, decoupled class responsible for building and managing layout grids dynamically across editor pages. Built following the Single Responsibility Principle (SRP), this class does not dictate *what* content goes inside the cells (e.g., images, texts, or shapes). Instead, its sole purpose is to calculate measurements, build the CSS Grid, assign the correct mathematical gaps/margins, and automatically generate extra pages if the layout elements overflow a single page.

The class actually supports **three structurally different rendering modes**, selected automatically based on the shape of the `template` object passed to it:

1. **Normal cells** — a uniform CSS Grid of identical cells (the classic album/grid case).
2. **Promo Kit** (`template.type === 'promo_kit'`) — multiple cell sizes packed onto the same page via a shelf bin-packing algorithm (e.g. mixing 5×5, 5×7 and 7×9 prints on one sheet).
3. **Photostrips** (`template.cellLines` / `template.cellColumns`) — a strip container holding an inner sub-grid of individually reorderable photo slots (e.g. a vertical 3-up photo-booth strip).

Normal-cell grids get outer drag-and-drop reordering via Sortable.js (`handle: '.album-drag-handle'`). Promo Kit and Photostrip modes instead use native HTML5 drag-and-drop to swap content between slots of the same or different sizes, with full coordinate/size remapping on drop.

---

## File Location
`craftools/utils/LayoutGrid.js`
(exported class: `Craftools_LayoutGrid`)

---

## The Template Structure
Before initializing the grid, you need to provide a `template` object that determines the physics and spacing of the CSS Grid matrix. These are typically maintained in `craftools/utils/GridSizes.js`, or fetched dynamically from the `craftools_api` backend via `craftools/utils/ApiDataLoader.js`.

### Normal-cell template example
```javascript
{
    name: "A4 Stickers Layout",   // Human-readable template name
    cellWidth: 99.1,              // The absolute width of a single cell (in units, usually mm)
    cellHeight: 67.8,             // The absolute height of a single cell (in units)
    cellPadding: "2 2 2 3",       // CSS shorthand for top right bottom left padding inside the cell
    pageMargin: "12.9 5.9 12.9 5.9", // Outer margin defining the bounding box on the page
    cellGap: 0,                   // Minimum spacing between identical cell slots
    sizes: ["210,297"]            // List of valid page sizes IDs (width, height) that can host this template
}
```

### Promo Kit template example
A Promo Kit template replaces `cellWidth`/`cellHeight` with a `cellSlots` array — each entry describes one group of same-size cells to pack onto the sheet:
```javascript
{
    name: "Promo Kit (5x5 + 5x7 + 7x9)",
    type: "promo_kit",
    pageMargin: "10 10 10 10",
    cellGap: 4,
    cellSlots: [
        { cellWidth: 50,  cellHeight: 50,  cellCount: 4, cellPadding: "0 0 0 0" },
        { cellWidth: 50,  cellHeight: 70,  cellCount: 2, cellPadding: "0 0 0 0" },
        { cellWidth: 70,  cellHeight: 90,  cellCount: 1, cellPadding: "0 0 0 0", cellGap: 2 }
    ],
    sizes: ["210,297"]
}
```
Each slot can optionally override `cellGap` for its own internal sub-grid.

### Photostrip template example
A photostrip template keeps `cellWidth`/`cellHeight` (the outer strip dimensions) and adds `cellLines`/`cellColumns` to describe the inner sub-grid of photo slots, plus `cellSpacing` for the gap between those inner slots:
```javascript
{
    name: "Photostrip 5x15 (3-up vertical)",
    cellWidth: 50,
    cellHeight: 150,
    cellLines: 3,
    cellColumns: 1,
    cellSpacing: 2,
    cellPadding: "5 5 5 5",
    pageMargin: "10 10 10 10",
    cellGap: 4,
    sizes: ["210,297"]
}
```

---

## Class Instantiation

To use the tool within a plugin or feature (like `AlbumTool.js`), import and instantiate `Craftools_LayoutGrid`:

```javascript
import { Craftools_LayoutGrid } from "../utils/LayoutGrid.js";

const gridSystem = new Craftools_LayoutGrid(editor, startPage, pageSize, template);
```

### Constructor Parameters
1. **`editor`** *(HTMLElement)*: The primary wrapper/context for the Editor Application (usually `this` or the `<craftools-editor>` element context). Used as an anchor to fetch zoom parameters or access DOM wrappers, and to resolve the `#pages-wrapper` node.
2. **`startPage`** *(HTMLElement)*: The target `.craftools-page` Node object where the grid should start drawing.
3. **`pageSize`** *(Object)*: From `Settings.js`. Needs to provide `.sizeUnit` (e.g., `"mm"`) and `.size` string (e.g., `"210,297"`).
4. **`template`** *(Object)*: The grid dimension descriptor (documented above) — normal, Promo Kit, or photostrip shape.

### Useful getters
- `isPhotostrip` — `true` if `template.cellLines` or `template.cellColumns` is set.
- `stripLines` / `stripCols` — inner sub-grid dimensions for photostrip mode (default `1`).
- `itemsPerStripe` — `stripLines * stripCols`.
- `cellSpacing` — gap between inner photostrip slots (`template.cellSpacing`, default `0`).

---

## The `render()` Method

The true power of `Craftools_LayoutGrid` relies on the asynchronous `.render(items, renderCellContentCallback)` function. It lazy-loads Sortable.js from a CDN on first use if it isn't already on `window`.

```javascript
// Example array of internal datasets
const myPhotosList = ["base64Data1", "base64Data2", "base64Data3..."];

await gridSystem.render(myPhotosList, (contentLayer, currentPhotoData, absoluteIndex, activeTemplateOrSlot) => {
    // contentLayer is the cell's (or slot's) inner container — append your content here
    let imgEl = document.createElement('div');
    imgEl.style.backgroundImage = `url(${currentPhotoData})`;
    contentLayer.appendChild(imgEl);
});
```

### How `render()` operates:

1. **Dimensional Calculation**: Based on the `pageSize` format, converts millimeters (or the configured unit) to the editor's working unit, and computes `availableW`/`availableH` from the page size minus `pageMargin`.
2. **Per-page capacity**: For normal/photostrip templates, divides the available area by `cellWidth + cellGap` / `cellHeight + cellGap` to get `cols` and `rows`; for photostrips, capacity is further multiplied by `itemsPerStripe`. For Promo Kit templates, capacity is simply the sum of every slot's `cellCount`.
3. **Pagination**: Loops through `items` in chunks of the page capacity. From the second chunk onward, it dynamically imports `PageTool.js` and calls `PageTool.addNewPage(editor)` to create and continue drawing onto a brand-new page.
4. **Grid Mounting**: Builds the outer `.craftools-grid-container` (CSS Grid for normal/photostrip modes, absolutely-positioned packed blocks for Promo Kit) and delegates to one of the three internal renderers below.
5. **Data Delegation**: For each cell/slot, the internal renderer calls your `renderCellContentCallback(contentLayer, itemData, globalIndex, templateOrSlot)`, isolating and delegating HTML/content logic entirely to the caller.
6. **Reordering**: Normal-cell grids get a `new Sortable(grid, { handle: '.album-drag-handle', ... })` instance for outer drag reordering. Promo Kit and photostrip slots instead wire up native `dragstart`/`dragover`/`drop` listeners that swap the two cells' content (and, for Promo Kit, remap the swapped `<craftools-element>`'s `w`/`h`/`x`/`y` attributes to fit the new slot size).

---

## The Three Rendering Modes

### 1. Normal Cells — `_renderNormalCells()`
Default mode when the template has neither `type: 'promo_kit'` nor `cellLines`/`cellColumns`. Builds one `.craftools-grid-cell` per item via the shared `_buildStripeContainer()` helper, appended directly into the CSS Grid container.

### 2. Promo Kit — `_renderPromoKit()`
Used when `template.type === 'promo_kit'`. Implements a **shelf bin-packing algorithm**: each entry in `template.cellSlots` becomes a rectangular "block" (its own mini CSS Grid of same-size cells); blocks are packed left-to-right and wrap to a new shelf (row) when they would overflow `availableW`. Cells within a block are draggable and droppable onto cells in *other* blocks of different sizes — on drop, the swapped `<craftools-element>` instances have their `pw`/`ph`/`px`/`py` (and the `w`/`h`/`x`/`y` attributes) recalculated to fit the target slot's dimensions, then a `craftools-element-change` event is dispatched.

### 3. Photostrips — `_renderPhotostripes()`
Used when `template.cellLines` or `template.cellColumns` is set. Each "stripe" is one `_buildStripeContainer()` instance (same outer container used by normal cells, so border/background/overlay styling is shared), with an absolutely-positioned `.photostrip-inner-grid` inserted between the content layer and the overlay layer. Each `.photostrip-slot` inside that inner grid is independently draggable; dropping one slot onto another swaps their content elements (excluding the slot's own drag-handle icon) directly, without touching the parent stripe.

---

## Shared Cell Structure — `_buildStripeContainer()`

Every cell or stripe, regardless of mode, is built by this shared private method and always has the same four layers stacked via absolute positioning:
- **`.cell-content-layer`** (`z-index: 1`) — background color/gradient/image and the actual tool content (or, for photostrips, the inner photo-slot grid).
- **`.photostrip-inner-grid`** — only present in photostrip mode, inserted between content and overlay layers.
- **`.cell-overlay-layer`** (`z-index: 4`, `pointer-events: none`) — an image overlay drawn on top of everything in the cell.
- **`.album-drag-handle`** / **`.cell-edit-btn`** — the drag handle (hidden in photostrip mode, since slots have their own) and a gear/settings icon that opens **`CellPanel`** (`craftools/tools/album/CellPanel.js`) for that specific cell.

Clicking anywhere on a cell's empty padding/gap area (outside a photo slot, drag handle, or edit button) also opens `CellPanel` for that cell. `CellPanel` exposes three tabs — Background, Overlay, and Border — and reads/writes its state via `craftools/tools/album/CellBackground.js`. Background and overlay images can be picked from the stock asset library through `craftools/tools/album/ApiPicker.js`, which queries the `craftools_api` backend (`/v1/?resource=assets|backgrounds|overlays`) and filters results by the caller's free/premium tier.

---

## Static Helpers

```javascript
Craftools_LayoutGrid.updateBorders(editor, width, style, color);
```
Updates the border width/style/color of every `.craftools-grid-cell` currently on the page (including stripes), and persists the new values as `data-*` attributes on every `.craftools-grid-container` so newly added pages keep the same border configuration.

---

## Summary (Applying SRP)

If you are writing a *new component* for CrafTools:
- **Do NOT** manually write `.cssText = "display: grid; ..."`
- **Do NOT** manually loop array slices or calculate "how many items fit a page".
- **Do NOT** track page creations individually for batch processes.
- **Do NOT** reimplement drag-and-drop swapping logic — Promo Kit and photostrip swapping is already handled generically inside `LayoutGrid.js`.

Gather your layout definitions (normal, Promo Kit, or photostrip shape) and the raw dataset array, instantiate `Craftools_LayoutGrid`, call `render()`, and use the provided inner DOM container callback to shape your specific visual outcome.
