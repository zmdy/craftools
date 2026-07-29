/**
 * CtxBar.ts
 */

import { I18n } from "../settings/Translations.js";
import { PropertyRenderer } from "./PropertyRenderer.js";

export interface CtxOption {
  icon:    string;
  label:   string;
  command: (el: HTMLElement) => void;
  /**
   * When provided, the button gets an "active" visual state (icon/label
   * tinted accent orange) whenever this returns true. Checked once when the
   * ctx-bar is built, and re-checked right after this option's own command
   * runs, so a toggle button reflects its new state immediately without
   * waiting for the element to be re-selected.
   */
  isActive?: (el: HTMLElement) => boolean;
  /**
   * If provided, renders an arbitrary DOM element instead of a standard button.
   */
  render?: (el: HTMLElement) => HTMLElement;
}

export interface CraftoolsCtxElement extends HTMLElement {
  _craftoolsMeta?: Record<string, any>;
}

export class CtxBar {
  public container:     HTMLElement;
  public el:            HTMLDivElement;
  public activeElement: CraftoolsCtxElement | null;
  private _moveHandler?: () => void;
  private _trackHandler?: () => void;
  private _trackTarget?: HTMLElement | null;

  constructor(container: HTMLElement) {
      this.container = container; // Should be document.body or the app wrapper
      this.el = document.createElement('div');
      this.el.className = 'craftools-ctxbar hidden';
      // z-index bumped from 500 to clear the mobile footer (.footer-nav-area
      // is 1050) and mini-panel (#mobile-mini-panel is 1065) -- the ctx-bar
      // used to render fully behind both on mobile.
      this.el.style.cssText = 'position:fixed; z-index:1090; display:none; flex-direction:column; align-items:center; gap:3px; padding:4px 6px; border-radius:12px; background:var(--bg-shell, #fff); border:1px solid var(--border, #ccc); box-shadow:var(--shadow-lg, 0 4px 12px rgba(0,0,0,0.15)); transition:opacity 0.15s; pointer-events:auto; max-width:min(92vw, 260px);';
      this.container.appendChild(this.el);
      
      this.activeElement = null;
  }

  createButton(iconName: string, label: string, onClick: () => void, extraClass: string = ''): HTMLButtonElement {
      const btn = document.createElement('button');
      btn.className = `craftools-ctx-btn ${extraClass}`;
      btn.title = label;
      btn.style.cssText = 'display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:6px; border:none; background:transparent; color:var(--text-secondary); cursor:pointer; transition:background 0.1s, color 0.1s;';

      btn.addEventListener('mouseover', () => {
          if(extraClass === 'danger') {
              btn.style.background = 'rgba(239,68,68,0.1)';
              btn.style.color = '#ef4444';
          } else {
              btn.style.background = 'var(--bg-input)';
              btn.style.color = btn.classList.contains('active') ? 'var(--accent, #f97316)' : 'var(--text-primary)';
          }
      });
      btn.addEventListener('mouseout', () => {
          btn.style.background = 'transparent';
          btn.style.color = btn.classList.contains('active') ? 'var(--accent, #f97316)' : 'var(--text-secondary)';
      });

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.style.cssText = 'font-size:18px; line-height:1;';
      icon.textContent = iconName;

      btn.appendChild(icon);

      btn.addEventListener('mousedown', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
      });

      return btn;
  }

  /** Toggles a button's "active" styling (accent-orange icon, per CtxOption.isActive). */
  private _setButtonActive(btn: HTMLButtonElement, active: boolean): void {
      btn.classList.toggle('active', active);
      btn.style.color = active ? 'var(--accent, #f97316)' : 'var(--text-secondary)';
  }

  createSeparator(): HTMLDivElement {
      const sep = document.createElement('div');
      sep.className = 'craftools-ctx-sep';
      sep.style.cssText = 'width:1px; height:18px; background:var(--border); margin:0 2px; flex-shrink:0;';
      return sep;
  }

  /**
   * One "line" of the ctx-bar. The bar itself is a flex column (see
   * constructor) of one or two of these, built by _renderBalanced() below.
   */
  private createRow(): HTMLDivElement {
      const row = document.createElement('div');
      row.className = 'craftools-ctxbar-row';
      row.style.cssText = 'display:flex; flex-wrap:nowrap; align-items:center; justify-content:center; gap:2px;';
      return row;
  }

  /**
   * Lays `items` out in the bar, defaulting to a single line and only
   * splitting into a second line when they don't actually fit in one --
   * most tools have few enough controls that this never triggers
   * (e.g. a plain Shape or Icon selection stays one row, same as before
   * any of this row-splitting existed).
   *
   * When a split IS needed (e.g. TextTool's font-select + size + Bold/
   * Italic/Underline + 3 alignment buttons + auto-fit, on top of the
   * shared layer/duplicate/auto-center controls), the break point is
   * chosen by cumulative pixel width rather than a fixed item count, so
   * a wide custom item (like that font/size selector) counts for as much
   * as several icon buttons -- "cada linha com a mesma quantidade de
   * elementos, proporcional ao tamanho". Capped at exactly two lines: the
   * bar never grows a third row, it just lets the second line be exactly
   * whatever didn't fit on the first.
   *
   * Measuring requires a real layout pass, which display:none subtrees
   * can't provide (zero size everywhere) -- so this temporarily flips the
   * bar to visibility:hidden (still laid out, just not painted) rather
   * than toggling display, avoiding any visible flash while still getting
   * real getBoundingClientRect() widths.
   */
  private _renderBalanced(items: HTMLElement[]): void {
      if (items.length === 0) return;

      const probeRow = this.createRow();
      items.forEach(item => probeRow.appendChild(item));
      this.el.appendChild(probeRow);

      const prevDisplay    = this.el.style.display;
      const prevVisibility = this.el.style.visibility;
      this.el.style.display    = 'flex';
      this.el.style.visibility = 'hidden';

      const cs = getComputedStyle(this.el);
      const maxContentWidth = this.el.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
      const widths = items.map(item => item.getBoundingClientRect().width);
      const GAP = 2; // matches createRow()'s gap:2px
      const totalWidth = widths.reduce((sum, w) => sum + w, 0) + GAP * (items.length - 1);

      this.el.style.display    = prevDisplay;
      this.el.style.visibility = prevVisibility;
      this.el.removeChild(probeRow);

      if (totalWidth <= maxContentWidth || items.length === 1) {
          // Fits on one line -- the default. No forced second row.
          const row = this.createRow();
          items.forEach(item => row.appendChild(item));
          this.el.appendChild(row);
          return;
      }

      // Doesn't fit -- split into exactly two lines at whichever item
      // boundary keeps both lines' pixel widths closest to half the total.
      const target = totalWidth / 2;
      let running = 0;
      let splitIndex = items.length - 1;
      for (let i = 0; i < items.length; i++) {
          const withThisItem = running + widths[i] + (i > 0 ? GAP : 0);
          if (withThisItem >= target) {
              const diffInclude = Math.abs(withThisItem - target);
              const diffExclude = Math.abs(running - target);
              splitIndex = diffInclude <= diffExclude ? i + 1 : i;
              break;
          }
          running = withThisItem;
      }
      splitIndex = Math.max(1, Math.min(splitIndex, items.length - 1));

      const firstItems  = items.slice(0, splitIndex);
      const secondItems = items.slice(splitIndex);
      // A lone separator dangling at the start/end of a line (right where
      // the split landed) looks like a stray mark rather than a divider --
      // trim it from whichever end it ended up on.
      const trimEdgeSeparator = (arr: HTMLElement[], fromStart: boolean) => {
          const idx = fromStart ? 0 : arr.length - 1;
          if (arr.length > 0 && arr[idx].classList.contains('craftools-ctx-sep')) arr.splice(idx, 1);
      };
      trimEdgeSeparator(firstItems, false);
      trimEdgeSeparator(secondItems, true);

      const row1 = this.createRow();
      const row2 = this.createRow();
      firstItems.forEach(item => row1.appendChild(item));
      secondItems.forEach(item => row2.appendChild(item));
      this.el.appendChild(row1);
      this.el.appendChild(row2);
  }

  /**
   * Renders the floating ctx-bar for `element`. Builds one flat, ordered
   * list of controls -- the calling tool's own `options` first (e.g.
   * TextTool's font/size/Bold/Italic/Underline/align buttons), then the
   * controls every tool shares (layer order, duplicate, auto-center) --
   * and hands it to _renderBalanced() to lay out as one line, or two
   * evenly-split lines if it doesn't fit on one. See _renderBalanced()'s
   * own doc comment for why 2 lines is the hard cap and 1 line is the
   * default.
   */
  show(element: CraftoolsCtxElement | null, options: CtxOption[] = []): void {
      if (!element) return;
      this.activeElement = element;
      this.el.innerHTML = '';

      const items: HTMLElement[] = [];

      // ── Tool-specific controls ──────────────────────────────────────────
      if (options && options.length > 0) {
          options.forEach(opt => {
              if (opt.render) {
                  items.push(opt.render(element));
              } else {
                  const btn = this.createButton(opt.icon!, opt.label!, () => {
                      if (opt.command) opt.command(element);
                      // Re-check right after the command runs so a toggle (e.g.
                      // TextTool's "auto-fit to text") flips its icon color
                      // immediately, without waiting for a re-select.
                      if (opt.isActive) this._setButtonActive(btn, opt.isActive(element));
                  });
                  if (opt.isActive) this._setButtonActive(btn, opt.isActive(element));
                  items.push(btn);
              }
          });
          items.push(this.createSeparator());
      }

      // ── General controls (shared by every tool) ─────────────────────────

      // Default commands (z-index)
      //
      // These used to only set `element.style.zIndex` directly, never
      // persisting the new value anywhere -- so the moment the element was
      // deselected (which forces zIndex back to its persisted value; see
      // Element.ts's deselect()) or the properties panel's own manual
      // Z-Index field was touched (which re-derives its displayed value
      // from dataset.ctState, not the live style), the change from these
      // buttons was silently lost. setZ() now writes through
      // PropertyRenderer.applyChange() -- the same store every tool's
      // `_applyProperty()` persists 'zIndex' to -- and keeps _craftoolsMeta
      // in sync too, for ShapeTool.ts/IconTool.ts which read zIndex from
      // their own meta object instead.
      const setZ = (z: number) => {
          element.style.zIndex = String(z);
          PropertyRenderer.applyChange(element, 'zIndex', z);
          if (element._craftoolsMeta) element._craftoolsMeta.zIndex = z;
      };

      const zAdjust = (action: 'front' | 'back' | 'up' | 'down') => {
          const page = element.closest('.craftools-page');
          if(!page) return;
          const siblings = [...page.querySelectorAll<HTMLElement>('craftools-element')];
          const currentZ = parseInt(element.style.zIndex) || 2;

          if (action === 'front') setZ(Math.max(...siblings.map(el => parseInt(el.style.zIndex) || 2)) + 1);
          if (action === 'back') {
              const minZ = Math.min(...siblings.map(el => parseInt(el.style.zIndex) || 2));
              setZ(Math.max(1, minZ - 1));
          }
          if (action === 'up') setZ(currentZ + 1);
          if (action === 'down') setZ(Math.max(1, currentZ - 1));
      };

      items.push(this.createButton('flip_to_front', I18n.t('common.bringForward'), () => zAdjust('front')));
      items.push(this.createButton('flip_to_back', I18n.t('common.sendBackward'), () => zAdjust('back')));
      items.push(this.createButton('arrow_upward', I18n.t('common.moveUp'), () => zAdjust('up')));
      items.push(this.createButton('arrow_downward', I18n.t('common.moveDown'), () => zAdjust('down')));

      items.push(this.createSeparator());

      // Duplicate Action
      items.push(this.createButton('content_copy', I18n.t('common.duplicate'), async () => {
          const clone = element.cloneNode(true) as CraftoolsCtxElement;
          
          // Offset slightly
          const currX = parseFloat(element.getAttribute('x') || '0') || 0;
          const currY = parseFloat(element.getAttribute('y') || '0') || 0;
          clone.setAttribute('x', String(currX + 15));
          clone.setAttribute('y', String(currY + 15));
          
          // Re-apply style position
          clone.style.transform = `translate(${currX + 15}px, ${currY + 15}px) rotate(${element.getAttribute('r') || 0}deg)`;

          // Deep copy meta if exists
          if (element._craftoolsMeta) {
              clone._craftoolsMeta = JSON.parse(JSON.stringify(element._craftoolsMeta));
          }

          const page = element.closest('.craftools-page');
          if (page) {
              page.appendChild(clone);
              
              // If it's an image, re-bind interactions
              if (clone.getAttribute('data-craftool') === 'image') {
                  const { ImageTransform } = await import('../tools/image/ImageTransform.js');
                  const { ImageFilters } = await import('../tools/image/ImageFilters.js');
                  ImageTransform.setupInteractions(clone as any);
                  ImageFilters.applyFilters(clone as any);
              }

              // Deselect current and select clone
              setTimeout(() => {
                  const rect = clone.getBoundingClientRect();
                  clone.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.x + 10, clientY: rect.y + 10 }));
                  clone.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
              }, 100);
          }
      }));

      // Auto Center Toggle
      let isAutoCenter = element.getAttribute('data-autocenter') !== 'false';
      if (element.dataset.ctState) {
        try {
          const state = JSON.parse(element.dataset.ctState);
          if (state.autoCenter !== undefined) isAutoCenter = !!state.autoCenter;
        } catch(e) {}
      }
      
      const autoCenterBtn = this.createButton('drag_click', I18n.t('common.autoCenterDesc') || 'Centralizar ao selecionar', () => {
          const currentlyActive = autoCenterBtn.classList.contains('active');
          const nextState = !currentlyActive;
          element.setAttribute('data-autocenter', nextState ? 'true' : 'false');
          PropertyRenderer.applyChange(element, 'autoCenter', nextState);
          this._setButtonActive(autoCenterBtn, nextState);
      });
      this._setButtonActive(autoCenterBtn, isAutoCenter);
      items.push(autoCenterBtn);

      this._renderBalanced(items);

      this.el.classList.remove('hidden');
      this.el.style.display = 'flex';
      this.position(element);

      // Auto-update position on move
      this._moveHandler = () => this.position(element);
      element.addEventListener('craftools-element-change', this._moveHandler);

      // Keep the bar glued to the element while the canvas scrolls. It used
      // to be positioned once (on select/move) and never re-measured, so
      // scrolling #canvas-area desynchronized it from the element --
      // getBoundingClientRect() is viewport-relative and changes on every
      // scroll tick, but nothing was calling position() again to react to
      // that. Also re-checked on window resize for the same reason.
      const canvasArea = document.getElementById('canvas-area');
      this._trackTarget  = canvasArea;
      this._trackHandler = () => this.position(element);
      canvasArea?.addEventListener('scroll', this._trackHandler, { passive: true });
      window.addEventListener('resize', this._trackHandler);
  }

  position(element: CraftoolsCtxElement): void {
      if(!this.activeElement || this.activeElement !== element) return;

      const rect = element.getBoundingClientRect();

      // Canva-style: sits directly below the element by default -- the
      // rotate/delete handles float above it (Element.ts's own ctrlbar), so
      // there's no overlap risk placing the bar underneath. Falls back
      // above only when there's no room below (element near the bottom of
      // the viewport).
      const bottomReserve = window.innerWidth <= 768 ? 76 : 10;
      const maxTop = window.innerHeight - this.el.offsetHeight - bottomReserve;

      let top  = rect.bottom + 12;
      // Centered horizontally on the element, not left-aligned to it.
      let left = rect.left + rect.width / 2 - this.el.offsetWidth / 2;

      if (top > maxTop) {
          top = rect.top - this.el.offsetHeight - 12;
      }
      top = Math.max(top, 10);
      top = Math.min(top, maxTop);

      left = Math.min(Math.max(left, 10), window.innerWidth - this.el.offsetWidth - 10);

      this.el.style.top = `${top}px`;
      this.el.style.left = `${left}px`;
  }

  hide(): void {
      this.el.classList.add('hidden');
      this.el.style.display = 'none';
      if (this.activeElement && this._moveHandler) {
          this.activeElement.removeEventListener('craftools-element-change', this._moveHandler);
      }
      if (this._trackHandler) {
          this._trackTarget?.removeEventListener('scroll', this._trackHandler);
          window.removeEventListener('resize', this._trackHandler);
      }
      this._trackHandler = undefined;
      this._trackTarget  = undefined;
      this.activeElement = null;
  }
}
