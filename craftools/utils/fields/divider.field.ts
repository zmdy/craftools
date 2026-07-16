import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { DividerField } from '../../types/PropertySchema';

FieldRegistry.register('divider', {
  render(container, field, _value) {
    const f = field as DividerField;
    const label = tr(f.i18nKey, f.label ?? '');

    // With an icon (and/or label), render as a labeled sub-header matching
    // the legacy `.ct-sublabel` convention (CommonProperties.js) -- used to
    // group Border/Radius/Padding/Margin inside a single combined
    // formaSection() accordion. Without one, keep the plain <hr> behavior
    // used by existing schemas.
    if (f.icon || label) {
      if (!container.querySelector('.ct-sublabel')) {
        container.innerHTML = `
          <div class="ct-sublabel">
            ${f.icon ? `<span class="material-symbols-outlined">${f.icon}</span>` : ''}
            ${label}
          </div>`;
      }
      return;
    }

    if (!container.querySelector('.ct-divider')) {
      container.innerHTML = `<hr class="ct-divider" style="border:none; border-top:1px solid var(--border); margin:6px 0;">`;
    }
  },

  bind(_container, _field, _onChange) {
    // Dividers are purely visual — no events.
  },
});
