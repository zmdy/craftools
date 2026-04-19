import { I18n } from "../../settings/Translations.js";
import { FILTERS_CONFIG, ImageFilters } from "./ImageFilters.js";
import { ImageTransform } from "./ImageTransform.js";
import "./ImageTool_Translations.js";

export class ImageTool {

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
            <div class="craftools-field" style="padding: 4px 0;">
                <span class="craftools-label">${I18n.t('imageTool.' + f.label)}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="range" class="filter-slider" data-key="${f.key}" data-unit="${f.unit || ''}" 
                        min="${f.min}" max="${f.max}" step="${f.step}" style="flex:1;" 
                        value="${meta.filters[f.key] !== undefined ? meta.filters[f.key] : f.def}">
                    <span class="filter-val" style="font-size: 11px; width: 33px; text-align: right; color: var(--text-muted); font-family: monospace;">${meta.filters[f.key] !== undefined ? meta.filters[f.key] : f.def}</span>
                </div>
            </div>
        `).join('');

        editorPanel.innerHTML = `
            <div style="padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div class="craftools-panel-section">
                    <button class="craftools-topbtn" id="img-switch-btn" style="width: 100%; justify-content: center; gap: 8px; font-weight: 600;">
                        <span class="material-symbols-outlined" style="font-size: 18px;">photo_camera</span> ${I18n.t('imageTool.uploadPhoto')}
                    </button>
                    <input type="file" id="img-file-hidden" style="display:none;" accept="image/*">
                </div>

                <div class="craftools-field">
                    <span class="craftools-label">${I18n.t('imageTool.fit')}</span>
                    <div style="display: flex; gap: 4px;">
                        ${['contain', 'cover', 'fill'].map(fit => `
                            <button class="craftools-pill fit-btn ${meta.objectFit === fit ? 'active' : ''}" data-fit="${fit}" style="flex:1;">${fit}</button>
                        `).join('')}
                    </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0 4px; border-top: 1px solid var(--border); margin-top: 5px;">
                    <span style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">${I18n.t('imageTool.transform') || 'Ajustes de Transformação'}</span>
                    <button id="img-reset-btn" style="font-size: 10px; color: var(--accent); background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 3px; font-family: 'DM Sans', sans-serif; padding: 2px 4px; border-radius: 4px;">
                        <span class="material-symbols-outlined" style="font-size: 13px;">restart_alt</span> Reset
                    </button>
                </div>

                <div class="craftools-field">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span class="craftools-label" style="margin:0;">${I18n.t('imageTool.zoom')}</span>
                        <span id="zoom-val-display" style="font-size: 11px; font-family: monospace; color: var(--accent); font-weight: bold;">${Math.round((meta.zoom || 1) * 100)}%</span>
                    </div>
                    <input type="range" id="zoom-slider" min="0.1" max="5" step="0.05" value="${meta.zoom || 1}" style="width:100%;">
                </div>

                <div class="craftools-field">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span class="craftools-label" style="margin:0;">${I18n.t('imageTool.rotation')}</span>
                        <span id="rotate-val-display" style="font-size: 11px; font-family: monospace; color: var(--accent); font-weight: bold;">${meta.rotation || 0}°</span>
                    </div>
                    <input type="range" id="rotate-slider" min="-180" max="180" step="1" value="${meta.rotation || 0}" style="width:100%;">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('imageTool.posX')}</span>
                        <input type="number" id="pos-x-input" class="craftools-input" value="${Math.round(meta.posX || 0)}" style="width: 100%;">
                    </div>
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('imageTool.posY')}</span>
                        <input type="number" id="pos-y-input" class="craftools-input" value="${Math.round(meta.posY || 0)}" style="width: 100%;">
                    </div>
                </div>

                <div style="padding: 10px 0 4px; font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; border-top: 1px solid var(--border); margin-top: 5px; letter-spacing: 0.5px;">
                    ${I18n.t('imageTool.cssFilters')}
                </div>
                ${filtersHtml}
            </div>
        `;

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

             // Propagate to linked elements (Business Card mode)
             if (element._linkedElements) {
                 element._linkedElements.forEach(sibling => {
                     if (sibling !== element) {
                         ImageTransform.applyTransform(sibling);
                         ImageFilters.applyFilters(sibling);
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
            } else {
                requestAnimationFrame(initElement);
            }
        };
        initElement();

        return el;
    }
}
