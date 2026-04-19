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

                <aside class="craftools-sidebar" id="main-sidebar">
                    <span class="craftools-sec-label">${I18n.t('editor.page')}</span>
                    
                    <button class="craftools-tool-btn" id="new-page-btn" title="${I18n.t('editor.newPage')}">
                        <span class="material-symbols-outlined">post_add</span>
                        <span class="craftools-tool-label">${I18n.t('editor.newPage')}</span>
                    </button>
                    
                    <button class="craftools-tool-btn" data-tool="gerador" title="${I18n.t('editor.generator')}">
                        <span class="material-symbols-outlined">auto_awesome_mosaic</span>
                        <span class="craftools-tool-label">${I18n.t('editor.generator')}</span>
                    </button>

                    <span class="craftools-sec-label">${I18n.t('editor.tools')}</span>
                    
                    <button class="craftools-tool-btn" data-tool="titulo" draggable="true" title="Título">
                        <span class="material-symbols-outlined">title</span>
                        <span class="craftools-tool-label">Título</span>
                    </button>
                    
                    <button class="craftools-tool-btn" data-tool="paragrafo" draggable="true" title="Parágrafo">
                        <span class="material-symbols-outlined">notes</span>
                        <span class="craftools-tool-label">Parágrafo</span>
                    </button>
                    
                    <button class="craftools-tool-btn" data-tool="imagem" draggable="true" title="${I18n.t('editor.image')}">
                        <span class="material-symbols-outlined">image</span>
                        <span class="craftools-tool-label">${I18n.t('editor.image')}</span>
                    </button>

                    <button class="craftools-tool-btn" data-tool="album" draggable="true" title="${I18n.t('editor.album')}">
                        <span class="material-symbols-outlined">photo_library</span>
                        <span class="craftools-tool-label">${I18n.t('editor.album')}</span>
                    </button>
                    
                    <button class="craftools-tool-btn" data-tool="papeis" title="${I18n.t('editor.papers')}">
                        <span class="material-symbols-outlined">note_stack</span>
                        <span class="craftools-tool-label">${I18n.t('editor.papers')}</span>
                    </button>

                    <span class="craftools-sec-label">Salvar</span>

                    <button class="craftools-tool-btn" id="pdf-btn" title="Exportar PDF">
                        <span class="material-symbols-outlined">picture_as_pdf</span>
                        <span class="craftools-tool-label">PDF</span>
                    </button>
                </aside>
                
                <main class="craftools-canvas" id="canvas-area">
                    <div class="craftools-pages" id="pages-wrapper">
                        <section class="craftools-page" style="width: ${dimWidth}; min-height: ${dimHeight}; background: white;" id="main-page">
                             <!-- Página Vazia -->
                             <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 14px;">
                             </div>
                        </section>
                    </div>
                </main>
                
                <aside class="craftools-panel hidden" id="right-panel">
                    <div class="craftools-panel-drag-indicator"></div>
                    <div class="craftools-panel-head">
                        <span class="craftools-panel-title" id="panel-title">${I18n.t('editor.panelTitle')}</span>
                        <button class="craftools-icon-btn" id="close-panel">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div class="craftools-panel-body" id="panel-body" style="padding: 0;">
                        <!-- Conteúdo dinâmico -->
                    </div>
                </aside>
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
        const sidebar = this.querySelector('#main-sidebar');
        const overlay = this.querySelector('#sidebar-overlay');

        if (window.innerWidth <= 768) {
            mobileMenuBtn.style.display = 'flex';
        }
        window.addEventListener('resize', () => {
            mobileMenuBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
        });

        const openSidebar = () => {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('visible');
        };
        const closeSidebar = () => {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('visible');
        };

        mobileMenuBtn.addEventListener('click', openSidebar);
        overlay.addEventListener('click', closeSidebar);

        // ── Element selection ──────────────────────────────────────────────
        this.addEventListener('craftools-element-select', (e) => {
            const el = e.detail.element;
            const toolType = el.getAttribute('data-craftool');
            
            if (toolType === 'titulo' || toolType === 'paragrafo') {
                this.ctxBar.show(el, TextTool.getCtxOptions(el));
                
                const rightPanel = this.querySelector('#right-panel');
                const panelTitle = this.querySelector('#panel-title');
                const panelBody = this.querySelector('#panel-body');
                
                panelTitle.textContent = toolType === 'titulo' ? (I18n.t('textTool.propsTitle') || 'Propriedades do Título') : (I18n.t('textTool.propsParagraph') || 'Propriedades do Parágrafo');
                TextTool.renderPropertiesPanel(panelBody, el);
                rightPanel.classList.remove('hidden');
                this.activePage = null;
            } else if (toolType === 'imagem') {
                this.ctxBar.show(el, ImageTool.getCtxOptions(el));
                
                const rightPanel = this.querySelector('#right-panel');
                const panelTitle = this.querySelector('#panel-title');
                const panelBody = this.querySelector('#panel-body');
                
                panelTitle.textContent = I18n.t('imageTool.panelTitle') || 'Propriedades da Imagem';
                ImageTool.renderPropertiesPanel(panelBody, el);
                rightPanel.classList.remove('hidden');
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
        const toolBtns = this.querySelectorAll('.craftools-tool-btn[data-tool]');
        const rightPanel = this.querySelector('#right-panel');
        const panelTitle = this.querySelector('#panel-title');
        const closePanel = this.querySelector('#close-panel');
        const panelBody = this.querySelector('#panel-body');

        // Desktop: drag & drop
        toolBtns.forEach(btn => {
            if (btn.getAttribute('draggable') === 'true') {
                btn.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('ToolType', btn.dataset.tool);
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
            if (btn.dataset.tool === 'gerador' || btn.dataset.tool === 'papeis') {
                btn.addEventListener('click', () => {
                    this.querySelectorAll('.craftools-tool-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    panelTitle.textContent = btn.title;
                    panelBody.innerHTML = `<div style="padding: 14px;"><p style="font-size: 12px; color: var(--text-secondary)">${I18n.t('editor.emptyPanel')}</p></div>`;
                    rightPanel.classList.remove('hidden');
                    this.activePage = null;
                    closeSidebar();
                });
            }
        });

        closePanel.addEventListener('click', () => {
            rightPanel.classList.add('hidden');
            this.querySelectorAll('.craftools-tool-btn').forEach(b => b.classList.remove('active'));
            this.activePage = null;
        });

        // ── Nova Página ────────────────────────────────────────────────────
        const newPageBtn = this.querySelector('#new-page-btn');
        this.activePage = null;
        newPageBtn.addEventListener('click', () => {
            PageTool.addNewPage(this);
            closeSidebar();
        });

        // ── PDF Export ────────────────────────────────────────────────────
        this.querySelector('#pdf-btn').addEventListener('click', () => {
            closeSidebar();
            PdfExport.print(this);
        });

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
