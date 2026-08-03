import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { PillGroupField } from '../../types/PropertySchema';

FieldRegistry.register('pill-group', {
  render(container, field, value) {
    const f = field as PillGroupField;
    const label = tr(f.i18nKey, f.label ?? '');
    const activeVal = String(value ?? '');
    const isVertical = f.direction === 'vertical';

    const renderButtons = (): string => f.options.map(o => {
      const activeClass = String(o.value) === activeVal ? ' active' : '';
      const optLabel = tr(o.i18nKey, o.label ?? o.value);
      const iconHtml = o.icon ? `<span class="material-symbols-outlined" style="font-size:14px;">${o.icon}</span>` : '';
      return `
        <button type="button" class="craftools-pill${activeClass}" data-pill-value="${o.value}"
          style="${isVertical ? 'width:100%;' : 'flex:1;'} justify-content:center; gap:5px; padding:7px 10px;"
          title="${optLabel}">
          ${iconHtml}
          <span>${optLabel}</span>
        </button>`;
    }).join('');

    let wrap = container.querySelector<HTMLElement>('.ct-pill-wrap');
    if (!wrap) {
      container.innerHTML = `
        <div class="ct-field ct-field--block">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <div class="ct-field-row ct-pill-wrap" style="gap:6px; flex-direction:${isVertical ? 'column' : 'row'}; flex-wrap:wrap;">
            ${renderButtons()}
          </div>
        </div>`;
    } else {
      wrap.innerHTML = renderButtons();
    }

    container.querySelectorAll<HTMLButtonElement>('button[data-pill-value]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pillValue === activeVal);
    });
  },

  bind(container, _field, onChange) {
    container.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-pill-value]');
      if (!btn) return;
      const val = btn.dataset.pillValue;
      if (val !== undefined) {
        onChange(val);
      }
    });
  },
});
