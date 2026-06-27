export const FILTERS_CONFIG = [
    { key: 'brightness', label: 'brightness', min: 0, max: 2, step: 0.01, def: 1, icon: 'light_mode' },
    { key: 'contrast', label: 'contrast', min: 0, max: 3, step: 0.01, def: 1, icon: 'contrast' },
    { key: 'saturate', label: 'saturate', min: 0, max: 3, step: 0.01, def: 1, icon: 'water_drop' },
    { key: 'hue-rotate', label: 'hueRotate', min: 0, max: 360, step: 1, def: 0, unit: 'deg', icon: 'palette' },
    { key: 'blur', label: 'blur', min: 0, max: 20, step: 0.1, def: 0, unit: 'px', icon: 'blur_on' },
    { key: 'grayscale', label: 'grayscale', min: 0, max: 1, step: 0.01, def: 0, icon: 'filter_b_and_w' },
    { key: 'sepia', label: 'sepia', min: 0, max: 1, step: 0.01, def: 0, icon: 'coffee' },
    { key: 'invert', label: 'invert', min: 0, max: 1, step: 0.01, def: 0, icon: 'invert_colors' },
    { key: 'opacity', label: 'opacity', min: 0, max: 1, step: 0.01, def: 1, icon: 'opacity' }
];

export class ImageFilters {
    static getFiltersString(meta) {
        if (!meta || !meta.filters) return '';
        return FILTERS_CONFIG.map(f => {
            const val = meta.filters[f.key] !== undefined ? meta.filters[f.key] : f.def;
            return `${f.key}(${val}${f.unit || ''})`;
        }).join(' ');
    }

    static applyFilters(element) {
        const meta = element._craftoolsMeta;
        if (!meta) return;
        
        const content = element.contentArea || element;
        const img = content.querySelector('img');
        if (!img) return;

        img.style.filter = this.getFiltersString(meta);
        img.style.objectFit = meta.objectFit;
    }
}
