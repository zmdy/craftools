/**
 * PropertyRenderer — the single engine that renders property panels.
 *
 * Takes a PropertySchema returned by a tool and renders (or updates) the UI
 * inside a container element. This is the ONLY place in the codebase that
 * produces panel HTML. Tools never call innerHTML or create DOM nodes directly.
 *
 * Design:
 *  - Sections and field wrappers are created once and reused across re-renders.
 *  - Field values are diffed: render() is only called when the value changes,
 *    which preserves focus state and avoids unnecessary reflows.
 *  - Events are bound once at field creation time (not on every re-render).
 */

import type { PropertySchema, Section, Field } from '../types/PropertySchema';
import { FieldRegistry } from './FieldRegistry';
import { tr } from './i18nLabel';

export class PropertyRenderer {
  /**
   * Renders (or updates) a full property panel inside `container`.
   *
   * Safe to call repeatedly — only changed fields are re-rendered.
   * The container is NOT cleared between calls; missing sections are appended,
   * existing ones are updated in-place.
   *
   * @param container  The panel root element.
   * @param schema     The schema returned by the tool's getPropertySchema().
   * @param element    The selected canvas element.
   * @param onChange   Called with (key, value) on every user interaction.
   */
  static render(
    container: HTMLElement,
    schema: PropertySchema,
    element: HTMLElement,
    onChange: (key: string, value: unknown) => void,
  ): void {
    // Parse element state once per render call
    const state = PropertyRenderer._readState(element);

    schema.forEach((section, index) => {
      PropertyRenderer._renderSection(container, section, index === 0, element, state, onChange);
    });
  }

  /**
   * Renders a single section's fields directly into `container` — no accordion
   * wrapper. Used by MobileToolbar mini-panels to show one section at a time.
   *
   * Safe to call repeatedly; values are diffed like `render()`.
   *
   * @param container  The panel container to render fields into.
   * @param section    A single section from the tool's PropertySchema.
   * @param element    The selected canvas element.
   * @param onChange   Called with (key, value) on every user interaction.
   */
  static renderSectionFields(
    container: HTMLElement,
    section: Section,
    element: HTMLElement,
    onChange: (key: string, value: unknown) => void,
  ): void {
    const state = PropertyRenderer._readState(element);
    section.fields.forEach(field => {
      PropertyRenderer._renderField(container, field, element, state, onChange);
    });
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private static _renderSection(
    container: HTMLElement,
    section: Section,
    isFirst: boolean,
    element: HTMLElement,
    state: Record<string, unknown>,
    onChange: (key: string, value: unknown) => void,
  ): void {
    const sectionId = `ct-section-${PropertyRenderer._slug(section.section)}`;
    let sectionEl = container.querySelector<HTMLElement>(`[data-ct-section="${sectionId}"]`);

    if (!sectionEl) {
      sectionEl = PropertyRenderer._createSectionEl(section, sectionId, isFirst);
      container.appendChild(sectionEl);
      // Bind accordion toggle once at creation
      PropertyRenderer._bindAccordion(sectionEl);
    }

    const bodyEl = sectionEl.querySelector<HTMLElement>('.ct-accordion-content');
    if (!bodyEl) return;

    section.fields.forEach(field => {
      PropertyRenderer._renderField(bodyEl, field, element, state, onChange);
    });
  }

  private static _createSectionEl(section: Section, sectionId: string, isFirst: boolean): HTMLElement {
    const collapsible = section.collapsible !== false;
    // Only the first section opens automatically -- several tools' schemas
    // mark more than one section `defaultOpen: true` (e.g. TextTool.ts's
    // Text AND Color sections, ShapeTool.ts's first two), which used to open
    // all of them simultaneously on selection. `defaultOpen: true` is now a
    // no-op (every tool's actual first section already opens via `isFirst`);
    // `defaultOpen: false` is still honored so a tool can force a section
    // closed even if schema ordering ever made it first. Users can still
    // expand any other section by hand -- this only changes the default.
    const open = section.defaultOpen === false ? false : isFirst;

    const el = document.createElement('div');
    el.className    = `ct-accordion${open ? ' open' : ''}`;
    el.dataset.ctSection = sectionId;

    // Icon span mirrors PanelUI.accordion()'s markup exactly (same
    // ct-accordion-icon class) so panels built by PropertyRenderer look
    // identical to the still-legacy panel-only tools (Album, Agenda, etc.)
    // Falls back to a generic icon rather than omitting the span, so a
    // schema that hasn't been given a real icon yet still lines up visually.
    const iconHtml = `
          <span class="ct-accordion-icon">
            <span class="material-symbols-outlined">${section.icon || 'tune'}</span>
          </span>`;

    const title = tr(section.i18nKey, section.section);

    if (collapsible) {
      el.innerHTML = `
        <button class="ct-accordion-header" type="button" data-toggle-accordion="${sectionId}">${iconHtml}
          <span class="ct-accordion-title">${title}</span>
          <span class="ct-accordion-chevron">
            <span class="material-symbols-outlined">expand_more</span>
          </span>
        </button>
        <div class="ct-accordion-body">
          <div class="ct-accordion-content"></div>
        </div>`;
    } else {
      // Non-collapsible: always visible
      el.innerHTML = `
        <div class="ct-accordion-body" style="display:block;">
          <div class="ct-accordion-content"></div>
        </div>`;
    }

    return el;
  }

  private static _bindAccordion(sectionEl: HTMLElement): void {
    const btn = sectionEl.querySelector<HTMLElement>('[data-toggle-accordion]');
    if (!btn) return;

    btn.addEventListener('click', () => {
      sectionEl.classList.toggle('open');
    });
  }

  private static _renderField(
    bodyEl: HTMLElement,
    field: Field,
    element: HTMLElement,
    state: Record<string, unknown>,
    onChange: (key: string, value: unknown) => void,
  ): void {
    // Evaluate hidden condition
    const hidden = typeof field.hidden === 'function' ? field.hidden(element) : field.hidden;
    if (hidden) return;

    const handler = FieldRegistry.get(field.type);
    if (!handler) {
      console.warn(`[PropertyRenderer] No handler for field type: "${field.type}"`);
      return;
    }

    const fieldId = `ct-field-${field.key}`;
    let wrapper = bodyEl.querySelector<HTMLElement>(`[data-ct-field="${fieldId}"]`);

    // Most fields watch a single state key (field.key). A field can opt
    // into watching several at once via `watchKeys` (see
    // fields/font-style.field.ts) -- its rendered value becomes an ARRAY
    // in the same order as watchKeys, and the diff below re-renders if ANY
    // watched key changed, not just field.key.
    const watchKeys   = field.watchKeys ?? [field.key];
    const readValue   = (): unknown => watchKeys.length > 1 ? watchKeys.map(k => state[k]) : state[field.key];
    const serialize   = (v: unknown): string => Array.isArray(v) ? JSON.stringify(v) : String(v ?? '');

    if (!wrapper) {
      // First creation: render structure, then bind events
      wrapper = document.createElement('div');
      wrapper.dataset.ctField = fieldId;
      bodyEl.appendChild(wrapper);

      const currentValue = readValue();
      handler.render(wrapper, field, currentValue, element);
      // keyOverride lets a multi-key field route a change to a state key
      // OTHER than field.key -- see FieldRegistry.ts's bind() doc comment.
      handler.bind(wrapper, field, (value, keyOverride) => onChange(keyOverride ?? field.key, value), element);
      wrapper.dataset.renderedValue = serialize(currentValue);
    } else {
      // Update: only re-render if value changed (preserves focus)
      const currentValue = readValue();
      const rendered     = wrapper.dataset.renderedValue;
      if (rendered !== serialize(currentValue)) {
        handler.render(wrapper, field, currentValue, element);
        wrapper.dataset.renderedValue = serialize(currentValue);
      }
    }

    // Apply disabled state
    const disabled = typeof field.disabled === 'function' ? field.disabled(element) : field.disabled;
    wrapper.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
      'input, select, textarea, button',
    ).forEach(el => { el.disabled = !!disabled; });
  }

  // ── State helpers ───────────────────────────────────────────────────────────

  /** Reads the element state from data-ct-state (JSON). */
  static _readState(element: HTMLElement): Record<string, unknown> {
    try {
      return element.dataset.ctState ? JSON.parse(element.dataset.ctState) : {};
    } catch {
      return {};
    }
  }

  /** Writes a single key back to data-ct-state and dispatches a change event. */
  static applyChange(element: HTMLElement, key: string, value: unknown): void {
    const state = PropertyRenderer._readState(element);
    state[key] = value;
    element.dataset.ctState = JSON.stringify(state);
    element.dispatchEvent(
      new CustomEvent('craftools-state-change', { bubbles: true, detail: { key, value } }),
    );
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  private static _slug(text: string): string {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
}
