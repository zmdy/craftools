import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { MonthField } from '../../types/PropertySchema';

/**
 * Native `<input type="month">` -- a single browser-provided month+year
 * picker. Replaces what several tools used to build by hand as a "month
 * select + year number input" pair (MiniCalendarTool, CalendarTool's
 * legacy panel, VariablePanel's 'miniCalendar' variable type) with the
 * correct native HTML control for this exact use case. Mirrors
 * text.field.ts's structure (single plain input, no extra wrapper needed --
 * `.craftools-input`'s own `width:100%` is enough for it to size correctly
 * inside `.ct-field`'s row layout, same as every other single-input field).
 *
 * Stored/reported value is the input's own native string format, "YYYY-MM"
 * (e.g. "2026-07") -- split on '-' for separate year/month numbers.
 */
FieldRegistry.register('month', {
  render(container, field, value) {
    const f = field as MonthField;
    const label = tr(f.i18nKey, f.label ?? '');
    if (!container.querySelector('.ct-fi')) {
      container.innerHTML = `
        <div class="ct-field">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <input type="month" class="craftools-input ct-fi"
            ${f.min ? `min="${f.min}"` : ''}
            ${f.max ? `max="${f.max}"` : ''}>
        </div>`;
    }
    const input = container.querySelector<HTMLInputElement>('.ct-fi');
    if (input && value) input.value = String(value);
  },

  bind(container, _field, onChange) {
    container.querySelector('.ct-fi')?.addEventListener('change', e => {
      const value = (e.target as HTMLInputElement).value;
      if (value) onChange(value);
    });
  },
});
