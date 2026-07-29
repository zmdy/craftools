import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { ToggleField } from '../../types/PropertySchema';

FieldRegistry.register('toggle', {
  render(container, field, value) {
    const f = field as ToggleField;
    const checked = Boolean(value);
    const label = tr(f.i18nKey, f.label ?? '');

    if (!container.querySelector('.ct-fi')) {
      // Uses .ct-field so .ct-accordion-content's Elementor-style row CSS
      // (label left, control right) applies. The toggle sits at margin-left:auto
      // so it hugs the right edge regardless of label length.
      container.innerHTML = `
        <div class="ct-field">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <label class="ct-toggle-label" style="display:flex; align-items:center; cursor:pointer; gap:6px; margin-left:auto;">
            <input type="checkbox" class="ct-fi" style="display:none;">
            <span class="ct-toggle-track" style="
              width:32px; height:18px; border-radius:99px;
              background:var(--border); position:relative; transition:background .15s; flex-shrink:0;">
              <span class="ct-toggle-thumb" style="
                position:absolute; top:2px; left:2px;
                width:14px; height:14px; border-radius:50%;
                background:#fff; transition:transform .15s; box-shadow:0 1px 3px rgba(0,0,0,.2);">
              </span>
            </span>
          </label>
        </div>`;
    }

    const input = container.querySelector<HTMLInputElement>('.ct-fi');
    const track = container.querySelector<HTMLElement>('.ct-toggle-track');
    const thumb = container.querySelector<HTMLElement>('.ct-toggle-thumb');

    if (input) input.checked = checked;
    if (track) track.style.background = checked ? 'var(--accent)' : 'var(--border)';
    if (thumb) thumb.style.transform  = checked ? 'translateX(14px)' : 'translateX(0)';
  },

  bind(container, _field, onChange) {
    container.querySelector('.ct-fi')?.addEventListener('change', e => {
      const checked = (e.target as HTMLInputElement).checked;
      const track = container.querySelector<HTMLElement>('.ct-toggle-track');
      const thumb = container.querySelector<HTMLElement>('.ct-toggle-thumb');
      if (track) track.style.background = checked ? 'var(--accent)' : 'var(--border)';
      if (thumb) thumb.style.transform  = checked ? 'translateX(14px)' : 'translateX(0)';
      onChange(checked);
    });
  },
});
