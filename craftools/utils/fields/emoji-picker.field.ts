/**
 * emoji-picker field — the standardized category-tab + search + grid emoji
 * picker (see utils/EmojiPickerUI.ts), embedded inline in a properties
 * panel. Used by EmojiTool.ts's own 'emoji' field so an already-selected
 * emoji element offers the exact same picking experience as the sidebar
 * "insert emoji" panel, instead of a bare text input for the raw character.
 *
 * Stored/reported value is a plain emoji string -- unlike color-picker.field.ts
 * or variable-binding.field.ts, there's no composite object to serialize.
 */

import { FieldRegistry } from '../FieldRegistry';
import { renderEmojiPicker } from '../EmojiPickerUI';

interface BoundContainer extends HTMLElement {
  _ctFieldOnChange?: (value: unknown) => void;
}

FieldRegistry.register('emoji-picker', {
  render(container, _field, value) {
    const f = container as BoundContainer;

    if (!container.querySelector('.ct-emoji-picker-wrap')) {
      container.innerHTML = `<div class="ct-emoji-picker-wrap"></div>`;
    }
    const wrap = container.querySelector<HTMLElement>('.ct-emoji-picker-wrap')!;

    renderEmojiPicker(wrap, {
      selected: String(value ?? ''),
      draggable: false,
      onSelect: (emoji) => f._ctFieldOnChange?.(emoji),
    });
  },

  bind(container, _field, onChange) {
    (container as BoundContainer)._ctFieldOnChange = onChange;
  },
});
