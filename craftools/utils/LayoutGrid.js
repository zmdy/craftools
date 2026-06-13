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
        const gap = this.template.cellGap;

        const availableW = docW - mL - mR;
        const availableH = docH - mT - mB;
        
        const slotW = cellW + gap;
        const slotH = cellH + gap;
        
        const cols = Math.floor((availableW + gap) / slotW) || 1;
        const rows = Math.floor((availableH + gap) / slotH) || 1;

        // In photostrip mode, each "cell" in the outer grid is a stripe that holds
        // itemsPerStripe photos. Adjust perPage accordingly.
        const stripesPerPage = cols * rows;
        const perPage = this.isPhotostrip ? stripesPerPage * this.itemsPerStripe : stripesPerPage;

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

    // ── Standard (non-photostrip) rendering ─────────────────────────────
    _renderNormalCells(grid, items, startIdx, perPage, unit, renderCellContentCallback) {
        const cellW = this.template.cellWidth;
        const cellH = this.template.cellHeight;

        items.slice(startIdx, startIdx + perPage).forEach((itemData, indexOffset) => {
            const cellWrap = this._buildStripeContainer(cellW, cellH, unit, grid, startIdx + indexOffset);
            grid.appendChild(cellWrap);

            if (renderCellContentCallback) {
                const contentLayer = cellWrap.querySelector('.cell-content-layer');
                renderCellContentCallback(contentLayer, itemData, startIdx + indexOffset);
            }
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

        const allInnerGrids = []; // collect for cross-stripe SortableJS

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
            allInnerGrids.push(innerGrid);

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

                // Each slot gets a small drag handle for reordering
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
                    opacity: 0;
                    transition: opacity 0.15s;
                `;
                slot.appendChild(slotHandle);

                // Show handle on hover
                slot.addEventListener('mouseenter', () => { slotHandle.style.opacity = '1'; });
                slot.addEventListener('mouseleave', () => { slotHandle.style.opacity = '0'; });

                innerGrid.appendChild(slot);

                if (renderCellContentCallback) {
                    renderCellContentCallback(slot, itemData, startIdx + s * this.itemsPerStripe + slotIdx);
                }
            });
        }

        // Enable drag between ALL inner grids on this page (shared group)
        allInnerGrids.forEach(innerGrid => {
            new Sortable(innerGrid, {
                animation: 150,
                handle: '.slot-drag-handle',
                ghostClass: 'sortable-ghost',
                fallbackOnBody: true,
                swapThreshold: 0.65,
                // Shared group enables dragging slots between stripes
                group: photostripGroup,
                onStart: (evt) => {
                    const h = evt.item.querySelector('.slot-drag-handle');
                    if (h) { h.style.opacity = '1'; h.style.cursor = 'grabbing'; }
                },
                onEnd: (evt) => {
                    const h = evt.item.querySelector('.slot-drag-handle');
                    if (h) { h.style.opacity = '0'; h.style.cursor = 'grab'; }
                }
            });
        });
    }

    // ── Shared: build the outer stripe/cell container ─────────────────────
    _buildStripeContainer(cellW, cellH, unit, grid, globalIndex) {
        const paddings = this.template.cellPadding.split(" ").map(p => parseFloat(p));
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
