// Grid utility - decoupled from specific tools
export class Craftools_LayoutGrid {
    constructor(editor, startPage, pageSize, template) {
        this.editor = editor;
        this.startPage = startPage;
        this.pageSize = pageSize;
        this.template = template;
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
        const perPage = cols * rows;

        let currentPage = this.startPage;
        let pagesWrapper = this.editor.querySelector('#pages-wrapper');

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

            // Container CSS Grid
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

            // Adiciona as células relativas ao lote da página atual
            items.slice(i, i + perPage).forEach((itemData, indexOffset) => {
                let cellWrap = document.createElement('div');
                cellWrap.className = "craftools-grid-cell";
                cellWrap.style.cssText = `
                    width: ${cellW}${unit};
                    height: ${cellH}${unit};
                    padding: ${this.template.cellPadding.split(" ").map(p => parseFloat(p) + unit).join(" ")};
                    box-sizing: border-box;
                    background: transparent;
                    position: relative;
                    overflow: visible;
                `;
                
                // Adiciona a alça de arrasto da célula (Drag Handle)
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
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: grab;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                `;
                cellWrap.appendChild(dragHandle);

                // O próprio container base já é fornecido para a callback desenhar os items
                grid.appendChild(cellWrap);
                if(renderCellContentCallback) {
                    renderCellContentCallback(cellWrap, itemData, i + indexOffset);
                }
            });

            // Ativa Drag and Drop interativo p/ repor células APENAS CLICANDO NA ALÇA
            new Sortable(grid, { 
                animation: 200,
                handle: '.album-drag-handle', // <--- Resolve totalmente conflitos de clique
                ghostClass: "sortable-ghost",
                onStart: (evt) => {
                    evt.item.querySelector('.album-drag-handle').style.cursor = 'grabbing';
                },
                onEnd: (evt) => {
                    evt.item.querySelector('.album-drag-handle').style.cursor = 'grab';
                }
            });
        }
    }

    static updateBorders(editor, width, style, color) {
        if (!editor) return;
        
        // Update all cells in the editor
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
