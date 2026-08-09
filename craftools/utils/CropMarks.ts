/**
 * CropMarks.ts
 *
 * Shared crop-marks + bleed geometry/config utility, consumed by every
 * export pipeline (PdfExport.ts print/PDF Rápido, ImageExport.ts,
 * AgendaSvgExport.ts, PdfVectorExport.ts) plus PageTool.ts's "Marcas de
 * Corte" Page Settings tab.
 *
 * ── Data model ────────────────────────────────────────────────────────────
 * Config lives directly on a `.craftools-page` element's `dataset`
 * (mirrors how `AgendaPlan.ts`/`VariableEngine.ts` already read per-page
 * `dataset.agendaRepeatTrigger` etc.):
 *   - dataset.cropMarksEnabled : "true" | "false"
 *   - dataset.cropMarksStyle   : "standard" | "cross" | "circle"
 *   - dataset.cropMarksCount   : "4" | "6" | "8"
 *   - dataset.bleedMm          : number as string (0 = no bleed)
 *
 * `StateSerializer.ts`'s `PageState.dataset` field round-trips this exactly
 * like `ElementState.dataset` already does for elements, so undo/redo and
 * `.craftools` project export/import both carry it automatically -- no
 * crop-marks-specific serialization code needed anywhere else.
 *
 * ── Bleed model ───────────────────────────────────────────────────────────
 * "Sangria" only ever affects the exported/printed OUTPUT canvas, never the
 * page's own authored width/height (every other part of the app -- x/y/w/h
 * element placement, snapping, the on-canvas editor -- keeps treating the
 * page's configured size as the trim size). At export time, each page's
 * output canvas is enlarged by a margin on every side:
 *
 *   margin = bleedPx + (cropMarksEnabled ? GAP + LEN : 0)
 *
 * (mirrors the formula `PdfVectorExport.ts` already used for its own
 * pre-existing ad-hoc crop-marks/bleed checkboxes: `marginPt = cropMarks ?
 * bleedPt + cropMarkLengthPt + cropMarkOffsetPt : bleedPt`). The trim-size
 * content is placed inset by `margin` from the new canvas's edges, the
 * extra margin area is filled with the page's own background so there's no
 * visible seam, and crop-mark ticks are drawn just outside the trim
 * boundary, inside that margin.
 *
 * Percentage-unit pages (`%` width/height) skip bleed entirely (bleedPx
 * forced to 0) -- a bleed measured in mm makes no sense against a
 * responsive/percentage page size, and there's no reliable pixel size to
 * convert from at export time for those.
 */

export type CropMarksStyle = 'standard' | 'cross' | 'circle';

export interface CropMarksConfig {
  enabled: boolean;
  style:   CropMarksStyle;
  count:   4 | 6 | 8;
  bleedMm: number;
}

export interface MarkSegment { x1: number; y1: number; x2: number; y2: number; }
export interface MarkCircle  { cx: number; cy: number; r: number; }
export interface MarkGeometry {
  lines:   MarkSegment[];
  circles: MarkCircle[];
}

const DEFAULT_CONFIG: CropMarksConfig = { enabled: false, style: 'standard', count: 4, bleedMm: 0 };

export class CropMarks {
  /** Distance (px, ~96dpi) between the trim edge and where a mark starts. */
  static readonly GAP = 5;
  /** Length (px, ~96dpi) of each mark tick/crosshair arm. */
  static readonly LEN = 18;

  // ── Config read/write ────────────────────────────────────────────────────

  static readConfig(pageEl: HTMLElement): CropMarksConfig {
    const ds = pageEl.dataset;
    const style = ds.cropMarksStyle;
    return {
      enabled: ds.cropMarksEnabled === 'true',
      style:   (style === 'cross' || style === 'circle') ? style : 'standard',
      count:   ds.cropMarksCount === '8' ? 8 : ds.cropMarksCount === '6' ? 6 : 4,
      bleedMm: parseFloat(ds.bleedMm ?? '0') || 0,
    };
  }

  static writeConfig(pageEl: HTMLElement, patch: Partial<CropMarksConfig>): CropMarksConfig {
    const next: CropMarksConfig = { ...CropMarks.readConfig(pageEl), ...patch };
    pageEl.dataset.cropMarksEnabled = String(next.enabled);
    pageEl.dataset.cropMarksStyle   = next.style;
    pageEl.dataset.cropMarksCount   = String(next.count);
    pageEl.dataset.bleedMm          = String(next.bleedMm);
    return next;
  }

  static defaultConfig(): CropMarksConfig {
    return { ...DEFAULT_CONFIG };
  }

  // ── Unit conversion ──────────────────────────────────────────────────────

  static mmToPx(mm: number): number {
    return (mm / 25.4) * 96;
  }

  /** Converts a CSS length string (px/mm/cm/in/pt) to px at ~96dpi. Returns
   *  0 for percentage or unparseable values -- callers should treat 0 as
   *  "no bleed possible for this page". */
  static cssLengthToPx(value: string | undefined | null): number {
    if (!value) return 0;
    const v = value.trim();
    if (v.endsWith('%')) return 0;
    if (v.endsWith('px')) return parseFloat(v) || 0;
    if (v.endsWith('mm')) return (parseFloat(v) || 0) * (96 / 25.4);
    if (v.endsWith('cm')) return (parseFloat(v) || 0) * (96 / 2.54);
    if (v.endsWith('in')) return (parseFloat(v) || 0) * 96;
    if (v.endsWith('pt')) return (parseFloat(v) || 0) * (96 / 72);
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }

  static isPercentLength(value: string | undefined | null): boolean {
    return !!value && value.trim().endsWith('%');
  }

  /** Total margin (px) added around the trim rect on every side. */
  static computeMargin(config: CropMarksConfig, bleedPx: number): number {
    return bleedPx + (config.enabled ? (CropMarks.GAP + CropMarks.LEN) : 0);
  }

  // ── Geometry (pure, trim-rect-relative: (0,0) = top-left of trim area) ──

  static buildGeometry(trimW: number, trimH: number, config: CropMarksConfig): MarkGeometry {
    const lines: MarkSegment[] = [];
    const circles: MarkCircle[] = [];
    if (!config.enabled) return { lines, circles };

    const gap = CropMarks.GAP;
    const len = CropMarks.LEN;

    type Pos = { x: number; y: number; dx: -1 | 0 | 1; dy: -1 | 0 | 1 };
    const positions: Pos[] = [
      { x: 0,        y: 0,       dx: -1, dy: -1 }, // top-left
      { x: trimW,    y: 0,       dx: 1,  dy: -1 }, // top-right
      { x: 0,        y: trimH,   dx: -1, dy: 1  }, // bottom-left
      { x: trimW,    y: trimH,   dx: 1,  dy: 1  }, // bottom-right
    ];
    if (config.count === 6 || config.count === 8) {
      // Extra pair at the horizontal edges' midpoints (top-center /
      // bottom-center) -- the common convention for larger sheets needing
      // an extra vertical alignment/fold reference beyond the 4 corners.
      positions.push({ x: trimW / 2, y: 0,     dx: 0, dy: -1 });
      positions.push({ x: trimW / 2, y: trimH, dx: 0, dy: 1  });
    }
    if (config.count === 8) {
      // Second extra pair at the vertical edges' midpoints (left-center /
      // right-center), completing all 4 side midpoints alongside the 4
      // corners for the largest mark set.
      positions.push({ x: 0,     y: trimH / 2, dx: -1, dy: 0 });
      positions.push({ x: trimW, y: trimH / 2, dx: 1,  dy: 0 });
    }

    for (const p of positions) {
      if (config.style === 'standard') {
        // Two independent axis-aligned ticks flush against each trim edge
        // extended past the corner -- classic European crop-mark look
        // (mirrors PdfVectorExport.ts's pre-existing drawCropLine() pairs).
        if (p.dx !== 0) {
          lines.push({ x1: p.x + p.dx * (gap + len), y1: p.y, x2: p.x + p.dx * gap, y2: p.y });
        }
        if (p.dy !== 0) {
          lines.push({ x1: p.x, y1: p.y + p.dy * (gap + len), x2: p.x, y2: p.y + p.dy * gap });
        }
      } else {
        // 'cross' / 'circle': a crosshair centered outward from the trim
        // point, along the corner's diagonal (or straight out, for the
        // edge-midpoint marks where dx===0).
        const cx = p.x + p.dx * (gap + len / 2);
        const cy = p.y + p.dy * (gap + len / 2);
        const arm = len * 0.6;
        lines.push({ x1: cx - arm / 2, y1: cy, x2: cx + arm / 2, y2: cy });
        lines.push({ x1: cx, y1: cy - arm / 2, x2: cx, y2: cy + arm / 2 });
        if (config.style === 'circle') {
          circles.push({ cx, cy, r: arm * 0.35 });
        }
      }
    }

    return { lines, circles };
  }

  // ── SVG appliers (AgendaSvgExport.ts) ────────────────────────────────────

  /** Appends a crop-marks `<g>` directly onto an existing SVG root, offset
   *  by (originX, originY) -- mirrors AgendaSvgExport.ts's own
   *  `_drawBorderOverlays()` append pattern (one `<g>`, `createElementNS`
   *  children, single `svg.appendChild(g)` at the end). */
  static appendSvgOverlay(
    svg: SVGSVGElement,
    trimW: number,
    trimH: number,
    config: CropMarksConfig,
    originX = 0,
    originY = 0,
    color = '#000000',
  ): void {
    if (!config.enabled) return;
    const geo = CropMarks.buildGeometry(trimW, trimH, config);
    if (!geo.lines.length && !geo.circles.length) return;

    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'ct-crop-marks');
    g.setAttribute('transform', `translate(${originX},${originY})`);

    for (const l of geo.lines) {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(l.x1));
      line.setAttribute('y1', String(l.y1));
      line.setAttribute('x2', String(l.x2));
      line.setAttribute('y2', String(l.y2));
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '1');
      g.appendChild(line);
    }
    for (const c of geo.circles) {
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', String(c.cx));
      circle.setAttribute('cy', String(c.cy));
      circle.setAttribute('r', String(c.r));
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '1');
      g.appendChild(circle);
    }

    svg.appendChild(g);
  }

  /** Enlarges an already-rendered SVG's canvas by `marginPx` on every side
   *  (bleed + crop-marks room), wrapping its EXISTING children in a
   *  translated `<g>` and painting `background` behind everything. Must be
   *  called BEFORE `appendSvgOverlay()` so the marks land on top, at
   *  outer-canvas coordinates (appendSvgOverlay's own origin offset should
   *  then be `marginPx, marginPx` to match). No-ops when `marginPx <= 0`. */
  static wrapSvgForBleed(
    svg: SVGSVGElement,
    trimW: number,
    trimH: number,
    marginPx: number,
    background: string,
  ): void {
    if (marginPx <= 0) return;
    const NS = 'http://www.w3.org/2000/svg';
    const totalW = trimW + marginPx * 2;
    const totalH = trimH + marginPx * 2;

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'ct-bleed-content');
    g.setAttribute('transform', `translate(${marginPx},${marginPx})`);
    while (svg.firstChild) g.appendChild(svg.firstChild);

    if (background) {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', '0');
      rect.setAttribute('width', String(totalW));
      rect.setAttribute('height', String(totalH));
      rect.setAttribute('fill', background);
      svg.appendChild(rect);
    }
    svg.appendChild(g);

    svg.setAttribute('width', String(totalW));
    svg.setAttribute('height', String(totalH));
    svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
  }

  // ── HTML/CSS applier (PdfExport.ts, ImageExport.ts) ──────────────────────

  /** Builds an absolutely-positioned inline `<svg>` string covering the
   *  full bled canvas (0,0 = canvas top-left), with marks already offset by
   *  `marginPx` so they land just outside the trim rect. Empty string if
   *  marks are disabled. */
  static buildHtmlOverlaySvg(trimW: number, trimH: number, marginPx: number, config: CropMarksConfig, color = '#000000'): string {
    if (!config.enabled) return '';
    const geo = CropMarks.buildGeometry(trimW, trimH, config);
    if (!geo.lines.length && !geo.circles.length) return '';

    const totalW = trimW + marginPx * 2;
    const totalH = trimH + marginPx * 2;
    const lines = geo.lines.map(l =>
      `<line x1="${l.x1 + marginPx}" y1="${l.y1 + marginPx}" x2="${l.x2 + marginPx}" y2="${l.y2 + marginPx}" stroke="${color}" stroke-width="1"/>`
    ).join('');
    const circles = geo.circles.map(c =>
      `<circle cx="${c.cx + marginPx}" cy="${c.cy + marginPx}" r="${c.r}" fill="none" stroke="${color}" stroke-width="1"/>`
    ).join('');

    return `<svg class="ct-crop-marks-overlay" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" style="position:absolute; left:0; top:0; pointer-events:none;">${lines}${circles}</svg>`;
  }

  /**
   * Wraps a page's already-serialized inner HTML with the bleed canvas +
   * crop-marks overlay, for HTML/CSS-based export pipelines. Returns the
   * ORIGINAL `innerHtml` unchanged (marginPx: 0) when the page has no
   * crop-marks/bleed configured or its size is percentage-based.
   *
   * `trimWCss`/`trimHCss` are the page's own authored CSS length strings
   * (e.g. "210mm", "800px") -- exactly `PageSize.width`/`PageSize.height`
   * as produced by `PdfExport._parsePageSize()`.
   */
  static wrapHtmlWithBleed(
    innerHtml: string,
    trimWCss: string,
    trimHCss: string,
    background: string,
    pageEl: HTMLElement,
  ): { html: string; totalWidthPx: number; totalHeightPx: number; marginPx: number } {
    const config = CropMarks.readConfig(pageEl);
    const percent = CropMarks.isPercentLength(trimWCss) || CropMarks.isPercentLength(trimHCss);
    const bleedPx = percent ? 0 : CropMarks.mmToPx(config.bleedMm);
    const marginPx = CropMarks.computeMargin(config, bleedPx);

    if (marginPx <= 0) {
      return { html: innerHtml, totalWidthPx: 0, totalHeightPx: 0, marginPx: 0 };
    }

    const trimWpx = CropMarks.cssLengthToPx(trimWCss);
    const trimHpx = CropMarks.cssLengthToPx(trimHCss);
    if (!trimWpx || !trimHpx) {
      return { html: innerHtml, totalWidthPx: 0, totalHeightPx: 0, marginPx: 0 };
    }

    const overlay = CropMarks.buildHtmlOverlaySvg(trimWpx, trimHpx, marginPx, config);
    const totalW = trimWpx + marginPx * 2;
    const totalH = trimHpx + marginPx * 2;
    const bg = background || '#ffffff';

    const html = `<div class="ct-bleed-wrap" style="position:relative; width:${totalW}px; height:${totalH}px; background:${bg};">` +
      `<div class="ct-bleed-trim" style="position:absolute; left:${marginPx}px; top:${marginPx}px; width:${trimWpx}px; height:${trimHpx}px; overflow:visible;">${innerHtml}</div>` +
      overlay +
      `</div>`;

    return { html, totalWidthPx: totalW, totalHeightPx: totalH, marginPx };
  }

  // ── Live on-canvas preview (PageTool.ts) ─────────────────────────────────
  //
  // `.craftools-page` has `overflow:hidden` (craftools.css) so it can clip
  // element content that's dragged/resized past the page edge -- that
  // rules out drawing marks/bleed OUTSIDE the page box the way every export
  // pipeline above does (would just get clipped, and restructuring every
  // page into an extra wrapper div to allow overflow would ripple through
  // every piece of code that assumes `.craftools-page` is a direct child of
  // `#pages-wrapper`: StateSerializer.reconcile's sibling-order diffing,
  // SortableJS page-reordering, the footer thumbnail strip, drag-drop,
  // etc.). So this is a deliberately-approximate INSET preview instead: a
  // dashed bleed boundary and small inward-pointing corner/edge marks, both
  // fully inside the trim rect, close enough to the edge to read as "marks
  // roughly here" without claiming pixel-accuracy against the real
  // (canvas-enlarging) export geometry above.

  private static readonly LIVE_GUIDE_INSET = 8;
  private static readonly LIVE_GUIDE_LEN   = 14;

  static buildLiveOverlaySvg(trimW: number, trimH: number, config: CropMarksConfig, color = '#ef4444'): string {
    if (!config.enabled && config.bleedMm <= 0) return '';
    const parts: string[] = [];

    if (config.bleedMm > 0) {
      const maxInset = Math.min(trimW, trimH) * 0.25;
      const bleedPx = Math.min(CropMarks.mmToPx(config.bleedMm), maxInset);
      parts.push(
        `<rect x="${bleedPx}" y="${bleedPx}" width="${Math.max(0, trimW - bleedPx * 2)}" height="${Math.max(0, trimH - bleedPx * 2)}" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="5 4" opacity="0.6"/>`
      );
    }

    if (config.enabled) {
      const inset = CropMarks.LIVE_GUIDE_INSET;
      const len   = CropMarks.LIVE_GUIDE_LEN;
      // dx/dy here point INWARD (opposite sign convention from
      // buildGeometry()'s export-time outward marks) since these previews
      // have to stay inside the trim rect.
      type Pos = { x: number; y: number; dx: -1 | 0 | 1; dy: -1 | 0 | 1 };
      const positions: Pos[] = [
        { x: 0,       y: 0,      dx: 1,  dy: 1  },
        { x: trimW,   y: 0,      dx: -1, dy: 1  },
        { x: 0,       y: trimH,  dx: 1,  dy: -1 },
        { x: trimW,   y: trimH,  dx: -1, dy: -1 },
      ];
      if (config.count === 6 || config.count === 8) {
        positions.push({ x: trimW / 2, y: 0,     dx: 0, dy: 1  });
        positions.push({ x: trimW / 2, y: trimH, dx: 0, dy: -1 });
      }
      if (config.count === 8) {
        positions.push({ x: 0,     y: trimH / 2, dx: 1,  dy: 0 });
        positions.push({ x: trimW, y: trimH / 2, dx: -1, dy: 0 });
      }

      for (const p of positions) {
        if (config.style === 'standard') {
          if (p.dx !== 0) parts.push(`<line x1="${p.x + p.dx * inset}" y1="${p.y}" x2="${p.x + p.dx * (inset + len)}" y2="${p.y}" stroke="${color}" stroke-width="1.5"/>`);
          if (p.dy !== 0) parts.push(`<line x1="${p.x}" y1="${p.y + p.dy * inset}" x2="${p.x}" y2="${p.y + p.dy * (inset + len)}" stroke="${color}" stroke-width="1.5"/>`);
        } else {
          const cx = p.x + p.dx * (inset + len / 2);
          const cy = p.y + p.dy * (inset + len / 2);
          const arm = len * 0.6;
          parts.push(`<line x1="${cx - arm / 2}" y1="${cy}" x2="${cx + arm / 2}" y2="${cy}" stroke="${color}" stroke-width="1.5"/>`);
          parts.push(`<line x1="${cx}" y1="${cy - arm / 2}" x2="${cx}" y2="${cy + arm / 2}" stroke="${color}" stroke-width="1.5"/>`);
          if (config.style === 'circle') parts.push(`<circle cx="${cx}" cy="${cy}" r="${arm * 0.35}" fill="none" stroke="${color}" stroke-width="1.5"/>`);
        }
      }
    }

    if (!parts.length) return '';
    return `<svg class="ct-crop-marks-live-svg" width="${trimW}" height="${trimH}" viewBox="0 0 ${trimW} ${trimH}" style="position:absolute; inset:0; pointer-events:none;">${parts.join('')}</svg>`;
  }

  /** Creates/updates/removes the live on-canvas overlay for one page.
   *  Idempotent -- safe to call repeatedly (page load, undo/redo restore,
   *  dimension edits, or right after `writeConfig()`). */
  static renderLiveOverlay(pageEl: HTMLElement): void {
    const config = CropMarks.readConfig(pageEl);
    const existing = pageEl.querySelector<HTMLElement>(':scope > .ct-crop-marks-live-wrap');

    const trimWpx = CropMarks.cssLengthToPx(pageEl.style.width || '800px');
    const trimHpx = CropMarks.cssLengthToPx(pageEl.style.minHeight || '600px');
    const svg = (!trimWpx || !trimHpx) ? '' : CropMarks.buildLiveOverlaySvg(trimWpx, trimHpx, config);

    if (!svg) {
      existing?.remove();
      return;
    }

    let overlay = existing;
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'ct-crop-marks-live-wrap';
      overlay.style.cssText = 'position:absolute; inset:0; pointer-events:none; z-index:6;';
      pageEl.appendChild(overlay);
    }
    overlay.innerHTML = svg;
  }

  // ── pdf-lib applier (PdfVectorExport.ts) ─────────────────────────────────

  /**
   * Draws crop marks directly onto a pdf-lib `PDFPage` using its
   * `drawLine`/`drawEllipse` primitives. Coordinates are in pt, PDF's
   * bottom-up Y axis -- callers pass the trim box's corners
   * (`trimLeft/trimBottom/trimRight/trimTop`, all already in pt) and this
   * flips `CropMarks.buildGeometry()`'s screen-space (top-down, trim origin
   * at 0,0) output to match by negating Y and re-basing onto
   * (trimLeft, trimTop) as the geometry's local (0,0).
   *
   * Generalizes what `PdfVectorExport.ts` used to do with a hardcoded
   * 4-corner "standard" drawCropLine() pair -- same GAP/LEN feel (converted
   * px->pt) so existing exports that already had crop marks look the same.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdf-lib's
  // own `PDFPage`/`Color` types pull in a large union this file has no
  // other reason to depend on; `any` here just avoids that coupling for a
  // small, purely-additive drawing helper.
  static drawPdfLibMarks(
    page: any,
    trimLeft: number,
    trimBottom: number,
    trimRight: number,
    trimTop: number,
    config: CropMarksConfig,
    rgbColor: unknown,
  ): void {
    if (!config.enabled) return;
    const trimWpt = trimRight - trimLeft;
    const trimHpt = trimTop - trimBottom;
    // px(~96dpi) -> pt(72dpi) so GAP/LEN read the same physical size here
    // as they do in the SVG/HTML pipelines.
    const scale = 72 / 96;
    const geo = CropMarks.buildGeometry(trimWpt / scale, trimHpt / scale, config);

    const toPdf = (x: number, y: number): { x: number; y: number } => ({
      x: trimLeft + x * scale,
      y: trimTop - y * scale, // screen Y-down -> PDF Y-up
    });

    for (const l of geo.lines) {
      const a = toPdf(l.x1, l.y1);
      const b = toPdf(l.x2, l.y2);
      page.drawLine({ start: a, end: b, thickness: 0.5, color: rgbColor });
    }
    if (page.drawEllipse) {
      for (const c of geo.circles) {
        const center = toPdf(c.cx, c.cy);
        page.drawEllipse({
          x: center.x, y: center.y,
          xScale: c.r * scale, yScale: c.r * scale,
          borderWidth: 0.5, borderColor: rgbColor,
        });
      }
    }
  }
}
