# CrafTools — Dev Branch Refactor Plan

> **Scope:** TypeScript + Vite migration, schema-based property panel system, and composable tool registry.
> **Branch:** `dev`
> **Guiding principles:** DRY, Single Responsibility, Open/Closed, Separation of Concerns.

---

## 1. Why this refactor

### Current pain points

| Problem | Impact |
|---------|--------|
| Each of the 15 tools has `renderPropertiesPanel()` returning raw HTML strings | Adding a new layout (mobile overlay, floating toolbar, etc.) requires touching all 15 tools |
| `CommonProperties.js` (649 lines) duplicates section logic inside tool files | A change to "border radius" UI must be made in multiple places |
| Every property change calls `container.innerHTML = ...`, destroying focus and scroll position | Poor UX, especially on mobile |
| `Editor.js` hardcodes every tool import and every `case` statement | Adding or removing a tool requires editing the core editor |
| `Craftools` constructor has no config — it always boots with all tools and one fixed UI | Cannot create a lightweight embed with only specific tools |
| No types — DOM dataset juggling with no safety net | Bugs only surface at runtime |
| No build step — no tree-shaking, no aliasing, no env variables | Larger payloads, slower iteration |

### Root cause

Tools conflate **what** properties they have with **how** to render them:

```js
// Current — tool owns the layout HTML
static renderPropertiesPanel(container, element) {
    container.innerHTML = `
        <label>Font</label>
        <select id="text-prop-font">...</select>
        <label>Size</label>
        <input type="number" id="text-prop-size">
    `;
    // + 200 lines of event binding
}
```

The fix: tools describe their schema (data), a central renderer decides the layout (view).

---

## 2. Target architecture

```
Tool
 └── getPropertySchema()  →  PropertySchema (pure data, no HTML)
                                    │
                             PropertyRenderer
                                    │
                        ┌───────────┴───────────┐
                   SidebarUI             MobileSheetUI
               (current layout)       (future overlay)
```

Tools become **UI-agnostic**. Swapping the entire panel layout is a one-file change.

---

## 3. Phase 1 — TypeScript + Vite

### 3.1 Setup

```
craftools/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── craftools/
    └── (source files, renamed .ts incrementally)
```

**package.json** (minimal)

```json
{
  "name": "craftools",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "typescript": "^5.4",
    "vite": "^5.4"
  }
}
```

**tsconfig.json** — start permissive, tighten over time

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "checkJs": false,
    "strict": false,
    "noEmit": true,
    "paths": {
      "@tools/*": ["./craftools/tools/*"],
      "@utils/*": ["./craftools/utils/*"],
      "@settings/*": ["./craftools/settings/*"]
    }
  },
  "include": ["craftools/**/*", "index.html"]
}
```

> `allowJs: true` + `checkJs: false` means existing `.js` files keep working unchanged while `.ts` files are written alongside them. Enable `strict` incrementally per directory.

**vite.config.ts**

```ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@tools': resolve(__dirname, 'craftools/tools'),
      '@utils': resolve(__dirname, 'craftools/utils'),
      '@settings': resolve(__dirname, 'craftools/settings'),
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') }
    }
  }
});
```

### 3.2 Migration order (JS → TS)

Migrate bottom-up — utilities before tools, tools before the editor shell.

```
Priority 1 (no dependencies)
  settings/Translations.js
  utils/Notify.js
  utils/PanelUI.js
  utils/ShapeGenerator.js
  utils/MoonPhases.js

Priority 2 (depend on P1)
  utils/HistoryManager.js
  utils/SessionManager.js
  utils/AutoFitText.js
  utils/SnapEngine.js
  utils/CalendarRenderer.js

Priority 3 (core)
  components/Element.js
  utils/CommonProperties.js → split into CommonSchema.ts (see Phase 2)
  tools/BaseTool.js → BaseTool.ts (contracts added here)

Priority 4 (tools, one by one)
  Each tool file, starting with the simplest (Shape, Icon, QR Code)
  and ending with the most complex (Album, VariableContent)

Priority 5 (shell)
  components/Editor.js
  components/Setup.js
  craftools.js
  index.html script block → move to main.ts
```

---

## 4. Phase 2 — Schema-based property system

### 4.1 Core interfaces

`craftools/types/PropertySchema.ts`

```ts
// ── Field types ──────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'number'
  | 'color'
  | 'color-gradient'
  | 'toggle'
  | 'select'
  | 'align'
  | 'font-select'
  | 'slider'
  | 'textarea'
  | 'icon-picker'
  | 'image-upload'
  | 'divider'
  | 'custom';       // escape hatch: render function provided inline

export interface BaseField {
  type: FieldType;
  key: string;                 // maps to element dataset property
  label?: string;              // display label (i18n key or literal string)
  i18nKey?: string;            // explicit i18n key if label is a fallback
  hidden?: boolean | ((el: HTMLElement) => boolean);
  disabled?: boolean | ((el: HTMLElement) => boolean);
}

export interface NumberField extends BaseField {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;               // 'px', 'mm', '%' — displayed after input
}

export interface SelectField extends BaseField {
  type: 'select';
  options: Array<{ value: string; label: string }>;
}

export interface SliderField extends BaseField {
  type: 'slider';
  min: number;
  max: number;
  step?: number;
}

export interface CustomField extends BaseField {
  type: 'custom';
  render: (element: HTMLElement, onChange: () => void) => HTMLElement;
}

export type Field =
  | BaseField
  | NumberField
  | SelectField
  | SliderField
  | CustomField;

// ── Section ──────────────────────────────────────────────────────────────────

export interface Section {
  section: string;             // section title (i18n key or literal)
  i18nKey?: string;
  collapsible?: boolean;       // default true
  defaultOpen?: boolean;       // default false (except first section)
  fields: Field[];
}

// ── Schema ───────────────────────────────────────────────────────────────────

export type PropertySchema = Section[];
```

### 4.2 FieldRegistry — Open/Closed field type system

`craftools/utils/FieldRegistry.ts`

```ts
import type { Field } from '../types/PropertySchema';

interface FieldHandler {
  /** Renders the field HTML into the container. */
  render(container: HTMLElement, field: Field, value: unknown): void;
  /** Binds change events. Calls onChange(newValue) when the user interacts. */
  bind(container: HTMLElement, field: Field, onChange: (value: unknown) => void): void;
}

const registry = new Map<string, FieldHandler>();

export const FieldRegistry = {
  register(type: string, handler: FieldHandler): void {
    registry.set(type, handler);
  },

  get(type: string): FieldHandler | undefined {
    return registry.get(type);
  },

  has(type: string): boolean {
    return registry.has(type);
  }
};
```

Built-in field handlers are registered in `craftools/utils/fields/` — one file per type:

```
utils/fields/
  text.field.ts
  number.field.ts
  color.field.ts
  color-gradient.field.ts
  toggle.field.ts
  select.field.ts
  align.field.ts
  font-select.field.ts
  slider.field.ts
  divider.field.ts
  image-upload.field.ts
```

Each file self-registers:

```ts
// number.field.ts
import { FieldRegistry } from '../FieldRegistry';
import type { NumberField } from '../../types/PropertySchema';

FieldRegistry.register('number', {
  render(container, field: NumberField, value) {
    const f = field as NumberField;
    container.innerHTML = `
      <div class="ct-field-row">
        <label class="craftools-label">${f.label ?? ''}</label>
        <div class="ct-number-wrapper">
          <input type="number" class="craftools-input ct-field-input"
            data-key="${f.key}"
            value="${value ?? ''}"
            min="${f.min ?? ''}" max="${f.max ?? ''}" step="${f.step ?? 1}">
          ${f.unit ? `<span class="ct-unit">${f.unit}</span>` : ''}
        </div>
      </div>`;
  },
  bind(container, field, onChange) {
    container.querySelector<HTMLInputElement>('.ct-field-input')
      ?.addEventListener('input', e => onChange((e.target as HTMLInputElement).value));
  }
});
```

### 4.3 PropertyRenderer — the single rendering engine

`craftools/utils/PropertyRenderer.ts`

```ts
import type { PropertySchema, Section, Field } from '../types/PropertySchema';
import { FieldRegistry } from './FieldRegistry';

export class PropertyRenderer {
  /**
   * Renders a full property panel for an element based on its schema.
   * Only updates changed fields (diffed by key) to preserve focus/scroll.
   */
  static render(
    container: HTMLElement,
    schema: PropertySchema,
    element: HTMLElement,
    onChange: (key: string, value: unknown) => void
  ): void {
    schema.forEach(section => {
      this._renderSection(container, section, element, onChange);
    });
  }

  private static _renderSection(
    container: HTMLElement,
    section: Section,
    element: HTMLElement,
    onChange: (key: string, value: unknown) => void
  ): void {
    // Re-use existing section DOM node if already rendered (avoids full re-render)
    const sectionId = `ct-section-${section.section.replace(/\s+/g, '-').toLowerCase()}`;
    let sectionEl = container.querySelector<HTMLElement>(`#${sectionId}`);
    if (!sectionEl) {
      sectionEl = document.createElement('div');
      sectionEl.id = sectionId;
      sectionEl.className = 'ct-prop-section';
      container.appendChild(sectionEl);
    }

    section.fields.forEach(field => {
      this._renderField(sectionEl!, field, element, onChange);
    });
  }

  private static _renderField(
    sectionEl: HTMLElement,
    field: Field,
    element: HTMLElement,
    onChange: (key: string, value: unknown) => void
  ): void {
    const hidden = typeof field.hidden === 'function'
      ? field.hidden(element)
      : field.hidden;
    if (hidden) return;

    const handler = FieldRegistry.get(field.type);
    if (!handler) {
      console.warn(`[PropertyRenderer] Unknown field type: "${field.type}"`);
      return;
    }

    // Re-use existing field wrapper if it exists
    const fieldId = `ct-field-${field.key}`;
    let wrapper = sectionEl.querySelector<HTMLElement>(`#${fieldId}`);
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = fieldId;
      sectionEl.appendChild(wrapper);
      // Bind events once at creation time
      handler.bind(wrapper, field, (value) => onChange(field.key, value));
    }

    // Get current value from element state
    const state = element.dataset.ctState
      ? JSON.parse(element.dataset.ctState)
      : {};

    // Only re-render if the value changed (preserves focus)
    const currentValue = state[field.key];
    if (wrapper.dataset.renderedValue !== String(currentValue)) {
      handler.render(wrapper, field, currentValue);
      wrapper.dataset.renderedValue = String(currentValue);
    }
  }
}
```

> **Key DRY win:** `PropertyRenderer` is the only place that knows how to iterate sections and fields. Tools never call `innerHTML` directly.

### 4.4 Shared schema fragments — DRY for common sections

`craftools/utils/CommonSchema.ts`

```ts
import type { Section } from '../types/PropertySchema';

/** Border section — reused by all tools that support borders. */
export const borderSection = (targetSelector?: string): Section => ({
  section: 'Border',
  i18nKey: 'common.border',
  fields: [
    { type: 'number', key: 'borderWidth', label: 'Width', min: 0, max: 50, unit: 'px' },
    { type: 'color',  key: 'borderColor', label: 'Color' },
    { type: 'select', key: 'borderStyle', label: 'Style',
      options: [
        { value: 'solid',  label: 'Solid' },
        { value: 'dashed', label: 'Dashed' },
        { value: 'dotted', label: 'Dotted' },
      ]
    },
  ]
});

export const radiusSection = (): Section => ({
  section: 'Radius',
  i18nKey: 'common.radius',
  fields: [
    { type: 'slider', key: 'borderRadius', label: 'Radius', min: 0, max: 200 },
  ]
});

export const zIndexSection = (): Section => ({
  section: 'Layer',
  i18nKey: 'common.layer',
  fields: [
    { type: 'number', key: 'zIndex', label: 'Z-Index', min: 0, max: 9999 },
  ]
});

export const shadowSection = (): Section => ({
  section: 'Shadow',
  i18nKey: 'common.shadow',
  fields: [
    { type: 'toggle', key: 'shadowEnabled', label: 'Enable shadow' },
    { type: 'number', key: 'shadowX',     label: 'X',    unit: 'px' },
    { type: 'number', key: 'shadowY',     label: 'Y',    unit: 'px' },
    { type: 'number', key: 'shadowBlur',  label: 'Blur', unit: 'px', min: 0 },
    { type: 'color',  key: 'shadowColor', label: 'Color' },
  ]
});

export const alignSection = (): Section => ({
  section: 'Alignment',
  i18nKey: 'common.alignment',
  fields: [
    { type: 'align', key: 'textAlign', label: 'Align' },
  ]
});

export const opacitySection = (): Section => ({
  section: 'Opacity',
  i18nKey: 'common.opacity',
  fields: [
    { type: 'slider', key: 'opacity', label: 'Opacity', min: 0, max: 1 },
  ]
});
```

### 4.5 BaseTool contract

`craftools/tools/BaseTool.ts`

```ts
import type { PropertySchema } from '../types/PropertySchema';
import { PropertyRenderer } from '../utils/PropertyRenderer';

export abstract class BaseTool {
  /**
   * Returns the property schema for this tool.
   * Override in every subclass.
   */
  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [];
  }

  /**
   * Renders the property panel using the schema.
   * Tools should NOT override this — override getPropertySchema() instead.
   */
  static renderPropertiesPanel(container: HTMLElement, element: HTMLElement): void {
    const schema = this.getPropertySchema(element);
    PropertyRenderer.render(container, schema, element, (key, value) => {
      this._applyProperty(element, key, value);
    });
  }

  /**
   * Applies a single property change to the element.
   * Tools can override for custom apply logic.
   */
  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    const state = element.dataset.ctState
      ? JSON.parse(element.dataset.ctState)
      : {};
    state[key] = value;
    element.dataset.ctState = JSON.stringify(state);
    element.dispatchEvent(new CustomEvent('craftools-state-change', {
      bubbles: true,
      detail: { key, value }
    }));
  }
}
```

### 4.6 Tool implementation example

`craftools/tools/text/TextTool.ts`

```ts
import { BaseTool } from '../BaseTool';
import type { PropertySchema } from '../../types/PropertySchema';
import { borderSection, zIndexSection } from '../../utils/CommonSchema';

export class TextTool extends BaseTool {
  static getPropertySchema(element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Typography',
        i18nKey: 'textTool.typography',
        defaultOpen: true,
        fields: [
          { type: 'font-select', key: 'font',      label: 'Font' },
          { type: 'number',      key: 'fontSize',  label: 'Size', min: 6, max: 200, unit: 'px' },
          { type: 'number',      key: 'lineHeight', label: 'Line height', min: 1, max: 4, step: 0.1 },
          { type: 'align',       key: 'textAlign' },
          { type: 'toggle',      key: 'bold',      label: 'Bold' },
          { type: 'toggle',      key: 'italic',    label: 'Italic' },
          { type: 'toggle',      key: 'underline', label: 'Underline' },
        ]
      },
      {
        section: 'Color',
        i18nKey: 'textTool.color',
        fields: [
          { type: 'color',          key: 'color',     label: 'Color' },
          { type: 'color-gradient', key: 'gradient',  label: 'Gradient' },
        ]
      },
      {
        section: 'Auto-fit',
        i18nKey: 'textTool.autofit',
        fields: [
          { type: 'toggle', key: 'autoFit', label: 'Auto-fit to content' },
        ]
      },
      borderSection(),
      zIndexSection(),
    ];
  }
}
```

**Before:** 576 lines of HTML string + event binding.
**After:** ~50 lines of declarative schema. Zero HTML in the tool file.

---

## 5. ToolRegistry — composable tool instances

### 5.1 The problem with the current Editor

`Editor.js` today hardcodes every tool:

```js
// Editor.js — tightly coupled
import { TextTool }  from '../tools/text/TextTool.js';
import { ImageTool } from '../tools/image/ImageTool.js';
// ... 13 more imports

switch (toolKey) {
  case 'titulo': TextTool.renderPropertiesPanel(...); break;
  case 'imagem': ImageTool.renderPropertiesPanel(...); break;
  // ... 13 more cases
}
```

Adding a tool means editing the core editor. Removing a tool (for a lightweight embed) is impossible without forking the file.

### 5.2 ToolRegistry

`craftools/utils/ToolRegistry.ts`

```ts
import type { BaseTool } from '../tools/BaseTool';

export interface ToolDefinition {
  key: string;                    // canvas element key, e.g. 'titulo', 'imagem'
  label: string;                  // i18n key or literal string shown in sidebar
  icon: string;                   // Material Symbol name
  tool: typeof BaseTool;          // the tool class
  draggable?: boolean;            // can be dragged from sidebar to canvas
  showInFooterNav?: boolean;      // appears in the mobile bottom bar
  category?: string;              // sidebar section grouping
}

const registry = new Map<string, ToolDefinition>();

export const ToolRegistry = {
  register(def: ToolDefinition): void {
    registry.set(def.key, def);
  },

  get(key: string): ToolDefinition | undefined {
    return registry.get(key);
  },

  all(): ToolDefinition[] {
    return [...registry.values()];
  },

  /** Returns only the tools in the given key list, in that order. */
  subset(keys: string[]): ToolDefinition[] {
    return keys.map(k => registry.get(k)).filter((d): d is ToolDefinition => !!d);
  },

  has(key: string): boolean {
    return registry.has(key);
  }
};
```

### 5.3 Self-registration pattern

Each tool registers itself at the end of its own file. The Editor and Craftools core never need to know about it in advance:

```ts
// TextTool.ts — end of file
import { ToolRegistry } from '../../utils/ToolRegistry';

ToolRegistry.register({
  key:             'titulo',
  label:           'editor.toolTitle',
  icon:            'title',
  tool:            TextTool,
  draggable:       true,
  showInFooterNav: true,
  category:        'text',
});

ToolRegistry.register({
  key:             'paragrafo',
  label:           'editor.text',
  icon:            'notes',
  tool:            TextTool,        // same class, different key
  draggable:       true,
  showInFooterNav: true,
  category:        'text',
});
```

> **DRY note:** tools with multiple element types (like TextTool handling both `titulo` and `paragrafo`) register once per key but point to the same class.

### 5.4 Craftools constructor with config

`craftools/craftools.ts`

```ts
export interface CraftoolsConfig {
  /** Tools to include. If omitted, all registered tools are used. */
  tools?: (typeof BaseTool)[];

  /** UI driver class. Defaults to the standard sidebar layout. */
  ui?: typeof BaseUI;
}

export class Craftools {
  constructor(wrapper: string | HTMLElement, config: CraftoolsConfig = {}) {
    // If a tool list is provided, restrict the registry to only those tools
    if (config.tools) {
      // Importing a tool file triggers its ToolRegistry.register() call.
      // The subset filter ensures the Editor only sees the declared tools.
      this._activeTools = ToolRegistry.subset(
        config.tools.flatMap(t => t.registeredKeys ?? [])
      );
    } else {
      this._activeTools = ToolRegistry.all();
    }

    this._ui = config.ui ?? StandardSidebarUI;
    // ... rest of init
  }
}
```

### 5.5 Editor becomes tool-agnostic

The Editor no longer imports any tool directly. It reads from the active tool list at runtime:

```ts
// Editor.ts — no tool imports, no switch statements
import { ToolRegistry } from '../utils/ToolRegistry';
import { PropertyRenderer } from '../utils/PropertyRenderer';

class Craftools_Editor extends HTMLElement {
  _handleElementSelect(element: HTMLElement) {
    const key   = element.dataset.craftool;
    const def   = ToolRegistry.get(key);
    if (!def) return;

    const schema = def.tool.getPropertySchema(element);
    PropertyRenderer.render(this._panel, schema, element, (k, v) => {
      def.tool._applyProperty(element, k, v);
    });
  }

  _buildSidebar() {
    // Sidebar items are generated dynamically from the active tool list
    ToolRegistry.all().forEach(def => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="#" data-tool="${def.key}">
        <span class="material-symbols-outlined">${def.icon}</span>
        <span data-i18n="${def.label}">${def.label}</span>
      </a>`;
      this._sidebarList.appendChild(li);
    });
  }
}
```

### 5.6 Composable instances

```ts
// Full instance — all tools, standard UI
import './craftools/tools'; // barrel that imports all tools (triggers all registrations)
new Craftools('#wrapper');

// Text-only embed with a custom UI
import { TextTool } from '@tools/text/TextTool'; // self-registers 'titulo' and 'paragrafo'
import { InlineTextUI } from './my-embed/InlineTextUI';

new Craftools('#text-embed', {
  tools: [TextTool],
  ui:    InlineTextUI,
});

// Album studio — only image/album tools
import { AlbumTool }   from '@tools/album/AlbumTool';
import { ImageTool }   from '@tools/image/ImageTool';
import { GeradorTool } from '@tools/gerador/GeradorTool';

new Craftools('#album-studio', {
  tools: [AlbumTool, ImageTool, GeradorTool],
});
```

Because Vite only bundles what is imported, the text-only embed ships **zero album/calendar/QR code code**. Tree-shaking works automatically.

### 5.7 BaseUI — swappable layout contract

```ts
// craftools/ui/BaseUI.ts
export abstract class BaseUI {
  abstract buildShell(wrapper: HTMLElement, tools: ToolDefinition[]): void;
  abstract showPropertiesPanel(schema: PropertySchema, element: HTMLElement): void;
  abstract hidePropertiesPanel(): void;
  abstract showToolPicker(): void;
}
```

Implementing a new UI (e.g. the `ui3.html` overlay concept) means creating one class that extends `BaseUI` — no tool files or editor core touched.

---

## 6. Migration strategy (updated)

### Strangler fig — never break the running app

```
Step 1: Add Vite + TS pipeline (allowJs: true, checkJs: false)
        → existing .js files run unchanged under Vite

Step 2: Write core types and registries
        → PropertySchema.ts (interfaces)
        → FieldRegistry.ts (empty map, no handlers yet)
        → ToolRegistry.ts  (empty map, no tools yet)
        → BaseUI.ts        (abstract contract)
        → no existing code changes

Step 3: Implement PropertyRenderer
        → tested in isolation, not wired to tools yet

Step 4: Write all field handlers in utils/fields/
        → each registers itself in FieldRegistry
        → unit-testable pure functions

Step 5: Migrate tools one by one (simplest first)
        → each tool gets getPropertySchema() + ToolRegistry.register()
        → renderPropertiesPanel() becomes a one-liner: PropertyRenderer.render(...)

Step 6: Migrate Editor.js → Editor.ts
        → remove all tool imports and switch statements
        → read from ToolRegistry at runtime
        → _buildSidebar() generated from ToolRegistry.all()

Step 7: Migrate Craftools constructor to accept CraftoolsConfig
        → tools?: [], ui?: BaseUI
        → StandardSidebarUI extracted as the default BaseUI implementation

Step 8: Delete old HTML-rendering code from each tool after verification

Step 9: Enable TypeScript strict mode per directory
```

### Tool migration order (effort estimate)

| Tool | Complexity | Estimated fields |
|------|-----------|-----------------|
| QRCodeTool | Low | ~8 |
| BarcodeT ool | Low | ~6 |
| ShapeTool | Low | ~10 |
| IconTool | Low | ~8 |
| EmojiTool | Low | ~2 |
| TextoCurvoTool | Medium | ~12 |
| CarimboTool | Medium | ~14 |
| MiniCalendarTool | Medium | ~10 |
| CalendarTool | Medium | ~14 |
| PaperTool | Medium | ~10 |
| TextTool | High | ~20 |
| ImageTool | High | ~22 |
| EmojiKitchenTool | High | ~12 |
| VariableContentTool | High | ~18 |
| AlbumTool | Very High | ~30 |

---

## 7. File structure after migration

```
craftools/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
│
├── craftools/
│   ├── craftools.ts              # VERSION + Craftools class (accepts CraftoolsConfig)
│   ├── craftools.css
│   │
│   ├── types/
│   │   ├── PropertySchema.ts     # Field, Section, PropertySchema interfaces
│   │   └── ToolDefinition.ts     # ToolDefinition, CraftoolsConfig interfaces
│   │
│   ├── settings/
│   │   ├── Translations.ts
│   │   └── Settings.ts
│   │
│   ├── components/
│   │   ├── Editor.ts             # tool-agnostic; reads from ToolRegistry at runtime
│   │   ├── Element.ts
│   │   ├── Setup.ts
│   │   └── CtFontSelect.ts
│   │
│   ├── ui/
│   │   ├── BaseUI.ts             # abstract UI contract
│   │   ├── StandardSidebarUI.ts  # current sidebar layout (default)
│   │   └── (future UIs here)
│   │
│   ├── tools/
│   │   ├── BaseTool.ts           # getPropertySchema() contract + _applyProperty()
│   │   ├── index.ts              # barrel: imports all tools (triggers all registrations)
│   │   ├── text/TextTool.ts      # + ToolRegistry.register('titulo'), .register('paragrafo')
│   │   ├── image/ImageTool.ts    # + ToolRegistry.register('imagem')
│   │   └── ...                   # every tool self-registers
│   │
│   └── utils/
│       ├── ToolRegistry.ts       # key → ToolDefinition map
│       ├── PropertyRenderer.ts   # the only place that renders panel HTML
│       ├── FieldRegistry.ts      # field type → handler map
│       ├── CommonSchema.ts       # shared section fragments (DRY)
│       ├── HistoryManager.ts
│       ├── SessionManager.ts
│       ├── SnapEngine.ts
│       └── fields/               # one file per field type; each self-registers
│           ├── text.field.ts
│           ├── number.field.ts
│           ├── color.field.ts
│           ├── color-gradient.field.ts
│           ├── toggle.field.ts
│           ├── select.field.ts
│           ├── align.field.ts
│           ├── font-select.field.ts
│           ├── slider.field.ts
│           └── divider.field.ts
```

---

## 8. How new UIs and instances consume the system

### New layout — zero tool changes

```ts
// Mobile overlay panel (future UI)
import { MobilePropertyRenderer } from '@utils/MobilePropertyRenderer';

// Same schema from the tool, different renderer
const schema = ToolRegistry.get('titulo')!.tool.getPropertySchema(element);
MobilePropertyRenderer.render(overlayContainer, schema, element, onChange);
```

```ts
// Floating context toolbar — only fields marked showInContextBar: true
import { ContextBarRenderer } from '@utils/ContextBarRenderer';
ContextBarRenderer.render(ctxBarEl, schema, element, onChange);
```

Both renderers are new files. No tool file is touched.

### Composable instances — tree-shaking included

```ts
// Full instance — all tools, standard sidebar UI
import './craftools/tools';   // barrel triggers all ToolRegistry.register() calls
new Craftools('#wrapper');

// Text-only embed
import { TextTool } from '@tools/text/TextTool';   // self-registers 'titulo', 'paragrafo'
new Craftools('#embed', { tools: [TextTool] });

// Album studio
import { AlbumTool }   from '@tools/album/AlbumTool';
import { ImageTool }   from '@tools/image/ImageTool';
import { GeradorTool } from '@tools/gerador/GeradorTool';
new Craftools('#studio', { tools: [AlbumTool, ImageTool, GeradorTool] });
```

Vite only bundles what is imported. A text-only embed ships zero album/calendar/QR code code.

---

## 9. Risk assessment

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Some tools have complex imperative logic that doesn't map to a schema | Medium | Use `type: 'custom'` field with a render function as escape hatch; migrate iteratively |
| Album tool has deeply nested cell/grid interactions | High | Migrate Album last; keep its legacy `renderPropertiesPanel()` longer |
| Vite build breaks CDN-loaded html2canvas (lazy import) | Low | Keep dynamic import; Vite handles it natively |
| TypeScript strict mode reveals hidden bugs | Medium | Enable per directory, not globally — turn on `checkJs` after all files are `.ts` |
| Team unfamiliar with Vite aliases breaking existing relative imports | Low | Keep `allowJs` + run both old paths and new aliases side by side during transition |

---

## 10. What NOT to do

- **Do not rewrite the canvas engine.** `Craftools_Element` drag/resize/rotate is battle-tested. Only the panel layer changes.
- **Do not add React or Vue.** The schema system achieves the same decoupling with zero framework dependency. If a reactive layer is needed for panels later, adopt Lit (5 KB) — it wraps Custom Elements directly.
- **Do not migrate all tools at once.** Each tool migration is an independent PR: schema + field handlers + tests.
- **Do not enable TypeScript `strict` globally on day 1.** Enable it per directory as files are migrated.

---

## 11. Definition of done

- [x] `npm run dev` serves the app with Vite HMR
- [x] `npm run build` produces a `dist/` with a working minified bundle
- [x] `PropertyRenderer`, `FieldRegistry`, and all built-in field handlers exist
- [x] `ToolRegistry` exists; all 19 tools self-register via `ToolRegistry.register()`
- [x] `Editor.ts` contains zero static tool imports and zero `switch`/`case` on tool keys
- [x] `Craftools` constructor accepts `{ tools?, ui? }` config (`craftools.ts` created)
- [x] `BaseUI.ts` abstract contract defined; `StandardSidebarUI.ts` implements it as the default
- [x] `CommonSchema.ts` exports: `borderSection`, `radiusSection`, `zIndexSection`, `shadowSection`, `alignSection`, `opacitySection`
- [x] All 19 tools migrated to `getPropertySchema()` + `ToolRegistry.register()`
- [x] `BaseTool.ts` enforces the schema contract via abstract method
- [x] No tool file contains a raw HTML string longer than 5 lines
- [x] `main.ts` entry point created (replaces inline `<script>` block in index.html)
- [x] `tools/index.ts` barrel created (single import activates all tool registrations)
- [ ] Existing functionality (drag, resize, export, undo/redo, session save) unchanged after migration  _(manual smoke-test pending)_

---

_Created: 2026-07-15 — Branch: dev_
