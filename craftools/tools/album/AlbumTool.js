import { I18n } from "../../settings/Translations.js";
import { Craftools_LayoutGrid } from "../../utils/LayoutGrid.js";
import { GridSizes } from "../../utils/GridSizes.js";
import { PageTool } from "../page/PageTool.js";
import "./AlbumTool_Translations.js";

export class AlbumTool {
    static setup(editor, pageEl) {
        const rightPanel = editor.querySelector('#right-panel');
        const panelTitle = editor.querySelector('#panel-title');
        const panelBody = editor.querySelector('#panel-body');

        panelTitle.textContent = I18n.t('albumTool.panelTitle');
        editor.activePage = pageEl;

        let selectedSize = null;
        let selectedTemplate = null;
        let photos = [];

        // Load sizes from global settings
        let availableSizes = [];
        if (window.craftoolsApp && window.craftoolsApp.activeMedia && window.craftoolsApp.activeMedia.sizes) {
            availableSizes = window.craftoolsApp.activeMedia.sizes.filter(s => s.size !== "*");
        } else {
            availableSizes = [
                 { name: "A4", size: "210,297", sizeUnit: "mm" },
                 { name: "A5", size: "148,210", sizeUnit: "mm" }
            ];
        }

        if(availableSizes.length > 0) selectedSize = availableSizes[0];

        const renderPanel = () => {
            const sizeHtml = availableSizes.map((s, idx) => 
                `<button class="craftools-pill size-btn ${selectedSize === s ? 'active' : ''}" data-idx="${idx}">${s.name}</button>`
            ).join('');

            const matchingTemplates = GridSizes.filter(t => selectedSize ? t.sizes.includes(selectedSize.size) : false);
            
            const templateHtml = matchingTemplates.length > 0 
                ? matchingTemplates.map((t, idx) => `
                    <button class="craftools-pill template-btn ${selectedTemplate === t ? 'active' : ''}" data-idx="${idx}" style="width: 100%; text-align: left; padding: 10px; margin-bottom: 5px;">
                        ${t.name}<br>
                        <span style="font-size: 10px; color: var(--text-secondary)">Cell: ${t.cellWidth}x${t.cellHeight} | Gap: ${t.cellGap}</span>
                    </button>
                  `).join('')
                : `<div style="font-size: 12px; color: var(--text-muted)">${I18n.t('albumTool.noTemplate')}</div>`;

            panelBody.innerHTML = `
                <div style="padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('albumTool.step1')}</span>
                        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                            ${sizeHtml}
                        </div>
                    </div>

                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('albumTool.step2')}</span>
                        <div style="display: flex; flex-direction: column; gap: 0;">
                            ${templateHtml}
                        </div>
                    </div>

                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('albumTool.step3')}</span>
                        <input type="file" id="album-file-input" multiple accept="image/*" style="display: none;">
                        <button class="craftools-topbtn" id="album-select-btn" style="width: 100%; justify-content: center;">
                            <span class="material-symbols-outlined">imagesmode</span> ${photos.length > 0 ? `${photos.length} ${I18n.t('albumTool.photosSelected')}` : I18n.t('albumTool.selectPhotos')}
                        </button>
                    </div>

                    <button class="craftools-topbtn" id="album-generate-btn" style="width: 100%; justify-content: center; background: var(--accent); color: white; border: none; margin-top: 10px;" ${(!selectedTemplate || photos.length === 0) ? 'disabled' : ''}>
                        <span class="material-symbols-outlined">dynamic_feed</span> ${I18n.t('albumTool.generate')}
                    </button>
                </div>
            `;

            panelBody.querySelectorAll('.size-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedSize = availableSizes[btn.getAttribute('data-idx')];
                    selectedTemplate = null; 
                    
                    if(selectedSize) {
                        const parts = selectedSize.size.split(',');
                        pageEl.style.width = parts[0] + selectedSize.sizeUnit;
                        pageEl.style.minHeight = parts[1] + selectedSize.sizeUnit;
                        window.craftoolsSize = selectedSize;
                    }
                    renderPanel();
                });
            });

            panelBody.querySelectorAll('.template-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedTemplate = matchingTemplates[btn.getAttribute('data-idx')];
                    renderPanel();
                });
            });

            const fileInput = panelBody.querySelector('#album-file-input');
            const selectBtn = panelBody.querySelector('#album-select-btn');
            const generateBtn = panelBody.querySelector('#album-generate-btn');

            selectBtn.addEventListener('click', () => fileInput.click());
            
            fileInput.addEventListener('change', (e) => {
                photos = Array.from(e.target.files);
                renderPanel();
            });

            if (generateBtn) {
                generateBtn.addEventListener('click', () => {
                    this.processPages(editor, pageEl, selectedSize, selectedTemplate, photos);
                    rightPanel.classList.add('hidden');
                });
            }
        };

        renderPanel();
        rightPanel.classList.remove('hidden');
    }

    static async processPages(editor, startPage, pageSize, template, files) {
        let images = await Promise.all(files.map(f => new Promise(resolve => {
            let fr = new FileReader(); 
            fr.onload = e => resolve(e.target.result); 
            fr.readAsDataURL(f);
        })));

        // Instancia a grid enviando os dados
        const gridSystem = new Craftools_LayoutGrid(editor, startPage, pageSize, template);

        // Renderiza passando os "images" (itens) e uma callback que desenha o DOM de cada célula na grade final
        await gridSystem.render(images, (cellContainer, src, index) => {
            const unit = pageSize.sizeUnit;
            let u = unit === 'mm' ? 3.7795275591 : 1;

            cellContainer.style.background = "#fff";
            cellContainer.style.border = "1px dashed #ccc";

            let imgEl = document.createElement('div');
            const p = template.cellPadding.split(" ");
            
            imgEl.style.cssText = `
                position: absolute;
                top: ${parseFloat(p[0]) * u}px;
                right: ${parseFloat(p[1]) * u}px;
                bottom: ${parseFloat(p[2]) * u}px;
                left: ${parseFloat(p[3]) * u}px;
                background-image: url(${src});
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                pointer-events: none;
            `;

            cellContainer.appendChild(imgEl);
        });
    }
}
