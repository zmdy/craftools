/**
 * content-align field — "Alinhamento interno" 6-button grid (2 rows of 3):
 * positions an element's own CONTENT within its box, as opposed to
 * 'page-align' (page-align.field.ts), which positions the whole element
 * box against the PAGE. Same visual layout/icons as page-align.field.ts's
 * grid, per that control being the explicit reference pattern for this one
 * -- but UNLIKE page-align (a stateless, fire-and-forget action), this
 * field DOES have a persisted, diffable value: a single "h-v" string (h:
 * 'left'|'center'|'right', v: 'top'|'center'|'bottom'), e.g. "center-center".
 *
 * See CommonSchema.ts's contentAlignSection() for how tools opt in, and
 * BaseTool.ts's _applyTextContentAlign() / each tool's own _applyProperty()
 * for how the value is actually painted onto an element's content.
 */
import { FieldRegistry } from '../FieldRegistry';

const H_DIRECTIONS: Array<{ dir: string; icon: string }> = [
  { dir: 'left',   icon: 'align_horizontal_left' },
  { dir: 'center', icon: 'align_horizontal_center' },
  { dir: 'right',  icon: 'align_horizontal_right' },
];
const V_DIRECTIONS: Array<{ dir: string; icon: string }> = [
  { dir: 'top',    icon: 'align_vertical_top' },
  { dir: 'center', icon: 'align_vertical_center' },
  { dir: 'bottom', icon: 'align_vertical_bottom' },
];

function splitValue(value: unknown): { h: string; v: string } {
  const [h, v] = String(value ?? 'center-center').split('-');
  return { h: h || 'center', v: v || 'center' };
}

const btnHtml = (dir: string, icon: string, axis: 'h' | 'v', active: string): string => `
  <button class="craftools-icon-btn ct-content-align-btn${dir === active ? ' active' : ''}"
    data-axis="${axis}" data-dir="${dir}" type="button"
    style="flex:1; padding:5px 0; display:flex; align-items:center; justify-content:center; border-radius:6px;">
    <span class="material-symbols-outlined" style="font-size:16px;">${icon}</span>
  </button>`;

FieldRegistry.register('content-align', {
  render(container, _field, value) {
    const { h, v } = splitValue(value);

    if (!container.querySelector('.ct-content-align-grid')) {
      container.innerHTML = `
        <div class="ct-content-align-grid">
          <div style="display:flex; gap:4px; margin-bottom:4px;">
            ${H_DIRECTIONS.map(d => btnHtml(d.dir, d.icon, 'h', h)).join('')}
          </div>
          <div style="display:flex; gap:4px;">
            ${V_DIRECTIONS.map(d => btnHtml(d.dir, d.icon, 'v', v)).join('')}
          </div>
        </div>`;
    } else {
      // Update active state without recreating DOM (same pattern as
      // align.field.ts) -- each axis's row is independent.
      container.querySelectorAll<HTMLElement>('.ct-content-align-btn').forEach(btn => {
        const axis   = btn.dataset.axis;
        const active = axis === 'h' ? h : v;
        btn.classList.toggle('active', btn.dataset.dir === active);
      });
    }
  },

  bind(container, _field, onChange) {
    container.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.ct-content-align-btn');
      if (!btn) return;
      const axis = btn.dataset.axis === 'v' ? 'v' : 'h';
      const dir  = btn.dataset.dir ?? 'center';

      // bind() only runs once at field creation, so the OTHER axis's
      // current value can't come from a captured closure -- read it back
      // from whichever button in that row is currently marked active
      // (kept in sync by render(), which always runs after every change).
      const otherAxis = axis === 'h' ? 'v' : 'h';
      const otherBtn  = container.querySelector<HTMLElement>(`.ct-content-align-btn[data-axis="${otherAxis}"].active`);
      const otherDir  = otherBtn?.dataset.dir ?? 'center';

      // Immediate UI feedback within this axis's row -- don't wait for the
      // external re-render loop to reflect the click (same as align.field.ts).
      container.querySelectorAll<HTMLElement>(`.ct-content-align-btn[data-axis="${axis}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      onChange(axis === 'h' ? `${dir}-${otherDir}` : `${otherDir}-${dir}`);
    });
  },
});
