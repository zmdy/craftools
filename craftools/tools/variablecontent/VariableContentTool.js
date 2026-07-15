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
    static renderPropertiesPanel(editorPanel, element) {
        const textElement = element.contentArea.querySelector('[contenteditable]');
        if (!textElement) return;

        const syncStyles = () => {
            const lid = element.getAttribute('data-linked-id');
            if (lid) {
                const css = textElement.style.cssText;
                document.querySelectorAll(`craftools-element[data-linked-id="${lid}"]`).forEach(clone => {
                    if (clone !== element) {
                        const cEdit = clone.contentArea?.querySelector('[contenteditable]');
                        if (cEdit) cEdit.style.cssText = css;
                    }
                });
            }
        };

        const currentColor = CommonProperties._rgbToHex(textElement.style.color || '#1a1a1a');
        let currentFont = textElement.style.fontFamily || 'DM Sans';
        currentFont = currentFont.replace(/['"]/g, '').split(',')[0].trim();
        const currentSize = parseFloat(textElement.style.fontSize) || 16;

        const htmlTipografia = `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('textTool.font') || 'Fonte'}</span>
                <ct-font-select id="vc-prop-font" class="craftools-select" style="margin-bottom: 4px;"></ct-font-select>

                <div style="display: flex; gap: 6px; align-items: center;">
                    <input type="text" id="vc-prop-custom-font" class="craftools-input"
                        placeholder="${I18n.t('textTool.localFontPlaceholder')}"
                        style="flex: 1; padding: 6px 9px; font-size: 11px;">
                    <button class="craftools-pill" id="vc-prop-load-local" title="${I18n.t('textTool.listLocalFontsTitle')}" style="padding: 6px 8px; display: flex; align-items: center; gap: 3px;">
                        <span class="material-symbols-outlined" style="font-size: 14px;">desktop_windows</span> PC
                    </button>
                    <button class="craftools-pill" id="vc-prop-upload-font-btn" title="Upload" style="padding: 6px 8px; display: flex; align-items: center; gap: 3px;">
                        <span class="material-symbols-outlined" style="font-size: 14px;">upload_file</span>
                    </button>
                    <input type="file" id="vc-prop-font-file" accept=".ttf,.otf,.woff,.woff2" style="display:none;">
                </div>
            </div>

            <div class="ct-field">
                <span class="craftools-label">${I18n.t('textTool.color') || 'Cor'}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="color" class="craftools-color-swatch" id="vc-prop-color" value="${currentColor}">
                    <span style="font-size: 12px; color: var(--text-secondary)">${I18n.t('textTool.chooseColor') || 'Escolha a cor'}</span>
                </div>
            </div>

            <div class="ct-field">
                <span class="craftools-label">${I18n.t('textTool.size') || 'Tamanho'}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="range" id="vc-prop-size-range" min="8" max="200" step="1" style="flex:1;" value="${currentSize}">
                    <input type="number" class="craftools-input" id="vc-prop-size-num" style="width: 55px; text-align: center;" value="${currentSize}">
                </div>
            </div>
        `;

        const htmlAlinhamento = `
            <div class="ct-field">
                <div style="display: flex; gap: 4px;">
                    <button class="craftools-pill vc-align-btn" data-align="left" style="flex:1;justify-content:center;"><span class="material-symbols-outlined" style="font-size:14px;">format_align_left</span></button>
                    <button class="craftools-pill vc-align-btn" data-align="center" style="flex:1;justify-content:center;"><span class="material-symbols-outlined" style="font-size:14px;">format_align_center</span></button>
                    <button class="craftools-pill vc-align-btn" data-align="right" style="flex:1;justify-content:center;"><span class="material-symbols-outlined" style="font-size:14px;">format_align_right</span></button>
                    <button class="craftools-pill vc-align-btn" data-align="justify" style="flex:1;justify-content:center;"><span class="material-symbols-outlined" style="font-size:14px;">format_align_justify</span></button>
                </div>
            </div>
        `;

        // Acordeão "Conteúdo Variável" primeiro e já aberto -- é a razão de
        // existir desta ferramenta -- seguido de Tipografia/Alinhamento
        // (para quando o valor resolvido é texto simples).
        editorPanel.innerHTML =
            PanelUI.accordion('vc-variavel', 'data_object', I18n.t('variableContentTool.panelTitle') || 'Conteúdo Variável', VariablePanel.renderAccordionBody(element._craftoolsVariable, element), { open: true }) +
            PanelUI.accordion('vc-tipo', 'text_fields', I18n.t('textTool.typography') || 'Tipografia', htmlTipografia) +
            PanelUI.accordion('vc-align', 'format_align_left', I18n.t('textTool.align') || 'Alinhamento', htmlAlinhamento);

        this.renderCommonProperties(editorPanel, element, {
            border: '[contenteditable]',
            radius: '[contenteditable]',
            padding: '[contenteditable]',
            margin: '[contenteditable]',
            zindex: true,
            autoFitText: true,
            onAutoFitToggle: (checked) => {
                if (checked) AutoFitText.applyAutoSize(element, textElement);
            }
        });

        // Vínculo de variável -- o coração desta ferramenta.
        VariablePanel.bind(editorPanel, element._craftoolsVariable, (binding) => {
            element._craftoolsVariable = binding;
            this._applyVariablePreview(element, textElement, binding);
        }, element);
        this._applyVariablePreview(element, textElement, element._craftoolsVariable);
        AutoFitText.applyAutoSize(element, textElement);

        // Font dropdown
        const fontSelect = editorPanel.querySelector('#vc-prop-font');
        const customFontInput = editorPanel.querySelector('#vc-prop-custom-font');

        const populateFontSelect = (selectedFont) => {
            fontSelect.innerHTML = '';

            FONTS.forEach(font => {
                const option = document.createElement('option');
                option.value = font;
                option.textContent = font;
                option.style.fontFamily = `'${font}', sans-serif`;
                if (font === selectedFont) option.selected = true;
                fontSelect.appendChild(option);
            });

            let savedLocalFonts = [];
            try {
                const stored = localStorage.getItem('craftools-local-fonts');
                if (stored) {
                    savedLocalFonts = JSON.parse(stored);
                }
            } catch (e) {
                console.error("Erro ao carregar fontes salvas", e);
            }

            if (Array.isArray(savedLocalFonts)) {
                savedLocalFonts.forEach(font => {
                    if (!FONTS.includes(font) && ![...fontSelect.options].some(opt => opt.value === font)) {
                        const option = document.createElement('option');
                        option.value = font;
                        option.textContent = font;
                        option.style.fontFamily = `'${font}', sans-serif`;
                        if (font === selectedFont) option.selected = true;
                        fontSelect.appendChild(option);
                    }
                });
            }

            if (window.__craftoolsCustomFonts) {
                Object.keys(window.__craftoolsCustomFonts).forEach(font => {
                    if (![...fontSelect.options].some(opt => opt.value === font)) {
                        const option = document.createElement('option');
                        option.value = font;
                        option.textContent = font;
                        option.style.fontFamily = `'${font}', sans-serif`;
                        if (font === selectedFont) option.selected = true;
                        fontSelect.appendChild(option);
                    }
                });
            }

            if (selectedFont && !FONTS.includes(selectedFont) && !savedLocalFonts.includes(selectedFont) && (!window.__craftoolsCustomFonts || !window.__craftoolsCustomFonts[selectedFont])) {
                const option = document.createElement('option');
                option.value = selectedFont;
                option.textContent = selectedFont;
                option.style.fontFamily = `'${selectedFont}', sans-serif`;
                option.selected = true;
                fontSelect.appendChild(option);
            }
        };

        loadGoogleFonts(FONTS);
        populateFontSelect(currentFont);

        if (currentFont && !FONTS.includes(currentFont)) {
            customFontInput.value = currentFont;
        }

        fontSelect.addEventListener('change', (e) => {
            textElement.style.fontFamily = `'${e.target.value}', 'Noto Color Emoji', sans-serif`;
            customFontInput.value = FONTS.includes(e.target.value) ? '' : e.target.value;
            syncStyles();
            AutoFitText.applyAutoSize(element, textElement);
            const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
            element.dispatchEvent(event);
        });

        const applyCustomFont = () => {
            const fontName = customFontInput.value.trim();
            if (fontName) {
                textElement.style.fontFamily = `'${fontName}', 'Noto Color Emoji', sans-serif`;

                if (![...fontSelect.options].some(opt => opt.value.toLowerCase() === fontName.toLowerCase())) {
                    const option = document.createElement('option');
                    option.value = fontName;
                    option.textContent = fontName;
                    option.style.fontFamily = `'${fontName}', sans-serif`;
                    fontSelect.appendChild(option);
                    option.selected = true;
                } else {
                    fontSelect.value = [...fontSelect.options].find(opt => opt.value.toLowerCase() === fontName.toLowerCase()).value;
                }
                syncStyles();
                AutoFitText.applyAutoSize(element, textElement);

                const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
                element.dispatchEvent(event);
            }
        };

        customFontInput.addEventListener('change', applyCustomFont);
        customFontInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                applyCustomFont();
            }
        });

        const localBtn = editorPanel.querySelector('#vc-prop-load-local');
        localBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const fontAccessApi = navigator.queryLocalFonts || window.queryLocalFonts;
            if (!fontAccessApi) {
                alert(I18n.t('textTool.localFontsUnsupported'));
                return;
            }

            try {
                localBtn.disabled = true;
                localBtn.innerHTML = '<span class="material-symbols-outlined spin" style="font-size: 14px;">progress_activity</span>';

                const localFonts = await fontAccessApi();
                const families = [...new Set(localFonts.map(f => f.family))].sort();

                try {
                    localStorage.setItem('craftools-local-fonts', JSON.stringify(families));
                } catch (storeErr) {
                    console.error("Erro ao salvar fontes no localStorage", storeErr);
                }

                populateFontSelect(fontSelect.value);

                alert(I18n.t('textTool.localFontsLoaded').replace('{n}', families.length));
                localBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span> PC';
            } catch (err) {
                console.error(err);
                alert(I18n.t('textTool.localFontsError') + " " + err.message);
                localBtn.disabled = false;
                localBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">desktop_windows</span> PC';
            }
        });

        const uploadBtn = editorPanel.querySelector('#vc-prop-upload-font-btn');
        const fileInput = editorPanel.querySelector('#vc-prop-font-file');
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                uploadBtn.innerHTML = '<span class="material-symbols-outlined spin" style="font-size: 14px;">progress_activity</span>';

                try {
                    const fontName = file.name.replace(/\.[^/.]+$/, "");
                    const buffer = await file.arrayBuffer();
                    const fontFace = new FontFace(fontName, buffer);
                    const loadedFace = await fontFace.load();
                    document.fonts.add(loadedFace);

                    window.__craftoolsCustomFonts = window.__craftoolsCustomFonts || {};
                    window.__craftoolsCustomFonts[fontName] = true;

                    const req = indexedDB.open('CraftoolsFonts', 1);
                    req.onupgradeneeded = (ev) => {
                        const db = ev.target.result;
                        if (!db.objectStoreNames.contains('fonts')) db.createObjectStore('fonts');
                    };
                    req.onsuccess = (ev) => {
                        const db = ev.target.result;
                        const tx = db.transaction('fonts', 'readwrite');
                        tx.objectStore('fonts').put(buffer, fontName);
                    };

                    populateFontSelect(fontName);
                    fontSelect.dispatchEvent(new Event('change'));
                } catch (err) {
                    alert('Erro ao carregar fonte: ' + err.message);
                }
                uploadBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">upload_file</span>';
            });
        }

        const colorInput = editorPanel.querySelector('#vc-prop-color');
        colorInput.addEventListener('input', (e) => {
            textElement.style.color = e.target.value;
            syncStyles();
        });

        const sizeRange = editorPanel.querySelector('#vc-prop-size-range');
        const sizeNum = editorPanel.querySelector('#vc-prop-size-num');

        const updateSize = (val) => {
            textElement.style.fontSize = val + 'px';
            sizeRange.value = val;
            sizeNum.value = val;
            syncStyles();
            AutoFitText.applyAutoSize(element, textElement);
            const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
            element.dispatchEvent(event);
        };

        sizeRange.addEventListener('input', (e) => updateSize(e.target.value));
        sizeNum.addEventListener('input', (e) => updateSize(e.target.value));

        const alignBtns = editorPanel.querySelectorAll('.vc-align-btn');
        alignBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                alignBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                textElement.style.textAlign = btn.getAttribute('data-align');
                syncStyles();
            });
        });

        const initialAlign = textElement.style.textAlign || 'left';
        editorPanel.querySelector(`.vc-align-btn[data-align="${initialAlign}"]`)?.classList.add('active');
    }

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
            textElement.textContent = I18n.t('variablePanel.previewLoading');
            VariableEngine.resolvePreview(binding).then(val => {
                if (binding.type === 'emojiKitchen') {
                    textElement.innerHTML = val
                        ? `<img src="${this._escAttr(val)}" style="max-width:100%; max-height:100%; display:block; margin:0 auto; object-fit:contain;">`
                        : '—';
                } else if (binding.type === 'miniCalendar') {
                    // O valor aqui já é o HTML completo do card -- insere
                    // direto via innerHTML, não como texto.
                    textElement.innerHTML = val || '—';
                } else {
                    textElement.textContent = (val && String(val).length) ? val : '—';
                }
                AutoFitText.applyAutoSize(element, textElement);
            });
        } else {
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
