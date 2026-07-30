/**
 * font-style field — a row of independent icon-toggle buttons (Bold/
 * Italic/Underline, or any subset a tool actually persists), styled
 * exactly like align.field.ts's pill group instead of the separate
 * iOS-style toggle switches these used to be. Standardizes the font-style
 * controls across every font-using tool into one shared component -- see
 * CommonSchema.ts's fontStyleField() for how tools opt in, matching the
 * ctx-bar's own "bius" button group (TextTool.ts's getCtxOptions()) so the
 * properties panel and the ctx-bar finally look consistent with each other.
 *
 * Unlike every other field type, this one drives MULTIPLE independent
 * state keys (one per button) from a single schema entry. That's possible
 * because:
 *  - the field's `buttons` array carries each button's own state key
 *  - the schema entry sets `watchKeys` to those same keys, so
 *    PropertyRenderer.ts diffs/re-renders on ANY of them changing (see its
 *    `_renderField()`), not just the field's nominal `key`
 *  - `bind()`'s onChange accepts an optional key override (see
 *    FieldRegistry.ts), so each button's click can target ITS OWN key
 *    instead of being locked to the field's nominal one
 */
import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { FontStyleField as FontStyleFieldSchema } from '../../types/PropertySchema';

FieldRegistry.register('font-style', {
  render(container, field, value) {
    const f = field as FontStyleFieldSchema;
    // PropertyRenderer.ts passes the ARRAY built from watchKeys (same
    // order as f.buttons) once `watchKeys` is set -- falls back to
    // all-off so the very first render (before any state exists) doesn't
    // throw on a non-array value.
    const values = Array.isArray(value) ? value : f.buttons.map(() => false);

    if (!container.querySelector('.ct-fontstyle-group')) {
      container.innerHTML = `
        <div class="ct-field-row ct-fontstyle-group" style="gap:4px;">
          ${f.buttons.map((b, i) => `
            <button class="craftools-pill ct-fontstyle-btn${values[i] ? ' active' : ''}"
              type="button" data-key="${b.key}"
              style="flex:1; justify-content:center; padding:5px 0;"
              title="${tr(b.i18nKey, b.label ?? b.key)}">
              <span class="material-symbols-outlined" style="font-size:14px;">${b.icon}</span>
            </button>
          `).join('')}
        </div>`;
    } else {
      // Update active state without recreating DOM (same pattern as
      // align.field.ts) -- each button is independent, no radio behavior.
      container.querySelectorAll<HTMLElement>('.ct-fontstyle-btn').forEach((btn, i) => {
        btn.classList.toggle('active', Boolean(values[i]));
      });
    }
  },

  bind(container, _field, onChange) {
    container.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.ct-fontstyle-btn');
      if (!btn) return;
      const key = btn.dataset.key;
      if (!key) return;

      const next = !btn.classList.contains('active');
      // Immediate UI feedback -- don't wait for the external re-render
      // loop to reflect the click (same as align.field.ts).
      btn.classList.toggle('active', next);
      onChange(next, key);
    });
  },
});
