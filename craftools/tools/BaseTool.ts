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
import { SnapEngine } from '../utils/SnapEngine.js';

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
  /**
   * Returns context-bar action descriptors for the selected element.
   * Override in tools that provide quick-action buttons (format, crop, etc.).
   */
  static getCtxOptions(_element?: HTMLElement): unknown[] {
    return [];
  }

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
    // 'pageAlign' (from CommonSchema.ts's pageAlignSection()) is a
    // fire-and-forget action, not a persisted property: it just re-runs
    // SnapEngine's page-alignment math against the element's current size.
    // Nothing to write to dataset.ctState for it.
    if (key === 'pageAlign') {
      SnapEngine.align(element, value as string);
      return;
    }

    // 'autoFit' (from CommonSchema.ts's sizePositionSection({ autoFit: true }))
    // toggles the `_craftoolsAutoResize` expando that AutoFitText.js and the
    // legacy panel already key off of (see CommonProperties.js's
    // _appendTamanho()) -- kept in sync here so any tool that spreads in
    // sizePositionSection() gets working W/H-disable-while-autofit behavior
    // for free, even without overriding _applyProperty(). Tools that also
    // need to trigger an immediate resize on toggle (e.g. TextTool) should
    // override _applyProperty() and call AutoFitText.applyAutoSize() there.
    if (key === 'autoFit') {
      (element as unknown as { _craftoolsAutoResize?: boolean })._craftoolsAutoResize = !!value;
    }

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
