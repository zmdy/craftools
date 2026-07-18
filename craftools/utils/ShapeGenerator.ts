/**
 * ShapeGenerator.ts
 */

import { normalizeValue, svgPaintFromValue } from './ColorPickerUI.js';

export interface ShapeMeta {
  shapeType?:      string;
  fillColor?:      string;
  strokeColor?:    string;
  strokeWidth?:    number | string;
  cornerRadius?:   number | string;
  sides?:          number | string;
  points?:         number | string;
  innerRatio?:     number;
  blobPoints?:     number | string;
  blobRandomness?: number;
  blobSeed?:       number;
  petals?:         number | string;
  [key: string]:   any;
}

export class ShapeGenerator {
  static SHAPE_TYPES = ['square', 'circle', 'triangle', 'polygon', 'star', 'heart', 'blob', 'flower'];

  static randomSeed(): number {
      return Math.floor(Math.random() * 1e9);
  }

  static defaultMeta(shapeType?: string): ShapeMeta {
      const base: ShapeMeta = { shapeType, fillColor: '#6366f1', strokeColor: '#1a1a1a', strokeWidth: 0 };
      switch (shapeType) {
          case 'square':  return { ...base, cornerRadius: 0 };
          case 'polygon': return { ...base, sides: 6 };
          case 'star':    return { ...base, points: 5, innerRatio: 0.45 };
          case 'blob':    return { ...base, blobPoints: 8, blobRandomness: 0.35, blobSeed: this.randomSeed() };
          case 'flower':  return { ...base, petals: 6 };
          default:        return base;
      }
  }

  /**
   * @param meta - deve conter `shapeType`; campos ausentes usam o default.
   */
  static buildSvgString(meta?: ShapeMeta): string {
      const m = { ...this.defaultMeta(meta?.shapeType), ...meta };

      // fillColor/strokeColor hold whatever the standardized color-picker
      // field reports: a bare hex string (legacy value / defaultMeta()) or a
      // JSON ColorPickerValue string when the user has picked a gradient.
      // normalizeValue() accepts either; svgPaintFromValue() turns a
      // gradient into a <defs> entry + a `url(#id)` fill/stroke reference,
      // or just passes a solid color straight through.
      const fillPaint = svgPaintFromValue(normalizeValue(m.fillColor ?? '#6366f1'), 'shape-fill');

      const hasStroke = (parseFloat(String(m.strokeWidth)) || 0) > 0;
      let strokeAttr = 'stroke="none"';
      let strokeDefs = '';
      if (hasStroke) {
          const strokePaint = svgPaintFromValue(normalizeValue(m.strokeColor ?? '#000000'), 'shape-stroke');
          strokeDefs  = strokePaint.defs;
          strokeAttr  = `stroke="${this._esc(strokePaint.paint)}" stroke-width="${m.strokeWidth}"`;
      }

      let inner = '';
      switch (m.shapeType) {
          case 'square':   inner = this._square(m); break;
          case 'circle':   inner = this._circle(m); break;
          case 'triangle': inner = this._triangle(m); break;
          case 'polygon':  inner = this._polygon(m); break;
          case 'star':     inner = this._star(m); break;
          case 'heart':    inner = this._heart(m); break;
          case 'blob':     inner = this._blob(m); break;
          case 'flower':   inner = this._flower(m); break;
          default:         inner = this._square(m);
      }

      const defs = fillPaint.defs + strokeDefs;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" style="display:block;width:100%;height:100%;">` +
          (defs ? `<defs>${defs}</defs>` : '') +
          `<g fill="${this._esc(fillPaint.paint)}" ${strokeAttr} stroke-linejoin="round">${inner}</g></svg>`;
  }

  static buildSvgElement(meta?: ShapeMeta): SVGElement {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = this.buildSvgString(meta);
      return wrapper.firstElementChild as SVGElement;
  }

  // ── Shapes geométricos básicos ───────────────────────────────────────────

  static _square(m: ShapeMeta): string {
      const r = Math.max(0, Math.min(50, parseFloat(String(m.cornerRadius)) || 0));
      return `<rect x="1" y="1" width="98" height="98" rx="${r}" ry="${r}"/>`;
  }

  static _circle(m: ShapeMeta): string {
      return `<ellipse cx="50" cy="50" rx="49" ry="49"/>`;
  }

  static _triangle(m: ShapeMeta): string {
      return `<polygon points="50,2 98,98 2,98"/>`;
  }

  static _polygon(m: ShapeMeta): string {
      const sides = Math.max(3, Math.min(12, parseInt(String(m.sides), 10) || 6));
      const pts: string[] = [];
      for (let i = 0; i < sides; i++) {
          const angle = (Math.PI * 2 * i / sides) - Math.PI / 2;
          pts.push(`${(50 + 48 * Math.cos(angle)).toFixed(2)},${(50 + 48 * Math.sin(angle)).toFixed(2)}`);
      }
      return `<polygon points="${pts.join(' ')}"/>`;
  }

  // ── Shapes "comuns" ───────────────────────────────────────────────────────

  static _star(m: ShapeMeta): string {
      const points = Math.max(3, Math.min(12, parseInt(String(m.points), 10) || 5));
      const innerRatio = Math.max(0.15, Math.min(0.85, m.innerRatio ?? 0.45));
      const outerR = 48, innerR = 48 * innerRatio;
      const pts: string[] = [];
      const total = points * 2;
      for (let i = 0; i < total; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (Math.PI * i / points) - Math.PI / 2;
          pts.push(`${(50 + r * Math.cos(angle)).toFixed(2)},${(50 + r * Math.sin(angle)).toFixed(2)}`);
      }
      return `<polygon points="${pts.join(' ')}"/>`;
  }

  static _heart(m: ShapeMeta): string {
      return `<path d="M50,88 C20,65 2,45 2,25 C2,8 15,2 27,2 C38,2 47,10 50,20 C53,10 62,2 73,2 C85,2 98,8 98,25 C98,45 80,65 50,88 Z"/>`;
  }

  static _flower(m: ShapeMeta): string {
      const petals = Math.max(4, Math.min(16, parseInt(String(m.petals), 10) || 6));
      let markup = '';
      for (let i = 0; i < petals; i++) {
          const angle = (360 * i / petals);
          markup += `<ellipse cx="50" cy="26" rx="12" ry="24" transform="rotate(${angle.toFixed(2)} 50 50)"/>`;
      }
      markup += `<circle cx="50" cy="50" r="10" fill-opacity="0.85"/>`;
      return markup;
  }

  // ── Blob ─────────────────────────────

  static _mulberry32(seed: number): () => number {
      let s = seed >>> 0;
      return function () {
          s = (s + 0x6D2B79F5) | 0;
          let t = Math.imul(s ^ (s >>> 15), 1 | s);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
  }

  static _blob(m: ShapeMeta): string {
      const n = Math.max(5, Math.min(20, parseInt(String(m.blobPoints), 10) || 8));
      const randomness = Math.max(0, Math.min(1, m.blobRandomness ?? 0.35));
      const seed = m.blobSeed || 1;
      const rng = this._mulberry32(seed);
      const baseR = 42;

      const pts: [number, number][] = [];
      for (let i = 0; i < n; i++) {
          const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
          const variance = 1 + (rng() * 2 - 1) * randomness;
          const r = baseR * Math.max(0.4, Math.min(1.5, variance));
          pts.push([50 + r * Math.cos(angle), 50 + r * Math.sin(angle)]);
      }
      return `<path d="${this._smoothClosedPath(pts)}"/>`;
  }

  static _smoothClosedPath(pts: [number, number][]): string {
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

  static _esc(val: any): string {
      return String(val == null ? '' : val).replace(/"/g, '&quot;');
  }
}
