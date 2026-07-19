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
      this.el.style.cssText = 'position:fixed; z-index:1090; display:none; align-items:center; gap:2px; padding:4px 6px; border-radius:12px; background:var(--bg-shell, #fff); border:1px solid var(--border, #ccc); box-shadow:var(--shadow-lg, 0 4px 12px rgba(0,0,0,0.15)); transition:opacity 0.15s; pointer-events:auto;';
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

  show(element: CraftoolsCtxElement | null, options: CtxOption[] = []): void {
      if (!element) return;
      this.activeElement = element;
      this.el.innerHTML = '';

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

      this.el.appendChild(this.createButton('flip_to_front', I18n.t('common.bringForward'), () => zAdjust('front')));
      this.el.appendChild(this.createButton('flip_to_back', I18n.t('common.sendBackward'), () => zAdjust('back')));
      this.el.appendChild(this.createButton('arrow_upward', I18n.t('common.moveUp'), () => zAdjust('up')));
      this.el.appendChild(this.createButton('arrow_downward', I18n.t('common.moveDown'), () => zAdjust('down')));

      this.el.appendChild(this.createSeparator());

      // Duplicate Action
      this.el.appendChild(this.createButton('content_copy', I18n.t('common.duplicate'), async () => {
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
              if (clone.getAttribute('data-craftool') === 'imagem') {
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

      // Custom tools commands
      if (options && options.length > 0) {
          this.el.appendChild(this.createSeparator());
          options.forEach(opt => {
              const btn = this.createButton(opt.icon, opt.label, () => {
                  if (opt.command) opt.command(element);
                  // Re-check right after the command runs so a toggle (e.g.
                  // TextTool's "auto-fit to text") flips its icon color
                  // immediately, without waiting for a re-select.
                  if (opt.isActive) this._setButtonActive(btn, opt.isActive(element));
              });
              if (opt.isActive) this._setButtonActive(btn, opt.isActive(element));
              this.el.appendChild(btn);
          });
      }

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
