/**
 * CtxBar.ts
 */

import { I18n } from "../settings/Translations.js";
import { AppSettings } from "./AppSettings.js";
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
   * Consecutive options sharing the same group id are wrapped together in
   * one DOM div (see CtxBar.createGroup()) that CSS flex-wrap treats as a
   * single, unsplittable item -- e.g. TextTool.ts tags Bold/Italic/
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
  // Couples the ctx-bar to the properties panel: whichever one changes a
  // value dispatches 'craftools-state-change' (PropertyRenderer.applyChange())
  // on the element -- this listener rebuilds the ctx-bar in response, so a
  // change made in the PANEL (e.g. toggling Bold there) is reflected here
  // immediately too, not just changes made through the ctx-bar itself.
  // Editor.ts's own listener on the same event does the matching panel-side
  // half (re-rendering the panel when the CTX-BAR is what changed).
  private _stateChangeHandler?: (e: Event) => void;
  private _lastOptions: CtxOption[] = [];
  // Whether the collapsed 2nd line (see show()'s MAX_GROUPS/MAX_ITEMS
  // split) is currently expanded. Reset to false on a genuinely NEW
  // element selection, but preserved across a same-element rebuild
  // (_stateChangeHandler's live-sync refresh) so toggling it open doesn't
  // immediately collapse again the next time a property changes.
  private _expanded: boolean = false;

  constructor(container: HTMLElement) {
      this.container = container; // Should be document.body or the app wrapper
      this.el = document.createElement('div');
      this.el.className = 'craftools-ctxbar hidden';
      // z-index bumped from 500 to clear the mobile footer (.footer-nav-area
      // is 1050) and mini-panel (#mobile-mini-panel is 1065) -- the ctx-bar
      // used to render fully behind both on mobile.
      //
      // `el` itself is just a column wrapper around up to 2 row divs (see
      // show()) -- align-items:stretch (the flex default, kept explicit
      // here) is what makes each row stretch to `el`'s own resolved width
      // instead of sizing from its own content, which is what caused an
      // earlier "overflow past the card's edge" bug when this container
      // used align-items:center. max-width is just a generous safety net
      // now -- the real line-count control is the discrete group/item cap
      // in show(), not pixel-width math.
      this.el.style.cssText = 'position:fixed; z-index:1090; display:none; flex-direction:column; align-items:stretch; gap:4px; padding:4px 6px; border-radius:12px; background:var(--bg-shell, #fff); border:1px solid var(--border, #ccc); box-shadow:var(--shadow-lg, 0 4px 12px rgba(0,0,0,0.15)); transition:opacity 0.15s; pointer-events:auto; max-width:min(94vw, 520px);';
      this.container.appendChild(this.el);

      this.activeElement = null;

      // When the user changes ctxBarMode in Settings, rebuild immediately so
      // they see the effect without having to re-select the element.
      document.addEventListener('craftools-ctxbar-mode-change', () => {
          if (this.activeElement) {
              this.show(this.activeElement, this._lastOptions);
          }
      });
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
   * Wraps one atomic cluster of elements (see CtxOption.group's doc
   * comment) so it can never be split across two ctx-bar lines. This is
   * the actual fix for the group-splitting bug, replacing an earlier
   * attempt that tried to predict line breaks with JS pixel-width math and
   * manually build exactly two row divs: that approach kept drifting out
   * of sync with the real rendered layout (a measurement a few pixels off
   * was enough to either overflow past the card's edge or, once a CSS
   * flex-wrap fallback was added, silently wrap mid-group anyway).
   *
   * The fix here is structural instead of computed: each row div built by
   * show() (row 1 and, when expanded, row 2) is itself a flex-wrap
   * container, and every multi-element cluster gets wrapped in its own
   * `nowrap` sub-div. CSS flex-wrap can only ever insert a line break
   * BETWEEN flex items -- never inside one -- so a group-div is
   * guaranteed atomic by the layout engine itself, not by a JS prediction
   * of where the engine will wrap. A single-element cluster doesn't need
   * a wrapper at all: one element is already indivisible, so it's
   * returned as-is and becomes its own flex item directly in its row.
   */
  private createGroup(elements: HTMLElement[]): HTMLElement {
      if (elements.length === 1) return elements[0];
      const group = document.createElement('div');
      group.className = 'craftools-ctxbar-group';
      group.style.cssText = 'display:flex; flex-wrap:nowrap; align-items:center; gap:2px; flex-shrink:0;';
      elements.forEach(el => group.appendChild(el));
      return group;
  }

  /**
   * Renders the floating ctx-bar for `element`. Builds an ordered list of
   * atomic clusters -- the calling tool's own `options` first (e.g.
   * TextTool's font/size group, its Bold/Italic/Underline group, its
   * alignment group, then auto-fit), then one combined group for the
   * controls every tool shares (layer order, duplicate, auto-center).
   *
   * Rather than letting CSS flex-wrap decide where those clusters break
   * across lines (which, per user feedback, tended to leave one line
   * doing most of the work and the other nearly empty -- a "greedy
   * first-fit" wrap always front-loads line 1 until the next cluster
   * literally doesn't fit, with no notion of balance), the split point is
   * now a deliberate rule: line 1 shows clusters up to MAX_GROUPS atomic
   * groups OR MAX_ITEMS individual controls, whichever limit is hit
   * first. Anything beyond that is NOT wrapped onto an always-visible 2nd
   * line -- it's collapsed behind a toggle button appended to the end of
   * line 1, and only appears (left-aligned, not centered, to read as
   * "additional" rather than a peer of line 1) once the user clicks it.
   * See createGroup()'s doc comment for how each cluster stays unsplittable.
   */
  show(element: CraftoolsCtxElement | null, options: CtxOption[] = []): void {
      if (!element) return;
      // A genuinely new selection starts collapsed; a same-element rebuild
      // (_stateChangeHandler's live-sync refresh, see below) keeps whatever
      // the user last chose so toggling the 2nd line open doesn't
      // immediately collapse again the moment a property changes.
      if (this.activeElement !== element) this._expanded = false;
      // Detach whatever the PREVIOUS show() call (if any) attached, before
      // attaching fresh listeners below -- makes show() safe to call
      // repeatedly for a live refresh (see _stateChangeHandler) instead of
      // only once per selection, without leaking a duplicate listener set
      // on every refresh.
      this._detachListeners();
      this.activeElement = element;
      this._lastOptions  = options;
      this.el.innerHTML = '';

      // ── Tool-specific controls ──────────────────────────────────────────
      // Consecutive options sharing the same CtxOption.group become one
      // atomic cluster (see createGroup()); anything without a group is
      // its own single-element cluster, same granularity as before groups
      // existed. `isGeneral` tags the one cluster built further below so
      // the split/border logic can special-case it without a second pass.
      type Cluster = { elements: HTMLElement[]; isGeneral: boolean };
      const clusters: Cluster[] = [];

      if (options && options.length > 0) {
          let currentCluster: HTMLElement[] | null = null;
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

              if (opt.group && opt.group === currentGroupId && currentCluster) {
                  currentCluster.push(el);
              } else {
                  currentCluster = [el];
                  clusters.push({ elements: currentCluster, isGeneral: false });
                  currentGroupId = opt.group;
              }
          });
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

      // Every general control -- layer order, duplicate, auto-center -- is
      // bundled into ONE atomic group (built below via createGroup()) so
      // none of them can be individually stranded on their own line either.
      const generalElements: HTMLElement[] = [
          this.createButton('flip_to_front', I18n.t('common.bringForward'), () => zAdjust('front')),
          this.createButton('flip_to_back', I18n.t('common.sendBackward'), () => zAdjust('back')),
          this.createButton('arrow_upward', I18n.t('common.moveUp'), () => zAdjust('up')),
          this.createButton('arrow_downward', I18n.t('common.moveDown'), () => zAdjust('down')),
          this.createSeparator(),
      ];

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
      generalElements.push(duplicateBtn);

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
      generalElements.push(autoCenterBtn);

      clusters.push({ elements: generalElements, isGeneral: true });

      // ── Appends each cluster's group-div into `row` ─────────────────────
      // Gives the general cluster its separating left border -- but only
      // when it's not the first thing in ITS row, since a border-left on
      // the very first item of a row just looks like stray padding.
      const appendClusters = (row: HTMLElement, list: Cluster[]): void => {
          list.forEach((cluster, idx) => {
              const groupEl = this.createGroup(cluster.elements);
              if (cluster.isGeneral && idx > 0) {
                  groupEl.style.borderLeft  = '1px solid var(--border, #ccc)';
                  groupEl.style.paddingLeft = '6px';
              }
              row.appendChild(groupEl);
          });
      };

      const mode = AppSettings.get('ctxBarMode');

      if (mode === 'fixed') {
          // ── Fixed-top mode (Canva-style) ─────────────────────────────────
          // Single row, max 16 items total, no expand button. The bar sits
          // pinned just below the top toolbar -- position() is a no-op in
          // this mode so the bar never moves while an element is dragged.
          const MAX_ITEMS_FIXED = 16;
          let itemCount = 0;
          const row = document.createElement('div');
          row.className = 'craftools-ctxbar-row';
          row.style.cssText = 'display:flex; flex-wrap:nowrap; align-items:center; justify-content:center; gap:4px; width:100%; box-sizing:border-box;';

          for (const cluster of clusters) {
              if (itemCount + cluster.elements.length > MAX_ITEMS_FIXED) break;
              const groupEl = this.createGroup(cluster.elements);
              if (cluster.isGeneral && row.childNodes.length > 0) {
                  groupEl.style.borderLeft  = '1px solid var(--border, #ccc)';
                  groupEl.style.paddingLeft = '6px';
              }
              row.appendChild(groupEl);
              itemCount += cluster.elements.length;
          }
          this.el.appendChild(row);

          // Apply fixed-top style — top:56px leaves an 8px breathing gap
          // below the 48px header instead of butting the bar flush against it.
          this.el.style.cssText = 'position:fixed; z-index:1090; display:flex; flex-direction:column; align-items:stretch; gap:4px; padding:4px 10px; border-radius:12px; background:var(--bg-shell, #fff); border:1px solid var(--border, #ccc); box-shadow:var(--shadow-lg, 0 4px 12px rgba(0,0,0,0.15)); pointer-events:auto; max-width:min(94vw, 900px); top:56px; left:50%; transform:translateX(-50%);';
      } else {
          // ── Floating mode (default, coupled to element) ──────────────────
          // Split into a visible line 1 and a collapsible line 2.
          // "no máximo 4 grupos atômicos OU 8 itens" -- walk the clusters in
          // order, keeping a running group-count and item-count, and stop
          // adding to line 1 the moment the NEXT cluster would push either
          // count over its cap. Everything from there on is line 2.
          const MAX_GROUPS = 4;
          const MAX_ITEMS  = 8;
          let splitIndex = clusters.length;
          let groupCount = 0;
          let itemCount  = 0;
          for (let i = 0; i < clusters.length; i++) {
              const nextItemCount = itemCount + clusters[i].elements.length;
              if (groupCount + 1 > MAX_GROUPS || nextItemCount > MAX_ITEMS) {
                  splitIndex = i;
                  break;
              }
              groupCount += 1;
              itemCount   = nextItemCount;
          }
          const line1 = clusters.slice(0, splitIndex);
          const line2 = clusters.slice(splitIndex);

          const row1 = document.createElement('div');
          row1.className = 'craftools-ctxbar-row';
          row1.style.cssText = 'display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:4px; width:100%; box-sizing:border-box;';
          appendClusters(row1, line1);

          if (line2.length > 0) {
              // Toggle button lives at the end of line 1 -- clicking it reveals
              // line 2 (left-aligned, per the request, so it visually reads as
              // "more options" rather than a second peer row) without rebuilding
              // anything else.
              const row2 = document.createElement('div');
              row2.className = 'craftools-ctxbar-row craftools-ctxbar-row-overflow';
              row2.style.cssText = `display:${this._expanded ? 'flex' : 'none'}; flex-wrap:wrap; align-items:center; justify-content:flex-start; gap:4px; width:100%; box-sizing:border-box;`;
              appendClusters(row2, line2);

              const toggleBtn = this.createButton('more_vert', I18n.t('common.moreOptions') || 'Mais opções', () => {
                  this._expanded = !this._expanded;
                  row2.style.display = this._expanded ? 'flex' : 'none';
                  this._setButtonActive(toggleBtn, this._expanded);
                  // The bar's height just changed -- reposition so it doesn't
                  // drift off-screen or overlap the element once expanded.
                  this.position(element);
              });
              this._setButtonActive(toggleBtn, this._expanded);
              row1.appendChild(toggleBtn);

              this.el.appendChild(row1);
              this.el.appendChild(row2);
          } else {
              this.el.appendChild(row1);
          }

          // Restore floating style (in case it was previously in fixed mode).
          // `transform:none` explicitly clears the translateX(-50%) that
          // fixed mode sets, so switching back doesn't leave the bar drifting.
          this.el.style.cssText = 'position:fixed; z-index:1090; display:flex; flex-direction:column; align-items:stretch; gap:4px; padding:4px 6px; border-radius:12px; background:var(--bg-shell, #fff); border:1px solid var(--border, #ccc); box-shadow:var(--shadow-lg, 0 4px 12px rgba(0,0,0,0.15)); transition:opacity 0.15s; pointer-events:auto; max-width:min(94vw, 520px); transform:none;';
      }

      this.el.classList.remove('hidden');

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

      // Panel -> ctx-bar sync (see the field's own doc comment above): any
      // 'craftools-state-change' on this element -- however it was
      // triggered, including from a properties-panel field -- rebuilds this
      // same bar with the same options, so its buttons' active/rendered
      // state always reflects the latest value.
      //
      // EXCEPT when the change was caused by the ctx-bar itself
      // (detail.fromCtxBar, set by PropertyRenderer.applyChange() -- see
      // its own doc comment): rebuilding here used to run synchronously as
      // a side effect of e.g. TextTool.ts's font-size ctx-bar input firing
      // its own 'input' event, and since show() starts with
      // `this.el.innerHTML = ''`, that destroyed the very input the user
      // was still typing into -- closing/resetting it right after the
      // first keystroke, before any further interaction was possible. Only
      // the PANEL -> ctx-bar direction needs this rebuild; ctx-bar-caused
      // changes already updated their own button's active state in-place
      // (see the isActive re-check in show()'s option loop below).
      this._stateChangeHandler = (e: Event) => {
          const detail = (e as CustomEvent).detail as { fromCtxBar?: boolean } | undefined;
          if (detail?.fromCtxBar) return;
          this.show(element, this._lastOptions);
      };
      element.addEventListener('craftools-state-change', this._stateChangeHandler);
  }

  /** Shared cleanup for hide() and the top of show() -- see _stateChangeHandler's doc comment. */
  private _detachListeners(): void {
      if (this.activeElement && this._moveHandler) {
          this.activeElement.removeEventListener('craftools-element-change', this._moveHandler);
      }
      if (this.activeElement && this._stateChangeHandler) {
          this.activeElement.removeEventListener('craftools-state-change', this._stateChangeHandler);
      }
      if (this._trackHandler) {
          this._trackTarget?.removeEventListener('scroll', this._trackHandler);
          window.removeEventListener('resize', this._trackHandler);
      }
      this._moveHandler        = undefined;
      this._stateChangeHandler = undefined;
      this._trackHandler       = undefined;
      this._trackTarget        = undefined;
  }

  position(element: CraftoolsCtxElement): void {
      if(!this.activeElement || this.activeElement !== element) return;

      // In fixed-top mode the bar is pinned via CSS (top:48px, left:50%,
      // transform:translateX(-50%)) -- no JS repositioning needed.
      if (AppSettings.get('ctxBarMode') === 'fixed') return;

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
      this._detachListeners();
      this.activeElement = null;
      this._lastOptions  = [];
  }
}
