import {Craftools_Settings} from "../settings/Settings.js";

export class Craftools_Setup extends HTMLElement{
    constructor(){ super(); }
    
    connectedCallback(){
        this.renderMediaTypes();
    }
    
    renderMediaTypes() {
        let mediaTypes = "<div style='display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px;'>";
        for (const key in Craftools_Settings.mediaTypes) {
            const media = Craftools_Settings.mediaTypes[key];
            mediaTypes += `
            <a href="#" data-media="${key}" class="media-btn" style="background: var(--bg-panel); border: 1px solid var(--border); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; text-decoration: none; color: var(--text-primary); transition: all 0.2s; box-shadow: var(--shadow);">
                <span class="material-symbols-outlined" style="font-size: 32px; color: var(--accent);">${media.icon}</span>
                <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${media.name}</h3>
                <p style="margin: 0; font-size: 12px; color: var(--text-secondary); text-align: center;">${media.description}</p>
            </a>`;
        }
        mediaTypes += "</div>";

        this.innerHTML = `
        <div class="craftools-app" style="align-items: center; justify-content: center; height: 100vh;">
            <div style="background: var(--bg-shell); padding: 40px; border-radius: 16px; box-shadow: var(--shadow-xl); width: 100%; max-width: 800px; text-align: center;">
                <h2 style="font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; font-family: 'DM Serif Display', serif;">O que você quer criar?</h2>
                <p style="color: var(--text-secondary); font-size: 14px;">Selecione uma categoria abaixo para começar</p>
                ${mediaTypes}
            </div>
        </div>
        <style>
            .media-btn:hover { border-color: var(--accent) !important; transform: translateY(-2px); box-shadow: var(--shadow-lg) !important; }
        </style>
        `;

        this.querySelectorAll('.media-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.renderSizes(btn.getAttribute('data-media'));
            });
        });
    }

    renderSizes(mediaKey) {
        const media = Craftools_Settings.mediaTypes[mediaKey];
        if (!media) return;
        
        let sizesHtml = "<div style='display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px;'>";
        media.sizes.forEach((size, index) => {
            let descSize = size.size !== "*" ? ` - ${size.size.replace(',', 'x')}` : "";
            sizesHtml += `
            <a href="#" data-size="${index}" class="media-btn" style="background: var(--bg-panel); border: 1px solid var(--border); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; text-decoration: none; color: var(--text-primary); transition: all 0.2s; box-shadow: var(--shadow);">
                <span class="material-symbols-outlined" style="font-size: 32px; color: var(--accent);">${size.icon}</span>
                <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${size.name} <span style="font-size: 12px; color: var(--text-muted);">(${size.sizeUnit}${descSize})</span></h3>
                <p style="margin: 0; font-size: 12px; color: var(--text-secondary); text-align: center;">${size.description}</p>
            </a>`;
        });
        sizesHtml += "</div>";

        this.innerHTML = `
        <div class="craftools-app" style="align-items: center; justify-content: center; height: 100vh;">
            <div style="background: var(--bg-shell); padding: 40px; border-radius: 16px; box-shadow: var(--shadow-xl); width: 100%; max-width: 800px; text-align: center; position: relative;">
                <button id="back-btn" class="craftools-topbtn" style="position: absolute; top: 20px; left: 20px;">
                    <span class="material-symbols-outlined">arrow_back</span> Voltar
                </button>
                <h2 style="font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; font-family: 'DM Serif Display', serif;">Escolha o tamanho</h2>
                <p style="color: var(--text-secondary); font-size: 14px;">Tamanhos disponíveis para ${media.name}</p>
                ${sizesHtml}
            </div>
        </div>
        <style>
            .media-btn:hover { border-color: var(--accent) !important; transform: translateY(-2px); box-shadow: var(--shadow-lg) !important; }
        </style>
        `;

        this.querySelector('#back-btn').addEventListener('click', () => {
            this.renderMediaTypes();
        });

        this.querySelectorAll('.media-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const sizeIndex = btn.getAttribute('data-size');
                const selectedSize = media.sizes[sizeIndex];
                
                // Dispatch event 
                const event = new CustomEvent('craftools-start', {
                    bubbles: true,
                    detail: { media: media, size: selectedSize }
                });
                this.dispatchEvent(event);
            });
        });
    }

    static init(){ customElements.define("craftools-setup", Craftools_Setup) }
}