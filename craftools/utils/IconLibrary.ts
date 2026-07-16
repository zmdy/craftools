// @ts-nocheck
/**
 * IconLibrary
 *
 * Central registry for SVG icon packs used by the Icon tool
 * (tools/icon/IconTool.js).
 *
 * Each pack is a named collection of icons from a different source
 * (Material Symbols by default — see utils/icons/MaterialSymbolsPack.js —
 * but the design allows registering any number of additional packs: Lucide,
 * Heroicons, a user-uploaded pack, etc.) without modifying this file or
 * IconTool.js — just have the new pack file call
 * `IconLibrary.registerPack(id, { label, viewBox, categories, icons })` on import.
 *
 * Expected pack format:
 *   {
 *     label: 'Material Symbols',           // name shown on the picker tab
 *     viewBox: '0 -960 960 960',           // shared viewBox for all icons in the pack
 *     categories: [{ id, label }, ...],    // categories for the inner picker tabs
 *     icons: [
 *       { id, category, label, keywords: [...], paths: ['M...', ...] },
 *       ...
 *     ],
 *   }
 *
 * `paths` is always an array (even when the icon has only one <path>) so that
 * multi-subpath icons (e.g. a pack that needs more than one <path> per glyph)
 * are supported without any format change.
 */
export class IconLibrary {
    static _packs = new Map();

    /** Registers (or replaces) an icon pack under the given id. */
    static registerPack(id, pack) {
        this._packs.set(id, { id, ...pack });
    }

    /** Returns all registered packs in registration order. */
    static getPacks() {
        return [...this._packs.values()];
    }

    static getPack(id) {
        return this._packs.get(id) || null;
    }

    static getIcon(packId, iconId) {
        const pack = this._packs.get(packId);
        if (!pack) return null;
        return pack.icons.find(i => i.id === iconId) || null;
    }

    /**
     * Searches icons by keyword (label or keywords array), within a specific
     * pack or across all registered packs.
     * @param {string} query
     * @param {string|null} packId  If omitted/null, searches all packs.
     * @returns {Array<{packId, icon}>}
     */
    static search(query, packId = null) {
        const q = (query || '').trim().toLowerCase();
        const packs = packId ? [this.getPack(packId)].filter(Boolean) : this.getPacks();
        if (!q) {
            return packs.flatMap(pack => pack.icons.map(icon => ({ packId: pack.id, icon })));
        }
        const results = [];
        packs.forEach(pack => {
            pack.icons.forEach(icon => {
                const haystack = [icon.label, icon.id, ...(icon.keywords || [])]
                    .join(' ')
                    .toLowerCase();
                if (haystack.includes(q)) results.push({ packId: pack.id, icon });
            });
        });
        return results;
    }

    /** Icons belonging to a specific category within a pack. */
    static byCategory(packId, categoryId) {
        const pack = this.getPack(packId);
        if (!pack) return [];
        return pack.icons.filter(i => i.category === categoryId);
    }

    /**
     * Returns the full SVG string for an icon with fill/stroke applied —
     * same role as ShapeGenerator.buildSvgString, but reading paths from a
     * catalogued icon rather than generating procedural geometry.
     */
    static buildSvgString(packId, iconId, meta = {}) {
        const pack = this.getPack(packId);
        const icon = pack && pack.icons.find(i => i.id === iconId);
        if (!pack || !icon) return '';

        const fillColor = meta.fillColor || '#1a1a1a';
        const strokeColor = meta.strokeColor || '#000000';
        const strokeWidth = parseFloat(meta.strokeWidth) || 0;
        const strokeAttrs = strokeWidth > 0
            ? `stroke="${this._esc(strokeColor)}" stroke-width="${strokeWidth}"`
            : `stroke="none"`;

        const pathsHtml = icon.paths.map(d => `<path d="${this._esc(d)}"/>`).join('');
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${this._esc(pack.viewBox)}" preserveAspectRatio="xMidYMid meet"><g fill="${this._esc(fillColor)}" ${strokeAttrs} stroke-linejoin="round">${pathsHtml}</g></svg>`;
    }

    /** Same as buildSvgString, but returns an SVGElement ready to append to the DOM. */
    static buildSvgElement(packId, iconId, meta = {}) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = this.buildSvgString(packId, iconId, meta);
        return wrapper.firstElementChild;
    }

    /** Default meta for a new icon element. */
    static defaultMeta(packId, iconId) {
        return { packId, iconId, fillColor: '#1a1a1a', strokeColor: '#000000', strokeWidth: 0 };
    }

    static _esc(val) {
        return String(val == null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}
