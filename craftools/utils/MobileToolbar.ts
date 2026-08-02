// @ts-nocheck
/**
 * MobileToolbar.ts
 *
 * Gerencia a UX mobile estilo Canva:
 *  - Footer scrollável com ferramentas (modo padrão)
 *  - Footer vira barra de propriedades quando um elemento é selecionado
 *  - Mini-painéis flutuantes para cada seção de propriedade
 *
 * Não interfere com o desktop (window.innerWidth > 768).
 *
 * Schema-driven: usa ToolRegistry + getPropertySchema() para construir os
 * itens do footer e PropertyRenderer.renderSectionFields() para renderizar
 * cada mini-painel — sem nenhum código hard-coded por tipo de ferramenta.
 */

import { I18n } from '../settings/Translations.js';
import { ToolRegistry } from './ToolRegistry';
import { PropertyRenderer } from './PropertyRenderer';
import { tr } from './i18nLabel';
import './MobileToolbar_Translations.js';

// ── Local types ───────────────────────────────────────────────────────────────

interface FooterItem {
  icon: string;
  /** Literal glyph to render instead of `icon` (see ToolDefinition.emojiIcon). */
  emojiIcon?: string;
  /** Image URL to render instead of `icon`/`emojiIcon` (see ToolDefinition.iconImg). */
  iconImg?: string;
  label: string;
  action: () => void;
}

/** craftools-element with tool-specific expandos used by MobileToolbar. */
interface CraftoolsEl extends HTMLElement {
  contentArea?: HTMLElement;
  _craftoolsMeta?: Record<string, unknown>;
  _craftoolsVariable?: unknown;
  _craftoolsAutoResize?: boolean;
  deselect?: () => void;
  _syncLockUI?: () => void;
}

interface ClipboardStyle {
  type: string | null;
  cssText: string;
  zIndex: string;
  meta: Record<string, unknown> | null;
}

declare global {
  interface Window {
    __craftoolsClipboardStyle?: ClipboardStyle;
  }
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class MobileToolbar {
  static _footer:        HTMLElement | null  = null;
  static _miniPanel:     HTMLElement | null  = null;
  static _overlay:       HTMLElement | null  = null;
  static _activeElement: CraftoolsEl | null  = null;
  static _activeType:    string      | null  = null;
  static _editor:        HTMLElement | null  = null;

  /** Page currently backing the 'page' footer mode (see showPageMode()). */
  static _activePageEl:      HTMLElement | null = null;
  /** Debounce handle for scheduleThumbnailRefresh() -- see its own comment. */
  static _pageRefreshTimer:  number      | null = null;
  /**
   * Snapshot of `_footer`'s children taken the moment page mode is
   * entered, so exitPageMode() can put the SAME nodes back (see its own
   * comment for why this matters on desktop).
   */
  static _savedFooterChildren: HTMLElement[] | null = null;

  // ─── Entry point ────────────────────────────────────────────────────────────

  /**
   * `.footer-nav-area` (`#footerNav`) isn't mobile-only chrome -- on
   * desktop it's the same fixed bottom bar, just showing the original
   * static drag-and-drop tool buttons wired up once in Editor.ts's
   * bindEvents() ("Estilo dos botões do footer (drag no PC)" in
   * index.html). So `_footer` itself is acquired on every device; only the
   * Canva-style tool-list/element-mode rebuild (showToolMode()/
   * showElementMode()/the mini-panel) stays mobile-only -- desktop already
   * has the sidebar + right panel for those. showPageMode()/exitPageMode()
   * are the one mode meant to run on both.
   */
  static init(editor: HTMLElement): void {
    this._editor = editor;
    const footerUl = document.querySelector<HTMLElement>('.footer-nav ul');
    if (!footerUl) return;
    this._footer = footerUl;

    if (this.isMobile()) {
      this._buildMiniPanel();
      this.showToolMode();
    }

    // Re-render the page-thumbnail strip whenever a page is appended
    // (PageTool.addNewPage()/_duplicatePage() both dispatch this on
    // `document`) -- keeps the "+" button and any other add-page entry
    // point in sync without MobileToolbar needing to import PageTool.ts
    // itself (which would create a circular import, since PageTool.ts
    // already imports MobileToolbar to call showPageMode()).
    document.addEventListener('craftools-page-add', () => {
      if (this._activeType === 'page') this._renderPageThumbnails();
    });
  }

  static isMobile(): boolean {
    return window.innerWidth <= 768;
  }

  // ─── Footer modes ───────────────────────────────────────────────────────────

  static showToolMode(): void {
    if (!this._footer) return;
    this._activeElement = null;
    this._activeType    = null;
    this._activePageEl  = null;
    this.closeMiniPanel();
    this._updateScrollReserve();

    // Was a hardcoded 5-tool + 3-action list -- most of the sidebar's tools
    // (barcode, shape, icons, emoji, curved text, stamp, calendars, variable
    // content, paper...) were simply unreachable from mobile. Every tool
    // already has a fully-working `#pwa-sidebar-{key}` link in the desktop
    // sidebar (`#sidenav-nav-list` in index.html) with click handlers in
    // Editor.ts that already do the right thing per tool (direct
    // tap-to-add, open a picker panel, or take over the panel for
    // panel-only tools) -- and those handlers are NOT desktop-gated. So
    // instead of re-implementing tool creation here (the old `_triggerTool`
    // only special-cased 'imagem'/'qrcode'/'album' and silently mis-created
    // a TextTool element for anything else), every tool button just proxy-
    // clicks its real sidebar link. ToolRegistry is the single source of
    // truth for which tools exist, so this list can never drift out of
    // sync with the sidebar again.
    const toolItems: FooterItem[] = ToolRegistry.all().map(def => ({
      icon:      def.icon,
      emojiIcon: def.emojiIcon,
      iconImg:   def.iconImg,
      label:     I18n.t(def.label) || def.label,
      action:    () => document.querySelector<HTMLElement>(`#pwa-sidebar-${def.key}`)?.click(),
    }));

    const actionItems: FooterItem[] = [
      { icon: 'note_add',       label: I18n.t('mobileToolbar.toolNewPage'), action: () => document.getElementById('pwa-sidebar-newpage')?.click() },
      { icon: 'picture_as_pdf', label: I18n.t('mobileToolbar.toolPdf'),     action: () => document.getElementById('pwa-sidebar-export')?.click() },
      { icon: 'image',          label: I18n.t('mobileToolbar.toolPng'),     action: () => document.getElementById('pwa-sidebar-png')?.click() },
    ];

    this._renderFooterItems([...toolItems, ...actionItems]);
  }

  /**
   * Schema-driven element mode.
   *
   * Reads getPropertySchema() from the tool registered for `type` and maps
   * each section that has an `icon` to a footer button. Clicking a button
   * opens the mini-panel with PropertyRenderer.renderSectionFields(), which
   * uses the same field handlers as the desktop panel — no duplication.
   */
  static showElementMode(element: HTMLElement, type: string): void {
    if (!this._footer) return;
    this._activeElement = element as CraftoolsEl;
    this._activeType    = type;
    this._activePageEl  = null;
    this.closeMiniPanel();

    const toolDef = ToolRegistry.get(type);
    const ToolClass = toolDef?.tool;

    // Prime dataset.ctState so PropertyRenderer can read initial values.
    // On mobile the desktop panel never renders, so _syncFromDOM hasn't run.
    ToolClass?._syncFromDOM?.(element);

    const schema = ToolClass?.getPropertySchema(element) ?? [];

    const items: FooterItem[] = schema
      .filter(s => s.icon)
      .map(s => {
        const title = tr(s.i18nKey, s.section);
        return {
          icon:  s.icon,
          label: title,
          action: () => {
            this.openMiniPanel(title, (container: HTMLElement) => {
              PropertyRenderer.renderSectionFields(container, s, element, (key, val) => {
                // Same panel-origin tagging as BaseTool.ts's desktop
                // renderPropertiesPanel() -- see PropertyRenderer.
                // runFromPanel()'s doc comment.
                PropertyRenderer.runFromPanel(() => {
                  ToolClass?._applyProperty(element, key, val);
                });
              });
            });
          },
        };
      });

    // Back button always first
    items.unshift({
      icon: 'arrow_back',
      label: I18n.t('mobileToolbar.close'),
      action: () => {
        this.showToolMode();
        document.querySelectorAll<CraftoolsEl>('craftools-element').forEach(e => e.deselect?.());
      },
    });

    this._renderFooterItems(items);
    this._keepElementVisible();
  }

  /**
   * Page-preview footer mode.
   *
   * Called by PageTool.ts's pageEl click handler (mobile only) right after
   * it opens the full-screen Page Settings panel. Swaps the footer's tool
   * list for a horizontal strip of live thumbnails -- one per page in
   * `#pages-wrapper` -- so the user can jump between pages, reorder them,
   * or add a new one without leaving the panel. Reverts to showToolMode()
   * automatically via the existing mobile close paths (closePanelMenu()'s
   * `if (isMobile()) MobileToolbar.showToolMode();` and the
   * 'craftools-element-select' handler's showElementMode() call), so no
   * extra wiring is needed on the "leaving page mode" side.
   */
  static showPageMode(pageEl: HTMLElement): void {
    if (!this._footer) return;
    if (this._activeType !== 'page') {
      // Stash whatever's currently in the footer (the tool-list <li>s on
      // mobile, or the original static drag-and-drop buttons on desktop)
      // so exitPageMode() can restore the SAME nodes -- see its own
      // comment for why this matters on desktop.
      this._savedFooterChildren = Array.from(this._footer.children) as HTMLElement[];
    }
    this._activeElement = null;
    this._activeType    = 'page';
    this._activePageEl  = pageEl;
    this._footer.classList.add('ct-page-strip-active');
    // Belt-and-suspenders over the .ct-page-strip-active CSS rule: this
    // `<ul>` carries Bootstrap's `justify-content-between` utility class
    // (and friends) inline in index.html, which ships with its own
    // `!important`. An inline `!important` always wins the cascade over a
    // stylesheet `!important` regardless of selector specificity or load
    // order (index.html's own comment on Vite reordering the vendor
    // stylesheet after this file's inline <style> block is exactly the
    // kind of cascade surprise this sidesteps), so set it directly rather
    // than trust it stays overridden.
    this._footer.style.setProperty('justify-content', 'flex-start', 'important');
    this._footer.style.setProperty('overflow-x', 'auto', 'important');
    this._footer.style.setProperty('gap', '10px', 'important');
    this.closeMiniPanel();
    this._updateScrollReserve();
    this._renderPageThumbnails();
  }

  /**
   * Reverts the footer out of page-preview mode. No-op if not currently in
   * page mode, so it's safe to call defensively from every panel-closing
   * path regardless of device.
   *
   * On mobile the caller follows this up with showToolMode()/
   * showElementMode() (both do a full rebuild anyway), so restoring the
   * stashed nodes here is a harmless, immediately-overwritten step. On
   * desktop there IS no such rebuild -- the footer's buttons are the real
   * drag-and-drop tool source, wired up ONCE in Editor.ts's bindEvents().
   * Recreating them via innerHTML would produce look-alike nodes with no
   * listeners, silently breaking drag-to-create until a full reload. So
   * this always re-attaches the exact same detached DOM nodes (listeners
   * survive detach/reattach) rather than rebuilding anything.
   */
  static exitPageMode(): void {
    if (this._activeType !== 'page') return;
    if (this._footer) {
      this._footer.classList.remove('ct-page-strip-active');
      this._footer.style.removeProperty('justify-content');
      this._footer.style.removeProperty('overflow-x');
      this._footer.style.removeProperty('gap');
      if (this._savedFooterChildren) {
        this._footer.innerHTML = '';
        this._savedFooterChildren.forEach(c => this._footer!.appendChild(c));
      }
    }
    this._savedFooterChildren = null;
    this._activeType    = null;
    this._activePageEl  = null;
  }

  /**
   * Debounced live-refresh hook for page mode. Page Settings' fields
   * (background, dimensions, custom paper...) mutate `pageEl.style`
   * directly rather than through PropertyRenderer's
   * 'craftools-state-change' event, so there's no single event to key off
   * of -- instead Editor.ts's bindEvents() calls this on any
   * input/change/click bubbling out of `#panel-body`. Debounced + a no-op
   * outside page mode, so it's safe to wire unconditionally and cheap even
   * on rapid typing (re-clones the page strip at most once per 300ms,
   * never per-keystroke).
   */
  static scheduleThumbnailRefresh(): void {
    if (this._activeType !== 'page') return;
    if (this._pageRefreshTimer !== null) return;
    this._pageRefreshTimer = window.setTimeout(() => {
      this._pageRefreshTimer = null;
      if (this._activeType === 'page') this._renderPageThumbnails();
    }, 300);
  }

  /**
   * Rebuilds the footer strip from the CURRENT DOM state of every page.
   * Each thumbnail is a `cloneNode(true)` of the real page, CSS-scaled down
   * via `transform: scale()` -- not rasterized (no html2canvas/canvas
   * draws) -- so it reflects the actual live content (text, images,
   * shapes, backgrounds) at effectively zero cost: a DOM clone + one style
   * write per page, no pixel work. Selection handles never leak into the
   * clone because `<craftools-element>`'s ctrlbar only becomes visible via
   * its own select() (display:none by default, see Element.ts), and no
   * element can be selected while a page's panel is open -- CSS in
   * index.html force-hides `.craftools-ctrlbar`/`.craftools-selected`
   * inside `.ct-page-thumb-inner` as a defensive backstop regardless.
   */
  private static _renderPageThumbnails(): void {
    if (!this._footer || !this._activePageEl) return;
    const wrapper = this._editor?.querySelector<HTMLElement>('#pages-wrapper');
    if (!wrapper) return;
    const activePageEl = this._activePageEl;
    const pages = Array.from(wrapper.querySelectorAll<HTMLElement>(':scope > .craftools-page'));

    this._footer.innerHTML = '';

    let dragSrcIndex: number | null = null;

    pages.forEach((pageEl, idx) => {
      const li = document.createElement('li');
      li.className   = 'ct-page-thumb-item';
      li.draggable   = true;

      const frame = document.createElement('div');
      frame.className = 'ct-page-thumb-frame' + (pageEl === activePageEl ? ' active' : '');

      const w = pageEl.offsetWidth  || 1;
      const h = pageEl.offsetHeight || 1;
      const THUMB_W = 42;
      const scale   = THUMB_W / w;
      frame.style.width  = THUMB_W + 'px';
      frame.style.height = Math.max(24, Math.round(h * scale)) + 'px';

      const inner = document.createElement('div');
      inner.className   = 'ct-page-thumb-inner';
      inner.style.width  = w + 'px';
      inner.style.height = h + 'px';
      inner.style.transform = `scale(${scale})`;
      inner.appendChild(pageEl.cloneNode(true) as HTMLElement);
      frame.appendChild(inner);

      const numTag = document.createElement('span');
      numTag.className = 'ct-page-thumb-num';
      numTag.textContent = String(idx + 1);
      frame.appendChild(numTag);

      frame.addEventListener('click', () => {
        if (pageEl === this._activePageEl) return;
        // .click() re-enters PageTool.ts's own pageEl click handler
        // (isPageClick's `e.target === pageEl` check holds since .click()
        // targets pageEl itself) instead of duplicating its panel-open
        // logic here -- keeps that the single source of truth for "select
        // this page" on every input path. Its body runs synchronously up
        // to its first await, so the panel/activePage swap is already done
        // by the time scrollIntoView() below runs.
        pageEl.click();
        // Selecting a page from the thumbnail strip needs to actually
        // navigate the canvas there too -- unlike a direct click on the
        // page itself (which by definition was already in view), the
        // target page here may be scrolled well out of view, and
        // PageTool.ts's click handler never scrolls on its own (only
        // addNewPage()/_duplicatePage() do). Desktop's canvas stays
        // visible behind the sidebar so this is immediately visible;
        // mobile's panel covers the canvas full-screen, but this still
        // keeps it in sync for when the panel closes.
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      li.addEventListener('dragstart', (e: DragEvent) => {
        dragSrcIndex = idx;
        e.dataTransfer?.setData('text/plain', String(idx));
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      li.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      });
      li.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        if (dragSrcIndex === null || dragSrcIndex === idx) return;
        const srcEl = pages[dragSrcIndex];
        const refEl = pages[idx];
        wrapper.insertBefore(srcEl, dragSrcIndex < idx ? refEl.nextSibling : refEl);
        dragSrcIndex = null;
        document.dispatchEvent(new CustomEvent('craftools-page-reorder', { bubbles: true }));
        MobileToolbar._renderPageThumbnails();
      });

      li.appendChild(frame);
      this._footer!.appendChild(li);
    });

    // "+" add-page -- proxies the real sidebar/footer new-page button
    // instead of calling PageTool.addNewPage() directly, so this module
    // never needs to import tools/page/PageTool.ts (which itself imports
    // MobileToolbar to call showPageMode() -- a direct import back would
    // be circular). The 'craftools-page-add' listener registered in
    // init() re-renders this strip once the new page lands in the DOM.
    const addLi = document.createElement('li');
    addLi.className = 'ct-page-thumb-item ct-page-thumb-add';
    addLi.innerHTML = `<button class="ct-page-thumb-add-btn" type="button" title="${I18n.t('mobileToolbar.toolNewPage')}"><span class="material-symbols-outlined">add</span></button>`;
    addLi.querySelector('button')!.addEventListener('click', () => {
      document.getElementById('pwa-sidebar-newpage')?.click();
    });
    this._footer.appendChild(addLi);
  }

  // ─── Footer rendering ────────────────────────────────────────────────────────

  private static _renderFooterItems(items: FooterItem[]): void {
    if (!this._footer) return;
    this._footer.innerHTML = '';
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'mobile-toolbar-item';
      // Emoji Kitchen's icon is a live combo thumbnail <img> (matches the
      // desktop sidebar exactly -- see ToolDefinition.iconImg), the Emoji
      // tool's icon is a literal glyph (ct-emoji-icon, var(--font-emoji) in
      // index.html -- see ToolDefinition.emojiIcon), everything else is a
      // Material Symbol.
      const iconHtml = item.iconImg
        ? `<img src="${item.iconImg}" alt="" style="width:20px;height:20px;object-fit:contain;flex-shrink:0;">`
        : item.emojiIcon
        ? `<span class="ct-emoji-icon">${item.emojiIcon}</span>`
        : `<span class="material-symbols-outlined">${item.icon}</span>`;
      li.innerHTML = `
        <button class="mobile-toolbar-btn" title="${item.label}">
          ${iconHtml}
          <span class="mobile-toolbar-label">${item.label}</span>
        </button>
      `;
      li.querySelector('button')!.addEventListener('click', item.action);
      this._footer!.appendChild(li);
    });
  }

  // ─── Mini-panel ─────────────────────────────────────────────────────────────

  private static _buildMiniPanel(): void {
    this._overlay = document.createElement('div');
    this._overlay.id = 'mobile-mini-overlay';
    this._overlay.addEventListener('click', () => this.closeMiniPanel());
    document.body.appendChild(this._overlay);

    this._miniPanel = document.createElement('div');
    this._miniPanel.id = 'mobile-mini-panel';
    this._miniPanel.innerHTML = `
      <div class="mmp-header">
        <span class="mmp-title"></span>
        <button class="mmp-close"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="mmp-body"></div>
    `;
    this._miniPanel.querySelector('.mmp-close')!.addEventListener('click', () => this.closeMiniPanel());
    document.body.appendChild(this._miniPanel);
  }

  static openMiniPanel(title: string, renderFn: (container: HTMLElement) => void): void {
    if (!this._miniPanel) return;
    this._miniPanel.querySelector<HTMLElement>('.mmp-title')!.textContent = title;
    const body = this._miniPanel.querySelector<HTMLElement>('.mmp-body')!;
    body.innerHTML = '';
    renderFn(body);
    this._miniPanel.classList.add('open');
    this._overlay!.classList.add('open');
    this._keepElementVisible();
  }

  static closeMiniPanel(): void {
    this._miniPanel?.classList.remove('open');
    this._overlay?.classList.remove('open');
    this._updateScrollReserve();
  }

  // ─── Canvas visibility (Canva-style) ────────────────────────────────────────

  private static _getCanvasArea(): HTMLElement | null {
    return document.getElementById('canvas-area');
  }

  private static _currentReservePx(): number {
    const footer  = document.querySelector<HTMLElement>('.footer-nav-area');
    let reserve   = footer ? footer.offsetHeight : 0;
    if (this._miniPanel?.classList.contains('open')) reserve += this._miniPanel.offsetHeight;
    return reserve;
  }

  private static _updateScrollReserve(): void {
    const canvasArea = this._getCanvasArea();
    if (!canvasArea) return;
    const reserve = this._activeElement ? this._currentReservePx() + 16 : 0;
    canvasArea.style.scrollPaddingBottom = reserve ? `${reserve}px` : '';
  }

  private static _keepElementVisible(): void {
    if (!this._activeElement) return;
    this._updateScrollReserve();
    requestAnimationFrame(() => {
      this._activeElement?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    });
  }

}
