/**
 * ApiDataLoader.ts
 */

import { GridSizes as GridSizesFallback, type GridTemplate } from './GridSizes.js';
import { UserTemplates } from './UserTemplates.js';

declare global {
  interface Window {
      CRAFTOOLS_CONFIG?: { apiBase?: string };
  }
}

const _cache: Record<string, any> = {};

function getApiBase(): string | null {
  return (window.CRAFTOOLS_CONFIG && window.CRAFTOOLS_CONFIG.apiBase)
      ? window.CRAFTOOLS_CONFIG.apiBase.replace(/\/$/, '')
      : null;
}

let _activeRequests = 0;
const _requestQueue: Array<() => void> = [];

async function queuedFetch(url: string, options: RequestInit): Promise<Response> {
  if (_activeRequests >= 3) {
      await new Promise<void>(resolve => _requestQueue.push(resolve));
  }
  _activeRequests++;
  try {
      return await fetch(url, options);
  } finally {
      _activeRequests--;
      if (_requestQueue.length > 0) {
          const next = _requestQueue.shift();
          if (next) next();
      }
  }
}

async function fetchResource(resource: string, extraParams: Record<string, any> = {}): Promise<any[] | null> {
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

      const res = await queuedFetch(url, {
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

export async function loadGridSizes(): Promise<GridTemplate[]> {
  if (_cache.gridSizes) return _cache.gridSizes;

  const apiData = await fetchResource('grid-sizes');
  let apiItems: GridTemplate[] = [];
  if (apiData && apiData.length > 0) {
      console.info('[ApiDataLoader] GridSizes carregados da API (%d itens)', apiData.length);
      apiItems = apiData;
  } else {
      console.warn(
          '[ApiDataLoader] API indisponível ou sem dados — apenas GridSizes.js local será usado. ' +
          'Verifique window.CRAFTOOLS_CONFIG.apiBase (configurado no index.html) e se a craftools_api está no ar.'
      );
  }

  const userTemplates = UserTemplates.load();
  if (userTemplates.length > 0) {
      console.info('[ApiDataLoader] %d template(s) do usuário carregados do localStorage.', userTemplates.length);
  }

  _cache.gridSizes = [...apiItems, ...GridSizesFallback, ...userTemplates];
  return _cache.gridSizes;
}

export async function loadAlbumTemplates(): Promise<any[]> {
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

export async function loadPhrases(resource = 'phrases', collection = ''): Promise<any[]> {
  const col = (collection || '').trim();
  const cacheKey = `phrases:${resource}:${col}`;
  if (_cache[cacheKey]) return _cache[cacheKey];

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

export async function loadPhraseCollections(): Promise<string[]> {
  if (_cache.phraseCollections) return _cache.phraseCollections;
  const data = await fetchResource('phrase-collections');
  _cache.phraseCollections = Array.isArray(data) ? data : [];
  return _cache.phraseCollections;
}

async function fetchResourceRaw(resource: string, extraParams: Record<string, any> = {}): Promise<any> {
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

      const res = await queuedFetch(url, {
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

export function loadEmojiKitchenSupported(): Promise<any[]> {
  if (_cache.emojiKitchenSupported) return _cache.emojiKitchenSupported;
  // `limit` defaults to 500 server-side (v1/index.php's `mode=supported`
  // branch) when omitted -- harmless as a request-size safety cap in
  // general, but the actual imported catalog has 600+ distinct emojis with
  // at least one real combo, so relying on that default silently dropped
  // roughly a fifth of the genuinely-supported set (alphabetically past the
  // cutoff) from every "which emojis have Emoji Kitchen support" picker.
  // 2000 is the API's own hard max for this endpoint, comfortably covering
  // the current catalog plus room to grow.
  _cache.emojiKitchenSupported = fetchResourceRaw('emoji-kitchen', { mode: 'supported', limit: 2000 }).then(data => {
      return Array.isArray(data) ? data : [];
  });
  return _cache.emojiKitchenSupported;
}

export function loadEmojiKitchenPartners(emoji: string): Promise<any[]> {
  const key = `emojiKitchenPartners:${emoji}`;
  if (_cache[key]) return _cache[key];
  _cache[key] = fetchResourceRaw('emoji-kitchen', { mode: 'partners', emoji }).then(data => {
      return Array.isArray(data) ? data : [];
  });
  return _cache[key];
}

export function loadEmojiKitchenCombo(left: string, right: string): Promise<any> {
  const key = `emojiKitchenCombo:${left}|${right}`;
  if (_cache[key] !== undefined) return _cache[key];
  _cache[key] = fetchResourceRaw('emoji-kitchen', { mode: 'combo', left, right }).then(data => {
      return (data && data.imageUrl) ? data : null;
  });
  return _cache[key];
}

export function invalidateApiDataCache(): void {
  delete _cache.gridSizes;
  delete _cache.albumTemplates;
  delete _cache.emojiKitchenSupported;
  delete _cache.phraseCollections;
  Object.keys(_cache).forEach(k => {
      if (k.startsWith('phrases:') || k.startsWith('emojiKitchenPartners:') || k.startsWith('emojiKitchenCombo:')) {
          delete _cache[k];
      }
  });
}
