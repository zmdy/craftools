/**
 * page-align field — the "Alinhar na página" 6-button grid.
 *
 * Faithful port of CommonProperties.js's _appendAlinhamento() button grid
 * (same classes/icons/layout) into the schema-driven architecture. Unlike
 * every other field type, this one has no stored value to diff/reflect --
 * clicking a button reports the direction string via onChange, and the
 * actual DOM effect (SnapEngine.align) is applied by BaseTool.ts's default
 * _applyProperty(), which special-cases the 'pageAlign' key (see
 * pageAlignSection() in CommonSchema.ts).
 */
import { FieldRegistry } from '../FieldRegistry';

const DIRECTIONS: Array<{ dir: string; icon: string }> = [
  { dir: 'left',     icon: 'align_horizontal_left' },
  { dir: 'center-h', icon: 'align_horizontal_center' },
  { dir: 'right',    icon: 'align_horizontal_right' },
  { dir: 'top',      icon: 'align_vertical_top' },
  { dir: 'center-v', icon: 'align_vertical_center' },
  { dir: 'bottom',   icon: 'align_vertical_bottom' },
];

const btnHtml = ({ dir, icon }: { dir: string; icon: string }): string => `
  <button class="craftools-icon-btn ct-align-btn" data-align="${dir}" type="button"
    style="flex:1; padding:5px 0; display:flex; align-items:center; justify-content:center; border-radius:6px;">
    <span class="material-symbols-outlined" style="font-size:16px;">${icon}</span>
  </button>`;

FieldRegistry.register('page-align', {
  render(container, _field, _value) {
    // Built once -- nothing to reflect on re-render, this is a pure action.
    if (container.querySelector('.ct-align-grid')) return;
    container.innerHTML = `
      <div class="ct-align-grid">
        <div style="display:flex; gap:4px; margin-bottom:4px;">
          ${DIRECTIONS.slice(0, 3).map(btnHtml).join('')}
        </div>
        <div style="display:flex; gap:4px;">
          ${DIRECTIONS.slice(3).map(btnHtml).join('')}
        </div>
      </div>`;
  },

  bind(container, _field, onChange) {
    container.querySelectorAll<HTMLButtonElement>('.ct-align-btn').forEach(b => {
      b.addEventListener('click', () => onChange(b.dataset.align));
    });
  },
});
