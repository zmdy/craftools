import { I18n } from "../settings/Translations.js";
import { PanelUI } from "./PanelUI.js";
import { SnapEngine } from "./SnapEngine.js";

/**
 * CommonProperties — Standard accordion sections shared by all CrafTools tools.
 *
 * Three canonical sections:
 *   • Forma   — border, border-radius, padding, margin (visual shape)
 *   • Tamanho — width, height, x, y, z-index  (size & position)
 *   • Estilo  — copy / paste styles
 *
 * Each section is rendered as a ct-accordion via PanelUI.accordion().
 * Call renderBaseAccordions() from BaseTool to append all three at once.
 */
export class CommonProperties {

    // ─────────────────────────────────────────────────────────────────────────
    // Public API  —  called by BaseTool
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Renders the three standard base accordions (Forma, Tamanho, Estilo)
     * and appends them to the given container.
     *
     * @param {HTMLElement} container      Root element of the panel (the tool's outer div)
     * @param {HTMLElement} element        The selected craftools-element
     * @param {Object}      config         { border, radius, padding, margin, zindex, onChange }
     *                                     Each is either a CSS selector string for the inner
     *                                     target, or `true` to target `element` directly.
     *                                     Omit / set falsy to skip that control.
     */
    static renderBaseAccordions(container, element, config = {}) {
        // --- Alinhamento ---
        this._appendAlinhamento(container, element, config);

        // --- Forma ---
        this._appendForma(container, element, config);

        // --- Tamanho ---
        this._appendTamanho(container, element, config);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Alinhamento — compact button bar (not an accordion)
    // ─────────────────────────────────────────────────────────────────────────

    static _appendAlinhamento(container, element, config) {
        const btn = (dir, icon, title) =>
            `<button class="craftools-icon-btn ct-align-btn" data-align="${dir}" title="${title}" type="button"
                style="flex:1; padding:5px 0; display:flex; align-items:center; justify-content:center; border-radius:6px;">
                <span class="material-symbols-outlined" style="font-size:16px;">${icon}</span>
            </button>`;

        const html = `
            <div class="ct-align-bar" style="padding:8px 10px 4px;">
                <div style="font-size:10px; font-weight:600; color:var(--text-muted); text-transform:uppercase;
                            letter-spacing:.05em; margin-bottom:6px; display:flex; align-items:center; gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:12px;">align_horizontal_left</span>
                    ${I18n.t('common.align') || 'Alinhar na página'}
                </div>
                <div style="display:flex; gap:4px; margin-bottom:4px;">
                    ${btn('left',     'align_horizontal_left',   I18n.t('common.alignLeft')     || 'Alinhar à esquerda')}
                    ${btn('center-h', 'align_horizontal_center', I18n.t('common.alignCenterH')  || 'Centralizar horizontalmente')}
                    ${btn('right',    'align_horizontal_right',  I18n.t('common.alignRight')    || 'Alinhar à direita')}
                </div>
                <div style="display:flex; gap:4px;">
                    ${btn('top',      'align_vertical_top',      I18n.t('common.alignTop')      || 'Alinhar no topo')}
                    ${btn('center-v', 'align_vertical_center',   I18n.t('common.alignCenterV')  || 'Centralizar verticalmente')}
                    ${btn('bottom',   'align_vertical_bottom',   I18n.t('common.alignBottom')   || 'Alinhar na base')}
                </div>
            </div>
        `;

        const bar = document.createElement('div');
        bar.innerHTML = html;
        container.appendChild(bar.firstElementChild);

        container.querySelector('.ct-align-bar')?.querySelectorAll('.ct-align-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                SnapEngine.align(element, btn.dataset.align);
                if (config.onChange) config.onChange();
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Forma (Shape) accordion
    // ─────────────────────────────────────────────────────────────────────────

    static _appendForma(container, element, config) {
        const target = this._resolveTarget(element, config.border || config.radius || config.padding || config.margin);
        if (!target) return;

        // ── Border ──────────────────────────────────────
        const bWidth  = parseFloat(target.style.borderWidth)  || 0;
        const bStyle  = target.style.borderStyle  || 'none';
        const bColor  = this._rgbToHex(target.style.borderColor) || '#000000';

        const borderHtml = `
            <div class="ct-field">
                <div class="ct-sublabel"><span class="material-symbols-outlined">border_style</span>${I18n.t('common.border')}</div>
                <div class="ct-field-row" style="margin-bottom:6px;">
                    <input type="number" id="cp-border-w" class="craftools-input" value="${bWidth}" min="0" max="40"
                        style="width:56px; flex-shrink:0;" title="${I18n.t('common.borderWidth')}">
                    <select id="cp-border-style" class="craftools-select" style="flex:1;">
                        <option value="none"   ${bStyle==='none'   ?'selected':''}>— ${I18n.t('common.borderNone')}</option>
                        <option value="solid"  ${bStyle==='solid'  ?'selected':''}>${I18n.t('common.borderSolid')}</option>
                        <option value="dashed" ${bStyle==='dashed' ?'selected':''}>${I18n.t('common.borderDashed')}</option>
                        <option value="dotted" ${bStyle==='dotted' ?'selected':''}>${I18n.t('common.borderDotted')}</option>
                    </select>
                    <input type="color" id="cp-border-color" class="craftools-color-swatch" value="${bColor}" title="${I18n.t('common.borderColor')}">
                </div>
            </div>
        `;

        // ── Border Radius ────────────────────────────────
        const radiusTarget = this._resolveTarget(element, config.radius || config.border);
        const radParts = (radiusTarget?.style.borderRadius || '0px').split(' ');
        const [rtl, rtr, rbr, rbl] = [
            parseFloat(radParts[0]) || 0,
            parseFloat(radParts[1] ?? radParts[0]) || 0,
            parseFloat(radParts[2] ?? radParts[0]) || 0,
            parseFloat(radParts[3] ?? radParts[1] ?? radParts[0]) || 0,
        ];

        const radiusHtml = `
            <div class="ct-field">
                <div class="ct-sublabel"><span class="material-symbols-outlined">rounded_corner</span>${I18n.t('common.radius')}</div>
                <div class="ct-field-grid4">
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <span class="material-symbols-outlined" style="font-size:11px;color:var(--text-muted);">&#xe920;</span>
                        <input type="number" id="cp-rad-tl" class="craftools-input" value="${rtl}" min="0" style="text-align:center;padding:4px;">
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <span class="material-symbols-outlined" style="font-size:11px;color:var(--text-muted);transform:rotate(90deg);">&#xe920;</span>
                        <input type="number" id="cp-rad-tr" class="craftools-input" value="${rtr}" min="0" style="text-align:center;padding:4px;">
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <span class="material-symbols-outlined" style="font-size:11px;color:var(--text-muted);transform:rotate(270deg);">&#xe920;</span>
                        <input type="number" id="cp-rad-bl" class="craftools-input" value="${rbl}" min="0" style="text-align:center;padding:4px;">
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <span class="material-symbols-outlined" style="font-size:11px;color:var(--text-muted);transform:rotate(180deg);">&#xe920;</span>
                        <input type="number" id="cp-rad-br" class="craftools-input" value="${rbr}" min="0" style="text-align:center;padding:4px;">
                    </div>
                </div>
            </div>
        `;

        // ── Padding ──────────────────────────────────────
        const padTarget = this._resolveTarget(element, config.padding || config.border);
        const padParts  = (padTarget?.style.padding || '0px').split(' ');
        const [pt, pr, pb, pl] = [
            parseFloat(padParts[0]) || 0,
            parseFloat(padParts[1] ?? padParts[0]) || 0,
            parseFloat(padParts[2] ?? padParts[0]) || 0,
            parseFloat(padParts[3] ?? padParts[1] ?? padParts[0]) || 0,
        ];

        const paddingHtml = `
            <div class="ct-field">
                <div class="ct-sublabel"><span class="material-symbols-outlined">padding</span>${I18n.t('common.padding')}</div>
                <div class="ct-field-grid4">
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <span style="font-size:9px;color:var(--text-muted);">${I18n.t('common.top')}</span>
                        <input type="number" id="cp-pad-t" class="craftools-input" value="${pt}" min="0" style="text-align:center;padding:4px;">
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <span style="font-size:9px;color:var(--text-muted);">${I18n.t('common.right')}</span>
                        <input type="number" id="cp-pad-r" class="craftools-input" value="${pr}" min="0" style="text-align:center;padding:4px;">
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <span style="font-size:9px;color:var(--text-muted);">${I18n.t('common.bottom')}</span>
                        <input type="number" id="cp-pad-b" class="craftools-input" value="${pb}" min="0" style="text-align:center;padding:4px;">
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <span style="font-size:9px;color:var(--text-muted);">${I18n.t('common.left')}</span>
                        <input type="number" id="cp-pad-l" class="craftools-input" value="${pl}" min="0" style="text-align:center;padding:4px;">
                    </div>
                </div>
            </div>
        `;

        // ── Margin ───────────────────────────────────────
        const marTarget = this._resolveTarget(element, config.margin || config.border);
        const marParts  = (marTarget?.style.margin || '0px').split(' ');
        const [mt, mr, mb, mbl] = [
            parseFloat(marParts[0]) || 0,
            parseFloat(marParts[1] ?? marParts[0]) || 0,
            parseFloat(marParts[2] ?? marParts[0]) || 0,
            parseFloat(marParts[3] ?? marParts[1] ?? marParts[0]) || 0,
        ];

        const marginHtml = `
            <div class="ct-field">
                <div class="ct-sublabel"><span class="material-symbols-outlined">margin</span>${I18n.t('common.margin') || 'Margem'}</div>
                <div class="ct-field-grid4">
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <span style="font-size:9px;color:var(--text-muted);">${I18n.t('common.top')}</span>
                        <input type="number" id="cp-mar-t" class="craftools-input" value="${mt}" style="text-align:center;padding:4px;">
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <span style="font-size:9px;color:var(--text-muted);">${I18n.t('common.right')}</span>
                        <input type="number" id="cp-mar-r" class="craftools-input" value="${mr}" style="text-align:center;padding:4px;">
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <span style="font-size:9px;color:var(--text-muted);">${I18n.t('common.bottom')}</span>
                        <input type="number" id="cp-mar-b" class="craftools-input" value="${mb}" style="text-align:center;padding:4px;">
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <span style="font-size:9px;color:var(--text-muted);">${I18n.t('common.left')}</span>
                        <input type="number" id="cp-mar-l" class="craftools-input" value="${mbl}" style="text-align:center;padding:4px;">
                    </div>
                </div>
            </div>
        `;

        const bodyHtml = [
            config.border  !== false ? borderHtml  : '',
            config.radius  !== false ? radiusHtml  : '',
            config.padding !== false ? paddingHtml : '',
            config.margin  !== false ? marginHtml  : '',
        ].join('');

        const accordionHtml = PanelUI.accordion(
            'ct-forma',
            'shapes',
            I18n.t('common.sectionForma') || 'Forma',
            bodyHtml
        );

        const wrapper = document.createElement('div');
        wrapper.innerHTML = accordionHtml;
        container.appendChild(wrapper.firstElementChild);

        // Bind events
        const acc = container.querySelector('[data-accordion-id="ct-forma"]');
        if (!acc) return;

        // Border
        if (config.border !== false) {
            const bT = this._resolveTarget(element, config.border);
            const bindBorder = () => {
                const w = acc.querySelector('#cp-border-w');
                const s = acc.querySelector('#cp-border-style');
                const c = acc.querySelector('#cp-border-color');
                if (!w || !bT) return;
                bT.style.borderWidth = w.value + 'px';
                bT.style.borderStyle = s?.value || 'solid';
                bT.style.borderColor = c?.value || '#000000';
                if (config.onChange) config.onChange();
                this._triggerChange(element);
            };
            acc.querySelector('#cp-border-w')?.addEventListener('input', bindBorder);
            acc.querySelector('#cp-border-style')?.addEventListener('change', bindBorder);
            acc.querySelector('#cp-border-color')?.addEventListener('input', bindBorder);
        }

        // Radius
        if (config.radius !== false) {
            const rT = this._resolveTarget(element, config.radius || config.border);
            const bindRadius = () => {
                if (!rT) return;
                const tl = acc.querySelector('#cp-rad-tl')?.value || 0;
                const tr = acc.querySelector('#cp-rad-tr')?.value || 0;
                const bl = acc.querySelector('#cp-rad-bl')?.value || 0;
                const br = acc.querySelector('#cp-rad-br')?.value || 0;
                rT.style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
                if (config.onChange) config.onChange();
                this._triggerChange(element);
            };
            acc.querySelectorAll('#cp-rad-tl, #cp-rad-tr, #cp-rad-bl, #cp-rad-br')
                .forEach(i => i.addEventListener('input', bindRadius));
        }

        // Padding
        if (config.padding !== false) {
            const pT = this._resolveTarget(element, config.padding || config.border);
            const bindPad = () => {
                if (!pT) return;
                const t = acc.querySelector('#cp-pad-t')?.value || 0;
                const r = acc.querySelector('#cp-pad-r')?.value || 0;
                const b = acc.querySelector('#cp-pad-b')?.value || 0;
                const l = acc.querySelector('#cp-pad-l')?.value || 0;
                pT.style.padding = `${t}px ${r}px ${b}px ${l}px`;
                if (config.onChange) config.onChange();
                this._triggerChange(element);
            };
            acc.querySelectorAll('#cp-pad-t, #cp-pad-r, #cp-pad-b, #cp-pad-l')
                .forEach(i => i.addEventListener('input', bindPad));
        }

        // Margin
        if (config.margin !== false) {
            const mT = this._resolveTarget(element, config.margin || config.border);
            const bindMar = () => {
                if (!mT) return;
                const t = acc.querySelector('#cp-mar-t')?.value || 0;
                const r = acc.querySelector('#cp-mar-r')?.value || 0;
                const b = acc.querySelector('#cp-mar-b')?.value || 0;
                const l = acc.querySelector('#cp-mar-l')?.value || 0;
                mT.style.margin = `${t}px ${r}px ${b}px ${l}px`;
                if (config.onChange) config.onChange();
                this._triggerChange(element);
            };
            acc.querySelectorAll('#cp-mar-t, #cp-mar-r, #cp-mar-b, #cp-mar-l')
                .forEach(i => i.addEventListener('input', bindMar));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tamanho (Size & Position) accordion
    // ─────────────────────────────────────────────────────────────────────────

    static _appendTamanho(container, element, config) {
        const elStyle = element.style;
        const currentW  = Math.round(parseFloat(elStyle.width)  || parseFloat(element.getAttribute('w'))  || 0);
        const currentH  = Math.round(parseFloat(elStyle.height) || parseFloat(element.getAttribute('h'))  || 0);
        const currentX  = Math.round(parseFloat(elStyle.left)   || parseFloat(element.getAttribute('x'))  || 0);
        const currentY  = Math.round(parseFloat(elStyle.top)    || parseFloat(element.getAttribute('y'))  || 0);
        const currentZ  = parseInt(elStyle.zIndex) || 2;

        const autoFitOn = config.autoFitText ? (element._craftoolsAutoResize !== false) : false;

        const bodyHtml = `
            <!-- Size -->
            <div class="ct-field">
                <div class="ct-sublabel"><span class="material-symbols-outlined">aspect_ratio</span>${I18n.t('common.size') || 'Tamanho'}</div>
                ${config.autoFitText ? `
                <label class="ct-field-row" style="gap:6px; align-items:center; cursor:pointer; margin-bottom:6px;">
                    <input type="checkbox" id="ct-autofit-text" ${autoFitOn ? 'checked' : ''}>
                    <span style="font-size:11px; color:var(--text-secondary);">${I18n.t('common.autoFitText') || 'Ajustar tamanho automaticamente ao texto'}</span>
                </label>
                ` : ''}
                <div class="ct-field-grid2">
                    <div style="display:flex;flex-direction:column;gap:3px;">
                        <span style="font-size:9px;color:var(--text-muted);">W</span>
                        <div class="ct-field-row" style="gap:4px;">
                            <input type="number" id="ct-sz-w" class="craftools-input" value="${currentW}" min="10" style="text-align:center;padding:4px;" ${autoFitOn ? 'disabled' : ''}>
                            <span style="font-size:10px;color:var(--text-muted);">px</span>
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:3px;">
                        <span style="font-size:9px;color:var(--text-muted);">H</span>
                        <div class="ct-field-row" style="gap:4px;">
                            <input type="number" id="ct-sz-h" class="craftools-input" value="${currentH}" min="10" style="text-align:center;padding:4px;" ${autoFitOn ? 'disabled' : ''}>
                            <span style="font-size:10px;color:var(--text-muted);">px</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Position -->
            <div class="ct-field">
                <div class="ct-sublabel"><span class="material-symbols-outlined">open_with</span>${I18n.t('common.position') || 'Posição'}</div>
                <div class="ct-field-grid2">
                    <div style="display:flex;flex-direction:column;gap:3px;">
                        <span style="font-size:9px;color:var(--text-muted);">X</span>
                        <div class="ct-field-row" style="gap:4px;">
                            <input type="number" id="ct-pos-x" class="craftools-input" value="${currentX}" style="text-align:center;padding:4px;">
                            <span style="font-size:10px;color:var(--text-muted);">px</span>
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:3px;">
                        <span style="font-size:9px;color:var(--text-muted);">Y</span>
                        <div class="ct-field-row" style="gap:4px;">
                            <input type="number" id="ct-pos-y" class="craftools-input" value="${currentY}" style="text-align:center;padding:4px;">
                            <span style="font-size:10px;color:var(--text-muted);">px</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Z-Index -->
            <div class="ct-field">
                <div class="ct-sublabel"><span class="material-symbols-outlined">layers</span>${I18n.t('common.zindex') || 'Camada (Z)'}</div>
                <div class="ct-field-row">
                    <input type="number" id="ct-zindex" class="craftools-input" value="${currentZ}" min="1" style="flex:1; text-align:center;">
                    <button class="craftools-icon-btn" id="ct-z-up" title="${I18n.t('common.moveUp') || 'Acima'}">
                        <span class="material-symbols-outlined">keyboard_arrow_up</span>
                    </button>
                    <button class="craftools-icon-btn" id="ct-z-down" title="${I18n.t('common.moveDown') || 'Abaixo'}">
                        <span class="material-symbols-outlined">keyboard_arrow_down</span>
                    </button>
                </div>
            </div>
        `;

        const accordionHtml = PanelUI.accordion(
            'ct-tamanho',
            'straighten',
            I18n.t('common.sectionTamanho') || 'Tamanho',
            bodyHtml
        );

        const wrapper = document.createElement('div');
        wrapper.innerHTML = accordionHtml;
        container.appendChild(wrapper.firstElementChild);

        const acc = container.querySelector('[data-accordion-id="ct-tamanho"]');
        if (!acc) return;

        // Size
        const wInput = acc.querySelector('#ct-sz-w');
        const hInput = acc.querySelector('#ct-sz-h');
        wInput?.addEventListener('input', () => {
            element.style.width = wInput.value + 'px';
            if (config.onChange) config.onChange();
            this._triggerChange(element);
        });
        hInput?.addEventListener('input', () => {
            element.style.height = hInput.value + 'px';
            if (config.onChange) config.onChange();
            this._triggerChange(element);
        });

        // Ajuste automático ao texto (só existe quando o tool passa
        // config.autoFitText -- hoje só o TextTool/Título/Parágrafo).
        // Liga/desliga `element._craftoolsAutoResize` (padrão: true/ligado
        // quando ainda não definido) e trava os campos W/H manuais enquanto
        // ligado, já que nesse modo o tamanho é recalculado a cada tecla.
        const autoFitCheckbox = acc.querySelector('#ct-autofit-text');
        autoFitCheckbox?.addEventListener('change', () => {
            element._craftoolsAutoResize = autoFitCheckbox.checked;
            if (wInput) wInput.disabled = autoFitCheckbox.checked;
            if (hInput) hInput.disabled = autoFitCheckbox.checked;
            if (config.onAutoFitToggle) config.onAutoFitToggle(autoFitCheckbox.checked);
            if (config.onChange) config.onChange();
            this._triggerChange(element);
        });

        // Position
        const xInput = acc.querySelector('#ct-pos-x');
        const yInput = acc.querySelector('#ct-pos-y');
        xInput?.addEventListener('input', () => {
            element.style.left = xInput.value + 'px';
            element.setAttribute('x', xInput.value);
            if (config.onChange) config.onChange();
            this._triggerChange(element);
        });
        yInput?.addEventListener('input', () => {
            element.style.top = yInput.value + 'px';
            element.setAttribute('y', yInput.value);
            if (config.onChange) config.onChange();
            this._triggerChange(element);
        });

        // Z-Index
        const zInput = acc.querySelector('#ct-zindex');
        zInput?.addEventListener('input', () => {
            element.style.zIndex = zInput.value;
            if (config.onChange) config.onChange();
            this._triggerChange(element);
        });
        acc.querySelector('#ct-z-up')?.addEventListener('click', () => {
            zInput.value = parseInt(zInput.value) + 1;
            zInput.dispatchEvent(new Event('input'));
        });
        acc.querySelector('#ct-z-down')?.addEventListener('click', () => {
            zInput.value = Math.max(1, parseInt(zInput.value) - 1);
            zInput.dispatchEvent(new Event('input'));
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Estilo — copy/paste styles (rendered as a compact bar, not an accordion)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Renders the Copy/Paste styles bar at the very top of the container.
     * (Stays as a sticky bar, not an accordion.)
     */
    static renderEstiloBar(container, element, config = {}) {
        const targetSelector = config.border || config.radius || config.padding;
        const target = this._resolveTarget(element, targetSelector);
        if (!target) return;

        const isLocked = element.getAttribute('data-locked') === 'true';
        const lockLabel = isLocked ? (I18n.t('common.locked') || 'Bloqueado') : (I18n.t('common.lock') || 'Bloquear');
        const lockTitle = isLocked ? (I18n.t('common.unlockElement') || 'Desbloquear elemento') : (I18n.t('common.lockElement') || 'Bloquear elemento (impede mover/redimensionar)');

        const html = `
            <div class="ct-copypaste-bar">
                <button id="ct-copy-styles" class="craftools-pill" type="button"
                    title="${I18n.t('common.copyStyles') || 'Copiar estilos'}">
                    <span class="material-symbols-outlined" style="font-size:13px;">content_copy</span>
                    <span>${I18n.t('common.copy') || 'Copiar'}</span>
                </button>
                <button id="ct-paste-styles" class="craftools-pill" type="button"
                    title="${I18n.t('common.pasteStyles') || 'Colar estilos'}">
                    <span class="material-symbols-outlined" style="font-size:13px;">content_paste</span>
                    <span>${I18n.t('common.paste') || 'Colar'}</span>
                </button>
                <button id="ct-toggle-lock" class="craftools-pill ${isLocked ? 'active' : ''}" type="button" title="${lockTitle}">
                    <span class="material-symbols-outlined" style="font-size:13px;">${isLocked ? 'lock' : 'lock_open'}</span>
                    <span>${lockLabel}</span>
                </button>
            </div>
        `;

        const bar = document.createElement('div');
        bar.innerHTML = html;
        container.insertBefore(bar.firstElementChild, container.firstChild);

        const btnCopy  = container.querySelector('#ct-copy-styles');
        const btnPaste = container.querySelector('#ct-paste-styles');
        const btnLock  = container.querySelector('#ct-toggle-lock');

        btnCopy?.addEventListener('click', () => {
            window.__craftoolsClipboardStyle = {
                type:    element.getAttribute('data-craftool'),
                cssText: target.style.cssText,
                zIndex:  element.style.zIndex,
                meta:    element._craftoolsMeta ? JSON.parse(JSON.stringify(element._craftoolsMeta)) : null,
            };
            const orig = btnCopy.innerHTML;
            btnCopy.innerHTML = `<span class="material-symbols-outlined" style="font-size:13px;color:var(--accent);">check</span> ${I18n.t('common.copied') || 'Copiado'}`;
            setTimeout(() => (btnCopy.innerHTML = orig), 1500);
        });

        btnPaste?.addEventListener('click', () => {
            const clip = window.__craftoolsClipboardStyle;
            if (!clip) { this._toastError(I18n.t('common.noStyleCopied') || 'Nenhum estilo copiado'); return; }
            if (clip.type !== element.getAttribute('data-craftool')) {
                this._toastError(I18n.t('common.incompatibleStyleTypes') || 'Tipos de elemento incompatíveis'); return;
            }
            target.style.cssText = clip.cssText;
            if (clip.zIndex) element.style.zIndex = clip.zIndex;
            if (clip.meta && element._craftoolsMeta) {
                const nm = { ...clip.meta };
                if (element._craftoolsMeta.src) nm.src = element._craftoolsMeta.src;
                Object.assign(element._craftoolsMeta, nm);
            }
            if (config.onChange) config.onChange();
            this._triggerChange(element);
            if (element._syncSidebar) element._syncSidebar();
            setTimeout(() => {
                const rect = element.getBoundingClientRect();
                element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.x + 10, clientY: rect.y + 10 }));
                element.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true }));
            }, 50);
        });

        // "Bloquear" — impede mover/redimensionar/rotacionar/excluir o elemento
        // pela interface (ver data-locked em Element.js: _bindEvents/_syncLockUI).
        // Desativado por padrão em todas as ferramentas; PaperTool.createElement()
        // é a única que já cria o elemento com data-locked="true".
        btnLock?.addEventListener('click', () => {
            const nowLocked = element.getAttribute('data-locked') !== 'true';
            element.setAttribute('data-locked', nowLocked ? 'true' : 'false');
            if (typeof element._syncLockUI === 'function') element._syncLockUI();

            btnLock.classList.toggle('active', nowLocked);
            const icon = btnLock.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = nowLocked ? 'lock' : 'lock_open';
            const label = btnLock.querySelector('span:last-child');
            if (label) label.textContent = nowLocked ? (I18n.t('common.locked') || 'Bloqueado') : (I18n.t('common.lock') || 'Bloquear');
            btnLock.title = nowLocked
                ? (I18n.t('common.unlockElement') || 'Desbloquear elemento')
                : (I18n.t('common.lockElement') || 'Bloquear elemento (impede mover/redimensionar)');

            if (config.onChange) config.onChange();
            this._triggerChange(element);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Legacy API — kept for backward compatibility during migration
    // These delegate to the new accordion-based methods
    // ─────────────────────────────────────────────────────────────────────────

    /** @deprecated use renderBaseAccordions */
    static renderBorder(container, element, targetSelector, onChange) {
        this._appendForma(container, element, { border: targetSelector, radius: false, padding: false, margin: false, onChange });
    }

    /** @deprecated use renderBaseAccordions */
    static renderBorderRadius(container, element, targetSelector, onChange) {
        /* no-op — merged into Forma */
    }

    /** @deprecated use renderBaseAccordions */
    static renderPadding(container, element, targetSelector, onChange) {
        /* no-op — merged into Forma */
    }

    /** @deprecated use renderBaseAccordions */
    static renderZIndex(container, element, onChange) {
        this._appendTamanho(container, element, { onChange });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    static _resolveTarget(element, selector) {
        if (!selector || selector === true) return element;
        return element.contentArea?.querySelector(selector) || element.querySelector(selector) || null;
    }

    static _triggerChange(element) {
        element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
    }

    static _toastError(msg) {
        import('./Notify.js').then(({ Notify }) => Notify.toast(msg, 'error'));
    }

    static _getUnit(val) {
        if (!val) return 'px';
        return val.toString().replace(/[0-9.-]/g, '').trim() || 'px';
    }

    static _rgbToHex(rgb) {
        if (!rgb) return '#000000';
        if (rgb === 'white') return '#ffffff';
        if (rgb === 'black') return '#000000';
        if (rgb === 'transparent') return '#ffffff';
        if (!rgb.startsWith('rgb')) return rgb;
        const parts = rgb.match(/\d+/g);
        if (!parts) return rgb;
        const hex = x => ('0' + parseInt(x).toString(16)).slice(-2);
        return '#' + hex(parts[0]) + hex(parts[1]) + hex(parts[2]);
    }
}
