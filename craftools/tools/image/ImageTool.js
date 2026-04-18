import { I18n } from "../../settings/Translations.js";
import "./ImageTool_Translations.js";

const FILTERS_CONFIG = [
    { key: 'brightness', label: 'brightness', min: 0, max: 2, step: 0.01, def: 1 },
    { key: 'contrast', label: 'contrast', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'saturate', label: 'saturate', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'hue-rotate', label: 'hueRotate', min: 0, max: 360, step: 1, def: 0, unit: 'deg' },
    { key: 'blur', label: 'blur', min: 0, max: 20, step: 0.1, def: 0, unit: 'px' },
    { key: 'grayscale', label: 'grayscale', min: 0, max: 1, step: 0.01, def: 0 },
    { key: 'sepia', label: 'sepia', min: 0, max: 1, step: 0.01, def: 0 },
    { key: 'invert', label: 'invert', min: 0, max: 1, step: 0.01, def: 0 },
    { key: 'opacity', label: 'opacity', min: 0, max: 1, step: 0.01, def: 1 }
];

export class ImageTool {
    static getFiltersString(meta) {
        if (!meta || !meta.filters) return '';
        return FILTERS_CONFIG.map(f => {
            const val = meta.filters[f.key] !== undefined ? meta.filters[f.key] : f.def;
            return `${f.key}(${val}${f.unit || ''})`;
        }).join(' ');
    }

    static renderPropertiesPanel(editorPanel, element) {
        const meta = element._craftoolsMeta || { filters: {}, objectFit: 'contain' };
        if (!element._craftoolsMeta) element._craftoolsMeta = meta;

        const img = element.contentArea.querySelector('img');

        let filtersHtml = FILTERS_CONFIG.map(f => `
            <div class="craftools-field" style="padding: 8px 0;">
                <span class="craftools-label">${I18n.t('imageTool.' + f.label)}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="range" class="filter-slider" data-key="${f.key}" data-unit="${f.unit || ''}" 
                        min="${f.min}" max="${f.max}" step="${f.step}" style="flex:1;" 
                        value="${meta.filters[f.key] !== undefined ? meta.filters[f.key] : f.def}">
                    <span class="filter-val" style="font-size: 11px; width: 30px; text-align: right;">${meta.filters[f.key] !== undefined ? meta.filters[f.key] : f.def}</span>
                </div>
            </div>
        `).join('');

        editorPanel.innerHTML = `
            <div style="padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div class="craftools-field">
                    <span class="craftools-label">${I18n.t('imageTool.switchPhoto')}</span>
                    <button class="craftools-topbtn" id="img-switch-btn" style="width: 100%; justify-content: center;">
                        <span class="material-symbols-outlined">photo_camera</span> ${I18n.t('imageTool.uploadPhoto')}
                    </button>
                    <input type="file" id="img-file-hidden" style="display:none;" accept="image/*">
                </div>

                <div class="craftools-field">
                    <span class="craftools-label">${I18n.t('imageTool.fit')}</span>
                    <div style="display: flex; gap: 4px;">
                        ${['contain', 'cover', 'fill'].map(fit => `
                            <button class="craftools-pill fit-btn ${meta.objectFit === fit ? 'active' : ''}" data-fit="${fit}">${fit}</button>
                        `).join('')}
                    </div>
                </div>

                <div style="padding: 10px 0 4px; font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; border-top: 1px solid var(--border); margin-top: 5px;">
                    ${I18n.t('imageTool.cssFilters')}
                </div>
                ${filtersHtml}
            </div>
        `;

        // Bind Switch
        const fileInput = editorPanel.querySelector('#img-file-hidden');
        const switchBtn = editorPanel.querySelector('#img-switch-btn');
        switchBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = ev => {
                    meta.src = ev.target.result;
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
                if (img) img.style.objectFit = meta.objectFit;
            };
        });

        // Bind Filters
        editorPanel.querySelectorAll('.filter-slider').forEach(slider => {
            slider.oninput = (e) => {
                const val = e.target.value;
                const key = e.target.dataset.key;
                meta.filters[key] = val;
                slider.nextElementSibling.textContent = val;
                if (img) img.style.filter = this.getFiltersString(meta);
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
                                if (!element._craftoolsMeta) element._craftoolsMeta = { filters: {}, objectFit: 'contain' };
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

    static createElement(type, editorApp) {
        const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E";
        
        const el = document.createElement('craftools-element');
        el.setAttribute('x', '50');
        el.setAttribute('y', '50');
        el.setAttribute('w', '200');
        el.setAttribute('h', '150');
        el.setAttribute('data-craftool', 'imagem');

        const meta = {
            src: placeholder,
            objectFit: 'contain',
            filters: {}
        };
        FILTERS_CONFIG.forEach(f => meta.filters[f.key] = f.def);
        el._craftoolsMeta = meta;

        const img = document.createElement('img');
        img.src = placeholder;
        img.style.cssText = `display:block;width:100%;height:100%;object-fit:${meta.objectFit};user-select:none;pointer-events:none;filter:${this.getFiltersString(meta)};`;

        el.appendChild(img);
        return el;
    }
}
