import { FieldRegistry } from '../FieldRegistry';
import type { NumberField } from '../../types/PropertySchema';

FieldRegistry.register('number', {
  render(container, field, value) {
    const f = field as NumberField;
    if (!container.querySelector('.ct-fi')) {
      container.innerHTML = `
        <div class="ct-field">
          ${f.label ? `<div class="craftools-label">${f.label}</div>` : ''}
          <div class="ct-field-row">
            <input type="number" class="craftools-input ct-fi" style="flex:1;"
              ${f.min  !== undefined ? `min="${f.min}"`   : ''}
              ${f.max  !== undefined ? `max="${f.max}"`   : ''}
              ${f.step !== undefined ? `step="${f.step}"` : 'step="1"'}>
            ${f.unit ? `<span class="ct-val-badge">${f.unit}</span>` : ''}
          </div>
        </div>`;
    }
    const input = container.querySelector<HTMLInputElement>('.ct-fi');
    if (input && value !== undefined && value !== null) input.value = String(value);
  },

  bind(container, field, onChange) {
    const f = field as NumberField;
    container.querySelector('.ct-fi')?.addEventListener('change', e => {
      const raw = parseFloat((e.target as HTMLInputElement).value);
      const clamped = Math.min(
        f.max  !== undefined ? f.max  : Infinity,
        Math.max(f.min !== undefined ? f.min : -Infinity, raw),
      );
      onChange(isNaN(clamped) ? raw : clamped);
    });
  },
});
