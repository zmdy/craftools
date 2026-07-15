/**
 * i18nLabel — resolves a translated label for schema-driven panel pieces
 * (accordion section titles, field labels), falling back to a literal string
 * when there's no i18nKey or no translation for it.
 *
 * Why the fallback check matters: I18n.t() (settings/Translations.js) returns
 * the raw key itself when no translation is found for the current language --
 * it never returns undefined/empty. So simply calling I18n.t(key) for a key
 * that doesn't exist yet (several were introduced by the TS migration without
 * matching translation entries -- see PropertySchema.ts/CommonSchema.ts) would
 * show something like "common.opacity" literally on screen instead of a
 * readable word. This helper detects that exact case (translated === key,
 * meaning "not found") and falls back to the literal label instead.
 */

import { I18n } from '../settings/Translations.js';

export function tr(i18nKey: string | undefined, fallback: string): string {
  if (!i18nKey) return fallback;
  const translated = I18n.t(i18nKey);
  return translated === i18nKey ? fallback : translated;
}
