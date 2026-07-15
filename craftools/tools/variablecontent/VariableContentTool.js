import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { CommonProperties } from "../../utils/CommonProperties.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { AutoFitText } from "../../utils/AutoFitText.js";
import { VariablePanel } from "../../utils/VariablePanel.js";
import { VariableEngine } from "../../utils/VariableEngine.js";
import "./VariableContentTool_Translations.js";
import "../../components/CtFontSelect.js";

const FONTS = [
    'DM Sans', 'DM Serif Display', 'DM Mono', 'Open Sans', 'Pacifico', 'Lobster',
    'Georgia', 'Arial', 'Times New Roman', 'Courier New', 'Impact',
    'Parisienne', 'Dancing Script', 'Quicksand', 'Quintessential', 'Grenze Gotisch'
];

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

/**
 * VariableContentTool ("Conteúdo Variável")
 *
 * Ferramenta dedicada exclusivamente a mostrar o valor resolvido de uma
 * variável (data, número sequencial, frase da API, Emoji Kitchen, Mini
 * Calendário etc. -- ver VariableEngine.js) na página, sem edição manual de
 * texto. Antes essa configuração vivia dentro de Título/Parágrafo
 * (TextTool.js); foi extraída para cá para que Texto/Título voltem a ser
 * ferramentas puramente estáticas, e todo o fluxo de "Texto Variável" fique
 * concentrado num único lugar.
 *
 * O nó interno é sempre `contenteditable="false"` (nunca digitado à mão) --
 * o atributo continua presente só para que os seletores `[contenteditable]`
 * já usados por CommonProperties.js/AgendaExport.js continuem funcionando
 * sem modificação.
 */
export class VariableContentTool extends BaseTool {
    // Legacy renderPropertiesPanel deleted. Panel rendering is now schema-driven in VariableContentTool.ts via PropertyRenderer.
        

    static _escAttr(val) {
        return String(val == null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Resolve e mostra o valor da variável configurada -- imagem para
     * emojiKitchen/miniCalendar (via innerHTML), texto simples para os
     * demais tipos. Sem binding, mostra um texto de espaço reservado
     * convidando a configurar uma variável.
     */
    static _applyVariablePreview(element, textElement, binding) {
        if (binding && binding.type) {
            textElement.style.whiteSpace = 'pre-wrap';
            textElement.textContent = I18n.t('variablePanel.previewLoading');
            VariableEngine.resolvePreview(binding).then(val => {
                if (binding.type === 'emojiKitchen') {
                    // Markup real (não texto digitado) -- ver nota abaixo
                    // sobre miniCalendar. Aqui é só uma <img>, mas mantemos o
                    // mesmo tratamento por consistência/segurança.
                    textElement.style.whiteSpace = 'normal';
                    textElement.innerHTML = val
                        ? `<img src="${this._escAttr(val)}" style="max-width:100%; max-height:100%; display:block; margin:0 auto; object-fit:contain;">`
                        : '—';
                } else if (binding.type === 'miniCalendar') {
                    // O valor aqui já é o HTML completo do card (múltiplas
                    // divs aninhadas, cada uma com quebras de linha/indentação
                    // entre as tags -- normal para HTML gerado por template
                    // literal). `white-space: pre-wrap` (necessário para
                    // preservar quebras de linha quando o conteúdo é texto
                    // digitado) faz o navegador renderizar TODAS essas
                    // quebras/indentações internas como espaço em branco
                    // visível -- inflando a barra do título (texto cercado de
                    // linhas em branco) e descentralizando o texto. HTML de
                    // verdade deve seguir a colagem de espaço em branco normal
                    // do HTML, então volta para `white-space: normal` aqui.
                    textElement.style.whiteSpace = 'normal';
                    textElement.innerHTML = val || '—';
                } else {
                    textElement.style.whiteSpace = 'pre-wrap';
                    textElement.textContent = (val && String(val).length) ? val : '—';
                }
                AutoFitText.applyAutoSize(element, textElement);
            });
        } else {
            textElement.style.whiteSpace = 'pre-wrap';
            textElement.textContent = I18n.t('variableContentTool.placeholder') || 'Configure uma variável...';
        }
    }

    /**
     * Aplica bold/italic/underline alternando o estilo do elemento inteiro
     * (não há seleção de texto para formatar, já que o conteúdo nunca é
     * digitado à mão -- é sempre o resultado resolvido de uma variável).
     */
    static _toggleCtxStyle(element, cssProp, onValue, offValue) {
        const text = element.contentArea.querySelector('[contenteditable]');
        if (!text) return;
        text.style[cssProp] = (text.style[cssProp] === onValue) ? offValue : onValue;
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
        const el = document.createElement('craftools-element');
        el.setAttribute('x', '50');
        el.setAttribute('y', '50');
        el.setAttribute('w', '220');
        el.setAttribute('h', '50');
        el.setAttribute('data-craftool', 'conteudovariavel');
        // Ajuste automático de tamanho começa DESLIGADO (ver AutoFitText.js/
        // CommonProperties.js -- só `true` liga o ajuste automático).
        el._craftoolsAutoResize = false;

        const content = document.createElement('div');
        content.setAttribute('contenteditable', 'false');
        content.setAttribute('spellcheck', 'false');
        content.style.cssText = `
            font-size: 16px;
            font-weight: 400;
            color: #1a1a1a;
            font-family: 'DM Sans', 'Noto Color Emoji', sans-serif;
            display: block;
            width: 100%;
            height: 100%;
            white-space: pre-wrap;
            word-break: break-word;
            cursor: default;
            line-height: 1.3;
            margin: 0;
            outline: 1px dashed var(--accent, #6366f1);
            outline-offset: 2px;
        `;
        content.textContent = I18n.t('variableContentTool.placeholder') || 'Configure uma variável...';

        el.appendChild(content);

        return el;
    }
}
