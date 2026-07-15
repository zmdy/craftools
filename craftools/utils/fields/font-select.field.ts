/**
 * font-select field — uses the existing <ct-font-select> custom element.
 *
 * The CtFontSelect element is a full-featured font picker with preview.
 * We import it here so it is guaranteed to be registered before the field renders.
 */

import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { FontSelectField } from '../../types/PropertySchema';
// Register the custom element (idempotent — guarded inside CtFontSelect.js)
import '../../components/CtFontSelect.js';

FieldRegistry.register('font-select', {
  render(container, field, value) {
    const f = field as FontSelectField;
    const label = tr(f.i18nKey, f.label ?? '');

    if (!container.querySelector('ct-font-select')) {
      container.innerHTML = `
        <div class="ct-field">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <ct-font-select class="craftools-select ct-fi" style="display:block; width:100%;"></ct-font-select>
        </div>`;
    }

    const el = container.querySelector<HTMLElement & { value?: string }>('ct-font-select');
    if (el && value !== undefined) {
      // CtFontSelect exposes a `value` property
      if ('value' in el) el.value = String(value);
    }
  },

  bind(container, _field, onChange) {
    // CtFontSelect dispatches a standard 'change' event
    container.querySelector('ct-font-select')?.addEventListener('change', e => {
      onChange((e as CustomEvent).detail ?? (e.target as HTMLElement & { value?: string }).value);
    });
  },
});
