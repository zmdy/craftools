import { Craftools_Settings } from "../settings/Settings.js";
import { PageTool } from "../tools/page/PageTool.js";
import { TextTool } from "../tools/text/TextTool.js";
import { ImageTool } from "../tools/image/ImageTool.js";
import { QRCodeTool } from "../tools/qrcode/QRCodeTool.js";
import { CtxBar } from "../utils/CtxBar.js";
import { I18n } from "../settings/Translations.js";
import { PdfExport } from "../utils/PdfExport.js";
import { ImageExport } from "../utils/ImageExport.js";
import { HistoryManager } from "../utils/HistoryManager.js";
import { SessionManager } from "../utils/SessionManager.js";
import { MobileToolbar } from "../utils/MobileToolbar.js";

export class Craftools_Editor extends HTMLElement {
    constructor() { super(); }
    
    connectedCallback() {
        this.render();
    }

    render() {
        const activeSizeConfig = window.craftoolsSize;
        let dimWidth = '100%';
        let dimHeight = '100%';
        if (activeSizeConfig && activeSizeConfig.size !== '*') {
            const parts = activeSizeConfig.size.split(',');
            dimWidth = parts[0] + activeSizeConfig.sizeUnit;
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
                        <option value="en" ${I18n.currentLang === 'en' ? 'selected' : ''}>EN-US</option>
                        <option value="es" ${I18n.currentLang === 'es' ? 'selected' : ''}>ES-ES</option>
                    </select>
                    <button class="craftools-icon-btn" title="${I18n.t('editor.themeToggle')}" id="theme-btn">
                        <span class="material-symbols-outlined">dark_mode</span>
                    </button>
                </div>
            </header>
            <div class="craftools-body">
                <!-- Overlay para fechar a sidebar no mobile -->
                <div class="craftools-sidebar-overlay" id="sidebar-overlay"></div>

                <main class="craftools-canvas" id="canvas-area">
                    <div class="craftools-pages" id="pages-wrapper">
                        <section class="craftools-page" style="width: ${dimWidth}; min-height: ${dimHeight}; background: white;" id="main-page">
                             <!-- Empty Page -->
                             <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 14px;">
                             </div>
                        </section>
                    </div>
                </main>
            </div>
        </div>
        `;

        this.ctxBar = new CtxBar(this.querySelector('.craftools-app'));
        this.bindEvents();
        this._initHistoryAndSession();
    }

    _initHistoryAndSession() {
        const pagesWrapper = this.querySelector('#pages-wrapper');
        const undoBtn = this.querySelector('#undo-btn');
        const redoBtn = this.querySelector('#redo-btn');
        const historyIndicator = this.querySelector('#history-indicator');

        // ── Undo / Redo buttons ────────────────────────────────────────────
        const updateHistoryButtons = ({ canUndo, canRedo, count, max } = {}) => {
            if (undoBtn) undoBtn.disabled = !HistoryManager.canUndo;
            if (redoBtn) redoBtn.disabled = !HistoryManager.canRedo;
            if (historyIndicator) {
                const c = typeof count === 'number' ? count : HistoryManager.historyCount;
                const m = typeof max === 'number' ? max : HistoryManager.maxStates;
                historyIndicator.textContent = `${c}/${m}`;
                historyIndicator.title = I18n.t('editor.historyIndicatorDetail').replace('{c}', c).replace('{m}', m);
            }
        };
        updateHistoryButtons();

        undoBtn?.addEventListener('click', () => {
            HistoryManager.undo(pagesWrapper);
            this._reattachAllPageEvents(pagesWrapper);
        });

        redoBtn?.addEventListener('click', () => {
            HistoryManager.redo(pagesWrapper);
            this._reattachAllPageEvents(pagesWrapper);
        });

        // Keep buttons in sync with history state
        document.addEventListener('craftools-history-change', (e) => {
            updateHistoryButtons(e.detail);
        });

        // ── Keyboard Shortcuts ─────────────────────────────────────────────
        document.addEventListener('keydown', (e) => {
            const tag = document.activeElement?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;

            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                HistoryManager.undo(pagesWrapper);
                this._reattachAllPageEvents(pagesWrapper);
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
                e.preventDefault();
                HistoryManager.redo(pagesWrapper);
                this._reattachAllPageEvents(pagesWrapper);
            }
        });

        // ── Snapshot on element changes ────────────────────────────────────
        const onAction = () => {
            HistoryManager.snapshot(pagesWrapper);
            SessionManager.markDirty();
        };

        // Listen for element changes (move, resize, rotate, style)
        // Use a debounce to avoid flooding the history on drag operations
        let actionDebounce = null;
        this.addEventListener('craftools-element-change', () => {
            clearTimeout(actionDebounce);
            actionDebounce = setTimeout(onAction, 400);
            SessionManager.markDirty();
        });

        // Immediate snapshot on delete and page add (discrete actions)
        this.addEventListener('craftools-element-delete', () => onAction());
        document.addEventListener('craftools-page-add', () => onAction());

        // Take initial snapshot
        setTimeout(() => HistoryManager.snapshot(pagesWrapper), 300);

        // ── Start session ──────────────────────────────────────────────────
        const mediaKey = window.craftoolsSize?.key || 'unknown';
        SessionManager.startSession(mediaKey, window.craftoolsSize);
    }

    /** Re-attaches PageTool events to all pages after undo/redo restore */
    _reattachAllPageEvents(pagesWrapper) {
        if (!pagesWrapper) return;
        pagesWrapper.querySelectorAll('.craftools-page').forEach(page => {
            // Use a flag to avoid duplicate listeners on the same node
            if (!page._craftoolsEventsAttached) {
                PageTool.attachPageEvents(this, page);
                page._craftoolsEventsAttached = true;
            }
        });
    }

    bindEvents() {
        const isMobile = () => window.innerWidth <= 768;
        
        const restoreOriginalCanvas = () => {
            // Generic tool cleanup hook — e.g. ImageSlicerTool preview overlay
            if (typeof this._toolCleanup === 'function') {
                this._toolCleanup();
                delete this._toolCleanup;
            }
            const mainPage = document.getElementById('main-page');
            if (mainPage && this._savedPageHtml !== undefined) {
                mainPage.innerHTML = this._savedPageHtml;
                if (this._savedPageCssText !== undefined) {
                    mainPage.style.cssText = this._savedPageCssText;
                }
                delete this._savedPageHtml;
                delete this._savedPageCssText;
            }
            const badge = document.getElementById('gerador-canvas-badge');
            if (badge) badge.remove();
        };
        this.restoreOriginalCanvas = restoreOriginalCanvas;
        
        MobileToolbar.init(this);

        // ── Mobile menu toggle ─────────────────────────────────────────────
        const mobileMenuBtn = this.querySelector('#mobile-menu-btn');
        const sidebar = document.getElementById('right-panel');
        const overlay = this.querySelector('#sidebar-overlay');

        // Default sidebar state on desktop: collapsed (icons only) right from
        // the first editor render — never fully hidden nor fully expanded
        // without user interaction. Without this, the sidebar had no class
        // (neither panel-open nor sidenav-collapsed) until the first click,
        // which could leave it in a broken/intermediate state depending on
        // inherited styles.
        if (sidebar && !isMobile() && !sidebar.classList.contains('panel-open')) {
            sidebar.classList.add('panel-open', 'sidenav-collapsed');
            const menuIcon = document.getElementById('pwa-menu-icon');
            if (menuIcon) menuIcon.textContent = 'menu';
        }

        if (window.innerWidth <= 768) {
            mobileMenuBtn.style.display = 'flex';
        }
        window.addEventListener('resize', () => {
            mobileMenuBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
        });

        const openSidebar = () => {
            if(sidebar) {
                sidebar.classList.add('panel-open');
                sidebar.classList.remove('sidenav-collapsed');
                if (isMobile()) sidebar.classList.add('mobile-modal-mode');
            }
            overlay.classList.add('visible');
            const menuIcon = document.getElementById('pwa-menu-icon');
            if(menuIcon && menuIcon.textContent !== 'close') {
                menuIcon.textContent = 'close';
            }
        };
        const closeSidebar = () => {
            if(sidebar) {
                if (isMobile()) {
                    // Mobile: hide the sidebar completely (it is a modal/overlay)
                    sidebar.classList.remove('panel-open');
                } else {
                    // Desktop: never fully hide — collapse to icon-only mode
                    sidebar.classList.add('panel-open', 'sidenav-collapsed');
                    sidebar.style.marginLeft = '';
                }
                sidebar.classList.remove('mobile-modal-mode');
            }
            overlay.classList.remove('visible');
            const menuIcon = document.getElementById('pwa-menu-icon');
            if(menuIcon) {
                menuIcon.textContent = isMobile() ? 'menu' : 'menu';
            }
            // Also reset the panel's internal state (e.g. an open properties panel)
            const defaultMenu = document.getElementById('panel-default-menu');
            const panelBody  = document.getElementById('panel-body');
            const closePanel = document.getElementById('close-panel');
            const panelTitle = document.getElementById('panel-title');
            if(defaultMenu) defaultMenu.classList.remove('d-none');
            if(panelBody)   panelBody.classList.add('d-none');
            if(closePanel)  closePanel.classList.add('d-none');
            if(panelTitle)  panelTitle.textContent = '';
            restoreOriginalCanvas();
        };

        mobileMenuBtn.addEventListener('click', openSidebar);
        overlay.addEventListener('click', closeSidebar);

        // ── Resizable panel (drag handle near the right edge) ───────────────
        // Desktop only — on mobile the panel becomes a bottom sheet and the
        // handle is hidden via CSS (vertical resize uses its own indicator).
        const PANEL_MIN_W = 240;
        const PANEL_MAX_W = 480;
        const PANEL_WIDTH_KEY = 'craftools-panel-width';

        const resizeHandle = document.getElementById('panel-resize-handle');
        if (resizeHandle && sidebar) {
            // Restore saved width (mobile CSS with !important overrides this when needed)
            const savedWidth = parseInt(localStorage.getItem(PANEL_WIDTH_KEY), 10);
            if (!isNaN(savedWidth) && savedWidth >= PANEL_MIN_W && savedWidth <= PANEL_MAX_W) {
                sidebar.style.width = savedWidth + 'px';
            }

            let startX = 0;
            let startWidth = 0;

            const onPointerMove = (e) => {
                const delta = e.clientX - startX;
                const newWidth = Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, startWidth + delta));
                sidebar.style.width = newWidth + 'px';
            };
            const onPointerUp = () => {
                document.removeEventListener('pointermove', onPointerMove);
                sidebar.classList.remove('resizing');
                resizeHandle.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem(PANEL_WIDTH_KEY, parseInt(sidebar.style.width, 10));
            };

            resizeHandle.onpointerdown = (e) => {
                if (isMobile()) return;
                e.preventDefault();
                startX = e.clientX;
                startWidth = sidebar.getBoundingClientRect().width;
                sidebar.classList.add('resizing');
                resizeHandle.classList.add('resizing');
                document.body.style.cursor = 'ew-resize';
                document.body.style.userSelect = 'none';
                resizeHandle.setPointerCapture(e.pointerId);
                document.addEventListener('pointermove', onPointerMove, { passive: false });
                document.addEventListener('pointerup', onPointerUp, { once: true });
            };
        }

        this.addEventListener('craftools-element-select', (e) => {
            restoreOriginalCanvas();
            const el = e.detail.element;
            const toolType = el.getAttribute('data-craftool');
            
            const rightPanel = document.getElementById('right-panel');
            const panelTitle = document.getElementById('panel-title');
            const panelBody = document.getElementById('panel-body');
            const defaultMenu = document.getElementById('panel-default-menu');
            const closePanel = document.getElementById('close-panel');

            const openPanelMenu = () => {
                if (isMobile()) {
                    MobileToolbar.showElementMode(el, toolType);
                    return;
                }
                if(defaultMenu) defaultMenu.classList.add('d-none');
                if(panelBody) panelBody.classList.remove('d-none');
                if(closePanel) closePanel.classList.remove('d-none');
                if(rightPanel) {
                    rightPanel.classList.add('panel-open');
                    rightPanel.classList.remove('sidenav-collapsed');
                }
                const menuIcon = document.getElementById('pwa-menu-icon');
                if(menuIcon && menuIcon.textContent !== 'close') {
                    menuIcon.textContent = 'close';
                }
            };

            if (toolType === 'titulo' || toolType === 'paragrafo') {
                this.ctxBar.show(el, TextTool.getCtxOptions(el));

                if (panelTitle) panelTitle.textContent = toolType === 'titulo' ? I18n.t('textTool.propsTitle') : I18n.t('textTool.propsParagraph');
                if (panelBody) TextTool.renderPropertiesPanel(panelBody, el);
                openPanelMenu();
                this.activePage = null;
            } else if (toolType === 'emoji') {
                this.ctxBar.show(el, []);
                if (panelTitle) panelTitle.textContent = 'Emoji';
                if (panelBody) {
                    import('../tools/emoji/EmojiTool.js').then(({ EmojiTool }) => {
                        EmojiTool.renderPropertiesPanel(panelBody, el, this);
                    });
                }
                openPanelMenu();
                this.activePage = null;
            } else if (toolType === 'shape') {
                this.ctxBar.show(el, []);
                if (panelTitle) panelTitle.textContent = I18n.t('shapeTool.panelTitle');
                if (panelBody) {
                    import('../tools/shape/ShapeTool.js').then(({ ShapeTool }) => {
                        ShapeTool.renderPropertiesPanel(panelBody, el, this);
                    });
                }
                openPanelMenu();
                this.activePage = null;
            } else if (toolType === 'icone') {
                this.ctxBar.show(el, []);
                if (panelTitle) panelTitle.textContent = I18n.t('iconTool.panelTitle');
                if (panelBody) {
                    import('../tools/icon/IconTool.js').then(({ IconTool }) => {
                        IconTool.renderPropertiesPanel(panelBody, el, this);
                    });
                }
                openPanelMenu();
                this.activePage = null;
            } else if (toolType === 'imagem') {
                this.ctxBar.show(el, ImageTool.getCtxOptions(el));
                
                if (panelTitle) panelTitle.textContent = I18n.t('imageTool.panelTitle');
                if (panelBody) ImageTool.renderPropertiesPanel(panelBody, el);
                openPanelMenu();
                this.activePage = null;
            } else if (toolType === 'qrcode') {
                this.ctxBar.show(el, QRCodeTool.getCtxOptions(el));

                if (panelTitle) panelTitle.textContent = I18n.t('qrTool.panelTitle');
                if (panelBody) QRCodeTool.renderPropertiesPanel(panelBody, el);
                openPanelMenu();
                this.activePage = null;
            } else if (toolType === 'papeis') {
                import('../tools/paper/PaperTool.js').then(({ PaperTool }) => {
                    this.ctxBar.show(el, PaperTool.getCtxOptions(el));
                    if (panelTitle) panelTitle.textContent = I18n.t('paperTool.panelTitle') || 'Paper Properties';
                    if (panelBody) PaperTool.renderPropertiesPanel(panelBody, el);
                    openPanelMenu();
                    this.activePage = null;
                });
            } else if (toolType === 'barcode') {
                import('../tools/barcode/BarcodeTool.js').then(({ BarcodeTool }) => {
                    this.ctxBar.show(el, BarcodeTool.getCtxOptions(el));
                    if (panelTitle) panelTitle.textContent = I18n.t('barcodeTool.panelTitle') || 'Barcode Properties';
                    if (panelBody) BarcodeTool.renderPropertiesPanel(panelBody, el);
                    openPanelMenu();
                    this.activePage = null;
                });
            } else if (toolType === 'minicalendario') {
                import('../tools/minicalendar/MiniCalendarTool.js').then(({ MiniCalendarTool }) => {
                    this.ctxBar.show(el, MiniCalendarTool.getCtxOptions(el));
                    if (panelTitle) panelTitle.textContent = I18n.t('miniCalendarTool.panelTitle') || 'Mini Calendar';
                    if (panelBody) MiniCalendarTool.renderPropertiesPanel(panelBody, el);
                    openPanelMenu();
                    this.activePage = null;
                });
            } else if (toolType === 'emojikitchen') {
                import('../tools/emojikitchen/EmojiKitchenTool.js').then(({ EmojiKitchenTool }) => {
                    this.ctxBar.show(el, EmojiKitchenTool.getCtxOptions(el));
                    if (panelTitle) panelTitle.textContent = I18n.t('emojiKitchenTool.panelTitle') || 'Emoji Kitchen';
                    if (panelBody) EmojiKitchenTool.renderPropertiesPanel(panelBody, el);
                    openPanelMenu();
                    this.activePage = null;
                });
            } else if (toolType === 'conteudovariavel') {
                import('../tools/variablecontent/VariableContentTool.js').then(({ VariableContentTool }) => {
                    this.ctxBar.show(el, VariableContentTool.getCtxOptions(el));
                    if (panelTitle) panelTitle.textContent = I18n.t('variableContentTool.propsTitle') || 'Variable Content';
                    if (panelBody) VariableContentTool.renderPropertiesPanel(panelBody, el);
                    openPanelMenu();
                    this.activePage = null;
                });
            } else if (toolType === 'textocurvo') {
                import('../tools/textocurvo/TextoCurvoTool.js').then(({ TextoCurvoTool }) => {
                    this.ctxBar.show(el, TextoCurvoTool.getCtxOptions(el));
                    if (panelTitle) panelTitle.textContent = I18n.t('textoCurvo.panelTitle') || 'Curved Text';
                    if (panelBody) TextoCurvoTool.renderPropertiesPanel(panelBody, el, this);
                    openPanelMenu();
                    this.activePage = null;
                });
            } else if (toolType === 'carimbo') {
                import('../tools/carimbo/CarimboTool.js').then(({ CarimboTool }) => {
                    this.ctxBar.show(el, CarimboTool.getCtxOptions(el));
                    if (panelTitle) panelTitle.textContent = I18n.t('carimbo.panelTitle') || 'Stamp / Seal';
                    if (panelBody) CarimboTool.renderPropertiesPanel(panelBody, el, this);
                    openPanelMenu();
                    this.activePage = null;
                });
            } else {
                this.ctxBar.show(el, []);
            }
        });

        this.addEventListener('craftools-element-deselect', (e) => {
            const el = e.detail.element;
            if (el && el.getAttribute('data-craftool') === 'papeis') {
                el.style.zIndex = '1';
            }
            this.ctxBar.hide();
            if (isMobile()) MobileToolbar.showToolMode();
        });

        // ── Language Select ────────────────────────────────────────────────
        this.querySelector('#lang-select').addEventListener('change', (e) => {
            I18n.lang = e.target.value;
            this.render();
        });

        // ── Theme toggle ───────────────────────────────────────────────────
        const themeBtn = this.querySelector('#theme-btn');
        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
            themeBtn.innerHTML = `<span class="material-symbols-outlined">${isDark ? 'dark_mode' : 'light_mode'}</span>`;
        });

        // ── Sidebar Tools ──────────────────────────────────────────────────
        const toolBtns = document.querySelectorAll('.craftools-tool-btn[data-tool], .footer-nav-btn, .sidenav-nav a');
        const rightPanel = document.getElementById('right-panel');
        const panelTitle = document.getElementById('panel-title');
        const closePanel = document.getElementById('close-panel');
        const panelBody = document.getElementById('panel-body');
        const defaultMenu = document.getElementById('panel-default-menu');

        const openPanelMenu = () => {
            if(defaultMenu) defaultMenu.classList.add('d-none');
            if(panelBody) panelBody.classList.remove('d-none');
            if(closePanel) closePanel.classList.remove('d-none');
            if(rightPanel) {
                rightPanel.classList.add('panel-open');
                rightPanel.classList.remove('sidenav-collapsed');
                if (isMobile()) rightPanel.classList.add('mobile-modal-mode');
            }
            const menuIcon = document.getElementById('pwa-menu-icon');
            if(menuIcon && menuIcon.textContent !== 'close') {
                menuIcon.textContent = 'close';
            }
        };

        const closePanelMenu = () => {
            if(defaultMenu) defaultMenu.classList.remove('d-none');
            if(panelBody) panelBody.classList.add('d-none');
            if(closePanel) closePanel.classList.add('d-none');
            if(panelTitle) panelTitle.textContent = '';
            if(rightPanel) rightPanel.classList.remove('mobile-modal-mode');
            document.querySelectorAll('.craftools-tool-btn, .footer-nav-btn').forEach(b => b.classList.remove('active'));
            this.querySelectorAll('.craftools-grid-cell.cell-selected').forEach(c => c.classList.remove('cell-selected'));
            this.activePage = null;
            if (isMobile()) MobileToolbar.showToolMode();
            restoreOriginalCanvas();
        };

        // Desktop: drag & drop
        toolBtns.forEach(btn => {
            if (btn.getAttribute('draggable') === 'true') {
                btn.addEventListener('dragstart', (e) => {
                    const tool = btn.dataset.tool || btn.id.replace('pwa-btn-', '').replace('pwa-sidebar-', '');
                    e.dataTransfer.setData('ToolType', tool);
                    e.dataTransfer.effectAllowed = 'copy';
                });
            }
        });

        // Mobile: tap to add (places tool in center of first visible page)
        toolBtns.forEach(btn => {
            const tool = btn.dataset.tool;
            if (!['titulo', 'paragrafo', 'imagem', 'album', 'qrcode', 'barcode', 'minicalendario', 'emojikitchen', 'emoji', 'shape', 'conteudovariavel', 'textocurvo', 'carimbo', 'icone'].includes(tool)) return;

            btn.addEventListener('click', async () => {
                if (!isMobile()) return; // Desktop uses drag-and-drop, not click

                closeSidebar();

                const mainPage = this.querySelector('.craftools-page');
                if (!mainPage) return;

                const rect = mainPage.getBoundingClientRect();
                const scale = window.craftoolsZoomLevel || 1;
                const cx = rect.width / scale / 2;
                const cy = rect.height / scale / 2;

                if (tool === 'album') {
                    const { AlbumTool } = await import('../tools/album/AlbumTool.js');
                    AlbumTool.setup(this, mainPage);
                } else if (tool === 'imagem') {
                    const { ImageTool } = await import('../tools/image/ImageTool.js');
                    const el = ImageTool.createElement(tool, this);
                    el.setAttribute('x', cx - 100);
                    el.setAttribute('y', cy - 100);
                    mainPage.appendChild(el);
                } else if (tool === 'qrcode') {
                    const { QRCodeTool } = await import('../tools/qrcode/QRCodeTool.js');
                    const el = QRCodeTool.createElement(tool, this);
                    el.setAttribute('x', cx - 90);
                    el.setAttribute('y', cy - 90);
                    mainPage.appendChild(el);
                } else if (tool === 'barcode') {
                    const { BarcodeTool } = await import('../tools/barcode/BarcodeTool.js');
                    const el = BarcodeTool.createElement(tool, this);
                    el.setAttribute('x', cx - 110);
                    el.setAttribute('y', cy - 50);
                    mainPage.appendChild(el);
                } else if (tool === 'minicalendario') {
                    const { MiniCalendarTool } = await import('../tools/minicalendar/MiniCalendarTool.js');
                    const el = MiniCalendarTool.createElement(tool, this);
                    el.setAttribute('x', cx - 95);
                    el.setAttribute('y', cy - 105);
                    mainPage.appendChild(el);
                } else if (tool === 'emojikitchen') {
                    const { EmojiKitchenTool } = await import('../tools/emojikitchen/EmojiKitchenTool.js');
                    const el = EmojiKitchenTool.createElement(tool, this);
                    el.setAttribute('x', cx - 80);
                    el.setAttribute('y', cy - 80);
                    mainPage.appendChild(el);
                } else if (tool === 'emoji') {
                    // For emoji, show the picker panel — user picks which emoji to add
                    const { EmojiTool } = await import('../tools/emoji/EmojiTool.js');
                    if (panelTitle) panelTitle.textContent = 'Emoji';
                    if (panelBody) EmojiTool.renderPickerPanel(panelBody, this);
                    openPanelMenu();
                    return; // don't fall through to placeholder removal
                } else if (tool === 'shape') {
                    // For shape, show the picker panel — user picks which shape to add
                    const { ShapeTool } = await import('../tools/shape/ShapeTool.js');
                    if (panelTitle) panelTitle.textContent = I18n.t('shapeTool.panelTitle');
                    if (panelBody) ShapeTool.renderPickerPanel(panelBody, this);
                    openPanelMenu();
                    return; // don't fall through to placeholder removal
                } else if (tool === 'icone') {
                    // For icons, show the picker panel — user picks which icon to add
                    const { IconTool } = await import('../tools/icon/IconTool.js');
                    if (panelTitle) panelTitle.textContent = I18n.t('iconTool.panelTitle');
                    if (panelBody) IconTool.renderPickerPanel(panelBody, this);
                    openPanelMenu();
                    return; // don't fall through to placeholder removal
                } else if (tool === 'conteudovariavel') {
                    const { VariableContentTool } = await import('../tools/variablecontent/VariableContentTool.js');
                    const el = VariableContentTool.createElement(tool, this);
                    el.setAttribute('x', cx - 110);
                    el.setAttribute('y', cy - 25);
                    mainPage.appendChild(el);
                } else if (tool === 'textocurvo') {
                    const { TextoCurvoTool } = await import('../tools/textocurvo/TextoCurvoTool.js');
                    const el = TextoCurvoTool.createElement(tool, this);
                    el.setAttribute('x', cx - 80);
                    el.setAttribute('y', cy - 80);
                    mainPage.appendChild(el);
                } else if (tool === 'carimbo') {
                    const { CarimboTool } = await import('../tools/carimbo/CarimboTool.js');
                    const el = CarimboTool.createElement(tool, this);
                    el.setAttribute('x', cx - 80);
                    el.setAttribute('y', cy - 80);
                    mainPage.appendChild(el);
                } else {
                    const { TextTool } = await import('../tools/text/TextTool.js');
                    const el = TextTool.createElement(tool, this);
                    el.setAttribute('x', cx - 100);
                    el.setAttribute('y', cy - 30);
                    mainPage.appendChild(el);
                }

                // Remove placeholder se existir
                const placeholder = mainPage.querySelector('div[style*="font-size: 14px"]');
                if (placeholder) placeholder.remove();
            });
        });

        // Restore canvas when clicking any tool other than gerador/calendario
        // (both treat #main-page as the live preview area).
        toolBtns.forEach(btn => {
            const tool = btn.dataset.tool || btn.id.replace('pwa-sidebar-', '').replace('pwa-btn-', '');
            if (tool !== 'gerador' && tool !== 'calendario') {
                btn.addEventListener('click', () => {
                    restoreOriginalCanvas();
                });
            }
        });

        // Gerador, Papeis e Emoji — clique direto (desktop)
        toolBtns.forEach(btn => {
            const tool = btn.dataset.tool || btn.id.replace('pwa-sidebar-', '');
            if (tool === 'emoji') {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    document.querySelectorAll('.craftools-tool-btn, .footer-nav-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const { EmojiTool } = await import('../tools/emoji/EmojiTool.js');
                    if (panelTitle) panelTitle.textContent = 'Emoji';
                    if (panelBody) EmojiTool.renderPickerPanel(panelBody, this);
                    openPanelMenu();
                });
            }
            if (tool === 'shape') {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    document.querySelectorAll('.craftools-tool-btn, .footer-nav-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const { ShapeTool } = await import('../tools/shape/ShapeTool.js');
                    if (panelTitle) panelTitle.textContent = I18n.t('shapeTool.panelTitle');
                    if (panelBody) ShapeTool.renderPickerPanel(panelBody, this);
                    openPanelMenu();
                });
            }
            if (tool === 'icone') {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    document.querySelectorAll('.craftools-tool-btn, .footer-nav-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const { IconTool } = await import('../tools/icon/IconTool.js');
                    if (panelTitle) panelTitle.textContent = I18n.t('iconTool.panelTitle');
                    if (panelBody) IconTool.renderPickerPanel(panelBody, this);
                    openPanelMenu();
                });
            }
            if (tool === 'gerador' || tool === 'papeis' || tool === 'agenda' || tool === 'calendario' || tool === 'album' || tool === 'fatiador' || tool === 'textocurvo' || tool === 'carimbo') {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.craftools-tool-btn, .footer-nav-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    if (tool === 'papeis') {
                        // Find the active page
                        const page = this.querySelector('.craftools-page') || document.querySelector('.craftools-page');
                        if (page) {
                            let paperEl = page.querySelector('craftools-element[data-craftool="papeis"]');
                            if (!paperEl) {
                                const { PaperTool } = await import('../tools/paper/PaperTool.js');
                                paperEl = PaperTool.createElement('papeis', this);
                                page.appendChild(paperEl);
                            }
                            setTimeout(() => {
                                if (typeof paperEl.select === 'function') paperEl.select();
                            }, 50);
                            closeSidebar();
                            return;
                        }
                    }

                    if (tool === 'agenda') {
                        const { AgendaExportTool } = await import('../tools/agenda/AgendaExportTool.js');
                        openPanelMenu();
                        this.activePage = null;
                        AgendaExportTool.setup(this);
                        return;
                    }

                    if (tool === 'album') {
                        // Open the Album panel on the active page (or the first
                        // page of the document), just like clicking the sidebar
                        // for other full-page tools (Generator/Agenda/Calendar).
                        // Drag-and-drop already worked (drop handler in PageTool.js).
                        const { AlbumTool } = await import('../tools/album/AlbumTool.js');
                        const targetPage = this.activePage || this.querySelector('.craftools-page');
                        if (targetPage) AlbumTool.setup(this, targetPage);
                        return;
                    }

                    if (tool === 'calendario') {
                        const { CalendarTool } = await import('../tools/calendar/CalendarTool.js');
                        openPanelMenu();
                        this.activePage = null;
                        CalendarTool.setup(this);
                        return;
                    }

                    if (tool === 'gerador') {
                        const { GeradorTool } = await import('../tools/gerador/GeradorTool.js');

                        const mainPage = document.getElementById('main-page');
                        if (mainPage && this._savedPageHtml === undefined) {
                            this._savedPageHtml = mainPage.innerHTML;
                            this._savedPageCssText = mainPage.style.cssText;
                        }

                        openPanelMenu();
                        this.activePage = null;
                        GeradorTool.setup(this);
                        return;
                    }

                    if (tool === 'fatiador') {
                        const { ImageSlicerTool } = await import('../tools/imageslicer/ImageSlicerTool.js');
                        openPanelMenu();
                        this.activePage = null;
                        ImageSlicerTool.setup(this);
                        return;
                    }

                    if (tool === 'textocurvo') {
                        if (isMobile()) return; // mobile handled by tap-to-add above
                        const { TextoCurvoTool } = await import('../tools/textocurvo/TextoCurvoTool.js');
                        const targetPage = this.activePage || this.querySelector('.craftools-page');
                        if (targetPage) {
                            const el = TextoCurvoTool.createElement('textocurvo', this);
                            targetPage.appendChild(el);
                            closeSidebar();
                        }
                        return;
                    }

                    if (tool === 'carimbo') {
                        if (isMobile()) return; // mobile handled by tap-to-add above
                        const { CarimboTool } = await import('../tools/carimbo/CarimboTool.js');
                        const targetPage = this.activePage || this.querySelector('.craftools-page');
                        if (targetPage) {
                            const el = CarimboTool.createElement('carimbo', this);
                            targetPage.appendChild(el);
                            closeSidebar();
                        }
                        return;
                    }

                    // Fallback (others) — just open the panel with a message; do not close the sidebar
                    if (panelTitle) panelTitle.textContent = btn.title || I18n.t('editor.papers');
                    if (panelBody) panelBody.innerHTML = `<div style="padding: 14px;"><p style="font-size: 12px; color: var(--text-secondary)">${I18n.t('editor.emptyPanel')}</p></div>`;
                    openPanelMenu();
                    this.activePage = null;
                });
            }
        });

        if (closePanel) {
            closePanel.addEventListener('click', () => {
                closePanelMenu();
            });
        }

        // ── New Page ───────────────────────────────────────────────────────
        const newPageBtns = document.querySelectorAll('#new-page-btn, #pwa-sidebar-newpage');
        this.activePage = null;
        newPageBtns.forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            PageTool.addNewPage(this);
            closeSidebar();
        }));

        // ── PDF Export ────────────────────────────────────────────────────
        document.querySelectorAll('#pdf-btn, #pwa-sidebar-export').forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            closeSidebar();
            PdfExport.print(this);
        }));

        // ── PNG / JPG Export ──────────────────────────────────────────────
        document.querySelectorAll('#pwa-sidebar-png').forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            closeSidebar();
            ImageExport.export(this);
        }));

        // Initialize first page event
        const mainPage = this.querySelector('#main-page');
        PageTool.attachPageEvents(this, mainPage);

        // Notify history of page add (from new page btn)
        document.querySelectorAll('#new-page-btn, #pwa-sidebar-newpage').forEach(btn => {
            btn.addEventListener('click', () => {
                setTimeout(() => {
                    const pagesWrapper = this.querySelector('#pages-wrapper');
                    if (pagesWrapper) HistoryManager.snapshot(pagesWrapper);
                    SessionManager.markDirty();
                }, 100);
            });
        });

        // ── Zoom ───────────────────────────────────────────────────────────
        let zoomLevel = 1.0;
        window.craftoolsZoomLevel = 1.0;
        const zoomLevelLabel = this.querySelector('#zoom-level');
        const pagesWrapper = this.querySelector('#pages-wrapper');
        
        const updateZoom = () => {
            if (pagesWrapper) {
                pagesWrapper.style.transform = `scale(${zoomLevel})`;
                zoomLevelLabel.textContent = Math.round(zoomLevel * 100) + '%';
                window.craftoolsZoomLevel = zoomLevel;
            }
        };

        this.querySelector('#zoom-in-btn').addEventListener('click', () => {
            if (zoomLevel < 3.0) zoomLevel += 0.1;
            updateZoom();
        });

        this.querySelector('#zoom-out-btn').addEventListener('click', () => {
            if (zoomLevel > 0.2) zoomLevel -= 0.1;
            updateZoom();
        });

        this.querySelector('#zoom-reset-btn').addEventListener('click', () => {
            zoomLevel = 1.0;
            updateZoom();
        });

        // ── Pinch-to-zoom (mobile) ─────────────────────────────────────────
        const canvas = this.querySelector('#canvas-area');
        let pinchStartDist = null;
        let pinchStartZoom = 1.0;

        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
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

    static init() { customElements.define("craftools-editor", Craftools_Editor) }
}
