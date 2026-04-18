# CrafTools Grid Utility Documentation

## Overview
The `Craftools_Grid` utility is a highly modular, decoupled class responsible for building and managing layout grids dynamically across editor pages. Built following the Single Responsibility Principle (SRP), this class does not dictate *what* content goes inside the cells (e.g., images, texts, or shapes). Instead, its sole purpose is to calculate measurements, build the CSS Grid, assign the correct mathematical gaps/margins, and automatically generate extra pages if the layout elements overflow a single page.

Additionally, it automatically wraps each built layout into a drag-and-drop sortable instance (using Sortable.js), enabling users to easily reorder cells via visual interaction.

---

## File Location
`craftools/utils/Grid.js`

---

## The Template Structure
Before initializing the grid, you need to provide a `template` object that determines the physics and spacing of the CSS Grid matrix. These are typically maintained in `craftools/utils/GridSizes.js`.

### Template Object Example
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

---

## Class Instantiation

To use the tool within a plugin or feature (like the `AlbumTool.js`), import and instantiate `Craftools_Grid`:

```javascript
import { Craftools_Grid } from "../utils/Grid.js";

const gridSystem = new Craftools_Grid(editor, startPage, pageSize, template);
```

### Constructor Parameters
1. **`editor`** *(HTMLElement)*: The primary wrapper/context for the Editor Application (usually `this` or the `<craftools-editor>` element context). Used as an anchor to fetch zoom parameters or access DOM wrappers.
2. **`startPage`** *(HTMLElement)*: The target `.craftools-page` Node object where the grid should start drawing. 
3. **`pageSize`** *(Object)*: From `Settings.js`. Needs to provide `.sizeUnit` (e.g., `"mm"`) and `.size` string (e.g., `"210,297"`).
4. **`template`** *(Object)*: The grid dimension descriptor (documented above).

---

## The `render()` Method

The true power of the `Craftools_Grid` relies on the asynchronous `.render(items, callback)` function.

```javascript
// Example array of internal datasets
const myPhotosList = ["base64Data1", "base64Data2", "base64Data3..."];

await gridSystem.render(myPhotosList, (cellContainer, currentPhotoData, absoluteIndex) => {
    // Modify CSS for the blank bounding box
    cellContainer.style.background = "#fff";
    cellContainer.style.border = "1px dashed #ccc";

    // Inject your application logic safely
    let imgEl = document.createElement('div');
    imgEl.style.backgroundImage = `url(${currentPhotoData})`;
    
    // Append your component context into the cell wrapper
    cellContainer.appendChild(imgEl);
});
```

### How `render()` operates:

1. **Dimensional Calculation**: Based on the `pageSize` format, it creates a conversion multiplier (e.g., mapping Millimeters to UI pixels based on standards). 
2. **Pagination Math**: Divides the available inner boundings (`pageW - pageMarginL - pageMarginR`) by the cell metrics (`cellW + gap` and `cellH + gap`) to accurately deduce **Columns** and **Rows**.
3. **Array Chunking**: Maps through the provided `items` array. Once `Items Rendered` surpasses `Cols * Rows` (Page Capacity Limit), it interacts with `PageTool.addNewPage()` logically copying the previous page layer, and cleanly inserts a brand new blank Canvas, seamlessly continuing the drawing process.
4. **Grid Mounting**: Creates the background physical constraints appending `class="craftools-grid-cell"` bounding boxes.
5. **Data Delegation**: The internal execution loops through the chunk and fires your arbitrary anonymous callback, isolating and delegating HTML logic entirely to the caller script safely.
6. **Sortable Injection**: Imports the Sortable.js chunk globally, hooks it specifically onto `class="craftools-grid-container"`, and empowers smooth grabbing, sorting, and shifting interactions between sibling layouts across visual elements.

---

## Summary (Applying SRP)

If you are writing a *new component* for CrafTools:
- **Do NOT** manually write `.cssText = "display: grid; ..."`
- **Do NOT** manually loop array slices or calculate "how many items fit a page".
- **DO NOT** track page creations individually for batch processes.

Gather your layout definitions and the raw dataset array, instantiate `Craftools_Grid`, call `render()`, and use the provided inner DOM container callback to shape your specific visual outcome.
