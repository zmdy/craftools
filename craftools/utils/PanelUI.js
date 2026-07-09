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
export class PanelUI {

    // ─────────────────────────────────────────────────────────────────────────
    // Accordion
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Renders a single collapsible accordion section.
     *
     * @param {string}  id       Unique identifier (used for data-attribute matching)
     * @param {string}  icon     Material Symbols icon name
     * @param {string}  title    Section title shown in the header
     * @param {string}  bodyHtml Raw HTML placed inside the accordion body
     * @param {boolean} [open]   Whether the section starts expanded (default false)
     * @returns {string} HTML string
     */
    static accordion(id, icon, title, bodyHtml, { open = false } = {}) {
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
     * @param {HTMLElement} container  The panel body (or any wrapper that
     *   contains [data-toggle-accordion] buttons)
     */
    static bindAccordions(container) {
        // :not([data-accordion-bound]) evita duplo-bind quando bindAccordions é chamado
        // mais de uma vez no mesmo container (ex: ImageTool adiciona o accordion
        // "Fundo & Overlay" de forma assíncrona e chama bindAccordions novamente).
        // Sem esse guard, cada clique disparava dois listeners — o accordion abria
        // e fechava instantaneamente, parecendo que não funcionava.
        container.querySelectorAll('[data-toggle-accordion]:not([data-accordion-bound])').forEach(btn => {
            btn.dataset.accordionBound = '1';
            btn.addEventListener('click', () => {
                const id = btn.dataset.toggleAccordion;
                const accordion = container.querySelector(`.ct-accordion[data-accordion-id="${id}"]`);
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

    // ─────────────────────────────────────────────────────────────────────────
    // Field helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Wraps content in a labelled field row.
     *
     * @param {string} sublabel    Small uppercase label text (pass '' to omit)
     * @param {string} icon        Material icon name for the label (pass '' to omit)
     * @param {string} contentHtml HTML for the field body
     * @returns {string}
     */
    static field(sublabel, icon, contentHtml) {
        const labelHtml = sublabel
            ? `<div class="ct-sublabel">${icon ? `<span class="material-symbols-outlined">${icon}</span>` : ''}${sublabel}</div>`
            : '';
        return `<div class="ct-field">${labelHtml}${contentHtml}</div>`;
    }

    /**
     * Renders a range slider with an inline value badge.
     *
     * @param {string} id    Input element ID
     * @param {number} min
     * @param {number} max
     * @param {number} step
     * @param {number} value Initial value
     * @param {string} [unit] Unit suffix appended to the badge (e.g. 'px', '%', '°')
     * @returns {string}
     */
    static slider(id, min, max, step, value, unit = '') {
        return `
            <div class="ct-field-row">
                <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" style="flex:1;">
                <span class="ct-val-badge" id="${id}-val">${value}${unit}</span>
            </div>
        `;
    }

    /**
     * Helper: bind a slider and its corresponding value badge.
     * Also fires an optional onChange callback.
     *
     * @param {HTMLElement} container
     * @param {string}      id
     * @param {string}      unit
     * @param {Function}    onInput   Called with (numericValue) on each input event
     */
    static bindSlider(container, id, unit, onInput) {
        const slider = container.querySelector(`#${id}`);
        const badge  = container.querySelector(`#${id}-val`);
        if (!slider) return;

        slider.addEventListener('input', () => {
            const val = parseFloat(slider.value);
            if (badge) badge.textContent = val + unit;
            if (onInput) onInput(val);
        });
    }

    /**
     * Builds a horizontal row of pill toggle buttons.
     *
     * @param {string}            groupId   Data-group identifier for the group
     * @param {Array<{value, icon?, label}>} options
     * @param {string}            active    Currently active value
     * @returns {string}
     */
    static pillGroup(groupId, options, active) {
        return `
            <div class="ct-field-row" data-pill-group="${groupId}" style="flex-wrap:wrap; gap:4px;">
                ${options.map(o => `
                    <button class="craftools-pill ct-pill-opt ${o.value === active ? 'active' : ''}"
                        type="button" data-pill-group="${groupId}" data-value="${o.value}"
                        style="flex:1; justify-content:center; gap:4px; min-width:0;"
                        title="${o.label || o.value}">
                        ${o.icon ? `<span class="material-symbols-outlined" style="font-size:13px;">${o.icon}</span>` : ''}
                        ${o.label ? `<span style="font-size:10px;">${o.label}</span>` : ''}
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Bind pill-group toggle (single selection, updates .active class).
     *
     * @param {HTMLElement} container
     * @param {string}      groupId
     * @param {Function}    onChange  Called with (selectedValue)
     */
    static bindPillGroup(container, groupId, onChange) {
        container.querySelectorAll(`[data-pill-group="${groupId}"][data-value]`).forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll(`[data-pill-group="${groupId}"][data-value]`)
                    .forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (onChange) onChange(btn.dataset.value);
            });
        });
    }
}
