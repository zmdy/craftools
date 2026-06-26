import { I18n } from "../settings/Translations.js";

/**
 * CommonProperties Utility
 * Fornece seções de interface e lógica reutilizáveis para propriedades comuns
 * como Bordas, Border-radius, Padding e Z-Index.
 */
export class CommonProperties {

    /**
     * Renderiza a seção de Bordas (Largura, Estilo, Cor)
     */
    static renderBorder(container, element, targetSelector, onChange) {
        const target = targetSelector ? element.contentArea.querySelector(targetSelector) : element;
        if (!target) return;

        const html = `
            <div class="craftools-field" style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 8px;">
                <span class="craftools-label" style="font-weight: 700;">${I18n.t('common.border')}</span>
                <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px;">
                    <input type="number" id="prop-border-width" class="craftools-input" value="${parseFloat(target.style.borderWidth) || 0}" min="0" max="20" style="width: 50px;">
                    <select id="prop-border-style" class="craftools-select" style="flex: 1; padding: 6px;">
                        <option value="none" ${target.style.borderStyle === 'none' ? 'selected' : ''}>${I18n.t('common.borderNone')}</option>
                        <option value="solid" ${target.style.borderStyle === 'solid' ? 'selected' : ''}>${I18n.t('common.borderSolid')}</option>
                        <option value="dashed" ${target.style.borderStyle === 'dashed' ? 'selected' : ''}>${I18n.t('common.borderDashed')}</option>
                        <option value="dotted" ${target.style.borderStyle === 'dotted' ? 'selected' : ''}>${I18n.t('common.borderDotted')}</option>
                    </select>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <input type="color" id="prop-border-color" class="craftools-color-swatch" value="${this._rgbToHex(target.style.borderColor) || '#000000'}">
                    <span style="font-size: 12px; color: var(--text-secondary)">${I18n.t('common.borderColor')}</span>
                </div>
            </div>
        `;
        
        const section = document.createElement('div');
        section.innerHTML = html;
        container.appendChild(section);

        const bWidth = section.querySelector('#prop-border-width');
        const bStyle = section.querySelector('#prop-border-style');
        const bColor = section.querySelector('#prop-border-color');

        const update = () => {
            const unit = this._getUnit(target.style.borderWidth);
            target.style.borderWidth = bWidth.value + unit;
            target.style.borderStyle = bStyle.value;
            target.style.borderColor = bColor.value;
            if (onChange) onChange();
            this._triggerChange(element);
        };

        bWidth.addEventListener('input', update);
        bStyle.addEventListener('change', update);
        bColor.addEventListener('input', update);
    }

    /**
     * Renderiza a seção de Border Radius (4 cantos)
     */
    static renderBorderRadius(container, element, targetSelector, onChange) {
        const target = targetSelector ? element.contentArea.querySelector(targetSelector) : element;
        if (!target) return;

        const radius = target.style.borderRadius ? target.style.borderRadius.split(' ') : ['0px'];
        const tl = parseFloat(radius[0]) || 0;
        const tr = parseFloat(radius[1]) || (radius.length > 1 ? parseFloat(radius[1]) : tl);
        const br = parseFloat(radius[2]) || (radius.length > 2 ? parseFloat(radius[2]) : tl);
        const bl = parseFloat(radius[3]) || (radius.length > 3 ? parseFloat(radius[3]) : tr);

        const html = `
            <div class="craftools-field">
                <span class="craftools-label" style="font-weight: 700;">${I18n.t('common.radius')}</span>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:14px; color:var(--text-muted);">rounded_corner</span>
                        <input type="number" id="prop-radius-tl" class="craftools-input" value="${tl}" min="0" style="width:100%;">
                    </div>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:14px; color:var(--text-muted); transform: rotate(90deg);">rounded_corner</span>
                        <input type="number" id="prop-radius-tr" class="craftools-input" value="${tr}" min="0" style="width:100%;">
                    </div>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:14px; color:var(--text-muted); transform: rotate(270deg);">rounded_corner</span>
                        <input type="number" id="prop-radius-bl" class="craftools-input" value="${bl}" min="0" style="width:100%;">
                    </div>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:14px; color:var(--text-muted); transform: rotate(180deg);">rounded_corner</span>
                        <input type="number" id="prop-radius-br" class="craftools-input" value="${br}" min="0" style="width:100%;">
                    </div>
                </div>
            </div>
        `;

        const section = document.createElement('div');
        section.innerHTML = html;
        container.appendChild(section);

        const unit = this._getUnit(target.style.borderRadius);
        const inputs = section.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                const v_tl = section.querySelector('#prop-radius-tl').value + unit;
                const v_tr = section.querySelector('#prop-radius-tr').value + unit;
                const v_br = section.querySelector('#prop-radius-br').value + unit;
                const v_bl = section.querySelector('#prop-radius-bl').value + unit;
                target.style.borderRadius = `${v_tl} ${v_tr} ${v_br} ${v_bl}`;
                if (onChange) onChange();
                this._triggerChange(element);
            });
        });
    }

    /**
     * Renderiza a seção de Padding (4 lados)
     */
    static renderPadding(container, element, targetSelector, onChange) {
        const target = targetSelector ? element.contentArea.querySelector(targetSelector) : element;
        if (!target) return;

        const pad = target.style.padding ? target.style.padding.split(' ') : ['0px'];
        const pt = parseFloat(pad[0]) || 0;
        const pr = parseFloat(pad[1]) || (pad.length > 1 ? parseFloat(pad[1]) : pt);
        const pb = parseFloat(pad[2]) || (pad.length > 2 ? parseFloat(pad[2]) : pt);
        const pl = parseFloat(pad[3]) || (pad.length > 3 ? parseFloat(pad[3]) : pr);

        const html = `
            <div class="craftools-field">
                <span class="craftools-label" style="font-weight: 700;">${I18n.t('common.padding')}</span>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <input type="number" id="prop-pad-t" class="craftools-input" value="${pt}" min="0" placeholder="${I18n.t('common.top')}">
                    <input type="number" id="prop-pad-r" class="craftools-input" value="${pr}" min="0" placeholder="${I18n.t('common.right')}">
                    <input type="number" id="prop-pad-b" class="craftools-input" value="${pb}" min="0" placeholder="${I18n.t('common.bottom')}">
                    <input type="number" id="prop-pad-l" class="craftools-input" value="${pl}" min="0" placeholder="${I18n.t('common.left')}">
                </div>
            </div>
        `;

        const section = document.createElement('div');
        section.innerHTML = html;
        container.appendChild(section);

        const unit = this._getUnit(target.style.padding);
        section.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => {
                const v_t = section.querySelector('#prop-pad-t').value + unit;
                const v_r = section.querySelector('#prop-pad-r').value + unit;
                const v_b = section.querySelector('#prop-pad-b').value + unit;
                const v_l = section.querySelector('#prop-pad-l').value + unit;
                target.style.padding = `${v_t} ${v_r} ${v_b} ${v_l}`;
                if (onChange) onChange();
                this._triggerChange(element);
            });
        });
    }

    /**
     * Renderiza a seção de Z-Index
     */
    static renderZIndex(container, element, onChange) {
        const html = `
            <div class="craftools-field" style="border-top: 1px solid var(--border); padding-top: 12px;">
                <span class="craftools-label" style="font-weight: 700;">${I18n.t('common.zindex')}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="number" id="prop-zindex" class="craftools-input" value="${element.style.zIndex || 2}" style="flex: 1;">
                    <div style="display: flex; gap: 2px;">
                        <button class="craftools-pill" id="z-up" title="${I18n.t('common.moveUp')}"><span class="material-symbols-outlined" style="font-size:16px;">keyboard_arrow_up</span></button>
                        <button class="craftools-pill" id="z-down" title="${I18n.t('common.moveDown')}"><span class="material-symbols-outlined" style="font-size:16px;">keyboard_arrow_down</span></button>
                    </div>
                </div>
            </div>
        `;

        const section = document.createElement('div');
        section.innerHTML = html;
        container.appendChild(section);

        const zInput = section.querySelector('#prop-zindex');
        zInput.addEventListener('input', () => {
            element.style.zIndex = zInput.value;
            if (onChange) onChange();
            this._triggerChange(element);
        });

        section.querySelector('#z-up').addEventListener('click', () => {
            zInput.value = parseInt(zInput.value) + 1;
            zInput.dispatchEvent(new Event('input'));
        });

        section.querySelector('#z-down').addEventListener('click', () => {
            zInput.value = Math.max(1, parseInt(zInput.value) - 1);
            zInput.dispatchEvent(new Event('input'));
        });
    }

    // Helpers
    static _triggerChange(element) {
        const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
        element.dispatchEvent(event);
    }

    static _getUnit(val) {
        if (!val) return 'px';
        const unit = val.toString().replace(/[0-9.-]/g, '').trim();
        return unit || 'px';
    }

    static _rgbToHex(rgb) {
        if (!rgb) return '#000000';
        if (rgb === 'white') return '#ffffff';
        if (rgb === 'black') return '#000000';
        if (rgb === 'transparent') return '#ffffff'; // Fallback for color inputs
        if (!rgb.startsWith('rgb')) return rgb;
        const parts = rgb.match(/\d+/g);
        if (!parts) return rgb;
        const hex = (x) => ("0" + parseInt(x).toString(16)).slice(-2);
        return "#" + hex(parts[0]) + hex(parts[1]) + hex(parts[2]);
    }
}
