/**
 * LetteringGenerator.ts — pure logic (no DOM lifecycle) for the Lettering
 * tool: tokenizes a phrase into letters/words, resolves a deterministic
 * per-token style (font/position/rotation/size/opacity/color) from a global
 * seed + intensity sliders, and renders the whole thing to an HTML markup
 * string LetteringTool.ts drops straight into its content node.
 *
 * Mirrors ShapeGenerator.ts's own split: this file only computes strings/
 * numbers and returns markup; LetteringTool.ts owns the actual DOM node,
 * `_craftoolsMeta` storage, and click-to-reroll event binding.
 *
 * Key design choice: every token's random style is derived from its OWN
 * seed (`meta.seed + flatIndex * 104729`), not from a single PRNG stream
 * consumed token-by-token. That means a) editing the text only reshuffles
 * the letters whose flatIndex actually changed, not every letter after the
 * edit point, and b) "reroll just this letter" is just swapping ONE token's
 * seed override -- no need to replay/skip a shared stream.
 */

import { normalizeValue, cssFromValue } from './ColorPickerUI.js';
import { FONTS } from './FontList.js';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Per-letter/word decorative background -- see _backgroundHtml(). */
export interface LetteringBackground {
  enabled: boolean;
  mode: 'solid' | 'blob';
  /** Bare hex or JSON ColorPickerValue string (gradient-capable). */
  color: string;
  /** px, 'solid' mode only. */
  borderRadius: number;
  /** px inset added around the glyph's own box on every side. */
  padding: number;
  /** Seeds the single shared blob outline reused behind every token in 'blob' mode. */
  blobSeed: number;
}

/**
 * A manual per-token override, keyed by flatIndex in LetteringMeta.overrides.
 * Any field left unset falls back to the seeded-random value for that token.
 * `seed` alone (the only field the "click a letter to reroll it" interaction
 * writes) replaces just the PRNG seed used to derive the REST of the random
 * fields below, so a rerolled letter still fully participates in the global
 * intensity sliders -- it isn't "frozen", it's just independently reseeded.
 */
export interface LetteringTokenOverride {
  seed?: number;
  fontFamily?: string;
  dy?: number;
  rotate?: number;
  skew?: number;
  scale?: number;
  opacity?: number;
  color?: string;
}

export type LetteringArrangement = 'flow' | 'curve' | 'circular' | 'repeatLines' | 'repeatColumns';

export interface LetteringMeta {
  text: string;
  splitMode: 'letter' | 'word';
  arrangement: LetteringArrangement;
  seed: number;

  fontSize: number;
  /** px, added as margin-right on every letter token (can be negative). */
  letterSpacing: number;
  /** Line-height-like multiplier used for the gap between hard (\n) lines. */
  lineSpacing: number;

  /** 0-1 sliders driving the random spread of each per-token property. */
  bounceIntensity: number;
  rotationIntensity: number;
  skewIntensity: number;
  sizeIntensity: number;
  opacityIntensity: number;

  fontMode: 'single' | 'random';
  font: string;

  color: string;
  colorRandom: boolean;
  colorPalette: string[];

  /** 'curve'/'circular' arrangement controls -- px sag/radius + total arc degrees. */
  curveRadius: number;
  curveSpread: number;

  /** 'repeatLines'/'repeatColumns' arrangement controls. */
  repeatCount: number;
  repeatSpacing: number;
  repeatVariation: 'shared' | 'independent';

  background: LetteringBackground;

  /** Sparse map, flatIndex -> manual override. */
  overrides: Record<number, LetteringTokenOverride>;
}

interface ResolvedStyle {
  fontFamily: string;
  dy: number;
  rotate: number;
  skew: number;
  scale: number;
  opacity: number;
  colorRaw: string;
}

// A single styleable unit that must never be split across a wrap boundary.
// Word-split mode: one WordGroup per word (length 1). Letter-split mode: one
// WordGroup per word, one LetterToken per character inside it. A run of
// whitespace is its own WordGroup containing a single isSpace token.
interface LetterToken {
  char: string;
  isSpace: boolean;
  /** -1 for space tokens (never styled/overridable). */
  flatIndex: number;
}
type WordGroup = LetterToken[];
type Line = WordGroup[];

// ── Defaults ──────────────────────────────────────────────────────────────────

export function defaultLetteringBackground(): LetteringBackground {
  return { enabled: false, mode: 'solid', color: '#fde68a', borderRadius: 6, padding: 4, blobSeed: 1 };
}

export function defaultLetteringMeta(): LetteringMeta {
  return {
    text: 'Lettering',
    splitMode: 'letter',
    arrangement: 'flow',
    seed: LetteringGenerator.randomSeed(),

    fontSize: 64,
    letterSpacing: 0,
    lineSpacing: 1.3,

    bounceIntensity: 0.4,
    rotationIntensity: 0.25,
    skewIntensity: 0,
    sizeIntensity: 0,
    opacityIntensity: 0,

    fontMode: 'random',
    font: 'DM Sans',

    color: '#18181b',
    colorRandom: true,
    colorPalette: ['#f97316', '#ec4899', '#6366f1', '#10b981'],

    curveRadius: 40,
    curveSpread: 60,

    repeatCount: 3,
    repeatSpacing: 8,
    repeatVariation: 'shared',

    background: defaultLetteringBackground(),

    overrides: {},
  };
}

// ── Generator ─────────────────────────────────────────────────────────────────

export class LetteringGenerator {

  static randomSeed(): number {
    return Math.floor(Math.random() * 1e9);
  }

  // ── Tokenizing ────────────────────────────────────────────────────────────

  /**
   * Splits `text` into hard lines (on '\n'), then each line into
   * word-safe groups -- letters of the same word always share one
   * WordGroup so a flex-wrap layout never breaks mid-word, regardless of
   * splitMode. Returns the total count of styleable (non-space) tokens
   * alongside the lines, since every consumer needs it for curve/circular
   * position math.
   */
  static tokenize(text: string, splitMode: 'letter' | 'word'): { lines: Line[]; totalTokens: number } {
    let flatIndex = 0;
    const lines: Line[] = String(text ?? '').split('\n').map(lineText => {
      const parts = lineText.split(/(\s+)/).filter(p => p.length > 0);
      return parts.map((part): WordGroup => {
        if (/^\s+$/.test(part)) {
          return [{ char: part, isSpace: true, flatIndex: -1 }];
        }
        if (splitMode === 'word') {
          return [{ char: part, isSpace: false, flatIndex: flatIndex++ }];
        }
        return Array.from(part).map(ch => ({ char: ch, isSpace: false, flatIndex: flatIndex++ }));
      });
    });
    return { lines, totalTokens: flatIndex };
  }

  // ── Per-token style resolution ───────────────────────────────────────────

  static _mulberry32(seed: number): () => number {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Resolves the full visual style for one token, purely from
   * (meta, flatIndex, totalTokens) -- deterministic and independent of
   * every OTHER token, per this file's header comment.
   */
  static _resolveStyle(meta: LetteringMeta, flatIndex: number, totalTokens: number): ResolvedStyle {
    const override = meta.overrides[flatIndex] || {};
    const tokenSeed = (override.seed ?? (meta.seed + flatIndex * 104729)) >>> 0;
    const rng = this._mulberry32(tokenSeed);

    const dyRandom      = (rng() * 2 - 1) * meta.bounceIntensity * 40;
    const rotRandom      = (rng() * 2 - 1) * meta.rotationIntensity * 25;
    const skewRandom     = (rng() * 2 - 1) * meta.skewIntensity * 20;
    const scaleRandom    = 1 + (rng() * 2 - 1) * meta.sizeIntensity * 0.5;
    const opacityRandom  = 1 - rng() * meta.opacityIntensity * 0.7;
    const fontPick       = FONTS.length ? FONTS[Math.floor(rng() * FONTS.length)] : meta.font;
    const colorPick      = meta.colorPalette.length
      ? meta.colorPalette[Math.floor(rng() * meta.colorPalette.length)]
      : meta.color;

    // Curve arc: a smooth, deterministic sag+tilt profile across the WHOLE
    // token sequence (index/totalTokens), additive on top of the random
    // bounce/rotation above so 'curve' composes with the intensity sliders
    // instead of replacing them.
    let dyArc = 0, rotArc = 0;
    if (meta.arrangement === 'curve' && totalTokens > 1) {
      const t = (flatIndex - (totalTokens - 1) / 2) / Math.max(1, (totalTokens - 1) / 2);
      const angleDeg = t * (meta.curveSpread / 2);
      dyArc  = meta.curveRadius * (1 - Math.cos(angleDeg * Math.PI / 180));
      rotArc = angleDeg;
    }

    return {
      fontFamily: override.fontFamily ?? (meta.fontMode === 'random' ? fontPick : meta.font),
      dy:      (override.dy ?? dyRandom) + dyArc,
      rotate:  (override.rotate ?? rotRandom) + rotArc,
      skew:    override.skew ?? skewRandom,
      scale:   override.scale ?? scaleRandom,
      opacity: Math.max(0.1, Math.min(1, override.opacity ?? opacityRandom)),
      colorRaw: override.color ?? (meta.colorRandom ? colorPick : meta.color),
    };
  }

  // ── Markup ────────────────────────────────────────────────────────────────

  static buildMarkup(meta: LetteringMeta): string {
    const { lines, totalTokens } = this.tokenize(meta.text, meta.splitMode);
    if (!totalTokens && !lines.some(l => l.length)) return '';

    if (meta.arrangement === 'repeatLines' || meta.arrangement === 'repeatColumns') {
      return this._buildRepeatMarkup(meta, lines, totalTokens);
    }
    if (meta.arrangement === 'circular') {
      return this._buildCircularMarkup(meta, lines, totalTokens);
    }
    return this._buildFlowMarkup(meta, lines, totalTokens);
  }

  private static _buildFlowMarkup(meta: LetteringMeta, lines: Line[], totalTokens: number): string {
    const wordGap = Math.max(2, meta.fontSize * 0.28);
    const lineGap = Math.max(0, meta.fontSize * (meta.lineSpacing - 1));

    const linesHtml = lines.map(line => {
      const wordsHtml = line.map(wordGroup => {
        if (wordGroup.length === 1 && wordGroup[0].isSpace) {
          return `<span style="display:inline-block;width:${wordGap.toFixed(1)}px;flex:0 0 auto;"></span>`;
        }
        const inner = wordGroup.map(tok => {
          const style = this._resolveStyle(meta, tok.flatIndex, totalTokens);
          return this._tokenSpanHtml(meta, tok.flatIndex, tok.char, style);
        }).join('');
        return `<span class="ct-lettering-word" style="display:inline-flex;flex:0 0 auto;">${inner}</span>`;
      }).join('');
      return `<div style="display:flex;flex-wrap:wrap;align-items:baseline;column-gap:${wordGap.toFixed(1)}px;width:100%;">${wordsHtml}</div>`;
    }).join('');

    return `<div class="ct-lettering-flow" style="display:flex;flex-direction:column;row-gap:${lineGap.toFixed(1)}px;width:100%;height:100%;align-items:center;justify-content:center;">${linesHtml}</div>`;
  }

  private static _buildCircularMarkup(meta: LetteringMeta, lines: Line[], totalTokens: number): string {
    const flat: LetterToken[] = [];
    lines.forEach(line => line.forEach(wordGroup => wordGroup.forEach(tok => { if (!tok.isSpace) flat.push(tok); })));
    const n = Math.max(1, flat.length);
    const radius = Math.max(10, meta.curveRadius * 2);
    const spread = meta.curveSpread || 360;

    const spans = flat.map((tok, i) => {
      const style = this._resolveStyle(meta, tok.flatIndex, totalTokens);
      const angleDeg = (i / n) * spread - 90;
      const angleRad = angleDeg * Math.PI / 180;
      const x = radius * Math.cos(angleRad);
      const y = radius * Math.sin(angleRad);
      const rotate = angleDeg + 90 + style.rotate * 0.3;
      const colorCss = this._colorCss(style.colorRaw);
      const transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rotate.toFixed(1)}deg) scale(${style.scale.toFixed(2)})`;
      const bg = meta.background.enabled ? this._backgroundHtml(meta.background) : '';
      return `<span class="ct-lettering-token" data-ct-token="${tok.flatIndex}" style="position:absolute;left:50%;top:50%;transform:${transform};font-family:${this._esc(style.fontFamily)};font-size:${meta.fontSize}px;line-height:1;${colorCss}opacity:${style.opacity.toFixed(2)};white-space:pre;">${bg}<span style="position:relative;">${this._escText(tok.char)}</span></span>`;
    }).join('');

    return `<div class="ct-lettering-circular" style="position:relative;width:100%;height:100%;">${spans}</div>`;
  }

  private static _buildRepeatMarkup(meta: LetteringMeta, lines: Line[], totalTokens: number): string {
    const count = Math.max(1, Math.min(30, meta.repeatCount || 3));
    const cells: string[] = [];
    for (let i = 0; i < count; i++) {
      const seed = meta.repeatVariation === 'independent' ? meta.seed + i * 7919 : meta.seed;
      const cellMeta: LetteringMeta = { ...meta, arrangement: 'flow', seed };
      cells.push(`<div style="flex:0 0 auto;">${this._buildFlowMarkup(cellMeta, lines, totalTokens)}</div>`);
    }
    const flowDir = meta.arrangement === 'repeatColumns' ? 'row' : 'column';
    return `<div class="ct-lettering-repeat" style="display:flex;flex-direction:${flowDir};gap:${meta.repeatSpacing}px;width:100%;height:100%;align-items:${flowDir === 'row' ? 'flex-start' : 'center'};justify-content:${flowDir === 'row' ? 'center' : 'center'};">${cells.join('')}</div>`;
  }

  private static _tokenSpanHtml(meta: LetteringMeta, flatIndex: number, char: string, style: ResolvedStyle): string {
    const colorCss = this._colorCss(style.colorRaw);
    const transform = `translateY(${style.dy.toFixed(1)}px) rotate(${style.rotate.toFixed(1)}deg) skew(${style.skew.toFixed(1)}deg) scale(${style.scale.toFixed(2)})`;
    const bg = meta.background.enabled ? this._backgroundHtml(meta.background) : '';
    return `<span class="ct-lettering-token" data-ct-token="${flatIndex}" style="position:relative;display:inline-block;transform:${transform};font-family:${this._esc(style.fontFamily)};font-size:${meta.fontSize}px;line-height:1;${colorCss}opacity:${style.opacity.toFixed(2)};margin-right:${meta.letterSpacing}px;white-space:pre;">${bg}<span style="position:relative;">${this._escText(char)}</span></span>`;
  }

  private static _colorCss(raw: string): string {
    const v = normalizeValue(raw);
    if (v.mode === 'gradient') {
      return `background:${cssFromValue(v)};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;`;
    }
    return `color:${v.solid};`;
  }

  private static _backgroundHtml(bg: LetteringBackground): string {
    const pad = bg.padding;
    const bgColor = normalizeValue(bg.color).solid || '#fde68a';
    if (bg.mode === 'blob') {
      const path = this._blobPath(bg.blobSeed);
      return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:-${pad}px;z-index:-1;pointer-events:none;"><path d="${path}" fill="${this._esc(bgColor)}"/></svg>`;
    }
    return `<span style="position:absolute;inset:-${pad}px;border-radius:${bg.borderRadius}px;background:${this._esc(bgColor)};z-index:-1;pointer-events:none;"></span>`;
  }

  /** A single shared blob outline (reused behind every token) -- same closed-curve technique as ShapeGenerator.ts's own Blob shape. */
  private static _blobPath(seed: number): string {
    const rng = this._mulberry32(seed || 1);
    const n = 8, baseR = 42;
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
      const variance = 1 + (rng() * 2 - 1) * 0.35;
      const r = baseR * Math.max(0.4, Math.min(1.5, variance));
      pts.push([50 + r * Math.cos(angle), 50 + r * Math.sin(angle)]);
    }
    return this._smoothClosedPath(pts);
  }

  private static _smoothClosedPath(pts: [number, number][]): string {
    const n = pts.length;
    const at = (i: number) => pts[((i % n) + n) % n];
    let d = `M ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)} `;
    for (let i = 0; i < n; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)} `;
    }
    return d + 'Z';
  }

  private static _escText(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private static _esc(val: any): string {
    return String(val == null ? '' : val).replace(/"/g, '&quot;');
  }
}
