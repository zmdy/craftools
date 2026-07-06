/**
 * ApiDataLoader.js
 *
 * Carrega GridSizes e AlbumTemplates da craftools_api (/v1/).
 * Usa os dados locais (GridSizes.js) como fallback se a API estiver
 * indisponível ou se a URL base não estiver configurada.
 *
 * Configuração (definir no index.html, antes dos scripts):
 *   window.CRAFTOOLS_CONFIG = { apiBase: 'http://127.0.0.1/craftools_api' };
 *
 * Sem token — o tier "free" é devolvido automaticamente pela API quando
 * nenhum token é enviado. Tokens de usuários premium serão adicionados
 * futuramente via autenticação no próprio app.
 */

import { GridSizes as GridSizesFallback } from './GridSizes.js';
import { UserTemplates } from './UserTemplates.js';

// Cache em memória para não re-bater a API a cada abertura do painel
const _cache = {};

/**
 * Retorna a URL base da API configurada no index.html, ou null se ausente.
 * @returns {string|null}
 */
function getApiBase() {
    return (window.CRAFTOOLS_CONFIG && window.CRAFTOOLS_CONFIG.apiBase)
        ? window.CRAFTOOLS_CONFIG.apiBase.replace(/\/$/, '')
        : null;
}

/**
 * Busca um recurso da /v1/ com timeout de 4 segundos.
 * Retorna null em caso de qualquer falha.
 * @param {string} resource - ex: 'grid-sizes', 'album-templates'
 * @returns {Promise<any[]|null>}
 */
async function fetchResource(resource, extraParams = {}) {
    const base = getApiBase();
    if (!base) return null;

    const qs = Object.entries(extraParams)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('');
    const url = `${base}/v1/?resource=${resource}${qs}`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeout);

        if (!res.ok) return null;
        const json = await res.json();
        if (json.status !== 'success' || !Array.isArray(json.data)) return null;
        return json.data;
    } catch (_) {
        return null;
    }
}

/**
 * Carrega os tamanhos de grid.
 * Tenta a API primeiro; se falhar, usa GridSizes.js local como fallback.
 * @returns {Promise<object[]>}
 */
export async function loadGridSizes() {
    if (_cache.gridSizes) return _cache.gridSizes;

    // API data and local GridSizes.js are ALWAYS merged — API first, then local.
    // The local file is never discarded even when the API responds successfully.
    const apiData = await fetchResource('grid-sizes');
    let apiItems = [];
    if (apiData && apiData.length > 0) {
        console.info('[ApiDataLoader] GridSizes carregados da API (%d itens)', apiData.length);
        apiItems = apiData;
    } else {
        console.warn(
            '[ApiDataLoader] API indisponível ou sem dados — apenas GridSizes.js local será usado. ' +
            'Verifique window.CRAFTOOLS_CONFIG.apiBase (configurado no index.html) e se a craftools_api está no ar.'
        );
    }

    // Append user-created templates (from localStorage) after built-in ones
    const userTemplates = UserTemplates.load();
    if (userTemplates.length > 0) {
        console.info('[ApiDataLoader] %d template(s) do usuário carregados do localStorage.', userTemplates.length);
    }

    // Final order: API items → local fallback → user templates
    _cache.gridSizes = [...apiItems, ...GridSizesFallback, ...userTemplates];
    return _cache.gridSizes;
}

/**
 * Carrega os templates de álbum.
 * Retorna array vazio se a API falhar (não há fallback local para templates).
 * @returns {Promise<object[]>}
 */
export async function loadAlbumTemplates() {
    if (_cache.albumTemplates) return _cache.albumTemplates;

    const apiData = await fetchResource('album-templates');
    if (apiData && apiData.length > 0) {
        _cache.albumTemplates = apiData;
        console.info('[ApiDataLoader] AlbumTemplates carregados da API (%d itens)', apiData.length);
        return apiData;
    }

    console.warn(
        '[ApiDataLoader] AlbumTemplates: API indisponível ou sem dados — retornando lista vazia ' +
        '(não há fallback local para templates de álbum). Verifique window.CRAFTOOLS_CONFIG.apiBase.'
    );
    _cache.albumTemplates = [];
    return [];
}

/**
 * Carrega frases/textos usados pela variável "Frase da API" (Texto Variável /
 * Exportação de Agenda). Recurso configurado no craftools_api: ?resource=phrases
 * (endpoint local de desenvolvimento: http://127.0.0.1/craftools_api/public/v1/?resource=phrases).
 * Sem fallback local -- se a API estiver indisponível, retorna lista vazia
 * (a variável simplesmente não terá valor para substituir).
 * @param {string} [resource='phrases']
 * @param {string} [collection] - filtro de "1º nível" (tema/conjunto); vazio/omitido = todas as coleções.
 * @returns {Promise<any[]>}
 */
export async function loadPhrases(resource = 'phrases', collection = '') {
    const col = (collection || '').trim();
    const cacheKey = `phrases:${resource}:${col}`;
    if (_cache[cacheKey]) return _cache[cacheKey];

    // limit=200 (máximo aceito pela API) -- dá uma amostra maior tanto para
    // a substituição da variável quanto para popular o filtro de
    // autor/categoria (Texto Variável) com mais opções reais.
    const apiData = await fetchResource(resource, { limit: 200, collection: col });
    if (apiData && apiData.length > 0) {
        _cache[cacheKey] = apiData;
        console.info('[ApiDataLoader] Phrases carregadas da API (%d itens, resource=%s, collection=%s)', apiData.length, resource, col || '(todas)');
        return apiData;
    }

    console.warn(
        '[ApiDataLoader] Phrases: API indisponível ou sem dados (resource=%s, collection=%s) — retornando lista vazia ' +
        '(não há fallback local para frases). Verifique window.CRAFTOOLS_CONFIG.apiBase.', resource, col || '(todas)'
    );
    _cache[cacheKey] = [];
    return [];
}

/**
 * Carrega os nomes das coleções de frases cadastradas (agrupamento por
 * tema/conjunto) -- usado para popular o seletor de "Coleção" no painel de
 * Texto Variável (filtro de "1º nível", combinável com autor/categoria).
 * @returns {Promise<string[]>}
 */
export async function loadPhraseCollections() {
    if (_cache.phraseCollections) return _cache.phraseCollections;
    const data = await fetchResource('phrase-collections');
    _cache.phraseCollections = Array.isArray(data) ? data : [];
    return _cache.phraseCollections;
}

/**
 * Busca um recurso da /v1/ sem exigir que `data` seja um array -- usado
 * pelo Emoji Kitchen, cujo modo "combo" devolve um objeto único (ou null).
 * Mesmo timeout/tratamento de erro de fetchResource().
 * @returns {Promise<any>}
 */
async function fetchResourceRaw(resource, extraParams = {}) {
    const base = getApiBase();
    if (!base) return null;

    const qs = Object.entries(extraParams)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('');
    const url = `${base}/v1/?resource=${resource}${qs}`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeout);

        if (!res.ok) return null;
        const json = await res.json();
        if (json.status !== 'success') return null;
        return json.data;
    } catch (_) {
        return null;
    }
}

export async function loadEmojiKitchenSupported() {
    if (_cache.emojiKitchenSupported) return _cache.emojiKitchenSupported;
    const data = await fetchResourceRaw('emoji-kitchen', { mode: 'supported' });
    _cache.emojiKitchenSupported = Array.isArray(data) ? data : [];
    return _cache.emojiKitchenSupported;
}

export async function loadEmojiKitchenPartners(emoji) {
    const key = `emojiKitchenPartners:${emoji}`;
    if (_cache[key]) return _cache[key];
    const data = await fetchResourceRaw('emoji-kitchen', { mode: 'partners', emoji });
    _cache[key] = Array.isArray(data) ? data : [];
    return _cache[key];
}

export async function loadEmojiKitchenCombo(left, right) {
    const key = `emojiKitchenCombo:${left}|${right}`;
    if (_cache[key] !== undefined) return _cache[key];
    const data = await fetchResourceRaw('emoji-kitchen', { mode: 'combo', left, right });
    const combo = (data && data.imageUrl) ? data : null;
    _cache[key] = combo;
    return combo;
}

export function invalidateApiDataCache() {
    delete _cache.gridSizes;
    delete _cache.albumTemplates;
    delete _cache.emojiKitchenSupported;
    delete _cache.phraseCollections;
    Object.keys(_cache).forEach(k => {
        if (k.startsWith('phrases:') || k.startsWith('emojiKitchenPartners:') || k.startsWith('emojiKitchenCombo:')) delete _cache[k];
    });
}
