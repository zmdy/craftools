import { ImageTool } from "../image/ImageTool.js";
import { ImageTransform } from "../image/ImageTransform.js";
import { ImageFilters } from "../image/ImageFilters.js";
import { I18n } from "../../settings/Translations.js";
import { Craftools_LayoutGrid } from "../../utils/LayoutGrid.js";
import { GridSizes } from "../../utils/GridSizes.js";
import { CommonProperties } from "../../utils/CommonProperties.js";
import { PageTool } from "../page/PageTool.js";
import { BaseTool } from "../BaseTool.js";
import "./AlbumTool_Translations.js";

export class AlbumTool extends BaseTool {
    static setup(editor, pageEl) {
        const rightPanel = editor.querySelector('#right-panel');
        const panelTitle = editor.querySelector('#panel-title');
        const panelBody = editor.querySelector('#panel-body');

        panelTitle.textContent = I18n.t('albumTool.panelTitle');
        editor.activePage = pageEl;

        // ── State ──────────────────────────────────────────────────────────
        let selectedSize = null;
        let selectedTemplate = null;
        let selectedMode = 'album';      // 'album' | 'card'
        let photos = [];                 // Album mode
        let cardPhoto = null;            // Card mode – single file
        let cardQuantityMode = 'auto';   // 'auto' | 'manual'
        let cardManualQty = 1;

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

        if (availableSizes.length > 0) selectedSize = availableSizes[0];

        // ── Helpers ────────────────────────────────────────────────────────
        const calcPerPage = (template, size) => {
            const parts = size.size.split(',').map(Number);
            const docW = parts[0];
            const docH = parts[1];
            const margins = template.pageMargin.split(" ").map(v => parseFloat(v));
            const [mT, mR, mB, mL] = margins;
            const cellW = template.cellWidth;
            const cellH = template.cellHeight;
            const gap = template.cellGap;
            const cols = Math.floor((docW - mL - mR + gap) / (cellW + gap)) || 1;
            const rows = Math.floor((docH - mT - mB + gap) / (cellH + gap)) || 1;
            return cols * rows;
        };

        // ── Panel renderer ─────────────────────────────────────────────────
        const renderPanel = () => {
            const matchingTemplates = GridSizes.filter(t => selectedSize ? t.sizes.includes(selectedSize.size) : false);

            const sizeHtml = availableSizes.map((s, idx) =>
                `<button class="craftools-pill size-btn ${selectedSize === s ? 'active' : ''}" data-idx="${idx}">${s.name}</button>`
            ).join('');

            const templateHtml = matchingTemplates.length > 0
                ? matchingTemplates.map((t, idx) => `
                    <button class="craftools-pill template-btn ${selectedTemplate === t ? 'active' : ''}" data-idx="${idx}" style="width: 100%; text-align: left; padding: 10px; margin-bottom: 5px;">
                        ${t.name}<br>
                        <span style="font-size: 10px; color: var(--text-secondary)">Cell: ${t.cellWidth}x${t.cellHeight} | Gap: ${t.cellGap}</span>
                    </button>
                  `).join('')
                : `<div style="font-size: 12px; color: var(--text-muted)">${I18n.t('albumTool.noTemplate')}</div>`;

            // Step 4 — specific to each mode
            let step4Html = '';
            if (selectedTemplate) {
                if (selectedMode === 'album') {
                    step4Html = `
                        <div class="craftools-field">
                            <span class="craftools-label">4. Selecionar Fotos</span>
                            <input type="file" id="album-file-input" multiple accept="image/*" style="display: none;">
                            <button class="craftools-topbtn" id="album-select-btn" style="width: 100%; justify-content: center;">
                                <span class="material-symbols-outlined">imagesmode</span>
                                ${photos.length > 0 ? `${photos.length} foto(s) selecionada(s)` : 'Selecionar Fotos'}
                            </button>
                        </div>`;
                } else {
                    const autoQty = selectedSize ? calcPerPage(selectedTemplate, selectedSize) : '—';
                    step4Html = `
                        <div class="craftools-field">
                            <span class="craftools-label">4. Quantidade de Cartões</span>
                            <div style="display: flex; gap: 6px; margin-bottom: 10px;">
                                <button class="craftools-pill qty-mode-btn ${cardQuantityMode === 'auto' ? 'active' : ''}" data-qmode="auto" style="flex:1; text-align:center;">
                                    <span class="material-symbols-outlined" style="font-size:13px; vertical-align:middle;">auto_awesome</span> Auto (${autoQty})
                                </button>
                                <button class="craftools-pill qty-mode-btn ${cardQuantityMode === 'manual' ? 'active' : ''}" data-qmode="manual" style="flex:1; text-align:center;">
                                    <span class="material-symbols-outlined" style="font-size:13px; vertical-align:middle;">edit</span> Manual
                                </button>
                            </div>
                            ${cardQuantityMode === 'manual' ? `
                                <input type="number" id="card-qty-input" class="craftools-input" 
                                    min="1" max="999" value="${cardManualQty}" 
                                    style="width: 100%; text-align: center; font-size: 20px; font-weight: 700; padding: 10px;">
                            ` : ''}
                        </div>
                        <div class="craftools-field">
                            <span class="craftools-label">5. Imagem do Cartão</span>
                            <input type="file" id="card-file-input" accept="image/*" style="display: none;">
                            <button class="craftools-topbtn" id="card-select-btn" style="width: 100%; justify-content: center;">
                                <span class="material-symbols-outlined">photo_camera</span>
                                ${cardPhoto ? '1 imagem selecionada ✓' : 'Selecionar Imagem'}
                            </button>
                        </div>`;
                }
            }

            // Detect existing grid configuration on page
            const existingGrid = pageEl.querySelector('.craftools-grid-container');


            // Generate button — validation per mode
            const canGenerate = selectedTemplate &&
                (selectedMode === 'album' ? photos.length > 0 : cardPhoto !== null);

            panelBody.innerHTML = `
                <div style="padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('albumTool.step1')}</span>
                        <div style="display: flex; flex-wrap: wrap; gap: 4px;">${sizeHtml}</div>
                    </div>

                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('albumTool.step2')}</span>
                        <div style="display: flex; flex-direction: column; gap: 0;">${templateHtml}</div>
                    </div>

                    ${selectedTemplate ? `
                    <div class="craftools-field">
                        <span class="craftools-label">3. Modo</span>
                        <div style="display: flex; gap: 6px;">
                            <button class="craftools-pill mode-btn ${selectedMode === 'album' ? 'active' : ''}" data-mode="album" 
                                style="flex:1; text-align:center; padding: 10px 6px; flex-direction:column; display:flex; align-items:center; gap:4px; height:auto;">
                                <span class="material-symbols-outlined" style="font-size:22px;">photo_library</span>
                                <span style="font-size:10px;">Álbum de fotos</span>
                            </button>
                            <button class="craftools-pill mode-btn ${selectedMode === 'card' ? 'active' : ''}" data-mode="card"
                                style="flex:1; text-align:center; padding: 10px 6px; flex-direction:column; display:flex; align-items:center; gap:4px; height:auto;">
                                <span class="material-symbols-outlined" style="font-size:22px;">contact_page</span>
                                <span style="font-size:10px;">Cartão de visita</span>
                            </button>
                        </div>
                    </div>` : ''}

                    ${step4Html}

                    <button class="craftools-topbtn" id="album-generate-btn"
                        style="width: 100%; justify-content: center; background: var(--accent); color: white; border: none; margin-top: 4px;"
                        ${!canGenerate ? 'disabled' : ''}>
                        <span class="material-symbols-outlined">dynamic_feed</span> ${existingGrid ? 'Gerar Novamente' : 'Gerar Álbum'}
                    </button>
                </div>
            `;

            // ── Bind: Step 1 — Size ────────────────────────────────────────
            panelBody.querySelectorAll('.size-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedSize = availableSizes[btn.getAttribute('data-idx')];
                    selectedTemplate = null;
                    if (selectedSize) {
                        const parts = selectedSize.size.split(',');
                        pageEl.style.width = parts[0] + selectedSize.sizeUnit;
                        pageEl.style.minHeight = parts[1] + selectedSize.sizeUnit;
                        window.craftoolsSize = selectedSize;
                    }
                    renderPanel();
                });
            });

            // ── Bind: Step 2 — Template ────────────────────────────────────
            panelBody.querySelectorAll('.template-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedTemplate = matchingTemplates[btn.getAttribute('data-idx')];
                    renderPanel();
                });
            });

            // ── Bind: Step 3 — Mode ────────────────────────────────────────
            panelBody.querySelectorAll('.mode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedMode = btn.dataset.mode;
                    photos = [];
                    cardPhoto = null;
                    renderPanel();
                });
            });

            // ── Bind: Album — file input ───────────────────────────────────
            const albumFileInput = panelBody.querySelector('#album-file-input');
            const albumSelectBtn = panelBody.querySelector('#album-select-btn');
            if (albumFileInput && albumSelectBtn) {
                albumSelectBtn.addEventListener('click', () => albumFileInput.click());
                albumFileInput.addEventListener('change', (e) => {
                    photos = Array.from(e.target.files);
                    renderPanel();
                });
            }

            // ── Bind: Card — quantity mode ─────────────────────────────────
            panelBody.querySelectorAll('.qty-mode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    cardQuantityMode = btn.dataset.qmode;
                    renderPanel();
                });
            });
            const cardQtyInput = panelBody.querySelector('#card-qty-input');
            if (cardQtyInput) {
                cardQtyInput.addEventListener('input', (e) => {
                    cardManualQty = Math.max(1, parseInt(e.target.value) || 1);
                });
            }

            // ── Bind: Card — image file input ──────────────────────────────
            const cardFileInput = panelBody.querySelector('#card-file-input');
            const cardSelectBtn = panelBody.querySelector('#card-select-btn');
            if (cardFileInput && cardSelectBtn) {
                cardSelectBtn.addEventListener('click', () => cardFileInput.click());
                cardFileInput.addEventListener('change', (e) => {
                    cardPhoto = e.target.files[0] || null;
                    renderPanel();
                });
            }

            // ── Bind: Generate ─────────────────────────────────────────────
            const generateBtn = panelBody.querySelector('#album-generate-btn');
            if (generateBtn) {
                generateBtn.addEventListener('click', () => {
                    if (selectedMode === 'album') {
                        this.processAlbum(editor, pageEl, selectedSize, selectedTemplate, photos);
                    } else {
                        const qty = cardQuantityMode === 'auto'
                            ? calcPerPage(selectedTemplate, selectedSize)
                            : cardManualQty;
                        this.processBusinessCard(editor, pageEl, selectedSize, selectedTemplate, cardPhoto, qty);
                    }
                    rightPanel.classList.add('hidden');
                });
            }

            // ── Bind: Borders ──────────────────────────────────────────────
            if (existingGrid) {
                // Mock an element structure for CommonProperties
                const mockElement = {
                    contentArea: pageEl,
                    style: existingGrid.style,
                    dispatchEvent: () => {}
                };

                CommonProperties.renderBorder(panelBody.firstElementChild, mockElement, '.craftools-grid-cell', () => {
                     const bWidth = panelBody.querySelector('#prop-border-width').value;
                     const bStyle = panelBody.querySelector('#prop-border-style').value;
                     const bColor = panelBody.querySelector('#prop-border-color').value;
                     Craftools_LayoutGrid.updateBorders(editor, bWidth, bStyle, bColor);
                });
            }
        };

        renderPanel();
        rightPanel.classList.remove('hidden');
    }

    // ── Helpers: build a locked ImageTool element for a grid cell ────────────
    static _buildCellElement(editor, src, pl, pt, cw, ch, unit = 'px') {
        const imgEl = ImageTool.createElement('imagem', editor);
        imgEl.setAttribute('x', pl + unit);
        imgEl.setAttribute('y', pt + unit);
        imgEl.setAttribute('w', cw + unit);
        imgEl.setAttribute('h', ch + unit);
        imgEl.setAttribute('data-locked', 'true');

        imgEl._craftoolsMeta.src = src;
        const imgTag = imgEl.querySelector('img');
        if (imgTag) imgTag.src = src;

        return imgEl;
    }

    static _cellDimensions(template, pageSize) {
        const p = template.cellPadding.split(" ");
        return {
            pt: parseFloat(p[0]),
            pr: parseFloat(p[1]),
            pb: parseFloat(p[2]),
            pl: parseFloat(p[3]),
            cw: template.cellWidth  - parseFloat(p[3]) - parseFloat(p[1]),
            ch: template.cellHeight - parseFloat(p[0]) - parseFloat(p[2]),
        };
    }

    // ── Mode 1: Álbum de fotos ────────────────────────────────────────────────
    static async processAlbum(editor, startPage, pageSize, template, files) {
        const images = await Promise.all(files.map(f => new Promise(resolve => {
            const fr = new FileReader();
            fr.onload = e => resolve(e.target.result);
            fr.readAsDataURL(f);
        })));

        const gridSystem = new Craftools_LayoutGrid(editor, startPage, pageSize, template);
        const { pt, pr, pb, pl, cw, ch } = this._cellDimensions(template, pageSize);
        const unit = pageSize.sizeUnit || 'px';

        await gridSystem.render(images, (cellContainer, src) => {
            cellContainer.style.background = "#fff";
            cellContainer.style.borderWidth = "1px";
            cellContainer.style.borderStyle = "dashed";
            cellContainer.style.borderColor = "#cccccc";
            cellContainer.appendChild(this._buildCellElement(editor, src, pl, pt, cw, ch, unit));
        });
    }

    // ── Mode 2: Cartão de visita ──────────────────────────────────────────────
    static async processBusinessCard(editor, startPage, pageSize, template, file, quantity) {
        const src = await new Promise(resolve => {
            const fr = new FileReader();
            fr.onload = e => resolve(e.target.result);
            fr.readAsDataURL(file);
        });

        // Único objeto meta compartilhado entre todos os cartões
        const sharedMeta = ImageTool.getDefaultMeta();
        sharedMeta.src = src;

        const allElements = [];
        const items = Array(quantity).fill(src);

        const gridSystem = new Craftools_LayoutGrid(editor, startPage, pageSize, template);
        const { pt, pl, cw, ch } = this._cellDimensions(template, pageSize);
        const unit = pageSize.sizeUnit || 'px';

        await gridSystem.render(items, (cellContainer) => {
            cellContainer.style.background = "#fff";
            cellContainer.style.borderWidth = "1px";
            cellContainer.style.borderStyle = "dashed";
            cellContainer.style.borderColor = "#cccccc";

            const imgEl = ImageTool.createElement('imagem', editor);
            imgEl.setAttribute('x', pl + unit);
            imgEl.setAttribute('y', pt + unit);
            imgEl.setAttribute('w', cw + unit);
            imgEl.setAttribute('h', ch + unit);
            imgEl.setAttribute('data-locked', 'true');

            // Compartilha o mesmo meta — zoom/pan/filtros ficam sincronizados
            imgEl._craftoolsMeta = sharedMeta;

            const imgTag = imgEl.querySelector('img');
            if (imgTag) imgTag.src = src;

            allElements.push(imgEl);
            cellContainer.appendChild(imgEl);
        });

        // Liga todos os elementos entre si — o ImageTool.renderPropertiesPanel
        // lê _linkedElements no syncSliders e propaga automaticamente
        allElements.forEach(el => { el._linkedElements = allElements; });
    }
}
