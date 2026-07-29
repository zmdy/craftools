/**
 * font-select field — uses the existing <ct-font-select> custom element.
 *
 * The CtFontSelect element is a full-featured font picker with preview.
 * We import it here so it is guaranteed to be registered before the field renders.
 *
 * Also ports two things the schema-driven panel never had (this handler used
 * to create <ct-font-select> with ZERO <option> children -- an empty,
 * unusable dropdown):
 *  - the base font catalog + Google Fonts loading (utils/FontList.ts)
 *  - the "type the name of a font already installed on your device" custom
 *    font input, ported from MobileToolbar.js's _renderTextFont() (desktop
 *    never had an equivalent -- this was the "fontes locais" gap).
 */

import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { FontSelectField } from '../../types/PropertySchema';
import { FONTS, loadGoogleFonts, getSavedLocalFonts, saveLocalFont } from '../FontList';
// Register the custom element (idempotent — guarded inside CtFontSelect.js)
import '../../components/CtFontSelect.js';
// Registers the 'mobileToolbar.*' keys reused below (addCustomFont/
// customFontPlaceholder/loadFontBtn) so this desktop UI and the mobile one
// share translated strings instead of duplicating new i18n keys.
import '../../utils/MobileToolbar_Translations.js';

/** Base catalog + any saved local fonts + the current value, deduped. */
function buildFontList(field: FontSelectField, currentValue: unknown): string[] {
  const base = field.fonts && field.fonts.length ? field.fonts : FONTS;
  const fonts = [...base];
  for (const local of getSavedLocalFonts()) {
    if (!fonts.includes(local)) fonts.push(local);
  }
  const current = typeof currentValue === 'string' ? currentValue : '';
  if (current && !fonts.includes(current)) fonts.push(current);
  return fonts;
}

FieldRegistry.register('font-select', {
  render(container, field, value) {
    const f = field as FontSelectField;
    const label = tr(f.i18nKey, f.label ?? '');
    const allowCustom = f.allowCustom !== false;
    const fonts = buildFontList(f, value);

    if (!container.querySelector('ct-font-select')) {
      container.innerHTML = `
        <div class="ct-field ct-field--block">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <ct-font-select class="craftools-select ct-fi" style="display:block; width:100%;"></ct-font-select>
          ${allowCustom ? `
            <div class="ct-add-font" style="margin-top:8px;">
              <div class="craftools-label" style="margin-bottom:4px;">${tr('mobileToolbar.addCustomFont', 'Adicionar fonte personalizada')}</div>
              <div class="ct-field-row" style="gap:6px;">
                <input type="text" class="craftools-input ct-add-font-input" style="flex:1;"
                  placeholder="${tr('mobileToolbar.customFontPlaceholder', 'Ex: Roboto')}">
                <button type="button" class="craftools-pill ct-add-font-btn">${tr('mobileToolbar.loadFontBtn', 'Carregar')}</button>
              </div>
            </div>` : ''}
        </div>`;
    }

    const select = container.querySelector<HTMLElement & { value?: string }>('ct-font-select');
    if (select) {
      // Rebuild <option> children whenever the wanted list differs (e.g. a
      // local font was just added elsewhere) -- cheap, keeps the light DOM
      // in sync with whatever buildFontList() currently returns.
      const existingValues = [...select.querySelectorAll('option')].map(o => o.getAttribute('value'));
      if (existingValues.length !== fonts.length || existingValues.some((v, i) => v !== fonts[i])) {
        select.innerHTML = fonts.map(fn => `<option value="${fn}">${fn}</option>`).join('');
      }
      if (value !== undefined) select.value = String(value);
    }

    loadGoogleFonts(fonts);
  },

  bind(container, field, onChange) {
    const f = field as FontSelectField;

    // CtFontSelect dispatches a standard 'change' event
    container.querySelector('ct-font-select')?.addEventListener('change', e => {
      onChange((e as CustomEvent).detail ?? (e.target as HTMLElement & { value?: string }).value);
    });

    if (f.allowCustom === false) return;

    const input = container.querySelector<HTMLInputElement>('.ct-add-font-input');
    const btn   = container.querySelector<HTMLButtonElement>('.ct-add-font-btn');

    btn?.addEventListener('click', () => {
      const val = input?.value.trim();
      if (!val) return;

      saveLocalFont(val);
      loadGoogleFonts([val]);

      const select = container.querySelector<HTMLElement & { value?: string }>('ct-font-select');
      if (select) {
        const already = [...select.querySelectorAll('option')].some(o => o.getAttribute('value') === val);
        if (!already) {
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = val;
          select.appendChild(opt);
        }
        select.value = val;
      }

      onChange(val);
      if (input) input.value = '';
    });
  },
});
