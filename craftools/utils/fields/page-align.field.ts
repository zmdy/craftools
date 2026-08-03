/**
 * page-align field — the "Alinhar na página" 6-button grid.
 *
 * Faithful port of CommonProperties.js's _appendAlinhamento() button grid
 * (same classes/icons/layout) into the schema-driven architecture. The DOM
 * effect (SnapEngine.align, a one-off position calculation against the
 * element's current size) is applied by BaseTool.ts's default
 * _applyProperty(), which special-cases the 'pageAlign' key (see
 * pageAlignSection() in CommonSchema.ts) -- that same code path also now
 * persists which direction was last clicked to dataset.ctState, purely so
 * this grid can highlight it the same way content-align.field.ts's grid
 * highlights its own h/v selection. It's a cosmetic "last alignment you
 * picked" marker, not a constraint -- dragging/resizing the element
 * afterward doesn't reconcile against it or clear it.
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

// Styled like align.field.ts/font-style.field.ts's pill groups (craftools-pill)
// instead of the old plain/transparent craftools-icon-btn, so this reads as a
// row of real buttons (border + background at rest, accent background when
// active) -- same visual language as every other alignment-style control.
const btnHtml = (dir: string, icon: string, active: string): string => `
  <button class="craftools-pill ct-align-btn${dir === active ? ' active' : ''}"
    data-align="${dir}" type="button"
    style="flex:1; justify-content:center; padding:5px 0;">
    <span class="material-symbols-outlined" style="font-size:14px;">${icon}</span>
  </button>`;

FieldRegistry.register('page-align', {
  render(container, _field, value) {
    const active = String(value ?? '');

    if (!container.querySelector('.ct-align-grid')) {
      container.innerHTML = `
        <div class="ct-align-grid">
          <div style="display:flex; gap:4px; margin-bottom:4px;">
            ${DIRECTIONS.slice(0, 3).map(d => btnHtml(d.dir, d.icon, active)).join('')}
          </div>
          <div style="display:flex; gap:4px;">
            ${DIRECTIONS.slice(3).map(d => btnHtml(d.dir, d.icon, active)).join('')}
          </div>
        </div>`;
    } else {
      // Update active state without recreating DOM (same pattern as
      // align.field.ts/content-align.field.ts).
      container.querySelectorAll<HTMLElement>('.ct-align-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.align === active);
      });
    }
  },

  bind(container, _field, onChange) {
    container.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.ct-align-btn');
      if (!btn) return;

      // Immediate UI feedback -- don't wait for the external re-render loop
      // to reflect the click (same as align.field.ts/content-align.field.ts).
      container.querySelectorAll('.ct-align-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset.align);
    });
  },
});
