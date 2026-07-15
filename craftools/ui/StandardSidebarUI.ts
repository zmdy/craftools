/**
 * StandardSidebarUI.ts — Default UI layout for CrafTools.
 *
 * This is the "strangler-fig" implementation of BaseUI: it delegates to the
 * existing static HTML sidebar that is already in index.html instead of
 * generating its own DOM. The sidebar, canvas area, and toolbar are already
 * rendered by the Craftools_Setup and Craftools_Editor custom elements.
 *
 * Purpose in Phase 2:
 *   - Satisfies the BaseUI contract so Craftools.ts can accept `ui?: typeof BaseUI`.
 *   - Provides a concrete default without touching the static HTML yet.
 *   - A future MobileSheetUI or OverlayUI can be swapped in via CraftoolsConfig.
 *
 * When to replace this stub:
 *   Phase 3 (or whenever the sidebar is fully driven from ToolRegistry) —
 *   override buildShell() to generate sidebar items from the `tools` argument
 *   instead of relying on hardcoded HTML.
 */

import { BaseUI } from './BaseUI';
import type { PropertySchema } from '../types/PropertySchema';
import { PropertyRenderer } from '../utils/PropertyRenderer';
import type { ToolDefinition } from '../utils/ToolRegistry';

export class StandardSidebarUI extends BaseUI {
  /** The element that hosts the properties panel (right sidebar body). */
  private _panelBody: HTMLElement | null = null;

  // ── BaseUI contract ───────────────────────────────────────────────────────

  /**
   * Phase 2 stub: the shell is already rendered by static HTML + custom elements.
   * `tools` is accepted so the signature matches BaseUI, but is unused until
   * Phase 3 makes the sidebar fully dynamic.
   */
  buildShell(_tools: ToolDefinition[]): void {
    // The wrapper's innerHTML is managed by Craftools_Setup / Craftools_Editor.
    // Nothing to do here until the sidebar is generated from the registry.
  }

  /**
   * Renders the properties panel for the selected element.
   * Finds the existing #panel-body (or craftools-editor's panel slot) and
   * delegates to PropertyRenderer.
   */
  showPropertiesPanel(
    schema: PropertySchema,
    element: HTMLElement,
    onChange: (key: string, value: unknown) => void,
  ): void {
    const container = this._getPanelBody();
    if (!container) return;
    PropertyRenderer.render(container, schema, element, onChange);
  }

  /**
   * Clears the properties panel when no element is selected.
   */
  hidePropertiesPanel(): void {
    const container = this._getPanelBody();
    if (container) container.innerHTML = '';
  }

  /**
   * Phase 2 stub: the tool picker (sidebar) is controlled by Craftools_Editor.
   * Override in a future UI that manages its own drawer/sheet.
   */
  showToolPicker(): void {
    // Delegate to the existing craftools-editor toggle button if present.
    const editorEl = document.querySelector<HTMLElement>('craftools-editor');
    const toggle   = editorEl?.shadowRoot?.querySelector<HTMLElement>('[data-panel-toggle]')
                  ?? document.querySelector<HTMLElement>('[data-panel-toggle]');
    if (toggle) toggle.click();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Lazily resolves the panel body container.
   * Checks the shadow root of craftools-editor first, then falls back to
   * the light DOM `#panel-body` used by the current static HTML.
   */
  private _getPanelBody(): HTMLElement | null {
    if (this._panelBody && this._panelBody.isConnected) {
      return this._panelBody;
    }

    // Try the custom element's shadow root first
    const editorEl = this.wrapper.querySelector('craftools-editor');
    if (editorEl?.shadowRoot) {
      this._panelBody = editorEl.shadowRoot.querySelector<HTMLElement>('#panel-body');
      if (this._panelBody) return this._panelBody;
    }

    // Fall back to light DOM (current static HTML layout)
    this._panelBody = this.wrapper.querySelector<HTMLElement>('#panel-body')
                   ?? document.querySelector<HTMLElement>('#panel-body');
    return this._panelBody;
  }
}
