import { FieldRegistry } from '../FieldRegistry';
import type { TextField } from '../../types/PropertySchema';

FieldRegistry.register('text', {
  render(container, field, value) {
    const f = field as TextField;
    if (!container.querySelector('.ct-fi')) {
      container.innerHTML = `
        <div class="ct-field">
          ${f.label ? `<div class="craftools-label">${f.label}</div>` : ''}
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
