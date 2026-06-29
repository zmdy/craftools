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

    // ── Detect if an arbitrary slot definition (e.g. a promo_kit cellSlots[i]
    // entry) is itself a photostrip — lets promo kits mix plain-cell slots
    // with photostrip slots of different sizes. ───────────────────────────
    _isStripeSlot(slot) {
        return !!(slot && (slot.cellLines || slot.cellColumns));
    }

    _itemsPerUnit(slot) {
        return this._isStripeSlot(slot) ? (slot.cellLines || 1) * (slot.cellColumns || 1) : 1;
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
            // Slots that are themselves photostrips consume cellLines*cellColumns
            // items per instance instead of just 1 (promo kits = mix of plain-cell
            // slots and photostrip slots of varying sizes).
            perPage = this.template.cellSlots.reduce((sum, slot) => sum + slot.cellCount * this._itemsPerUnit(slot), 0);
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

        // Shared group name for cross-stripe drag in photostrip mode (per render call,
        // spans every page so photos can be dragged between stripes on different pages too).
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
    // A promo kit is a flexible collection of slots of varying sizes; any slot
    // can also be a photostrip (cellLines/cellColumns) — in that case each
    // "cell" of the slot is an entire stripe sub-grid rather than a single photo.
    //
    // Slots may also declare `slotLines` and `slotColumns` to pin the explicit
    // row×column layout of their block, bypassing the auto Kmax calculation.
    // In that case, the block always has exactly slotColumns columns and
    // slotLines rows regardless of available page width.
    _renderPromoKit(grid, items, startIdx, perPage, unit, availableW, availableH, renderCellContentCallback) {
        const gap = parseFloat(this.template.cellGap) || 0;
        let currentX = 0;
        let currentY = 0;
        let shelfH = 0;

        // 1. Generate blocks for each slot
        const blocks = this.template.cellSlots.map((slot) => {
            const slotGap = slot.cellGap !== undefined ? parseFloat(slot.cellGap) : gap;

            // If the slot explicitly defines slotColumns / slotLines, honour them;
            // otherwise fall back to the automatic Kmax bin-packing calculation.
            let cols, rows;
            if (slot.slotColumns && slot.slotLines) {
                cols = slot.slotColumns;
                rows = slot.slotLines;
            } else {
                const Kmax = Math.floor((availableW + slotGap) / (slot.cellWidth + slotGap)) || 1;
                cols = Math.min(slot.cellCount, Kmax);
                rows = Math.ceil(slot.cellCount / cols);
            }

            const blockW = cols * slot.cellWidth + (cols > 1 ? (cols - 1) * slotGap : 0);
            const blockH = rows * slot.cellHeight + (rows > 1 ? (rows - 1) * slotGap : 0);
            return { slot, cols, rows, blockW, blockH, slotGap };
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

        // Shared Sortable group for this page's promo kit — lets cells be dragged
        // across differently-shaped blocks (handled via the swap-and-resize logic
        // below), in addition to plain reordering within a same-shaped block.
        const promoGroupName = `promo-kit-group-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        let lastRelated = null;

        blocks.forEach((b, blockIdx) => {
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
                gap: ${b.slotGap}${unit};
            `;
            grid.appendChild(groupDiv);

            const isStripeSlot = this._isStripeSlot(b.slot);
            const itemsPerUnit = this._itemsPerUnit(b.slot);
            // Shared group for stripe instances belonging to this same slot definition,
            // so photos can be dragged between stripe instances within the block.
            const stripGroupName = `${promoGroupName}-strip-${b.slot.id || blockIdx}`;

            for (let c = 0; c < b.slot.cellCount; c++) {
                const cellWrap = this._buildStripeContainer(b.slot.cellWidth, b.slot.cellHeight, unit, groupDiv, startIdx + localItemIdx, b.slot);
                groupDiv.appendChild(cellWrap);

                if (isStripeSlot) {
                    // This "cell" is itself a photostrip — build its inner sub-grid.
                    const subItems = pageItems.slice(localItemIdx, localItemIdx + itemsPerUnit);
                    this._buildInnerStripGrid(cellWrap, b.slot, subItems, startIdx + localItemIdx, unit, stripGroupName, renderCellContentCallback);
                } else {
                    const itemData = pageItems[localItemIdx];
                    if (itemData && renderCellContentCallback) {
                        const contentLayer = cellWrap.querySelector('.cell-content-layer');
                        renderCellContentCallback(contentLayer, itemData, startIdx + localItemIdx, b.slot);
                    }

                    // Ensure elements inside don't interfere with dragging
                    const imgEl = cellWrap.querySelector('craftools-element');
                    if (imgEl) {
                        imgEl.setAttribute('draggable', 'false');
                        const imgNode = imgEl.querySelector('img');
                        if (imgNode) imgNode.setAttribute('draggable', 'false');
                    }
                }

                localItemIdx += itemsPerUnit;
            }

            // --- SortableJS-driven drag for whole cells within/across blocks ---
            // Same-shaped blocks: a plain reorder (Sortable's default move) is safe
            // since every sibling is identical in size.
            // Differently-shaped blocks: a plain move would break each block's fixed
            // cell count/shape, so on cross-block drop we revert Sortable's own move
            // and instead swap the two cells' CONTENT, resizing it to fit (this is the
            // same logic the previous native drag-and-drop implementation used).
            //
            // Stripe-shaped blocks are excluded entirely: their cells' position is
            // fixed, and what moves instead are the individual photo slots inside
            // them (handled by the inner Sortable in _buildInnerStripGrid, shared
            // via `stripGroupName` across every stripe instance of this block).
            if (!isStripeSlot) {
                new Sortable(groupDiv, {
                    group: promoGroupName,
                    handle: '.album-drag-handle',
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    onStart: (evt) => {
                        const h = evt.item.querySelector('.album-drag-handle');
                        if (h) h.style.cursor = 'grabbing';
                    },
                    onMove: (evt) => {
                        lastRelated = evt.related;
                        return true;
                    },
                    onEnd: (evt) => {
                        const h = evt.item.querySelector('.album-drag-handle');
                        if (h) h.style.cursor = 'grab';

                        if (evt.from === evt.to) return; // same-shape reorder — Sortable's own move is already correct

                        const itemEl = evt.item;
                        const displaced = lastRelated;

                        // Revert the container move (each block must keep its exact cell count/shape);
                        // only the CONTENT of the two cells gets swapped.
                        const refNode = evt.from.children[evt.oldIndex] || null;
                        evt.from.insertBefore(itemEl, refNode);

                        if (displaced && displaced !== itemEl && displaced.parentNode) {
                            this._swapCellContent(itemEl, displaced, unit);
                        }
                    }
                });
            }
        });
    }

    // ── Photostrip rendering ─────────────────────────────────────────────
    _renderPhotostripes(grid, items, startIdx, perPage, stripesPerPage, unit, photostripGroup, renderCellContentCallback) {
        const cellW = this.template.cellWidth;
        const cellH = this.template.cellHeight;
        const stripItems = items.slice(startIdx, startIdx + perPage);

        for (let s = 0; s < stripesPerPage; s++) {
            const stripeItems = stripItems.slice(s * this.itemsPerStripe, (s + 1) * this.itemsPerStripe);
            if (stripeItems.length === 0) break;

            // The outer stripe container (border/bg/overlay apply here)
            const stripeEl = this._buildStripeContainer(cellW, cellH, unit, grid, startIdx + s * this.itemsPerStripe);
            grid.appendChild(stripeEl);

            // Inner grid of photo slots (uses cellSpacing as gap) + per-slot Sortable drag.
            this._buildInnerStripGrid(stripeEl, this.template, stripeItems, startIdx + s * this.itemsPerStripe, unit, photostripGroup, renderCellContentCallback);
        }

        // Note: stripes themselves are intentionally NOT draggable as whole units —
        // their position on the page is fixed. What moves are the individual photo
        // slots inside them (within the same stripe or across other stripes sharing
        // `photostripGroup`), handled by the inner Sortable set up in
        // _buildInnerStripGrid. This avoids two competing drag handles fighting for
        // the same corner of the stripe.
    }

    // ── Shared: build the inner N×M photostrip slot grid inside a stripe/cell
    // container, wiring up Sortable-driven drag for the individual photo slots.
    // Used both by top-level photostrip mode and by promo_kit slots that are
    // themselves photostrips. `slotDef` carries cellLines/cellColumns/cellSpacing/
    // cellPadding for whichever shape applies (the top-level template, or an
    // individual promo_kit cellSlots[i] entry). ───────────────────────────────
    _buildInnerStripGrid(stripeEl, slotDef, subItems, baseGlobalIdx, unit, groupName, renderCellContentCallback) {
        const stripLines = slotDef.cellLines || 1;
        const stripCols = slotDef.cellColumns || 1;
        const spacing = slotDef.cellSpacing || 0;

        const paddings = String(slotDef.cellPadding || '0').split(" ").map(p => parseFloat(p));
        const pT = isNaN(paddings[0]) ? 0 : paddings[0];
        const pR = isNaN(paddings[1]) ? pT : paddings[1];
        const pB = isNaN(paddings[2]) ? pT : paddings[2];
        const pL = isNaN(paddings[3]) ? pR : paddings[3];

        const innerGrid = document.createElement('div');
        innerGrid.className = 'photostrip-inner-grid';
        innerGrid.style.cssText = `
            position: absolute;
            inset: ${pT}${unit} ${pR}${unit} ${pB}${unit} ${pL}${unit};
            z-index: 2;
            display: grid;
            grid-template-columns: repeat(${stripCols}, 1fr);
            grid-template-rows: repeat(${stripLines}, 1fr);
            gap: ${spacing}${unit};
            box-sizing: border-box;
        `;

        // Insert inner grid between content-layer (z:1) and overlay-layer (z:4)
        const overlayLayer = stripeEl.querySelector('.cell-overlay-layer');
        if (overlayLayer) stripeEl.insertBefore(innerGrid, overlayLayer);
        else stripeEl.appendChild(innerGrid);

        // Create individual photo slots
        subItems.forEach((itemData, slotIdx) => {
            const slot = document.createElement('div');
            slot.className = 'photostrip-slot';
            slot.dataset.slotIdx = slotIdx;
            slot.style.cssText = `
                position: relative;
                overflow: hidden;
                box-sizing: border-box;
            `;

            // Each slot gets a small drag handle for visual indicator
            const slotHandle = document.createElement('div');
            slotHandle.className = 'slot-drag-handle';
            slotHandle.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px;color:var(--text-secondary);">drag_indicator</span>';
            slotHandle.style.cssText = `
                position: absolute;
                top: 2px;
                left: 2px;
                z-index: 110;
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

            innerGrid.appendChild(slot);

            if (renderCellContentCallback) {
                renderCellContentCallback(slot, itemData, baseGlobalIdx + slotIdx, slotDef);
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

        // Sortable-driven reordering for photo slots. Every slot sharing
        // `groupName` is the same size, so a plain reorder (move) is safe —
        // this also enables cross-stripe dragging (slots from a different
        // stripe instance, possibly on a different page, sharing the group).
        new Sortable(innerGrid, {
            group: groupName,
            handle: '.slot-drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onStart: (evt) => {
                const h = evt.item.querySelector('.slot-drag-handle');
                if (h) h.style.cursor = 'grabbing';
            },
            onEnd: (evt) => {
                const h = evt.item.querySelector('.slot-drag-handle');
                if (h) h.style.cursor = 'grab';
            }
        });

        return innerGrid;
    }

    // ── Shared: swap the CONTENT of two plain (non-stripe) cell wrappers,
    // resizing the swapped craftools-element to fit its new cell. Used when a
    // promo_kit cell is dragged across two differently-shaped blocks, where a
    // plain DOM move would break each block's fixed cell shape. ─────────────
    _swapCellContent(cellA, cellB, unit) {
        const layerA = cellA.querySelector('.cell-content-layer');
        const layerB = cellB.querySelector('.cell-content-layer');
        if (!layerA || !layerB) return;

        const elsA = Array.from(layerA.children);
        const elsB = Array.from(layerB.children);

        const wA = parseFloat(cellA.style.width);
        const hA = parseFloat(cellA.style.height);
        const wB = parseFloat(cellB.style.width);
        const hB = parseFloat(cellB.style.height);

        const fit = (el, targetLayer, targetW, targetH) => {
            if (!el.tagName || el.tagName.toLowerCase() !== 'craftools-element') return;
            const padT = parseFloat(targetLayer.style.paddingTop) || 0;
            const padR = parseFloat(targetLayer.style.paddingRight) || 0;
            const padB = parseFloat(targetLayer.style.paddingBottom) || 0;
            const padL = parseFloat(targetLayer.style.paddingLeft) || 0;
            const innerW = targetW - padL - padR;
            const innerH = targetH - padT - padB;

            el.pw = innerW;
            el.ph = innerH;
            el.px = padL;
            el.py = padT;
            if (typeof el._applyTransform === 'function') el._applyTransform();

            el.setAttribute('w', innerW + unit);
            el.setAttribute('h', innerH + unit);
            el.setAttribute('x', padL + unit);
            el.setAttribute('y', padT + unit);
            el.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element: el } }));
        };

        elsA.forEach(el => { fit(el, layerB, wB, hB); layerB.appendChild(el); });
        elsB.forEach(el => { fit(el, layerA, wA, hA); layerA.appendChild(el); });
    }

    // ── Shared: build the outer stripe/cell container ─────────────────────
    _buildStripeContainer(cellW, cellH, unit, grid, globalIndex, activeSlot = null) {
        const slot = activeSlot || this.template;
        const isStripe = activeSlot ? this._isStripeSlot(activeSlot) : this.isPhotostrip;
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
        if (isStripe) {
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
            ${isStripe ? '' : `padding: ${pT}${unit} ${pR}${unit} ${pB}${unit} ${pL}${unit};`}
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

        // ── Alça de arrasto da célula inteira ──────────────────────────────
        // Apenas para células não-stripe (modo normal e slots simples de
        // promo_kit). Stripes (photostrip) têm posição fixa; o que se move são
        // as fotos individuais dentro delas, via a alça própria de cada slot
        // (.slot-drag-handle).
        if (!isStripe) {
            let dragHandle = document.createElement('div');
            dragHandle.className = "album-drag-handle";
            dragHandle.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; color: var(--text-secondary);">drag_indicator</span>';
            dragHandle.style.cssText = `
                position: absolute;
                top: 4px;
                left: 4px;
                z-index: 110;
                background: var(--bg-input, #fff);
                border: 1px solid var(--border, #e5e7eb);
                border-radius: 4px;
                padding: 2px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: grab;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            `;

            cellWrap.appendChild(dragHandle);
        }

        // ── Botão de edição da célula/stripe ─────────────────────────────
        let editBtn = document.createElement('div');
        editBtn.className = "cell-edit-btn";
        editBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">settings</span>';
        editBtn.style.cssText = `
            position: absolute;
            top: 4px;
            right: 4px;
            z-index: 120;
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
