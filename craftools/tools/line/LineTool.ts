/**
 * LineTool.ts
 *
 * A hand-drawn line/connector element -- unlike ShapeTool's 'line'/
 * 'elbowConnector' shape types (a straight or single-bend segment stretched
 * into a fixed box, see ShapeGenerator.ts's LINE_SHAPE_TYPES), THIS tool's
 * geometry comes entirely from points the user actually places on the
 * canvas: click to drop a vertex at a time (double-click/Enter to finish),
 * or press-and-drag to draw freehand. Kept as its own separate tool/file
 * rather than a third ShapeTool shapeType because its whole interaction
 * model is different from every other tool -- selecting it from the
 * sidebar doesn't instantly create a default-sized element the way every
 * other creator tool does (see startDraw()), and once created it stays
 * point-editable via draggable vertex handles (see _setupPointHandles())
 * instead of only the usual whole-box resize handles.
 *
 * State is stored in element._craftoolsMeta (LineMeta) the same way
 * ShapeTool.ts stores ShapeMeta: _syncFromDOM() copies the style-only keys
 * (not `points` -- there's no panel field for those, only the canvas vertex
 * handles) into dataset.ctState so PropertyRenderer can read them, and
 * _applyProperty() writes back into _craftoolsMeta and calls _regenerate()
 * to rebuild the SVG.
 */

import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import { normalizeValue, svgPaintFromValue } from '../../utils/ColorPickerUI.js';
import { LinePathGenerator, type LinePoint, type ConnectorStyle } from '../../utils/LinePathGenerator';
import { I18n } from '../../settings/Translations.js';
import './LineTool_Translations.js';
import type { PropertySchema } from '../../types/PropertySchema';

const t = (key: string): string => I18n.t('lineTool.' + key);

// ── Meta ──────────────────────────────────────────────────────────────────────

export interface LineMeta {
  points:         LinePoint[];
  smooth:         boolean;
  strokeColor:    string; // bare hex or JSON ColorPickerValue string (gradient-capable)
  strokeWidth:    number;
  dashed:         boolean;
  connectorStart: ConnectorStyle;
  connectorEnd:   ConnectorStyle;
}

interface LineElement extends HTMLElement {
  _craftoolsMeta?: LineMeta;
  select?: () => void;
}

const DEFAULT_META: LineMeta = {
  points:         [{ x: 20, y: 20 }, { x: 140, y: 20 }],
  smooth:         false,
  strokeColor:    '#1a1a1a',
  strokeWidth:    4,
  dashed:         false,
  connectorStart: 'none',
  connectorEnd:   'arrow',
};

const getMeta = (element: HTMLElement): LineMeta => {
  const existing = (element as LineElement)._craftoolsMeta;
  if (existing) return existing;
  return { ...DEFAULT_META, points: DEFAULT_META.points.map(p => ({ ...p })) };
};

const setMeta = (element: HTMLElement, patch: Partial<LineMeta>): LineMeta => {
  const el = element as LineElement;
  el._craftoolsMeta = { ...getMeta(element), ...patch };
  return el._craftoolsMeta;
};

const CONNECTOR_OPTIONS = [
  { value: 'none',    label: 'None',    i18nKey: 'lineTool.connectorNone' },
  { value: 'arrow',   label: 'Arrow',   i18nKey: 'lineTool.connectorArrow' },
  { value: 'circle',  label: 'Circle',  i18nKey: 'lineTool.connectorCircle' },
  { value: 'diamond', label: 'Diamond', i18nKey: 'lineTool.connectorDiamond' },
];

export class LineTool extends BaseTool {

  // ── Creation ──────────────────────────────────────────────────────────────

  /**
   * Builds the actual `<craftools-element data-craftool="line">`. Unlike
   * every other tool's createElement(), this is NOT what the sidebar button
   * calls directly -- clicking "Linha" starts startDraw() instead (see its
   * own doc comment), which calls this itself once the user has actually
   * placed the points, passing them in as `initialMeta`. Kept as a real,
   * independently-usable createElement(toolType, editor) too (default 2-
   * point placeholder line) so this tool still satisfies the same
   * ToolRegistry/LAZY_TOOL_LOADERS contract every other tool does --
   * needed for e.g. pasting a copied line from the clipboard, or any other
   * generic "create a blank one of these" caller.
   */
  static createElement(_toolType?: string, _editor?: unknown, initialMeta?: Partial<LineMeta>): HTMLElement {
    const el = document.createElement('craftools-element') as LineElement;
    el.setAttribute('data-craftool', 'line');

    const rawPoints = (initialMeta?.points ?? DEFAULT_META.points).map(p => ({ ...p }));
    const strokeWidth    = initialMeta?.strokeWidth    ?? DEFAULT_META.strokeWidth;
    const connectorStart = initialMeta?.connectorStart ?? DEFAULT_META.connectorStart;
    const connectorEnd   = initialMeta?.connectorEnd   ?? DEFAULT_META.connectorEnd;

    // Normalize points to start at this box's own local (0,0) BEFORE the
    // first render -- _buildSvgElement()'s viewBox always starts at (0,0)
    // (see its own doc comment), so building it from un-shifted points
    // (e.g. a freehand stroke drawn far from the page's own top-left) would
    // draw the path way outside that viewBox on this very first paint,
    // before anything else has a chance to correct it. Every LATER call
    // goes through _regenerate(), which does this same shift -- doing it
    // here too keeps createElement()'s very first frame consistent with
    // every frame after it, instead of relying on a follow-up correction.
    const bounds = LinePathGenerator.computeBounds(rawPoints, strokeWidth, connectorStart, connectorEnd);
    const points = rawPoints.map(p => ({ x: p.x - bounds.minX, y: p.y - bounds.minY }));

    el._craftoolsMeta = { ...DEFAULT_META, ...initialMeta, points };

    const svg = LineTool._buildSvgElement(el._craftoolsMeta);
    svg.style.userSelect = 'none';
    svg.style.pointerEvents = 'none';
    el.appendChild(svg);

    el.setAttribute('x', String(Math.round(bounds.minX)));
    el.setAttribute('y', String(Math.round(bounds.minY)));
    el.setAttribute('w', String(Math.max(1, Math.round(bounds.maxX - bounds.minX))));
    el.setAttribute('h', String(Math.max(1, Math.round(bounds.maxY - bounds.minY))));

    return el;
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Builds the `<svg>` for the CURRENT meta.points as-is, with a viewBox
   * starting at (0,0) matching the element's own local px space 1:1 (no
   * non-uniform stretch the way ShapeGenerator's fixed 0-100 box gets --
   * see this tool's header comment for why: a hand-drawn line's angles/
   * proportions are exactly what the user drew, distorting them on resize
   * would look wrong in a way a stretched pre-made shape doesn't).
   * Callers needing points normalized against a fresh bounding box should
   * go through _regenerate() instead, which does that FIRST and then calls
   * this.
   */
  private static _buildSvgElement(meta: LineMeta): SVGElement {
    const bounds = LinePathGenerator.computeBounds(meta.points, meta.strokeWidth, meta.connectorStart, meta.connectorEnd);
    const w = Math.max(1, bounds.maxX - bounds.minX);
    const h = Math.max(1, bounds.maxY - bounds.minY);

    const strokePaint = svgPaintFromValue(normalizeValue(meta.strokeColor ?? '#1a1a1a'), 'line-stroke');
    const dashAttr = meta.dashed ? ` stroke-dasharray="${(meta.strokeWidth * 2.2).toFixed(1)},${(meta.strokeWidth * 1.6).toFixed(1)}"` : '';
    const d = LinePathGenerator.buildPathD(meta.points, meta.smooth);

    const startMarker = LinePathGenerator.buildConnectorMarkup(meta.points, 'start', meta.connectorStart, strokePaint.paint, meta.strokeWidth);
    const endMarker   = LinePathGenerator.buildConnectorMarkup(meta.points, 'end',   meta.connectorEnd,   strokePaint.paint, meta.strokeWidth);

    const svgString =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="display:block;width:100%;height:100%;overflow:visible;">` +
      (strokePaint.defs ? `<defs>${strokePaint.defs}</defs>` : '') +
      `<path d="${d}" fill="none" stroke="${strokePaint.paint.replace(/"/g, "'")}" stroke-width="${meta.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}/>` +
      startMarker + endMarker +
      `</svg>`;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = svgString;
    return wrapper.firstElementChild as SVGElement;
  }

  /**
   * Recomputes the bounding box from the CURRENT meta.points, shifts every
   * point so the box starts at its own local (0,0) again (undoing whatever
   * drift a vertex drag/panel edit introduced), and writes the shift back
   * into the element's real x/y attributes so the drawing's ABSOLUTE
   * position on the page doesn't jump -- then rebuilds the `<svg>`. Safe/
   * idempotent to call repeatedly (a regenerate that doesn't actually
   * change any point converges to the same box every time).
   */
  static _regenerate(element: HTMLElement): void {
    const meta = getMeta(element);
    const bounds = LinePathGenerator.computeBounds(meta.points, meta.strokeWidth, meta.connectorStart, meta.connectorEnd);
    const shiftX = bounds.minX;
    const shiftY = bounds.minY;
    const w = Math.max(1, bounds.maxX - bounds.minX);
    const h = Math.max(1, bounds.maxY - bounds.minY);

    const shiftedPoints = meta.points.map(p => ({ x: p.x - shiftX, y: p.y - shiftY }));
    setMeta(element, { points: shiftedPoints });

    const prevX = parseFloat(element.getAttribute('x') || '0') || 0;
    const prevY = parseFloat(element.getAttribute('y') || '0') || 0;
    const newX = prevX + shiftX;
    const newY = prevY + shiftY;

    element.setAttribute('x', String(newX));
    element.setAttribute('y', String(newY));
    element.setAttribute('w', String(w));
    element.setAttribute('h', String(h));
    element.style.width  = w + 'px';
    element.style.height = h + 'px';
    element.style.transform = `translate(${newX}px, ${newY}px) rotate(${element.getAttribute('r') || 0}deg)`;

    const contentHost = (element as unknown as { contentArea?: HTMLElement }).contentArea ?? element;
    contentHost.querySelectorAll('svg').forEach(svg => svg.remove());
    const svg = LineTool._buildSvgElement(getMeta(element));
    svg.style.userSelect = 'none';
    svg.style.pointerEvents = 'none';
    contentHost.appendChild(svg);

    // Keep the internal drag/resize/rotate state (Element.ts) in sync the
    // same way AutoFitText.applyAutoSize() does for text -- otherwise the
    // next manual resize-handle drag would start from a stale pw/ph.
    const craftoolsEl = element as unknown as { pw?: number; ph?: number };
    if (typeof craftoolsEl.pw === 'number') craftoolsEl.pw = w;
    if (typeof craftoolsEl.ph === 'number') craftoolsEl.ph = h;

    if (element.classList.contains('craftools-selected')) LineTool._renderPointHandles(element);

    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }

  // ── Properties panel ──────────────────────────────────────────────────────

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    const keys: (keyof LineMeta)[] = ['smooth', 'strokeColor', 'strokeWidth', 'dashed', 'connectorStart', 'connectorEnd'];
    keys.forEach(k => {
      if (!(k in existing) && meta[k] !== undefined) patch[k] = meta[k];
    });
    if (Object.keys(patch).length) {
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
    }
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Line', i18nKey: 'lineTool.sectionLine', icon: 'polyline',
        collapsible: true, defaultOpen: true,
        fields: [
          { type: 'color-picker', key: 'strokeColor', label: 'Color', i18nKey: 'lineTool.strokeColor', defaultSolid: '#1a1a1a' },
          { type: 'slider', key: 'strokeWidth', label: 'Thickness', i18nKey: 'lineTool.strokeWidth', min: 1, max: 60, step: 1 },
          { type: 'toggle', key: 'dashed', label: 'Dashed', i18nKey: 'lineTool.dashed' },
          {
            type: 'toggle', key: 'smooth', label: 'Smooth curve', i18nKey: 'lineTool.smooth',
          },
        ],
      },
      {
        section: 'Connectors', i18nKey: 'lineTool.sectionConnectors', icon: 'arrow_range',
        collapsible: true, defaultOpen: false,
        fields: [
          { type: 'select', key: 'connectorStart', label: 'Start', i18nKey: 'lineTool.connectorStart', options: CONNECTOR_OPTIONS },
          { type: 'select', key: 'connectorEnd', label: 'End', i18nKey: 'lineTool.connectorEnd', options: CONNECTOR_OPTIONS },
        ],
      },
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    if (key === 'zIndex') { element.style.zIndex = String(value); return; }

    const numericKeys = new Set(['strokeWidth']);
    const patch: Partial<LineMeta> = numericKeys.has(key)
      ? { [key]: parseFloat(String(value)) || 1 } as Partial<LineMeta>
      : { [key]: value } as Partial<LineMeta>;

    setMeta(element, patch);
    LineTool._regenerate(element);
  }

  // ── Vertex (point) editing ──────────────────────────────────────────────────

  private static readonly HANDLES_CLASS = 'ct-line-point-handles';

  /**
   * Draggable circular handles, one per point. Appended as a DIRECT CHILD
   * of `<craftools-element>` itself -- a sibling of Element.ts's private
   * `_content`/`_overlay`/`_ctrlbar`, not nested inside `_content` the way
   * TableTool.ts's column-resize handles are (see that file's
   * positionHandles()) -- because `_content` defaults to `pointer-events:
   * none` and only flips to `auto` inside Element.ts's `_enterEdit()`,
   * which TableTool's handles rely on implicitly since they're only shown
   * after the SAME double-click that triggers _enterEdit(). This tool's
   * handles need to work right after a plain single-click SELECT (no
   * double-click step), so they'd otherwise sit behind the still-active,
   * full-coverage `_overlay` (z-index 5, "cursor:move") and never receive
   * a single pointer event. Sidestepped entirely by living at the top
   * level with a z-index (21) above both `_overlay` (5) and `_ctrlbar`
   * (10) -- same absolute (0,0)-to-(w,h) local coordinate box either way,
   * since `<craftools-element>` and `_content` are both `inset:0` over the
   * identical box, so no coordinate math changes.
   */
  static _renderPointHandles(element: HTMLElement): void {
    element.querySelectorAll(`.${LineTool.HANDLES_CLASS}`).forEach(n => n.remove());

    const meta = getMeta(element);
    const layer = document.createElement('div');
    layer.className = LineTool.HANDLES_CLASS;
    layer.style.cssText = 'position:absolute; inset:0; pointer-events:none; z-index:21;';

    const scale = (): number => (window as unknown as { craftoolsZoomLevel?: number }).craftoolsZoomLevel || 1;

    meta.points.forEach((pt, idx) => {
      const handle = document.createElement('div');
      handle.className = 'ct-line-point-handle';
      handle.style.cssText = [
        'position:absolute', 'width:12px', 'height:12px', 'border-radius:50%',
        'background:#fff', 'border:2px solid var(--accent, #f97316)',
        'box-shadow:0 1px 3px rgba(0,0,0,.25)', 'cursor:grab', 'pointer-events:auto',
        `left:${pt.x - 6}px`, `top:${pt.y - 6}px`,
      ].join(';');

      handle.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handle.style.cursor = 'grabbing';
        handle.setPointerCapture(e.pointerId);
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startX = meta.points[idx].x;
        const startY = meta.points[idx].y;

        const onMove = (ev: PointerEvent): void => {
          const sc = scale();
          const dx = (ev.clientX - startClientX) / sc;
          const dy = (ev.clientY - startClientY) / sc;
          const liveMeta = getMeta(element);
          liveMeta.points[idx] = { x: startX + dx, y: startY + dy };
          setMeta(element, { points: liveMeta.points });
          // Live-drag feedback without the full regenerate()'s bounds
          // renormalize/x-y-w-h resize on every pointer move (that would
          // fight with the handle's own position mid-drag) -- just repaint
          // the path/handle position at the current point, and defer the
          // "shrink-wrap the box back to the new bounds" step to pointerup.
          const contentHost2 = (element as unknown as { contentArea?: HTMLElement }).contentArea ?? element;
          contentHost2.querySelectorAll('svg').forEach(svg => svg.remove());
          const svg = LineTool._buildSvgElementUnbounded(liveMeta, element);
          contentHost2.insertBefore(svg, contentHost2.firstChild);
          handle.style.left = (liveMeta.points[idx].x - 6) + 'px';
          handle.style.top  = (liveMeta.points[idx].y - 6) + 'px';
        };
        const onUp = (): void => {
          handle.style.cursor = 'grab';
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          LineTool._regenerate(element);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });

      layer.appendChild(handle);
    });

    element.appendChild(layer);
  }

  /**
   * Mid-drag-only variant of _buildSvgElement(): draws the path in the
   * element's CURRENT (not yet renormalized) w/h box instead of a bounds-
   * fitted viewBox, so a point that's been dragged outside the box's
   * current edge still renders in the right place relative to the OTHER
   * (unmoved) points and handles during the drag, instead of the whole
   * viewBox jumping/rescaling on every pointermove. _regenerate() (called
   * once on pointerup) is what actually shrink-wraps the box afterward.
   */
  private static _buildSvgElementUnbounded(meta: LineMeta, element: HTMLElement): SVGElement {
    const w = parseFloat(element.style.width)  || parseFloat(element.getAttribute('w') || '1') || 1;
    const h = parseFloat(element.style.height) || parseFloat(element.getAttribute('h') || '1') || 1;

    const strokePaint = svgPaintFromValue(normalizeValue(meta.strokeColor ?? '#1a1a1a'), 'line-stroke-live');
    const dashAttr = meta.dashed ? ` stroke-dasharray="${(meta.strokeWidth * 2.2).toFixed(1)},${(meta.strokeWidth * 1.6).toFixed(1)}"` : '';
    const d = LinePathGenerator.buildPathD(meta.points, meta.smooth);
    const startMarker = LinePathGenerator.buildConnectorMarkup(meta.points, 'start', meta.connectorStart, strokePaint.paint, meta.strokeWidth);
    const endMarker   = LinePathGenerator.buildConnectorMarkup(meta.points, 'end',   meta.connectorEnd,   strokePaint.paint, meta.strokeWidth);

    const svgString =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="display:block;width:100%;height:100%;overflow:visible;pointer-events:none;">` +
      (strokePaint.defs ? `<defs>${strokePaint.defs}</defs>` : '') +
      `<path d="${d}" fill="none" stroke="${strokePaint.paint.replace(/"/g, "'")}" stroke-width="${meta.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}/>` +
      startMarker + endMarker +
      `</svg>`;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = svgString;
    const svg = wrapper.firstElementChild as SVGElement;
    svg.style.pointerEvents = 'none';
    return svg;
  }

  // ── Draw mode (sidebar "Linha" button entry point) ──────────────────────────

  /**
   * Interactive point-click / freehand draw session on `page`, started by
   * the sidebar "Linha" button (see Editor.ts's dedicated click handler for
   * the 'line' tool -- unlike every other creator tool, it does NOT call
   * createElement() immediately). Two ways to place geometry, distinguished
   * purely by whether the user's first pointer interaction moves or not --
   * no separate mode toggle to pick beforehand:
   *
   *  - Click (no significant movement before release): commits ONE vertex
   *    and keeps the session open for more -- repeat to build a polyline,
   *    then double-click, press Enter, or click the same spot twice to
   *    finish, or Escape to cancel without creating anything.
   *  - Press-drag-release: captures every sampled point along the drag as
   *    one continuous freehand stroke (thinned via
   *    LinePathGenerator.simplifyPoints() so a long drag doesn't store
   *    hundreds of near-duplicate points), and finishes the WHOLE session
   *    immediately on release -- a freehand gesture IS the finished line,
   *    there's no separate "now press Enter" step for that path.
   *
   * Works identically on touch (pointer events unify mouse/touch/pen), so
   * this same entry point covers mobile drawing too without a separate
   * tap-to-add branch the way Editor.ts's other sidebar tools need.
   */
  static startDraw(editor: HTMLElement & { activePage?: Element | null }): void {
    const page = (editor.activePage ?? editor.querySelector?.('.craftools-page')) as (HTMLElement & { _ctLineDrawing?: boolean }) | null;
    if (!page || page._ctLineDrawing) return;
    page._ctLineDrawing = true;

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const scale = (): number => (window as unknown as { craftoolsZoomLevel?: number }).craftoolsZoomLevel || 1;
    const toLocal = (clientX: number, clientY: number): LinePoint => {
      const rect = page.getBoundingClientRect();
      const sc = scale();
      return { x: (clientX - rect.left) / sc, y: (clientY - rect.top) / sc };
    };

    const overlay = document.createElementNS(SVG_NS, 'svg');
    overlay.setAttribute('width', '100%');
    overlay.setAttribute('height', '100%');
    overlay.style.cssText = 'position:absolute; inset:0; z-index:50; pointer-events:none; overflow:visible;';
    const previewPath = document.createElementNS(SVG_NS, 'path');
    previewPath.setAttribute('fill', 'none');
    previewPath.setAttribute('stroke', DEFAULT_META.strokeColor);
    previewPath.setAttribute('stroke-width', String(DEFAULT_META.strokeWidth));
    previewPath.setAttribute('stroke-linecap', 'round');
    previewPath.setAttribute('stroke-linejoin', 'round');
    overlay.appendChild(previewPath);
    const dotsGroup = document.createElementNS(SVG_NS, 'g');
    overlay.appendChild(dotsGroup);
    page.style.position = page.style.position || 'relative';
    page.appendChild(overlay);

    const hint = document.createElement('div');
    hint.textContent = t('drawHint');
    hint.style.cssText = 'position:fixed; left:50%; bottom:24px; transform:translateX(-50%); background:rgba(24,24,27,.92); color:#fff; padding:8px 16px; border-radius:20px; font-size:13px; z-index:2000; pointer-events:none; white-space:nowrap; box-shadow:0 4px 16px rgba(0,0,0,.25); font-family:inherit;';
    document.body.appendChild(hint);

    let points: LinePoint[] = [];
    let dragging = false;
    let dragMoved = false;
    let downPoint: LinePoint | null = null;

    const redrawPreview = (extra?: LinePoint): void => {
      const preview = extra ? [...points, extra] : points;
      previewPath.setAttribute('d', LinePathGenerator.buildPathD(preview, DEFAULT_META.smooth));
      dotsGroup.innerHTML = points
        .map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#fff" stroke="${DEFAULT_META.strokeColor}" stroke-width="2"/>`)
        .join('');
    };

    const cleanup = (): void => {
      page._ctLineDrawing = false;
      overlay.remove();
      hint.remove();
      document.removeEventListener('keydown', onKeydown, true);
      page.removeEventListener('pointerdown', onPointerDown);
      page.removeEventListener('pointermove', onPointerMove);
      page.removeEventListener('pointerup', onPointerUp);
      page.removeEventListener('dblclick', onDblClick);
    };

    const finish = (cancelled: boolean): void => {
      cleanup();
      if (cancelled || points.length < 2) return;
      const el = LineTool.createElement('line', editor, { points: points.map(p => ({ ...p })) }) as LineElement;
      page.appendChild(el);
      requestAnimationFrame(() => { setTimeout(() => el.select?.(), 20); });
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      // Ignore presses on the overlay's own dots/handles-in-progress area
      // only matters once we have UI there -- currently pointer-events:none
      // on the overlay itself already routes everything to `page`.
      e.preventDefault();
      downPoint = toLocal(e.clientX, e.clientY);
      dragMoved = false;
      dragging = true;
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (!dragging || !downPoint) {
        if (points.length) redrawPreview(toLocal(e.clientX, e.clientY));
        return;
      }
      const cur = toLocal(e.clientX, e.clientY);
      const dx = cur.x - downPoint.x, dy = cur.y - downPoint.y;
      if (!dragMoved && Math.sqrt(dx * dx + dy * dy) > 4 / scale()) {
        dragMoved = true;
        points.push(downPoint);
      }
      if (dragMoved) {
        points.push(cur);
        redrawPreview();
      }
    };

    const onPointerUp = (): void => {
      if (!dragging) return;
      dragging = false;
      if (!downPoint) return;
      if (dragMoved) {
        points = LinePathGenerator.simplifyPoints(points, 6 / scale());
        finish(false);
        return;
      }
      points.push(downPoint);
      redrawPreview();
      downPoint = null;
    };

    const onDblClick = (e: MouseEvent): void => {
      e.preventDefault();
      finish(false);
    };

    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); finish(true); }
      else if (e.key === 'Enter') { e.preventDefault(); finish(false); }
    };

    page.addEventListener('pointerdown', onPointerDown);
    page.addEventListener('pointermove', onPointerMove);
    page.addEventListener('pointerup', onPointerUp);
    page.addEventListener('dblclick', onDblClick);
    document.addEventListener('keydown', onKeydown, true);
  }
}

// ── Vertex handles lifecycle: show on select, hide on deselect ─────────────────
// Self-registered here (module-level, runs once on import) rather than a
// special case inside Editor.ts's central 'craftools-element-select'
// dispatch, the same "each tool wires its own extra interactions" pattern
// TableTool.ts's column-resize handles and ImageTransform.ts's crop/pan
// setup already use -- see this file's own header comment.
document.addEventListener('craftools-element-select', (e: Event) => {
  const el = (e as CustomEvent<{ element: HTMLElement }>).detail?.element;
  if (el?.getAttribute('data-craftool') === 'line') LineTool._renderPointHandles(el);
});
document.addEventListener('craftools-element-deselect', (e: Event) => {
  const el = (e as CustomEvent<{ element: HTMLElement }>).detail?.element;
  if (el?.getAttribute('data-craftool') !== 'line') return;
  el.querySelectorAll('.ct-line-point-handles').forEach(n => n.remove());
});

// ── Registration ─────────────────────────────────────────────────────────────

ToolRegistry.register({
  key: 'line',
  label: 'lineTool.panelTitle',
  icon: 'polyline',
  tool: LineTool,
  draggable: false,
  showInFooterNav: false,
});
