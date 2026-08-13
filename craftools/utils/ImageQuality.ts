/**
 * ImageQuality.ts — shared print-quality (DPI) math, used by both
 * ImageTool.ts's "Print Quality" panel tab (single image, on-page size) and
 * the Album tool's per-photo quality tab (image vs its grid slot size).
 *
 * All of this is pure math -- no DOM assumptions beyond the two physical-unit
 * conversions every other geometry-aware file in this codebase already uses
 * (PX_PER_INCH = 96, matching Element.ts's/SnapEngine.ts's own
 * `MM_PX = 3.7795275591` constant: 96/25.4). Kept dependency-free so it's
 * trivially bundleable for the jsdom functional-test harness pattern this
 * project uses to verify DPI math against real production code.
 */

/** CSS pixels per inch -- the 96dpi convention this app's whole canvas (element
 *  width/height in 'px' units) is built on. Matches Element.ts's own
 *  `MM_PX = 3.7795275591` constant (3.7795275591 * 25.4 === 96). */
export const PX_PER_INCH = 96;
export const MM_PER_INCH = 25.4;

/** How the image fills its box -- mirrors ImageMeta.objectFit's values
 *  (ImageTool.ts) / CSS object-fit. */
export type FitMode = 'cover' | 'contain' | 'fill';

export type DpiLevel = 'excellent' | 'good' | 'fair' | 'poor';

/** Print-quality DPI thresholds. 300 is the traditional "ideal" print
 *  target; 150 is the commonly-cited floor for large prints viewed from a
 *  normal (non-close-up) distance (posters, album pages) -- below that,
 *  pixelation becomes visible even at arm's length. */
export const DPI_THRESHOLDS: Record<Exclude<DpiLevel, 'poor'>, number> = {
  excellent: 300,
  good: 200,
  fair: 150,
};

export function classifyDpi(dpi: number): DpiLevel {
  if (dpi >= DPI_THRESHOLDS.excellent) return 'excellent';
  if (dpi >= DPI_THRESHOLDS.good) return 'good';
  if (dpi >= DPI_THRESHOLDS.fair) return 'fair';
  return 'poor';
}

/** var(--success)/var(--warning-500)/var(--danger) -- same CSS custom
 *  properties craftools.css already defines and every other tool's inline
 *  styling reaches for (see e.g. BarcodeTool.ts's status colors). */
export function dpiLevelColor(level: DpiLevel): string {
  switch (level) {
    case 'excellent':
    case 'good':
      return 'var(--success, #16a34a)';
    case 'fair':
      return 'var(--warning-500, #f97316)';
    case 'poor':
    default:
      return 'var(--danger, #dc2626)';
  }
}

/**
 * Effective print DPI of an image displayed inside a box of
 * `boxWidthIn` x `boxHeightIn` (physical inches), given the image's native
 * pixel resolution and how it's fitted into that box.
 *
 * Derivation (all three fit modes reduce to picking the right one of two
 * per-axis "native px per inch of box" ratios):
 *  - dpiX = naturalW / boxWidthIn, dpiY = naturalH / boxHeightIn
 *  - 'cover'/'fill': the box is fully covered/stretched, so the axis that
 *    demanded the MOST upscaling (the smaller of dpiX/dpiY) governs
 *    perceived sharpness -> dpi = min(dpiX, dpiY).
 *  - 'contain': the image is shown at the largest size that still fits
 *    entirely inside the box (no cropping), so the axis that constrained
 *    that fit (the LARGER of dpiX/dpiY, i.e. the one with more headroom)
 *    is what's actually used -> dpi = max(dpiX, dpiY).
 * `zoom` (> 1 means the user zoomed in past the base fit, cropping into a
 * smaller region of the same native pixels) further divides the result,
 * since zooming always reduces the native pixels shown per printed inch.
 */
export function computeEffectiveDpi(
  naturalW: number,
  naturalH: number,
  boxWidthIn: number,
  boxHeightIn: number,
  fitMode: FitMode = 'cover',
  zoom = 1,
): number {
  if (!naturalW || !naturalH || !boxWidthIn || !boxHeightIn) return 0;
  const dpiX = naturalW / boxWidthIn;
  const dpiY = naturalH / boxHeightIn;
  const base = fitMode === 'contain' ? Math.max(dpiX, dpiY) : Math.min(dpiX, dpiY);
  return base / (zoom > 0 ? zoom : 1);
}

export function cssPxToInches(px: number): number {
  return px / PX_PER_INCH;
}

export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

export function cmToInches(cm: number): number {
  return (cm * 10) / MM_PER_INCH;
}

export function inchesToCm(inches: number): number {
  return (inches * MM_PER_INCH) / 10;
}

/**
 * Converts a `<craftools-element>`'s stored size (its `pw`/`ph`/`unitW`/
 * `unitH` fields -- see Element.ts) to physical inches. Falls back to
 * parsing `el.style.width`/`height` (assuming 'px' -- this codebase's
 * default element unit, see CommonSchema.ts's Size & Position fields) when
 * the element isn't a real Craftools_Element instance (e.g. in tests, or a
 * synthetic wrapper element), and finally to `offsetWidth`/`offsetHeight`.
 */
export function elementSizeToInches(el: HTMLElement): { widthIn: number; heightIn: number } {
  const anyEl = el as unknown as { pw?: number; ph?: number; unitW?: string; unitH?: string };
  const toIn = (value: number, unit: string): number => {
    if (unit === 'mm') return mmToInches(value);
    if (unit === 'cm') return cmToInches(value);
    return cssPxToInches(value); // 'px' (default) and anything else
  };

  if (typeof anyEl.pw === 'number' && typeof anyEl.ph === 'number' && anyEl.pw > 0 && anyEl.ph > 0) {
    return {
      widthIn: toIn(anyEl.pw, anyEl.unitW || 'px'),
      heightIn: toIn(anyEl.ph, anyEl.unitH || 'px'),
    };
  }

  const styleW = parseFloat(el.style.width);
  const styleH = parseFloat(el.style.height);
  if (styleW > 0 && styleH > 0) {
    return { widthIn: cssPxToInches(styleW), heightIn: cssPxToInches(styleH) };
  }

  return { widthIn: cssPxToInches(el.offsetWidth || 0), heightIn: cssPxToInches(el.offsetHeight || 0) };
}

export interface PrintSize {
  widthIn: number;
  heightIn: number;
  widthCm: number;
  heightCm: number;
}

/** Largest a `naturalW` x `naturalH` image can be printed at `targetDpi`
 *  without falling below it -- a property of the source image alone,
 *  independent of where/how it's currently placed. */
export function maxPrintSizeAtDpi(naturalW: number, naturalH: number, targetDpi: number): PrintSize {
  const widthIn = naturalW / targetDpi;
  const heightIn = naturalH / targetDpi;
  return { widthIn, heightIn, widthCm: inchesToCm(widthIn), heightCm: inchesToCm(heightIn) };
}

export function formatCm(inches: number): string {
  return `${inchesToCm(inches).toFixed(1)} cm`;
}

export function formatIn(inches: number): string {
  return `${inches.toFixed(1)} in`;
}
