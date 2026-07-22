/**
 * Editor.ts — TypeScript replacement for Editor.js (Priority 5).
 *
 * Key changes vs Editor.js:
 *  - Removed static imports for TextTool / ImageTool / QRCodeTool.
 *  - ToolRegistry import; every tool module registers itself (calls
 *    ToolRegistry.register()) as a side effect of being loaded, but nothing
 *    is imported eagerly here anymore -- see LAZY_TOOL_LOADERS below. (This
 *    file used to side-effect-import all 19 tool files at module scope,
 *    which defeated Vite's per-tool code-splitting: everything ended up
 *    bundled into the initial chunk instead of loading on demand. The only
 *    thing that actually needs a tool's module loaded is either creating one
 *    of its elements -- already lazy via MODULE_MAP/PANEL_SETUP_MAP below --
 *    or selecting an existing element of that type, which is now handled
 *    lazily too.)
 *  - craftools-element-select handler: replaced 12-branch if/else chain with
 *    a single ToolRegistry.get() dispatch (~110 lines → ~25 lines); now
 *    lazily imports the tool's module first via LAZY_TOOL_LOADERS if it
 *    hasn't been registered yet (covers elements reconstructed from a
 *    restored session, which never go through a creation codepath).
 *  - Sidebar tool click handler: panel-only tools use PANEL_SETUP_MAP;
 *    picker tools (emoji/shape/icon) kept as dynamic imports.
 *  - Everything else (zoom, history, session, export, drag-drop) unchanged.
 */

import { PageTool } from '../tools/page/PageTool.js';
import { CtxBar } from '../utils/CtxBar.js';
import { I18n } from '../settings/Translations.js';
import { PdfExport } from '../utils/PdfExport.js';
import { ImageExport } from '../utils/ImageExport.js';
import { HistoryManager } from '../utils/HistoryManager.js';
import { SessionManager } from '../utils/SessionManager.js';
import { MobileToolbar } from '../utils/MobileToolbar.js';
import { ToolRegistry } from '../utils/ToolRegistry';

// ── Keyboard shortcuts: element clipboard ──────────────────────────────────────
// Holds the source element for Ctrl+C/Ctrl+V (see _initHistoryAndSession()'s
// keydown listener below). A live element reference rather than a serialized
// copy -- `isConnected` is checked before paste so a stale reference (source
// deleted, or a fresh page load) safely no-ops instead of pasting a ghost.
declare global {
  interface Window {
    __craftoolsElementClipboard?: HTMLElement | null;
  }
}

/** The position/transform API every <craftools-element> instance exposes (Element.ts). */
interface PositionedElement extends HTMLElement {
  px: number;
  py: number;
  _applyTransform: () => void;
  _craftoolsMeta?: unknown;
  _craftoolsAutoResize?: boolean;
}

// ── Canvas-element tools: key → lazy module import ────────────────────────────
// Every ToolRegistry key that can appear as a `data-craftool` on a live
// `<craftools-element>` (i.e. every tool registered with a `tool:` class,
// not the panelOnly ones -- see PANEL_SETUP_MAP for those). Used by the
// craftools-element-select handler below to import a tool's module
// on-demand the first time one of its elements is selected in this session.
const LAZY_TOOL_LOADERS: Record<string, () => Promise<unknown>> = {
  title:            () => import('../tools/text/TextTool.js'),
  paragraph:        () => import('../tools/text/TextTool.js'),
  image:           () => import('../tools/image/ImageTool.js'),
  shape:            () => import('../tools/shape/ShapeTool.js'),
  icon:             () => import('../tools/icon/IconTool.js'),
  emoji:            () => import('../tools/emoji/EmojiTool.js'),
  emojikitchen:     () => import('../tools/emojikitchen/EmojiKitchenTool.js'),
  qrcode:           () => import('../tools/qrcode/QRCodeTool.js'),
  barcode:          () => import('../tools/barcode/BarcodeTool.js'),
  minicalendar:   () => import('../tools/minicalendar/MiniCalendarTool.js'),
  curvedtext:       () => import('../tools/curvedtext/CurvedTextTool.js'),
  stamp:            () => import('../tools/stamp/StampTool.js'),
  paper:            () => import('../tools/paper/PaperTool.js'),
  variablecontent: () => import('../tools/variablecontent/VariableContentTool.js'),
};

// ── Panel-only tools: key → lazy setup() import ───────────────────────────────
// These tools take over the entire right panel via their own setup(editor, page?) method.
// Separated here so adding a new panel-only tool only requires one new line.

type PanelSetupFn = (editor: HTMLElement, page?: HTMLElement | null) => void | Promise<void>;

const PANEL_SETUP_MAP: Record<string, () => Promise<PanelSetupFn>> = {
  // Dynamic imports target .js files; cast via `any` because TypeScript resolves
  // '.js' to '.ts' stubs (side-effect only) that don't export named classes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agenda:    () => import('../tools/agenda/AgendaExportTool.js').then((m: any) => m.AgendaExportTool.setup.bind(m.AgendaExportTool)),
  // AlbumTool.js's wizard logic was ported to AlbumWizard.ts (see that file's
  // header comment for why it's split from AlbumTool.ts, the eagerly-loaded
  // ToolRegistry-only stub above). AlbumTool.js itself is now dead code.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  album:     () => import('../tools/album/AlbumWizard').then((m: any) => m.AlbumTool.setup.bind(m.AlbumTool)),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calendar:() => import('../tools/calendar/CalendarTool.js').then((m: any) => m.CalendarTool.setup.bind(m.CalendarTool)),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gerador:   () => import('../tools/gerador/GeradorTool.js').then((m: any) => m.GeradorTool.setup.bind(m.GeradorTool)),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  imageslicer: () => import('../tools/imageslicer/ImageSlicerTool.js').then((m: any) => m.ImageSlicerTool.setup.bind(m.ImageSlicerTool)),
};

// ── Editor custom element ──────────────────────────────────────────────────────

export class Craftools_Editor extends HTMLElement {
  // craftools.ts's _renderComponent() used to derive the tag name to
  // document.createElement() from this.screen.name.toLowerCase().replace(...)
  // -- reading the runtime class name. That only works unminified; a
  // production build's minifier mangles class names (e.g. "Craftools_Editor"
  // -> "a"), so document.createElement() silently created a plain, unknown
  // element instead of a real <craftools-editor>, leaving the app blank with
  // no console error. Explicit constant, read instead of the class name.
  static readonly TAG_NAME = 'craftools-editor';

  ctxBar!: CtxBar;
  activePage: Element | null = null;
  _savedPageHtml?: string;
  _savedPageCssText?: string;
  // Exposed for panel-only tools (CalendarTool, GeradorTool) that take over
  // #main-page as a live preview and need to restore it afterward -- was
  // assigned in bindEvents() below (`this.restoreOriginalCanvas = ...`) in
  // the pre-migration Editor.js but dropped during the TS port, silently
  // breaking those tools' editor.restoreOriginalCanvas() calls.
  restoreOriginalCanvas?: () => void;

  private _onHistoryChange?: (e: Event) => void;
  private _onKeydown?: (e: KeyboardEvent) => void;
  private _onPageAdd?: (e: Event) => void;
  private _onPointerdown?: (e: PointerEvent) => void;

  constructor() { super(); }

  connectedCallback() { this.render(); }

  disconnectedCallback() {
    if (this._onHistoryChange) document.removeEventListener('craftools-history-change', this._onHistoryChange);
    if (this._onKeydown) document.removeEventListener('keydown', this._onKeydown);
    if (this._onPageAdd) document.removeEventListener('craftools-page-add', this._onPageAdd);
    if (this._onPointerdown) document.removeEventListener('pointerdown', this._onPointerdown, { capture: true });
    
    // Clear global clipboard to avoid leaking DOM nodes
    const win = window as any;
    if (win.__craftoolsElementClipboard) {
      win.__craftoolsElementClipboard = null;
    }
  }

  render() {
    const activeSizeConfig = (window as any).craftoolsSize;
    let dimWidth  = '100%';
    let dimHeight = '100%';
    if (activeSizeConfig && activeSizeConfig.size !== '*') {
      const parts = activeSizeConfig.size.split(',');
      dimWidth  = parts[0] + activeSizeConfig.sizeUnit;
      dimHeight = parts[1] + activeSizeConfig.sizeUnit;
    }

    this.innerHTML = `
    <div class="craftools-app">
      <header class="craftools-topbar">
        <div style="display: flex; align-items: center; gap: 10px;">
          <button class="craftools-icon-btn" id="mobile-menu-btn" aria-label="Menu" style="display:none;">
            <span class="material-symbols-outlined">menu</span>
          </button>
          <span style="font-family: 'DM Serif Display', serif; font-size: 17px; font-weight: 700; color: var(--text-primary);">CrafTools</span>
          <span class="topbar-sep" style="width: 1px; height: 16px; background: var(--border); flex-shrink: 0;"></span>
          <div style="display: flex; align-items: center; gap: 2px; background: var(--bg-input); border-radius: 6px; padding: 2px;">
            <button class="craftools-icon-btn" title="${I18n.t('editor.undoTitle')}" id="undo-btn" disabled>
              <span class="material-symbols-outlined">undo</span>
            </button>
            <span id="history-indicator" title="${I18n.t('editor.historyIndicatorTitle')}" style="font-size: 10px; color: var(--text-secondary); padding: 0 2px; min-width: 28px; text-align: center; user-select: none;">0/10</span>
            <button class="craftools-icon-btn" title="${I18n.t('editor.redoTitle')}" id="redo-btn" disabled>
              <span class="material-symbols-outlined">redo</span>
            </button>
          </div>
          <span class="topbar-sep" style="width: 1px; height: 16px; background: var(--border); flex-shrink: 0;"></span>
          <div style="display: flex; align-items: center; gap: 4px; background: var(--bg-input); border-radius: 6px; padding: 2px;">
            <button class="craftools-icon-btn" title="${I18n.t('editor.zoomOut')}" id="zoom-out-btn">
              <span class="material-symbols-outlined">zoom_out</span>
            </button>
            <span id="zoom-level" style="font-size: 11px; color: var(--text-secondary); min-width: 45px; text-align: center; font-weight: 500;">100%</span>
            <button class="craftools-icon-btn" title="${I18n.t('editor.zoomIn')}" id="zoom-in-btn">
              <span class="material-symbols-outlined">zoom_in</span>
            </button>
            <button class="craftools-icon-btn" title="${I18n.t('editor.zoomReset')}" id="zoom-reset-btn">
              <span class="material-symbols-outlined">fit_screen</span>
            </button>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <select id="lang-select" style="padding: 4px 8px; border-radius: 6px; background: var(--bg-input); border: 1px solid var(--border); color: var(--text-primary); font-family: 'DM Sans', sans-serif; cursor: pointer; font-size: 11px; margin-right: 4px;">
            <option value="pt-br" ${I18n.currentLang === 'pt-br' ? 'selected' : ''}>PT-BR</option>
            <option value="en"    ${I18n.currentLang === 'en'    ? 'selected' : ''}>EN-US</option>
            <option value="es"    ${I18n.currentLang === 'es'    ? 'selected' : ''}>ES-ES</option>
          </select>
          <button class="craftools-icon-btn" title="${I18n.t('editor.themeToggle')}" id="theme-btn">
            <span class="material-symbols-outlined">dark_mode</span>
          </button>
        </div>
      </header>
      <div class="craftools-body">
        <div class="craftools-sidebar-overlay" id="sidebar-overlay"></div>
        <main class="craftools-canvas" id="canvas-area">
          <div class="craftools-pages" id="pages-wrapper">
            <section class="craftools-page" style="width: ${dimWidth}; min-height: ${dimHeight}; background: white;" id="main-page">
              <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 14px;"></div>
            </section>
          </div>
        </main>
      </div>
    </div>
    `;

    this.ctxBar = new CtxBar(this.querySelector('.craftools-app')!);
    this.bindEvents();
    this._initHistoryAndSession();
  }

  _initHistoryAndSession() {
    const pagesWrapper    = this.querySelector<HTMLElement>('#pages-wrapper')!;
    const undoBtn         = this.querySelector('#undo-btn') as HTMLButtonElement;
    const redoBtn         = this.querySelector('#redo-btn') as HTMLButtonElement;
    const historyIndicator = this.querySelector('#history-indicator') as HTMLElement;

    const updateHistoryUI = ({ count, max }: { count?: number; max?: number } = {}) => {
      undoBtn.disabled = !HistoryManager.canUndo;
      redoBtn.disabled = !HistoryManager.canRedo;
      const c = typeof count === 'number' ? count : HistoryManager.historyCount;
      const m = typeof max   === 'number' ? max   : HistoryManager.maxStates;
      historyIndicator.textContent = `${c}/${m}`;
      historyIndicator.title = I18n.t('editor.historyIndicatorDetail')
        .replace('{c}', String(c)).replace('{m}', String(m));
    };
    updateHistoryUI();

    undoBtn.addEventListener('click', () => {
      HistoryManager.undo(pagesWrapper);
      this._reattachAllPageEvents(pagesWrapper);
    });
    redoBtn.addEventListener('click', () => {
      HistoryManager.redo(pagesWrapper);
      this._reattachAllPageEvents(pagesWrapper);
    });

    this._onHistoryChange = (e: Event) => {
      updateHistoryUI((e as CustomEvent).detail ?? {});
    };
    document.addEventListener('craftools-history-change', this._onHistoryChange);

    this._onKeydown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); HistoryManager.undo(pagesWrapper); this._reattachAllPageEvents(pagesWrapper);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault(); HistoryManager.redo(pagesWrapper); this._reattachAllPageEvents(pagesWrapper);
        return;
      }

      // ── Element shortcuts: Delete, Ctrl+C / Ctrl+V, Arrow-key nudge ──────────
      const selected = document.querySelector<PositionedElement>('craftools-element.craftools-selected');

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selected || selected.getAttribute('data-locked') === 'true') return;
        e.preventDefault();
        // Reuse Element.ts's own delete-handle click handler rather than
        // duplicating its logic here -- it already dispatches
        // 'craftools-element-delete' (history snapshot) and correctly
        // removes every "linked" clone sharing the same data-linked-id
        // (Business Card mode), not just the selected one.
        selected.querySelector<HTMLElement>('.del-handle')?.click();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (!selected) return;
        e.preventDefault();
        window.__craftoolsElementClipboard = selected;
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        const source = window.__craftoolsElementClipboard;
        if (!source || !source.isConnected) return;
        e.preventDefault();
        this._pasteElementClipboard(source as PositionedElement);
        return;
      }

      if (selected && !e.ctrlKey && !e.metaKey && !e.altKey &&
          (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        if (selected.getAttribute('data-locked') === 'true') return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp')    selected.py -= step;
        if (e.key === 'ArrowDown')  selected.py += step;
        if (e.key === 'ArrowLeft') selected.px -= step;
        if (e.key === 'ArrowRight') selected.px += step;
        selected._applyTransform();
        selected.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element: selected } }));
      }
    };
    document.addEventListener('keydown', this._onKeydown);

    let actionDebounce: ReturnType<typeof setTimeout> | null = null;
    this.addEventListener('craftools-element-change', () => {
      clearTimeout(actionDebounce!);
      actionDebounce = setTimeout(() => {
        HistoryManager.snapshot(pagesWrapper);
        SessionManager.markDirty();
      }, 400);
      SessionManager.markDirty();
    });

    this.addEventListener('craftools-element-delete', () => {
      HistoryManager.snapshot(pagesWrapper); SessionManager.markDirty();
    });
    this._onPageAdd = () => {
      HistoryManager.snapshot(pagesWrapper); SessionManager.markDirty();
    };
    document.addEventListener('craftools-page-add', this._onPageAdd);

    setTimeout(() => HistoryManager.snapshot(pagesWrapper), 300);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const craftoolsSize = (window as any).craftoolsSize;
    const mediaKey = craftoolsSize?.key ?? 'unknown';
    SessionManager.startSession(mediaKey, craftoolsSize);
  }

  /**
   * Re-attaches PageTool events to all pages after undo/redo restore.
   * PageTool.attachPageEvents() is idempotent (guards itself against being
   * called twice on the same page node -- see its own comment), so this can
   * just call it unconditionally for every page rather than duplicating
   * that bookkeeping here.
   */
  _reattachAllPageEvents(pagesWrapper: Element | null): void {
    if (!pagesWrapper) return;
    pagesWrapper.querySelectorAll('.craftools-page').forEach(page => {
      PageTool.attachPageEvents(this, page as HTMLElement);
    });
  }

  /**
   * Ctrl+V handler (see the keydown listener in _initHistoryAndSession()):
   * clones `source` onto the same page it lives on, offset diagonally, and
   * selects the new copy.
   */
  private _pasteElementClipboard(source: PositionedElement): void {
    const page = source.closest<HTMLElement>('.craftools-page');
    if (!page) return;

    const clone = source.cloneNode(true) as PositionedElement;

    // cloneNode() only copies DOM attributes/children. Tool-specific state
    // kept as a plain JS expando on the element instance (not a DOM
    // attribute) is silently dropped otherwise -- e.g. PaperTool.ts/
    // ShapeTool.ts/IconTool.ts/StampTool.ts/CurvedTextTool.ts/
    // MiniCalendarTool.ts/EmojiKitchenTool.ts all set `el._craftoolsMeta`
    // directly, and TextTool.ts's autoFit toggle lives in
    // `_craftoolsAutoResize` the same way -- without this, pasting any of
    // those would create a visually-blank or default-state clone.
    clone._craftoolsMeta       = source._craftoolsMeta;
    clone._craftoolsAutoResize = source._craftoolsAutoResize;

    // The paste is a new, independent element -- it must not join the
    // source's "linked" clone group (Business Card mode, see PageTool.ts)
    // or inherit a locked state that would make it unmovable/undeletable
    // the moment it appears.
    clone.removeAttribute('data-linked-id');
    clone.removeAttribute('data-locked');

    // x/y attributes seed px/py in connectedCallback() (Element.ts) --
    // source.px/py is its LIVE position (drag/nudge never touch the x/y
    // attributes, only the transform), so read from there, not from
    // source's possibly-stale x/y attributes.
    const OFFSET = 20;
    clone.setAttribute('x', String(source.px + OFFSET));
    clone.setAttribute('y', String(source.py + OFFSET));

    page.appendChild(clone);
    clone.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element: clone } }));
    (clone as HTMLElement & { select?: () => void }).select?.();
  }

  bindEvents() {
    const isMobile = () => window.innerWidth <= 768;

    // Wires up the Canva-style footer (tool list <-> per-element property
    // bar). Dropped during the JS->TS migration (a0c7b5c) -- MobileToolbar.ts
    // kept its `init()` entry point, but no call site survived, so
    // `_footer` stayed null forever and every showToolMode()/showElementMode()
    // call silently no-op'd via its `if (!this._footer) return;` guard,
    // leaving the footer stuck on the default tool list even after
    // selecting an element. Restored to match the original Editor.js.
    MobileToolbar.init(this);

    // ── Sidebar helpers ─────────────────────────────────────────────────────
    const closeSidebar = () => {
      const rightPanel = document.getElementById('right-panel');
      if (rightPanel) {
        if (isMobile()) {
          rightPanel.classList.remove('panel-open', 'mobile-modal-mode');
        } else {
          rightPanel.classList.add('sidenav-collapsed');
        }
      }
      const sideOverlay = document.querySelector('.craftools-sidebar-overlay');
      if (sideOverlay) sideOverlay.classList.remove('visible');
      const menuIcon = document.getElementById('pwa-menu-icon');
      if (menuIcon) menuIcon.textContent = 'menu';
    };

    const restoreOriginalCanvas = () => {
      // Generic tool cleanup hook -- e.g. ImageSlicerTool's preview overlay.
      // Dropped during the TS migration along with the rest of this
      // function's body; restored here since ImageSlicerTool.ts relies on
      // editor.restoreOriginalCanvas() invoking it when switching tools.
      const cleanupFn = (this as unknown as { _toolCleanup?: () => void })._toolCleanup;
      if (typeof cleanupFn === 'function') {
        cleanupFn();
        delete (this as unknown as { _toolCleanup?: () => void })._toolCleanup;
      }
      const mainPage = document.getElementById('main-page');
      if (mainPage && this._savedPageHtml !== undefined) {
        mainPage.innerHTML = this._savedPageHtml;
        mainPage.style.cssText = this._savedPageCssText ?? '';
        delete this._savedPageHtml;
        delete this._savedPageCssText;
        PageTool.attachPageEvents(this, mainPage);
      }
      // Calendar/Gerador/ImageSlicer all show this same floating "Preview"
      // badge while taking over the canvas -- remove it here (once, in the
      // shared restore path) rather than in each tool.
      const badge = document.getElementById('gerador-canvas-badge');
      if (badge) badge.remove();
    };
    // Exposed on the instance so panel-only tools (CalendarTool.ts,
    // GeradorTool.ts) can call `editor.restoreOriginalCanvas()` themselves
    // right before generating real pages -- matches the pre-migration
    // Editor.js, which assigned this the same way.
    this.restoreOriginalCanvas = restoreOriginalCanvas;

    // ── Mobile menu toggle ──────────────────────────────────────────────────
    const mobileMenuBtn = this.querySelector('#mobile-menu-btn');
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        const rightPanel = document.getElementById('right-panel');
        if (rightPanel) {
          const isOpen = rightPanel.classList.contains('panel-open');
          if (isOpen) {
            closeSidebar();
          } else {
            rightPanel.classList.add('panel-open', 'mobile-modal-mode');
            const sideOverlay = document.querySelector('.craftools-sidebar-overlay');
            if (sideOverlay) sideOverlay.classList.add('visible');
            const menuIcon = document.getElementById('pwa-menu-icon');
            if (menuIcon) menuIcon.textContent = 'close';
          }
        }
      });
    }

    // ── Element selected (canvas element) ──────────────────────────────────
    // PRIORITY 5 KEY CHANGE: single ToolRegistry dispatch replaces 12-branch if/else.
    this.addEventListener('craftools-element-select', (e: Event) => {
      const ce = e as CustomEvent<{ element: HTMLElement }>;
      const el = ce.detail.element;
      const toolType = el.getAttribute('data-craftool') ?? '';

      const rightPanel  = document.getElementById('right-panel');
      const panelTitle  = document.getElementById('panel-title');
      const panelBody   = document.getElementById('panel-body');
      const defaultMenu = document.getElementById('panel-default-menu');
      const closePanel  = document.getElementById('close-panel');

      const openPanelMenu = () => {
        if (isMobile()) {
          MobileToolbar.showElementMode(el, toolType);
          return;
        }
        if (defaultMenu) defaultMenu.classList.add('d-none');
        if (panelBody)   panelBody.classList.remove('d-none');
        if (closePanel)  closePanel.classList.remove('d-none');
        if (rightPanel) {
          rightPanel.classList.add('panel-open');
          rightPanel.classList.remove('sidenav-collapsed');
          rightPanel.style.removeProperty('width');
          if (rightPanel.dataset.expandedWidth) rightPanel.style.width = rightPanel.dataset.expandedWidth;
        }
        const menuIcon = document.getElementById('pwa-menu-icon');
        if (menuIcon && menuIcon.textContent !== 'close') menuIcon.textContent = 'close';
      };

      const dispatch = (): void => {
        const toolDef = ToolRegistry.get(toolType);
        if (toolDef?.tool) {
          this.ctxBar.show(el, toolDef.tool.getCtxOptions(el));
          if (panelTitle) panelTitle.textContent = I18n.t(toolDef.label) || toolDef.label;
          if (panelBody)  toolDef.tool.renderPropertiesPanel(panelBody, el);
          openPanelMenu();
          this.activePage = null;
        } else {
          this.ctxBar.show(el, []);
        }
      };

      // Elements created fresh in this session already went through a
      // dynamic import to be created, so ToolRegistry already has them. An
      // element reconstructed from a restored session never went through
      // that path — lazily import its module now, on first selection.
      if (!ToolRegistry.has(toolType) && LAZY_TOOL_LOADERS[toolType]) {
        LAZY_TOOL_LOADERS[toolType]().then(dispatch);
      } else {
        dispatch();
      }
    });

    this.addEventListener('craftools-element-deselect', (e: Event) => {
      const ce = e as CustomEvent<{ element: HTMLElement }>;
      const el = ce.detail.element;
      if (el && el.getAttribute('data-craftool') === 'paper') el.style.zIndex = '1';
      this.ctxBar.hide();
      if (isMobile()) {
        MobileToolbar.showToolMode();
        return;
      }
      // Desktop: close the properties panel unless another element is
      // already selected (select() deselects the previous sibling *before*
      // marking the new one 'craftools-selected' and firing its own
      // 'craftools-element-select' -- both happen synchronously in the same
      // call stack, so this check reflects the final DOM state with no
      // visible flicker). Without this guard, deleting an element or
      // clicking empty canvas left the last-rendered properties panel
      // showing stale controls for an element that no longer exists/is
      // selected.
      if (document.querySelector('craftools-element.craftools-selected')) return;
      const rightPanel  = document.getElementById('right-panel');
      const panelTitle  = document.getElementById('panel-title');
      const panelBody   = document.getElementById('panel-body');
      const defaultMenu = document.getElementById('panel-default-menu');
      const closePanel  = document.getElementById('close-panel');
      if (defaultMenu) defaultMenu.classList.remove('d-none');
      if (panelBody)   panelBody.classList.add('d-none');
      if (closePanel)  closePanel.classList.add('d-none');
      if (panelTitle)  panelTitle.textContent = '';
      if (rightPanel)  rightPanel.classList.remove('mobile-modal-mode');
      this.activePage = null;
    });

    // ── Language select ─────────────────────────────────────────────────────
    (this.querySelector('#lang-select') as HTMLSelectElement)
      .addEventListener('change', (e) => {
        I18n.lang = (e.target as HTMLSelectElement).value;
        this.render();
      });

    // ── Theme toggle ────────────────────────────────────────────────────────
    const themeBtn = this.querySelector('#theme-btn')!;
    themeBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
      themeBtn.innerHTML = `<span class="material-symbols-outlined">${isDark ? 'dark_mode' : 'light_mode'}</span>`;
    });

    // ── Sidebar tool buttons ────────────────────────────────────────────────
    const toolBtns = document.querySelectorAll<HTMLElement>('.craftools-tool-btn[data-tool], .footer-nav-btn, .sidenav-nav a');
    const rightPanel  = document.getElementById('right-panel');
    const panelTitle  = document.getElementById('panel-title');
    const closePanel  = document.getElementById('close-panel');
    const panelBody   = document.getElementById('panel-body');
    const defaultMenu = document.getElementById('panel-default-menu');

    const openPanelMenu = () => {
      if (defaultMenu) defaultMenu.classList.add('d-none');
      if (panelBody)   panelBody.classList.remove('d-none');
      if (closePanel)  closePanel.classList.remove('d-none');
      if (rightPanel) {
        rightPanel.classList.add('panel-open');
        rightPanel.classList.remove('sidenav-collapsed');
        rightPanel.style.removeProperty('width');
        if (rightPanel.dataset.expandedWidth) rightPanel.style.width = rightPanel.dataset.expandedWidth;
        if (isMobile()) rightPanel.classList.add('mobile-modal-mode');
      }
      const menuIcon = document.getElementById('pwa-menu-icon');
      if (menuIcon && menuIcon.textContent !== 'close') menuIcon.textContent = 'close';
    };

    const closePanelMenu = () => {
      if (defaultMenu) defaultMenu.classList.remove('d-none');
      if (panelBody)   panelBody.classList.add('d-none');
      if (closePanel)  closePanel.classList.add('d-none');
      if (panelTitle)  panelTitle.textContent = '';
      if (rightPanel)  rightPanel.classList.remove('mobile-modal-mode');
      document.querySelectorAll('.craftools-tool-btn, .footer-nav-btn').forEach(b => b.classList.remove('active'));
      this.querySelectorAll('.craftools-grid-cell.cell-selected').forEach(c => c.classList.remove('cell-selected'));
      this.activePage = null;
      if (isMobile()) MobileToolbar.showToolMode();
      restoreOriginalCanvas();
    };

    // Desktop drag-and-drop source
    toolBtns.forEach(btn => {
      if (btn.getAttribute('draggable') === 'true') {
        btn.addEventListener('dragstart', (e) => {
          const tool = btn.dataset.tool ?? btn.id.replace('pwa-btn-', '').replace('pwa-sidebar-', '');
          (e as DragEvent).dataTransfer!.setData('ToolType', tool);
          (e as DragEvent).dataTransfer!.effectAllowed = 'copy';
        });
      }
    });

    // Mobile: tap to add (places tool in center of first visible page)
    const DRAGGABLE_CANVAS_TOOLS = new Set([
      'title','paragraph','image','album','qrcode','barcode','minicalendar',
      'emojikitchen','emoji','shape','variablecontent','curvedtext','stamp','icon',
    ]);

    toolBtns.forEach(btn => {
      const tool = btn.dataset.tool;
      if (!tool || !DRAGGABLE_CANVAS_TOOLS.has(tool)) return;

      btn.addEventListener('click', async () => {
        if (!isMobile()) return;
        closeSidebar();

        const mainPage = this.querySelector('.craftools-page') as HTMLElement | null;
        if (!mainPage) return;

        const rect   = mainPage.getBoundingClientRect();
        const scale  = window.craftoolsZoomLevel ?? 1;
        const cx     = rect.width  / scale / 2;
        const cy     = rect.height / scale / 2;

        if (tool === 'album') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const m: any = await import('../tools/album/AlbumWizard');
          m.AlbumTool.setup(this, mainPage);
          return;
        }
        if (tool === 'emoji') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const m: any = await import('../tools/emoji/EmojiTool.js');
          if (panelTitle) panelTitle.textContent = 'Emoji';
          if (panelBody)  m.EmojiTool.renderPickerPanel(panelBody, this);
          openPanelMenu();
          return;
        }
        if (tool === 'shape') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const m: any = await import('../tools/shape/ShapeTool.js');
          if (panelTitle) panelTitle.textContent = I18n.t('shapeTool.panelTitle');
          if (panelBody)  m.ShapeTool.renderPickerPanel(panelBody, this);
          openPanelMenu();
          return;
        }
        if (tool === 'icon') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const m: any = await import('../tools/icon/IconTool.js');
          if (panelTitle) panelTitle.textContent = I18n.t('iconTool.panelTitle');
          if (panelBody)  m.IconTool.renderPickerPanel(panelBody, this);
          openPanelMenu();
          return;
        }

        // Generic createElement via JS module (TS tools delegate createElement to JS).
        // Typed as `any` because TypeScript resolves .js imports to .ts stubs which
        // don't declare createElement — the real implementations live in .js files.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const MODULE_MAP: Record<string, () => Promise<any>> = {
          image:           () => import('../tools/image/ImageTool.js'),
          qrcode:          () => import('../tools/qrcode/QRCodeTool.js'),
          barcode:         () => import('../tools/barcode/BarcodeTool.js'),
          minicalendar:  () => import('../tools/minicalendar/MiniCalendarTool.js'),
          emojikitchen:    () => import('../tools/emojikitchen/EmojiKitchenTool.js'),
          variablecontent:() => import('../tools/variablecontent/VariableContentTool.js'),
          curvedtext:      () => import('../tools/curvedtext/CurvedTextTool.js'),
          stamp:           () => import('../tools/stamp/StampTool.js'),
          title:           () => import('../tools/text/TextTool.js'),
          paragraph:       () => import('../tools/text/TextTool.js'),
        };

        const offsets: Record<string, [number, number]> = {
          image: [-100,-100], qrcode: [-90,-90], barcode: [-110,-50],
          minicalendar: [-95,-105], emojikitchen: [-80,-80],
          variablecontent: [-110,-25], curvedtext: [-80,-80], stamp: [-80,-80],
          title: [-100,-30], paragraph: [-100,-30],
        };

        const loader = MODULE_MAP[tool];
        if (!loader) return;
        const mod = await loader();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ToolClass = Object.values(mod)[0] as any;
        if (!ToolClass?.createElement) return;

        const el = ToolClass.createElement(tool, this);
        const [ox, oy] = offsets[tool] ?? [-80,-80];
        el.setAttribute('x', String(cx + ox));
        el.setAttribute('y', String(cy + oy));
        mainPage.appendChild(el);

        const placeholder = mainPage.querySelector('div[style*="font-size: 14px"]');
        if (placeholder) placeholder.remove();

        // Select the newly created element so the mobile UX matches tapping
        // an existing element: fires 'craftools-element-select', which both
        // switches the footer into element mode AND (via MobileToolbar's
        // _keepElementVisible) scrolls/centers the canvas on it. Previously
        // a freshly added element on mobile stayed off-screen/unfocused
        // until the user hunted for it and tapped it manually. rAF + short
        // timeout matches the same pattern EmojiTool/ShapeTool/IconTool's
        // picker panels already use after inserting an element.
        const created = el as HTMLElement & { select?: () => void };
        requestAnimationFrame(() => { setTimeout(() => created.select?.(), 20); });
      });
    });

    // Restore canvas when clicking any tool other than gerador/calendar
    toolBtns.forEach(btn => {
      const tool = btn.dataset.tool ?? btn.id.replace('pwa-sidebar-', '').replace('pwa-btn-', '');
      if (tool !== 'gerador' && tool !== 'calendar') {
        btn.addEventListener('click', () => restoreOriginalCanvas());
      }
    });

    // Sidebar panel-open / setup dispatchers (desktop click)
    // Tools are grouped into: picker-panel tools, panel-only setup tools, element-creator sidebar tools.
    toolBtns.forEach(btn => {
      const tool = btn.dataset.tool ?? btn.id.replace('pwa-sidebar-', '');

      // ── Picker tools: open a panel so user picks which item to add ──────
      if (['emoji', 'shape', 'icon'].includes(tool)) {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          document.querySelectorAll('.craftools-tool-btn, .footer-nav-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (tool === 'emoji') {
            const m: any = await import('../tools/emoji/EmojiTool.js');
            if (panelTitle) panelTitle.textContent = 'Emoji';
            if (panelBody)  m.EmojiTool.renderPickerPanel(panelBody, this);
          } else if (tool === 'shape') {
            const m: any = await import('../tools/shape/ShapeTool.js');
            if (panelTitle) panelTitle.textContent = I18n.t('shapeTool.panelTitle');
            if (panelBody)  m.ShapeTool.renderPickerPanel(panelBody, this);
          } else if (tool === 'icon') {
            const m: any = await import('../tools/icon/IconTool.js');
            if (panelTitle) panelTitle.textContent = I18n.t('iconTool.panelTitle');
            if (panelBody)  m.IconTool.renderPickerPanel(panelBody, this);
          }
          openPanelMenu();
        });
      }

      // ── Panel-only tools + element-creator sidebar tools ─────────────────
      const SIDEBAR_CLICK_TOOLS = new Set([
        'gerador','agenda','calendar','album','imageslicer','curvedtext','stamp',
      ]);
      if (SIDEBAR_CLICK_TOOLS.has(tool)) {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          document.querySelectorAll('.craftools-tool-btn, .footer-nav-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          // album: open the wizard panel on the active page
          if (tool === 'album') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m: any = await import('../tools/album/AlbumWizard');
            const targetPage = (this.activePage ?? this.querySelector('.craftools-page')) as HTMLElement | null;
            if (targetPage) m.AlbumTool.setup(this, targetPage);
            return;
          }

          // curvedtext / stamp: create element directly on the active page
          if (tool === 'curvedtext') {
            if (isMobile()) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m: any = await import('../tools/curvedtext/CurvedTextTool.js');
            const targetPage = (this.activePage ?? this.querySelector('.craftools-page')) as HTMLElement | null;
            if (targetPage) { const el = m.CurvedTextTool.createElement('curvedtext', this); targetPage.appendChild(el); closeSidebar(); }
            return;
          }
          if (tool === 'stamp') {
            if (isMobile()) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m: any = await import('../tools/stamp/StampTool.js');
            const targetPage = (this.activePage ?? this.querySelector('.craftools-page')) as HTMLElement | null;
            if (targetPage) { const el = m.StampTool.createElement('stamp', this); targetPage.appendChild(el); closeSidebar(); }
            return;
          }

          // gerador: save page HTML before taking it over as live preview
          if (tool === 'gerador') {
            const mainPage = document.getElementById('main-page');
            if (mainPage && this._savedPageHtml === undefined) {
              this._savedPageHtml    = mainPage.innerHTML;
              this._savedPageCssText = mainPage.style.cssText;
            }
          }

          // panel-only tools: agenda / calendar / gerador / imageslicer
          openPanelMenu();
          this.activePage = null;
          const setupLoader = PANEL_SETUP_MAP[tool];
          if (setupLoader) {
            const setupFn = await setupLoader();
            await setupFn(this);
          } else {
            if (panelTitle) panelTitle.textContent = (btn as HTMLElement).title || I18n.t('editor.papers');
            if (panelBody)  panelBody.innerHTML = `<div style="padding:14px;"><p style="font-size:12px;color:var(--text-secondary)">${I18n.t('editor.emptyPanel')}</p></div>`;
          }
        });
      }
    });

    // Close-panel button
    if (closePanel) closePanel.addEventListener('click', () => closePanelMenu());

    // Close the page-properties panel when clicking outside the active page.
    // Unlike craftools-element (which owns its own per-instance outside-click
    // handler in Element.ts, wired up on select()), the page panel opened by
    // PageTool.ts's pageEl click handler never had an outside-click listener
    // at all -- clicking empty canvas or a different page left the page
    // panel showing forever, unlike every other element type which already
    // closes correctly (see the 'craftools-element-deselect' handler above).
    this._onPointerdown = (e: PointerEvent) => {
      if (!this.activePage) return;
      const t = e.target as Element | null;
      if (
        this.activePage.contains(t) ||
        t?.closest?.('craftools-element') ||
        t?.closest?.('.craftools-ctxbar') ||
        t?.closest?.('.craftools-panel') ||
        t?.closest?.('.footer-nav-area') ||
        t?.closest?.('#mobile-mini-panel') ||
        t?.closest?.('#mobile-mini-overlay') ||
        t?.closest?.('#bottom-sheet') ||
        t?.closest?.('#sheet-overlay') ||
        t?.closest?.('#api-picker-backdrop') ||
        // Same reasoning as the exclusion in Element.ts's outside handler:
        // the font dropdown list renders in document.body, outside
        // '.craftools-panel'.
        t?.closest?.('.ct-font-select-dropdown')
      ) {
        return;
      }
      closePanelMenu();
    };
    document.addEventListener('pointerdown', this._onPointerdown, { capture: true });

    // ── New Page ────────────────────────────────────────────────────────────
    document.querySelectorAll('#new-page-btn, #pwa-sidebar-newpage').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        PageTool.addNewPage(this);
        closeSidebar();
      });
    });

    // ── PDF Export ──────────────────────────────────────────────────────────
    document.querySelectorAll('#pdf-btn, #pwa-sidebar-export').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); closeSidebar(); PdfExport.print(this); });
    });

    // ── PNG / JPG Export ────────────────────────────────────────────────────
    document.querySelectorAll('#pwa-sidebar-png').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); closeSidebar(); ImageExport.export(this); });
    });

    // ── Attach page events to initial page ─────────────────────────────────
    const mainPage = this.querySelector('#main-page') as HTMLElement;
    PageTool.attachPageEvents(this, mainPage);

    // Notify history of page add
    document.querySelectorAll('#new-page-btn, #pwa-sidebar-newpage').forEach(btn => {
      btn.addEventListener('click', () => {
        setTimeout(() => {
          const pagesWrapper = this.querySelector<HTMLElement>('#pages-wrapper');
          if (pagesWrapper) HistoryManager.snapshot(pagesWrapper);
          SessionManager.markDirty();
        }, 100);
      });
    });

    // ── Zoom ────────────────────────────────────────────────────────────────
    let zoomLevel = 1.0;
    window.craftoolsZoomLevel = 1.0;
    const zoomLevelLabel = this.querySelector('#zoom-level')!;
    const pagesWrapper   = this.querySelector('#pages-wrapper') as HTMLElement;

    const updateZoom = () => {
      if (pagesWrapper) {
        pagesWrapper.style.transform = `scale(${zoomLevel})`;
        zoomLevelLabel.textContent = Math.round(zoomLevel * 100) + '%';
        window.craftoolsZoomLevel = zoomLevel;
      }
    };

    (this.querySelector('#zoom-in-btn')  as HTMLButtonElement).addEventListener('click', () => { if (zoomLevel < 3.0) { zoomLevel += 0.1; updateZoom(); } });
    (this.querySelector('#zoom-out-btn') as HTMLButtonElement).addEventListener('click', () => { if (zoomLevel > 0.2) { zoomLevel -= 0.1; updateZoom(); } });
    (this.querySelector('#zoom-reset-btn') as HTMLButtonElement).addEventListener('click', () => { zoomLevel = 1.0; updateZoom(); });

    // ── Pinch-to-zoom (mobile) ──────────────────────────────────────────────
    const canvas = this.querySelector('#canvas-area')!;
    let pinchStartDist: number | null = null;
    let pinchStartZoom = 1.0;

    canvas.addEventListener('touchstart', (e: Event) => {
      const te = e as TouchEvent;
      if (te.touches.length === 2) {
        const dx = te.touches[0].clientX - te.touches[1].clientX;
        const dy = te.touches[0].clientY - te.touches[1].clientY;
        pinchStartDist = Math.hypot(dx, dy);
        pinchStartZoom = zoomLevel;
      }
    }, { passive: true });

    let isZooming = false;
    canvas.addEventListener('touchmove', (e: Event) => {
      const te = e as TouchEvent;
      if (te.touches.length === 2 && pinchStartDist) {
        if (isZooming) return;
        isZooming = true;
        requestAnimationFrame(() => {
          const dx = te.touches[0].clientX - te.touches[1].clientX;
          const dy = te.touches[0].clientY - te.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const scale = dist / pinchStartDist!;
          zoomLevel = Math.min(3.0, Math.max(0.2, pinchStartZoom * scale));
          updateZoom();
          isZooming = false;
        });
      }
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
      if (pinchStartDist) pinchStartDist = null;
    }, { passive: true });
  }

  static init() { customElements.define(Craftools_Editor.TAG_NAME, Craftools_Editor); }
}
