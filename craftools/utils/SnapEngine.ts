/**
 * SnapEngine — Smart snap guides and alignment for craftools-element.
 *
 * Snap:
 *   Called during drag (pointermove). Checks if any edge or center of the
 *   dragged element is close to: page edges, page center, or any sibling
 *   element's edges/center. If within THRESHOLD screen pixels, nudges the
 *   element position (px/py) to the exact snap position and shows a guide line.
 *
 * Alignment:
 *   Called from alignment buttons. Computes target px/py in element units
 *   based on page dimensions and element size, then applies and dispatches
 *   craftools-element-change.
 *
 * Guide overlay:
 *   A single <div id="ct-snap-overlay"> inside .craftools-page, containing
 *   thin lines positioned as percentages of the page — so they scale correctly
 *   with any zoom level without extra math.
 */

const SNAP_THRESHOLD = 4;  // screen pixels within which a snap activates
const GUIDE_COLOR    = 'rgba(249,115,22,0.9)';
const OVERLAY_ID     = 'ct-snap-overlay';
const MM_PX          = 3.7795275591; // CSS pixels per mm at 96dpi
// Same floor Element.ts's own resize handler already clamps pw/ph to
// (Math.max(2, ...)) -- a resize snap must never shrink an element below
// it, even when the closest target would otherwise put it there.
const MIN_SIZE        = 2;

/**
 * Minimal shape of a `craftools-element` custom element as seen by SnapEngine.
 * The full implementation lives in Element.ts (Craftools_Element implements this).
 * Exported so callers can cast when passing HTMLElement refs from untyped DOM.
 */
export interface CraftoolsSnapTarget extends HTMLElement {
  /** Position in element units (x axis). */
  px: number;
  /** Position in element units (y axis). */
  py: number;
  /** Width in element units. */
  pw: number;
  /** Height in element units. */
  ph: number;
  /** CSS unit for x position ('px' | 'mm'). */
  unitX: string;
  /** CSS unit for y position ('px' | 'mm'). */
  unitY: string;
  /** CSS unit for width ('px' | 'mm'). */
  unitW: string;
  /** CSS unit for height ('px' | 'mm'). */
  unitH: string;
  /** Returns the current zoom scale (1.0 = 100%). */
  _getScale?(): number;
  /** Applies current px/py/pw/ph to the element's DOM transform. */
  _applyTransform(): void;
}

/** Direction literal for SnapEngine.align(). */
export type AlignDirection =
  | 'left' | 'center-h' | 'right'
  | 'top'  | 'center-v' | 'bottom';

interface SnapGuide {
  type: 'v' | 'h';
  pct: number;
}

declare global {
  interface Window {
    craftoolsSnapGuides?: boolean;
    craftoolsZoomLevel?: number;
  }
}

export class SnapEngine {

  // ─────────────────────────────────────────────────────────────────────────
  // Live snap — called every pointermove while dragging
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Adjusts element.px / element.py to the nearest snap position (if any)
   * and updates the guide line overlay.
   *
   * IMPORTANT: call this AFTER _applyTransform() so getBoundingClientRect()
   * reflects the element's current drag position. Caller must call
   * _applyTransform() again afterwards to apply any snap correction.
   *
   * Disabled when window.craftoolsSnapGuides === false.
   */
  static snap(element: CraftoolsSnapTarget): void {
    const page = element.closest<HTMLElement>('.craftools-page');
    if (!page) return;

    if (window.craftoolsSnapGuides === false) {
      this._clearOverlay(page);
      return;
    }

    const scale    = this._getScale(element);
    const elRect   = element.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();

    // ── Collect snap targets in screen space ──────────────────────────────
    const { xTargets, yTargets } = this._gatherTargets(element, page, pageRect);

    // ── Find best X snap ─────────────────────────────────────────────────
    const eCX = (elRect.left + elRect.right)  / 2;
    const eCY = (elRect.top  + elRect.bottom) / 2;

    let bestXDelta: number | null = null;
    let bestXDist  = SNAP_THRESHOLD + 1;
    let bestXPct: number | null = null;

    for (const edgePos of [elRect.left, eCX, elRect.right]) {
      for (const tgt of xTargets) {
        const d = Math.abs(edgePos - tgt);
        if (d <= SNAP_THRESHOLD && d < bestXDist) {
          bestXDist  = d;
          bestXDelta = tgt - edgePos;
          bestXPct   = (tgt - pageRect.left) / pageRect.width * 100;
        }
      }
    }

    // ── Find best Y snap ─────────────────────────────────────────────────
    let bestYDelta: number | null = null;
    let bestYDist  = SNAP_THRESHOLD + 1;
    let bestYPct: number | null = null;

    for (const edgePos of [elRect.top, eCY, elRect.bottom]) {
      for (const tgt of yTargets) {
        const d = Math.abs(edgePos - tgt);
        if (d <= SNAP_THRESHOLD && d < bestYDist) {
          bestYDist  = d;
          bestYDelta = tgt - edgePos;
          bestYPct   = (tgt - pageRect.top) / pageRect.height * 100;
        }
      }
    }

    // ── Apply snap corrections to element.px / py ─────────────────────────
    const guides: SnapGuide[] = [];

    if (bestXDelta !== null && bestXPct !== null) {
      const scX = element.unitX === 'mm' ? scale * MM_PX : scale;
      element.px += bestXDelta / scX;
      guides.push({ type: 'v', pct: bestXPct });
    }
    if (bestYDelta !== null && bestYPct !== null) {
      const scY = element.unitY === 'mm' ? scale * MM_PX : scale;
      element.py += bestYDelta / scY;
      guides.push({ type: 'h', pct: bestYPct });
    }

    this._updateOverlay(page, guides);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Live snap — called every pointermove while resizing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Adjusts element.pw/ph (and px/py, for handles that move the top/left
   * edge) to the nearest snap position, and updates the guide line overlay
   * -- the resize counterpart to snap() above.
   *
   * Unlike snap() (whole element moves, so its left/center/right AND
   * top/center/bottom are all candidate positions), a resize handle only
   * ever drags ONE edge per axis -- the opposite edge stays anchored in
   * place -- so only that single edge's position is tested against the
   * same target list (page edges/center + sibling elements' edges/center).
   * `dir` is the handle's own `data-dir` ('l'/'r'/'t'/'b'/'tl'/'tr'/'bl'/'br',
   * see Element.ts's resize handles), which determines which edge(s) are
   * actively moving on each axis.
   *
   * IMPORTANT: same calling convention as snap() -- call AFTER
   * _applyTransform() so getBoundingClientRect() reflects the element's
   * current proposed size, and call _applyTransform() again afterwards to
   * apply any snap correction.
   *
   * Disabled when window.craftoolsSnapGuides === false.
   */
  static snapResize(element: CraftoolsSnapTarget, dir: string): void {
    const page = element.closest<HTMLElement>('.craftools-page');
    if (!page) return;

    if (window.craftoolsSnapGuides === false) {
      this._clearOverlay(page);
      return;
    }

    const scale    = this._getScale(element);
    const elRect   = element.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();

    const { xTargets, yTargets } = this._gatherTargets(element, page, pageRect);

    // Which single edge is actively being dragged on each axis, per handle
    // -- mirrors exactly which px/py/pw/ph fields Element.ts's own resize
    // handler already writes for each `dir` value.
    const xEdge: 'left' | 'right' | null =
      dir === 'l' || dir === 'tl' || dir === 'bl' ? 'left' :
      dir === 'r' || dir === 'tr' || dir === 'br' ? 'right' : null;
    const yEdge: 'top' | 'bottom' | null =
      dir === 't' || dir === 'tl' || dir === 'tr' ? 'top' :
      dir === 'b' || dir === 'bl' || dir === 'br' ? 'bottom' : null;

    const guides: SnapGuide[] = [];

    if (xEdge) {
      const edgePos = xEdge === 'left' ? elRect.left : elRect.right;
      const tgt     = this._bestSnapTarget(edgePos, xTargets);
      if (tgt !== null) {
        // Same scale convention Element.ts's own resize handler already
        // uses for this axis (derived from unitW, applied to both px and
        // pw -- see its 'l'/'tl'/'bl' branch).
        const scX        = element.unitW === 'mm' ? scale * MM_PX : scale;
        const deltaUnits = (tgt - edgePos) / scX;
        const newPw      = xEdge === 'left' ? element.pw - deltaUnits : element.pw + deltaUnits;
        if (newPw >= MIN_SIZE) {
          if (xEdge === 'left') element.px += deltaUnits;
          element.pw = newPw;
          guides.push({ type: 'v', pct: (tgt - pageRect.left) / pageRect.width * 100 });
        }
      }
    }

    if (yEdge) {
      const edgePos = yEdge === 'top' ? elRect.top : elRect.bottom;
      const tgt     = this._bestSnapTarget(edgePos, yTargets);
      if (tgt !== null) {
        const scY        = element.unitH === 'mm' ? scale * MM_PX : scale;
        const deltaUnits = (tgt - edgePos) / scY;
        const newPh      = yEdge === 'top' ? element.ph - deltaUnits : element.ph + deltaUnits;
        if (newPh >= MIN_SIZE) {
          if (yEdge === 'top') element.py += deltaUnits;
          element.ph = newPh;
          guides.push({ type: 'h', pct: (tgt - pageRect.top) / pageRect.height * 100 });
        }
      }
    }

    this._updateOverlay(page, guides);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Alignment — called by alignment buttons in the properties panel
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Aligns the element to the page.
   * @param element   - The craftools element to align.
   * @param direction - One of the AlignDirection literals.
   */
  static align(element: CraftoolsSnapTarget, direction: AlignDirection | string): void {
    const page = element.closest<HTMLElement>('.craftools-page');
    if (!page) return;

    const scale = this._getScale(element);

    // Page dimensions in virtual-px (page coordinate space at 1× zoom)
    const pageRect = page.getBoundingClientRect();
    const pageW = pageRect.width  / scale;
    const pageH = pageRect.height / scale;

    // Element dimensions in virtual-px
    const elW = element.pw * (element.unitW === 'mm' ? MM_PX : 1);
    const elH = element.ph * (element.unitH === 'mm' ? MM_PX : 1);

    // Target virtual-px position
    let targetX: number | null = null;
    let targetY: number | null = null;

    switch (direction) {
      case 'left':     targetX = 0;                  break;
      case 'center-h': targetX = (pageW - elW) / 2;  break;
      case 'right':    targetX = pageW - elW;         break;
      case 'top':      targetY = 0;                   break;
      case 'center-v': targetY = (pageH - elH) / 2;  break;
      case 'bottom':   targetY = pageH - elH;         break;
    }

    // Convert back to element units and apply
    if (targetX !== null) element.px = targetX / (element.unitX === 'mm' ? MM_PX : 1);
    if (targetY !== null) element.py = targetY / (element.unitY === 'mm' ? MM_PX : 1);

    element._applyTransform();
    element.dispatchEvent(
      new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Size bounds
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns the largest width/height (in whichever CSS unit the caller
   * passes, matching a craftools-element's own `unitW`/`unitH`) an element
   * could legally have without overflowing its page -- the page's own
   * rendered size, converted out of zoomed screen pixels into the page's
   * virtual-px coordinate space (the same conversion align()/snap() already
   * do), then into the requested unit.
   *
   * Used by Element.ts's resize-handle drag (so manual resize can't drag a
   * box past the page edge) and AutoFitText.ts's auto-fit growth (so a text
   * box growing to fit typed content can't grow past the page either, which
   * is the more common way an element ends up oversized -- pasting or
   * typing a lot of text with auto-fit on).
   *
   * Returns `{ maxW: Infinity, maxH: Infinity }` (no clamp) when `element`
   * isn't currently inside a `.craftools-page` -- e.g. not yet attached to
   * the canvas, or used in a context with no page at all.
   */
  static getMaxSize(
    element: HTMLElement & { _getScale?(): number },
    unitW: string,
    unitH: string,
  ): { maxW: number; maxH: number } {
    const page = element.closest<HTMLElement>('.craftools-page');
    if (!page) return { maxW: Infinity, maxH: Infinity };

    const scale = element._getScale?.() ?? (window.craftoolsZoomLevel ?? 1);
    const pageRect = page.getBoundingClientRect();
    // Virtual-px (page coordinate space at 1x zoom) -- same as align()'s pageW/pageH.
    const pageW = pageRect.width  / scale;
    const pageH = pageRect.height / scale;

    return {
      maxW: unitW === 'mm' ? pageW / MM_PX : pageW,
      maxH: unitH === 'mm' ? pageH / MM_PX : pageH,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Guide overlay management
  // ─────────────────────────────────────────────────────────────────────────

  /** Removes guide lines from a specific page. Call on pointerup. */
  static clear(page: HTMLElement | null): void {
    if (!page) return;
    this._clearOverlay(page);
  }

  /** Removes guide lines from all pages (safety cleanup). */
  static clearAll(): void {
    document.querySelectorAll('#' + OVERLAY_ID).forEach(el => el.remove());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Screen-space snap candidates shared by snap() and snapResize(): the
   * page's own left/right/h-center + top/bottom/v-center, plus every
   * sibling `<craftools-element>`'s edges/center (the dragged/resized
   * element itself excluded).
   */
  private static _gatherTargets(
    element: CraftoolsSnapTarget,
    page: HTMLElement,
    pageRect: DOMRect,
  ): { xTargets: number[]; yTargets: number[] } {
    const xTargets: number[] = [
      pageRect.left,
      pageRect.right,
      (pageRect.left + pageRect.right) / 2,
    ];
    const yTargets: number[] = [
      pageRect.top,
      pageRect.bottom,
      (pageRect.top + pageRect.bottom) / 2,
    ];

    page.querySelectorAll('craftools-element').forEach(sib => {
      if (sib === element) return;
      const r = sib.getBoundingClientRect();
      xTargets.push(r.left, r.right, (r.left + r.right) / 2);
      yTargets.push(r.top,  r.bottom, (r.top  + r.bottom) / 2);
    });

    return { xTargets, yTargets };
  }

  /** Closest target to `pos` within SNAP_THRESHOLD screen px, or null if none qualify. */
  private static _bestSnapTarget(pos: number, targets: number[]): number | null {
    let best: number | null = null;
    let bestDist = SNAP_THRESHOLD + 1;
    for (const tgt of targets) {
      const d = Math.abs(pos - tgt);
      if (d <= SNAP_THRESHOLD && d < bestDist) {
        bestDist = d;
        best     = tgt;
      }
    }
    return best;
  }

  private static _getScale(element: CraftoolsSnapTarget): number {
    return element._getScale?.() ?? (window.craftoolsZoomLevel ?? 1);
  }

  private static _clearOverlay(page: HTMLElement): void {
    const existing = page.querySelector<HTMLElement>('#' + OVERLAY_ID);
    if (existing) existing.innerHTML = '';
  }

  private static _updateOverlay(page: HTMLElement, guides: SnapGuide[]): void {
    let overlay = page.querySelector<HTMLElement>('#' + OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.style.cssText = [
        'position:absolute',
        'inset:0',
        'pointer-events:none',
        'z-index:998',
        'overflow:visible',
      ].join(';');
      page.appendChild(overlay);
    }

    if (guides.length === 0) {
      overlay.innerHTML = '';
      return;
    }

    overlay.innerHTML = guides.map(g => {
      if (g.type === 'v') {
        return `<div style="
          position:absolute;
          top:-16px; bottom:-16px;
          left:${g.pct}%;
          width:1px;
          background:${GUIDE_COLOR};
          transform:translateX(-0.5px);
        "></div>`;
      } else {
        return `<div style="
          position:absolute;
          left:-16px; right:-16px;
          top:${g.pct}%;
          height:1px;
          background:${GUIDE_COLOR};
          transform:translateY(-0.5px);
        "></div>`;
      }
    }).join('');
  }
}
