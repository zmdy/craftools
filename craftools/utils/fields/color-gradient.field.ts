/**
 * color-gradient field — two color pickers for gradient from/to.
 *
 * Value format: { from: '#rrggbb', to: '#rrggbb', angle?: number }
 * onChange receives the updated gradient object.
 */

import { FieldRegistry } from '../FieldRegistry';
import type { ColorGradientField } from '../../types/PropertySchema';

type GradientValue = { from: string; to: string; angle?: number };

const DEFAULT: GradientValue = { from: '#f97316', to: '#facc15', angle: 90 };

FieldRegistry.register('color-gradient', {
  render(container, field, value) {
    const f = field as ColorGradientField;
    const g: GradientValue = (value as GradientValue) ?? DEFAULT;

    if (!container.querySelector('.ct-grad-from')) {
      container.innerHTML = `
        <div class="ct-field">
          ${f.label ? `<div class="craftools-label">${f.label}</div>` : ''}
          <div class="ct-field-row" style="gap:6px;">
            <div style="flex:1; display:flex; flex-direction:column; gap:3px;">
              <span class="ct-sublabel">From</span>
              <input type="color" class="craftools-color-swatch ct-grad-from" style="width:100%; height:28px;">
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:3px;">
              <span class="ct-sublabel">To</span>
              <input type="color" class="craftools-color-swatch ct-grad-to" style="width:100%; height:28px;">
            </div>
            <div style="display:flex; flex-direction:column; gap:3px; min-width:52px;">
              <span class="ct-sublabel">Angle</span>
              <div class="ct-field-row" style="gap:2px;">
                <input type="number" class="craftools-input ct-grad-angle" min="0" max="360" step="5"
                  style="padding:4px 5px; font-size:11px;">
                <span class="ct-val-badge">°</span>
              </div>
            </div>
          </div>
        </div>`;
    }

    const fromEl  = container.querySelector<HTMLInputElement>('.ct-grad-from');
    const toEl    = container.querySelector<HTMLInputElement>('.ct-grad-to');
    const angleEl = container.querySelector<HTMLInputElement>('.ct-grad-angle');

    if (fromEl)  fromEl.value  = g.from  ?? DEFAULT.from;
    if (toEl)    toEl.value    = g.to    ?? DEFAULT.to;
    if (angleEl) angleEl.value = String(g.angle ?? DEFAULT.angle);
  },

  bind(container, _field, onChange) {
    const emit = () => {
      const from  = container.querySelector<HTMLInputElement>('.ct-grad-from')?.value  ?? DEFAULT.from;
      const to    = container.querySelector<HTMLInputElement>('.ct-grad-to')?.value    ?? DEFAULT.to;
      const angle = parseInt(container.querySelector<HTMLInputElement>('.ct-grad-angle')?.value ?? '90', 10);
      onChange({ from, to, angle });
    };

    container.querySelector('.ct-grad-from')?.addEventListener('input', emit);
    container.querySelector('.ct-grad-to')?.addEventListener('input', emit);
    container.querySelector('.ct-grad-angle')?.addEventListener('change', emit);
  },
});
