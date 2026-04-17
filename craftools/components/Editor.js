import { Craftools_Settings } from "../settings/Settings.js";

export class Craftools_Editor extends HTMLElement {
    constructor() { super(); }
    
    connectedCallback() {
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
                    <span style="font-family: 'DM Serif Display', serif; font-size: 17px; font-weight: 700; color: var(--text-primary);">CrafTools</span>
                    <span style="width: 1px; height: 16px; background: var(--border); flex-shrink: 0;"></span>
                    <div style="display: flex; align-items: center; gap: 4px; background: var(--bg-input); border-radius: 6px; padding: 2px;">
                        <button class="craftools-icon-btn" title="Zoom Out" id="zoom-out-btn">
                            <span class="material-symbols-outlined">zoom_out</span>
                        </button>
                        <span id="zoom-level" style="font-size: 11px; color: var(--text-secondary); min-width: 45px; text-align: center; font-weight: 500;">100%</span>
                        <button class="craftools-icon-btn" title="Zoom In" id="zoom-in-btn">
                            <span class="material-symbols-outlined">zoom_in</span>
                        </button>
                        <button class="craftools-icon-btn" title="Reset Zoom" id="zoom-reset-btn">
                            <span class="material-symbols-outlined">fit_screen</span>
                        </button>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button class="craftools-icon-btn" title="Alternar tema" id="theme-btn">
                        <span class="material-symbols-outlined">dark_mode</span>
                    </button>
                </div>
            </header>
            <div class="craftools-body">
                <aside class="craftools-sidebar">
                    <span class="craftools-sec-label">Ferramentas</span>
                    
                    <button class="craftools-tool-btn" data-tool="texto" title="Texto">
                        <span class="material-symbols-outlined">title</span>
                        <span class="craftools-tool-label">Texto</span>
                    </button>
                    
                    <button class="craftools-tool-btn" data-tool="imagem" title="Imagem">
                        <span class="material-symbols-outlined">image</span>
                        <span class="craftools-tool-label">Imagem</span>
                    </button>

                    <button class="craftools-tool-btn" data-tool="album" title="Álbum">
                        <span class="material-symbols-outlined">photo_library</span>
                        <span class="craftools-tool-label">Álbum</span>
                    </button>
                    
                    <button class="craftools-tool-btn" data-tool="papeis" title="Papéis">
                        <span class="material-symbols-outlined">note_stack</span>
                        <span class="craftools-tool-label">Papéis</span>
                    </button>
                </aside>
                
                <main class="craftools-canvas" id="canvas-area">
                    <div class="craftools-pages" id="pages-wrapper">
                        <section class="craftools-page" style="width: ${dimWidth}; min-height: ${dimHeight}; background: white;" id="main-page">
                             <!-- Página Vazia -->
                             <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 14px;">
                                O seu canvas estará aqui
                             </div>
                        </section>
                    </div>
                </main>
                
                <aside class="craftools-panel hidden" id="right-panel">
                    <div class="craftools-panel-head">
                        <span class="craftools-panel-title" id="panel-title">Ferramenta</span>
                        <button class="craftools-icon-btn" id="close-panel">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div class="craftools-panel-body" style="padding: 14px;">
                        <p style="font-size: 12px; color: var(--text-secondary)">Opções em breve...</p>
                    </div>
                </aside>
            </div>
        </div>
        `;

        // Theme toggle
        const themeBtn = this.querySelector('#theme-btn');
        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
            themeBtn.innerHTML = `<span class="material-symbols-outlined">${isDark ? 'dark_mode' : 'light_mode'}</span>`;
        });

        // Sidebar Tools -> Open Right panel
        const toolBtns = this.querySelectorAll('.craftools-tool-btn');
        const rightPanel = this.querySelector('#right-panel');
        const panelTitle = this.querySelector('#panel-title');
        const closePanel = this.querySelector('#close-panel');

        toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                toolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                panelTitle.textContent = btn.title;
                rightPanel.classList.remove('hidden');
            });
        });

        closePanel.addEventListener('click', () => {
            rightPanel.classList.add('hidden');
            toolBtns.forEach(b => b.classList.remove('active'));
        });

        // Page Click Event
        const mainPage = this.querySelector('#main-page');
        mainPage.addEventListener('click', (e) => {
            if (e.target === mainPage || e.target.closest('div[style*="canvas"]')) {
                toolBtns.forEach(b => b.classList.remove('active'));
                panelTitle.textContent = 'Página';
                rightPanel.classList.remove('hidden');
            }
        });

        // Zoom Logic
        let zoomLevel = 1.0;
        const pagesWrapper = this.querySelector('#pages-wrapper');
        const zoomLevelLabel = this.querySelector('#zoom-level');
        
        const updateZoom = () => {
            pagesWrapper.style.transform = `scale(${zoomLevel})`;
            zoomLevelLabel.textContent = Math.round(zoomLevel * 100) + '%';
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
    }

    static init() { customElements.define("craftools-editor", Craftools_Editor) }
}
