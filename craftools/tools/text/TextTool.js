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
        const isGradient = textElement.style.webkitTextFillColor === 'transparent';
        const currentColor = isGradient ? '#1a1a1a' : CommonProperties._rgbToHex(textElement.style.color || '#1a1a1a');
        let currentFont = textElement.style.fontFamily || 'DM Sans';
        currentFont = currentFont.replace(/['"]/g, '').split(',')[0].trim();
        const currentSize = parseFloat(textElement.style.fontSize) || 16;

        // Parse gradient colors from existing background if present
        let gradFrom = '#f97316', gradTo = '#ec4899', gradAngle = 90;
        if (isGradient && textElement.style.background) {
            const m = textElement.style.background.match(/linear-gradient\((\d+)deg,\s*(#[\da-fA-F]+),\s*(#[\da-fA-F]+)\)/);
            if (m) { gradAngle = Number(m[1]); gradFrom = m[2]; gradTo = m[3]; }
        }

        const htmlTypography = `
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
                <span class="craftools-label">${I18n.t('textTool.size') || 'Tamanho'}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="range" id="text-prop-size-range" min="8" max="200" step="1" style="flex:1;" value="${currentSize}">
                    <input type="number" class="craftools-input" id="text-prop-size-num" style="width: 55px; text-align: center;" value="${currentSize}">
                </div>
            </div>
        `;

        const htmlColor = `
            <div class="ct-field">
                <!-- Solid / Gradient toggle -->
                <div style="display:flex;gap:5px;margin-bottom:10px;">
                    <button id="tp-mode-solid" style="
                        flex:1;padding:5px 8px;border-radius:8px;cursor:pointer;font-size:11px;font-family:inherit;
                        border:2px solid ${!isGradient ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};
                        background:${!isGradient ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)'};
                        color:var(--text);font-weight:600;">
                        ${I18n.t('textTool.solidColor') || 'Solid color'}
                    </button>
                    <button id="tp-mode-grad" style="
                        flex:1;padding:5px 8px;border-radius:8px;cursor:pointer;font-size:11px;font-family:inherit;
                        border:2px solid ${isGradient ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};
                        background:${isGradient ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)'};
                        color:var(--text);font-weight:600;">
                        ${I18n.t('textTool.gradient') || 'Gradiente'}
                    </button>
                </div>

                <!-- Solid color panel -->
                <div id="tp-solid-panel" style="display:${isGradient ? 'none' : 'flex'};align-items:center;gap:8px;">
                    <input type="color" class="craftools-color-swatch" id="text-prop-color" value="${currentColor}">
                    <span style="font-size:12px;color:var(--text-secondary)">${I18n.t('textTool.chooseColor') || 'Escolha a cor'}</span>
                </div>

                <!-- Gradient panel -->
                <div id="tp-grad-panel" style="display:${!isGradient ? 'none' : 'flex'};flex-direction:column;gap:8px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <div>
                            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${I18n.t('textTool.gradientFrom') || 'Cor inicial'}</div>
                            <input type="color" class="craftools-color-swatch" id="tp-grad-from" value="${gradFrom}" style="width:100%;height:32px;">
                        </div>
                        <div>
                            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${I18n.t('textTool.gradientTo') || 'Cor final'}</div>
                            <input type="color" class="craftools-color-swatch" id="tp-grad-to" value="${gradTo}" style="width:100%;height:32px;">
                        </div>
                    </div>
                    <div>
                        <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${I18n.t('textTool.gradientAngle') || 'Angle'}: <span id="tp-grad-angle-val">${gradAngle}</span>°</div>
                        <input type="range" id="tp-grad-angle" min="0" max="360" step="5" value="${gradAngle}"
                               style="width:100%;accent-color:var(--accent);">
                    </div>
                    <!-- Live preview bar -->
                    <div id="tp-grad-preview" style="
                        height:12px;border-radius:6px;
                        background:linear-gradient(${gradAngle}deg,${gradFrom},${gradTo});
                    "></div>
                </div>
            </div>
        `;

        const htmlAlignment = `
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
            PanelUI.accordion('text-tipo',  'text_fields',       I18n.t('textTool.typography') || 'Typography', htmlTypography, { open: true }) +
            PanelUI.accordion('text-cor',   'palette',           I18n.t('textTool.color') || 'Color',           htmlColor,       { open: true }) +
            PanelUI.accordion('text-align', 'format_align_left', I18n.t('textTool.align') || 'Alignment',       htmlAlignment);

        // Render Common Properties (Inherited from BaseTool now handles it all)
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

        AutoFitText.applyAutoSize(element, textElement);

        // Automatically adjusts element size as text is typed
        // (when auto-fit is active).
        textElement.addEventListener('input', () => {
            AutoFitText.applyAutoSize(element, textElement);
            const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
            element.dispatchEvent(event);
        });

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

            // Add the current font if it is external and not already in the list
            if (selectedFont && !FONTS.includes(selectedFont) && !savedLocalFonts.includes(selectedFont) && (!window.__craftoolsCustomFonts || !window.__craftoolsCustomFonts[selectedFont])) {
                const option = document.createElement('option');
                option.value = selectedFont;
                option.textContent = selectedFont;
                option.style.fontFamily = `'${selectedFont}', sans-serif`;
                option.selected = true;
                fontSelect.appendChild(option);
            }
        };

        // Load Google Fonts for the page
        loadGoogleFonts(FONTS);
        
        // Initialise the dropdown
        populateFontSelect(currentFont);

        if (currentFont && !FONTS.includes(currentFont)) {
            customFontInput.value = currentFont;
        }

        // BIND EVENTS
        fontSelect.addEventListener('change', (e) => {
            textElement.style.fontFamily = `'${e.target.value}', 'Noto Color Emoji', sans-serif`;
            customFontInput.value = FONTS.includes(e.target.value) ? '' : e.target.value;
            syncStyles();
            AutoFitText.applyAutoSize(element, textElement);
            // Trigger an element update (bounding box might change)
            const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
            element.dispatchEvent(event);
        });

        // Events for custom font lookup
        const applyCustomFont = () => {
            const fontName = customFontInput.value.trim();
            if (fontName) {
                textElement.style.fontFamily = `'${fontName}', 'Noto Color Emoji', sans-serif`;
                
                // Add to the select if not already present
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

        // Button to load local fonts from the device
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
                
                // Extract unique font families
                const families = [...new Set(localFonts.map(f => f.family))].sort();
                
                // Save to localStorage, overwriting the previous list
                try {
                    localStorage.setItem('craftools-local-fonts', JSON.stringify(families));
                } catch (storeErr) {
                    console.error("Error saving fonts to localStorage", storeErr);
                }

                // Update the select with new fonts, keeping the current font selected
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

        // Upload button
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


        // ── Gradient helpers ────────────────────────────────────────────────
        const applyGradient = (from, to, angle) => {
            textElement.style.background = `linear-gradient(${angle}deg, ${from}, ${to})`;
            textElement.style.webkitBackgroundClip = 'text';
            textElement.style.backgroundClip = 'text';
            textElement.style.webkitTextFillColor = 'transparent';
            textElement.style.color = 'transparent';
            const preview = editorPanel.querySelector('#tp-grad-preview');
            if (preview) preview.style.background = `linear-gradient(${angle}deg,${from},${to})`;
            syncStyles();
        };

        const applySolid = (color) => {
            textElement.style.background = '';
            textElement.style.webkitBackgroundClip = '';
            textElement.style.backgroundClip = '';
            textElement.style.webkitTextFillColor = '';
            textElement.style.color = color;
            syncStyles();
        };

        // Solid/Gradient mode toggle
        const tpModeSolid = editorPanel.querySelector('#tp-mode-solid');
        const tpModeGrad  = editorPanel.querySelector('#tp-mode-grad');
        const tpSolidPnl  = editorPanel.querySelector('#tp-solid-panel');
        const tpGradPnl   = editorPanel.querySelector('#tp-grad-panel');

        const activateMode = (mode) => {
            const solidActive = mode === 'solid';
            tpModeSolid.style.borderColor = solidActive ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)';
            tpModeSolid.style.background  = solidActive ? 'rgba(249,115,22,.07)'  : 'var(--bg-input,#f4f4f5)';
            tpModeGrad.style.borderColor  = !solidActive ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)';
            tpModeGrad.style.background   = !solidActive ? 'rgba(249,115,22,.07)'  : 'var(--bg-input,#f4f4f5)';
            tpSolidPnl.style.display = solidActive ? 'flex'   : 'none';
            tpGradPnl.style.display  = !solidActive ? 'flex'  : 'none';
        };

        tpModeSolid?.addEventListener('click', () => {
            activateMode('solid');
            const colorInput = editorPanel.querySelector('#text-prop-color');
            applySolid(colorInput?.value || '#1a1a1a');
        });

        tpModeGrad?.addEventListener('click', () => {
            activateMode('gradient');
            const from  = editorPanel.querySelector('#tp-grad-from')?.value  || gradFrom;
            const to    = editorPanel.querySelector('#tp-grad-to')?.value    || gradTo;
            const angle = editorPanel.querySelector('#tp-grad-angle')?.value || gradAngle;
            applyGradient(from, to, Number(angle));
        });

        // Solid color
        const colorInput = editorPanel.querySelector('#text-prop-color');
        colorInput?.addEventListener('input', (e) => {
            applySolid(e.target.value);
        });

        // Gradient controls
        const gradFromInput  = editorPanel.querySelector('#tp-grad-from');
        const gradToInput    = editorPanel.querySelector('#tp-grad-to');
        const gradAngleInput = editorPanel.querySelector('#tp-grad-angle');
        const gradAngleVal   = editorPanel.querySelector('#tp-grad-angle-val');

        const updateGrad = () => {
            const from  = gradFromInput?.value  || gradFrom;
            const to    = gradToInput?.value    || gradTo;
            const angle = Number(gradAngleInput?.value ?? gradAngle);
            if (gradAngleVal) gradAngleVal.textContent = angle;
            applyGradient(from, to, angle);
        };

        gradFromInput?.addEventListener('input', updateGrad);
        gradToInput?.addEventListener('input', updateGrad);
        gradAngleInput?.addEventListener('input', updateGrad);

        const sizeRange = editorPanel.querySelector('#text-prop-size-range');
        const sizeNum = editorPanel.querySelector('#text-prop-size-num');
        
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
