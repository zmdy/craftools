# CrafTools: Architecture Overview

This document provides a comprehensive mapping of the CrafTools visual editor's file structure, architectural patterns, and execution flow. CrafTools is designed as a modular, vanilla JavaScript WYSIWYG editor using modern Web Components and the Single Responsibility Principle (SRP).

## Project Structure

\`\`\`text
craftools/
├── craftools.js          # App entry point — boots Setup/Editor and registers Custom Elements
│
├── components/            # Core Custom Elements (Web Components)
│   ├── Editor.js          # The main board orchestrator and Event Hub
│   ├── Element.js         # The draggable/resizable/rotatable physics wrapper for ALL tools
│   └── Setup.js           # First-run / project-setup screen (page size, orientation, etc.)
│
├── settings/              # Global configurations & Systems
│   ├── Settings.js        # App states, themes, standard document sizes
│   └── Translations.js    # I18n class and centralized translation injector
│
├── utils/                 # Cross-tool utilities
│   ├── CtxBar.js           # Floating contextual toolbar (z-index actions, duplicate element)
│   ├── LayoutGrid.js       # Craftools_LayoutGrid — renders/paginates normal, Promo Kit and photostrip layouts (see Grid_Utility.md)
│   ├── GridSizes.js        # Local fallback catalog of grid/album templates (A4, 10x15, polaroids, promo kits, photostrips, etc.)
│   ├── ApiDataLoader.js    # Fetches grid sizes / album templates from craftools_api, with timeout + local-fallback caching
│   ├── CommonProperties.js # Shared renderBorder/renderBorderRadius/renderPadding/renderZIndex helpers used by every tool's properties panel
│   ├── HistoryManager.js   # Singleton undo/redo manager (HTML snapshot based, capped history depth)
│   ├── SessionManager.js   # Singleton autosave + crash-recovery manager (localStorage-backed)
│   ├── PdfExport.js        # Flattens Web Components to static HTML and triggers the browser print dialog for PDF export
│   └── MobileToolbar.js    # Full mobile-only (≤768px) contextual toolbar + floating mini-panels UX layer
│
└── tools/                 # Modular tool features (isolated per folder)
    ├── BaseTool.js         # Shared base class: common properties rendering + global copy/paste-style clipboard
    │
    ├── page/
    │   ├── PageTool.js     # Handles page background, margins, pagination, and drop zones
    │   └── PageTool_Translations.js
    │
    ├── text/
    │   ├── TextTool.js     # Handles rich text, fonts, alignments, and text shadows
    │   └── TextTool_Translations.js
    │
    ├── image/
    │   ├── ImageTool.js           # Bootstraps image UI and orchestrates image sub-modules
    │   ├── ImageFilters.js        # Deals strictly with CSS brightness/contrast/hue parsing
    │   ├── ImageTransform.js      # Complex interactions (pan, zoom via scroll, rotation)
    │   └── ImageTool_Translations.js
    │
    └── album/
        ├── AlbumTool.js           # Album/business-card setup panel + generation logic, bridges into LayoutGrid
        ├── CellPanel.js           # Per-cell properties panel (Background / Overlay / Border tabs)
        ├── CellBackground.js      # applyBackground/applyOverlay state helpers, propagates to linked business-card clones
        ├── ApiPicker.js           # Stock-asset picker modal (queries craftools_api, free/premium tier filtering)
        └── AlbumTool_Translations.js
\`\`\`

---

## Core Mechanics & Execution Flow

### 1. Element Wrapper (\`Craftools_Element\`)
Every tool (Text, Image) dragged onto a page is automatically wrapped in a custom `<craftools-element>`.
- **Purpose**: It centralizes the complexity of drag-and-drop, bounding boxes, resizing, and rotation handles.
- **Layers**: It creates an \`_overlay\` layer on top of the content to intercept mouse events. When double-clicked (edit mode), the overlay is disabled, allowing the user to interact with the underlying content (e.g., typing in a text block, panning an image).
- **Deselect**: When focus is lost, \`Element.js\` resets all layers, safely bringing the protective drag overlay back up.

### 2. The Editor Hub (\`Editor.js\`)
The Editor acts as the event listener and state manager.
- It listens for \`craftools-element-select\` and \`craftools-element-deselect\`.
- When an element is selected, \`Editor.js\` inspects the \`data-craftool\` attribute and delegates the rendering of the right-hand **Properties Panel** to the respective \`Tool.js\` file by calling \`Tool.renderPropertiesPanel()\`.
- It hooks up the \`CtxBar\` with the tools contextual options via \`Tool.getCtxOptions()\`.

### 3. I18n (Internationalization)
Rather than having a massive single translation file, CrafTools uses decentralized translation injection.
- Each tool has its own \`_Translations.js\` file.
- The translations are injected into the global \`I18n\` class using \`I18n.addTranslations('namespace', { ... })\`.
- The UI fetches strings using \`I18n.t('namespace.key')\`.

### 4. Layout Grid System
Used primarily by the Album tool, \`LayoutGrid.js\` (class \`Craftools_LayoutGrid\`) dynamically calculates how many cells can fit on a \`PageTool\` given specific margins, sizes, and templates.
- It creates and paginates multiple pages if the dataset (like an array of photos) exceeds a single page.
- It actually supports three distinct layout shapes, not just a uniform grid: plain cells (Native CSS Grid), **Promo Kit** mixed-size layouts (a custom shelf bin-packing algorithm placing differently-sized print groups on the same sheet), and **photostrips** (a stripe container holding an inner sub-grid of individually reorderable photo slots). See \`Grid_Utility.md\` for the full breakdown of all three modes.
- Each cell/stripe carries a settings icon that opens \`CellPanel.js\` for per-cell background, overlay, and border configuration, including picking stock images from the \`craftools_api\` asset library via \`ApiPicker.js\`.

### 5. Tool Inheritance (\`BaseTool\`) & Shared Properties
Every concrete tool (Text, Image, Album) inherits common behavior from \`tools/BaseTool.js\` rather than re-implementing it:
- **\`renderCommonProperties()\`** delegates border, border-radius, padding, and z-index UI to the static helpers in \`utils/CommonProperties.js\`, so every tool's properties panel stays visually and behaviorally consistent.
- **Copy/Paste Styles**: a single global clipboard, \`window.__craftoolsClipboardStyle\`, lets a user copy a style from one element and paste it onto another compatible element type. This clipboard is in-memory and per-session only (it does not persist across reloads or become a reusable named "kit").

### 6. History & Session (Undo/Redo, Autosave, Crash Recovery)
Two singletons in \`utils/\` manage the editor's resilience:
- **\`HistoryManager.js\`** implements undo/redo by snapshotting the raw HTML of \`#pages-wrapper\` on every change, capped at a fixed maximum number of states (older states are discarded), with redo-branch invalidation whenever a new action is taken after an undo. It dispatches \`craftools-history-change\` / \`craftools-history-restored\` events so toolbar buttons (desktop header and the PWA shell's undo/redo icons) can stay in sync.
- **\`SessionManager.js\`** autosaves the current project to \`localStorage\` on an interval whenever the document is marked dirty (with a short debounce), and warns the user via the native \`beforeunload\` prompt before they navigate away with unsaved changes. On the next load, a recovery modal offers to restore the last autosaved session. This persistence is local-device only — there is no account system or cloud sync backing it (see "Known Gaps" below).

### 7. PDF Export
\`utils/PdfExport.js\` is responsible for turning the live, editable Web Component tree into a printable document:
- It **flattens** every \`<craftools-element>\` into plain \`<div class="ct-el">\`/\`<div class="ct-el-inner">\` markup, stripping editor-only UI (ctrlbars, drag handles, edit buttons) so only the visual content remains.
- It serializes each page into a standalone HTML document (a \`blob:\` URL), with one \`@page\` CSS rule generated per unique page size used in the project.
- The actual file generation is delegated to the browser's native print dialog (\`window.print()\`) on that document — there is no embedded PDF-generation library (no jsPDF, pdf-lib, or server-side rendering). This means there is currently no batch/multi-project export, no guaranteed pixel-perfect output across browsers/printers, and export can silently fail to open if the browser blocks the pop-up (handled today with a fallback \`alert()\`).

### 8. Mobile UX Layer (\`MobileToolbar\`)
\`utils/MobileToolbar.js\` is a self-contained, Canva-style adaptive UI layer that activates only when \`window.innerWidth <= 768\`. It is not a re-skin of the desktop UI — it replaces the bottom footer with two states: a tool-creation bar (Title/Text/Image/Album/New Page/PDF/Papers) and, once an element is selected, a contextual property bar with buttons specific to that element's type (e.g. images get Photo/Adjust/Filters/Fit/Border/Rounding/Layer/Copy; text gets Font/Size/Color/Align/Border/Padding/Layer/Copy). Each button opens a floating, touch-friendly "mini-panel" with sliders, color pickers, and pill-button groups, reusing \`CommonProperties\`, \`ImageFilters\`, and \`ImageTransform\` under the hood.

### 9. Backend Integration (\`craftools_api\`)
The grid/album templates and the stock background/overlay image library are not fully bundled with the frontend. \`utils/ApiDataLoader.js\` fetches grid sizes and album templates from the \`craftools_api\` PHP backend (\`/v1/?resource=grid-sizes\` and \`/v1/?resource=album-templates\`) with an in-memory cache and a short request timeout, falling back to the local catalog in \`GridSizes.js\` if the API is unreachable (there is no local fallback for album templates — an unreachable API returns an empty list there). \`tools/album/ApiPicker.js\` similarly queries \`/v1/?resource=assets|backgrounds|overlays\` for the stock image picker, and the backend filters every result server-side by the caller's free/premium tier — the frontend never has to (and cannot) self-report a higher tier than its token actually grants.

---

## Third-Party Dependencies

All third-party frontend code is vendored via npm and bundled by Vite into `dist/assets/` at build time — nothing is fetched from a third-party CDN at runtime:

- **Bootstrap 5.3.8 (CSS + JS bundle)** — real npm dependency (`node_modules/bootstrap`). The CSS stays a plain `<link>` in `index.html` (now pointing at the local `node_modules` copy instead of a CDN URL) rather than a JS import, because its cascade position relative to `vendor/pwa-template/style.css` and `craftools/craftools.css` is load-bearing (see the CSS-order comment in `index.html`) and importing it from JS would let Vite's bundler reorder it. The JS bundle is a normal side-effect import in `main.ts`. CSS utility classes (`container`, `d-flex`, `btn`, `d-none`, plus the color utilities used by the PWA-vs-CrafTools adaptation block) are genuinely used; the JS bundle (Popper + Bootstrap components) currently isn't (no `data-bs-*` attributes or component calls anywhere — the sidebar/offcanvas toggle is CrafTools' own JS) but is kept in case modals/dropdowns/tooltips are adopted later.
- **SortableJS** and **html2canvas** — real npm dependencies, imported directly where used (`utils/LayoutGrid.ts` for grid drag-reorder, `utils/ImageExport.ts` for PNG/JPG page export). Previously loaded on-demand from jsDelivr/cdnjs via a runtime-injected `<script>` tag; now bundled like everything else.
- **`craftools/vendor/qrcode-generator/*.mjs`** — the QR code encoder, kept as local vendor `.mjs` files (not an npm package) and imported normally in `utils/QrCode.ts`; already bundled by Vite the same way.
- **`craftools/vendor/pwa-template/style.css`** — the only third-party asset kept as a local file rather than an npm package, because it isn't a public library: it's the proprietary shell CSS of the "Affan - PWA Mobile HTML Template" (DesigningWorld) — `.header-area`, `.footer-nav`, `.sidenav-wrapper`, `.offcanvas`, `.page-content-wrapper`, light/dark theme variables — recolored for the CrafTools brand via the inline `<style>` block at the top of `index.html`. It no longer `@import`s anything: the unused plugin imports (apexcharts, nice-select2, rangeslider, tabler-icons, tiny-slider, vanilla-dataTables, venobox — confirmed zero usage anywhere in the codebase) and an unused Google Fonts import were removed, and its header comment was trimmed (see `HTML_Assets_Plan.md` for the full history).

`craftools/vendor/bootstrap/` and `craftools/vendor/pwa-template/assets/` still exist on disk (leftovers from an earlier, unrelated CDN migration that this environment couldn't delete) but are gitignored and unused — do not reference them. `node_modules/bootstrap`, `node_modules/sortablejs`, and `node_modules/html2canvas` are the real, current sources for those three libraries.

## Known Gaps (as of the latest source review)
- **Not actually a PWA yet**: despite the project's name and a roadmap item marked done, there is no \`manifest.json\` and no service worker anywhere in the codebase. What exists today is a mobile-first responsive layout, not an installable/offline-capable PWA.
- **No end-user accounts**: \`SessionManager\` is local-device/\`localStorage\`-only, and there is no login system for end users in the frontend (token-based API access is provisioned by an admin in \`craftools_api\`, not self-served).
- **Documentation lag**: this file and \`Grid_Utility.md\` had fallen behind the actual code for some time (wrong file/class names, several modules — \`BaseTool\`, \`CellPanel\`, \`ApiPicker\`, \`CellBackground\`, \`PdfExport\`, \`ApiDataLoader\`, \`HistoryManager\`, \`SessionManager\`, \`MobileToolbar\` — were entirely unmentioned). Keep this section's "Project Structure" tree in sync whenever a new top-level file is added to \`utils/\`, \`tools/\`, or \`components/\`.

---

## Adding a New Tool

To add a new tool (e.g., "Shapes"):
1. Create \`tools/shape/ShapeTool.js\` and \`ShapeTool_Translations.js\`.
2. Expose \`createElement()\`, \`getCtxOptions()\`, and \`renderPropertiesPanel()\`.
3. Add drop support for the new \`ToolType\` identifier in \`PageTool.js\`.
4. Add sidebar logic in \`Editor.js\` if the tool deserves its own distinct Property Panel logic.
