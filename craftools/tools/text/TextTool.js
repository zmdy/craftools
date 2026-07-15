import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { CommonProperties } from "../../utils/CommonProperties.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { AutoFitText } from "../../utils/AutoFitText.js";
import "./TextTool_Translations.js";
import "../../components/CtFontSelect.js";

const FONTS = [
    'DM Sans', 'DM Serif Display', 'DM Mono', 'Open Sans', 'Pacifico', 'Lobster', 
    'Georgia', 'Arial', 'Times New Roman', 'Courier New', 'Impact',
    'Parisienne', 'Dancing Script', 'Quicksand', 'Quintessential', 'Grenze Gotisch'
];

/**
 * Dynamically loads Google Fonts for display in the editor.
 */
const loadGoogleFonts = (fonts) => {
    const googleFonts = fonts.filter(f => ![
        'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Impact'
    ].includes(f));
    
    if (googleFonts.length > 0) {
        const linkId = 'craftools-dynamic-fonts';
        let link = document.getElementById(linkId);
        if (!link) {
            link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        const fontQuery = googleFonts.map(f => f.replace(/\s+/g, '+')).join('|');
        link.href = `https://fonts.googleapis.com/css?family=${fontQuery}&display=swap`;
    }
};

export class TextTool extends BaseTool {
    // Legacy renderPropertiesPanel deleted. Panel rendering is now schema-driven in TextTool.ts via PropertyRenderer.
        

    /**
     * Applies bold/italic/underline by formatting the selection via execCommand.
     * (Text/Title elements are always editable — since variable binding was
     * moved to the separate "Variable Content" tool, see VariableContentTool.js
     * — there is no longer a "locked" state here.)
     */
    static _toggleCtxStyle(element, cssProp, onValue, offValue) {
        const text = element.contentArea.querySelector('[contenteditable]');
        if (!text) return;
        text.focus();
        document.execCommand(cssProp === 'fontWeight' ? 'bold' : cssProp === 'fontStyle' ? 'italic' : 'underline');
        AutoFitText.applyAutoSize(element, text);
        const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
        element.dispatchEvent(event);
    }

    static getCtxOptions() {
        return [
            {
                icon: 'format_bold',
                label: I18n.t('textTool.bold'),
                command: (element) => this._toggleCtxStyle(element, 'fontWeight', 'bold', 'normal')
            },
            {
                icon: 'format_italic',
                label: I18n.t('textTool.italic'),
                command: (element) => this._toggleCtxStyle(element, 'fontStyle', 'italic', 'normal')
            },
            {
                icon: 'format_underlined',
                label: I18n.t('textTool.underline'),
                command: (element) => this._toggleCtxStyle(element, 'textDecoration', 'underline', 'none')
            }
        ];
    }

    static createElement(type, editorApp) {
        let tag = 'p', size = 16, weight = 400, text = 'Editar texto...', w = 200, h = 40;
        
        if (type === 'titulo') {
            tag = 'h1'; size = 48; weight = 700; w = 300; h = 70;
        } else if (type === 'paragrafo') {
            tag = 'p'; size = 16; weight = 400; w = 200; h = 40;
        }

        const el = document.createElement('craftools-element');
        el.setAttribute('x', '50');
        el.setAttribute('y', '50');
        el.setAttribute('w', w);
        el.setAttribute('h', h);
        el.setAttribute('data-craftool', type);
        // Ajuste automático de tamanho começa DESLIGADO (ver AutoFitText.js/
        // CommonProperties.js -- só `true` liga o ajuste automático).
        el._craftoolsAutoResize = false;

        const content = document.createElement(tag);
        content.setAttribute('contenteditable', 'true');
        content.setAttribute('spellcheck', 'false');
        content.style.cssText = `
            font-size: ${size}px;
            font-weight: ${weight};
            color: #1a1a1a;
            font-family: 'DM Sans', 'Noto Color Emoji', sans-serif;
            display: block;
            width: 100%;
            height: 100%;
            white-space: pre-wrap;
            word-break: break-word;
            cursor: text;
            line-height: 1.3;
            margin: 0;
            outline: none;
        `;
        content.innerHTML = text;

        el.appendChild(content);

        return el;
    }
}
