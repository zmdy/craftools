import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { CommonProperties } from "../../utils/CommonProperties.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { VariablePanel } from "../../utils/VariablePanel.js";
import { VariableEngine } from "../../utils/VariableEngine.js";
import "./TextTool_Translations.js";
import "../../components/CtFontSelect.js";

const FONTS = [
    'DM Sans', 'DM Serif Display', 'DM Mono', 'Open Sans', 'Pacifico', 'Lobster', 
    'Georgia', 'Arial', 'Times New Roman', 'Courier New', 'Impact',
    'Parisienne', 'Dancing Script', 'Quicksand', 'Quintessential', 'Grenze Gotisch'
];

/**
 * Carrega fontes do Google Fonts dinamicamente para exibição no editor.
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
    static renderPropertiesPanel(editorPanel, element) {
        const textElement = element.contentArea.querySelector('[contenteditable]');
        if(!textElement) return;

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

        // Current properties extracted from DOM style
        const currentColor = CommonProperties._rgbToHex(textElement.style.color || '#1a1a1a');
        let currentFont = textElement.style.fontFamily || 'DM Sans';
        currentFont = currentFont.replace(/['"]/g, '').split(',')[0].trim();
        const currentSize = parseFloat(textElement.style.fontSize) || 16;

        const htmlTipografia = `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('textTool.font') || 'Fonte'}</span>
                <ct-font-select id="text-prop-font" class="craftools-select" style="margin-bottom: 4px;"></ct-font-select>
                
                <div style="display: flex; gap: 6px; align-items: center;">
                    <input type="text" id="text-prop-custom-font" class="craftools-input"
                        placeholder="${I18n.t('textTool.localFontPlaceholder')}"
                        style="flex: 1; padding: 6px 9px; font-size: 11px;">
                    <button class="craftools-pill" id="text-prop-load-local" title="${I18n.t('textTool.listLocalFontsTitle')}" style="padding: 6px 8px; display: flex; align-items: center; gap: 3px;">
                        <span class="material-symbols-outlined" style="font-size: 14px;">desktop_windows</span> PC
                    </button>
                    <button class="craftools-pill" id="text-prop-upload-font-btn" title="Upload" style="padding: 6px 8px; display: flex; align-items: center; gap: 3px;">
                        <span class="material-symbols-outlined" style="font-size: 14px;">upload_file</span>
                    </button>
                    <input type="file" id="text-prop-font-file" accept=".ttf,.otf,.woff,.woff2" style="display:none;">
                </div>
            </div>
            
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('textTool.color') || 'Cor'}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="color" class="craftools-color-swatch" id="text-prop-color" value="${currentColor}">
                    <span style="font-size: 12px; color: var(--text-secondary)">${I18n.t('textTool.chooseColor') || 'Escolha a cor'}</span>
                </div>
            </div>
            
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('textTool.size') || 'Tamanho'}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="range" id="text-prop-size-range" min="8" max="200" step="1" style="flex:1;" value="${currentSize}">
                    <input type="number" class="craftools-input" id="text-prop-size-num" style="width: 55px; text-align: center;" value="${currentSize}">
                </div>
            </div>
        `;

        const htmlAlinhamento = `
            <div class="ct-field">
                <div style="display: flex; gap: 4px;">
                    <button class="craftools-pill text-align-btn" data-align="left" style="flex:1;justify-content:center;"><span class="material-symbols-outlined" style="font-size:14px;">format_align_left</span></button>
                    <button class="craftools-pill text-align-btn" data-align="center" style="flex:1;justify-content:center;"><span class="material-symbols-outlined" style="font-size:14px;">format_align_center</span></button>
                    <button class="craftools-pill text-align-btn" data-align="right" style="flex:1;justify-content:center;"><span class="material-symbols-outlined" style="font-size:14px;">format_align_right</span></button>
                    <button class="craftools-pill text-align-btn" data-align="justify" style="flex:1;justify-content:center;"><span class="material-symbols-outlined" style="font-size:14px;">format_align_justify</span></button>
                </div>
            </div>
        `;

        editorPanel.innerHTML = 
            PanelUI.accordion('text-tipo', 'text_fields', I18n.t('textTool.typography') || 'Tipografia', htmlTipografia, { open: true }) +
            PanelUI.accordion('text-align', 'format_align_left', I18n.t('textTool.align') || 'Alinhamento', htmlAlinhamento) +
            PanelUI.accordion('text-variavel', 'data_object', I18n.t('variablePanel.title'), VariablePanel.renderAccordionBody(element._craftoolsVariable, element));

        // Render Common Properties (Inherited from BaseTool now handles it all)
        this.renderCommonProperties(editorPanel, element, {
            border: '[contenteditable]',
            radius: '[contenteditable]',
            padding: '[contenteditable]',
            margin: '[contenteditable]',
            zindex: true
        });

        // Texto Variável — vincula o conteúdo deste elemento a uma variável
        // (data, número sequencial, número de página, link, frase da API...)
        // que será resolvida dinamicamente na Exportação de Agenda.
        VariablePanel.bind(editorPanel, element._craftoolsVariable, (binding) => {
            element._craftoolsVariable = binding;
            this._applyVariablePreview(element, textElement, binding);
        }, element);
        this._applyVariablePreview(element, textElement, element._craftoolsVariable);

        // Font dropdown
        const fontSelect = editorPanel.querySelector('#text-prop-font');
        const customFontInput = editorPanel.querySelector('#text-prop-custom-font');

        // Function to populate font select dropdown with standard and local fonts
        const populateFontSelect = (selectedFont) => {
            fontSelect.innerHTML = '';
            
            FONTS.forEach(font => {
                const option = document.createElement('option');
                option.value = font;
                option.textContent = font;
                option.style.fontFamily = `'${font}', sans-serif`;
                if(font === selectedFont) option.selected = true;
                fontSelect.appendChild(option);
            });

            // Load saved local fonts from localStorage
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
                        if(font === selectedFont) option.selected = true;
                        fontSelect.appendChild(option);
                    }
                });
            }
            
            // Adiciona fontes do IndexedDB
            if (window.__craftoolsCustomFonts) {
                Object.keys(window.__craftoolsCustomFonts).forEach(font => {
                    if (![...fontSelect.options].some(opt => opt.value === font)) {
                        const option = document.createElement('option');
                        option.value = font;
                        option.textContent = font;
                        option.style.fontFamily = `'${font}', sans-serif`;
                        if(font === selectedFont) option.selected = true;
                        fontSelect.appendChild(option);
                    }
                });
            }

            // Adiciona a fonte atual se for externa e não estiver na lista
            if (selectedFont && !FONTS.includes(selectedFont) && !savedLocalFonts.includes(selectedFont) && (!window.__craftoolsCustomFonts || !window.__craftoolsCustomFonts[selectedFont])) {
                const option = document.createElement('option');
                option.value = selectedFont;
                option.textContent = selectedFont;
                option.style.fontFamily = `'${selectedFont}', sans-serif`;
                option.selected = true;
                fontSelect.appendChild(option);
            }
        };

        // Carrega as fontes do Google Fonts para a página
        loadGoogleFonts(FONTS);
        
        // Inicializa o dropdown
        populateFontSelect(currentFont);

        if (currentFont && !FONTS.includes(currentFont)) {
            customFontInput.value = currentFont;
        }

        // BIND EVENTS
        fontSelect.addEventListener('change', (e) => {
            textElement.style.fontFamily = `'${e.target.value}', 'Noto Color Emoji', sans-serif`;
            customFontInput.value = FONTS.includes(e.target.value) ? '' : e.target.value;
            syncStyles();
            // Trigger an element update (bounding box might change)
            const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
            element.dispatchEvent(event);
        });

        // Eventos para busca de fonte customizada
        const applyCustomFont = () => {
            const fontName = customFontInput.value.trim();
            if (fontName) {
                textElement.style.fontFamily = `'${fontName}', 'Noto Color Emoji', sans-serif`;
                
                // Adiciona ao select se não existir
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

        // Botão para carregar fontes locais do PC
        const localBtn = editorPanel.querySelector('#text-prop-load-local');
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
                
                // Extrai famílias únicas
                const families = [...new Set(localFonts.map(f => f.family))].sort();
                
                // Salva no localStorage sobrescrevendo a lista anterior
                try {
                    localStorage.setItem('craftools-local-fonts', JSON.stringify(families));
                } catch (storeErr) {
                    console.error("Erro ao salvar fontes no localStorage", storeErr);
                }

                // Atualiza o select com as novas fontes mantendo a fonte atual selecionada
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

        // Botão de upload
        const uploadBtn = editorPanel.querySelector('#text-prop-upload-font-btn');
        const fileInput = editorPanel.querySelector('#text-prop-font-file');
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
                    
                    // Save to IndexedDB
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
                } catch(err) {
                    alert('Erro ao carregar fonte: ' + err.message);
                }
                uploadBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">upload_file</span>';
            });
        }


        const colorInput = editorPanel.querySelector('#text-prop-color');
        colorInput.addEventListener('input', (e) => {
            textElement.style.color = e.target.value;
            syncStyles();
        });

        const sizeRange = editorPanel.querySelector('#text-prop-size-range');
        const sizeNum = editorPanel.querySelector('#text-prop-size-num');
        
        const updateSize = (val) => {
            textElement.style.fontSize = val + 'px';
            sizeRange.value = val;
            sizeNum.value = val;
            syncStyles();
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
                syncStyles();
            });
        });

        // initial align setup
        const initialAlign = textElement.style.textAlign || 'left';
        editorPanel.querySelector(`.text-align-btn[data-align="${initialAlign}"]`)?.classList.add('active');
    }

    /**
     * Aplica (ou remove) o estado visual de "conteúdo variável" no elemento
     * de texto: quando vinculado a uma variável, o contenteditable fica
     * bloqueado e mostra um preview do valor resolvido (repetição de
     * amostra); o texto real só é definitivamente substituído no momento da
     * Exportação de Agenda (ver AgendaExport.js).
     */
    static _escAttr(val) {
        return String(val == null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    static _applyVariablePreview(element, textElement, binding) {
        if (binding && binding.type) {
            if (element._craftoolsVariablePrevHtml === undefined && textElement.getAttribute('contenteditable') !== 'false') {
                element._craftoolsVariablePrevHtml = textElement.innerHTML;
            }
            textElement.setAttribute('contenteditable', 'false');
            textElement.style.outline = '1px dashed var(--accent, #6366f1)';
            textElement.style.outlineOffset = '2px';
            textElement.style.cursor = 'default';
            textElement.textContent = I18n.t('variablePanel.previewLoading');
            VariableEngine.resolvePreview(binding).then(val => {
                if (binding.type === 'emojiKitchen') {
                    textElement.innerHTML = val
                        ? `<img src="${this._escAttr(val)}" style="max-width:100%; max-height:100%; display:block; margin:0 auto; object-fit:contain;">`
                        : '—';
                } else {
                    textElement.textContent = (val && String(val).length) ? val : '—';
                }
            });
        } else if (textElement.getAttribute('contenteditable') === 'false') {
            textElement.setAttribute('contenteditable', 'true');
            textElement.style.outline = '';
            textElement.style.outlineOffset = '';
            textElement.style.cursor = 'text';
            if (element._craftoolsVariablePrevHtml !== undefined) {
                textElement.innerHTML = element._craftoolsVariablePrevHtml;
                delete element._craftoolsVariablePrevHtml;
            }
        }
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
