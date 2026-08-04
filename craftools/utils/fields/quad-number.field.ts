import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { QuadNumberField } from '../../types/PropertySchema';

FieldRegistry.register('quad-number', {
  render(container, field, value) {
    const f = field as QuadNumberField;
    const values = Array.isArray(value) ? value : [value, value, value, value];
    const val0 = Number(values[0]) || 0;
    const val1 = Number(values[1]) || 0;
    const val2 = Number(values[2]) || 0;
    const val3 = Number(values[3]) || 0;

    const mainLabel = tr(f.i18nKey, f.label ?? '');
    const defaultLabels = f.labels ?? ['Cima', 'Direita', 'Baixo', 'Esquerda'];
    const i18nKeys = f.i18nKeys ?? ['common.top', 'common.right', 'common.bottom', 'common.left'];

    // Auto-detect linked state (all values equal) if user hasn't explicitly toggled it
    const isCurrentlyEqual = val0 === val1 && val1 === val2 && val2 === val3;
    if (!container.dataset.linkedState) {
      container.dataset.linked = isCurrentlyEqual ? 'true' : 'false';
    }
    const isLinked = container.dataset.linked === 'true';

    if (!container.querySelector('.ct-quad-container')) {
      container.innerHTML = `
        <div class="ct-quad-container" style="margin-bottom:10px;">
          <div class="ct-quad-header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            ${mainLabel ? `<div class="craftools-label" style="margin:0; font-weight:600; font-size:11px;">${mainLabel}</div>` : '<div></div>'}
            <button type="button" class="craftools-pill ct-quad-link-btn ${isLinked ? 'active' : ''}" style="display:flex; align-items:center; gap:4px; padding:2px 8px; font-size:10px;">
              <span class="material-symbols-outlined ct-quad-link-icon" style="font-size:13px;">${isLinked ? 'link' : 'link_off'}</span>
              <span class="ct-quad-link-text">${isLinked ? tr('common.linked', 'Vinculados') : tr('common.unlinked', 'Desvinculados')}</span>
            </button>
          </div>
          <div class="ct-quad-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            ${[0, 1, 2, 3].map(i => {
              const labelText = tr(i18nKeys[i], defaultLabels[i]);
              return `
                <div class="ct-quad-item" style="display:flex; flex-direction:column; gap:2px;">
                  <label style="font-size:9px; color:var(--text-muted); text-align:center; text-transform:uppercase; letter-spacing:.5px;">${labelText}</label>
                  <div style="position:relative; display:flex; align-items:center;">
                    <input type="number" class="craftools-input ct-quad-input" data-idx="${i}"
                      min="${f.min ?? 0}" max="${f.max ?? 999}" step="${f.step ?? 1}"
                      style="padding:4px; text-align:center; width:100%; font-size:12px;">
                    ${f.unit ? `<span style="position:absolute; right:6px; font-size:9px; color:var(--accent); font-weight:600; pointer-events:none;">${f.unit}</span>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Sync button state
    const linkBtn = container.querySelector<HTMLButtonElement>('.ct-quad-link-btn');
    const linkIcon = container.querySelector<HTMLElement>('.ct-quad-link-icon');
    const linkText = container.querySelector<HTMLElement>('.ct-quad-link-text');

    if (linkBtn) linkBtn.classList.toggle('active', isLinked);
    if (linkIcon) linkIcon.textContent = isLinked ? 'link' : 'link_off';
    if (linkText) linkText.textContent = isLinked ? tr('common.linked', 'Vinculados') : tr('common.unlinked', 'Desvinculados');

    // Sync inputs (without blurring currently focused input)
    const inputs = container.querySelectorAll<HTMLInputElement>('.ct-quad-input');
    const currentVals = [val0, val1, val2, val3];
    inputs.forEach((input, idx) => {
      if (document.activeElement !== input) {
        input.value = String(currentVals[idx]);
      }
    });
  },

  bind(container, field, onChange) {
    const f = field as QuadNumberField;
    const keys = f.keys;

    const linkBtn = container.querySelector<HTMLButtonElement>('.ct-quad-link-btn');
    const linkIcon = container.querySelector<HTMLElement>('.ct-quad-link-icon');
    const linkText = container.querySelector<HTMLElement>('.ct-quad-link-text');

    linkBtn?.addEventListener('click', () => {
      const nowLinked = container.dataset.linked !== 'true';
      container.dataset.linked = String(nowLinked);
      container.dataset.linkedState = 'user';

      if (linkBtn) linkBtn.classList.toggle('active', nowLinked);
      if (linkIcon) linkIcon.textContent = nowLinked ? 'link' : 'link_off';
      if (linkText) linkText.textContent = nowLinked ? tr('common.linked', 'Vinculados') : tr('common.unlinked', 'Desvinculados');

      if (nowLinked) {
        // Equalize all 4 values to the first input's current value
        const inputs = container.querySelectorAll<HTMLInputElement>('.ct-quad-input');
        const firstVal = Number(inputs[0]?.value) || 0;
        inputs.forEach(inp => { inp.value = String(firstVal); });

        // Dispatch change for all 4 keys
        keys.forEach(k => onChange(firstVal, k));
      }
    });

    container.querySelectorAll<HTMLInputElement>('.ct-quad-input').forEach(input => {
      const idx = Number(input.dataset.idx);

      const handleInput = () => {
        const val = Number(input.value) || 0;
        const isLinked = container.dataset.linked === 'true';

        if (isLinked) {
          const inputs = container.querySelectorAll<HTMLInputElement>('.ct-quad-input');
          inputs.forEach(inp => {
            if (inp !== input) inp.value = String(val);
          });
          keys.forEach(k => onChange(val, k));
        } else {
          onChange(val, keys[idx]);
        }
      };

      input.addEventListener('input', handleInput);
      input.addEventListener('change', handleInput);
    });
  },
});
