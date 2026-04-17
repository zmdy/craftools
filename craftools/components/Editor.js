import { Craftools_Settings } from "../settings/Settings.js";

export class Craftools_Editor extends HTMLElement {
    constructor() { super(); }
    
    connectedCallback() {
        this.innerHTML = `
        <div class="ime-app">
            <header class="ime-topbar">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-family: 'DM Serif Display', serif; font-size: 17px; font-weight: 700; color: var(--text-primary);">CrafTools</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button class="ime-icon-btn" title="Alternar tema" id="theme-btn">
                        <span class="material-symbols-outlined">dark_mode</span>
                    </button>
                    <!-- Sem botões de importar/exportar por enquanto -->
                </div>
            </header>
            <div class="ime-body">
                <aside class="ime-sidebar">
                    <span class="ime-sec-label">Ferramentas</span>
                    
                    <button class="ime-tool-btn" data-tool="texto" title="Texto">
                        <span class="material-symbols-outlined">title</span>
                        <span class="ime-tool-label">Texto</span>
                    </button>
                    
                    <button class="ime-tool-btn" data-tool="imagem" title="Imagem">
                        <span class="material-symbols-outlined">image</span>
                        <span class="ime-tool-label">Imagem</span>
                    </button>

                    <button class="ime-tool-btn" data-tool="album" title="Álbum">
                        <span class="material-symbols-outlined">photo_library</span>
                        <span class="ime-tool-label">Álbum</span>
                    </button>
                    
                    <button class="ime-tool-btn" data-tool="papeis" title="Papéis">
                        <span class="material-symbols-outlined">note_stack</span>
                        <span class="ime-tool-label">Papéis</span>
                    </button>
                </aside>
                
                <main class="ime-canvas">
                    <div class="ime-pages">
                        <section class="imgMePage" style="width: 794px; min-height: 560px; background: white;">
                             <!-- Página Vazia -->
                             <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 14px;">
                                O seu canvas estará aqui
                             </div>
                        </section>
                    </div>
                </main>
                
                <aside class="ime-panel hidden" id="right-panel">
                    <div class="ime-panel-head">
                        <span class="ime-panel-title" id="panel-title">Ferramenta</span>
                        <button class="ime-icon-btn" id="close-panel">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div class="ime-panel-body" style="padding: 14px;">
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
        const toolBtns = this.querySelectorAll('.ime-tool-btn');
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
    }

    static init() { customElements.define("craftools-editor", Craftools_Editor) }
}
