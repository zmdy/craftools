import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import "./TextTool_Translations.js";

const FONTS = [
    'DM Sans', 'DM Serif Display', 'DM Mono', 'Open Sans', 'Pacifico', 'Lobster', 
    'Georgia', 'Arial', 'Times New Roman', 'Courier New', 'Impact',
    'Parisienne', 'Dancing Script', 'Quicksand'
];

export class TextTool extends BaseTool {
    static renderPropertiesPanel(editorPanel, element) {
        const textElement = element.contentArea.querySelector('[contenteditable]');
        if(!textElement) return;

        // Current properties extracted from DOM style
        const currentColor = textElement.style.color || '#1a1a1a';
        let currentFont = textElement.style.fontFamily || 'DM Sans';
        currentFont = currentFont.replace(/['"]/g, '').split(',')[0].trim();
        const currentSize = parseFloat(textElement.style.fontSize) || 16;

        let html = `
            <div style="padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div class="craftools-field" style="padding: 0 0 10px 0;">
                    <span class="craftools-label">${I18n.t('textTool.font') || 'Fonte'}</span>
                    <select id="text-prop-font" class="craftools-select"></select>
                </div>
                
                <div class="craftools-field" style="padding: 10px 0;">
                    <span class="craftools-label">${I18n.t('textTool.color') || 'Cor'}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="color" class="craftools-color-swatch" id="text-prop-color" value="${currentColor}">
                        <span style="font-size: 12px; color: var(--text-secondary)">${I18n.t('textTool.chooseColor') || 'Escolha a cor'}</span>
                    </div>
                </div>
                
                <div class="craftools-field" style="padding: 10px 0;">
                    <span class="craftools-label">${I18n.t('textTool.size') || 'Tamanho'}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="range" id="text-prop-size-range" min="8" max="200" step="1" style="flex:1;" value="${currentSize}">
                        <input type="number" class="craftools-input" id="text-prop-size-num" style="width: 55px; text-align: center;" value="${currentSize}">
                    </div>
                </div>
                
                <div class="craftools-field" style="padding: 10px 0; border-bottom: none;">
                    <span class="craftools-label">${I18n.t('textTool.align') || 'Alinhamento'}</span>
                    <div style="display: flex; gap: 4px;">
                        <button class="craftools-pill text-align-btn" data-align="left"><span class="material-symbols-outlined" style="font-size:14px;">format_align_left</span></button>
                        <button class="craftools-pill text-align-btn" data-align="center"><span class="material-symbols-outlined" style="font-size:14px;">format_align_center</span></button>
                        <button class="craftools-pill text-align-btn" data-align="right"><span class="material-symbols-outlined" style="font-size:14px;">format_align_right</span></button>
                        <button class="craftools-pill text-align-btn" data-align="justify"><span class="material-symbols-outlined" style="font-size:14px;">format_align_justify</span></button>
                    </div>
                </div>
            </div>
        `;
        
        editorPanel.innerHTML = html;

        // Render Common Properties (Inherited)
        this.renderCommonProperties(editorPanel.firstElementChild, element, {
            border: '[contenteditable]',
            radius: '[contenteditable]',
            padding: '[contenteditable]',
            zindex: true
        });
        
        // Font dropdown
        const fontSelect = editorPanel.querySelector('#text-prop-font');
        FONTS.forEach(font => {
            const option = document.createElement('option');
            option.value = font;
            option.textContent = font;
            if(font === currentFont) option.selected = true;
            fontSelect.appendChild(option);
        });

        // BIND EVENTS
        fontSelect.addEventListener('change', (e) => {
            textElement.style.fontFamily = `'${e.target.value}', sans-serif`;
            // Trigger an element update (bounding box might change)
            const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
            element.dispatchEvent(event);
        });

        const colorInput = editorPanel.querySelector('#text-prop-color');
        colorInput.addEventListener('input', (e) => {
            textElement.style.color = e.target.value;
        });

        const sizeRange = editorPanel.querySelector('#text-prop-size-range');
        const sizeNum = editorPanel.querySelector('#text-prop-size-num');
        
        const updateSize = (val) => {
            textElement.style.fontSize = val + 'px';
            sizeRange.value = val;
            sizeNum.value = val;
            const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
            element.dispatchEvent(event);
        };

        sizeRange.addEventListener('input', (e) => updateSize(e.target.value));
        sizeNum.addEventListener('input', (e) => updateSize(e.target.value));

        const alignBtns = editorPanel.querySelectorAll('.text-align-btn');
        alignBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                alignBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                textElement.style.textAlign = btn.getAttribute('data-align');
            });
        });

        // initial align setup
        const initialAlign = textElement.style.textAlign || 'left';
        editorPanel.querySelector(`.text-align-btn[data-align="${initialAlign}"]`)?.classList.add('active');
    }

    static getCtxOptions() {
        return [
            {
                icon: 'format_bold',
                label: I18n.t('textTool.bold'),
                command: (element) => {
                    const text = element.contentArea.querySelector('[contenteditable]');
                    if (text) {
                        text.focus();
                        document.execCommand('bold');
                    }
                }
            },
            {
                icon: 'format_italic',
                label: I18n.t('textTool.italic'),
                command: (element) => {
                    const text = element.contentArea.querySelector('[contenteditable]');
                    if (text) {
                        text.focus();
                        document.execCommand('italic');
                    }
                }
            },
            {
                icon: 'format_underlined',
                label: I18n.t('textTool.underline'),
                command: (element) => {
                    const text = element.contentArea.querySelector('[contenteditable]');
                    if (text) {
                        text.focus();
                        document.execCommand('underline');
                    }
                }
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

        const content = document.createElement(tag);
        content.setAttribute('contenteditable', 'true');
        content.setAttribute('spellcheck', 'false');
        content.style.cssText = `
            font-size: ${size}px;
            font-weight: ${weight};
            color: #1a1a1a;
            font-family: 'DM Sans', sans-serif;
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
