// Grid utility - decoupled from specific tools
export class Craftools_LayoutGrid {
    constructor(editor, startPage, pageSize, template) {
        this.editor = editor;
        this.startPage = startPage;
        this.pageSize = pageSize;
        this.template = template;
    }

    // ── Detect if template is a photostrip ──────────────────────────────
    get isPhotostrip() {
        return !!(this.template.cellLines || this.template.cellColumns);
    }

    get stripLines() {
        return this.template.cellLines || 1;
    }

    get stripCols() {
        return this.template.cellColumns || 1;
    }

    get itemsPerStripe() {
        return this.stripLines * this.stripCols;
    }

    // cellSpacing: gap in the same unit as other dimensions (mm / px)
    get cellSpacing() {
        return this.template.cellSpacing || 0;
    }

    async render(items, renderCellContentCallback) {
        // Carregar biblioteca externa para reordenação se necessário
        if (!window.Sortable) {
            await new Promise(resolve => {
                let s = document.createElement('script');
                s.src = "https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js";
                s.onload = resolve; 
                document.head.appendChild(s);
            });
        }

        const unit = this.pageSize.sizeUnit || 'px';

        const pageSizeParts = this.pageSize.size.split(',').map(Number);
        const docW = pageSizeParts[0];
        const docH = pageSizeParts[1];
        
        const margins = this.template.pageMargin.split(" ").map(v => parseFloat(v));
        const [mT, mR, mB, mL] = margins;
        
        const cellW = this.template.cellWidth;
        const cellH = this.template.cellHeight;
        const gap = this.template.cellGap || 0;

        const availableW = docW - mL - mR;
        const availableH = docH - mT - mB;
        
        const isPromo = this.template.type === 'promo_kit';
        let perPage = 0;
        let cols = 1, rows = 1, stripesPerPage = 1;

        if (isPromo) {
            perPage = this.template.cellSlots.reduce((sum, slot) => sum + slot.cellCount, 0);
        } else {
            const slotW = cellW + gap;
            const slotH = cellH + gap;
            cols = Math.floor((availableW + gap) / slotW) || 1;
            rows = Math.floor((availableH + gap) / slotH) || 1;
            stripesPerPage = cols * rows;
            perPage = this.isPhotostrip ? stripesPerPage * this.itemsPerStripe : stripesPerPage;
        }

        let currentPage = this.startPage;
        let pagesWrapper = this.editor.querySelector('#pages-wrapper');

        // Shared group name for cross-stripe drag in photostrip mode (per render call)
        const photostripGroup = `photostrip-group-${Date.now()}`;

        for (let i = 0; i < items.length; i += perPage) {
            // Criação de nova página se for a partir do segundo lote
            if (i > 0) {
                const { PageTool } = await import('../tools/page/PageTool.js');
                PageTool.addNewPage(this.editor);
                currentPage = pagesWrapper.querySelector('.craftools-page:last-child');
            }

            // Preparar folha fisicamente para a Grid
            currentPage.innerHTML = '';
            currentPage.style.width = docW + unit;
            currentPage.style.minHeight = docH + unit;
            currentPage.style.background = '#ffffff'; 
            currentPage.style.position = 'relative';

            // Container CSS Grid (outer — positions stripes on the page)
            let grid = document.createElement('div');
            grid.className = "craftools-grid-container";
            grid.dataset.borderWidth = '1';
            grid.dataset.borderStyle = 'dashed';
            grid.dataset.borderColor = '#cccccc';

            if (isPromo) {
                grid.style.cssText = `
                    position: absolute;
                    top: ${mT}${unit};
                    right: ${mR}${unit};
                    bottom: ${mB}${unit};
                    left: ${mL}${unit};
                    box-sizing: border-box;
                `;
                currentPage.appendChild(grid);
                this._renderPromoKit(grid, items, i, perPage, unit, availableW, availableH, renderCellContentCallback);
            } else {
                grid.style.cssText = `
                    position: absolute;
                    top: ${mT}${unit};
                    right: ${mR}${unit};
                    bottom: ${mB}${unit};
                    left: ${mL}${unit};
                    display: grid;
                    grid-template-columns: repeat(${cols}, ${cellW}${unit});
                    grid-auto-rows: ${cellH}${unit};
                    gap: ${gap}${unit};
                    align-content: start;
                    box-sizing: border-box;
                `;
                currentPage.appendChild(grid);

                if (this.isPhotostrip) {
                    this._renderPhotostripes(grid, items, i, perPage, stripesPerPage, unit, photostripGroup, renderCellContentCallback);
                } else {
                    this._renderNormalCells(grid, items, i, perPage, unit, renderCellContentCallback);

                    // Outer drag-and-drop for normal cells (whole-cell handle)
                    new Sortable(grid, { 
                        animation: 200,
                        handle: '.album-drag-handle',
                        ghostClass: "sortable-ghost",
                        onStart: (evt) => {
                            const h = evt.item.querySelector('.album-drag-handle');
                            if (h) h.style.cursor = 'grabbing';
                        },
                        onEnd: (evt) => {
                            const h = evt.item.querySelector('.album-drag-handle');
                            if (h) h.style.cursor = 'grab';
                        }
                    });
                }
            }
        }
    }

    // ── Standard (non-photostrip) rendering ─────────────────────────────
    _renderNormalCells(grid, items, startIdx, perPage, unit, renderCellContentCallback) {
        const cellW = this.template.cellWidth;
        const cellH = this.template.cellHeight;

        items.slice(startIdx, startIdx + perPage).forEach((itemData, indexOffset) => {
            const cellWrap = this._buildStripeContainer(cellW, cellH, unit, grid, startIdx + indexOffset);
            grid.appendChild(cellWrap);

            if (renderCellContentCallback) {
                const contentLayer = cellWrap.querySelector('.cell-content-layer');
                renderCellContentCallback(contentLayer, itemData, startIdx + indexOffset, this.template);
            }
        });
    }

    // ── Promo Kit rendering (Smart Bin Packing) ────────────────────────
    _renderPromoKit(grid, items, startIdx, perPage, unit, availableW, availableH, renderCellContentCallback) {
        const gap = this.template.cellGap || 0;
        let currentX = 0;
        let currentY = 0;
        let shelfH = 0;

        // 1. Generate blocks for each slot
        const blocks = this.template.cellSlots.map((slot) => {
            const Kmax = Math.floor((availableW + gap) / (slot.cellWidth + gap)) || 1;
            const cols = Math.min(slot.cellCount, Kmax);
            const rows = Math.ceil(slot.cellCount / cols);
            const blockW = cols * slot.cellWidth + (cols > 1 ? (cols - 1) * gap : 0);
            const blockH = rows * slot.cellHeight + (rows > 1 ? (rows - 1) * gap : 0);
            return { slot, cols, rows, blockW, blockH };
        });

        // 2. Shelf pack blocks onto page
        blocks.forEach(b => {
            if (currentX + b.blockW > availableW && currentX > 0) {
                // Wrap to next shelf
                currentX = 0;
                currentY += shelfH + gap;
                shelfH = 0;
            }
            b.x = currentX;
            b.y = currentY;
            currentX += b.blockW + gap;
            shelfH = Math.max(shelfH, b.blockH);
        });

        // 3. Render the blocks
        let localItemIdx = 0;
        const pageItems = items.slice(startIdx, startIdx + perPage);

        blocks.forEach(b => {
            let groupDiv = document.createElement('div');
            groupDiv.className = 'promo-group';
            groupDiv.style.cssText = `
                position: absolute;
                left: ${b.x}${unit};
                top: ${b.y}${unit};
                width: ${b.blockW}${unit};
                height: ${b.blockH}${unit};
                display: grid;
                grid-template-columns: repeat(${b.cols}, ${b.slot.cellWidth}${unit});
                grid-auto-rows: ${b.slot.cellHeight}${unit};
                gap: ${gap}${unit};
            `;
            grid.appendChild(groupDiv);

            for (let c = 0; c < b.slot.cellCount; c++) {
                const itemData = pageItems[localItemIdx];
                
                const cellWrap = this._buildStripeContainer(b.slot.cellWidth, b.slot.cellHeight, unit, groupDiv, startIdx + localItemIdx, b.slot);
                groupDiv.appendChild(cellWrap);

                if (itemData && renderCellContentCallback) {
                    const contentLayer = cellWrap.querySelector('.cell-content-layer');
                    renderCellContentCallback(contentLayer, itemData, startIdx + localItemIdx, b.slot);
                }
                localItemIdx++;
            }
            
            // Drag and drop within the group
            new Sortable(groupDiv, { 
                animation: 200,
                handle: '.album-drag-handle',
                ghostClass: "sortable-ghost",
                onStart: (evt) => {
                    const h = evt.item.querySelector('.album-drag-handle');
                    if (h) h.style.cursor = 'grabbing';
                },
                onEnd: (evt) => {
                    const h = evt.item.querySelector('.album-drag-handle');
                    if (h) h.style.cursor = 'grab';
                }
            });
        });
    }

    // ── Photostrip rendering ─────────────────────────────────────────────
    _renderPhotostripes(grid, items, startIdx, perPage, stripesPerPage, unit, photostripGroup, renderCellContentCallback) {
        const cellW = this.template.cellWidth;
        const cellH = this.template.cellHeight;
        const stripItems = items.slice(startIdx, startIdx + perPage);
        const spacing = this.cellSpacing;

        const paddings = this.template.cellPadding.split(" ").map(p => parseFloat(p));
        const pT = isNaN(paddings[0]) ? 0 : paddings[0];
        const pR = isNaN(paddings[1]) ? pT : paddings[1];
        const pB = isNaN(paddings[2]) ? pT : paddings[2];
        const pL = isNaN(paddings[3]) ? pR : paddings[3];

        for (let s = 0; s < stripesPerPage; s++) {
            const stripeItems = stripItems.slice(s * this.itemsPerStripe, (s + 1) * this.itemsPerStripe);
            if (stripeItems.length === 0) break;

            // The outer stripe container (border/bg/overlay apply here)
            const stripeEl = this._buildStripeContainer(cellW, cellH, unit, grid, startIdx + s * this.itemsPerStripe);
            grid.appendChild(stripeEl);

            // Inner grid of photo slots — uses cellSpacing as gap
            const innerGrid = document.createElement('div');
            innerGrid.className = 'photostrip-inner-grid';
            innerGrid.style.cssText = `
                position: absolute;
                inset: ${pT}${unit} ${pR}${unit} ${pB}${unit} ${pL}${unit};
                display: grid;
                grid-template-columns: repeat(${this.stripCols}, 1fr);
                grid-template-rows: repeat(${this.stripLines}, 1fr);
                gap: ${spacing}${unit};
                box-sizing: border-box;
            `;

            // Insert inner grid between content-layer (z:1) and overlay-layer (z:4)
            stripeEl.insertBefore(innerGrid, stripeEl.querySelector('.cell-overlay-layer'));

            // Create individual photo slots
            stripeItems.forEach((itemData, slotIdx) => {
                const slot = document.createElement('div');
                slot.className = 'photostrip-slot';
                slot.dataset.slotIdx = slotIdx;
                slot.style.cssText = `
                    position: relative;
                    overflow: hidden;
                    box-sizing: border-box;
                `;

                // Make the slot itself draggable (so dragging the photo or handle works)
                slot.draggable = true;

                // Each slot gets a small drag handle for visual indicator
                const slotHandle = document.createElement('div');
                slotHandle.className = 'slot-drag-handle';
                slotHandle.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px;color:var(--text-secondary);">drag_indicator</span>';
                slotHandle.style.cssText = `
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    z-index: 50;
                    background: var(--bg-input, rgba(255,255,255,0.85));
                    border: 1px solid var(--border, #e5e7eb);
                    border-radius: 3px;
                    padding: 1px 2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: grab;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.12);
                    opacity: 0.8;
                    transition: opacity 0.15s;
                `;
                slot.appendChild(slotHandle);

                // Make handle fully opaque on hover
                slotHandle.addEventListener('mouseenter', () => { slotHandle.style.opacity = '1'; });
                slotHandle.addEventListener('mouseleave', () => { slotHandle.style.opacity = '0.8'; });

                // Native Drag and Drop logic for content swapping on slot level
                slot.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    // We don't really need to set data, but Firefox requires it for D&D to work
                    e.dataTransfer.setData('text/plain', slotIdx);
                    Craftools_LayoutGrid.draggedSlot = slot;
                    setTimeout(() => slot.style.opacity = '0.5', 0);
                });

                slot.addEventListener('dragend', (e) => {
                    slot.style.opacity = '1';
                    Craftools_LayoutGrid.draggedSlot = null;
                });

                slot.addEventListener('dragover', (e) => {
                    e.preventDefault(); // Necessary to allow dropping
                    e.dataTransfer.dropEffect = 'move';
                    slot.style.boxShadow = 'inset 0 0 0 2px var(--accent)';
                });

                slot.addEventListener('dragleave', (e) => {
                    slot.style.boxShadow = '';
                });

                slot.addEventListener('drop', (e) => {
                    e.preventDefault();
                    slot.style.boxShadow = '';
                    
                    const draggedSlot = Craftools_LayoutGrid.draggedSlot;
                    if (draggedSlot && draggedSlot !== slot) {
                        // Swap the content elements (excluding the drag handle)
                        const draggedContent = Array.from(draggedSlot.children).find(c => !c.classList.contains('slot-drag-handle'));
                        const targetContent = Array.from(slot.children).find(c => !c.classList.contains('slot-drag-handle'));
                        
                        // Swap them by appending them to each other's parents
                        if (draggedContent && targetContent) {
                            draggedSlot.appendChild(targetContent);
                            slot.appendChild(draggedContent);
                        } else if (draggedContent) {
                            slot.appendChild(draggedContent);
                        } else if (targetContent) {
                            draggedSlot.appendChild(targetContent);
                        }
                    }
                });

                innerGrid.appendChild(slot);

                if (renderCellContentCallback) {
                    renderCellContentCallback(slot, itemData, startIdx + s * this.itemsPerStripe + slotIdx);
                }

                // Ensure the content inside slot doesn't interfere with dragging
                const imgEl = slot.querySelector('craftools-element');
                if (imgEl) {
                    imgEl.setAttribute('draggable', 'false');
                    const imgNode = imgEl.querySelector('img');
                    if (imgNode) {
                        imgNode.setAttribute('draggable', 'false');
                    }
                }
            });
        }
    }

    // ── Shared: build the outer stripe/cell container ─────────────────────
    _buildStripeContainer(cellW, cellH, unit, grid, globalIndex, activeSlot = null) {
        const slot = activeSlot || this.template;
        const paddings = slot.cellPadding.split(" ").map(p => parseFloat(p));
        const pT = isNaN(paddings[0]) ? 0 : paddings[0];
        const pR = isNaN(paddings[1]) ? pT : paddings[1];
        const pB = isNaN(paddings[2]) ? pT : paddings[2];
        const pL = isNaN(paddings[3]) ? pR : paddings[3];

        // Set default borders from grid configuration
        const defaultBWidth = grid.dataset.borderWidth || '1';
        const defaultBStyle = grid.dataset.borderStyle || 'dashed';
        const defaultBColor = grid.dataset.borderColor || '#cccccc';

        let cellWrap = document.createElement('div');
        cellWrap.className = "craftools-grid-cell";
        cellWrap.dataset.cellId = `cell-${Date.now()}-${globalIndex}`;
        if (this.isPhotostrip) {
            cellWrap.dataset.isPhotostrip = 'true';
        }
        cellWrap.style.cssText = `
            width: ${cellW}${unit};
            height: ${cellH}${unit};
            padding: 0;
            box-sizing: border-box;
            background: transparent;
            position: relative;
            overflow: hidden;
        `;

        cellWrap.style.borderWidth = `${defaultBWidth}px`;
        cellWrap.style.borderStyle = defaultBStyle;
        cellWrap.style.borderColor = defaultBColor;
        cellWrap.style.setProperty('--cell-border-width', `${defaultBWidth}px`);
        cellWrap.style.setProperty('--cell-border-style', defaultBStyle);
        cellWrap.style.setProperty('--cell-border-color', defaultBColor);

        // ── Camada de conteúdo (fundo: cor, gradiente, imagem da stripe) ──
        let contentLayer = document.createElement('div');
        contentLayer.className = "cell-content-layer";
        contentLayer.style.cssText = `
            position: absolute; inset: 0; z-index: 1;
            ${this.isPhotostrip ? '' : `padding: ${pT}${unit} ${pR}${unit} ${pB}${unit} ${pL}${unit};`}
            box-sizing: border-box;
        `;
        cellWrap.appendChild(contentLayer);

        // ── Camada de overlay (imagem sobre tudo) ─────────────────────────
        let overlayLayer = document.createElement('div');
        overlayLayer.className = "cell-overlay-layer";
        overlayLayer.style.cssText = `
            position: absolute;
            top: ${pT}${unit}; right: ${pR}${unit}; bottom: ${pB}${unit}; left: ${pL}${unit};
            z-index: 4;
            pointer-events: none;
            background-size: cover;
            background-position: center center;
            background-repeat: no-repeat;
            opacity: 1;
        `;
        cellWrap.appendChild(overlayLayer);

        // ── Alça de arrasto da stripe — apenas em modo normal ─────────────
        // Em photostrip o drag handle some: os slots individuais têm seus próprios handles.
        // Mantemos o handle da stripe oculto mas presente para compatibilidade de queries.
        let dragHandle = document.createElement('div');
        dragHandle.className = "album-drag-handle";
        dragHandle.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; color: var(--text-secondary);">drag_indicator</span>';
        dragHandle.style.cssText = `
            position: absolute;
            top: 4px;
            left: 4px;
            z-index: 50;
            background: var(--bg-input, #fff);
            border: 1px solid var(--border, #e5e7eb);
            border-radius: 4px;
            padding: 2px;
            display: ${this.isPhotostrip ? 'none' : 'flex'};
            align-items: center;
            justify-content: center;
            cursor: grab;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;
        
        cellWrap.appendChild(dragHandle);

        // ── Botão de edição da célula/stripe ─────────────────────────────
        let editBtn = document.createElement('div');
        editBtn.className = "cell-edit-btn";
        editBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">settings</span>';
        editBtn.style.cssText = `
            position: absolute;
            top: 4px;
            right: 4px;
            z-index: 55;
            background: var(--bg-input, #fff);
            border: 1px solid var(--border, #e5e7eb);
            border-radius: 4px;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            color: var(--text-secondary, #4b5563);
            transition: all 0.15s;
        `;
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            import('../tools/album/CellPanel.js').then(({ CellPanel }) => {
                CellPanel.open(this.editor, cellWrap);
            });
        });
        cellWrap.appendChild(editBtn);

        // Permite selecionar a tira inteira ao clicar no espaço vazio (padding/gap)
        cellWrap.addEventListener('click', (e) => {
            if (!e.target.closest('.photostrip-slot') && !e.target.closest('.album-drag-handle') && !e.target.closest('.cell-edit-btn')) {
                import('../tools/album/CellPanel.js').then(({ CellPanel }) => {
                    CellPanel.open(this.editor, cellWrap);
                });
            }
        });

        return cellWrap;
    }

    static updateBorders(editor, width, style, color) {
        if (!editor) return;
        
        // Update all cells in the editor (stripes included — border is on the .craftools-grid-cell)
        editor.querySelectorAll('.craftools-grid-cell').forEach(cell => {
            cell.style.borderWidth = `${width}px`;
            cell.style.borderStyle = style;
            cell.style.borderColor = color;
            cell.style.setProperty('--cell-border-width', `${width}px`);
            cell.style.setProperty('--cell-border-style', style);
            cell.style.setProperty('--cell-border-color', color);
        });
        
        // Store configuration in all grid containers for state persistence
        editor.querySelectorAll('.craftools-grid-container').forEach(grid => {
            grid.dataset.borderWidth = width;
            grid.dataset.borderStyle = style;
            grid.dataset.borderColor = color;
        });
    }
}
