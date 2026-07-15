import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { SliderField } from '../../types/PropertySchema';

FieldRegistry.register('slider', {
  render(container, field, value) {
    const f    = field as SliderField;
    const val  = value !== undefined && value !== null ? Number(value) : f.min;
    const step = f.step ?? (f.max <= 1 ? 0.01 : 1);
    const label = tr(f.i18nKey, f.label ?? '');

    if (!container.querySelector('.ct-fi')) {
      container.innerHTML = `
        <div class="ct-field">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <div class="ct-field-row">
            <input type="range" class="ct-fi" style="flex:1;"
              min="${f.min}" max="${f.max}" step="${step}" value="${val}">
            <span class="ct-val-badge ct-slider-badge">${val}</span>
          </div>
        </div>`;
    }

    const input = container.querySelector<HTMLInputElement>('.ct-fi');
    const badge = container.querySelector<HTMLElement>('.ct-slider-badge');
    if (input) input.value = String(val);
    if (badge) badge.textContent = String(val);
  },

  bind(container, _field, onChange) {
    container.querySelector('.ct-fi')?.addEventListener('input', e => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      const badge = container.querySelector<HTMLElement>('.ct-slider-badge');
      if (badge) badge.textContent = String(v);
      onChange(v);
    });
  },
});
