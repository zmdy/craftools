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
  /**
   * Consecutive options sharing the same group id are kept together as one
   * atomic cluster that never gets split across the ctx-bar's two lines
   * (see CtxBar._renderBalanced()) -- e.g. TextTool.ts tags Bold/Italic/
   * Underline as one group ('bius') and its 3 alignment buttons as another
   * ('align'), so a line break can land between those clusters but never
   * inside one. Options without a group (the default) are each their own
   * single-item cluster, same as before this existed.
   */
  group?: string;
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
      //
      // max-width of 340 (not a tighter value) is sized around the heaviest
      // real ctx-bar in the app -- TextTool's font-select+size, Bold/
      // Italic/Underline, and 3 alignment buttons on top of the shared
      // layer/duplicate/auto-center controls. _renderBalanced() always
      // produces exactly 1 or 2 lines and never splits an atomic group, but
      // it can only guarantee the FIRST line fits under this cap -- a
      // narrower cap left the second line (or, before nowrap was
      // reinstated, a CSS-level flex-wrap safety net) with nowhere to put
      // the overflow except silently wrapping a 3rd/4th line, which visibly
      // tore groups like Bold/Italic/Underline apart. This value keeps both
      // lines fitting cleanly for that worst case while still being far
      // narrower than the original, completely unconstrained bar.
      this.el.style.cssText = 'position:fixed; z-index:1090; display:none; flex-direction:column; align-items:center; gap:3px; padding:4px 6px; border-radius:12px; background:var(--bg-shell, #fff); border:1px solid var(--border, #ccc); box-shadow:var(--shadow-lg, 0 4px 12px rgba(0,0,0,0.15)); transition:opacity 0.15s; pointer-events:auto; max-width:min(92vw, 340px);';
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
   * constructor) of exactly one or two of these, built by
   * _renderBalanced() below.
   *
   * flex-wrap is deliberately `nowrap`, not `wrap`. A `wrap` fallback was
   * tried as an overflow safety net, but it backfired: CSS wrapping has no
   * concept of this row's "cells" (see _renderBalanced()'s doc comment),
   * so the moment a row's real rendered width came out even a little wider
   * than expected, the browser would silently wrap mid-group -- e.g.
   * TextTool's Bold/Italic/Underline trio splitting across two lines, and
   * the bar growing 3-4 lines tall instead of the hard 2-line cap. `nowrap`
   * guarantees _renderBalanced()'s row/cell decisions are what actually
   * renders; any residual sizing slack shows up as a few pixels of
   * horizontal overflow on a rare, very control-heavy row instead.
   *
   * max-width:100% + box-sizing:border-box still matters independently of
   * that: a row is a flex item along the column container's CROSS axis,
   * and since the bar uses align-items:center (not the flex default of
   * stretch) it would otherwise size itself from its own content instead
   * of respecting the bar's own max-width.
   */
  private createRow(): HTMLDivElement {
      const row = document.createElement('div');
      row.className = 'craftools-ctxbar-row';
      row.style.cssText = 'display:flex; flex-wrap:nowrap; align-items:center; justify-content:center; gap:2px; max-width:100%; box-sizing:border-box;';
      return row;
  }

  /**
   * Lays `cells` out in the bar, defaulting to a single line and only
   * splitting into a second line when they don't actually fit in one --
   * most tools have few enough controls that this never triggers (e.g. a
   * plain Shape or Icon selection stays one row, same as before any of
   * this row-splitting existed).
   *
   * Each cell is an atomic cluster of one or more elements (see
   * CtxOption.group's doc comment) that always stays together on the same
   * line -- e.g. TextTool's Bold/Italic/Underline trio, or its 3 alignment
   * buttons. A single icon button with no declared group is just a
   * one-element cell, same granularity as before groups existed.
   *
   * When a split IS needed (e.g. TextTool's font-select + size + B/I/U +
   * alignment + auto-fit, on top of the shared layer/duplicate/
   * auto-center controls), the break point is chosen by cumulative pixel
   * width rather than a fixed cell count, so a wide cell (like that font/
   * size selector) counts for as much as several icon buttons -- "cada
   * linha com a mesma quantidade de elementos, proporcional ao tamanho".
   * Capped at exactly two lines: the bar never grows a third row, it just
   * lets the second line be exactly whatever didn't fit on the first, and
   * a cell boundary is always respected so a group is never torn in half
   * across the two lines.
   *
   * Measuring requires a real layout pass, which display:none subtrees
   * can't provide (zero size everywhere) -- so this temporarily flips the
   * bar to visibility:hidden (still laid out, just not painted) rather
   * than toggling display, avoiding any visible flash while still getting
   * real getBoundingClientRect() widths.
   */
  private _renderBalanced(cells: HTMLElement[][]): void {
      const nonEmptyCells = cells.filter(cell => cell.length > 0);
      const items = nonEmptyCells.flat();
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
      const GAP = 2; // matches createRow()'s gap:2px
      const cellWidths = nonEmptyCells.map(cell => {
          let w = 0;
          cell.forEach((el, idx) => {
              w += el.getBoundingClientRect().width;
              if (idx > 0) w += GAP; // gap between elements within the same cell
          });
          return w;
      });
      const totalWidth = cellWidths.reduce((sum, w) => sum + w, 0) + GAP * (nonEmptyCells.length - 1);

      this.el.style.display    = prevDisplay;
      this.el.style.visibility = prevVisibility;
      this.el.removeChild(probeRow);

      const renderRow = (cellGroup: HTMLElement[][]) => {
          const row = this.createRow();
          cellGroup.flat().forEach(el => row.appendChild(el));
          this.el.appendChild(row);
      };

      if (totalWidth <= maxContentWidth || nonEmptyCells.length === 1) {
          // Fits on one line -- the default. No forced second row.
          renderRow(nonEmptyCells);
          return;
      }

      // Doesn't fit -- split into exactly two lines by greedily filling
      // line 1 with as many whole cells as fit under maxContentWidth, then
      // putting everything else on line 2. This guarantees line 1 always
      // fits (short of a single cell alone being wider than the cap, an
      // edge case with no valid split anyway); a target-the-midpoint
      // approach was tried instead, but "closest to half" doesn't imply
      // "fits" -- it could still assign line 1 more width than the cap
      // allows, which is exactly what forced the old flex-wrap safety net
      // to kick in and tear a group apart (see createRow()'s doc comment).
      // Splitting by cell (not by individual element) is what keeps a
      // group like Bold/Italic/Underline from being torn apart in the
      // first place.
      let running = 0;
      let splitIndex = nonEmptyCells.length;
      for (let i = 0; i < nonEmptyCells.length; i++) {
          const withThisCell = running + cellWidths[i] + (i > 0 ? GAP : 0);
          if (i > 0 && withThisCell > maxContentWidth) {
              splitIndex = i;
              break;
          }
          running = withThisCell;
      }
      splitIndex = Math.max(1, Math.min(splitIndex, nonEmptyCells.length - 1));

      let firstCells  = nonEmptyCells.slice(0, splitIndex);
      let secondCells = nonEmptyCells.slice(splitIndex);
      // A lone separator dangling at the start/end of a line (right where
      // the split landed) looks like a stray mark rather than a divider --
      // trim it from whichever end it ended up on.
      const isSeparatorCell = (cell: HTMLElement[]) => cell.length === 1 && cell[0].classList.contains('craftools-ctx-sep');
      if (firstCells.length > 0 && isSeparatorCell(firstCells[firstCells.length - 1])) firstCells = firstCells.slice(0, -1);
      if (secondCells.length > 0 && isSeparatorCell(secondCells[0])) secondCells = secondCells.slice(1);

      renderRow(firstCells);
      renderRow(secondCells);
  }

  /**
   * Renders the floating ctx-bar for `element`. Builds one ordered list of
   * cells (see _renderBalanced()'s doc comment for what a cell is) -- the
   * calling tool's own `options` first (e.g. TextTool's font/size, then
   * its Bold/Italic/Underline cell, then its alignment cell, then
   * auto-fit), then the controls every tool shares grouped into their own
   * cells (layer order as one cell, duplicate, auto-center) -- and hands
   * them to _renderBalanced() to lay out as one line, or two evenly-split
   * lines (never splitting a cell) if it doesn't fit on one.
   */
  show(element: CraftoolsCtxElement | null, options: CtxOption[] = []): void {
      if (!element) return;
      this.activeElement = element;
      this.el.innerHTML = '';

      const cells: HTMLElement[][] = [];

      // ── Tool-specific controls ──────────────────────────────────────────
      // Consecutive options sharing the same CtxOption.group land in the
      // same cell (never split across the two lines); anything without a
      // group is its own single-element cell, same granularity as before
      // groups existed.
      if (options && options.length > 0) {
          let currentCell: HTMLElement[] | null = null;
          let currentGroupId: string | undefined;
          options.forEach(opt => {
              const el = opt.render ? opt.render(element) : (() => {
                  const btn = this.createButton(opt.icon!, opt.label!, () => {
                      if (opt.command) opt.command(element);
                      // Re-check right after the command runs so a toggle (e.g.
                      // TextTool's "auto-fit to text") flips its icon color
                      // immediately, without waiting for a re-select.
                      if (opt.isActive) this._setButtonActive(btn, opt.isActive(element));
                  });
                  if (opt.isActive) this._setButtonActive(btn, opt.isActive(element));
                  return btn;
              })();

              if (opt.group && opt.group === currentGroupId && currentCell) {
                  currentCell.push(el);
              } else {
                  currentCell = [el];
                  cells.push(currentCell);
                  currentGroupId = opt.group;
              }
          });
          cells.push([this.createSeparator()]);
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

      // Layer order is one atomic cell -- front/back/up/down always stay
      // together on the same line rather than splitting mid-cluster.
      cells.push([
          this.createButton('flip_to_front', I18n.t('common.bringForward'), () => zAdjust('front')),
          this.createButton('flip_to_back', I18n.t('common.sendBackward'), () => zAdjust('back')),
          this.createButton('arrow_upward', I18n.t('common.moveUp'), () => zAdjust('up')),
          this.createButton('arrow_downward', I18n.t('common.moveDown'), () => zAdjust('down')),
      ]);

      cells.push([this.createSeparator()]);

      // Duplicate Action
      const duplicateBtn = this.createButton('content_copy', I18n.t('common.duplicate'), async () => {
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
      });
      cells.push([duplicateBtn]);

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
      cells.push([autoCenterBtn]);

      this._renderBalanced(cells);

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
