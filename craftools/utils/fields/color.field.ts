import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { ColorField } from '../../types/PropertySchema';

FieldRegistry.register('color', {
  render(container, field, value) {
    const f = field as ColorField;
    const label = tr(f.i18nKey, f.label ?? '');
    if (!container.querySelector('.ct-fi')) {
      container.innerHTML = `
        <div class="ct-field">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <div class="ct-field-row">
            <input type="color" class="craftools-color-swatch ct-fi" style="width:100%; height:32px;">
          </div>
        </div>`;
    }
    const input = container.querySelector<HTMLInputElement>('.ct-fi');
    if (input && value) input.value = String(value);
  },

  bind(container, _field, onChange) {
    container.querySelector('.ct-fi')?.addEventListener('input', e => {
      onChange((e.target as HTMLInputElement).value);
    });
  },
});
