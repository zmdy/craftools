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
 *     viewBox: '0 -960 960 960',           // DEFAULT viewBox for icons in the pack
 *                                          // that don't set their own (see below)
 *     categories: [{ id, label }, ...],    // categories for the inner picker tabs
 *     icons: [
 *       { id, category, label, keywords: [...], paths: ['M...', ...], viewBox: '0 0 W H' },
 *       ...
 *     ],
 *   }
 *
 * `viewBox` on an individual icon is optional and overrides the pack's own --
 * added for FontAwesomePack.js (utils/icons/FontAwesomePack.js), whose icons
 * each have their own natural width (unlike Material Symbols' fixed 960x960
 * grid), so a single shared pack-level viewBox would stretch/crop most of
 * them. Falls back to `pack.viewBox` when unset, so every pre-existing pack
 * (which never set this) renders exactly as before.
 *
 * `paths` is always an array (even when the icon has only one <path>) so that
 * multi-subpath icons (e.g. a pack that needs more than one <path> per glyph)
 * are supported without any format change.
 */
import { normalizeValue, svgPaintFromValue } from './ColorPickerUI.js';

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

        // fillColor/strokeColor hold whatever the standardized color-picker
        // field reports: a bare hex string (legacy value / defaultMeta()) or
        // a JSON ColorPickerValue string when the user has picked a
        // gradient -- normalizeValue() accepts either, and
        // svgPaintFromValue() turns a gradient into a <defs> entry + a
        // `url(#id)` fill/stroke reference (or just passes a solid color
        // straight through). Same technique as ShapeGenerator.ts.
        const fillPaint = svgPaintFromValue(normalizeValue(meta.fillColor || '#1a1a1a'), 'icon-fill');

        const strokeWidth = parseFloat(meta.strokeWidth) || 0;
        let strokeAttrs = `stroke="none"`;
        let strokeDefs = '';
        if (strokeWidth > 0) {
            const strokePaint = svgPaintFromValue(normalizeValue(meta.strokeColor || '#000000'), 'icon-stroke');
            strokeDefs  = strokePaint.defs;
            strokeAttrs = `stroke="${this._esc(strokePaint.paint)}" stroke-width="${strokeWidth}"`;
        }

        const pathsHtml = icon.paths.map(d => `<path d="${this._esc(d)}"/>`).join('');
        const defs = fillPaint.defs + strokeDefs;
        const viewBox = icon.viewBox || pack.viewBox;
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${this._esc(viewBox)}" preserveAspectRatio="xMidYMid meet">${defs ? `<defs>${defs}</defs>` : ''}<g fill="${this._esc(fillPaint.paint)}" ${strokeAttrs} stroke-linejoin="round">${pathsHtml}</g></svg>`;
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
