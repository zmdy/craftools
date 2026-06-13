export class Craftools_Element extends HTMLElement {
    constructor() {
        super();
        this.px = 0; this.py = 0;
        this.pw = 120; this.ph = 50;
        this.pr = 0;
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.resizeDir = '';
        this.startX = 0; this.startY = 0;
        this.origW = 0; this.origH = 0;
        this.origX = 0; this.origY = 0;
        this._outsideHandler = null;
        this._built = false;

        this._onMove = this._handleMove.bind(this);
        this._onUp   = this._handleUp.bind(this);
    }

    connectedCallback() {
        if (this._built) return;
        this._built = true;

        const rawX = this.getAttribute('x') || '50';
        const rawY = this.getAttribute('y') || '50';
        const rawW = this.getAttribute('w') || '200';
        const rawH = this.getAttribute('h') || '80';

        this.unitX = rawX.toString().replace(/[0-9.-]/g, '') || 'px';
        this.unitY = rawY.toString().replace(/[0-9.-]/g, '') || 'px';
        this.unitW = rawW.toString().replace(/[0-9.-]/g, '') || 'px';
        this.unitH = rawH.toString().replace(/[0-9.-]/g, '') || 'px';

        this.px = parseFloat(rawX);
        this.py = parseFloat(rawY);
        this.pw = parseFloat(rawW);
        this.ph = parseFloat(rawH);
        this.pr = parseFloat(this.getAttribute('r')) || 0;

        this._build();
        this._applyTransform();
        this._bindEvents();
    }

    _build() {
        const existingCtrlbar = this.querySelector('.craftools-ctrlbar');
        if (existingCtrlbar) {
            // It's a clone! Just map the references.
            this._content = this.children[0];
            this._overlay = this.children[1];
            this._ctrlbar = this.children[2];
            return;
        }

        // Collect children
        const children = [];
        while (this.firstChild) children.push(this.removeChild(this.firstChild));

        this.style.cssText = 'display:block;position:absolute;top:0;left:0;user-select:none;touch-action:none;z-index:2;cursor:move;';

        // Content area
        this._content = document.createElement('div');
        this._content.style.cssText = 'position:absolute;inset:0;overflow:visible;pointer-events:none;';
        children.forEach(c => this._content.appendChild(c));

        // Drag overlay
        this._overlay = document.createElement('div');
        this._overlay.style.cssText = 'position:absolute;inset:0;z-index:5;cursor:move;';

        // ctrlbar (Handles)
        this._ctrlbar = document.createElement('div');
        this._ctrlbar.className = 'craftools-ctrlbar';
        this._ctrlbar.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none;z-index:10;';
        
        const accentCol = 'var(--accent, #f97316)';
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
            <div class="rot-handle" style="position:absolute;top:-38px;left:50%;transform:translateX(-50%);width:26px;height:26px;background:#fff;border:2px solid ${accentCol};border-radius:50%;pointer-events:auto;cursor:crosshair;z-index:15;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.15);">
                <span class="material-symbols-outlined" style="font-size:14px;color:${accentCol};line-height:1;">sync</span>
            </div>
            <button class="del-handle" style="position:absolute;top:-12px;right:-12px;width:24px;height:24px;background:#ef4444;color:#fff;border:none;border-radius:50%;pointer-events:auto;cursor:pointer;z-index:15;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(239,68,68,.4);">
                <span class="material-symbols-outlined" style="font-size:14px;line-height:1;">close</span>
            </button>
        `;

        this.appendChild(this._content);
        this.appendChild(this._overlay);
        this.appendChild(this._ctrlbar);
    }

    get contentArea() {
        return this._content;
    }

    _applyTransform() {
        this.style.transform = `translate(${this.px}${this.unitX}, ${this.py}${this.unitY}) rotate(${this.pr}deg)`;
        this.style.width  = `${this.pw}${this.unitW}`;
        this.style.height = `${this.ph}${this.unitH}`;
    }

    _getScale() {
        // Find zoom from app state
        const zoomLabel = document.getElementById('zoom-level');
        if(zoomLabel) {
            const perc = parseInt(zoomLabel.textContent);
            if(!isNaN(perc)) return perc / 100;
        }
        return 1;
    }

    _bindEvents() {
        this._overlay.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.select();
            
            const isLocked = this.getAttribute('data-locked') === 'true';
            if (!isLocked) {
                this.isDragging = true;
                this.startX = e.clientX;
                this.startY = e.clientY;
                this._overlay.setPointerCapture(e.pointerId);
                document.addEventListener('pointermove', this._onMove, { passive: false });
                document.addEventListener('pointerup', this._onUp, { once: true });
            }
        });

        this._overlay.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this._enterEdit();
        });

        this._ctrlbar.querySelectorAll('.rsz-handle').forEach(h => {
            h.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.isResizing = true;
                this.resizeDir  = h.dataset.dir;
                this.startX = e.clientX; this.startY = e.clientY;
                this.origW  = this.pw;   this.origH  = this.ph;
                this.origX  = this.px;   this.origY  = this.py;
                h.setPointerCapture(e.pointerId);
                document.addEventListener('pointermove', this._onMove, { passive: false });
                document.addEventListener('pointerup', this._onUp, { once: true });
            });
        });

        this._ctrlbar.querySelector('.rot-handle')?.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.isRotating = true;
            e.target.setPointerCapture(e.pointerId);
            document.addEventListener('pointermove', this._onMove, { passive: false });
            document.addEventListener('pointerup', this._onUp, { once: true });
        });

        this._ctrlbar.querySelector('.del-handle')?.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const event = new CustomEvent('craftools-element-delete', { bubbles: true, detail: { element: this } });
            this.dispatchEvent(event);

            this.deselect();
            this.remove();
        });
    }

    _enterEdit() {
        this._overlay.style.pointerEvents = 'none';
        this._content.style.pointerEvents = 'auto';

        const editable = this._content.querySelector('[contenteditable]');
        if (editable) {
            editable.style.pointerEvents = 'auto';
            editable.focus();
            
            const syncText = () => {
                const lid = this.getAttribute('data-linked-id');
                if (lid) {
                    const html = editable.innerHTML;
                    document.querySelectorAll(`craftools-element[data-linked-id="${lid}"]`).forEach(clone => {
                        if (clone !== this) {
                            const cEdit = clone.contentArea?.querySelector('[contenteditable]');
                            if (cEdit && cEdit.innerHTML !== html) cEdit.innerHTML = html;
                        }
                    });
                }
            };
            editable.addEventListener('input', syncText);
            editable.addEventListener('blur', () => editable.removeEventListener('input', syncText), { once: true });

            try {
                const range = document.createRange();
                range.selectNodeContents(editable);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            } catch(e) {}
        }

        const restore = (ev) => {
            if (!this.contains(ev.relatedTarget)) {
                this._overlay.style.pointerEvents = '';
                this._content.style.pointerEvents = 'none';
            }
        };
        this._content.addEventListener('focusout', restore, { once: true });
    }

    select() {
        const page = this.closest('.craftools-page');
        if (page) {
            page.querySelectorAll('craftools-element').forEach(d => {
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
        
        if (this.getAttribute('data-locked') === 'true') {
            const handles = this._ctrlbar.querySelectorAll('.rsz-handle, .rot-handle, .del-handle');
            handles.forEach(h => h.style.display = 'none');
        }

        this.style.zIndex = '100';

        const event = new CustomEvent('craftools-element-select', { bubbles: true, detail: { element: this } });
        this.dispatchEvent(event);

        if (this._outsideHandler) return;
        this._outsideHandler = (e) => {
            if (!this.contains(e.target) && !e.target.closest('.craftools-ctxbar') && !e.target.closest('.craftools-panel')) {
                this.deselect();
            }
        };
        setTimeout(() => {
            document.addEventListener('pointerdown', this._outsideHandler, { capture: true });
        }, 0);
    }

    deselect() {
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
        
        // Salva guarda global: Restaura a camada protetora interativa ao clicar fora
        this._overlay.style.pointerEvents = '';
        this._content.style.pointerEvents = 'none';
        
        const event = new CustomEvent('craftools-element-deselect', { bubbles: true, detail: { element: this } });
        this.dispatchEvent(event);

        if (this._outsideHandler) {
            document.removeEventListener('pointerdown', this._outsideHandler, { capture: true });
            this._outsideHandler = null;
        }
    }

    _handleMove(e) {
        if (!this.isDragging && !this.isResizing && !this.isRotating) return;
        e.preventDefault();

        const sc = this._getScale();
        const oldPx = this.px;
        const oldPy = this.py;

        if (this.isDragging) {
            const scX = this.unitX === 'mm' ? sc * 3.7795275591 : sc;
            const scY = this.unitY === 'mm' ? sc * 3.7795275591 : sc;
            this.px += (e.clientX - this.startX) / scX;
            this.py += (e.clientY - this.startY) / scY;
            this.startX = e.clientX;
            this.startY = e.clientY;
        }
        else if (this.isResizing) {
            const scX = this.unitW === 'mm' ? sc * 3.7795275591 : sc;
            const scY = this.unitH === 'mm' ? sc * 3.7795275591 : sc;
            const scPX = this.unitX === 'mm' ? sc * 3.7795275591 : sc;
            const scPY = this.unitY === 'mm' ? sc * 3.7795275591 : sc;

            const dx = (e.clientX - this.startX) / scX;
            const dy = (e.clientY - this.startY) / scY;
            const d  = this.resizeDir;

            if (d === 'r' || d === 'tr' || d === 'br') this.pw = Math.max(2, this.origW + dx);
            if (d === 'b' || d === 'bl' || d === 'br') this.ph = Math.max(2, this.origH + dy);
            if (d === 'l' || d === 'tl' || d === 'bl') {
                const nw = Math.max(2, this.origW - dx);
                const dpx = (e.clientX - this.startX) / scPX;
                this.pw = nw;
                this.px = this.origX + dpx; // simplified for single-step delta? wait.
                // Orig logic: this.px = this.origX + (this.origW - nw)
                // Let's stick to consistent logic
                const nw_orig_unit = Math.max(2, this.origW - dx);
                this.pw = nw_orig_unit;
                this.px = this.origX + (this.origW - nw_orig_unit);
            }
            if (d === 't' || d === 'tl' || d === 'tr') {
                const nh = Math.max(2, this.origH - dy);
                this.ph = nh;
                this.py = this.origY + (this.origH - nh);
            }
        }
        else if (this.isRotating) {
            const r = this.getBoundingClientRect();
            const cx = r.left + r.width  / 2;
            const cy = r.top  + r.height / 2;
            this.pr = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) + 90;
        }

        this._applyTransform();
        
        const dx = this.px - oldPx;
        const dy = this.py - oldPy;
        const lid = this.getAttribute('data-linked-id');
        if (lid && (dx !== 0 || dy !== 0 || this.isResizing || this.isRotating)) {
            document.querySelectorAll(`craftools-element[data-linked-id="${lid}"]`).forEach(clone => {
                if (clone !== this) {
                    if (this.isDragging) {
                        clone.px += dx;
                        clone.py += dy;
                    } else if (this.isResizing) {
                        clone.px += dx;
                        clone.py += dy;
                        clone.pw = this.pw;
                        clone.ph = this.ph;
                    } else if (this.isRotating) {
                        clone.pr = this.pr;
                    }
                    clone._applyTransform();
                }
            });
        }
        
        const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element: this } });
        this.dispatchEvent(event);
    }

    _handleUp(e) {
        if (this.isDragging && window.craftoolsAutoSnap !== false && this.getAttribute('data-locked') !== 'true') {
            // Temporarily hide to find the element underneath
            this.style.visibility = 'hidden';
            const els = document.elementsFromPoint(e.clientX, e.clientY);
            this.style.visibility = '';
            
            const cell = els.find(el => el.classList.contains('craftools-grid-cell'));
            if (cell) {
                const page = this.closest('.craftools-page');
                if (page) {
                    const cRect = cell.getBoundingClientRect();
                    const pRect = page.getBoundingClientRect();
                    const scale = this._getScale();
                    
                    const align = window.craftoolsAutoSnapAlign || 'bottom-center';
                    const offset = 5;
                    const cLeft = (cRect.left - pRect.left) / scale;
                    const cTop = (cRect.top - pRect.top) / scale;
                    const cWidth = cRect.width / scale;
                    const cHeight = cRect.height / scale;

                    const oldPx = this.px;
                    const oldPy = this.py;

                    if (align.includes('left')) this.px = cLeft + offset;
                    else if (align.includes('right')) this.px = cLeft + cWidth - this.pw - offset;
                    else this.px = cLeft + (cWidth / 2) - (this.pw / 2);

                    if (align.includes('top')) this.py = cTop + offset;
                    else if (align.includes('bottom')) this.py = cTop + cHeight - this.ph - offset;
                    else this.py = cTop + (cHeight / 2) - (this.ph / 2);
                    
                    this._applyTransform();
                    
                    const dx = this.px - oldPx;
                    const dy = this.py - oldPy;
                    const lid = this.getAttribute('data-linked-id');
                    if (lid && (dx !== 0 || dy !== 0)) {
                        document.querySelectorAll(`craftools-element[data-linked-id="${lid}"]`).forEach(clone => {
                            if (clone !== this) {
                                clone.px += dx;
                                clone.py += dy;
                                clone._applyTransform();
                            }
                        });
                    }
                    
                    const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element: this } });
                    this.dispatchEvent(event);
                }
            }
        }
        
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        document.removeEventListener('pointermove', this._onMove);
    }

    static init() { customElements.define("craftools-element", Craftools_Element); }
}
