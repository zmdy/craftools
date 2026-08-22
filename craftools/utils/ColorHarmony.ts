/**
 * ColorHarmony.ts — pure HSL math + color-harmony generation, no DOM/UI code.
 *
 * Used by ColorPickerUI.ts to build the "Sugestões" (suggestions) palette
 * group shown under every color picker in the app: given whatever solid
 * color is currently selected, generate a handful of named harmony groups
 * (Complementar / Análoga / Tríade / Monocromática) the same way a tool like
 * Adobe Color does -- each group is just a short list of related hex colors
 * derived from the base color's position on the HSL color wheel.
 *
 * Kept dependency-free (no canvas, no external color library) since this
 * only needs to convert one hex value at a time, not analyze image pixel
 * data -- see ImagePaletteExtractor.ts for the canvas-based counterpart that
 * extracts colors FROM an image instead of generating them from one color.
 */

// ── hex <-> HSL ──────────────────────────────────────────────────────────────

export interface Hsl {
  /** 0-360 */
  h: number;
  /** 0-100 */
  s: number;
  /** 0-100 */
  l: number;
}

/** Parses '#rgb'/'#rrggbb' (case-insensitive) into 0-255 r/g/b. Invalid input falls back to black. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = (hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(n => n.toString(16).padStart(2, '0')).join('');
}

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)); break;
    case gn: h = ((bn - rn) / d + 2); break;
    default: h = ((rn - gn) / d + 4); break;
  }
  return { h: h * 60, s: s * 100, l: l * 100 };
}

export function hslToHex(hsl: Hsl): string {
  const h = ((hsl.h % 360) + 360) % 360 / 360;
  const s = Math.max(0, Math.min(100, hsl.s)) / 100;
  const l = Math.max(0, Math.min(100, hsl.l)) / 100;

  if (s === 0) {
    const v = l * 255;
    return rgbToHex(v, v, v);
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hueToRgb = (t0: number): number => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return rgbToHex(hueToRgb(h + 1 / 3) * 255, hueToRgb(h) * 255, hueToRgb(h - 1 / 3) * 255);
}

// ── Harmony generation ───────────────────────────────────────────────────────

export type HarmonyKind = 'complementary' | 'analogous' | 'triadic' | 'monochromatic';

export interface HarmonyGroup {
  kind: HarmonyKind;
  /** i18n key suffix (see ColorPickerUI_Translations.ts's `harmony*` keys). */
  labelKey: string;
  colors: string[];
}

const clampS = (s: number): number => Math.max(12, Math.min(92, s));
const clampL = (l: number): number => Math.max(8, Math.min(94, l));

/**
 * Generates the 4 standard harmony groups for a base hex color. Each group
 * always includes the base color itself (so the picker's "active" swatch
 * highlighting -- see ColorPickerUI.ts's swatchesEqual() -- can still find a
 * match), plus 3-4 related colors.
 *
 * Grayscale/near-grayscale bases (s < ~6%, e.g. #ffffff, #18181b) have no
 * meaningful hue to rotate -- complementary/analogous/triadic would all
 * degenerate to the same color repeated, so those three groups fall back to
 * a neutral lightness ramp instead (still useful: a set of grays), while
 * monochromatic (which is a lightness ramp by definition anyway) is
 * unaffected.
 */
export function generateHarmonies(baseHex: string): HarmonyGroup[] {
  const base = hexToHsl(baseHex);
  const isNeutral = base.s < 6;

  const monochromatic: string[] = [-30, -15, 0, 15, 30].map(dl =>
    hslToHex({ h: base.h, s: isNeutral ? 0 : base.s, l: clampL(base.l + dl) })
  );

  if (isNeutral) {
    const grayRamp: string[] = [12, 32, 50, 68, 86].map(l => hslToHex({ h: 0, s: 0, l }));
    return [
      { kind: 'complementary',  labelKey: 'harmonyComplementary',  colors: grayRamp },
      { kind: 'analogous',      labelKey: 'harmonyAnalogous',      colors: grayRamp },
      { kind: 'triadic',        labelKey: 'harmonyTriadic',        colors: grayRamp },
      { kind: 'monochromatic',  labelKey: 'harmonyMonochromatic',  colors: monochromatic },
    ];
  }

  const complementary: string[] = [
    baseHex,
    hslToHex({ h: base.h + 180, s: clampS(base.s), l: base.l }),
    hslToHex({ h: base.h,       s: clampS(base.s * 0.5), l: clampL(base.l + 22) }),
    hslToHex({ h: base.h + 180, s: clampS(base.s * 0.5), l: clampL(base.l - 18) }),
  ];

  const analogous: string[] = [-30, -15, 0, 15, 30].map(dh =>
    hslToHex({ h: base.h + dh, s: clampS(base.s), l: base.l })
  );

  const triadic: string[] = [
    baseHex,
    hslToHex({ h: base.h + 120, s: clampS(base.s), l: base.l }),
    hslToHex({ h: base.h + 240, s: clampS(base.s), l: base.l }),
    hslToHex({ h: base.h,       s: clampS(base.s * 0.4), l: clampL(base.l + 25) }),
  ];

  return [
    { kind: 'complementary', labelKey: 'harmonyComplementary', colors: complementary },
    { kind: 'analogous',     labelKey: 'harmonyAnalogous',     colors: analogous },
    { kind: 'triadic',       labelKey: 'harmonyTriadic',       colors: triadic },
    { kind: 'monochromatic', labelKey: 'harmonyMonochromatic', colors: monochromatic },
  ];
}
