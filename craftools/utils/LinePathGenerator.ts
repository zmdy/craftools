/**
 * LinePathGenerator.ts
 *
 * Pure geometry helpers for LineTool.ts -- turns a list of points (placed by
 * clicking, or captured while dragging freehand) into an SVG `<path>` `d`
 * string, plus optional arrow/circle/diamond connector markers at either
 * end. Kept free of any DOM/element concerns (no reads from `_craftoolsMeta`,
 * no writes to style/attributes) so it's trivially unit-testable and reusable
 * from both the live draw-mode preview (LineTool.startDraw()) and the
 * committed element's own render (LineTool._regenerate()) without those two
 * call sites drifting out of sync with each other.
 */

export interface LinePoint {
  x: number;
  y: number;
}

export type ConnectorStyle = 'none' | 'arrow' | 'circle' | 'diamond';

export interface LineBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class LinePathGenerator {

  /**
   * How far a connector marker's own geometry reaches past the raw
   * endpoint, in local px, for a given stroke width -- used both to size
   * the marker itself (see buildConnectorMarkup()) and to pad the bounding
   * box (see computeBounds()) so export paths (which clip at the element's
   * own box via `.ct-el-inner { overflow:hidden }`, see AgendaSvgExport.ts/
   * PdfExport.ts) never cut an arrowhead or circle off.
   */
  static connectorReach(style: ConnectorStyle, strokeWidth: number): number {
    switch (style) {
      case 'arrow':   return Math.max(strokeWidth * 3, 10);
      case 'diamond': return Math.max(strokeWidth * 2.4, 8);
      case 'circle':  return Math.max(strokeWidth * 1.8, 6);
      default:        return 0;
    }
  }

  /**
   * Bounding box of every point, padded so the stroke's own half-width and
   * whichever connector reaches furthest never get clipped once this
   * becomes the element's x/y/w/h. Returns a 1x1 box around the single
   * point if there's only one (mid-draw, before a 2nd point exists yet).
   */
  static computeBounds(points: LinePoint[], strokeWidth: number, connectorStart: ConnectorStyle, connectorEnd: ConnectorStyle): LineBounds {
    if (points.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    const pad = Math.max(
      strokeWidth / 2 + 2,
      this.connectorReach(connectorStart, strokeWidth),
      this.connectorReach(connectorEnd, strokeWidth),
    );
    let minX = points[0].x, maxX = points[0].x, minY = points[0].y, maxY = points[0].y;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }

  /**
   * Builds the path's `d` attribute. `smooth: false` (or fewer than 3
   * points) draws a plain straight polyline through every point --
   * `smooth: true` runs a uniform Catmull-Rom-to-cubic-Bezier conversion
   * (the standard construction: for each segment P[i]->P[i+1], control
   * points are derived from the previous/next points so the curve passes
   * through every placed point with continuous tangents, rather than
   * needing the user to place/drag any bezier handles themselves -- see
   * LineTool's own doc comment for why this "automatic smoothing" shape was
   * chosen over manual bezier handles).
   */
  static buildPathD(points: LinePoint[], smooth: boolean): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    if (!smooth || points.length < 3) {
      return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    }

    // Uniform Catmull-Rom -> Bezier, clamping the "virtual" neighbor at
    // each end by duplicating the first/last point (standard treatment for
    // an open, non-looping curve).
    const pts = points;
    const n = pts.length;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < n ? i + 2 : n - 1];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  /**
   * Builds the SVG markup for one endpoint's connector marker (a filled
   * `<polygon>`/`<circle>`), already rotated/positioned to sit right at
   * that endpoint and point outward along the line's own tangent there --
   * mirrors ShapeGenerator.ts's `_arrowHead()` (same triangle shape) but
   * generalized to the 3 marker types and to an arbitrary tangent angle
   * instead of ShapeGenerator's fixed 0/180deg (a pre-made line shape is
   * always horizontal in its own local box; a hand-drawn line usually
   * isn't).
   */
  static buildConnectorMarkup(points: LinePoint[], end: 'start' | 'end', style: ConnectorStyle, color: string, strokeWidth: number): string {
    if (style === 'none' || points.length < 2) return '';
    const tip  = end === 'start' ? points[0] : points[points.length - 1];
    const from = end === 'start' ? points[1] : points[points.length - 2];
    const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
    const reach = this.connectorReach(style, strokeWidth);
    const esc = (color || '#000').replace(/"/g, "'");

    if (style === 'circle') {
      const r = reach / 2;
      const cx = tip.x - Math.cos(angle) * r;
      const cy = tip.y - Math.sin(angle) * r;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${esc}"/>`;
    }

    if (style === 'diamond') {
      const half = reach / 2;
      const cx = tip.x - Math.cos(angle) * half;
      const cy = tip.y - Math.sin(angle) * half;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const rot = (lx: number, ly: number) => ({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos });
      const a = rot(half, 0), b = rot(0, half * 0.6), c = rot(-half, 0), d = rot(0, -half * 0.6);
      return `<polygon points="${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}" fill="${esc}"/>`;
    }

    // 'arrow' -- classic filled triangle, tip exactly at the endpoint.
    const backX = tip.x - Math.cos(angle) * reach;
    const backY = tip.y - Math.sin(angle) * reach;
    const wing = reach * 0.42;
    const perpX = -Math.sin(angle) * wing;
    const perpY =  Math.cos(angle) * wing;
    const wing1 = { x: backX + perpX, y: backY + perpY };
    const wing2 = { x: backX - perpX, y: backY - perpY };
    return `<polygon points="${tip.x},${tip.y} ${wing1.x},${wing1.y} ${wing2.x},${wing2.y}" fill="${esc}"/>`;
  }

  /**
   * Distance-based thinning for a raw freehand pointer-move stream, which
   * otherwise captures a new point every few pixels of mouse movement
   * (hundreds of points for a single stroke) -- keeps only points at least
   * `minDist` apart (local px, already divided by canvas zoom), so the
   * stored point list stays a reasonable size and the Catmull-Rom curve
   * through it stays smooth instead of visually "jittery" from near-
   * duplicate points. Always keeps the first and last raw point so the
   * captured stroke's actual start/end aren't shifted.
   */
  static simplifyPoints(points: LinePoint[], minDist = 6): LinePoint[] {
    if (points.length <= 2) return points;
    const out: LinePoint[] = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const last = out[out.length - 1];
      const dx = points[i].x - last.x;
      const dy = points[i].y - last.y;
      if (Math.sqrt(dx * dx + dy * dy) >= minDist) out.push(points[i]);
    }
    out.push(points[points.length - 1]);
    return out;
  }
}
