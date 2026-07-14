/**
 * IconLibrary
 *
 * Registro central de "packs" de ícones vetoriais (SVG) usados pela
 * ferramenta Ícones (tools/icon/IconTool.js).
 *
 * Cada pack é um conjunto nomeado de ícones vindo de uma fonte diferente
 * (Material Symbols por padrão -- ver utils/icons/MaterialSymbolsPack.js --
 * mas o desenho permite registrar quantos packs quiser depois: Lucide,
 * Heroicons, um pack de upload próprio do usuário, etc.) sem precisar
 * alterar este arquivo nem o IconTool.js -- basta o novo arquivo do pack
 * chamar `IconLibrary.registerPack(id, { label, viewBox, categories, icons })`
 * no import.
 *
 * Formato esperado de cada pack:
 *   {
 *     label: 'Material Symbols',           // nome exibido na aba do picker
 *     viewBox: '0 -960 960 960',           // viewBox compartilhado por todos os ícones do pack
 *     categories: [{ id, label }, ...],    // categorias para as abas internas do picker
 *     icons: [
 *       { id, category, label, keywords: [...], paths: ['M...', ...] },
 *       ...
 *     ],
 *   }
 *
 * `paths` é sempre um array (mesmo quando o ícone tem 1 único <path>) para
 * já suportar, sem mudança de formato, ícones com múltiplos subpaths (ex:
 * um pack diferente que precise de mais de um <path> por desenho).
 */
export class IconLibrary {
    static _packs = new Map();

    /** Registra (ou substitui) um pack de ícones sob o id informado. */
    static registerPack(id, pack) {
        this._packs.set(id, { id, ...pack });
    }

    /** Lista todos os packs registrados, na ordem de registro. */
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
     * Busca ícones por palavra-chave (label ou keywords), dentro de um pack
     * específico ou em todos os packs registrados.
     * @param {string} query
     * @param {string|null} packId  Se omitido/null, busca em todos os packs.
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

    /** Ícones de uma categoria específica dentro de um pack. */
    static byCategory(packId, categoryId) {
        const pack = this.getPack(packId);
        if (!pack) return [];
        return pack.icons.filter(i => i.category === categoryId);
    }

    /**
     * Gera a string SVG completa de um ícone, com fill/stroke aplicados --
     * mesmo papel do ShapeGenerator.buildSvgString, mas lendo os paths de
     * um ícone já catalogado em vez de gerar geometria procedural.
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

    /** Igual a buildSvgString, mas retorna um SVGElement já pronto para anexar ao DOM. */
    static buildSvgElement(packId, iconId, meta = {}) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = this.buildSvgString(packId, iconId, meta);
        return wrapper.firstElementChild;
    }

    /** Meta padrão para um novo elemento de ícone. */
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
