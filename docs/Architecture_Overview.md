# CrafTools: Architecture Overview

This document provides a comprehensive mapping of the CrafTools visual editor's file structure, architectural patterns, and execution flow. CrafTools is designed as a modular, vanilla JavaScript WYSIWYG editor using modern Web Components and the Single Responsibility Principle (SRP).

## Project Structure

\`\`\`text
craftools/
├── components/           # Core Custom Elements (Web Components)
│   ├── Editor.js         # The main board orchestrator and Event Hub
│   └── Element.js        # The draggable/resizable physics wrapper for ALL tools
│
├── settings/             # Global configurations & Systems
│   ├── Settings.js       # App states, themes, standard document sizes
│   └── Translations.js   # I18n class and centralized translation injector
│
├── utils/                # Cross-tool utilities
│   ├── CtxBar.js         # The floating action bar attached to active elements
│   ├── LayoutGrid.js     # Class for rendering and paginating CSS Grid layouts (e.g. Albums)
│   └── GridSizes.js      # Configuration matrix for grid templates (A4, 10x15, polaroids, etc.)
│
└── tools/                # Modular tool features (Isolated per folder)
    ├── page/
    │   ├── PageTool.js   # Handles page background, margins, and drop zones
    │   └── PageTool_Translations.js
    │
    ├── text/
    │   ├── TextTool.js   # Handles rich text, fonts, alignments, and text shadows
    │   └── TextTool_Translations.js
    │
    ├── image/
    │   ├── ImageTool.js          # Bootstraps image UI and orchestrates image sub-modules
    │   ├── ImageFilters.js       # Deals strictly with CSS brightness/contrast/hue parsing
    │   ├── ImageTransform.js     # Complex interactions (Pan, zoom via scroll, rotation)
    │   └── ImageTool_Translations.js
    │
    └── album/
        ├── AlbumTool.js          # Grid image builder, bridges KITS logic into LayoutGrid
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
Used primarily by tools like "Album" or future "Papers", \`LayoutGrid.js\` dynamically calculates how many cells can fit on a \`PageTool\` given specific margins, sizes, and templates.
- It creates and paginates multiple pages if the dataset (like an array of photos) exceeds a single page.
- It uses Native CSS Grid (rather than absolute positioning per inner element) to provide a responsive and export-friendly structure. 

---

## Adding a New Tool

To add a new tool (e.g., "Shapes"):
1. Create \`tools/shape/ShapeTool.js\` and \`ShapeTool_Translations.js\`.
2. Expose \`createElement()\`, \`getCtxOptions()\`, and \`renderPropertiesPanel()\`.
3. Add drop support for the new \`ToolType\` identifier in \`PageTool.js\`.
4. Add sidebar logic in \`Editor.js\` if the tool deserves its own distinct Property Panel logic.
