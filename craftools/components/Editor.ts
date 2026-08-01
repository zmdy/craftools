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
import { HistoryManager } from '../utils/HistoryManager.js';
import { SessionManager } from '../utils/SessionManager.js';
import { MobileToolbar } from '../utils/MobileToolbar.js';
import { ToolRegistry } from '../utils/ToolRegistry';
import { centerElementOnPage } from '../utils/ElementPlacement.js';
import { AppSettings } from '../utils/AppSettings.js';
import { Notify } from '../utils/Notify.js';
// PdfExport, ImageExport and ProjectSerializer are intentionally NOT imported
// statically here. All three are only ever used inside button-click callbacks
// (export actions) -- loading them eagerly would pull html2canvas (332 KB)
// and html-to-svg (385 KB) into the startup bundle for no benefit. The
// dynamic imports below load each module the first time the user clicks the
// corresponding button.

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
  _craftoolsVariable?: unknown;
  deselect?: () => void;
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
  lettering:        () => import('../tools/lettering/LetteringTool.js'),
  paper:            () => import('../tools/paper/PaperTool.js'),
  variablecontent: () => import('../tools/variablecontent/VariableContentTool.js'),
  table:            () => import('../tools/table/TableTool.js'),
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
  generator: () => import('../tools/generator/GeneratorTool.js').then((m: any) => m.GeneratorTool.setup.bind(m.GeneratorTool)),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  imageslicer: () => import('../tools/imageslicer/ImageSlicerTool.js').then((m: any) => m.ImageSlicerTool.setup.bind(m.ImageSlicerTool)),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: () => import('../tools/settings/SettingsTool.js').then((m: any) => m.SettingsTool.setup.bind(m.SettingsTool)),
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
  // Exposed for panel-only tools (CalendarTool, GeneratorTool) that take over
  // #main-page as a live preview and need to restore it afterward -- was
  // assigned in bindEvents() below (`this.restoreOriginalCanvas = ...`) in
  // the pre-migration Editor.js but dropped during the TS port, silently
  // breaking those tools' editor.restoreOriginalCanvas() calls.
  restoreOriginalCanvas?: () => void;

  private _onHistoryChange?: (e: Event) => void;
  private _onKeydown?: (e: KeyboardEvent) => void;
  private _onPageAdd?: (e: Event) => void;
  private _onPointerdown?: (e: PointerEvent) => void;
  // Keeps the ctx-bar and the properties panel in sync with each other --
  // see the 'craftools-element-select' handler below for how this is wired
  // and why it lives on the instance (so the deselect handler and the next
  // selection can both remove the previous element's listener instead of
  // leaking one every time the same element is reselected).
  private _panelSyncHandler?: (e: Event) => void;
  private _panelSyncTarget?: HTMLElement;

  constructor() { super(); }

  connectedCallback() {
    // Apply the saved snap/align defaults (Configurações panel) to their
    // runtime globals before anything is dragged or selected this session.
    AppSettings.applyRuntimeDefaults();
    this.render();
  }

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

      // ── Element shortcuts: Esc, Delete, Ctrl+C / Ctrl+V, Arrow-key nudge ─────
      const selected = document.querySelector<PositionedElement>('craftools-element.craftools-selected');

      if (e.key === 'Escape') {
        if (!selected) return;
        e.preventDefault();
        // Element.ts's own outside-click handler calls this exact method --
        // reusing it (rather than duplicating the panel-close/ctxbar-hide
        // logic here) guarantees Esc behaves identically to clicking outside
        // the element, including the 'craftools-element-deselect' event
        // Editor.ts listens for to close the properties panel.
        selected.deselect?.();
        return;
      }

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
    //
    // Deep-cloned (JSON round-trip, both are always plain JSON-safe data),
    // NOT assigned by reference -- `clone._craftoolsMeta = source._craftoolsMeta`
    // used to point both elements at the very SAME object, so editing
    // either one's config (QR/Barcode payload, Shape/Icon/Stamp/etc.
    // settings) after a paste silently mutated the "other" one too, since
    // both were reading/writing through one shared reference.
    clone._craftoolsMeta       = source._craftoolsMeta ? JSON.parse(JSON.stringify(source._craftoolsMeta)) : source._craftoolsMeta;
    clone._craftoolsAutoResize = source._craftoolsAutoResize;
    // Variable Content's own binding cache (VariablePanel.ts's "Vincular a"
    // reads this first, before falling back to `dataset.ctState`) -- same
    // deep-clone reasoning as `_craftoolsMeta` above. Copying it here means
    // a pasted copy shows up as a link candidate (and keeps working as a
    // leader/follower itself) immediately, without requiring the user to
    // select it once first to prime it via `_syncFromDOM()`.
    clone._craftoolsVariable = source._craftoolsVariable ? JSON.parse(JSON.stringify(source._craftoolsVariable)) : source._craftoolsVariable;

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
      // Calendar/Generator/ImageSlicer all show this same floating "Preview"
      // badge while taking over the canvas -- remove it here (once, in the
      // shared restore path) rather than in each tool.
      const badge = document.getElementById('generator-canvas-badge');
      if (badge) badge.remove();
    };
    // Exposed on the instance so panel-only tools (CalendarTool.ts,
    // GeneratorTool.ts) can call `editor.restoreOriginalCanvas()` themselves
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

      // Desktop: pan/scroll #canvas-area so the selected element is
      // centered in the visible viewport -- the same idea mobile already
      // has via MobileToolbar._keepElementVisible(), but computed manually
      // instead of via el.scrollIntoView(). scrollIntoView() walks and
      // scrolls EVERY scrollable ancestor between the element and the
      // viewport (and respects scroll-padding CSS, which MobileToolbar's
      // _updateScrollReserve() sets on #canvas-area for its own bottom-bar
      // reserve) -- in practice that ended up also nudging #right-panel's
      // size/position and leaving stray blank space above the bottom bar.
      // Scrolling #canvas-area's own scrollTop/scrollLeft directly touches
      // only the canvas, never the properties panel or anything else.
      // getBoundingClientRect() on both sides is post-zoom-transform, so
      // this still needs no manual zoom math.
      const defaultAutoCenter = AppSettings.get('defaultAutoCenterOnSelect');
      let elAutoCenter = el.getAttribute('data-autocenter');
      if (el.dataset.ctState) {
        try {
          const state = JSON.parse(el.dataset.ctState);
          if (state.autoCenter !== undefined) elAutoCenter = state.autoCenter ? 'true' : 'false';
        } catch (e) {}
      }
      const shouldCenter = elAutoCenter === 'true' || (defaultAutoCenter && elAutoCenter !== 'false');

      if (!isMobile() && shouldCenter) {
        const canvasArea = document.getElementById('canvas-area');
        if (canvasArea) {
          const canvasRect = canvasArea.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const deltaX = (elRect.left + elRect.width / 2) - (canvasRect.left + canvasRect.width / 2);
          const deltaY = (elRect.top + elRect.height / 2) - (canvasRect.top + canvasRect.height / 2);
          canvasArea.scrollBy({ left: deltaX, top: deltaY, behavior: 'smooth' });
        }
      }

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
          const tool = toolDef.tool;
          this.ctxBar.show(el, tool.getCtxOptions(el));
          if (panelTitle) panelTitle.textContent = I18n.t(toolDef.label) || toolDef.label;
          if (panelBody)  tool.renderPropertiesPanel(panelBody, el);
          openPanelMenu();
          this.activePage = null;

          // Keep the properties panel in sync when the ctx-bar changes the
          // element's state (CtxBar mirrors this the other way -- it
          // re-shows itself on the same event, see CtxBar.show()'s
          // 'craftools-state-change' listener). Detach the previous
          // element's listener first so reselecting never leaks one.
          if (this._panelSyncHandler && this._panelSyncTarget) {
            this._panelSyncTarget.removeEventListener('craftools-state-change', this._panelSyncHandler);
          }
          this._panelSyncHandler = (e: Event) => {
            // Skip changes the panel itself just caused (tagged by
            // PropertyRenderer.runFromPanel() -- see its own doc comment).
            // This handler's only real job is the ctx-bar -> panel
            // direction; re-running it for the panel's OWN change used to
            // force a synchronous full re-render of the very field the
            // user was mid-interaction with (e.g. destroying the color
            // picker's native <input type="color"> while its OS popup was
            // still open, closing it after the very first pick).
            const detail = (e as CustomEvent).detail as { fromPanel?: boolean } | undefined;
            if (detail?.fromPanel) return;
            if (panelBody) tool.renderPropertiesPanel(panelBody, el);
          };
          this._panelSyncTarget = el;
          el.addEventListener('craftools-state-change', this._panelSyncHandler);
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
      if (this._panelSyncHandler && this._panelSyncTarget) {
        this._panelSyncTarget.removeEventListener('craftools-state-change', this._panelSyncHandler);
        this._panelSyncHandler = undefined;
        this._panelSyncTarget  = undefined;
      }
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
      // Deselecting an element (delete, click empty canvas, etc.) closes
      // whatever properties panel was showing it -- the sidebar/footer tool
      // button that opened it needs to lose its highlight too, same as
      // closePanelMenu() does when the user closes the panel explicitly.
      // `clearToolActive` is defined further down in this same bindEvents()
      // call, but this listener only ever RUNS later (on the deselect
      // event), by which point the whole function has already finished
      // executing and the const is safely initialized.
      clearToolActive();
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
    // Every "clear the highlighted sidebar/footer tool button" call used to
    // re-query its own ad hoc selector ('.craftools-tool-btn, .footer-nav-btn'
    // -- copied from the mobile footer toolbar) that never actually matched
    // the desktop sidebar's `.sidenav-nav a` buttons, even though `toolBtns`
    // above (the set actually clicked/activated) always included them. Net
    // effect: clicking a sidebar tool added 'active' to it directly (that
    // part targets the specific clicked element, so it always worked), but
    // every later "clear" call silently missed it, so it and every
    // previously-clicked sidebar button stayed highlighted forever. Reusing
    // the exact same `toolBtns` collection here guarantees the set that gets
    // cleared always matches the set that can get 'active' added to it.
    const clearToolActive = (): void => toolBtns.forEach(b => b.classList.remove('active'));
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
      clearToolActive();
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
      'emojikitchen','emoji','shape','variablecontent','curvedtext','stamp','icon','table','lettering',
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
        if (tool === 'table') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const m: any = await import('../tools/table/TableTool.js');
          if (panelTitle) panelTitle.textContent = I18n.t('tableTool.pickerTitle');
          if (panelBody)  m.TableTool.renderPickerPanel(panelBody, this);
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
          lettering:       () => import('../tools/lettering/LetteringTool.js'),
          title:           () => import('../tools/text/TextTool.js'),
          paragraph:       () => import('../tools/text/TextTool.js'),
        };

        const offsets: Record<string, [number, number]> = {
          image: [-100,-100], qrcode: [-90,-90], barcode: [-110,-50],
          minicalendar: [-95,-105], emojikitchen: [-80,-80],
          variablecontent: [-110,-25], curvedtext: [-80,-80], stamp: [-80,-80],
          lettering: [-180,-70],
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

    // Restore canvas when clicking any tool other than generator/calendar
    toolBtns.forEach(btn => {
      const tool = btn.dataset.tool ?? btn.id.replace('pwa-sidebar-', '').replace('pwa-btn-', '');
      if (tool !== 'generator' && tool !== 'calendar') {
        btn.addEventListener('click', () => restoreOriginalCanvas());
      }
    });

    // Sidebar panel-open / setup dispatchers (desktop click)
    // Tools are grouped into: picker-panel tools, panel-only setup tools, element-creator sidebar tools.
    toolBtns.forEach(btn => {
      const tool = btn.dataset.tool ?? btn.id.replace('pwa-sidebar-', '');

      // ── Picker tools: open a panel so user picks which item to add ──────
      if (['emoji', 'shape', 'icon', 'table'].includes(tool)) {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          clearToolActive();
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
          } else if (tool === 'table') {
            const m: any = await import('../tools/table/TableTool.js');
            if (panelTitle) panelTitle.textContent = I18n.t('tableTool.pickerTitle');
            if (panelBody)  m.TableTool.renderPickerPanel(panelBody, this);
          }
          openPanelMenu();
        });
      }

      // ── Panel-only tools + element-creator sidebar tools ─────────────────
      // Every tool button now activates the same way whether clicked or
      // dragged onto the canvas (see the matching drop-handler branches in
      // PageTool.ts): panel/wizard tools open their panel either way;
      // element-creator tools place a new element either way -- centered on
      // simple click, at the drop point when dragged.
      const ELEMENT_CREATOR_TOOLS = new Set([
        'curvedtext', 'stamp', 'lettering', 'title', 'paragraph', 'variablecontent',
        'image', 'qrcode', 'barcode', 'minicalendar', 'emojikitchen',
      ]);
      const SIDEBAR_CLICK_TOOLS = new Set([
        'generator', 'agenda', 'calendar', 'album', 'imageslicer', 'settings',
        ...ELEMENT_CREATOR_TOOLS,
      ]);
      if (SIDEBAR_CLICK_TOOLS.has(tool)) {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          clearToolActive();
          btn.classList.add('active');

          // album: open the wizard panel on the active page
          if (tool === 'album') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m: any = await import('../tools/album/AlbumWizard');
            const targetPage = (this.activePage ?? this.querySelector('.craftools-page')) as HTMLElement | null;
            if (targetPage) m.AlbumTool.setup(this, targetPage);
            return;
          }

          // Element-creator tools: create directly on the active page,
          // centered (mobile has its own equivalent tap-to-add handler
          // above -- DRAGGABLE_CANVAS_TOOLS -- so this branch no-ops there
          // to avoid double-creating).
          if (ELEMENT_CREATOR_TOOLS.has(tool)) {
            if (isMobile()) return;
            const targetPage = (this.activePage ?? this.querySelector('.craftools-page')) as HTMLElement | null;
            const loader = LAZY_TOOL_LOADERS[tool];
            if (!targetPage || !loader) return;
            const mod = await loader();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ToolClass = Object.values(mod as object)[0] as any;
            if (!ToolClass?.createElement) return;
            const el = ToolClass.createElement(tool, this) as HTMLElement & { select?: () => void };
            centerElementOnPage(el, targetPage);
            targetPage.appendChild(el);
            closeSidebar();
            // Select the new element so desktop matches mobile's UX after
            // creation (also triggers the auto-center-on-select scroll
            // above). Same rAF+timeout pattern the mobile handler and the
            // Emoji/Shape/Icon pickers already use.
            requestAnimationFrame(() => { setTimeout(() => el.select?.(), 20); });
            return;
          }

          // generator: save page HTML before taking it over as live preview
          if (tool === 'generator') {
            const mainPage = document.getElementById('main-page');
            if (mainPage && this._savedPageHtml === undefined) {
              this._savedPageHtml    = mainPage.innerHTML;
              this._savedPageCssText = mainPage.style.cssText;
            }
          }

          // panel-only tools: agenda / calendar / generator / imageslicer
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
      btn.addEventListener('click', async (e) => {
        e.preventDefault(); closeSidebar();
        const { PdfExport } = await import('../utils/PdfExport.js');
        PdfExport.print(this);
      });
    });

    // ── PNG / JPG Export ────────────────────────────────────────────────────
    document.querySelectorAll('#pwa-sidebar-png').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault(); closeSidebar();
        const { ImageExport } = await import('../utils/ImageExport.js');
        ImageExport.export(this);
      });
    });

    // ── JSON Project Export / Import ─────────────────────────────────────────
    const projPagesWrapper = this.querySelector<HTMLElement>('#pages-wrapper')!;

    document.querySelectorAll('#pwa-sidebar-export-project').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        closeSidebar();
        
        const defaultTitle = 'Projeto CrafTools';
        const title = window.prompt(I18n.t('editor.exportProjectPrompt') || 'Digite o nome do seu projeto:', defaultTitle);
        if (title === null) return; // Cancelled
        
        const finalTitle = title.trim() || defaultTitle;
        
        const dismissLoading = Notify.toast(I18n.t('editor.generating') || 'Gerando projeto...', 'info', 60_000);
        try {
          const { ProjectSerializer } = await import('../utils/ProjectSerializer.js');
          const blob = await ProjectSerializer.exportProject(projPagesWrapper, finalTitle);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${finalTitle}.craftools`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('[Editor] Export project failed:', err);
          Notify.toast(I18n.t('agendaExportTool.exportError') || 'Erro ao exportar', 'error');
        } finally {
          dismissLoading?.();
        }
      });
    });

    const fileInput = document.getElementById('project-import-file') as HTMLInputElement;
    document.querySelectorAll('#pwa-sidebar-import-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeSidebar();
        fileInput?.click();
      });
    });

    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const dismissLoading = Notify.toast(I18n.t('editor.generating') || 'Carregando projeto...', 'info', 60_000);
      try {
        const { ProjectSerializer } = await import('../utils/ProjectSerializer.js');
        const importedTitle = await ProjectSerializer.importProject(projPagesWrapper, file);
        
        // Re-attach page events to all new pages in projPagesWrapper
        this._reattachAllPageEvents(projPagesWrapper);

        // Force history snapshot and session autosave
        HistoryManager.snapshot(projPagesWrapper);
        SessionManager.markDirty();

        Notify.toast(I18n.t('editor.importSuccess').replace('{title}', importedTitle), 'success');
      } catch (err) {
        console.error('[Editor] Import project failed:', err);
        Notify.toast(I18n.t('editor.importError'), 'error');
      } finally {
        fileInput.value = '';
        dismissLoading?.();
      }
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
