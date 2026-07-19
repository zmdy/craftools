/**
 * ColorPickerUI — the standardized color/gradient picker used everywhere in
 * CrafTools: every element tool's color field (via utils/fields/color.field.ts
 * and utils/fields/color-picker.field.ts) AND PageTool.ts's page-background
 * "Fundo" accordion both render through this same module, so they always
 * look and behave identically -- one picker, reused, not two similar-looking
 * implementations that drift apart over time.
 *
 * Design:
 *  - Solid mode: a palette of preset swatches + a native <input type="color">
 *    swatch for a custom pick.
 *  - Gradient mode: a palette of preset gradient swatches + a live editor
 *    (linear/radial type, angle, and a stop list with add/remove -- minimum
 *    2 stops).
 *  - Switching between Cor/Gradiente always resets to the first preset of
 *    the target group (GRADIENT_PRESETS[0] / COLOR_PRESETS[0]) and fires
 *    onChange immediately, per spec -- it does not try to remember whatever
 *    was last configured in the other mode.
 *  - Bind-once, repaint-many: renderColorPicker() stashes the current
 *    value/onChange/opts on the container and only attaches its delegated
 *    listener set the FIRST time it's called for a given container; every
 *    later call (a genuinely different value, e.g. a different element
 *    selected) just repaints from the stash. Calling render() again to
 *    re-render would otherwise stack a fresh listener set on top of the old
 *    one every time (each interaction firing once per accumulated call).
 */

import { tr } from './i18nLabel';
import './ColorPickerUI_Translations.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GradientType = 'linear' | 'radial';

export interface GradientValue {
  type: GradientType;
  /** Degrees. Ignored for 'radial'. */
  angle: number;
  /** >= 2 hex colors. */
  stops: string[];
}

export interface ColorPickerValue {
  mode: 'solid' | 'gradient';
  solid: string;
  gradient: GradientValue;
}

export interface ColorPickerOptions {
  /** false renders solid-only: palette + custom swatch, no mode pills, no gradient UI. Default: true. */
  allowGradient?: boolean;
  /**
   * Which COLOR_PRESETS entry counts as "first" for this instance: shown
   * first in the palette grid, and what solid mode resets to when switching
   * back from gradient. Must be one of COLOR_PRESETS' own values (falls back
   * to COLOR_PRESETS[0] otherwise). Default: COLOR_PRESETS[0] (near-black,
   * #18181b) -- the right choice for nearly every tool (text, shape fill/
   * stroke, icon, barcode, ...), so most fields don't need to pass this at
   * all. Only override it when a genuinely different solid makes sense as
   * THIS field's reset target -- e.g. CommonSchema.ts's backgroundSection()
   * passes 'transparent', since a background layer should start invisible,
   * not black.
   */
  defaultSolid?: string;
}

// ── Presets ───────────────────────────────────────────────────────────────────

// Near-black first, not white -- see ColorPickerOptions.defaultSolid's doc
// comment above: this is the shared default for every color-picker field in
// the app (previously white, requiring text/curved-text/variable-content
// tools to each pass their own `defaultSolid: '#18181b'` override just to
// avoid a white-on-white/invisible default -- now unnecessary duplication,
// since black is the sensible default almost everywhere).
export const COLOR_PRESETS: string[] = [
  '#18181b', '#ffffff', '#71717a', '#e4e4e7',
  '#f97316', '#ef4444', '#22c55e', '#3b82f6',
  '#a855f7', '#ec4899', '#eab308', '#14b8a6',
];

export const GRADIENT_PRESETS: GradientValue[] = [
  { type: 'linear', angle: 90,  stops: ['#f97316', '#facc15'] },
  { type: 'linear', angle: 135, stops: ['#f5f7fa', '#c3cfe2'] },
  { type: 'linear', angle: 135, stops: ['#fddb92', '#d1fdff'] },
  { type: 'linear', angle: 120, stops: ['#f093fb', '#f5576c'] },
  { type: 'linear', angle: 135, stops: ['#0f2027', '#203a43', '#2c5364'] },
  { type: 'radial', angle: 0,   stops: ['#ffecd2', '#fcb69f'] },
  { type: 'linear', angle: 135, stops: ['#11998e', '#38ef7d'] },
];

export const DEFAULT_VALUE: ColorPickerValue = {
  mode: 'solid',
  solid: COLOR_PRESETS[0],
  gradient: GRADIENT_PRESETS[0],
};

// ── CSS helpers ───────────────────────────────────────────────────────────────

export function cssFromGradient(g: GradientValue): string {
  const stops = g.stops.join(', ');
  return g.type === 'radial' ? `radial-gradient(circle, ${stops})` : `linear-gradient(${g.angle}deg, ${stops})`;
}

/** The CSS `background`/`color` value the current mode resolves to. */
export function cssFromValue(v: ColorPickerValue): string {
  return v.mode === 'gradient' ? cssFromGradient(v.gradient) : v.solid;
}

// ── SVG helpers ──────────────────────────────────────────────────────────────

let _svgGradientCounter = 0;

/**
 * SVG-flavored counterpart to cssFromValue()/cssFromGradient() -- used by
 * every SVG-based tool (Shape/Icon/Barcode/QRCode) so a gradient fill/stroke
 * on an SVG shape renders with the same stop colors and angle convention as
 * a CSS gradient elsewhere in the app. SVG has no equivalent of
 * `fill: linear-gradient(...)`: a gradient must be declared once as a
 * `<linearGradient>`/`<radialGradient>` in `<defs>` and referenced via
 * `fill="url(#id)"` -- so this returns both pieces: the `<defs>` markup to
 * embed once per rendered SVG, and the attribute value to put on
 * `fill`/`stroke`. Solid mode needs no `<defs>` at all -- `defs` is `''` and
 * `paint` is just the plain color, so callers can always do
 * `fill="${paint}"` unconditionally.
 *
 * `idPrefix` only needs to be unique *within* one `<svg>` (fill vs. stroke
 * on the same shape, say) -- an internal monotonic counter is appended so
 * repeated calls across the whole page (e.g. re-rendering a picker grid of
 * many preview buttons, each its own tiny `<svg>`) never collide on id,
 * which would otherwise make every instance silently point at whichever
 * `<linearGradient>` happened to be defined last in the document.
 */
export function svgPaintFromValue(v: ColorPickerValue, idPrefix: string): { defs: string; paint: string } {
  if (v.mode !== 'gradient') return { defs: '', paint: v.solid };

  const id = `${idPrefix}-${++_svgGradientCounter}`;
  const stops = v.gradient.stops;
  const stopsMarkup = stops.map((s, i) => {
    const offset = stops.length === 1 ? 0 : Math.round((i / (stops.length - 1)) * 100);
    return `<stop offset="${offset}%" stop-color="${String(s).replace(/"/g, '&quot;')}" />`;
  }).join('');

  const defs = v.gradient.type === 'radial'
    ? `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">${stopsMarkup}</radialGradient>`
    // SVG's default linear gradient (no gradientTransform) runs left-to-right
    // across the shape's bounding box -- that's what CSS calls a 90deg
    // linear-gradient, so rotating by (angle - 90) around the box center
    // reproduces the same angle convention cssFromGradient() uses.
    : `<linearGradient id="${id}" gradientTransform="rotate(${v.gradient.angle - 90} 0.5 0.5)">${stopsMarkup}</linearGradient>`;

  return { defs, paint: `url(#${id})` };
}

/**
 * Best-effort parse of a CSS background string (as found on
 * `element.style.background`) back into a ColorPickerValue -- used to seed
 * the picker's initial state from whatever's already applied (e.g.
 * PageTool.ts priming its Background accordion from the page's current
 * background). Returns null for anything that isn't a plain color or a
 * linear-/radial-gradient() this module itself would have produced
 * (notably `url(...)` image backgrounds -- callers should check for an
 * image background themselves before falling back to this).
 */
export function parseCssBackground(css: string | undefined | null): ColorPickerValue | null {
  const trimmed = (css ?? '').trim();
  if (!trimmed || trimmed.startsWith('url(')) return null;

  const linear = trimmed.match(/^linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg\s*,\s*(.+)\)$/i);
  if (linear) {
    const stops = linear[2].split(',').map(s => s.trim()).filter(Boolean);
    if (stops.length >= 2) {
      return { mode: 'gradient', solid: DEFAULT_VALUE.solid, gradient: { type: 'linear', angle: Number(linear[1]), stops } };
    }
  }

  const radial = trimmed.match(/^radial-gradient\(\s*circle[^,]*,\s*(.+)\)$/i);
  if (radial) {
    const stops = radial[1].split(',').map(s => s.trim()).filter(Boolean);
    if (stops.length >= 2) {
      return { mode: 'gradient', solid: DEFAULT_VALUE.solid, gradient: { type: 'radial', angle: 0, stops } };
    }
  }

  if (/^#[0-9a-f]{3,8}$/i.test(trimmed) || /^rgba?\(/i.test(trimmed)) {
    return { mode: 'solid', solid: trimmed, gradient: { ...DEFAULT_VALUE.gradient, stops: DEFAULT_VALUE.gradient.stops.slice() } };
  }

  return null;
}

// ── Value normalization ──────────────────────────────────────────────────────

/**
 * Accepts whatever's currently stored (a full ColorPickerValue object, a
 * JSON string of one -- see the field handlers for why values are
 * stringified -- a bare hex string from a legacy plain-color field, or
 * nothing at all) and always returns a complete, valid ColorPickerValue.
 */
export function normalizeValue(raw: unknown): ColorPickerValue {
  let v = raw;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed.startsWith('{')) {
      try { v = JSON.parse(trimmed); } catch { v = null; }
    } else if (trimmed) {
      return { ...DEFAULT_VALUE, mode: 'solid', solid: trimmed };
    } else {
      v = null;
    }
  }

  if (v && typeof v === 'object') {
    const o = v as Partial<ColorPickerValue>;
    const gradient = o.gradient && Array.isArray(o.gradient.stops) && o.gradient.stops.length >= 2
      ? {
          type: o.gradient.type === 'radial' ? 'radial' as const : 'linear' as const,
          angle: typeof o.gradient.angle === 'number' ? o.gradient.angle : 90,
          stops: o.gradient.stops.slice(),
        }
      : { ...DEFAULT_VALUE.gradient, stops: DEFAULT_VALUE.gradient.stops.slice() };
    return {
      mode: o.mode === 'gradient' ? 'gradient' : 'solid',
      solid: typeof o.solid === 'string' && o.solid ? o.solid : DEFAULT_VALUE.solid,
      gradient,
    };
  }

  return { ...DEFAULT_VALUE, gradient: { ...DEFAULT_VALUE.gradient, stops: DEFAULT_VALUE.gradient.stops.slice() } };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

const swatchesEqual = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
const gradientsEqual = (a: GradientValue, b: GradientValue): boolean =>
  a.type === b.type && a.angle === b.angle && a.stops.length === b.stops.length &&
  a.stops.every((s, i) => swatchesEqual(s, b.stops[i]));

/**
 * Converts a CSS color string to a valid #rrggbb hex value that
 * `<input type="color">` can accept. Named keywords (e.g. "transparent",
 * "white", "red") and rgb/rgba() values are resolved via an off-screen
 * canvas; anything that can't be resolved falls back to #000000.
 */
function toHexColor(css: string): string {
  if (!css || css === 'transparent') return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(css)) return css;
  // Expand 3-digit hex
  if (/^#[0-9a-f]{3}$/i.test(css)) {
    return '#' + css.slice(1).split('').map(c => c + c).join('');
  }
  // Attempt off-screen canvas resolution for named keywords / rgb() / rgba()
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* ignore */ }
  return '#000000';
}

function paletteHtml(value: ColorPickerValue, defaultSolid?: string): string {
  const presets = defaultSolid && COLOR_PRESETS.includes(defaultSolid)
    ? [defaultSolid, ...COLOR_PRESETS.filter(c => c !== defaultSolid)]
    : COLOR_PRESETS;
  const swatches = presets.map(c => `
    <button type="button" class="ct-color-swatch-btn${swatchesEqual(value.solid, c) ? ' active' : ''}"
      data-action="pick-color" data-color="${c}" style="background:${c};" title="${c}"></button>
  `).join('');

  const isCustom = !COLOR_PRESETS.some(c => swatchesEqual(c, value.solid));
  // `<input type="color">` only accepts "#rrggbb" — guard against "transparent"
  // (the default solid for background pickers) and other non-hex values.
  const customHex = toHexColor(isCustom ? value.solid : '#000000');

  return `
    <div class="ct-color-palette">
      ${swatches}
      <label class="ct-color-swatch-btn ct-color-swatch-custom${isCustom ? ' active' : ''}"
        title="${tr('colorPicker.custom', 'Custom')}">
        <span class="material-symbols-outlined">colorize</span>
        <input type="color" data-action="custom-color" value="${customHex}">
      </label>
    </div>`;
}

function gradientPaletteHtml(value: ColorPickerValue): string {
  const swatches = GRADIENT_PRESETS.map((g, i) => `
    <button type="button" class="ct-gradient-swatch-btn${gradientsEqual(value.gradient, g) ? ' active' : ''}"
      data-action="pick-gradient" data-index="${i}" style="background:${cssFromGradient(g)};"></button>
  `).join('');
  return `<div class="ct-color-palette">${swatches}</div>`;
}

function gradientEditorHtml(g: GradientValue): string {
  const stopsHtml = g.stops.map((s, i) => `
    <div class="ct-grad-stop-row">
      <input type="color" class="craftools-color-swatch" data-action="grad-stop" data-index="${i}" value="${s}">
      ${g.stops.length > 2
        ? `<button type="button" class="ct-grad-stop-remove" data-action="remove-stop" data-index="${i}" title="${tr('colorPicker.removeColor', 'Remove color')}">
             <span class="material-symbols-outlined">close</span>
           </button>`
        : ''}
    </div>`).join('');

  return `
    <div class="ct-field" style="margin-top:8px;">
      <div class="ct-field-row" style="gap:4px;">
        <button type="button" class="craftools-pill${g.type === 'linear' ? ' active' : ''}" data-action="grad-type" data-type="linear">${tr('colorPicker.linear', 'Linear')}</button>
        <button type="button" class="craftools-pill${g.type === 'radial' ? ' active' : ''}" data-action="grad-type" data-type="radial">${tr('colorPicker.radial', 'Radial')}</button>
        ${g.type === 'linear' ? `
          <div class="ct-field-row" style="gap:2px; margin-left:auto;">
            <input type="number" class="craftools-input" data-action="grad-angle" min="0" max="360" step="5" value="${g.angle}" style="width:52px; padding:4px 5px; font-size:11px;">
            <span class="ct-val-badge">°</span>
          </div>` : ''}
      </div>
      <span class="ct-sublabel" style="margin-top:6px;">${tr('colorPicker.colors', 'Colors')}</span>
      <div class="ct-grad-stops">${stopsHtml}</div>
      <button type="button" class="craftools-pill" data-action="add-stop" style="align-self:flex-start;">
        <span class="material-symbols-outlined" style="font-size:12px; vertical-align:middle;">add</span>
        ${tr('colorPicker.addColor', 'Add color')}
      </button>
    </div>`;
}

function paint(container: HTMLElement, value: ColorPickerValue, allowGradient: boolean, defaultSolid?: string): void {
  const modeHtml = allowGradient ? `
    <div class="ct-field-row" style="gap:4px; margin-bottom:8px;">
      <button type="button" class="craftools-pill${value.mode === 'solid' ? ' active' : ''}" data-action="mode" data-mode="solid">${tr('colorPicker.color', 'Color')}</button>
      <button type="button" class="craftools-pill${value.mode === 'gradient' ? ' active' : ''}" data-action="mode" data-mode="gradient">${tr('colorPicker.gradient', 'Gradient')}</button>
    </div>` : '';

  const bodyHtml = allowGradient && value.mode === 'gradient'
    ? gradientPaletteHtml(value) + gradientEditorHtml(value.gradient)
    : paletteHtml(value, defaultSolid);

  container.innerHTML = `<div class="ct-color-picker">${modeHtml}${bodyHtml}</div>`;
}

interface BoundContainer extends HTMLElement {
  _ctColorValue?: ColorPickerValue;
  _ctColorOnChange?: (value: ColorPickerValue) => void;
  _ctColorAllowGradient?: boolean;
  _ctColorDefaultSolid?: string;
  _ctColorBound?: boolean;
}

function repaint(container: BoundContainer, next: ColorPickerValue, opts: { silent?: boolean } = {}): void {
  container._ctColorValue = next;
  paint(container, next, container._ctColorAllowGradient !== false, container._ctColorDefaultSolid);
  if (!opts.silent) container._ctColorOnChange?.(next);
}

function bindDelegatedEvents(container: BoundContainer): void {
  container.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;
    const action  = target.dataset.action;
    const current = container._ctColorValue ?? DEFAULT_VALUE;

    if (action === 'mode') {
      const mode = target.dataset.mode as 'solid' | 'gradient';
      if (mode === current.mode) return;
      // Always resets to the target group's first preset -- see file header.
      // "First" for solid is per-instance (see ColorPickerOptions.defaultSolid);
      // text tools pass '#18181b' instead of the global COLOR_PRESETS[0] white.
      repaint(container, mode === 'gradient'
        ? { ...current, mode: 'gradient', gradient: { ...GRADIENT_PRESETS[0], stops: GRADIENT_PRESETS[0].stops.slice() } }
        : { ...current, mode: 'solid', solid: container._ctColorDefaultSolid ?? COLOR_PRESETS[0] });
    } else if (action === 'pick-color') {
      repaint(container, { ...current, mode: 'solid', solid: target.dataset.color! });
    } else if (action === 'pick-gradient') {
      const preset = GRADIENT_PRESETS[Number(target.dataset.index)];
      repaint(container, { ...current, mode: 'gradient', gradient: { ...preset, stops: preset.stops.slice() } });
    } else if (action === 'grad-type') {
      repaint(container, { ...current, gradient: { ...current.gradient, type: target.dataset.type as GradientType } });
    } else if (action === 'remove-stop') {
      const idx   = Number(target.dataset.index);
      const stops = current.gradient.stops.filter((_, i) => i !== idx);
      if (stops.length >= 2) repaint(container, { ...current, gradient: { ...current.gradient, stops } });
    } else if (action === 'add-stop') {
      const stops = [...current.gradient.stops, '#ffffff'];
      repaint(container, { ...current, gradient: { ...current.gradient, stops } });
    }
  });

  // Native <input type="color"> reports the live pick via 'input' (fires
  // continuously while dragging in the OS picker) and the committed value
  // again via 'change'. Only 'change' triggers a full repaint (refreshing
  // which swatch shows as "active") -- repainting on every 'input' tick
  // would tear down and rebuild the very <input> the user is still
  // interacting with, closing the native picker mid-drag.
  container.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const action = target.dataset.action;
    if (action !== 'custom-color' && action !== 'grad-stop') return;
    const current = container._ctColorValue ?? DEFAULT_VALUE;

    if (action === 'custom-color') {
      const next = { ...current, mode: 'solid' as const, solid: target.value };
      container._ctColorValue = next; // stash without repainting the DOM mid-drag (see comment above)
      container._ctColorOnChange?.(next);
    } else {
      const idx   = Number(target.dataset.index);
      const stops = current.gradient.stops.slice();
      stops[idx]  = target.value;
      const next  = { ...current, gradient: { ...current.gradient, stops } };
      container._ctColorValue = next; // stash without repainting the DOM mid-drag
      container._ctColorOnChange?.(next);
    }
  });

  container.addEventListener('change', (e) => {
    const target  = e.target as HTMLInputElement;
    const action  = target.dataset.action;
    const current = container._ctColorValue ?? DEFAULT_VALUE;

    if (action === 'custom-color' || action === 'grad-stop') {
      // Value is already current (updated on 'input' above) -- just repaint
      // now that the pick is committed, to refresh active-swatch highlighting.
      repaint(container, current, { silent: true });
    } else if (action === 'grad-angle') {
      repaint(container, { ...current, gradient: { ...current.gradient, angle: Number(target.value) || 0 } });
    }
  });
}

/**
 * Renders (or repaints, if this container has already been bound once) the
 * standardized color/gradient picker into `container`.
 */
export function renderColorPicker(
  container: HTMLElement,
  rawValue: unknown,
  onChange: (value: ColorPickerValue) => void,
  opts: ColorPickerOptions = {},
): void {
  const c = container as BoundContainer;
  const value = normalizeValue(rawValue);

  c._ctColorValue         = value;
  c._ctColorOnChange      = onChange;
  c._ctColorAllowGradient = opts.allowGradient !== false;
  c._ctColorDefaultSolid  = opts.defaultSolid;

  paint(c, value, c._ctColorAllowGradient, c._ctColorDefaultSolid);

  if (!c._ctColorBound) {
    c._ctColorBound = true;
    bindDelegatedEvents(c);
  }
}
