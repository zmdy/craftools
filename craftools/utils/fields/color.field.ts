/**
 * color field — solid-only color picker.
 *
 * Renders through the standardized ColorPickerUI (utils/ColorPickerUI.ts,
 * allowGradient: false): a preset swatch palette + a custom-color swatch,
 * same visual language as color-picker.field.ts and PageTool.ts's page
 * background, just without the Color/Gradient mode pills since this field
 * has nowhere to store a gradient value.
 *
 * Stored/reported value is a bare hex string (e.g. '#f97316'), unchanged
 * from before this field was upgraded -- existing tools (BarcodeTool,
 * ShapeTool, IconTool, PaperTool, QRCodeTool, MiniCalendarTool, CarimboTool,
 * ImageTool border color, etc.) all read/write a plain string here already,
 * so this upgrade needed zero schema or _applyProperty changes anywhere.
 */

import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import { renderColorPicker } from '../ColorPickerUI';
import type { ColorField } from '../../types/PropertySchema';

interface BoundContainer extends HTMLElement {
  _ctFieldOnChange?: (value: unknown) => void;
}

FieldRegistry.register('color', {
  render(container, field, value) {
    const f = container as BoundContainer;
    const label = tr((field as ColorField).i18nKey, (field as ColorField).label ?? '');

    if (!container.querySelector('.ct-color-picker-wrap')) {
      container.innerHTML = `
        <div class="ct-field">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <div class="ct-color-picker-wrap"></div>
        </div>`;
    }

    const wrap = container.querySelector<HTMLElement>('.ct-color-picker-wrap')!;
    renderColorPicker(wrap, value, (next) => {
      f._ctFieldOnChange?.(next.solid);
    }, { allowGradient: false });
  },

  bind(container, _field, onChange) {
    (container as BoundContainer)._ctFieldOnChange = onChange;
  },
});
