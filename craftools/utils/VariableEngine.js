import { loadPhrases } from "./ApiDataLoader.js";

// Usado quando a lista de emojis (variável tipo "emoji") está vazia -- o
// sistema sorteia entre este conjunto padrão em vez de não substituir nada.
const DEFAULT_EMOJI_POOL = [
    '😀', '😁', '😂', '😃', '😄', '😅', '😆', '🥰', '😍', '😘',
    '😋', '😜', '🤩', '🥳', '😎', '🤠', '😇', '🙂', '😉', '😊',
    '🤣', '😺', '😻', '🥹', '🤗', '🙌', '👍', '👏', '✨', '🎉',
    '❤️', '💛', '💚', '💙', '💜', '🔥', '🌟', '⭐', '🌈', '🍀',
];

/**
 * VariableEngine
 *
 * Motor central do sistema de "Variáveis" do CrafTools. Um "binding" de
 * variável é um objeto simples `{ type, ...config }` guardado diretamente
 * numa propriedade do elemento (`element._craftoolsVariable` para Texto/
 * Título, ou `meta.variableBinding` para QRCode/Barcode).
 *
 * Tipos suportados:
 *   - date           : data (fixa ou incrementando por repetição)
 *   - sequenceNumber : número sequencial (início + passo)
 *   - sequenceText   : lista de textos que ciclam a cada repetição
 *   - pageNumber     : número da página gerada
 *   - link           : link/URL (fixo ou com índice anexado)
 *   - apiPhrase      : frase vinda da API (craftools_api, ?resource=phrases)
 *
 * A resolução de valores é feita a partir de um `context` por repetição:
 *   { repetitionIndex, pageNumber, totalPages, now }
 * `repetitionIndex` é 0-based (a 1ª repetição de uma página é índice 0).
 *
 * Uso típico (dentro de um Agenda export):
 *   const apiCache = await VariableEngine.prefetchApiResources(bindings);
 *   const valor = VariableEngine.resolve(binding, context, apiCache);
 *
 * Uso típico (preview ao vivo no editor, com 1 repetição):
 *   const valor = await VariableEngine.resolvePreview(binding);
 */
export class VariableEngine {

    static TYPES = ['date', 'sequenceNumber', 'sequenceText', 'pageNumber', 'link', 'emoji', 'apiPhrase'];

    // ── Bindings padrão por tipo ─────────────────────────────────────────────

    static defaultBinding(type) {
        const today = new Date();
        const pad = (v) => String(v).padStart(2, '0');
        const isoToday = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

        switch (type) {
            case 'date':
                return { type, startDate: isoToday, interval: 'daily', step: 1, format: 'DD/MM/YYYY' };
            case 'sequenceNumber':
                return { type, start: 1, step: 1, padding: 0, prefix: '', suffix: '' };
            case 'sequenceText':
                return { type, values: '', loop: true };
            case 'pageNumber':
                return { type, startAt: 1, format: 'n' };
            case 'link':
                return { type, url: '', appendIndex: false, startAt: 1 };
            case 'emoji':
                return { type, values: '', mode: 'sequential' };
            case 'apiPhrase':
                return { type, field: '', filterField: '', filterValue: '', mode: 'sequential' };
            default:
                return null;
        }
    }

    // ── Resolução síncrona (requer apiCache já carregado p/ apiPhrase) ──────

    /**
     * @param {object|null} binding
     * @param {object} context { repetitionIndex, pageNumber, totalPages, now }
     * @param {object} [apiCache] { [resource]: any[] }
     * @returns {string}
     */
    static resolve(binding, context, apiCache = {}) {
        if (!binding || !binding.type) return '';
        const ctx = {
            repetitionIndex: context?.repetitionIndex || 0,
            pageNumber: context?.pageNumber || 1,
            totalPages: context?.totalPages || 1,
            now: context?.now || new Date(),
        };
        switch (binding.type) {
            case 'date': return this._resolveDate(binding, ctx);
            case 'sequenceNumber': return this._resolveSequenceNumber(binding, ctx);
            case 'sequenceText': return this._resolveSequenceText(binding, ctx);
            case 'pageNumber': return this._resolvePageNumber(binding, ctx);
            case 'link': return this._resolveLink(binding, ctx);
            case 'emoji': return this._resolveEmoji(binding, ctx);
            case 'apiPhrase': return this._resolveApiPhrase(binding, ctx, apiCache);
            default: return '';
        }
    }

    /**
     * Resolve um valor de amostra (repetitionIndex=0) para preview no editor.
     * Para "apiPhrase", busca a API sob demanda (com cache interno).
     * @returns {Promise<string>}
     */
    static async resolvePreview(binding, sampleContext = {}) {
        const context = {
            repetitionIndex: sampleContext.repetitionIndex || 0,
            pageNumber: sampleContext.pageNumber || 1,
            totalPages: sampleContext.totalPages || 1,
            now: new Date(),
        };
        if (binding && binding.type === 'apiPhrase') {
            const apiCache = await this.prefetchApiResources([binding]);
            return this.resolve(binding, context, apiCache);
        }
        return this.resolve(binding, context, {});
    }

    /**
     * Busca (com cache) todos os recursos de API distintos referenciados por
     * uma lista de bindings. Usado antes de gerar a Agenda (todas as páginas
     * de uma vez) e no preview individual (1 binding só).
     * @param {Array<object|null>} bindings
     * @returns {Promise<object>} { [resource]: any[] }
     */
    static async prefetchApiResources(bindings) {
        const hasApiPhrase = (bindings || []).some(b => b && b.type === 'apiPhrase');
        if (!hasApiPhrase) return {};
        try {
            return { phrases: await loadPhrases('phrases') };
        } catch (_) {
            return { phrases: [] };
        }
    }

    /**
     * Carrega (com cache, via loadPhrases) e retorna os valores distintos de
     * um campo (ex.: "author" ou "category") encontrados nas frases da API,
     * ordenados alfabeticamente -- usado para popular o seletor de "Valor do
     * filtro" no painel de Texto Variável. Campos com valor array (ex.:
     * category) são achatados.
     * @param {string} field
     * @returns {Promise<string[]>}
     */
    static async loadFilterOptions(field) {
        if (!field) return [];
        try {
            const list = await loadPhrases('phrases');
            const values = new Set();
            (list || []).forEach(item => {
                if (item == null || typeof item !== 'object') return;
                const val = item[field];
                if (val == null) return;
                if (Array.isArray(val)) {
                    val.forEach(v => { if (v != null && String(v).trim()) values.add(String(v)); });
                } else if (String(val).trim()) {
                    values.add(String(val));
                }
            });
            return [...values].sort((a, b) => a.localeCompare(b));
        } catch (_) {
            return [];
        }
    }

    // ── Resolvers individuais ────────────────────────────────────────────────

    static _resolveDate(binding, ctx) {
        const base = binding.startDate ? new Date(`${binding.startDate}T00:00:00`) : new Date(ctx.now);
        if (isNaN(base.getTime())) return '';
        const d = this._addInterval(base, binding.interval || 'daily', (parseInt(binding.step, 10) || 1) * ctx.repetitionIndex);
        return this._formatDate(d, binding.format || 'DD/MM/YYYY');
    }

    static _addInterval(date, interval, amount) {
        const d = new Date(date.getTime());
        switch (interval) {
            case 'daily': d.setDate(d.getDate() + amount); break;
            case 'weekly': d.setDate(d.getDate() + amount * 7); break;
            case 'monthly': d.setMonth(d.getMonth() + amount); break;
            case 'yearly': d.setFullYear(d.getFullYear() + amount); break;
            case 'none':
            default:
                break; // data fixa, não incrementa
        }
        return d;
    }

    static _formatDate(d, format) {
        const pad = (v) => String(v).padStart(2, '0');
        const dd = pad(d.getDate());
        const mm = pad(d.getMonth() + 1);
        const yyyy = d.getFullYear();
        const yy = String(yyyy).slice(-2);
        const monthsPt = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const weekdaysPt = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        switch (format) {
            case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`;
            case 'DD/MM/YY': return `${dd}/${mm}/${yy}`;
            case 'DD/MM': return `${dd}/${mm}`;
            case 'MM/YYYY': return `${mm}/${yyyy}`;
            case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
            case 'DIA_MES_EXTENSO': return `${d.getDate()} de ${monthsPt[d.getMonth()]}`;
            case 'DIA_MES_ANO_EXTENSO': return `${d.getDate()} de ${monthsPt[d.getMonth()]} de ${yyyy}`;
            case 'DIA_SEMANA': return weekdaysPt[d.getDay()];
            case 'DIA_SEMANA_DATA': return `${weekdaysPt[d.getDay()]}, ${dd}/${mm}`;
            default: return `${dd}/${mm}/${yyyy}`;
        }
    }

    static _resolveSequenceNumber(binding, ctx) {
        const start = parseFloat(binding.start);
        const step = parseFloat(binding.step);
        const n = (isNaN(start) ? 1 : start) + (isNaN(step) ? 1 : step) * ctx.repetitionIndex;
        const padding = parseInt(binding.padding, 10) || 0;
        const rounded = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
        const sign = rounded < 0 ? '-' : '';
        let numStr = String(Math.abs(rounded));
        if (padding > 0) numStr = numStr.padStart(padding, '0');
        return `${binding.prefix || ''}${sign}${numStr}${binding.suffix || ''}`;
    }

    static _parseValuesList(raw) {
        return String(raw || '')
            .split(/\r?\n|,/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    static _resolveSequenceText(binding, ctx) {
        const values = this._parseValuesList(binding.values);
        if (!values.length) return '';
        const idx = ctx.repetitionIndex;
        if (binding.loop === false) return values[Math.min(idx, values.length - 1)];
        return values[idx % values.length];
    }

    static _resolvePageNumber(binding, ctx) {
        const start = parseInt(binding.startAt, 10) || 1;
        const n = start + ctx.repetitionIndex;
        if (binding.format === 'n_of_total') {
            const total = ctx.totalPages || n;
            return `${n}/${total}`;
        }
        return String(n);
    }

    static _resolveLink(binding, ctx) {
        let url = binding.url || '';
        if (binding.appendIndex) {
            const start = parseInt(binding.startAt, 10) || 1;
            const n = start + ctx.repetitionIndex;
            url += (url.includes('?') ? '&' : (url ? '?' : '')) + 'p=' + n;
        }
        return url;
    }

    static _resolveEmoji(binding, ctx) {
        const values = this._parseEmojiList(binding.values);
        if (!values.length) {
            // Lista vazia -- sorteia (aleatório de verdade, não determinístico)
            // entre um conjunto padrão de emojis, em vez de não substituir nada.
            return DEFAULT_EMOJI_POOL[Math.floor(Math.random() * DEFAULT_EMOJI_POOL.length)];
        }
        if (binding.mode === 'random') return values[this._pseudoRandomIndex(ctx.repetitionIndex, values.length)];
        return values[ctx.repetitionIndex % values.length];
    }

    /**
     * Quebra a caixa de "Lista de Emojis" em emojis individuais. Aceita tanto
     * o formato antigo (separados por vírgula/quebra de linha) quanto emojis
     * colados um no outro sem nenhum separador (ex.: "😀😁😂😃") -- primeiro
     * separa por vírgula/linha (compatibilidade), depois quebra cada pedaço
     * em "grapheme clusters" (via Intl.Segmenter, que entende corretamente
     * emojis compostos por múltiplos code points: tons de pele, sequências
     * ZWJ, bandeiras, variation selectors etc. como 1 emoji só).
     * @param {string} raw
     * @returns {string[]}
     */
    static _parseEmojiList(raw) {
        const str = String(raw || '').trim();
        if (!str) return [];

        const pieces = str.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
        const out = [];

        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            for (const piece of pieces) {
                for (const { segment } of segmenter.segment(piece)) {
                    if (segment && segment.trim()) out.push(segment);
                }
            }
        } else {
            // Fallback sem Intl.Segmenter (navegadores muito antigos): regex
            // Unicode-aware que cobre emoji + modificador de tom de pele +
            // sequências ZWJ + variation selector.
            const re = /\p{Extended_Pictographic}(?:\u{FE0F})?(?:\u{200D}\p{Extended_Pictographic}(?:\u{FE0F})?)*|\S/gu;
            for (const piece of pieces) {
                const matches = piece.match(re) || [];
                out.push(...matches);
            }
        }

        return out;
    }

    static _resolveApiPhrase(binding, ctx, apiCache) {
        let list = (apiCache && apiCache.phrases) || [];
        if (!list.length) return '';

        // Filtro por autor/categoria (opcional) -- restringe a lista antes
        // de escolher o item pelo índice sequencial/aleatório.
        if (binding.filterField && binding.filterValue) {
            list = list.filter(item => {
                if (item == null || typeof item !== 'object') return false;
                const val = item[binding.filterField];
                if (Array.isArray(val)) return val.map(String).includes(binding.filterValue);
                return val != null && String(val) === binding.filterValue;
            });
            if (!list.length) return '';
        }

        const idx = ctx.repetitionIndex;
        // Nota: no modo aleatório, o índice é derivado deterministicamente de
        // `repetitionIndex` (em vez de Math.random() puro) -- assim, duas
        // variáveis diferentes vinculadas ao MESMO recurso (ex.: uma no campo
        // "Frase" e outra no campo "Autor") sempre sorteiam o MESMO item da
        // lista na mesma repetição, mantendo o par frase/autor consistente.
        const item = binding.mode === 'random'
            ? list[this._pseudoRandomIndex(idx, list.length)]
            : list[idx % list.length];

        if (item == null) return '';
        if (typeof item === 'string') return item;
        if (typeof item === 'number') return String(item);

        // Objeto -- tenta o campo configurado pelo usuário (ex.: phrase,
        // author, category), senão tenta as chaves mais comuns usadas por
        // APIs de frases. Campos que sejam array (ex.: category: [...]) são
        // unidos com vírgula.
        const field = (binding.field || '').trim();
        if (field && item[field] != null) {
            const val = item[field];
            return Array.isArray(val) ? val.join(', ') : String(val);
        }

        const guessKeys = ['phrase', 'text', 'frase', 'texto', 'title', 'name', 'value'];
        for (const key of guessKeys) {
            if (item[key] != null) return String(item[key]);
        }

        const firstStringKey = Object.keys(item).find(k => typeof item[k] === 'string');
        return firstStringKey ? String(item[firstStringKey]) : '';
    }

    /** Índice pseudo-aleatório determinístico (mesmo `seed` -> mesmo resultado sempre). */
    static _pseudoRandomIndex(seed, length) {
        if (!length || length <= 0) return 0;
        let h = (seed + 0x9e3779b9) | 0;
        h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        h = (h ^ (h >>> 16)) >>> 0;
        return h % length;
    }
}
