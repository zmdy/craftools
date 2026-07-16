/**
 * PanelUI — Design System helper for the CrafTools side-panel.
 *
 * Provides accordion building blocks, field helpers and the one-open-at-a-time
 * toggle logic so every tool produces a consistent, organised UI with minimal
 * boilerplate.
 *
 * Usage (inside renderPropertiesPanel):
 *   import { PanelUI } from '../../utils/PanelUI.js';
 *
 *   const html = PanelUI.accordion('mySection', 'palette', 'Título', bodyHtml, { open: true });
 *   editorPanel.innerHTML = html;
 *   PanelUI.bindAccordions(editorPanel);
 */

/** Options for a single pill button in a pill group. */
export interface PillOption {
  value: string;
  icon?: string;
  label?: string;
}

/** Options for PanelUI.accordion(). */
export interface AccordionOptions {
  open?: boolean;
}

export class PanelUI {

  // ───────────────────────────────────────────────────────────────────────────
  // Accordion
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Renders a single collapsible accordion section.
   *
   * @param id       - Unique identifier (used for data-attribute matching)
   * @param icon     - Material Symbols icon name
   * @param title    - Section title shown in the header
   * @param bodyHtml - Raw HTML placed inside the accordion body
   * @param options  - { open } Whether the section starts expanded (default false)
   * @returns HTML string
   */
  static accordion(
    id: string,
    icon: string,
    title: string,
    bodyHtml: string,
    { open = false }: AccordionOptions = {},
  ): string {
    return `
      <div class="ct-accordion${open ? ' open' : ''}" data-accordion-id="${id}">
        <button class="ct-accordion-header" type="button" data-toggle-accordion="${id}">
          <span class="ct-accordion-icon">
            <span class="material-symbols-outlined">${icon}</span>
          </span>
          <span class="ct-accordion-title">${title}</span>
          <span class="ct-accordion-chevron">
            <span class="material-symbols-outlined">expand_more</span>
          </span>
        </button>
        <div class="ct-accordion-body">
          <div class="ct-accordion-content">
            ${bodyHtml}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Binds the one-open-at-a-time accordion toggle logic to all accordion
   * headers inside the given container element.
   *
   * Call this ONCE after setting innerHTML or appending the accordion HTML.
   *
   * Uses `data-accordion-bound` to guard against double-binding when called
   * more than once on the same container (e.g. ImageTool appends an extra
   * accordion asynchronously and re-calls bindAccordions).
   *
   * @param container - The panel body (or any wrapper containing
   *   [data-toggle-accordion] buttons)
   */
  static bindAccordions(container: HTMLElement): void {
    container
      .querySelectorAll<HTMLElement>('[data-toggle-accordion]:not([data-accordion-bound])')
      .forEach(btn => {
        btn.dataset.accordionBound = '1';
        btn.addEventListener('click', () => {
          const id = btn.dataset.toggleAccordion;
          const accordion = container.querySelector<HTMLElement>(
            `.ct-accordion[data-accordion-id="${id}"]`,
          );
          if (!accordion) return;

          const isOpen = accordion.classList.contains('open');

          // Close all other accordions in the same container
          container.querySelectorAll('.ct-accordion.open').forEach(a => {
            if (a !== accordion) a.classList.remove('open');
          });

          // Toggle this one
          accordion.classList.toggle('open', !isOpen);
        });
      });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Field helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Wraps content in a labelled field row.
   *
   * @param sublabel    - Small uppercase label text (pass '' to omit)
   * @param icon        - Material icon name for the label (pass '' to omit)
   * @param contentHtml - HTML for the field body
   */
  static field(sublabel: string, icon: string, contentHtml: string): string {
    const labelHtml = sublabel
      ? `<div class="ct-sublabel">${icon ? `<span class="material-symbols-outlined">${icon}</span>` : ''}${sublabel}</div>`
      : '';
    return `<div class="ct-field">${labelHtml}${contentHtml}</div>`;
  }

  /**
   * Renders a range slider with an inline value badge.
   *
   * @param id    - Input element ID
   * @param min
   * @param max
   * @param step
   * @param value - Initial value
   * @param unit  - Unit suffix appended to the badge (e.g. 'px', '%', '°')
   */
  static slider(
    id: string,
    min: number,
    max: number,
    step: number,
    value: number,
    unit = '',
  ): string {
    return `
      <div class="ct-field-row">
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" style="flex:1;">
        <span class="ct-val-badge" id="${id}-val">${value}${unit}</span>
      </div>
    `;
  }

  /**
   * Binds a slider input to its corresponding value badge and fires a callback.
   *
   * @param container - Element containing the slider
   * @param id        - ID of the `<input type="range">`
   * @param unit      - Unit suffix appended to the displayed value
   * @param onInput   - Called with the numeric value on each input event
   */
  static bindSlider(
    container: HTMLElement,
    id: string,
    unit: string,
    onInput: (value: number) => void,
  ): void {
    const slider = container.querySelector<HTMLInputElement>(`#${id}`);
    const badge  = container.querySelector<HTMLElement>(`#${id}-val`);
    if (!slider) return;

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      if (badge) badge.textContent = val + unit;
      onInput(val);
    });
  }

  /**
   * Builds a horizontal row of pill toggle buttons.
   *
   * @param groupId - Data-group identifier shared by all buttons in the group
   * @param options - Array of { value, icon?, label? }
   * @param active  - Currently active value
   */
  static pillGroup(groupId: string, options: PillOption[], active: string): string {
    return `
      <div class="ct-field-row" data-pill-group="${groupId}" style="flex-wrap:wrap; gap:4px;">
        ${options.map(o => `
          <button class="craftools-pill ct-pill-opt ${o.value === active ? 'active' : ''}"
            type="button" data-pill-group="${groupId}" data-value="${o.value}"
            style="flex:1; justify-content:center; gap:4px; min-width:0;"
            title="${o.label ?? o.value}">
            ${o.icon ? `<span class="material-symbols-outlined" style="font-size:13px;">${o.icon}</span>` : ''}
            ${o.label ? `<span style="font-size:10px;">${o.label}</span>` : ''}
          </button>
        `).join('')}
      </div>
    `;
  }

  /**
   * Binds pill-group toggle (single selection, updates `.active` class).
   *
   * @param container - Element containing the pill buttons
   * @param groupId   - Data-group identifier
   * @param onChange  - Called with the selected value string
   */
  static bindPillGroup(
    container: HTMLElement,
    groupId: string,
    onChange: (value: string) => void,
  ): void {
    container
      .querySelectorAll<HTMLElement>(`[data-pill-group="${groupId}"][data-value]`)
      .forEach(btn => {
        btn.addEventListener('click', () => {
          container
            .querySelectorAll(`[data-pill-group="${groupId}"][data-value]`)
            .forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const value = btn.dataset.value;
          if (value !== undefined) onChange(value);
        });
      });
  }
}
