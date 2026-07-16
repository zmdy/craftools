/**
 * Editor.ts — TypeScript replacement for Editor.js (Priority 5).
 *
 * Key changes vs Editor.js:
 *  - Removed static imports for TextTool / ImageTool / QRCodeTool.
 *  - Added ToolRegistry import + side-effect imports for all TS tool files
 *    (each file registers itself when imported).
 *  - craftools-element-select handler: replaced 12-branch if/else chain with
 *    a single ToolRegistry.get() dispatch (~110 lines → ~25 lines).
 *  - Sidebar tool click handler: panel-only tools use PANEL_SETUP_MAP;
 *    picker tools (emoji/shape/icon) kept as dynamic imports.
 *  - Everything else (zoom, history, session, export, drag-drop) unchanged.
 */

import { Craftools_Settings } from '../settings/Settings.js';
import { PageTool } from '../tools/page/PageTool.js';
import { CtxBar } from '../utils/CtxBar.js';
import { I18n } from '../settings/Translations.js';
import { PdfExport } from '../utils/PdfExport.js';
import { ImageExport } from '../utils/ImageExport.js';
import { HistoryManager } from '../utils/HistoryManager.js';
import { SessionManager } from '../utils/SessionManager.js';
import { MobileToolbar } from '../utils/MobileToolbar.js';

// ── ToolRegistry + all tool side-effect registrations ─────────────────────────
import { ToolRegistry } from '../utils/ToolRegistry';

// Canvas tools — each call ToolRegistry.register() at module evaluation time
import '../tools/text/TextTool';
import '../tools/image/ImageTool';
import '../tools/shape/ShapeTool';
import '../tools/icon/IconTool';
import '../tools/emoji/EmojiTool';
import '../tools/qrcode/QRCodeTool';
import '../tools/barcode/BarcodeTool';
import '../tools/minicalendar/MiniCalendarTool';
import '../tools/emojikitchen/EmojiKitchenTool';
import '../tools/variablecontent/VariableContentTool';
import '../tools/textocurvo/TextoCurvoTool';
import '../tools/carimbo/CarimboTool';
import '../tools/paper/PaperTool';

// Panel-only stubs — register with panelOnly: true
import '../tools/agenda/AgendaExportTool';
import '../tools/album/AlbumTool';
import '../tools/calendar/CalendarTool';
import '../tools/gerador/GeradorTool';
import '../tools/imageslicer/ImageSlicerTool';

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
  calendario:() => import('../tools/calendar/CalendarTool.js').then((m: any) => m.CalendarTool.setup.bind(m.CalendarTool)),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gerador:   () => import('../tools/gerador/GeradorTool.js').then((m: any) => m.GeradorTool.setup.bind(m.GeradorTool)),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fatiador:  () => import('../tools/imageslicer/ImageSlicerTool.js').then((m: any) => m.ImageSlicerTool.setup.bind(m.ImageSlicerTool)),
};

// ── Editor custom element ──────────────────────────────────────────────────────

export class Craftools_Editor extends HTMLElement {
  ctxBar!: CtxBar;
  activePage: Element | null = null;
  _savedPageHtml?: string;
  _savedPageCssText?: string;

  constructor() { super(); }

  connectedCallback() { this.render(); }

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
    const pagesWrapper    = this.querySelector('#pages-wrapper')!;
    const undoBtn         = this.querySelector('#undo-btn') as HTMLButtonElement;
    const redoBtn         = this.querySelector('#redo-btn') as HTMLButtonElement;
    const historyIndicator = this.querySelector('#history-indicator') as HTMLElement;

    // canUndo / canRedo are getter properties (not methods) in HistoryManager.js
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hm = HistoryManager as any;

    const updateHistoryUI = ({ count, max }: { count?: number; max?: number } = {}) => {
      undoBtn.disabled = !hm.canUndo;
      redoBtn.disabled = !hm.canRedo;
      const c = typeof count === 'number' ? count : (hm.historyCount as number);
      const m = typeof max   === 'number' ? max   : (hm.maxStates   as number);
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

    document.addEventListener('craftools-history-change', (e: Event) => {
      updateHistoryUI((e as CustomEvent).detail ?? {});
    });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); HistoryManager.undo(pagesWrapper); this._reattachAllPageEvents(pagesWrapper);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault(); HistoryManager.redo(pagesWrapper); this._reattachAllPageEvents(pagesWrapper);
      }
    });

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
    document.addEventListener('craftools-page-add', () => {
      HistoryManager.snapshot(pagesWrapper); SessionManager.markDirty();
    });

    setTimeout(() => HistoryManager.snapshot(pagesWrapper), 300);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const craftoolsSize = (window as any).craftoolsSize;
    const mediaKey = craftoolsSize?.key ?? 'unknown';
    SessionManager.startSession(mediaKey, craftoolsSize);
  }

  /** Re-attaches PageTool events to all pages after undo/redo restore. */
  _reattachAllPageEvents(pagesWrapper: Element | null): void {
    if (!pagesWrapper) return;
    pagesWrapper.querySelectorAll('.craftools-page').forEach(page => {
      const p = page as HTMLElement & { _craftoolsEventsAttached?: boolean };
      if (!p._craftoolsEventsAttached) {
        PageTool.attachPageEvents(this, page as HTMLElement);
        p._craftoolsEventsAttached = true;
      }
    });
  }

  bindEvents() {
    const isMobile = () => window.innerWidth <= 768;

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
      const mainPage = document.getElementById('main-page');
      if (mainPage && this._savedPageHtml !== undefined) {
        mainPage.innerHTML = this._savedPageHtml;
        mainPage.style.cssText = this._savedPageCssText ?? '';
        delete this._savedPageHtml;
        delete this._savedPageCssText;
        PageTool.attachPageEvents(this, mainPage);
      }
    };

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
        }
        const menuIcon = document.getElementById('pwa-menu-icon');
        if (menuIcon && menuIcon.textContent !== 'close') menuIcon.textContent = 'close';
      };

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
    });

    this.addEventListener('craftools-element-deselect', (e: Event) => {
      const ce = e as CustomEvent<{ element: HTMLElement }>;
      const el = ce.detail.element;
      if (el && el.getAttribute('data-craftool') === 'papeis') el.style.zIndex = '1';
      this.ctxBar.hide();
      if (isMobile()) MobileToolbar.showToolMode();
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
      'titulo','paragrafo','imagem','album','qrcode','barcode','minicalendario',
      'emojikitchen','emoji','shape','conteudovariavel','textocurvo','carimbo','icone',
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
        const scale  = (window as any).craftoolsZoomLevel ?? 1;
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
        if (tool === 'icone') {
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
          imagem:          () => import('../tools/image/ImageTool.js'),
          qrcode:          () => import('../tools/qrcode/QRCodeTool.js'),
          barcode:         () => import('../tools/barcode/BarcodeTool.js'),
          minicalendario:  () => import('../tools/minicalendar/MiniCalendarTool.js'),
          emojikitchen:    () => import('../tools/emojikitchen/EmojiKitchenTool.js'),
          conteudovariavel:() => import('../tools/variablecontent/VariableContentTool.js'),
          textocurvo:      () => import('../tools/textocurvo/TextoCurvoTool.js'),
          carimbo:         () => import('../tools/carimbo/CarimboTool.js'),
          titulo:          () => import('../tools/text/TextTool.js'),
          paragrafo:       () => import('../tools/text/TextTool.js'),
        };

        const offsets: Record<string, [number, number]> = {
          imagem: [-100,-100], qrcode: [-90,-90], barcode: [-110,-50],
          minicalendario: [-95,-105], emojikitchen: [-80,-80],
          conteudovariavel: [-110,-25], textocurvo: [-80,-80], carimbo: [-80,-80],
          titulo: [-100,-30], paragrafo: [-100,-30],
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
      });
    });

    // Restore canvas when clicking any tool other than gerador/calendario
    toolBtns.forEach(btn => {
      const tool = btn.dataset.tool ?? btn.id.replace('pwa-sidebar-', '').replace('pwa-btn-', '');
      if (tool !== 'gerador' && tool !== 'calendario') {
        btn.addEventListener('click', () => restoreOriginalCanvas());
      }
    });

    // Sidebar panel-open / setup dispatchers (desktop click)
    // Tools are grouped into: picker-panel tools, panel-only setup tools, element-creator sidebar tools.
    const PICKER_TOOLS: Record<string, { getTitle: () => string; render: (pb: HTMLElement, ed: HTMLElement) => void }> = {};

    toolBtns.forEach(btn => {
      const tool = btn.dataset.tool ?? btn.id.replace('pwa-sidebar-', '');

      // ── Picker tools: open a panel so user picks which item to add ──────
      if (['emoji', 'shape', 'icone'].includes(tool)) {
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
          } else if (tool === 'icone') {
            const m: any = await import('../tools/icon/IconTool.js');
            if (panelTitle) panelTitle.textContent = I18n.t('iconTool.panelTitle');
            if (panelBody)  m.IconTool.renderPickerPanel(panelBody, this);
          }
          openPanelMenu();
        });
      }

      // ── Panel-only tools + element-creator sidebar tools ─────────────────
      const SIDEBAR_CLICK_TOOLS = new Set([
        'gerador','papeis','agenda','calendario','album','fatiador','textocurvo','carimbo',
      ]);
      if (SIDEBAR_CLICK_TOOLS.has(tool)) {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          document.querySelectorAll('.craftools-tool-btn, .footer-nav-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          // papeis: find or create the background paper element, then select it
          if (tool === 'papeis') {
            const page = this.querySelector('.craftools-page') ?? document.querySelector('.craftools-page');
            if (page) {
              let paperEl = page.querySelector('craftools-element[data-craftool="papeis"]') as (HTMLElement & { select?: () => void }) | null;
              if (!paperEl) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const m: any = await import('../tools/paper/PaperTool.js');
                paperEl = m.PaperTool.createElement('papeis', this);
                page.appendChild(paperEl!);
              }
              setTimeout(() => { if (typeof paperEl?.select === 'function') paperEl!.select!(); }, 50);
              closeSidebar();
            }
            return;
          }

          // album: open the wizard panel on the active page
          if (tool === 'album') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m: any = await import('../tools/album/AlbumWizard');
            const targetPage = (this.activePage ?? this.querySelector('.craftools-page')) as HTMLElement | null;
            if (targetPage) m.AlbumTool.setup(this, targetPage);
            return;
          }

          // textocurvo / carimbo: create element directly on the active page
          if (tool === 'textocurvo') {
            if (isMobile()) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m: any = await import('../tools/textocurvo/TextoCurvoTool.js');
            const targetPage = (this.activePage ?? this.querySelector('.craftools-page')) as HTMLElement | null;
            if (targetPage) { const el = m.TextoCurvoTool.createElement('textocurvo', this); targetPage.appendChild(el); closeSidebar(); }
            return;
          }
          if (tool === 'carimbo') {
            if (isMobile()) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m: any = await import('../tools/carimbo/CarimboTool.js');
            const targetPage = (this.activePage ?? this.querySelector('.craftools-page')) as HTMLElement | null;
            if (targetPage) { const el = m.CarimboTool.createElement('carimbo', this); targetPage.appendChild(el); closeSidebar(); }
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

          // panel-only tools: agenda / calendario / gerador / fatiador
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
          const pagesWrapper = this.querySelector('#pages-wrapper');
          if (pagesWrapper) HistoryManager.snapshot(pagesWrapper);
          SessionManager.markDirty();
        }, 100);
      });
    });

    // ── Zoom ────────────────────────────────────────────────────────────────
    let zoomLevel = 1.0;
    (window as any).craftoolsZoomLevel = 1.0;
    const zoomLevelLabel = this.querySelector('#zoom-level')!;
    const pagesWrapper   = this.querySelector('#pages-wrapper') as HTMLElement;

    const updateZoom = () => {
      if (pagesWrapper) {
        pagesWrapper.style.transform = `scale(${zoomLevel})`;
        zoomLevelLabel.textContent = Math.round(zoomLevel * 100) + '%';
        (window as any).craftoolsZoomLevel = zoomLevel;
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

    canvas.addEventListener('touchmove', (e: Event) => {
      const te = e as TouchEvent;
      if (te.touches.length === 2 && pinchStartDist) {
        const dx = te.touches[0].clientX - te.touches[1].clientX;
        const dy = te.touches[0].clientY - te.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / pinchStartDist;
        zoomLevel = Math.min(3.0, Math.max(0.2, pinchStartZoom * scale));
        updateZoom();
      }
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
      if (pinchStartDist) pinchStartDist = null;
    }, { passive: true });
  }

  static init() { customElements.define('craftools-editor', Craftools_Editor); }
}
