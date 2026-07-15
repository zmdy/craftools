/**
 * align field — horizontal text alignment pill group (left / center / right).
 * Value: 'left' | 'center' | 'right'
 */

import { FieldRegistry } from '../FieldRegistry';

const OPTIONS = [
  { value: 'left',   icon: 'format_align_left' },
  { value: 'center', icon: 'format_align_center' },
  { value: 'right',  icon: 'format_align_right' },
  { value: 'justify', icon: 'format_align_justify' },
];

FieldRegistry.register('align', {
  render(container, field, value) {
    const active = String(value ?? 'left');

    if (!container.querySelector('.ct-align-group')) {
      container.innerHTML = `
        <div class="ct-field-row ct-align-group" style="gap:4px;">
          ${OPTIONS.map(o => `
            <button class="craftools-pill ct-align-btn${o.value === active ? ' active' : ''}"
              type="button" data-align-val="${o.value}"
              style="flex:1; justify-content:center; padding:5px 0;"
              title="${o.value}">
              <span class="material-symbols-outlined" style="font-size:14px;">${o.icon}</span>
            </button>
          `).join('')}
        </div>`;
    } else {
      // Update active state without recreating DOM
      container.querySelectorAll<HTMLElement>('.ct-align-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.alignVal === active);
      });
    }
  },

  bind(container, _field, onChange) {
    container.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.ct-align-btn');
      if (!btn) return;

      container.querySelectorAll('.ct-align-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset.alignVal ?? 'left');
    });
  },
});
