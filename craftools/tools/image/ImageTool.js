import { I18n } from "../../settings/Translations.js";
import { FILTERS_CONFIG, ImageFilters } from "./ImageFilters.js";
import { ImageTransform } from "./ImageTransform.js";
import { BaseTool } from "../BaseTool.js";
import { PanelUI } from "../../utils/PanelUI.js";
import "./ImageTool_Translations.js";

export class ImageTool extends BaseTool {

    static renderPropertiesPanel(editorPanel, element) {
        const meta = element._craftoolsMeta || this.getDefaultMeta();
        if (!element._craftoolsMeta) element._craftoolsMeta = meta;

        // --- CONTEXT IDENTIFIER ---
        // Setting this to true means the Image Properties is open.
        // ImageTransform.js uses this variable to allow/block Zoom, Pan and Rotation!
        element._isImageActive = true; 
        
        // Ensure content area is interactive now that panel is open
        if (element.contentArea) {
            element.contentArea.style.pointerEvents = 'auto';
            element.contentArea.style.cursor = 'move';
        }

        let filtersHtml = FILTERS_CONFIG.map(f => `
            <div class="ct-field-row" style="margin-bottom:8px;">
                <div class="ct-filter-icon" title="${I18n.t('imageTool.' + f.label)}">
                    <span class="material-symbols-outlined">${f.icon}</span>
                </div>
                <input type="range" class="filter-slider" data-key="${f.key}" data-unit="${f.unit || ''}" 
                    min="${f.min}" max="${f.max}" step="${f.step}" style="flex:1;" 
                    value="${meta.filters[f.key] !== undefined ? meta.filters[f.key] : f.def}">
                <span class="filter-val ct-val-badge">${meta.filters[f.key] !== undefined ? meta.filters[f.key] : f.def}${f.unit || ''}</span>
            </div>
        `).join('');

        const htmlFonte = `
            <div class="ct-field">
                <button class="craftools-topbtn" id="img-switch-btn" style="width: 100%; justify-content: center; gap: 8px; font-weight: 600;">
                    <span class="material-symbols-outlined" style="font-size: 18px;">photo_camera</span> ${I18n.t('imageTool.uploadPhoto')}
                </button>
                <input type="file" id="img-file-hidden" style="display:none;" accept="image/*">
            </div>

            <div class="ct-field">
                <span class="craftools-label">${I18n.t('imageTool.fit')}</span>
                <div style="display: flex; gap: 4px;">
                    ${['contain', 'cover', 'fill'].map(fit => `
                        <button class="craftools-pill fit-btn ${meta.objectFit === fit ? 'active' : ''}" data-fit="${fit}" style="flex:1;">${fit}</button>
                    `).join('')}
                </div>
            </div>
        `;

        const htmlTransformacao = `
            <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
                <button id="img-reset-btn" class="craftools-pill" style="font-size: 10px; color: var(--accent); padding: 4px 8px;">
                    <span class="material-symbols-outlined" style="font-size: 13px;">restart_alt</span> ${I18n.t('imageTool.reset')}
                </button>
            </div>

            <div class="ct-field">
                <div class="ct-sublabel"><span class="material-symbols-outlined">zoom_in</span>${I18n.t('imageTool.zoom')}</div>
                <div class="ct-field-row">
                    <input type="range" id="zoom-slider" min="0.1" max="5" step="0.05" value="${meta.zoom || 1}" style="flex:1;">
                    <span id="zoom-val-display" class="ct-val-badge">${Math.round((meta.zoom || 1) * 100)}%</span>
                </div>
            </div>

            <div class="ct-field">
                <div class="ct-sublabel"><span class="material-symbols-outlined">rotate_right</span>${I18n.t('imageTool.rotation')}</div>
                <div class="ct-field-row">
                    <input type="range" id="rotate-slider" min="-180" max="180" step="1" value="${meta.rotation || 0}" style="flex:1;">
                    <span id="rotate-val-display" class="ct-val-badge">${meta.rotation || 0}°</span>
                </div>
            </div>

            <div class="ct-field">
                <div class="ct-sublabel"><span class="material-symbols-outlined">open_with</span>${I18n.t('imageTool.position') || 'Posição na Máscara'}</div>
                <div class="ct-field-grid2">
                    <div style="display:flex;flex-direction:column;gap:3px;">
                        <span style="font-size:9px;color:var(--text-muted);">X</span>
                        <input type="number" id="pos-x-input" class="craftools-input" value="${Math.round(meta.posX || 0)}" style="text-align:center;padding:4px;">
                    </div>
                    <div style="display:flex;flex-direction:column;gap:3px;">
                        <span style="font-size:9px;color:var(--text-muted);">Y</span>
                        <input type="number" id="pos-y-input" class="craftools-input" value="${Math.round(meta.posY || 0)}" style="text-align:center;padding:4px;">
                    </div>
                </div>
            </div>
        `;

        const htmlEfeitos = `
            <div class="ct-field">
                <div class="ct-sublabel"><span class="material-symbols-outlined">blur_on</span>${I18n.t('imageTool.bgBlur')}</div>
                <div class="ct-field-row">
                    <input type="range" id="bgblur-slider" min="0" max="100" step="1" value="${meta.bgBlur || 0}" style="flex:1;">
                    <span id="bgblur-val-display" class="ct-val-badge">${meta.bgBlur || 0}px</span>
                </div>
            </div>
        `;

        editorPanel.innerHTML = 
            PanelUI.accordion('img-fonte', 'photo_camera', I18n.t('imageTool.source') || 'Fonte', htmlFonte, { open: true }) +
            PanelUI.accordion('img-transform', 'transform', I18n.t('imageTool.transform') || 'Transformação', htmlTransformacao) +
            PanelUI.accordion('img-filters', 'auto_fix_high', I18n.t('imageTool.cssFilters'), filtersHtml) +
            PanelUI.accordion('img-efeitos', 'magic_button', I18n.t('imageTool.effects') || 'Efeitos', htmlEfeitos);

        
        // Render Common Properties (Inherited)
        this.renderCommonProperties(editorPanel, element, {
            border: 'img',
            radius: 'img',
            zindex: true,
            onChange: () => {
                const img = element.contentArea.querySelector('img');
                if (img) {
                    meta.borderWidth = parseFloat(img.style.borderWidth) || 0;
                    meta.borderStyle = img.style.borderStyle || 'none';
                    meta.borderColor = img.style.borderColor || '#000000';
                    meta.borderRadius = img.style.borderRadius || '0px';
                }
                if (element._syncSidebar) element._syncSidebar();
            }
        });

        // Interaction Bindings
        const syncSliders = () => {
             const zoomSlider = editorPanel.querySelector('#zoom-slider');
             if (!zoomSlider) return;

             zoomSlider.value = meta.zoom;
             editorPanel.querySelector('#zoom-val-display').textContent = Math.round(meta.zoom * 100) + '%';
             editorPanel.querySelector('#rotate-slider').value = meta.rotation;
             editorPanel.querySelector('#rotate-val-display').textContent = meta.rotation + '°';
             editorPanel.querySelector('#pos-x-input').value = Math.round(meta.posX);
             editorPanel.querySelector('#pos-y-input').value = Math.round(meta.posY);

             const bgBlurSlider = editorPanel.querySelector('#bgblur-slider');
             if (bgBlurSlider) {
                 bgBlurSlider.value = meta.bgBlur || 0;
                 editorPanel.querySelector('#bgblur-val-display').textContent = (meta.bgBlur || 0) + 'px';
             }

             this._applyBgBlur(element);

             // Propagate to linked elements (Business Card mode)
             if (element._linkedElements) {
                 element._linkedElements.forEach(sibling => {
                     if (sibling !== element) {
                         ImageTransform.applyTransform(sibling);
                         ImageFilters.applyFilters(sibling);
                         // Apply borders and radius to siblings
                         const siblingImg = sibling.contentArea.querySelector('img');
                         if (siblingImg) {
                             siblingImg.style.borderWidth = meta.borderWidth + 'px';
                             siblingImg.style.borderStyle = meta.borderStyle;
                             siblingImg.style.borderColor = meta.borderColor;
                             siblingImg.style.borderRadius = meta.borderRadius + 'px';
                         }
                     }
                 });
             }
        };
        element._syncSidebar = syncSliders;

        // Bind Reset
        editorPanel.querySelector('#img-reset-btn').onclick = () => {
            const defaults = this.getDefaultMeta();
            meta.zoom = defaults.zoom;
            meta.posX = defaults.posX;
            meta.posY = defaults.posY;
            meta.rotation = defaults.rotation;
            meta.bgBlur = defaults.bgBlur;
            meta.objectFit = defaults.objectFit;
            FILTERS_CONFIG.forEach(f => meta.filters[f.key] = f.def);
            ImageTransform.applyTransform(element);
            ImageFilters.applyFilters(element);
            // Re-render the whole panel to reflect reset state (sliders, fit buttons)
            this.renderPropertiesPanel(editorPanel, element);
        };

        // Bind Switch
        const fileInput = editorPanel.querySelector('#img-file-hidden');
        editorPanel.querySelector('#img-switch-btn').onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = ev => {
                    meta.src = ev.target.result;
                    const img = element.contentArea.querySelector('img');
                    if (img) img.src = meta.src;
                };
                reader.readAsDataURL(file);
            }
        };

        // Bind Fit
        editorPanel.querySelectorAll('.fit-btn').forEach(btn => {
            btn.onclick = () => {
                editorPanel.querySelectorAll('.fit-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                meta.objectFit = btn.dataset.fit;
                ImageFilters.applyFilters(element);
                if (element._syncSidebar) element._syncSidebar();
            };
        });

        // Bind Zoom Slider
        const zoomSlider = editorPanel.querySelector('#zoom-slider');
        zoomSlider.oninput = (e) => {
            meta.zoom = parseFloat(e.target.value);
            editorPanel.querySelector('#zoom-val-display').textContent = Math.round(meta.zoom * 100) + '%';
            ImageTransform.applyTransform(element);
            if (element._syncSidebar) element._syncSidebar();
        };

        // Bind Rotate Slider
        const rotateSlider = editorPanel.querySelector('#rotate-slider');
        rotateSlider.oninput = (e) => {
            meta.rotation = parseFloat(e.target.value);
            editorPanel.querySelector('#rotate-val-display').textContent = meta.rotation + '°';
            ImageTransform.applyTransform(element);
            if (element._syncSidebar) element._syncSidebar();
        };

        // Bind Position Inputs
        const posXInput = editorPanel.querySelector('#pos-x-input');
        const posYInput = editorPanel.querySelector('#pos-y-input');
        const updatePos = () => {
            meta.posX = parseFloat(posXInput.value) || 0;
            meta.posY = parseFloat(posYInput.value) || 0;
            ImageTransform.applyTransform(element);
            if (element._syncSidebar) element._syncSidebar();
        };
        posXInput.oninput = updatePos;
        posYInput.oninput = updatePos;

        // Bind Filters
        editorPanel.querySelectorAll('.filter-slider').forEach(slider => {
            slider.oninput = (e) => {
                const val = e.target.value;
                const key = e.target.dataset.key;
                meta.filters[key] = val;
                slider.nextElementSibling.textContent = val;
                ImageFilters.applyFilters(element);
                if (element._syncSidebar) element._syncSidebar();
            };
        });

        // Bind Background Blur
        const bgBlurSlider = editorPanel.querySelector('#bgblur-slider');
        if (bgBlurSlider) {
            bgBlurSlider.oninput = (e) => {
                meta.bgBlur = parseInt(e.target.value);
                editorPanel.querySelector('#bgblur-val-display').textContent = meta.bgBlur + 'px';
                this._applyBgBlur(element);
                if (element._syncSidebar) element._syncSidebar();
            };
        }

        // ── Grid Cell background & overlay integration ─────────────────────
        const cellEl = element.closest('.craftools-grid-cell');
        if (cellEl) {
            // Create a placeholder accordion at the top level of the panel
            const cellAccWrapper = document.createElement('div');
            cellAccWrapper.className = 'ct-accordion';
            cellAccWrapper.dataset.accordionId = 'img-cell-bg';
            editorPanel.appendChild(cellAccWrapper);

            // Import dinâmico para evitar dependências circulares
            // (também garante que as traduções de CellPanel estejam carregadas)
            import('../album/CellPanel.js').then(({ CellPanel }) => {
                // Render the accordion header now that translations are available
                cellAccWrapper.innerHTML = `
                    <button class="ct-accordion-header" type="button" data-toggle-accordion="img-cell-bg">
                        <span class="ct-accordion-icon">
                            <span class="material-symbols-outlined">background_2</span>
                        </span>
                        <span class="ct-accordion-title">${I18n.t('cellPanel.bgOverlayHeader') || 'Fundo & Overlay'}</span>
                        <span class="ct-accordion-chevron">
                            <span class="material-symbols-outlined">expand_more</span>
                        </span>
                    </button>
                    <div class="ct-accordion-body">
                        <div class="ct-accordion-content" id="img-cell-bg-content"></div>
                    </div>
                `;

                // Bind this new accordion into the one-open-at-a-time logic
                import('../../utils/PanelUI.js').then(({ PanelUI }) => {
                    PanelUI.bindAccordions(editorPanel);
                });

                const content = editorPanel.querySelector('#img-cell-bg-content');
                if (content) {
                    CellPanel.renderInto(content, cellEl, () => {
                        // Callback quando propriedades do fundo mudarem
                    });
                }
            });
        }

    }

    static _applyBgBlur(element) {
        const meta = element._craftoolsMeta;
        if (!meta) return;

        let blurBg = element.querySelector('.craftools-element-blur-bg');
        
        if (meta.bgBlur <= 0) {
            if (blurBg) blurBg.remove();
            element.style.overflow = "";
            return;
        }

        if (!blurBg) {
            element.style.overflow = "hidden";
            blurBg = document.createElement('div');
            blurBg.className = "craftools-element-blur-bg";
            blurBg.style.cssText = `
                position: absolute;
                inset: -20px;
                background-size: cover;
                background-position: center;
                opacity: 0.6;
                pointer-events: none;
                z-index: -1;
            `;
            element.insertBefore(blurBg, element.firstChild);
        }

        blurBg.style.backgroundImage = `url(${meta.src})`;
        blurBg.style.filter = `blur(${meta.bgBlur}px)`;
    }

    static getCtxOptions() {
        return [
            {
                icon: 'published_with_changes',
                label: I18n.t('imageTool.switchPhoto'),
                command: (element) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = () => {
                        const file = input.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = e => {
                                if (!element._craftoolsMeta) element._craftoolsMeta = this.getDefaultMeta();
                                element._craftoolsMeta.src = e.target.result;
                                const img = element.contentArea.querySelector('img');
                                if (img) img.src = e.target.result;

                                 // Atualiza fundo desfocado se existir
                                 const blurBg = element.querySelector('.craftools-element-blur-bg');
                                 if (blurBg) blurBg.style.backgroundImage = `url(${e.target.result})`;
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    input.click();
                }
            }
        ];
    }

    static getDefaultMeta() {
        const meta = {
            src: '',
            objectFit: 'cover',
            zoom: 1,
            posX: 0,
            posY: 0,
            rotation: 0,
            bgBlur: 0, // Default 0 (off)
            borderWidth: 0,
            borderStyle: 'none',
            borderColor: '#000000',
            borderRadius: 0,
            filters: {}
        };
        FILTERS_CONFIG.forEach(f => meta.filters[f.key] = f.def);
        return meta;
    }

    static createElement(type, editorApp) {
        const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E";
        
        const el = document.createElement('craftools-element');
        el.setAttribute('x', '50');
        el.setAttribute('y', '50');
        el.setAttribute('w', '200');
        el.setAttribute('h', '200');
        el.setAttribute('data-craftool', 'imagem');

        el._craftoolsMeta = this.getDefaultMeta();
        el._craftoolsMeta.src = placeholder;

        const img = document.createElement('img');
        img.src = placeholder;
        img.style.cssText = `display:block;width:100%;height:100%;object-fit:${el._craftoolsMeta.objectFit};user-select:none;pointer-events:none;`;

        el.appendChild(img);
        
        // Wait for the web component to be connected and built
        const initElement = () => {
            if (el.contentArea) {
                ImageTransform.setupInteractions(el);
                ImageTransform.applyTransform(el);
                ImageFilters.applyFilters(el);
                this._applyBgBlur(el);
            } else {
                requestAnimationFrame(initElement);
            }
        };
        initElement();

        return el;
    }
}
