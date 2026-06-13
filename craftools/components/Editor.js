import { Craftools_Settings } from "../settings/Settings.js";
import { PageTool } from "../tools/page/PageTool.js";
import { TextTool } from "../tools/text/TextTool.js";
import { ImageTool } from "../tools/image/ImageTool.js";
import { CtxBar } from "../utils/CtxBar.js";
import { I18n } from "../settings/Translations.js";
import { PdfExport } from "../utils/PdfExport.js";

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
                             <!-- Página Vazia -->
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
    }

    bindEvents() {
        const isMobile = () => window.innerWidth <= 768;

        // ── Mobile menu toggle ─────────────────────────────────────────────
        const mobileMenuBtn = this.querySelector('#mobile-menu-btn');
        const sidebar = document.getElementById('right-panel');
        const overlay = this.querySelector('#sidebar-overlay');

        if (window.innerWidth <= 768) {
            mobileMenuBtn.style.display = 'flex';
        }
        window.addEventListener('resize', () => {
            mobileMenuBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
        });

        const openSidebar = () => {
            if(sidebar) sidebar.classList.add('panel-open');
            overlay.classList.add('visible');
            const menuIcon = document.getElementById('pwa-menu-icon');
            if(menuIcon && menuIcon.textContent !== 'close') {
                menuIcon.textContent = 'close';
            }
        };
        const closeSidebar = () => {
            if(sidebar) sidebar.classList.remove('panel-open');
            overlay.classList.remove('visible');
            const menuIcon = document.getElementById('pwa-menu-icon');
            if(menuIcon && menuIcon.textContent !== 'menu') {
                menuIcon.textContent = 'menu';
            }
        };

        mobileMenuBtn.addEventListener('click', openSidebar);
        overlay.addEventListener('click', closeSidebar);

        // ── Element selection ──────────────────────────────────────────────
        this.addEventListener('craftools-element-select', (e) => {
            const el = e.detail.element;
            const toolType = el.getAttribute('data-craftool');
            
            const rightPanel = document.getElementById('right-panel');
            const panelTitle = document.getElementById('panel-title');
            const panelBody = document.getElementById('panel-body');
            const defaultMenu = document.getElementById('panel-default-menu');
            const closePanel = document.getElementById('close-panel');
            const panelLogo = document.getElementById('panel-logo');
            
            const openPanelMenu = () => {
                if(defaultMenu) defaultMenu.classList.add('d-none');
                if(panelBody) panelBody.classList.remove('d-none');
                if(closePanel) closePanel.classList.remove('d-none');
                if(panelLogo) panelLogo.classList.add('d-none');
                if(rightPanel) rightPanel.classList.add('panel-open');
                const menuIcon = document.getElementById('pwa-menu-icon');
                if(menuIcon && menuIcon.textContent !== 'close') {
                    menuIcon.textContent = 'close';
                }
            };

            if (toolType === 'titulo' || toolType === 'paragrafo') {
                this.ctxBar.show(el, TextTool.getCtxOptions(el));
                
                if (panelTitle) panelTitle.textContent = toolType === 'titulo' ? (I18n.t('textTool.propsTitle') || 'Propriedades do Título') : (I18n.t('textTool.propsParagraph') || 'Propriedades do Parágrafo');
                if (panelBody) TextTool.renderPropertiesPanel(panelBody, el);
                openPanelMenu();
                this.activePage = null;
            } else if (toolType === 'imagem') {
                this.ctxBar.show(el, ImageTool.getCtxOptions(el));
                
                if (panelTitle) panelTitle.textContent = I18n.t('imageTool.panelTitle') || 'Propriedades da Imagem';
                if (panelBody) ImageTool.renderPropertiesPanel(panelBody, el);
                openPanelMenu();
                this.activePage = null;
            } else {
                this.ctxBar.show(el, []);
            }
        });

        this.addEventListener('craftools-element-deselect', (e) => {
            this.ctxBar.hide();
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
        const panelLogo = document.getElementById('panel-logo');
        
        const openPanelMenu = () => {
            if(defaultMenu) defaultMenu.classList.add('d-none');
            if(panelBody) panelBody.classList.remove('d-none');
            if(closePanel) closePanel.classList.remove('d-none');
            if(panelLogo) panelLogo.classList.add('d-none');
            if(rightPanel) rightPanel.classList.add('panel-open');
            const menuIcon = document.getElementById('pwa-menu-icon');
            if(menuIcon && menuIcon.textContent !== 'close') {
                menuIcon.textContent = 'close';
            }
        };

        const closePanelMenu = () => {
            if(defaultMenu) defaultMenu.classList.remove('d-none');
            if(panelBody) panelBody.classList.add('d-none');
            if(closePanel) closePanel.classList.add('d-none');
            if(panelLogo) panelLogo.classList.remove('d-none');
            if(panelTitle) panelTitle.textContent = "Technology for Creativity";
            document.querySelectorAll('.craftools-tool-btn, .footer-nav-btn').forEach(b => b.classList.remove('active'));
            this.querySelectorAll('.craftools-grid-cell.cell-selected').forEach(c => c.classList.remove('cell-selected'));
            this.activePage = null;
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
            if (!['titulo', 'paragrafo', 'imagem', 'album'].includes(tool)) return;

            btn.addEventListener('click', async () => {
                if (!isMobile()) return; // Desktop usa drag, não clique

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

        // Gerador e Papeis — clique direto
        toolBtns.forEach(btn => {
            const tool = btn.dataset.tool || btn.id.replace('pwa-sidebar-', '');
            if (tool === 'gerador' || tool === 'papeis') {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.craftools-tool-btn, .footer-nav-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    if(panelTitle) panelTitle.textContent = btn.title || I18n.t('editor.papers');
                    if(panelBody) panelBody.innerHTML = `<div style="padding: 14px;"><p style="font-size: 12px; color: var(--text-secondary)">${I18n.t('editor.emptyPanel')}</p></div>`;
                    openPanelMenu();
                    this.activePage = null;
                    closeSidebar();
                });
            }
        });

        if (closePanel) {
            closePanel.addEventListener('click', () => {
                closePanelMenu();
            });
        }

        // ── Nova Página ────────────────────────────────────────────────────
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

        // Initialize first page event
        const mainPage = this.querySelector('#main-page');
        PageTool.attachPageEvents(this, mainPage);

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
                pinchStartDist = Math.hypot(dx, dy);
                pinchStartZoom = zoomLevel;
            }
        }, { passive: true });

        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && pinchStartDist) {
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
