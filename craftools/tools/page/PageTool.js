import { I18n } from "../../settings/Translations.js";
import { CommonProperties } from "../../utils/CommonProperties.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { Notify } from "../../utils/Notify.js";
import "./PageTool_Translations.js";

export class PageTool {
    static attachPageEvents(editor, pageEl) {
        pageEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            pageEl.classList.add('drag-over');
            // Optional: apply some visual feedback on the page if we want
            // For now, we just allow the drop.
        });

        pageEl.addEventListener('dragleave', (e) => {
            pageEl.classList.remove('drag-over');
        });

        pageEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            pageEl.classList.remove('drag-over');

            const toolType = e.dataTransfer.getData('ToolType');

            if (toolType === 'album') {
                const { AlbumTool } = await import('../album/AlbumTool.js');
                AlbumTool.setup(editor, pageEl);
            } else if (toolType === 'emoji') {
                const emoji = e.dataTransfer.getData('EmojiChar');
                if (!emoji) return;
                const { EmojiTool } = await import('../emoji/EmojiTool.js');
                const rect = pageEl.getBoundingClientRect();
                const scale = window.craftoolsZoomLevel || 1;
                const el = EmojiTool.createElement(emoji);
                const dropX = Math.max(10, Math.min((e.clientX - rect.left) / scale - 40, (rect.width / scale) - 90));
                const dropY = Math.max(10, Math.min((e.clientY - rect.top)  / scale - 40, (rect.height / scale) - 90));
                el.setAttribute('x', Math.round(dropX));
                el.setAttribute('y', Math.round(dropY));
                pageEl.appendChild(el);
                const placeholder = pageEl.querySelector('div[style*="font-size: 14px"]');
                if (placeholder) placeholder.remove();
            } else if (toolType === 'shape') {
                const shapeType = e.dataTransfer.getData('ShapeType');
                if (!shapeType) return;
                const { ShapeTool } = await import('../shape/ShapeTool.js');
                const rect = pageEl.getBoundingClientRect();
                const scale = window.craftoolsZoomLevel || 1;
                const el = ShapeTool.createElement(shapeType, editor);
                const dropX = Math.max(10, Math.min((e.clientX - rect.left) / scale - 60, (rect.width / scale) - 120));
                const dropY = Math.max(10, Math.min((e.clientY - rect.top)  / scale - 60, (rect.height / scale) - 120));
                el.setAttribute('x', Math.round(dropX));
                el.setAttribute('y', Math.round(dropY));
                pageEl.appendChild(el);
                const placeholder = pageEl.querySelector('div[style*="font-size: 14px"]');
                if (placeholder) placeholder.remove();
            } else if (toolType === 'titulo' || toolType === 'paragrafo' || toolType === 'imagem' || toolType === 'qrcode' || toolType === 'barcode') {
                const rect = pageEl.getBoundingClientRect();
                let scale = window.craftoolsZoomLevel || 1;
                
                let dropX, dropY;
                let targetContainer = pageEl;
                
                const cellTarget = e.target.closest('.craftools-grid-cell');
                const pRect = pageEl.getBoundingClientRect();

                let elW = toolType === 'imagem' ? 200 : (toolType === 'qrcode' ? 180 : (toolType === 'barcode' ? 220 : 120));
                let elH = toolType === 'imagem' ? 150 : (toolType === 'qrcode' ? 180 : (toolType === 'barcode' ? 100 : 40));

                if (cellTarget && window.craftoolsAutoSnap !== false) {
                    const cRect = cellTarget.getBoundingClientRect();
                    const align = window.craftoolsAutoSnapAlign || 'bottom-center';
                    const offset = 5;
                    const cLeft = (cRect.left - pRect.left) / scale;
                    const cTop = (cRect.top - pRect.top) / scale;
                    const cWidth = cRect.width / scale;
                    const cHeight = cRect.height / scale;

                    if (align.includes('left')) dropX = cLeft + offset;
                    else if (align.includes('right')) dropX = cLeft + cWidth - elW - offset;
                    else dropX = cLeft + (cWidth / 2) - (elW / 2);

                    if (align.includes('top')) dropY = cTop + offset;
                    else if (align.includes('bottom')) dropY = cTop + cHeight - elH - offset;
                    else dropY = cTop + (cHeight / 2) - (elH / 2);
                } else {
                    dropX = (e.clientX - pRect.left) / scale;
                    dropY = (e.clientY - pRect.top) / scale;
                    if (toolType === 'imagem') {
                        dropX = Math.max(10, Math.min(dropX - 100, (pRect.width / scale) - 200));
                        dropY = Math.max(10, Math.min(dropY - 75, (pRect.height / scale) - 150));
                    } else if (toolType === 'qrcode') {
                        dropX = Math.max(10, Math.min(dropX - 90, (pRect.width / scale) - 180));
                        dropY = Math.max(10, Math.min(dropY - 90, (pRect.height / scale) - 180));
                    } else if (toolType === 'barcode') {
                        dropX = Math.max(10, Math.min(dropX - 110, (pRect.width / scale) - 220));
                        dropY = Math.max(10, Math.min(dropY - 50, (pRect.height / scale) - 100));
                    } else {
                        dropX = Math.max(10, Math.min(dropX - 60, (pRect.width / scale) - 120));
                        dropY = Math.max(10, Math.min(dropY - 20, (pRect.height / scale) - 40));
                    }
                }

                let el;
                if (toolType === 'imagem') {
                    const { ImageTool } = await import('../image/ImageTool.js');
                    el = ImageTool.createElement(toolType, editor);
                } else if (toolType === 'qrcode') {
                    const { QRCodeTool } = await import('../qrcode/QRCodeTool.js');
                    el = QRCodeTool.createElement(toolType, editor);
                } else if (toolType === 'barcode') {
                    const { BarcodeTool } = await import('../barcode/BarcodeTool.js');
                    el = BarcodeTool.createElement(toolType, editor);
                } else if (toolType === 'papeis') {
                    const { PaperTool } = await import('../paper/PaperTool.js');
                    el = PaperTool.createElement(toolType, editor);
                    // O papel cobre a página inteira, então alinhamos em 0, 0
                    dropX = 0;
                    dropY = 0;
                } else {
                    const { TextTool } = await import('../text/TextTool.js');
                    el = TextTool.createElement(toolType, editor);
                }
                
                const unit = el.getAttribute('w') ? el.getAttribute('w').replace(/[0-9.-]/g, '') : 'px';
                el.setAttribute('x', dropX + (toolType === 'papeis' ? unit : ''));
                el.setAttribute('y', dropY + (toolType === 'papeis' ? unit : ''));

                if (!el.parentNode) {
                    targetContainer.appendChild(el);
                } else if (el.parentNode !== targetContainer) {
                    el.parentNode.removeChild(el);
                    targetContainer.appendChild(el);
                }
                
                // --- Business Card Cloning Logic ---
                if (cellTarget) {
                    const grid = cellTarget.closest('.craftools-grid-container');
                    if (grid && grid.dataset.gridMode === 'card') {
                        const allCells = Array.from(grid.querySelectorAll('.craftools-grid-cell'));
                        const myIndex = allCells.indexOf(cellTarget);
                        
                        const cRect = cellTarget.getBoundingClientRect();
                        const cX = (cRect.left - pRect.left) / scale;
                        const cY = (cRect.top - pRect.top) / scale;
                        
                        // Relative coordinates inside the original cell
                        const relX = dropX - cX;
                        const relY = dropY - cY;
                        
                        // Link clones for future potential syncing
                        const linkedId = 'link-' + Date.now();
                        el.dataset.linkedId = linkedId;
                        
                        allCells.forEach((cell, idx) => {
                            if (idx === myIndex) return; // Skip original
                            const cellRect = cell.getBoundingClientRect();
                            const ciX = (cellRect.left - pRect.left) / scale;
                            const ciY = (cellRect.top - pRect.top) / scale;
                            
                            const clone = el.cloneNode(true);
                            clone.setAttribute('x', ciX + relX);
                            clone.setAttribute('y', ciY + relY);
                            clone.dataset.linkedId = linkedId;
                            targetContainer.appendChild(clone);
                        });
                    }
                }

                // Remove placeholder text
                const placeholder = pageEl.querySelector('div[style*="font-size: 14px"]');
                if (placeholder) placeholder.remove();
            }
        });

        pageEl.addEventListener('click', async (e) => {
            // Prevent deselecting element if clicking on an element handle
            if (e.target.closest('craftools-element')) return;

            const isPageClick = e.target === pageEl || e.target.closest('.craftools-grid-container') || e.target.id === 'canvas-area';

            if (isPageClick) {
                editor.querySelectorAll('.craftools-tool-btn').forEach(b => b.classList.remove('active'));
                
                // Check if page has an album
                if (pageEl.querySelector('.craftools-grid-container')) {
                    const { AlbumTool } = await import('../album/AlbumTool.js');
                    AlbumTool.setup(editor, pageEl);
                    return;
                }
                
                // Check if page has a paper element
                const paperEl = pageEl.querySelector('craftools-element[data-craftool="papeis"]');
                if (paperEl) {
                    if (typeof paperEl.select === 'function') {
                        paperEl.select();
                        return;
                    }
                }
                
                const rightPanel = document.getElementById('right-panel');
                const panelTitle = document.getElementById('panel-title');
                const panelBody = document.getElementById('panel-body');
                const defaultMenu = document.getElementById('panel-default-menu');
                const closePanel = document.getElementById('close-panel');
                const panelLogo = document.getElementById('panel-logo');
                
                if (panelTitle) panelTitle.textContent = I18n.t('pageTool.title');
                editor.activePage = pageEl;
                
                // Parse current dimensions
                const currentWidthRaw = pageEl.style.width || '800px';
                const currentHeightRaw = pageEl.style.minHeight || '600px';
                const currentUnitMatch = currentWidthRaw.match(/[a-z%]+$/i);
                const currentUnit = currentUnitMatch ? currentUnitMatch[0] : 'px';
                const currentW = parseFloat(currentWidthRaw);
                const currentH = parseFloat(currentHeightRaw);

                // Determine active media sizes from global state
                const presetsHtml = (window.craftoolsApp && window.craftoolsApp.activeMedia && window.craftoolsApp.activeMedia.sizes) 
                    ? window.craftoolsApp.activeMedia.sizes.map((s, i) => `<button class="craftools-pill preset-btn" data-index="${i}">${s.name}</button>`).join('')
                    : `<span style="font-size:11px;color:var(--text-muted)">${I18n.t('pageTool.noPresets')}</span>`;

                const currentColor = CommonProperties._rgbToHex(pageEl.style.backgroundColor || '#ffffff');

                if (panelBody) {
                    const htmlTamanho = `
                        <div class="ct-field">
                            <span class="craftools-label">${I18n.t('pageTool.presets')}</span>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="presets-container">
                                ${presetsHtml}
                            </div>
                        </div>
                        <div class="ct-field">
                            <span class="craftools-label">${I18n.t('pageTool.dimensions')}</span>
                            <div style="display: flex; gap: 4px; margin-bottom: 6px;" id="unit-group">
                                ${['px', 'mm', 'cm', 'in', '%'].map(u => `<button class="craftools-pill unit-btn ${u === currentUnit ? 'active' : ''}" data-unit="${u}">${u}</button>`).join('')}
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="number" class="craftools-input" id="dim-w" style="width: 70px;" value="${currentW}">
                                <span style="color: var(--text-muted); font-size: 13px;">×</span>
                                <input type="number" class="craftools-input" id="dim-h" style="width: 70px;" value="${currentH}">
                                <span style="color: var(--text-muted); font-size: 11px;" id="dim-unit-label">${currentUnit}</span>
                            </div>
                        </div>
                    `;

                    const htmlFundo = `
                        <div class="ct-field">
                            <span class="craftools-label">${I18n.t('pageTool.background')}</span>
                            <div style="display: flex; gap: 4px; margin-bottom: 10px;" id="bg-type-group">
                                <button class="craftools-pill bg-type-btn active" data-type="color">${I18n.t('pageTool.color')}</button>
                                <button class="craftools-pill bg-type-btn" data-type="gradient">${I18n.t('pageTool.gradient')}</button>
                                <button class="craftools-pill bg-type-btn" data-type="image">${I18n.t('editor.image')}</button>
                            </div>
                            
                            <div id="bg-color-section">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="color" class="craftools-color-swatch" id="page-bg-color" value="${currentColor}">
                                    <span style="font-size: 12px; color: var(--text-secondary)">${I18n.t('pageTool.color')}</span>
                                </div>
                            </div>
                            
                            <div id="bg-gradient-section" style="display: none;">
                                <input type="text" class="craftools-input" id="page-bg-grad-input" placeholder="linear-gradient(...)">
                                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;" id="grad-presets"></div>
                            </div>

                            <div id="bg-image-section" style="display: none;">
                                <input type="url" class="craftools-input" id="page-bg-img-url" placeholder="${I18n.t('pageTool.imageUrl')}">
                                <input type="file" id="page-bg-img-file" accept="image/*" style="margin-top: 8px; font-size: 11px; width: 100%;">
                            </div>
                        </div>
                    `;

                    const htmlAcoes = `
                        <div class="ct-danger-section">
                            <button class="craftools-danger-btn" id="delete-page-btn" style="width:100%; justify-content:center; gap:6px;">
                                <span class="material-symbols-outlined" style="font-size:16px;">delete</span> ${I18n.t('pageTool.deletePage')}
                            </button>
                        </div>
                    `;

                    panelBody.innerHTML = 
                        PanelUI.accordion('page-tamanho', 'straighten', I18n.t('common.sectionTamanho') || 'Tamanho', htmlTamanho, { open: true }) +
                        PanelUI.accordion('page-fundo', 'palette', I18n.t('pageTool.background') || 'Fundo', htmlFundo) +
                        PanelUI.accordion('page-acoes', 'warning', I18n.t('pageTool.actions') || 'Ações', htmlAcoes);
                        
                    PanelUI.bindAccordions(panelBody);
                }

                let activeUnit = currentUnit;

                // Bind Presets
                panelBody.querySelectorAll('.preset-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const s = window.craftoolsApp.activeMedia.sizes[btn.getAttribute('data-index')];
                        if (s.size !== "*") {
                            const parts = s.size.split(',');
                            document.getElementById('dim-w').value = parts[0];
                            document.getElementById('dim-h').value = parts[1];
                            activeUnit = s.sizeUnit;
                            document.getElementById('dim-unit-label').innerText = activeUnit;
                            panelBody.querySelectorAll('.unit-btn').forEach(b => {
                                b.classList.toggle('active', b.getAttribute('data-unit') === activeUnit);
                            });
                            editor.activePage.style.width = parts[0] + activeUnit;
                            editor.activePage.style.minHeight = parts[1] + activeUnit;
                        }
                    });
                });

                // Bind Dimensions
                const applyDims = () => {
                    const w = document.getElementById('dim-w').value;
                    const h = document.getElementById('dim-h').value;
                    editor.activePage.style.width = w + activeUnit;
                    editor.activePage.style.minHeight = h + activeUnit;
                };

                document.getElementById('dim-w').addEventListener('input', applyDims);
                document.getElementById('dim-h').addEventListener('input', applyDims);

                panelBody.querySelectorAll('.unit-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        panelBody.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        activeUnit = btn.getAttribute('data-unit');
                        document.getElementById('dim-unit-label').innerText = activeUnit;
                        applyDims();
                    });
                });

                // Bind Backgrounds
                const bgTypeBtns = panelBody.querySelectorAll('.bg-type-btn');
                const sections = {
                    color: document.getElementById('bg-color-section'),
                    gradient: document.getElementById('bg-gradient-section'),
                    image: document.getElementById('bg-image-section')
                };

                bgTypeBtns.forEach(btn => {
                    btn.addEventListener('click', () => {
                        bgTypeBtns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        const type = btn.getAttribute('data-type');
                        Object.keys(sections).forEach(k => sections[k].style.display = 'none');
                        sections[type].style.display = 'block';
                    });
                });

                // Color Background
                document.getElementById('page-bg-color').addEventListener('input', (e) => {
                    editor.activePage.style.background = e.target.value;
                });

                // Gradient Background
                const gradInput = document.getElementById('page-bg-grad-input');
                gradInput.addEventListener('input', (e) => {
                    editor.activePage.style.background = e.target.value;
                });
                
                const gradPresetsContainer = document.getElementById('grad-presets');
                const gradList = ['linear-gradient(135deg,#f5f7fa,#c3cfe2)', 'linear-gradient(135deg,#fddb92,#d1fdff)', 'linear-gradient(135deg,#a18cd1,#fbc2eb)', 'linear-gradient(120deg,#f093fb,#f5576c)', 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', 'radial-gradient(circle at top,#ffecd2,#fcb69f)', 'linear-gradient(135deg,#11998e,#38ef7d)'];
                gradList.forEach(grad => {
                    const gradBtn = document.createElement('button');
                    gradBtn.style.cssText = `width:26px;height:26px;border-radius:5px;background:${grad};border:1px solid var(--border);cursor:pointer;`;
                    gradBtn.addEventListener('click', () => {
                        gradInput.value = grad;
                        editor.activePage.style.background = grad;
                    });
                    gradPresetsContainer.appendChild(gradBtn);
                });

                // Image Background
                const imgUrlInput = document.getElementById('page-bg-img-url');
                imgUrlInput.addEventListener('input', (e) => {
                    editor.activePage.style.background = `url(${e.target.value}) center/cover no-repeat`;
                });

                const imgFileInput = document.getElementById('page-bg-img-file');
                imgFileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            imgUrlInput.value = ev.target.result;
                            editor.activePage.style.background = `url(${ev.target.result}) center/cover no-repeat`;
                        };
                        reader.readAsDataURL(file);
                    }
                });

                // Delete Page
                if (panelBody) {
                    panelBody.querySelector('#delete-page-btn').addEventListener('click', async () => {
                        if (await Notify.confirm(I18n.t('pageTool.confirmDelete'), { danger: true, confirmLabel: I18n.t('pageTool.deletePage') })) {
                            const pagesWrapper = editor.querySelector('#pages-wrapper');
                            if (pagesWrapper.querySelectorAll('.craftools-page').length > 1) {
                                editor.activePage.remove();

                                if(defaultMenu) defaultMenu.classList.remove('d-none');
                                if(panelBody) panelBody.classList.add('d-none');
                                if(closePanel) closePanel.classList.add('d-none');
                                if(panelLogo) panelLogo.classList.remove('d-none');
                                if(panelTitle) panelTitle.textContent = I18n.t('editor.panelSubtitle');

                                editor.activePage = null;
                            } else {
                                Notify.toast(I18n.t('pageTool.alertLastPage'), 'error');
                            }
                        }
                    });
                }

                if(defaultMenu) defaultMenu.classList.add('d-none');
                if(panelBody) panelBody.classList.remove('d-none');
                if(closePanel) closePanel.classList.remove('d-none');
                if(panelLogo) panelLogo.classList.add('d-none');
                if(rightPanel) rightPanel.classList.add('mobile-open');
            }
        });
    }

    static addNewPage(editor) {
        const pagesWrapper = editor.querySelector('#pages-wrapper');
        const lastPage = pagesWrapper.querySelector('.craftools-page:last-child');
        
        // Clona a última página para manter a dimensão local
        const clone = lastPage.cloneNode(true);
        clone.id = 'page-' + Date.now();
        
        // Remove os componentes filhos da página inteiramente mas mantém a sua forma
        clone.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 14px;">${I18n.t('pageTool.newPageLabel')}</div>`;
        
        // Acoplar os eventos para poder clicar na nova página localmente
        this.attachPageEvents(editor, clone);
        pagesWrapper.appendChild(clone);
        
        // Notify history system
        document.dispatchEvent(new CustomEvent('craftools-page-add', { bubbles: true }));
        
        // Scrollar automaticamente para a página nova de forma suave
        pagesWrapper.parentElement.scrollTo({ top: pagesWrapper.parentElement.scrollHeight, behavior: 'smooth' });
    }
}
