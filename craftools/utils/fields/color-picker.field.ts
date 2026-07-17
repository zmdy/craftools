/**
 * color-picker field — the standardized solid-OR-gradient picker.
 *
 * Replaces the old three-field pattern every color+gradient tool used to
 * need (a 'select'/'toggle' mode switch + a 'color' field + a
 * 'color-gradient' field, each of the latter two conditionally hidden via
 * `field.hidden`). That pattern had two problems this field fixes:
 *
 *  1. `field.hidden` is only re-evaluated when getPropertySchema() itself
 *     re-runs (i.e. on a fresh renderPropertiesPanel() call, which only
 *     happens on element SELECTION) -- so toggling the mode select didn't
 *     actually swap which field was visible until the user deselected and
 *     reselected the element.
 *  2. It needed three separate state keys kept in sync by hand.
 *
 * This field owns its own internal mode state entirely (via
 * utils/ColorPickerUI.ts) and repaints itself directly on every
 * interaction, so switching Cor/Gradiente updates immediately, with no
 * dependency on the outer schema/panel re-rendering at all.
 *
 * Stored/reported value is a JSON *string* of a ColorPickerValue object
 * (`{ mode, solid, gradient }`) -- see variable-binding.field.ts for why:
 * PropertyRenderer's re-render diffing compares String(value), and every
 * plain object stringifies to the same "[object Object]", which would
 * silently stop this field from ever refreshing again for the same element
 * (e.g. after the paste-style bar overwrites its color). Consumers
 * (TextTool.ts, TextoCurvoTool.ts) JSON.parse() it in _applyProperty() and
 * JSON.stringify() it back in _syncFromDOM().
 */

import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import { renderColorPicker, normalizeValue, type ColorPickerValue } from '../ColorPickerUI';
import type { ColorPickerField } from '../../types/PropertySchema';

interface BoundContainer extends HTMLElement {
  _ctFieldOnChange?: (value: unknown) => void;
}

FieldRegistry.register('color-picker', {
  render(container, field, value) {
    const f = container as BoundContainer;
    const label = tr((field as ColorPickerField).i18nKey, (field as ColorPickerField).label ?? '');

    if (!container.querySelector('.ct-color-picker-wrap')) {
      container.innerHTML = `
        <div class="ct-field">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <div class="ct-color-picker-wrap"></div>
        </div>`;
    }

    const wrap = container.querySelector<HTMLElement>('.ct-color-picker-wrap')!;
    renderColorPicker(wrap, value, (next: ColorPickerValue) => {
      f._ctFieldOnChange?.(JSON.stringify(next));
    }, { allowGradient: true });
  },

  bind(container, _field, onChange) {
    (container as BoundContainer)._ctFieldOnChange = onChange;
  },
});

/** Re-exported so tools don't need their own import of ColorPickerUI just to parse this field's stored value. */
export { normalizeValue as parseColorPickerValue, type ColorPickerValue };
