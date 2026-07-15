import { FieldRegistry } from '../FieldRegistry';
import type { SelectField } from '../../types/PropertySchema';

FieldRegistry.register('select', {
  render(container, field, value) {
    const f = field as SelectField;

    if (!container.querySelector('.ct-fi')) {
      const options = f.options
        .map(o => `<option value="${o.value}">${o.label}</option>`)
        .join('');
      container.innerHTML = `
        <div class="ct-field">
          ${f.label ? `<div class="craftools-label">${f.label}</div>` : ''}
          <select class="craftools-select ct-fi">${options}</select>
        </div>`;
    }

    const select = container.querySelector<HTMLSelectElement>('.ct-fi');
    if (select && value !== undefined) select.value = String(value);
  },

  bind(container, _field, onChange) {
    container.querySelector('.ct-fi')?.addEventListener('change', e => {
      onChange((e.target as HTMLSelectElement).value);
    });
  },
});
