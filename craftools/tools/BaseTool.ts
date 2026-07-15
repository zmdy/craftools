/**
 * BaseTool.ts — Abstract base class for all CrafTools tools (TypeScript version).
 *
 * Migration note:
 *   - Existing tools still import from 'BaseTool.js' (explicit extension) and
 *     are unaffected by this file.
 *   - New .ts tools import from 'BaseTool' (no extension) and get this file.
 *   - Once a tool is migrated to .ts, delete the old .js file and update its import.
 *
 * Contract:
 *   Every tool MUST implement `getPropertySchema()`.
 *   Tools MUST NOT override `renderPropertiesPanel()` — override the schema instead.
 *   Tools MAY override `_applyProperty()` for custom state-write logic.
 */

import type { PropertySchema } from '../types/PropertySchema';
import { PropertyRenderer } from '../utils/PropertyRenderer';

export abstract class BaseTool {
  // ── Schema contract ─────────────────────────────────────────────────────────

  /**
   * Returns the property panel descriptor for this tool.
   *
   * Called every time an element of this tool type is selected.
   * Must return a pure data structure — no DOM, no HTML strings.
   *
   * @param element - The selected canvas element. Use it to read current
   *                  state and conditionally show/hide fields.
   */
  static getPropertySchema(_element: HTMLElement): PropertySchema {
    // Subclasses must override this.
    return [];
  }

  // ── Rendering (do NOT override) ─────────────────────────────────────────────

  /**
   * Renders (or updates) the property panel.
   *
   * This is the final implementation — tools should not override it.
   * Override `getPropertySchema()` to change what appears in the panel.
   */
  static renderPropertiesPanel(container: HTMLElement, element: HTMLElement): void {
    // Prime dataset.ctState from existing DOM/meta state (first render only).
    this._syncFromDOM(element);
    const schema = this.getPropertySchema(element);
    PropertyRenderer.render(container, schema, element, (key, value) => {
      this._applyProperty(element, key, value);
    });
  }

  /**
   * Primes `dataset.ctState` from the element's existing DOM or meta state.
   *
   * Called once before the first panel render. Tools that store state outside
   * `dataset.ctState` (CSS styles, `_craftoolsMeta`, etc.) must override this
   * to populate the JSON state store so PropertyRenderer can read initial values.
   *
   * Only writes keys that are not already present — safe to call on re-renders.
   */
  protected static _syncFromDOM(_element: HTMLElement): void {
    // Default: no-op. Subclasses override as needed.
  }

  // ── State management ────────────────────────────────────────────────────────

  /**
   * Applies a single property change to the element.
   *
   * Default implementation writes to `data-ct-state` (JSON) and dispatches
   * `craftools-state-change`. Override for tools that need imperative DOM
   * mutations (e.g. SVG tools that must call `_render()` after each change).
   *
   * @param element - The canvas element to update.
   * @param key     - The field key from the schema.
   * @param value   - The new value from the field handler.
   */
  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
  }

  /**
   * Reads the current state object from the element.
   * Convenience wrapper around PropertyRenderer._readState().
   */
  protected static _readState(element: HTMLElement): Record<string, unknown> {
    return PropertyRenderer._readState(element);
  }

  // ── ToolRegistry integration ────────────────────────────────────────────────

  /**
   * The canvas element keys this tool handles (e.g. ['titulo', 'paragrafo']).
   *
   * Set by the tool's ToolRegistry.register() calls at the end of its file.
   * Used by CraftoolsConfig to resolve which registry entries to activate
   * when `tools: [TextTool]` is passed to the constructor.
   */
  static registeredKeys: string[] = [];
}
