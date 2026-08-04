import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';

const OPTIONS = [
  { value: 'none',       icon: 'match_case_off', i18nKey: 'textTool.textTransformNone',      label: 'Nenhuma' },
  { value: 'uppercase',  icon: 'uppercase',      i18nKey: 'textTool.textTransformUppercase', label: 'MAIÚSCULAS' },
  { value: 'lowercase',  icon: 'lowercase',      i18nKey: 'textTool.textTransformLowercase', label: 'minúsculas' },
  { value: 'capitalize', icon: 'titlecase',      i18nKey: 'textTool.textTransformCapitalize', label: 'Primeira Letra Maiúscula' },
];

FieldRegistry.register('text-transform', {
  render(container, field, value) {
    const active = String(value ?? 'none');
    const label = tr(field.i18nKey ?? 'textTool.textTransform', field.label ?? 'Transformação de texto');

    if (!container.querySelector('.ct-text-transform-group')) {
      container.innerHTML = `
        <div class="ct-field ct-field--block">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <div class="ct-field-row ct-text-transform-group" style="gap:4px;">
            ${OPTIONS.map(o => `
              <button class="craftools-pill ct-transform-btn${o.value === active ? ' active' : ''}"
                type="button" data-transform-val="${o.value}"
                style="flex:1; justify-content:center; padding:5px 0;"
                title="${tr(o.i18nKey, o.label)}">
                <span class="material-symbols-outlined" style="font-size:16px;">${o.icon}</span>
              </button>
            `).join('')}
          </div>
        </div>`;
    } else {
      container.querySelectorAll<HTMLElement>('.ct-transform-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.transformVal === active);
      });
    }
  },

  bind(container, _field, onChange) {
    container.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.ct-transform-btn');
      if (!btn) return;

      container.querySelectorAll('.ct-transform-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset.transformVal ?? 'none');
    });
  },
});
