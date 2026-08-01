import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { TextareaField } from '../../types/PropertySchema';

/**
 * Multi-line plain-text field -- same shape/contract as text.field.ts, just
 * backed by a `<textarea>` instead of `<input type="text">` so explicit line
 * breaks are preserved (LetteringTool.ts's phrase field is the first real
 * consumer: `\n` there starts a new hard line in the lettering layout).
 *
 * 'textarea' was declared in PropertySchema.ts's FieldType union from the
 * start, but no handler was ever registered for it -- every schema that
 * listed `type: 'textarea'` silently hit PropertyRenderer's "No handler for
 * field type" warning and rendered nothing.
 */
FieldRegistry.register('textarea', {
  render(container, field, value) {
    const f = field as TextareaField;
    const label = tr(f.i18nKey, f.label ?? '');
    if (!container.querySelector('.ct-fi')) {
      container.innerHTML = `
        <div class="ct-field">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <textarea class="craftools-input ct-fi" rows="${f.rows ?? 3}"
            style="resize:vertical;font-family:inherit;"
            ${f.placeholder ? `placeholder="${f.placeholder}"` : ''}></textarea>
        </div>`;
    }
    const input = container.querySelector<HTMLTextAreaElement>('.ct-fi');
    // Skip syncing while the user is actively focused/typing in it -- avoids
    // resetting the caret to the end on every keystroke (PropertyRenderer
    // re-renders on every diffed value change, including the one this very
    // input just caused).
    if (input && document.activeElement !== input) {
      input.value = String(value ?? '');
    }
  },

  bind(container, _field, onChange) {
    container.querySelector('.ct-fi')?.addEventListener('input', e => {
      onChange((e.target as HTMLTextAreaElement).value);
    });
  },
});
