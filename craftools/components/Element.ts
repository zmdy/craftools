/**
 * Element.ts — Custom Element `<craftools-element>` for the CrafTools canvas.
 *
 * Handles drag, resize, rotate, select/deselect, linked-element sync and
 * snap-guide integration. Registered via `Craftools_Element.init()`.
 *
 * Migration note:
 *   Element.js is still loaded by MODULE_MAP consumers that import via explicit
 *   '.js' extension at runtime. This .ts file shadows it for TypeScript callers
 *   using bare specifiers and satisfies the CraftoolsSnapTarget interface so
 *   `SnapEngine.snap(this)` / `SnapEngine.align(el, dir)` accept `this` directly.
 */

import { SnapEngine, type CraftoolsSnapTarget } from '../utils/SnapEngine.js';
import { AutoFitText } from '../utils/AutoFitText.js';

const MM_PX = 3.7795275591; // CSS pixels per mm at 96 dpi

/** Default rotate-handle snap increment, in degrees (see _handleMove()'s isRotating branch). */
const ROTATE_SNAP_DEG = 5;

declare global {
  interface Window {
    /** Set false to disable auto-snap-to-grid-cell on drag-end. */
    craftoolsAutoSnap?: boolean;
    /** Alignment preset for auto-snap: e.g. 'bottom-center' (default). */
    craftoolsAutoSnapAlign?: string;
  }
  interface HTMLElementTagNameMap {
    'craftools-element': Craftools_Element;
  }
}

export class Craftools_Element extends HTMLElement implements CraftoolsSnapTarget {

  // ── Position / size / rotation (element units) ────────────────────────────
  px = 0;
  py = 0;
  pw = 120;
  ph = 50;
  pr = 0;

  // ── CSS units — set in connectedCallback before first use ─────────────────
  unitX!: string;
  unitY!: string;
  unitW!: string;
  unitH!: string;

  // ── Drag / resize / rotate transient state ────────────────────────────────
  isDragging  = false;
  isResizing  = false;
  isRotating  = false;
  resizeDir   = '';
  startX      = 0;
  startY      = 0;
  origW       = 0;
  origH       = 0;
  origX       = 0;
  origY       = 0;

  // ── DOM sub-elements (assigned in _build, always before first use) ─────────
  private _content!: HTMLElement;
  private _overlay!: HTMLElement;
  private _ctrlbar!: HTMLElement;

  private _built = false;
  private _outsideHandler: ((e: PointerEvent) => void) | null = null;

  /** Bound so they can be added and removed as named listeners. */
  private readonly _onMove: (e: PointerEvent) => void;
  private readonly _onUp:   (e: PointerEvent) => void;

  constructor() {
    super();
    this._onMove = this._handleMove.bind(this);
    this._onUp   = this._handleUp.bind(this);
  }

  connectedCallback(): void {
    if (this._built) return;
    this._built = true;

    const rawX = this.getAttribute('x') || '50';
    const rawY = this.getAttribute('y') || '50';
    const rawW = this.getAttribute('w') || '200';
    const rawH = this.getAttribute('h') || '80';

    this.unitX = rawX.replace(/[0-9.-]/g, '') || 'px';
    this.unitY = rawY.replace(/[0-9.-]/g, '') || 'px';
    this.unitW = rawW.replace(/[0-9.-]/g, '') || 'px';
    this.unitH = rawH.replace(/[0-9.-]/g, '') || 'px';

    this.px = parseFloat(rawX);
    this.py = parseFloat(rawY);
    this.pw = parseFloat(rawW);
    this.ph = parseFloat(rawH);
    this.pr = parseFloat(this.getAttribute('r') ?? '') || 0;

    this._build();
    this._applyTransform();
    this._bindEvents();
  }

  private _build(): void {
    const existingCtrlbar = this.querySelector('.craftools-ctrlbar');
    if (existingCtrlbar) {
      // It's a clone — just map the references.
      this._content = this.children[0] as HTMLElement;
      this._overlay = this.children[1] as HTMLElement;
      this._ctrlbar = this.children[2] as HTMLElement;
      return;
    }

    // Collect existing children before restructuring
    const children: Node[] = [];
    while (this.firstChild) children.push(this.removeChild(this.firstChild));

    this.style.cssText = 'display:block;position:absolute;top:0;left:0;user-select:none;touch-action:none;z-index:2;cursor:move;';

    // Content area
    this._content = document.createElement('div');
    this._content.style.cssText = 'position:absolute;inset:0;overflow:visible;pointer-events:none;';
    children.forEach(c => this._content.appendChild(c));

    // Drag overlay
    this._overlay = document.createElement('div');
    this._overlay.style.cssText = 'position:absolute;inset:0;z-index:5;cursor:move;';

    // Control bar (selection border + handles)
    this._ctrlbar = document.createElement('div');
    this._ctrlbar.className = 'craftools-ctrlbar';
    this._ctrlbar.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none;z-index:10;';

    const accentCol = 'var(--accent, #f97316)';
    // The rotate handle's icon used to be the Material Symbols 'sync'
    // glyph -- centered by the flex box around it, but the glyph's own ink
    // within its font-reported em-square isn't visually symmetric, so it
    // still looked slightly off-center inside the circle regardless of how
    // the surrounding flex centering was tuned. Swapped for a hand-drawn
    // inline SVG (a standard "refresh" arc, same family as Lucide's
    // refresh-cw) instead of a font glyph -- its geometry is exact, so
    // centering it via flex is now pixel-precise rather than dependent on
    // font metrics that vary by platform/browser.
    this._ctrlbar.innerHTML = `
      <div style="position:absolute;inset:-2px;border:2px solid ${accentCol};border-radius:3px;pointer-events:none;"></div>
      <div class="rsz-handle" data-dir="tl" style="position:absolute;top:-7px;left:-7px;width:14px;height:14px;background:#fff;border:2px solid ${accentCol};border-radius:50%;pointer-events:auto;cursor:nwse-resize;z-index:15;box-shadow:0 1px 3px rgba(0,0,0,.2);"></div>
      <div class="rsz-handle" data-dir="tr" style="position:absolute;top:-7px;right:-7px;width:14px;height:14px;background:#fff;border:2px solid ${accentCol};border-radius:50%;pointer-events:auto;cursor:nesw-resize;z-index:15;box-shadow:0 1px 3px rgba(0,0,0,.2);"></div>
      <div class="rsz-handle" data-dir="bl" style="position:absolute;bottom:-7px;left:-7px;width:14px;height:14px;background:#fff;border:2px solid ${accentCol};border-radius:50%;pointer-events:auto;cursor:nesw-resize;z-index:15;box-shadow:0 1px 3px rgba(0,0,0,.2);"></div>
      <div class="rsz-handle" data-dir="br" style="position:absolute;bottom:-7px;right:-7px;width:14px;height:14px;background:#fff;border:2px solid ${accentCol};border-radius:50%;pointer-events:auto;cursor:nwse-resize;z-index:15;box-shadow:0 1px 3px rgba(0,0,0,.2);"></div>
      <div class="rsz-handle" data-dir="t"  style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:24px;height:12px;background:#fff;border:2px solid ${accentCol};border-radius:6px;pointer-events:auto;cursor:n-resize;z-index:15;box-shadow:0 1px 3px rgba(0,0,0,.2);"></div>
      <div class="rsz-handle" data-dir="b"  style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:24px;height:12px;background:#fff;border:2px solid ${accentCol};border-radius:6px;pointer-events:auto;cursor:s-resize;z-index:15;box-shadow:0 1px 3px rgba(0,0,0,.2);"></div>
      <div class="rsz-handle" data-dir="l"  style="position:absolute;left:-6px;top:50%;transform:translateY(-50%);width:12px;height:24px;background:#fff;border:2px solid ${accentCol};border-radius:6px;pointer-events:auto;cursor:w-resize;z-index:15;box-shadow:0 1px 3px rgba(0,0,0,.2);"></div>
      <div class="rsz-handle" data-dir="r"  style="position:absolute;right:-6px;top:50%;transform:translateY(-50%);width:12px;height:24px;background:#fff;border:2px solid ${accentCol};border-radius:6px;pointer-events:auto;cursor:e-resize;z-index:15;box-shadow:0 1px 3px rgba(0,0,0,.2);"></div>
      <div class="rot-handle" style="position:absolute;top:-38px;left:50%;transform:translateX(-50%);width:26px;height:26px;padding:0;background:#fff;border:2px solid ${accentCol};border-radius:50%;pointer-events:auto;cursor:crosshair;z-index:15;text-align:center;line-height:26px;box-shadow:0 2px 6px rgba(0,0,0,.15);">
        <span class="material-symbols-outlined" style="font-size:15px;line-height:26px;color:${accentCol};pointer-events:none;">sync</span>
      </div>
      <button class="del-handle" style="position:absolute;top:-12px;right:-12px;width:24px;height:24px;padding:0;margin:0;font:inherit;background:#ef4444;color:#fff;border:none;border-radius:50%;pointer-events:auto;cursor:pointer;z-index:15;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(239,68,68,.4);">
        <span class="material-symbols-outlined" style="font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;">close</span>
      </button>
    `;

    this.appendChild(this._content);
    this.appendChild(this._overlay);
    this.appendChild(this._ctrlbar);
  }

  get contentArea(): HTMLElement {
    return this._content;
  }

  // ── CraftoolsSnapTarget contract ─────────────────────────────────────────────

  _applyTransform(): void {
    this.style.transform = `translate(${this.px}${this.unitX}, ${this.py}${this.unitY}) rotate(${this.pr}deg)`;
    this.style.width     = `${this.pw}${this.unitW}`;
    this.style.height    = `${this.ph}${this.unitH}`;
  }

  _getScale(): number {
    const zoomLabel = document.getElementById('zoom-level');
    if (zoomLabel) {
      const perc = parseInt(zoomLabel.textContent ?? '', 10);
      if (!isNaN(perc)) return perc / 100;
    }
    return 1;
  }

  // ── Event wiring ──────────────────────────────────────────────────────────────

  private _bindEvents(): void {
    // Drag start (overlay captures pointer so siblings don't receive events)
    this._overlay.addEventListener('pointerdown', (e: PointerEvent) => {
      e.stopPropagation();
      this.select();

      const isLocked = this.getAttribute('data-locked') === 'true';
      if (!isLocked) {
        this.isDragging = true;
        this.startX     = e.clientX;
        this.startY     = e.clientY;
        this._overlay.setPointerCapture(e.pointerId);
        document.addEventListener('pointermove', this._onMove, { passive: false });
        document.addEventListener('pointerup',   this._onUp,   { once: true });
      }
    });

    // Double-click enters inline edit mode
    this._overlay.addEventListener('dblclick', (e: MouseEvent) => {
      e.stopPropagation();
      this._enterEdit();
    });

    // Resize handles
    this._ctrlbar.querySelectorAll<HTMLElement>('.rsz-handle').forEach(h => {
      h.addEventListener('pointerdown', (e: PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        this.isResizing = true;
        this.resizeDir  = h.dataset.dir ?? '';
        this.startX     = e.clientX;
        this.startY     = e.clientY;
        this.origW      = this.pw;
        this.origH      = this.ph;
        this.origX      = this.px;
        this.origY      = this.py;
        h.setPointerCapture(e.pointerId);
        document.addEventListener('pointermove', this._onMove, { passive: false });
        document.addEventListener('pointerup',   this._onUp,   { once: true });
      });
    });

    // Rotate handle
    this._ctrlbar.querySelector('.rot-handle')?.addEventListener('pointerdown', (e: Event) => {
      e.stopPropagation();
      (e as PointerEvent).preventDefault();
      this.isRotating = true;
      (e.target as Element).setPointerCapture((e as PointerEvent).pointerId);
      document.addEventListener('pointermove', this._onMove, { passive: false });
      document.addEventListener('pointerup',   this._onUp,   { once: true });
    });

    // Delete handle
    this._ctrlbar.querySelector('.del-handle')?.addEventListener('click', (e: Event) => {
      e.stopPropagation();

      // "Linked" elements (cloned into all cells in Business Card mode — see
      // PageTool.js) share the same data-linked-id. Deleting one must delete
      // all clones, otherwise they become ghost elements in other cells.
      const lid = this.getAttribute('data-linked-id');
      const toRemove: Craftools_Element[] = lid
        ? [...document.querySelectorAll<Craftools_Element>(`craftools-element[data-linked-id="${lid}"]`)]
        : [this];

      toRemove.forEach(el => {
        el.dispatchEvent(new CustomEvent('craftools-element-delete', { bubbles: true, detail: { element: el } }));
        el.deselect();
        el.remove();
      });
    });
  }

  // ── Inline edit mode ──────────────────────────────────────────────────────────

  private _enterEdit(): void {
    this._overlay.style.pointerEvents = 'none';
    this._content.style.pointerEvents = 'auto';

    const editable = this._content.querySelector<HTMLElement>('[contenteditable]');
    if (editable) {
      editable.style.pointerEvents = 'auto';
      editable.focus();

      // Sync editable content across linked clones while typing
      const syncText = () => {
        const lid = this.getAttribute('data-linked-id');
        if (lid) {
          const html = editable.innerHTML;
          document.querySelectorAll<Craftools_Element>(`craftools-element[data-linked-id="${lid}"]`).forEach(clone => {
            if (clone !== this) {
              const cEdit = clone.contentArea?.querySelector<HTMLElement>('[contenteditable]');
              if (cEdit && cEdit.innerHTML !== html) cEdit.innerHTML = html;
            }
          });
        }
      };
      editable.addEventListener('input', syncText);
      editable.addEventListener('blur', () => editable.removeEventListener('input', syncText), { once: true });

      // Keep the box tracking the content live while typing, same as
      // TextTool.ts's own panel-driven fields already do for auto-fit
      // (font/size/etc.) -- previously nothing re-measured on typed input,
      // so auto-fit only ever resized once, at the moment it was toggled
      // on, and typing more/less text afterward left the box exactly where
      // it was. AutoFitText.applyAutoSize() itself already guards on
      // `_craftoolsAutoResize === true`, so this is a safe no-op for every
      // element that doesn't have auto-fit on.
      const resizeToFit = () => AutoFitText.applyAutoSize(this, editable);
      editable.addEventListener('input', resizeToFit);
      editable.addEventListener('blur', () => editable.removeEventListener('input', resizeToFit), { once: true });

      // Place cursor at end
      try {
        const range = document.createRange();
        range.selectNodeContents(editable);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch (_) { /* ignore */ }
    } else if (this._content.querySelector('img')) {
      // Image elements (ImageTool.ts): double-click enters "adjust" mode.
      // ImageTransform.ts's wheel/pointerdown/pointermove pan+zoom+rotate
      // handlers all gate on `element._isImageActive` ("only allow if panel
      // is open" per its own comments) -- but nothing anywhere else in the
      // codebase ever sets that flag to true, so those handlers existed but
      // silently never fired for EITHER a standalone Image element or a
      // locked Album grid-cell image (AlbumWizard.ts's _buildCellElement()
      // builds cells via this exact same ImageTool.createElement() +
      // ImageTransform.setupInteractions() wiring, so both were equally
      // broken). Reset back to false by ImageTransform.ts's own
      // 'craftools-element-deselect' listener when the element is
      // deselected -- images have no natural focusout to hook, unlike text.
      (this as unknown as { _isImageActive?: boolean })._isImageActive = true;
    }

    const restore = (ev: FocusEvent) => {
      if (!this.contains(ev.relatedTarget as Node | null)) {
        this._overlay.style.pointerEvents = '';
        this._content.style.pointerEvents = 'none';
      }
    };
    this._content.addEventListener('focusout', restore, { once: true });
  }

  // ── Lock UI sync ──────────────────────────────────────────────────────────────

  /**
   * Applies data-locked state to the UI: hides resize/rotate/delete handles
   * and changes the overlay cursor. Called from select() and from
   * BaseTool._renderStyleBar() when the lock button is toggled.
   */
  _syncLockUI(): void {
    if (!this._ctrlbar) return;
    const isLocked = this.getAttribute('data-locked') === 'true';
    this._ctrlbar.querySelectorAll<HTMLElement>('.rsz-handle, .rot-handle, .del-handle').forEach(h => {
      h.style.display = isLocked ? 'none' : '';
    });
    if (this._overlay) this._overlay.style.cursor = isLocked ? 'default' : 'move';
  }

  // ── Select / Deselect ─────────────────────────────────────────────────────────

  select(): void {
    // Deselect all siblings on the same page first
    const page = this.closest('.craftools-page');
    if (page) {
      page.querySelectorAll<Craftools_Element>('craftools-element').forEach(d => {
        if (d !== this) d.deselect();
      });
    }

    this.classList.add('craftools-selected');
    const slot = this.closest('.photostrip-slot');
    if (slot) {
      slot.classList.add('craftools-slot-active');
    } else {
      const cell = this.closest('.craftools-grid-cell');
      if (cell) cell.classList.add('craftools-cell-active');
    }

    this._ctrlbar.style.display = 'block';
    this._syncLockUI();
    this.style.zIndex = '100';

    this.dispatchEvent(new CustomEvent('craftools-element-select', { bubbles: true, detail: { element: this } }));

    if (this._outsideHandler) return;
    this._outsideHandler = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (
        !this.contains(t) &&
        !t?.closest?.('.craftools-ctxbar') &&
        !t?.closest?.('.craftools-panel') &&
        !t?.closest?.('.footer-nav-area') &&
        !t?.closest?.('#mobile-mini-panel') &&
        !t?.closest?.('#mobile-mini-overlay') &&
        // Bottom-sheet property panels and API picker modal are "part of the UI",
        // not outside clicks — prevents mid-interaction deselect (font <select>
        // never opened, sliders lost drag tracking, etc).
        !t?.closest?.('#bottom-sheet') &&
        !t?.closest?.('#sheet-overlay') &&
        !t?.closest?.('#api-picker-backdrop')
      ) {
        this.deselect();
      }
    };
    // Defer one tick so this pointerdown doesn't immediately fire the handler
    setTimeout(() => {
      document.addEventListener('pointerdown', this._outsideHandler!, { capture: true });
    }, 0);
  }

  deselect(): void {
    this.classList.remove('craftools-selected');
    this._ctrlbar.style.display = 'none';
    this.style.zIndex = '2';

    const slot = this.closest('.photostrip-slot');
    if (slot) {
      slot.classList.remove('craftools-slot-active');
    } else {
      const cell = this.closest('.craftools-grid-cell');
      if (cell) cell.classList.remove('craftools-cell-active');
    }

    // Restore protective overlay so drag can start again on next select
    this._overlay.style.pointerEvents = '';
    this._content.style.pointerEvents = 'none';

    this.dispatchEvent(new CustomEvent('craftools-element-deselect', { bubbles: true, detail: { element: this } }));

    if (this._outsideHandler) {
      document.removeEventListener('pointerdown', this._outsideHandler, { capture: true });
      this._outsideHandler = null;
    }
  }

  // ── Pointer move / up ─────────────────────────────────────────────────────────

  private _handleMove(e: PointerEvent): void {
    if (!this.isDragging && !this.isResizing && !this.isRotating) return;
    e.preventDefault();

    const sc    = this._getScale();
    const oldPx = this.px;
    const oldPy = this.py;

    if (this.isDragging) {
      const scX = this.unitX === 'mm' ? sc * MM_PX : sc;
      const scY = this.unitY === 'mm' ? sc * MM_PX : sc;
      this.px += (e.clientX - this.startX) / scX;
      this.py += (e.clientY - this.startY) / scY;
      this.startX = e.clientX;
      this.startY = e.clientY;

      // Apply initial transform so getBoundingClientRect() is current
      // before SnapEngine reads screen position for snap calculation.
      this._applyTransform();
      SnapEngine.snap(this); // may nudge px/py; re-applies transform below

    } else if (this.isResizing) {
      const scX = this.unitW === 'mm' ? sc * MM_PX : sc;
      const scY = this.unitH === 'mm' ? sc * MM_PX : sc;

      const dx = (e.clientX - this.startX) / scX;
      const dy = (e.clientY - this.startY) / scY;
      const d  = this.resizeDir;

      if (d === 'r' || d === 'tr' || d === 'br') this.pw = Math.max(2, this.origW + dx);
      if (d === 'b' || d === 'bl' || d === 'br') this.ph = Math.max(2, this.origH + dy);
      if (d === 'l' || d === 'tl' || d === 'bl') {
        const nw = Math.max(2, this.origW - dx);
        this.pw = nw;
        this.px = this.origX + (this.origW - nw);
      }
      if (d === 't' || d === 'tl' || d === 'tr') {
        const nh = Math.max(2, this.origH - dy);
        this.ph = nh;
        this.py = this.origY + (this.origH - nh);
      }

    } else if (this.isRotating) {
      const r  = this.getBoundingClientRect();
      const cx = r.left + r.width  / 2;
      const cy = r.top  + r.height / 2;
      const raw = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) + 90;
      // Snap to 5° increments by default -- makes it easy to land on
      // common angles (0/45/90/...) without pixel-hunting the pointer.
      // Hold Shift for the previous unsnapped/free-angle behavior when
      // fine-grained control is actually wanted. Applies to every element
      // type uniformly, since all of them share this one drag handler.
      this.pr = e.shiftKey ? raw : Math.round(raw / ROTATE_SNAP_DEG) * ROTATE_SNAP_DEG;
    }

    this._applyTransform();

    // Sync linked clones (Business Card mode)
    const dx  = this.px - oldPx;
    const dy  = this.py - oldPy;
    const lid = this.getAttribute('data-linked-id');
    if (lid && (dx !== 0 || dy !== 0 || this.isResizing || this.isRotating)) {
      document.querySelectorAll<Craftools_Element>(`craftools-element[data-linked-id="${lid}"]`).forEach(clone => {
        if (clone !== this) {
          if (this.isDragging) {
            clone.px += dx;
            clone.py += dy;
          } else if (this.isResizing) {
            clone.px += dx;
            clone.py += dy;
            clone.pw  = this.pw;
            clone.ph  = this.ph;
          } else if (this.isRotating) {
            clone.pr = this.pr;
          }
          clone._applyTransform();
        }
      });
    }

    this.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element: this } }));
  }

  private _handleUp(e: PointerEvent): void {
    SnapEngine.clear(this.closest<HTMLElement>('.craftools-page'));

    if (
      this.isDragging &&
      window.craftoolsAutoSnap !== false &&
      this.getAttribute('data-locked') !== 'true'
    ) {
      // Temporarily hide to find the element underneath via elementsFromPoint
      this.style.visibility = 'hidden';
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      this.style.visibility = '';

      const cell = els.find(el => el.classList.contains('craftools-grid-cell')) as HTMLElement | undefined;
      if (cell) {
        const page = this.closest<HTMLElement>('.craftools-page');
        if (page) {
          const cRect  = cell.getBoundingClientRect();
          const pRect  = page.getBoundingClientRect();
          const scale  = this._getScale();
          const align  = window.craftoolsAutoSnapAlign ?? 'bottom-center';
          const offset = 5;
          const cLeft   = (cRect.left - pRect.left) / scale;
          const cTop    = (cRect.top  - pRect.top)  / scale;
          const cWidth  = cRect.width  / scale;
          const cHeight = cRect.height / scale;

          const oldPx = this.px;
          const oldPy = this.py;

          if      (align.includes('left'))   this.px = cLeft + offset;
          else if (align.includes('right'))  this.px = cLeft + cWidth  - this.pw - offset;
          else                               this.px = cLeft + (cWidth  / 2) - (this.pw / 2);

          if      (align.includes('top'))    this.py = cTop + offset;
          else if (align.includes('bottom')) this.py = cTop + cHeight - this.ph - offset;
          else                               this.py = cTop + (cHeight / 2) - (this.ph / 2);

          this._applyTransform();

          const dx  = this.px - oldPx;
          const dy  = this.py - oldPy;
          const lid = this.getAttribute('data-linked-id');
          if (lid && (dx !== 0 || dy !== 0)) {
            document.querySelectorAll<Craftools_Element>(`craftools-element[data-linked-id="${lid}"]`).forEach(clone => {
              if (clone !== this) {
                clone.px += dx;
                clone.py += dy;
                clone._applyTransform();
              }
            });
          }

          this.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element: this } }));
        }
      }
    }

    this.isDragging  = false;
    this.isResizing  = false;
    this.isRotating  = false;
    document.removeEventListener('pointermove', this._onMove);
  }

  // ── Registration ──────────────────────────────────────────────────────────────

  static init(): void {
    customElements.define('craftools-element', Craftools_Element);
  }
}
