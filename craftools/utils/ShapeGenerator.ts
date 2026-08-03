/**
 * ShapeGenerator.ts
 */

import { normalizeValue, svgPaintFromValue } from './ColorPickerUI.js';
import { PaperPatterns } from '../tools/paper/PaperPatterns.js';

/**
 * The "papéis personalizados" fill option -- ShapeMeta.fillPaper, only read
 * when ShapeMeta.fillMode === 'paper'. A deliberately trimmed-down cousin of
 * PaperTool.ts's own PaperMeta: same paperType/lineColor/lineStyle/
 * lineSpacing/lineWidth/checkboxShape controls (fed straight into
 * PaperPatterns.generateContent(), the exact engine the page-level "Papel
 * personalizado" tab uses), but no paperSize/lineGradientMode/bgPattern/
 * sidebar/watermark/logo/pageSettings -- those are page-scoped extras that
 * don't make sense clipped inside a small decorative shape. `margins` (mm,
 * 4 independent sides) is likewise replaced by a single `padding` percentage
 * of the shape's own 100x100 viewBox, since shapes aren't rectangular pages
 * -- see _paperMetaFromFill() below.
 */
export interface ShapePaperFill {
  paperType?:     string;
  theme?:         string;
  /** Background painted behind the pattern, inside the shape's own clip -- bare hex or JSON ColorPickerValue string (gradient-capable). */
  bgColor?:       string;
  /** Bare hex or JSON ColorPickerValue string (gradient-capable, same as PaperTool.ts's lineColor). */
  lineColor?:     string;
  lineStyle?:     string;
  lineSpacing?:   number;
  lineWidth?:     number;
  /** 0-40, % of the shape's box inset on every side before the pattern starts. */
  padding?:       number;
  /** Only read when paperType === 'todo_list'. */
  checkboxShape?: string;
  /** 'left' (default) or 'right' -- see PaperTool.ts's PaperMeta.orientation doc comment; same horizontal-mirror behavior, just fed through _paperMetaFromFill() below into the same shared PaperPatterns.generateContent() engine. */
  orientation?: 'left' | 'right';
}

export function defaultShapePaperFill(): ShapePaperFill {
  return {
    paperType: 'lined',
    theme: 'default',
    bgColor: '#ffffff',
    lineColor: '#a1a1aa',
    lineStyle: 'solid',
    lineSpacing: 12,
    lineWidth: 0.6,
    padding: 10,
    checkboxShape: 'square',
    orientation: 'left',
  };
}

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
  armThickness?:   number | string;
  ringThickness?:  number | string;
  arrowStart?:     boolean;
  arrowEnd?:       boolean;
  dashed?:         boolean;
  /** 'color' (default, omitted) = fillColor's solid/gradient picker, as always. 'paper' = fillPaper below, clipped to the shape's own outline. */
  fillMode?:       'color' | 'paper';
  fillPaper?:      ShapePaperFill;
  [key: string]:   any;
}

/**
 * Shape types drawn as an open, unfilled stroke (a line/connector) rather
 * than a filled region -- ShapeTool.ts reads this to relabel the standard
 * Fill/Stroke fields ("Arrowhead color"/"Line color" instead of "Fill"/
 * "Stroke") since there's no enclosed area for "fill" to mean anything.
 */
export const LINE_SHAPE_TYPES = ['line', 'elbowConnector'];

export class ShapeGenerator {
  static SHAPE_TYPES = [
      'square', 'circle', 'triangle', 'polygon', 'star', 'heart', 'blob', 'flower',
      'diamond', 'cross', 'ring', 'arrow', 'arc', 'speechBubble',
      'line', 'elbowConnector',
  ];

  static randomSeed(): number {
      return Math.floor(Math.random() * 1e9);
  }

  /** Unique id suffix for every `<clipPath>` this class defines -- see buildSvgString()'s paper-fill branch. */
  static _clipIdCounter = 0;

  /**
   * Maps a ShapePaperFill onto the meta shape PaperPatterns.generateContent()
   * expects (same shape PaperTool.ts's own PaperMeta uses) -- margins become
   * a uniform inset on all 4 sides (shapes aren't rectangular pages), and
   * every page-only extra (sidebar/watermark/logo/pageSettings/bgPattern)
   * is force-disabled since none of them make sense clipped inside a shape.
   */
  static _paperMetaFromFill(fill: ShapePaperFill): Record<string, unknown> {
      const pad = Math.max(0, Math.min(45, parseFloat(String(fill.padding)) || 0));
      return {
          paperType: fill.paperType || 'lined',
          theme: fill.theme || 'default',
          lineColor: fill.lineColor,
          lineGradientMode: 'per-line',
          lineStyle: fill.lineStyle || 'solid',
          lineSpacing: fill.lineSpacing || 8,
          lineWidth: fill.lineWidth ?? 0.5,
          margins: { top: pad, right: pad, bottom: pad, left: pad },
          sidebar: { enabled: false },
          bgPattern: 'none',
          watermark: { enabled: false },
          logo: { enabled: false },
          pageSettings: { showPageNumber: false },
          checkboxShape: fill.checkboxShape || 'square',
          orientation: fill.orientation === 'right' ? 'right' : 'left',
      };
  }

  static defaultMeta(shapeType?: string): ShapeMeta {
      const base: ShapeMeta = { shapeType, fillColor: '#6366f1', strokeColor: '#1a1a1a', strokeWidth: 0 };
      switch (shapeType) {
          case 'square':  return { ...base, cornerRadius: 0 };
          case 'polygon': return { ...base, sides: 6 };
          case 'star':    return { ...base, points: 5, innerRatio: 0.45 };
          case 'blob':    return { ...base, blobPoints: 8, blobRandomness: 0.35, blobSeed: this.randomSeed() };
          case 'flower':  return { ...base, petals: 6 };
          case 'cross':   return { ...base, armThickness: 28 };
          case 'ring':    return { ...base, ringThickness: 18 };
          // Lines have nothing to "fill" -- strokeWidth defaults to 0 for
          // every other shape (fillColor alone is enough to see it), but a
          // line with strokeWidth 0 is completely invisible, so these two
          // get a real default width and start pre-wired as a connector
          // (one arrowhead) instead of a bare, easy-to-miss line segment.
          case 'line':           return { ...base, strokeColor: '#1a1a1a', strokeWidth: 4, arrowStart: false, arrowEnd: true, dashed: false };
          case 'elbowConnector': return { ...base, strokeColor: '#1a1a1a', strokeWidth: 4, arrowStart: false, arrowEnd: true };
          default:        return base;
      }
  }

  /**
   * @param meta - deve conter `shapeType`; campos ausentes usam o default.
   */
  static buildSvgString(meta?: ShapeMeta): string {
      const m = { ...this.defaultMeta(meta?.shapeType), ...meta };

      // "Papéis personalizados" fill -- only for shapes with an actual
      // enclosed area (LINE_SHAPE_TYPES have none, ShapeTool.ts never offers
      // the option for them, but this stays defensive rather than assuming).
      const usePaperFill = m.fillMode === 'paper' && !!m.fillPaper && !LINE_SHAPE_TYPES.includes(String(m.shapeType));

      // fillColor/strokeColor hold whatever the standardized color-picker
      // field reports: a bare hex string (legacy value / defaultMeta()) or a
      // JSON ColorPickerValue string when the user has picked a gradient.
      // normalizeValue() accepts either; svgPaintFromValue() turns a
      // gradient into a <defs> entry + a `url(#id)` fill/stroke reference,
      // or just passes a solid color straight through. Skipped entirely for
      // paper fill -- the shape's "fill" comes from the clipped pattern
      // below instead, and fillColor's own picker is hidden in that mode.
      const fillPaint = usePaperFill ? { defs: '', paint: 'none' } : svgPaintFromValue(normalizeValue(m.fillColor ?? '#6366f1'), 'shape-fill');

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
          case 'diamond':      inner = this._diamond(m); break;
          case 'cross':        inner = this._cross(m); break;
          case 'ring':         inner = this._ring(m); break;
          case 'arrow':        inner = this._arrow(m); break;
          case 'arc':          inner = this._arc(m); break;
          case 'speechBubble': inner = this._speechBubble(m); break;
          case 'line':          inner = this._line(m); break;
          case 'elbowConnector': inner = this._elbowConnector(m); break;
          default:         inner = this._square(m);
      }

      // Every shape is drawn in a fixed 0-100 viewBox with
      // preserveAspectRatio="none" (below) so it always exactly fills the
      // element's box regardless of aspect ratio -- but that means resizing
      // to a non-square box scales X and Y by DIFFERENT factors. A plain
      // `stroke-width` is defined in viewBox units and gets stretched by
      // whichever axis' factor applies to each edge, so a stroke that's
      // "2" everywhere in viewBox space renders at a different pixel width
      // on the shape's horizontal vs. vertical edges the moment the shape
      // isn't square -- the "border isn't the same width on every side
      // after resizing" bug. `vector-effect="non-scaling-stroke"` makes the
      // stroke keep a constant width in screen pixels regardless of any
      // non-uniform scale applied to the shape's geometry, which is also
      // the correct/expected behavior for a "stroke width" field in a
      // design tool (a literal pixel width, not a percentage of the
      // shape). `vector-effect` isn't inherited from the wrapping <g>, so
      // it has to land on every actual geometry element (rect/ellipse/
      // polygon/path/circle) inner may contain -- e.g. the Flower shape
      // draws several <ellipse>s plus a <circle>, not just one element.
      inner = inner.replace(/<(rect|ellipse|polygon|path|circle)(?=[\s/])/g, '<$1 vector-effect="non-scaling-stroke"');

      let extraDefs = '';
      let body: string;
      if (usePaperFill) {
          const clipId = `shape-paper-clip-${++this._clipIdCounter}`;
          const bgPaint = svgPaintFromValue(normalizeValue(m.fillPaper!.bgColor ?? '#ffffff'), 'shape-paper-bg');
          // PaperPatterns.ts is `@ts-nocheck` -- cast its return shape explicitly
          // rather than letting the call resolve to implicit `any`.
          const { svgContent: patternContent, defs: patternDefs } =
              (PaperPatterns as unknown as { generateContent: (meta: unknown, w: number, h: number) => { svgContent: string; defs: string } })
                  .generateContent(this._paperMetaFromFill(m.fillPaper!), 100, 100);

          extraDefs = `<clipPath id="${clipId}">${inner}</clipPath>` + bgPaint.defs + patternDefs;
          body =
              `<g clip-path="url(#${clipId})">` +
                  `<rect x="0" y="0" width="100" height="100" fill="${this._esc(bgPaint.paint)}"/>` +
                  patternContent +
              `</g>` +
              // The shape's own outline stroke is drawn separately, unfilled,
              // on top of the clipped paper content -- same strokeAttr every
              // other fill mode uses, so switching Cor/Papel never touches
              // the border's own look.
              `<g fill="none" ${strokeAttr}>${inner}</g>`;
      } else {
          body = `<g fill="${this._esc(fillPaint.paint)}" ${strokeAttr} stroke-linejoin="round">${inner}</g>`;
      }

      const defs = fillPaint.defs + strokeDefs + extraDefs;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" style="display:block;width:100%;height:100%;">` +
          (defs ? `<defs>${defs}</defs>` : '') +
          body +
          `</svg>`;
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

  static _diamond(m: ShapeMeta): string {
      return `<polygon points="50,2 98,50 50,98 2,50"/>`;
  }

  static _cross(m: ShapeMeta): string {
      const t = Math.max(10, Math.min(40, parseFloat(String(m.armThickness)) || 28));
      const half = (t / 2).toFixed(2);
      const c = 50;
      const lo = (c - t / 2).toFixed(2), hi = (c + t / 2).toFixed(2);
      return `<polygon points="${lo},2 ${hi},2 ${hi},${lo} 98,${lo} 98,${hi} ${hi},${hi} ${hi},98 ${lo},98 ${lo},${hi} 2,${hi} 2,${lo} ${lo},${lo}"/>`;
  }

  static _ring(m: ShapeMeta): string {
      const thickness = Math.max(5, Math.min(45, parseFloat(String(m.ringThickness)) || 18));
      const outerR = 49;
      const innerR = Math.max(4, outerR - thickness);
      // Two concentric circles (any winding) combined with fill-rule
      // evenodd: the inner circle sits entirely inside the outer one, so
      // the overlap (the whole inner disc) is excluded, leaving a ring.
      return `<path fill-rule="evenodd" d="` +
          `M50,${(50 - outerR).toFixed(2)} A${outerR},${outerR} 0 1,0 50,${(50 + outerR).toFixed(2)} A${outerR},${outerR} 0 1,0 50,${(50 - outerR).toFixed(2)} Z ` +
          `M50,${(50 - innerR).toFixed(2)} A${innerR},${innerR} 0 1,1 50,${(50 + innerR).toFixed(2)} A${innerR},${innerR} 0 1,1 50,${(50 - innerR).toFixed(2)} Z"/>`;
  }

  static _arrow(m: ShapeMeta): string {
      // Classic block arrow pointing right, in the fixed 0-100 box.
      return `<polygon points="2,35 60,35 60,15 98,50 60,85 60,65 2,65"/>`;
  }

  static _arc(m: ShapeMeta): string {
      // A half-circle "dome" (semicircle + flat base).
      return `<path d="M2,50 A48,48 0 0 1 98,50 L98,98 L2,98 Z"/>`;
  }

  static _speechBubble(m: ShapeMeta): string {
      return `<path d="M12,2 H88 A10,10 0 0 1 98,12 V68 A10,10 0 0 1 88,78 H35 L18,96 L22,78 H12 A10,10 0 0 1 2,68 V12 A10,10 0 0 1 12,2 Z"/>`;
  }

  // ── Lines / connectors ──────────────────────────────────────────────────
  // Unlike every shape above, a line has no enclosed area -- "fill" doesn't
  // mean anything for the segment itself. It's drawn with an explicit
  // fill="none" override instead, and the segment's visible color/width
  // come entirely from the shared strokeAttr (buildSvgString() already
  // guarantees hasStroke=true here via defaultMeta()'s non-zero
  // strokeWidth). Arrowhead triangles are left WITHOUT an explicit fill
  // attribute so they inherit the wrapping <g>'s fill -- i.e. they use
  // fillColor, which ShapeTool.ts relabels "Arrowhead color" for these two
  // types (see LINE_SHAPE_TYPES).

  static _arrowHead(x: number, y: number, angleDeg: number): string {
      const len = 14, halfWidth = 5;
      return `<polygon points="0,0 ${-len},${-halfWidth} ${-len},${halfWidth}" transform="translate(${x} ${y}) rotate(${angleDeg})"/>`;
  }

  static _line(m: ShapeMeta): string {
      const sw = Math.max(1, parseFloat(String(m.strokeWidth)) || 4);
      const dashAttr = m.dashed ? ` stroke-dasharray="${(sw * 2.2).toFixed(1)},${(sw * 1.6).toFixed(1)}"` : '';
      let markup = `<path d="M4,50 L96,50" fill="none"${dashAttr}/>`;
      if (m.arrowStart) markup += this._arrowHead(4, 50, 180);
      if (m.arrowEnd)   markup += this._arrowHead(96, 50, 0);
      return markup;
  }

  static _elbowConnector(m: ShapeMeta): string {
      let markup = `<path d="M4,15 L50,15 L50,85 L96,85" fill="none"/>`;
      if (m.arrowStart) markup += this._arrowHead(4, 15, 180);
      if (m.arrowEnd)   markup += this._arrowHead(96, 85, 0);
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
