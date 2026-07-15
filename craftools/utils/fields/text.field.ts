import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { TextField } from '../../types/PropertySchema';

FieldRegistry.register('text', {
  render(container, field, value) {
    const f = field as TextField;
    const label = tr(f.i18nKey, f.label ?? '');
    if (!container.querySelector('.ct-fi')) {
      container.innerHTML = `
        <div class="ct-field">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <input type="text" class="craftools-input ct-fi"
            ${f.placeholder ? `placeholder="${f.placeholder}"` : ''}
            ${f.maxLength   ? `maxlength="${f.maxLength}"` : ''}>
        </div>`;
    }
    const input = container.querySelector<HTMLInputElement>('.ct-fi');
    if (input) input.value = String(value ?? '');
  },

  bind(container, _field, onChange) {
    container.querySelector('.ct-fi')?.addEventListener('input', e => {
      onChange((e.target as HTMLInputElement).value);
    });
  },
});
