import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { BarcodeGenerator } from "../../utils/BarcodeGenerator.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { VariablePanel } from "../../utils/VariablePanel.js";
import { VariableEngine } from "../../utils/VariableEngine.js";
import "./BarcodeTool_Translations.js";

/**
 * BarcodeTool
 * Ferramenta de código de barras vetorial (SVG) para o editor CrafTools.
 * A codificação é feita por BarcodeGenerator.js (craftools/utils/) -- este
 * arquivo só monta a interface de edição (formato, conteúdo, aparência) e o
 * elemento do editor, no mesmo padrão de QRCodeTool.js.
 */
export class BarcodeTool extends BaseTool {

    static renderPropertiesPanel(editorPanel, element) {
        const meta = element._craftoolsMeta || this.getDefaultMeta();
        if (!element._craftoolsMeta) element._craftoolsMeta = meta;

        if (element.contentArea) {
            element.contentArea.style.pointerEvents = 'auto';
            element.contentArea.style.cursor = 'move';
        }

        const isEan = meta.format === 'ean13';
        const isBound = !!(meta.variableBinding && meta.variableBinding.type);
        const valid = isEan
            ? BarcodeGenerator.isValidEan13Text(meta.text)
            : BarcodeGenerator.isValidCode39Text(meta.text);

        const htmlConteudo = `
            <div id="bc-bound-notice">${isBound ? this._boundNoticeHtml() : ''}</div>
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('barcodeTool.format')}</span>
                <select id="bc-format" class="craftools-select" style="width:100%;">
                    <option value="code39" ${!isEan ? 'selected' : ''}>${I18n.t('barcodeTool.formatCode39')}</option>
                    <option value="ean13" ${isEan ? 'selected' : ''}>${I18n.t('barcodeTool.formatEan13')}</option>
                </select>
            </div>

            <div class="ct-field">
                <span class="craftools-label">${isEan ? I18n.t('barcodeTool.textLabelEan13') : I18n.t('barcodeTool.textLabelCode39')}</span>
                <input type="text" id="bc-text" class="craftools-input" style="width:100%;"
                    placeholder="${isEan ? I18n.t('barcodeTool.textPlaceholderEan13') : I18n.t('barcodeTool.textPlaceholderCode39')}"
                    value="${this._esc(meta.text)}">
                <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">
                    ${isEan ? I18n.t('barcodeTool.textHelpEan13') : I18n.t('barcodeTool.textHelpCode39')}
                </span>
            </div>

            <div id="bc-invalid-warning" style="display:${(!isBound && !valid && meta.text) ? 'flex' : 'none'}; gap:6px; align-items:flex-start; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:8px; font-size:11px; color:#ef4444;">
                <span class="material-symbols-outlined" style="font-size:14px;">warning</span>
                <span>${isEan ? I18n.t('barcodeTool.invalidEan13') : I18n.t('barcodeTool.invalidCode39')}</span>
            </div>
        `;

        const htmlAparencia = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('barcodeTool.colorBar')}</span>
                    <input type="color" id="bc-color-bar" class="craftools-color-swatch" value="${meta.color}" style="width:100%;">
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('barcodeTool.colorBackground')}</span>
                    <input type="color" id="bc-color-bg" class="craftools-color-swatch" value="${meta.background === 'transparent' ? '#ffffff' : meta.background}" style="width:100%;" ${meta.background === 'transparent' ? 'disabled' : ''}>
                </div>
            </div>
            <label class="ct-field" style="flex-direction:row; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="bc-bg-transparent" ${meta.background === 'transparent' ? 'checked' : ''}>
                <span class="craftools-label" style="margin:0;">${I18n.t('barcodeTool.transparentBg')}</span>
            </label>
            <label class="ct-field" style="flex-direction:row; align-items:center; gap:6px; cursor:pointer; margin-top:6px;">
                <input type="checkbox" id="bc-show-text" ${meta.showText ? 'checked' : ''}>
                <span class="craftools-label" style="margin:0;">${I18n.t('barcodeTool.showText')}</span>
            </label>
        `;

        editorPanel.innerHTML =
            PanelUI.accordion('bc-conteudo', 'barcode_reader', I18n.t('barcodeTool.content') || 'Conteúdo', htmlConteudo, { open: true }) +
            PanelUI.accordion('bc-aparencia', 'palette', I18n.t('barcodeTool.appearance') || 'Aparência', htmlAparencia) +
            PanelUI.accordion('bc-variavel', 'data_object', I18n.t('variablePanel.title'), VariablePanel.renderAccordionBody(meta.variableBinding));

        this.renderCommonProperties(editorPanel, element, {
            border: 'svg',
            radius: 'svg',
            padding: 'svg',
            margin: 'svg',
            zindex: true,
            onChange: () => {
                const svg = element.contentArea.querySelector('svg');
                if (svg) {
                    meta.borderWidth = parseFloat(svg.style.borderWidth) || 0;
                    meta.borderStyle = svg.style.borderStyle || 'none';
                    meta.borderColor = svg.style.borderColor || '#000000';
                    meta.borderRadius = svg.style.borderRadius || '0px';
                }
            }
        });

        // --- Bindings ---
        const formatSelect = editorPanel.querySelector('#bc-format');
        formatSelect.onchange = () => {
            meta.format = formatSelect.value;
            this.renderPropertiesPanel(editorPanel, element);
            this._regenerate(element);
        };

        const textInput = editorPanel.querySelector('#bc-text');
        textInput.oninput = () => {
            meta.text = textInput.value;
            this._updateWarning(editorPanel, meta);
            this._regenerate(element);
        };

        const colorBar = editorPanel.querySelector('#bc-color-bar');
        colorBar.oninput = () => {
            meta.color = colorBar.value;
            this._regenerate(element);
        };

        const colorBg = editorPanel.querySelector('#bc-color-bg');
        colorBg.oninput = () => {
            meta.background = colorBg.value;
            this._regenerate(element);
        };

        const bgTransparent = editorPanel.querySelector('#bc-bg-transparent');
        bgTransparent.onchange = () => {
            if (bgTransparent.checked) {
                meta.background = 'transparent';
                colorBg.disabled = true;
            } else {
                meta.background = colorBg.value || '#ffffff';
                colorBg.disabled = false;
            }
            this._regenerate(element);
        };

        const showText = editorPanel.querySelector('#bc-show-text');
        showText.onchange = () => {
            meta.showText = showText.checked;
            this._regenerate(element);
        };

        // Texto Variável — vincula o conteúdo do código de barras a uma
        // variável (data, sequência, número de página, link, frase da
        // API...), que substitui o texto manual acima na Exportação de Agenda.
        VariablePanel.bind(editorPanel, meta.variableBinding, (binding) => {
            meta.variableBinding = binding;
            const noticeEl = editorPanel.querySelector('#bc-bound-notice');
            if (noticeEl) noticeEl.innerHTML = (binding && binding.type) ? this._boundNoticeHtml() : '';
            this._updateWarning(editorPanel, meta);
            this._regenerate(element);
        });
    }

    static _boundNoticeHtml() {
        return `
            <div class="ct-field" style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.3); border-radius:6px; padding:8px; font-size:11px; color:var(--accent, #6366f1); display:flex; gap:6px; align-items:flex-start;">
                <span class="material-symbols-outlined" style="font-size:14px;">data_object</span>
                <span>${I18n.t('variablePanel.boundNotice')}</span>
            </div>
        `;
    }

    static _updateWarning(editorPanel, meta) {
        const warningEl = editorPanel.querySelector('#bc-invalid-warning');
        if (!warningEl) return;
        const isBound = !!(meta.variableBinding && meta.variableBinding.type);
        const valid = meta.format === 'ean13'
            ? BarcodeGenerator.isValidEan13Text(meta.text)
            : BarcodeGenerator.isValidCode39Text(meta.text);
        warningEl.style.display = (!isBound && !valid && meta.text) ? 'flex' : 'none';
    }

    /** Reconstrói o SVG a partir do estado atual de `_craftoolsMeta`. */
    static _regenerate(element) {
        const meta = element._craftoolsMeta;
        if (!meta || !element.contentArea) return;

        const bound = meta.variableBinding && meta.variableBinding.type;
        if (bound) {
            VariableEngine.resolvePreview(meta.variableBinding).then(value => {
                this._renderContent(element, meta, value);
            });
            return;
        }
        this._renderContent(element, meta, null);
    }

    /**
     * @param {string|null} boundValue - quando não-nulo (elemento vinculado a
     * uma variável), substitui o texto manual (`meta.text`) pelo valor
     * resolvido da variável (preview no editor; na Exportação de Agenda o
     * valor real por repetição é resolvido por AgendaExport.js).
     */
    static _renderContent(element, meta, boundValue) {
        const text = boundValue !== null ? boundValue : meta.text;
        const svgString = BarcodeGenerator.buildSvgString(text, {
            format: meta.format,
            color: meta.color,
            background: meta.background,
            showText: meta.showText,
        });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = svgString;
        const fresh = wrapper.firstElementChild;

        let svg = element.contentArea.querySelector('svg');
        if (svg) {
            // Mantém o mesmo nó <svg> (preserva borda/raio aplicados via CommonProperties)
            svg.setAttribute('viewBox', fresh.getAttribute('viewBox'));
            svg.innerHTML = fresh.innerHTML;
        } else {
            fresh.style.userSelect = 'none';
            fresh.style.pointerEvents = 'none';
            element.contentArea.appendChild(fresh);
        }

        this._triggerChange(element);
    }

    static _triggerChange(element) {
        const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
        element.dispatchEvent(event);
    }

    static _esc(val) {
        return String(val == null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    static getCtxOptions() {
        return [];
    }

    static getDefaultMeta() {
        return {
            format: 'code39',
            text: 'CRAFTOOLS',
            color: '#000000',
            background: '#ffffff',
            showText: true,
            borderWidth: 0,
            borderStyle: 'none',
            borderColor: '#000000',
            borderRadius: 0,
            variableBinding: null,
        };
    }

    static createElement(type, editorApp) {
        const el = document.createElement('craftools-element');
        el.setAttribute('x', '50');
        el.setAttribute('y', '50');
        el.setAttribute('w', '220');
        el.setAttribute('h', '100');
        el.setAttribute('data-craftool', 'barcode');

        el._craftoolsMeta = this.getDefaultMeta();

        const svg = BarcodeGenerator.buildSvgElement(el._craftoolsMeta.text, {
            format: el._craftoolsMeta.format,
            color: el._craftoolsMeta.color,
            background: el._craftoolsMeta.background,
            showText: el._craftoolsMeta.showText,
        });
        svg.style.userSelect = 'none';
        svg.style.pointerEvents = 'none';

        el.appendChild(svg);

        return el;
    }
}
