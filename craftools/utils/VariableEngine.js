import { loadPhrases, loadEmojiKitchenCombo } from "./ApiDataLoader.js";

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
 *   - emoji          : emoji (fixo, lista sequencial/aleatória, ou sorteio)
 *   - apiPhrase      : frase vinda da API (craftools_api, ?resource=phrases)
 *   - emojiKitchen   : combo do Emoji Kitchen (craftools_api, ?resource=emoji-kitchen)
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
 *
 * ── Vínculo entre variáveis ("Vincular a") ──────────────────────────────────
 * Qualquer binding pode ter `binding.linkedTo = <varId>` apontando para o
 * `_craftoolsVarId` de OUTRO elemento com uma variável do MESMO tipo já
 * configurada (o "líder"). Em vez de escolher seu próprio item/valor a cada
 * repetição, o binding vinculado reaproveita o mesmo "pick" (item de API,
 * data, emoji, número etc.) que o líder escolheu naquela repetição --
 * mantendo sua PRÓPRIA formatação (ex.: campo diferente de uma mesma frase
 * da API, ou formato de data diferente para a mesma data).
 *
 * Para habilitar isso durante uma geração em lote, passe um 4º argumento
 * `linkCtx = { id, picks }` para resolve(): `id` é o `_craftoolsVarId` do
 * elemento sendo resolvido agora, e `picks` é um `Map` compartilhado entre
 * TODOS os elementos da mesma repetição (recriado a cada repetição). Bindings
 * "líderes" (sem linkedTo) devem ser resolvidos ANTES dos vinculados, para
 * que seu pick já esteja disponível no Map.
 */
export class VariableEngine {

    static TYPES = ['date', 'sequenceNumber', 'sequenceText', 'pageNumber', 'link', 'emoji', 'apiPhrase', 'emojiKitchen'];

    // ── Bindings padrão por tipo ─────────────────────────────────────────────

    static defaultBinding(type) {
        const today = new Date();
        const pad = (v) => String(v).padStart(2, '0');
        const isoToday = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

        switch (type) {
            case 'date':
                return { type, startDate: isoToday, interval: 'daily', step: 1, format: 'DD/MM/YYYY', linkedTo: '' };
            case 'sequenceNumber':
                return { type, start: 1, step: 1, padding: 0, prefix: '', suffix: '', linkedTo: '' };
            case 'sequenceText':
                return { type, values: '', loop: true, linkedTo: '' };
            case 'pageNumber':
                return { type, startAt: 1, format: 'n', linkedTo: '' };
            case 'link':
                return { type, url: '', appendIndex: false, startAt: 1, linkedTo: '' };
            case 'emoji':
                return { type, values: '', mode: 'sequential', linkedTo: '' };
            case 'apiPhrase':
                return { type, field: '', filterField: '', filterValue: '', mode: 'sequential', linkedTo: '' };
            case 'emojiKitchen':
                return { type, leftEmoji: '', rightEmoji: '', linkedTo: '' };
            default:
                return null;
        }
    }

    // ── Resolução síncrona (requer apiCache já carregado p/ apiPhrase/emojiKitchen) ──

    /**
     * @param {object|null} binding
     * @param {object} context { repetitionIndex, pageNumber, totalPages, now }
     * @param {object} [apiCache] { phrases?: any[], emojiKitchenCombos?: {[key]: string} }
     * @param {object} [linkCtx] { id: string, picks: Map } -- ver nota de vínculo acima
     * @returns {string}
     */
    static resolve(binding, context, apiCache = {}, linkCtx = null) {
        if (!binding || !binding.type) return '';
        const ctx = {
            repetitionIndex: context?.repetitionIndex || 0,
            pageNumber: context?.pageNumber || 1,
            totalPages: context?.totalPages || 1,
            now: context?.now || new Date(),
        };

        const picks = linkCtx && linkCtx.picks;
        const myId = linkCtx && linkCtx.id;

        let pick = null;
        let usedLeader = false;

        if (binding.linkedTo && picks && picks.has(binding.linkedTo)) {
            const leader = picks.get(binding.linkedTo);
            if (leader && leader.type === binding.type) {
                pick = leader.pick;
                usedLeader = true;
            }
        }

        if (!usedLeader) {
            pick = this._pick(binding, ctx, apiCache);
            if (picks && myId) picks.set(myId, { type: binding.type, pick });
        }

        return this._format(binding, pick, ctx);
    }

    /** Cria um novo registro de "picks" compartilhado -- 1 por repetição. */
    static newLinkRegistry() {
        return new Map();
    }

    /**
     * Resolve um valor de amostra (repetitionIndex=0) para preview no editor.
     * Para "apiPhrase"/"emojiKitchen", busca a API sob demanda (com cache interno).
     * @returns {Promise<string>}
     */
    static async resolvePreview(binding, sampleContext = {}) {
        const context = {
            repetitionIndex: sampleContext.repetitionIndex || 0,
            pageNumber: sampleContext.pageNumber || 1,
            totalPages: sampleContext.totalPages || 1,
            now: new Date(),
        };
        if (binding && (binding.type === 'apiPhrase' || binding.type === 'emojiKitchen')) {
            const apiCache = await this.prefetchApiResources([binding]);
            return this.resolve(binding, context, apiCache);
        }
        return this.resolve(binding, context, {});
    }

    /**
     * Busca (com cache) todos os recursos de API distintos referenciados por
     * uma lista de bindings: frases (apiPhrase) e combos do Emoji Kitchen
     * (emojiKitchen). Usado antes de gerar a Agenda (todas as páginas de uma
     * vez) e no preview individual (1 binding só).
     * @param {Array<object|null>} bindings
     * @returns {Promise<object>} { phrases?: any[], emojiKitchenCombos?: {[key]: string} }
     */
    static async prefetchApiResources(bindings) {
        const list = bindings || [];
        const hasApiPhrase = list.some(b => b && b.type === 'apiPhrase');

        const kitchenPairs = new Set();
        list.forEach(b => {
            if (b && b.type === 'emojiKitchen' && (b.leftEmoji || '').trim()) {
                const left = b.leftEmoji.trim();
                const right = (b.rightEmoji || '').trim() || left;
                kitchenPairs.add(`${left}|${right}`);
            }
        });

        const cache = {};

        if (hasApiPhrase) {
            try {
                cache.phrases = await loadPhrases('phrases');
            } catch (_) {
                cache.phrases = [];
            }
        }

        if (kitchenPairs.size) {
            cache.emojiKitchenCombos = {};
            await Promise.all([...kitchenPairs].map(async (key) => {
                const [left, right] = key.split('|');
                try {
                    const combo = await loadEmojiKitchenCombo(left, right);
                    cache.emojiKitchenCombos[key] = (combo && combo.imageUrl) || '';
                } catch (_) {
                    cache.emojiKitchenCombos[key] = '';
                }
            }));
        }

        return cache;
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

    // ── Dispatch: "pick" (escolha bruta, compartilhável entre vínculos) ────

    static _pick(binding, ctx, apiCache) {
        switch (binding.type) {
            case 'date': return this._pickDate(binding, ctx);
            case 'sequenceNumber': return this._pickSequenceNumber(binding, ctx);
            case 'sequenceText': return this._pickSequenceText(binding, ctx);
            case 'pageNumber': return this._pickPageNumber(binding, ctx);
            case 'link': return this._pickLink(binding, ctx);
            case 'emoji': return this._pickEmoji(binding, ctx);
            case 'apiPhrase': return this._pickApiPhrase(binding, ctx, apiCache);
            case 'emojiKitchen': return this._pickEmojiKitchen(binding, ctx, apiCache);
            default: return null;
        }
    }

    // ── Dispatch: "format" (formatação final -- string exibida/usada) ──────

    static _format(binding, pick, ctx) {
        switch (binding.type) {
            case 'date': return pick ? this._formatDate(pick, binding.format || 'DD/MM/YYYY') : '';
            case 'sequenceNumber': return this._formatSequenceNumber(pick, binding);
            case 'sequenceText': return pick == null ? '' : String(pick);
            case 'pageNumber': return this._formatPageNumber(pick, binding, ctx);
            case 'link': return this._formatLink(pick, binding);
            case 'emoji': return pick == null ? '' : String(pick);
            case 'apiPhrase': return this._formatApiPhrase(pick, binding);
            case 'emojiKitchen': return (pick && pick.url) ? pick.url : '';
            default: return '';
        }
    }

    // ── date ─────────────────────────────────────────────────────────────────

    static _pickDate(binding, ctx) {
        const base = binding.startDate ? new Date(`${binding.startDate}T00:00:00`) : new Date(ctx.now);
        if (isNaN(base.getTime())) return null;
        return this._addInterval(base, binding.interval || 'daily', (parseInt(binding.step, 10) || 1) * ctx.repetitionIndex);
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

    // ── sequenceNumber ───────────────────────────────────────────────────────

    static _pickSequenceNumber(binding, ctx) {
        const start = parseFloat(binding.start);
        const step = parseFloat(binding.step);
        return (isNaN(start) ? 1 : start) + (isNaN(step) ? 1 : step) * ctx.repetitionIndex;
    }

    static _formatSequenceNumber(n, binding) {
        if (n == null || isNaN(n)) return '';
        const padding = parseInt(binding.padding, 10) || 0;
        const rounded = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
        const sign = rounded < 0 ? '-' : '';
        let numStr = String(Math.abs(rounded));
        if (padding > 0) numStr = numStr.padStart(padding, '0');
        return `${binding.prefix || ''}${sign}${numStr}${binding.suffix || ''}`;
    }

    // ── sequenceText ─────────────────────────────────────────────────────────

    static _parseValuesList(raw) {
        return String(raw || '')
            .split(/\r?\n|,/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    static _pickSequenceText(binding, ctx) {
        const values = this._parseValuesList(binding.values);
        if (!values.length) return null;
        const idx = ctx.repetitionIndex;
        if (binding.loop === false) return values[Math.min(idx, values.length - 1)];
        return values[idx % values.length];
    }

    // ── pageNumber ───────────────────────────────────────────────────────────

    static _pickPageNumber(binding, ctx) {
        const start = parseInt(binding.startAt, 10) || 1;
        return start + ctx.repetitionIndex;
    }

    static _formatPageNumber(n, binding, ctx) {
        if (n == null) return '';
        if (binding.format === 'n_of_total') {
            const total = ctx.totalPages || n;
            return `${n}/${total}`;
        }
        return String(n);
    }

    // ── link ─────────────────────────────────────────────────────────────────

    static _pickLink(binding, ctx) {
        if (!binding.appendIndex) return null;
        const start = parseInt(binding.startAt, 10) || 1;
        art + ctx.repetitionIndex;
    }

    static _formatLink(pick, binding) {
        let url = binding.url || '';
        if (binding.appendIndex) {
            const n = (pick != null) ? pick : (parseInt(binding.startAt, 10) || 1);
            url += (url.includes('?') ? '&' : (url ? '?' : '')) + 'p=' + n;
        }
        return url;
    }

    // ── emoji ────────────────────────────────────────────────────────────────

    static _pickEmoji(binding, ctx) {
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

    // ── apiPhrase ────────────────────────────────────────────────────────────

    static _pickApiPhrase(binding, ctx, apiCache) {
        let list = (apiCache && apiCache.phrases) || [];
        if (!list.length) return null;

        // Filtro por autor/categoria (opcional) -- restringe a lista antes
        // de escolher o item pelo índice sequencial/aleatório.
        if (binding.filterField && binding.filterValue) {
            list = list.filter(item => {
                if (item == null || typeof item !== 'object') return false;
                const val = item[binding.filterField];
                if (Array.isArray(val)) return val.map(String).includes(binding.filterValue);
                return val != null && String(val) === binding.filterValue;
            });
            if (!list.length) return null;
        }

        const idx = ctx.repetitionIndex;
        // Nota: no modo aleatório, o índice é derivado deterministicamente de
        // `repetitionIndex` (em vez de Math.random() puro) -- assim, duas
        // variáveis diferentes vinculadas ao MESMO recurso (ex.: uma no campo
        // "Frase" e outra no campo "Autor") sem usar "Vincular a" ainda assim
        // tendem a sortear o MESMO item quando as listas coincidem. Quando as
        // listas divergem (filtros diferentes), use "Vincular a" para garantir
        // o mesmo item com certeza.
        const item = binding.mode === 'random'
            ? list[this._pseudoRandomIndex(idx, list.length)]
            : list[idx % list.length];

        return item == null ? null : item;
    }

    static _formatApiPhrase(item, binding) {
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

    // ── emojiKitchen ─────────────────────────────────────────────────────────

    /**
     * Combo do Emoji Kitchen não varia por repetição (é um par fixo escolhido
     * no painel) -- o "pick" aqui é só a URL já resolvida via prefetch
     * (ver prefetchApiResources), guardada em cache por "esquerda|direita".
     */
    static _pickEmojiKitchen(binding, ctx, apiCache) {
        const left = (binding.leftEmoji || '').trim();
        if (!left) return null;
        const right = (binding.rightEmoji || '').trim() || left;
        const key = `${left}|${right}`;
        const url = (apiCache && apiCache.emojiKitchenCombos && apiCache.emojiKitchenCombos[key]) || '';
        return { leftEmoji: left, rightEmoji: right, url };
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
