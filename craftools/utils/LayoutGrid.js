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

        const unit = this.pageSize.sizeUnit;
        let u = 1;
        if (unit === 'mm') {
            u = 3.7795275591; // Pixels por MM (aproximado 96dpi)
        }

        const pageSizeParts = this.pageSize.size.split(',').map(Number);
        const docW = pageSizeParts[0] * u;
        const docH = pageSizeParts[1] * u;
        
        const margins = this.template.pageMargin.split(" ").map(v => parseFloat(v) * u);
        const [mT, mR, mB, mL] = margins;
        
        const cellW = this.template.cellWidth * u;
        const cellH = this.template.cellHeight * u;
        const gap = this.template.cellGap * u;

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
            currentPage.style.width = docW + 'px';
            currentPage.style.minHeight = docH + 'px';
            currentPage.style.background = '#ffffff'; 
            currentPage.style.position = 'relative';

            // Container CSS Grid
            let grid = document.createElement('div');
            grid.className = "craftools-grid-container";
            grid.style.cssText = `
                position: absolute;
                top: ${mT}px;
                right: ${mR}px;
                bottom: ${mB}px;
                left: ${mL}px;
                display: grid;
                grid-template-columns: repeat(${cols}, ${cellW}px);
                grid-auto-rows: ${cellH}px;
                gap: ${gap}px;
                align-content: start;
                box-sizing: border-box;
            `;

            currentPage.appendChild(grid);

            // Adiciona as células relativas ao lote da página atual
            items.slice(i, i + perPage).forEach((itemData, indexOffset) => {
                let cellWrap = document.createElement('div');
                cellWrap.className = "craftools-grid-cell";
                cellWrap.style.cssText = `
                    width: ${cellW}px;
                    height: ${cellH}px;
                    padding: ${this.template.cellPadding.split(" ").map(p => (parseFloat(p) * u) + "px").join(" ")};
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
}
