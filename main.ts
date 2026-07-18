/**
 * main.ts — Application entry point.
 *
 * Replaces the inline <script type="module"> block in index.html (lines 835–1192).
 * To switch index.html to use this file, change:
 *
 *   <script type="module">
 *     import { Craftools } from './craftools/craftools.js';
 *     window.onload = () => { ... };
 *   </script>
 *
 * to:
 *
 *   <script type="module" src="./main.ts"></script>  (via Vite dev server)
 *   or (after build):
 *   <script type="module" src="./dist/main.js"></script>
 *
 * The tools barrel import below activates ALL tool self-registrations so
 * Craftools.ts can call ToolRegistry.all() without explicit imports.
 */

// ── Tool registrations (side-effects only) ────────────────────────────────────
import './craftools/tools/index';

// ── Core ──────────────────────────────────────────────────────────────────────
import { Craftools } from './craftools';
import { I18n }      from './craftools/settings/Translations.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  // Boot the application
  new Craftools('#wrapper');

  // PWA shell proxies need the editor DOM to exist — wait for first render.
  setTimeout(initPwaProxies, 500);
});

// ── PWA Shell Proxies ─────────────────────────────────────────────────────────
//
// The mobile footer buttons (pwa-btn-*) and the desktop sidebar controls are
// part of the static PWA shell in index.html. They proxy their events to the
// real sidebar elements that Editor.js listens to (data-tool="X" buttons).
//
// pwa-sidebar-* entries are NOT proxied here because the sidebar items
// already have data-tool attributes — clicking them directly would fire the
// listener twice and create duplicate elements on the canvas.

function initPwaProxies(): void {

  // ── Tool button proxies ──────────────────────────────────────────────────────

  type ToolProxy = { selector: string; type: string | null };
  const toolsMap: Record<string, ToolProxy> = {
    'pwa-btn-titulo':    { selector: '[data-tool="titulo"]',    type: 'titulo'    },
    'pwa-btn-paragrafo': { selector: '[data-tool="paragrafo"]', type: 'paragrafo' },
    'pwa-btn-imagem':    { selector: '[data-tool="imagem"]',    type: 'imagem'    },
    'pwa-btn-album':     { selector: '[data-tool="album"]',     type: 'album'     },
    'pwa-btn-qrcode':    { selector: '[data-tool="qrcode"]',    type: 'qrcode'    },
    'pwa-sidebar-export':  { selector: '#pdf-btn',          type: null },
    'pwa-sidebar-newpage': { selector: '#new-page-btn',     type: null },
    'pwa-btn-emoji':     { selector: '[data-tool="emoji"]',     type: 'emoji'     },
  };

  for (const [pwaId, info] of Object.entries(toolsMap)) {
    const btn = document.getElementById(pwaId);
    if (!btn) continue;

    // Click proxy
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      (document.querySelector(info.selector) as HTMLElement | null)?.click();
    });

    // Drag proxy (desktop only)
    if (info.type) {
      btn.addEventListener('dragstart', (e: DragEvent) => {
        e.dataTransfer!.setData('ToolType', info.type!);
        e.dataTransfer!.setData('text/plain', info.type!);
        e.dataTransfer!.effectAllowed = 'copy';
      });
    }
  }

  // ── Undo / Redo ──────────────────────────────────────────────────────────────

  const pwaUndo = document.getElementById('pwa-undo');
  const pwaRedo = document.getElementById('pwa-redo');

  pwaUndo?.addEventListener('click', (e) => {
    e.preventDefault();
    if (pwaUndo.classList.contains('disabled')) return;
    document.getElementById('undo-btn')?.click();
  });

  pwaRedo?.addEventListener('click', (e) => {
    e.preventDefault();
    if (pwaRedo.classList.contains('disabled')) return;
    document.getElementById('redo-btn')?.click();
  });

  const syncUndoRedoState = () => {
    const originalUndo = document.getElementById('undo-btn') as HTMLButtonElement | null;
    const originalRedo = document.getElementById('redo-btn') as HTMLButtonElement | null;
    if (originalUndo && pwaUndo) pwaUndo.classList.toggle('disabled', originalUndo.disabled);
    if (originalRedo && pwaRedo) pwaRedo.classList.toggle('disabled', originalRedo.disabled);

    // Mirror the "N/10" history indicator
    const desktopIndicator = document.getElementById('history-indicator');
    const pwaIndicator      = document.getElementById('pwa-history-indicator');
    if (desktopIndicator && pwaIndicator) {
      pwaIndicator.textContent = desktopIndicator.textContent;
      pwaIndicator.title       = desktopIndicator.title;
    }
  };

  document.addEventListener('craftools-history-change', syncUndoRedoState);
  setInterval(syncUndoRedoState, 200);

  // ── Zoom ─────────────────────────────────────────────────────────────────────

  document.getElementById('pwa-zoom-in')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('zoom-in-btn')?.click();
  });
  document.getElementById('pwa-zoom-out')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('zoom-out-btn')?.click();
  });
  document.getElementById('pwa-zoom-reset')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('zoom-reset-btn')?.click();
  });

  // Ctrl+scroll = zoom (overrides native browser zoom)
  window.addEventListener('wheel', (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    document.getElementById(e.deltaY < 0 ? 'pwa-zoom-in' : 'pwa-zoom-out')?.click();
  }, { passive: false });

  // ── Theme toggle ──────────────────────────────────────────────────────────────

  document.getElementById('pwa-theme-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('theme-btn')?.click();
  });

  const updateThemeUI = () => {
    const isDark    = document.documentElement.getAttribute('data-theme') === 'dark';
    const themeIcon = document.querySelector<HTMLElement>('#pwa-theme-btn .material-symbols-outlined');
    if (themeIcon) themeIcon.textContent = isDark ? 'light_mode' : 'dark_mode';
    const darkSwitch = document.getElementById('darkSwitch') as HTMLInputElement | null;
    if (darkSwitch) darkSwitch.checked = isDark;
  };

  new MutationObserver((mutations) => {
    mutations.forEach((m) => { if (m.attributeName === 'data-theme') updateThemeUI(); });
  }).observe(document.documentElement, { attributes: true });

  updateThemeUI();

  // ── Language selector ─────────────────────────────────────────────────────────

  const pwaLangSelect = document.getElementById('pwa-lang-select') as HTMLSelectElement | null;
  if (pwaLangSelect) {
    const syncLang = () => {
      const orig = document.getElementById('lang-select') as HTMLSelectElement | null;
      if (orig) pwaLangSelect.value = orig.value;
    };
    syncLang();
    pwaLangSelect.addEventListener('change', (e) => {
      const orig = document.getElementById('lang-select') as HTMLSelectElement | null;
      if (orig) {
        orig.value = (e.target as HTMLSelectElement).value;
        orig.dispatchEvent(new Event('change'));
      }
    });
    setInterval(syncLang, 1000);
  }

  // ── Header "..." overflow menu (mobile only) ──────────────────────────────────
  // Groups undo/redo/history, theme toggle, and language behind one trigger so
  // the mobile header isn't 8 icons + a select crammed into ~360px. Desktop
  // never shows the trigger (CSS), so this only matters on mobile widths.

  const moreBtn  = document.getElementById('pwa-header-more-btn');
  const moreMenu = document.getElementById('pwa-header-more-menu');
  if (moreBtn && moreMenu) {
    const closeMoreMenu = () => {
      moreMenu.classList.remove('open');
      moreBtn.setAttribute('aria-expanded', 'false');
    };
    moreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = moreMenu.classList.toggle('open');
      moreBtn.setAttribute('aria-expanded', String(isOpen));
    });
    // Close on outside click, and after picking an action inside the menu.
    document.addEventListener('click', (e) => {
      if (!moreMenu.classList.contains('open')) return;
      if (moreMenu.contains(e.target as Node) || moreBtn.contains(e.target as Node)) return;
      closeMoreMenu();
    });
    moreMenu.querySelectorAll('a.box-icon').forEach(item => {
      item.addEventListener('click', closeMoreMenu);
    });
  }

  // ── PWA i18n (footer and shell elements) ─────────────────────────────────────

  const htmlLangMap: Record<string, string> = { 'pt-br': 'pt-BR', 'en': 'en', 'es': 'es' };

  const applyPwaI18n = () => {
    const win = window as Window & { craftoolsLang?: string; craftoolsApp?: unknown };
    if (!win.craftoolsLang || !win.craftoolsApp) return;
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
      const key  = el.getAttribute('data-i18n')!;
      const text = I18n.t(key);
      if (text && text !== key) el.textContent = text;
    });
    document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => {
      const key  = el.getAttribute('data-i18n-title')!;
      const text = I18n.t(key);
      if (text && text !== key) el.title = text;
    });
    document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach(el => {
      const key  = el.getAttribute('data-i18n-placeholder')!;
      const text = I18n.t(key);
      if (text && text !== key) el.setAttribute('placeholder', text);
    });
    document.documentElement.lang = htmlLangMap[win.craftoolsLang] ?? 'pt-BR';
  };

  pwaLangSelect?.addEventListener('change', applyPwaI18n);
  setInterval(applyPwaI18n, 1500);

  // ── Setup-mode detection ──────────────────────────────────────────────────────

  const checkSetupMode = () => {
    const inEditor = !!document.querySelector('#canvas-area');
    document.body.classList.toggle('is-setup-mode', !inEditor);
    if (inEditor) {
      document.querySelector('.pwa-welcome-msg')?.remove();
    }
  };
  setInterval(checkSetupMode, 500);
  checkSetupMode();

  // ── Sidebar: collapse / expand ────────────────────────────────────────────────

  const menuIcon = document.getElementById('pwa-menu-icon');

  const toggleMenuIcon = (isOpen: boolean) => {
    if (!menuIcon) return;
    menuIcon.style.transition = 'transform 0.25s ease, opacity 0.2s ease';
    menuIcon.style.opacity    = '0';
    menuIcon.style.transform  = isOpen ? 'rotate(90deg) scale(0.7)' : 'rotate(-90deg) scale(0.7)';
    setTimeout(() => {
      menuIcon.textContent    = isOpen ? 'close' : 'menu';
      menuIcon.style.opacity  = '1';
      menuIcon.style.transform = 'rotate(0deg) scale(1)';
    }, 150);
  };

  const setSidebarCollapsed = (panel: HTMLElement, collapsed: boolean) => {
    if (collapsed) {
      const currentWidth = panel.style.width || (panel.getBoundingClientRect().width + 'px');
      panel.dataset.expandedWidth = currentWidth;
      panel.classList.add('sidenav-collapsed');
      panel.style.setProperty('width', '68px', 'important');
    } else {
      panel.classList.remove('sidenav-collapsed');
      panel.style.removeProperty('width');
      if (panel.dataset.expandedWidth) panel.style.width = panel.dataset.expandedWidth;
    }
    toggleMenuIcon(!collapsed);
    panel.style.marginLeft = '';
    if (!panel.classList.contains('panel-open')) panel.classList.add('panel-open');
  };

  document.getElementById('pwa-menu-toggle')?.addEventListener('click', (e) => {
    e.preventDefault();
    const panel = document.getElementById('right-panel');
    if (!panel) return;

    const isMobile = window.innerWidth <= 768;

    if (!isMobile) {
      // Desktop: if properties panel is open, close it first then collapse
      const closePanelBtn     = document.getElementById('close-panel');
      const isToolPanelOpen   = closePanelBtn && !closePanelBtn.classList.contains('d-none');
      if (isToolPanelOpen) {
        closePanelBtn!.click();
        setSidebarCollapsed(panel, true);
        return;
      }
      setSidebarCollapsed(panel, !panel.classList.contains('sidenav-collapsed'));
      return;
    }

    // Mobile: full open/close.
    // NOTE: on mobile, `.sidenav-panel` is `display: none !important` unless
    // it also carries `.mobile-modal-mode` (see index.html's mobile media
    // query) -- that class is what element-selection / Album Wizard use to
    // show this same panel as a bottom-sheet/modal. This handler used to only
    // toggle `panel-open` + `marginLeft`, so the CSS display gate never
    // opened unless `.mobile-modal-mode` happened to still be set from a
    // previous element-selection -- causing the menu icon/indicator to flip
    // to "open" while the panel stayed invisible. Toggle both classes together.
    const isNowOpen = panel.classList.toggle('panel-open');
    panel.classList.toggle('mobile-modal-mode', isNowOpen);
    toggleMenuIcon(isNowOpen);
    panel.style.marginLeft = isNowOpen ? '' : `-${panel.offsetWidth}px`;

    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) sidebarOverlay.classList.toggle('visible', isNowOpen);
  });

  // ── Sidebar: resize handle ──────────────────────────────────────────────────
  // The handle (`#panel-resize-handle`) has existed in index.html/CSS since
  // the PWA migration but was never wired up to anything -- dragging it did
  // nothing. CSS already hides it on mobile (bottom-sheet layout doesn't
  // support horizontal resize), so this only needs to handle desktop drag.

  const resizeHandle = document.getElementById('panel-resize-handle');
  // Raised from 200 -- #right-panel isn't only the element-properties
  // accordion, it's reused as-is for the page panel (PageTool.ts's "Size &
  // Position"/"Fundo"/"Ações" accordions, with a "Predefinições" pill row
  // and labelled rows) and other non-element content. Those weren't
  // designed for anywhere near 200px: dragged that narrow, their icon+label
  // rows and pill buttons visibly clip/truncate (reported as "the panel
  // looks broken/stuck"). 260 stays close to the CSS default (272px, see
  // craftools.css's `.craftools-panel`) but still lets the handle do
  // something, while every known content type stays legible.
  const RESIZE_MIN_WIDTH = 260;
  const RESIZE_MAX_WIDTH = 480;
  // Matches `.craftools-panel`'s own CSS width (craftools.css) -- what
  // double-clicking the handle resets back to.
  const RESIZE_DEFAULT_WIDTH = 272;

  if (resizeHandle) {
    let resizing = false;
    let startX = 0;
    let startWidth = 0;
    let resizePanel: HTMLElement | null = null;

    const onPointerMove = (e: PointerEvent) => {
      if (!resizing || !resizePanel) return;
      const delta = e.clientX - startX;
      const newWidth = Math.min(RESIZE_MAX_WIDTH, Math.max(RESIZE_MIN_WIDTH, startWidth + delta));
      resizePanel.style.setProperty('width', `${newWidth}px`, 'important');
      resizePanel.dataset.expandedWidth = `${newWidth}px`;
    };

    const stopResizing = () => {
      if (!resizing) return;
      resizing = false;
      resizeHandle.classList.remove('resizing');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopResizing);
    };

    resizeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
      const panel = document.getElementById('right-panel');
      if (!panel || panel.classList.contains('sidenav-collapsed') || window.innerWidth <= 768) return;
      e.preventDefault();
      resizing = true;
      resizePanel = panel;
      startX = e.clientX;
      startWidth = panel.getBoundingClientRect().width;
      resizeHandle.classList.add('resizing');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', stopResizing);
    });

    // Double-click resets to the default width -- a discoverable, reliable
    // "put it back to normal" escape hatch (standard pattern for resizable
    // panels/columns), on top of the safer minimum above. Also clears
    // `dataset.expandedWidth` so re-collapsing/re-expanding the sidebar
    // (`setSidebarCollapsed()` above) doesn't resurrect the old width.
    resizeHandle.addEventListener('dblclick', (e: MouseEvent) => {
      const panel = document.getElementById('right-panel');
      if (!panel || panel.classList.contains('sidenav-collapsed') || window.innerWidth <= 768) return;
      e.preventDefault();
      panel.style.setProperty('width', `${RESIZE_DEFAULT_WIDTH}px`, 'important');
      delete panel.dataset.expandedWidth;
    });
  }

  // Remove Bootstrap offcanvas backdrop (it blocks canvas drag events)
  new MutationObserver(() => {
    document.querySelector('.offcanvas-backdrop')?.remove();
  }).observe(document.body, { childList: true, subtree: false });

  // ── Sidebar: tool search ──────────────────────────────────────────────────────

  const searchInput  = document.getElementById('sidenav-search-input') as HTMLInputElement | null;
  const sidenavList  = document.getElementById('sidenav-nav-list');
  const noResults    = document.getElementById('sidenav-no-results');

  if (searchInput && sidenavList) {
    searchInput.addEventListener('input', () => {
      const q       = searchInput.value.trim().toLowerCase();
      const items   = Array.from(sidenavList.children) as HTMLElement[];
      const labels: HTMLElement[] = [];
      let anyVisible = false;

      items.forEach(li => {
        if (li.classList.contains('ct-sec-label')) { labels.push(li); return; }
        const match = !q || li.textContent!.trim().toLowerCase().includes(q);
        li.classList.toggle('d-none', !match);
        if (match) anyVisible = true;
      });

      // Hide section labels whose group has no visible items
      labels.forEach(label => {
        let el = label.nextElementSibling as HTMLElement | null;
        let hasVisible = false;
        while (el && !el.classList.contains('ct-sec-label')) {
          if (!el.classList.contains('d-none')) { hasVisible = true; break; }
          el = el.nextElementSibling as HTMLElement | null;
        }
        label.classList.toggle('d-none', !hasVisible);
      });

      noResults?.classList.toggle('d-none', anyVisible || !q);
    });
  }
}
