/**
 * FontList — shared font catalog + Google Fonts loader + "local font by
 * name" persistence, used by the font-select field handler.
 *
 * Ports three things that existed only in legacy/.js code and were never
 * reachable from the new schema-driven panel (TextTool.ts's 'font-select'
 * field had no font list at all until this file existed -- see
 * font-select.field.ts):
 *
 *  - FONTS / SYSTEM_FONTS: the base catalog (TextTool.js / VariableContentTool.js).
 *  - loadGoogleFonts(): injects the Google Fonts <link>, so non-system fonts
 *    in the list actually render in their own typeface (this existed in
 *    TextTool.js too, but was dead code -- defined, never called, since the
 *    legacy renderPropertiesPanel that used to call it was deleted).
 *  - getSavedLocalFonts()/saveLocalFont(): the "type the name of a font
 *    already installed on your device" feature from MobileToolbar.js's
 *    _renderTextFont() -- desktop never had an equivalent.
 */

import { loadFontCatalog, type ApiFontFamily } from './ApiDataLoader.ts';

/** Base font catalog fallback. */
export const FONTS: string[] = [
  'DM Sans', 'DM Serif Display', 'DM Mono', 'Open Sans', 'Pacifico', 'Lobster',
  'Georgia', 'Arial', 'Times New Roman', 'Courier New', 'Impact',
  'Parisienne', 'Dancing Script', 'Quicksand', 'Quintessential', 'Grenze Gotisch',
];

/** Fonts assumed to be pre-installed (OS-provided) -- never fetched remotely. */
export const SYSTEM_FONTS = new Set(['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Impact']);

const LOCAL_FONTS_KEY = 'craftools-local-fonts';
const DYNAMIC_FONTS_LINK_ID = 'craftools-dynamic-fonts';

let _apiFontCatalog: ApiFontFamily[] | null = null;

/**
 * Retorna os nomes das fontes disponíveis (carregadas da API ou fallback local).
 */
export async function getActiveFonts(): Promise<string[]> {
  const catalog = await loadFontCatalog();
  if (catalog && catalog.length > 0) {
    _apiFontCatalog = catalog;
    return catalog.map(f => f.name);
  }
  return FONTS;
}

/**
 * Carrega as folhas de estilo das fontes dinâmicas.
 * Tenta carregar do endpoint fonts.css.php da API; se não houver base de API configurada
 * ou se falhar, utiliza a fallback do Google Fonts.
 */
export function loadCraftoolsFonts(fonts: string[]): void {
  const nonSystemFonts = fonts.filter(f => !SYSTEM_FONTS.has(f));
  if (nonSystemFonts.length === 0) return;

  let link = document.getElementById(DYNAMIC_FONTS_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = DYNAMIC_FONTS_LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  const apiBase = (window as any).CRAFTOOLS_CONFIG?.apiBase?.replace(/\/$/, '');
  const fontQuery = nonSystemFonts.map(f => f.replace(/\s+/g, '+')).join('|');

  if (apiBase) {
    link.href = `${apiBase}/v1/fonts.css.php?family=${fontQuery}`;
  } else {
    link.href = `https://fonts.googleapis.com/css?family=${fontQuery}&display=swap`;
  }
}

/** Legacy alias */
export const loadGoogleFonts = loadCraftoolsFonts;

/** Reads the user's saved "local font" names (typed, not uploaded files) from localStorage. */
export function getSavedLocalFonts(): string[] {
  try {
    const stored = localStorage.getItem(LOCAL_FONTS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persists a new local font name, if not already saved. */
export function saveLocalFont(name: string): void {
  const saved = getSavedLocalFonts();
  if (saved.includes(name)) return;
  saved.push(name);
  try {
    localStorage.setItem(LOCAL_FONTS_KEY, JSON.stringify(saved));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) -- non-fatal,
    // the font still applies for this session, just won't persist.
  }
}
