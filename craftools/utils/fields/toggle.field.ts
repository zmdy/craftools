import { FieldRegistry } from '../FieldRegistry';
import type { ToggleField } from '../../types/PropertySchema';

FieldRegistry.register('toggle', {
  render(container, field, value) {
    const f = field as ToggleField;
    const checked = Boolean(value);

    if (!container.querySelector('.ct-fi')) {
      container.innerHTML = `
        <div class="ct-field-row" style="justify-content:space-between; padding:2px 0;">
          ${f.label ? `<span class="craftools-label" style="margin:0;">${f.label}</span>` : ''}
          <label class="ct-toggle-label" style="display:flex; align-items:center; cursor:pointer; gap:6px;">
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
