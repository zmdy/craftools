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

const SNAP_THRESHOLD = 8;  // screen pixels within which a snap activates
const GUIDE_COLOR    = 'rgba(249,115,22,0.9)';
const OVERLAY_ID     = 'ct-snap-overlay';
const MM_PX          = 3.7795275591; // CSS pixels per mm at 96dpi

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
    static snap(element) {
        const page = element.closest('.craftools-page');
        if (!page) return;

        if (window.craftoolsSnapGuides === false) {
            this._clearOverlay(page);
            return;
        }

        const scale    = this._getScale(element);
        const elRect   = element.getBoundingClientRect();
        const pageRect = page.getBoundingClientRect();

        // ── Collect snap targets in screen space ──────────────────────────
        const xTargets = [
            pageRect.left,
            pageRect.right,
            (pageRect.left + pageRect.right) / 2,
        ];
        const yTargets = [
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

        // ── Find best X snap ───────────────────────────────────────────────
        // Check left edge, center, and right edge of the dragged element
        const eCX = (elRect.left + elRect.right)  / 2;
        const eCY = (elRect.top  + elRect.bottom) / 2;

        let bestXDelta = null, bestXDist = SNAP_THRESHOLD + 1, bestXPct = null;
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

        // ── Find best Y snap ───────────────────────────────────────────────
        let bestYDelta = null, bestYDist = SNAP_THRESHOLD + 1, bestYPct = null;
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

        // ── Apply snap corrections to element.px / py ─────────────────────
        const guides = [];

        if (bestXDelta !== null) {
            const scX = element.unitX === 'mm' ? scale * MM_PX : scale;
            element.px += bestXDelta / scX;
            guides.push({ type: 'v', pct: bestXPct });
        }
        if (bestYDelta !== null) {
            const scY = element.unitY === 'mm' ? scale * MM_PX : scale;
            element.py += bestYDelta / scY;
            guides.push({ type: 'h', pct: bestYPct });
        }

        this._updateOverlay(page, guides);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Alignment — called by alignment buttons in the properties panel
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Aligns the element to the page.
     * direction: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom'
     */
    static align(element, direction) {
        const page = element.closest('.craftools-page');
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
        let targetX = null, targetY = null;
        switch (direction) {
            case 'left':     targetX = 0;                break;
            case 'center-h': targetX = (pageW - elW) / 2; break;
            case 'right':    targetX = pageW - elW;     break;
            case 'top':      targetY = 0;                break;
            case 'center-v': targetY = (pageH - elH) / 2; break;
            case 'bottom':   targetY = pageH - elH;     break;
        }

        // Convert back to element units and apply
        if (targetX !== null) element.px = targetX / (element.unitX === 'mm' ? MM_PX : 1);
        if (targetY !== null) element.py = targetY / (element.unitY === 'mm' ? MM_PX : 1);

        element._applyTransform();
        element.dispatchEvent(
            new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } })
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Guide overlay management
    // ─────────────────────────────────────────────────────────────────────────

    /** Remove guide lines from a specific page. Call on pointerup. */
    static clear(page) {
        if (!page) return;
        this._clearOverlay(page);
    }

    /** Remove guide lines from all pages (safety cleanup). */
    static clearAll() {
        document.querySelectorAll('#' + OVERLAY_ID).forEach(el => el.remove());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    static _getScale(element) {
        return element._getScale?.() ?? (window.craftoolsZoomLevel || 1);
    }

    static _clearOverlay(page) {
        const existing = page.querySelector('#' + OVERLAY_ID);
        if (existing) existing.innerHTML = '';
    }

    static _updateOverlay(page, guides) {
        let overlay = page.querySelector('#' + OVERLAY_ID);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = OVERLAY_ID;
            // overflow:visible so guides extend slightly beyond page edges
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
                // Vertical guide line: extends slightly above/below the page
                return `<div style="
                    position:absolute;
                    top:-16px; bottom:-16px;
                    left:${g.pct}%;
                    width:1px;
                    background:${GUIDE_COLOR};
                    transform:translateX(-0.5px);
                "></div>`;
            } else {
                // Horizontal guide line: extends slightly left/right of the page
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
