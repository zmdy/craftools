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

    // Legacy renderPropertiesPanel, _boundNoticeHtml, and _updateWarning deleted.
    // Panel rendering is now schema-driven in BarcodeTool.ts via PropertyRenderer.

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
