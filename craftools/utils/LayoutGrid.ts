/**
 * LayoutGrid.ts
 */

import type { GridTemplate, GridTemplateSlot } from './GridSizes.js';
// Vendored via npm (previously loaded at runtime from a jsDelivr CDN
// <script> injected below) -- Vite bundles it into dist/assets/*.js on
// build, so grid drag-reorder no longer depends on a third-party network
// request the first time it's used.
import Sortable from 'sortablejs';

export interface PageSizeDef {
  size: string;
  sizeUnit?: string;
}

export class Craftools_LayoutGrid {
  public editor:    HTMLElement;
  public startPage: HTMLElement;
  public pageSize:  PageSizeDef;
  public template:  GridTemplate;

  constructor(editor: HTMLElement, startPage: HTMLElement, pageSize: PageSizeDef, template: GridTemplate) {
      this.editor = editor;
      this.startPage = startPage;
      this.pageSize = pageSize;
      this.template = template;
  }

  get isPhotostrip(): boolean {
      return !!(this.template.cellLines || this.template.cellColumns);
  }

  get stripLines(): number {
      return this.template.cellLines || 1;
  }

  get stripCols(): number {
      return this.template.cellColumns || 1;
  }

  get itemsPerStripe(): number {
      return this.stripLines * this.stripCols;
  }

  get cellSpacing(): number {
      return this.template.cellSpacing || 0;
  }

  _isStripeSlot(slot: GridTemplateSlot | GridTemplate): boolean {
      return !!(slot && (slot.cellLines || slot.cellColumns));
  }

  _itemsPerUnit(slot: GridTemplateSlot | GridTemplate): number {
      return this._isStripeSlot(slot) ? (slot.cellLines || 1) * (slot.cellColumns || 1) : 1;
  }

  async render(items: any[], renderCellContentCallback?: (container: Element | null, item: any, idx: number, slotDef: any) => void): Promise<void> {
      const unit = this.pageSize.sizeUnit || 'px';

      const pageSizeParts = this.pageSize.size.split(',').map(Number);
      const docW = pageSizeParts[0];
      const docH = pageSizeParts[1];

      const margins = this.template.pageMargin.split(" ").map(v => parseFloat(v));
      const [mT, mR, mB, mL] = margins;

      const cellW = this.template.cellWidth || 0;
      const cellH = this.template.cellHeight || 0;
      const gap = this.template.cellGap || 0;

      const availableW = docW - mL - mR;
      const availableH = docH - mT - mB;

      const isPromo = this.template.type === 'promo_kit';
      let perPage = 0;
      let cols = 1, rows = 1, stripesPerPage = 1;

      if (isPromo) {
          perPage = (this.template.cellSlots || []).reduce((sum, slot) => sum + slot.cellCount * this._itemsPerUnit(slot), 0);
      } else {
          const slotW = cellW + gap;
          const slotH = cellH + gap;
          cols = Math.floor((availableW + gap) / slotW) || 1;
          rows = Math.floor((availableH + gap) / slotH) || 1;
          stripesPerPage = cols * rows;
          perPage = this.isPhotostrip ? stripesPerPage * this.itemsPerStripe : stripesPerPage;
      }

      let currentPage = this.startPage;
      let pagesWrapper = this.editor.querySelector('#pages-wrapper') as HTMLElement;

      const photostripGroup = `photostrip-group-${Date.now()}`;

      for (let i = 0; i < items.length; i += perPage) {
          if (i > 0) {
              const { PageTool } = await import('../tools/page/PageTool.js');
              PageTool.addNewPage(this.editor);
              currentPage = pagesWrapper.querySelector('.craftools-page:last-child') as HTMLElement;
          }

          currentPage.innerHTML = '';
          currentPage.style.width = docW + unit;
          currentPage.style.minHeight = docH + unit;
          currentPage.style.background = '#ffffff';
          currentPage.style.position = 'relative';

          let grid = document.createElement('div');
          grid.className = "craftools-grid-container";
          grid.dataset['borderWidth'] = '1';
          grid.dataset['borderStyle'] = 'dashed';
          grid.dataset['borderColor'] = '#cccccc';
          grid.dataset['gridSource'] = 'album';

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

                  new Sortable(grid, {
                      animation: 200,
                      handle: '.album-drag-handle',
                      ghostClass: "sortable-ghost",
                      onStart: (evt: any) => {
                          const h = evt.item.querySelector('.album-drag-handle');
                          if (h) h.style.cursor = 'grabbing';
                      },
                      onEnd: (evt: any) => {
                          const h = evt.item.querySelector('.album-drag-handle');
                          if (h) h.style.cursor = 'grab';
                      }
                  });
              }
          }
      }
  }

  _renderNormalCells(grid: HTMLElement, items: any[], startIdx: number, perPage: number, unit: string, renderCellContentCallback?: Function) {
      const cellW = this.template.cellWidth || 0;
      const cellH = this.template.cellHeight || 0;

      items.slice(startIdx, startIdx + perPage).forEach((itemData, indexOffset) => {
          const cellWrap = this._buildStripeContainer(cellW, cellH, unit, grid, startIdx + indexOffset);
          grid.appendChild(cellWrap);

          if (renderCellContentCallback) {
              const contentLayer = cellWrap.querySelector('.cell-content-layer');
              renderCellContentCallback(contentLayer, itemData, startIdx + indexOffset, this.template);
          }
      });
  }

  // NOTE: _availableH is accepted for API symmetry with the other layout
  // methods but not actually used to cap/paginate the shelf-packing below --
  // blocks stack downward via currentY with no check against this bound, so
  // a promo-kit page with enough items can overflow the available height.
  // Flagged during a static-analysis pass; left as-is since fixing it means
  // deciding a real behavior (clip? paginate? shrink?), not a mechanical fix.
  _renderPromoKit(grid: HTMLElement, items: any[], startIdx: number, perPage: number, unit: string, availableW: number, _availableH: number, renderCellContentCallback?: Function) {
      const gap = parseFloat(String(this.template.cellGap)) || 0;
      let currentX = 0;
      let currentY = 0;
      let shelfH = 0;

      const blocks = (this.template.cellSlots || []).map((slot) => {
          const slotGap = slot.cellGap !== undefined ? parseFloat(String(slot.cellGap)) : gap;

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
          return { slot, cols, rows, blockW, blockH, slotGap, x: 0, y: 0 };
      });

      blocks.forEach(b => {
          if (currentX + b.blockW > availableW && currentX > 0) {
              currentX = 0;
              currentY += shelfH + gap;
              shelfH = 0;
          }
          b.x = currentX;
          b.y = currentY;
          currentX += b.blockW + gap;
          shelfH = Math.max(shelfH, b.blockH);
      });

      let localItemIdx = 0;
      const pageItems = items.slice(startIdx, startIdx + perPage);

      const promoGroupName = `promo-kit-group-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let lastRelated: HTMLElement | null = null;

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
          const stripGroupName = `${promoGroupName}-strip-${b.slot.id || blockIdx}`;

          for (let c = 0; c < b.slot.cellCount; c++) {
              const cellWrap = this._buildStripeContainer(b.slot.cellWidth, b.slot.cellHeight, unit, groupDiv, startIdx + localItemIdx, b.slot);
              groupDiv.appendChild(cellWrap);

              if (isStripeSlot) {
                  const subItems = pageItems.slice(localItemIdx, localItemIdx + itemsPerUnit);
                  this._buildInnerStripGrid(cellWrap, b.slot, subItems, startIdx + localItemIdx, unit, stripGroupName, renderCellContentCallback);
              } else {
                  const itemData = pageItems[localItemIdx];
                  if (itemData && renderCellContentCallback) {
                      const contentLayer = cellWrap.querySelector('.cell-content-layer');
                      renderCellContentCallback(contentLayer, itemData, startIdx + localItemIdx, b.slot);
                  }

                  const imgEl = cellWrap.querySelector('craftools-element');
                  if (imgEl) {
                      imgEl.setAttribute('draggable', 'false');
                      const imgNode = imgEl.querySelector('img');
                      if (imgNode) imgNode.setAttribute('draggable', 'false');
                  }
              }

              localItemIdx += itemsPerUnit;
          }

          if (!isStripeSlot) {
              new Sortable(groupDiv, {
                  group: promoGroupName,
                  handle: '.album-drag-handle',
                  animation: 150,
                  ghostClass: 'sortable-ghost',
                  onStart: (evt: any) => {
                      const h = evt.item.querySelector('.album-drag-handle');
                      if (h) h.style.cursor = 'grabbing';
                  },
                  onMove: (evt: any) => {
                      lastRelated = evt.related;
                      return true;
                  },
                  onEnd: (evt: any) => {
                      const h = evt.item.querySelector('.album-drag-handle');
                      if (h) h.style.cursor = 'grab';

                      if (evt.from === evt.to) return; 

                      const itemEl = evt.item;
                      const displaced = lastRelated;

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

  _renderPhotostripes(grid: HTMLElement, items: any[], startIdx: number, perPage: number, stripesPerPage: number, unit: string, photostripGroup: string, renderCellContentCallback?: Function) {
      const cellW = this.template.cellWidth || 0;
      const cellH = this.template.cellHeight || 0;
      const stripItems = items.slice(startIdx, startIdx + perPage);

      for (let s = 0; s < stripesPerPage; s++) {
          const stripeItems = stripItems.slice(s * this.itemsPerStripe, (s + 1) * this.itemsPerStripe);
          if (stripeItems.length === 0) break;

          const stripeEl = this._buildStripeContainer(cellW, cellH, unit, grid, startIdx + s * this.itemsPerStripe);
          grid.appendChild(stripeEl);

          this._buildInnerStripGrid(stripeEl, this.template, stripeItems, startIdx + s * this.itemsPerStripe, unit, photostripGroup, renderCellContentCallback);
      }
  }

  _buildInnerStripGrid(stripeEl: HTMLElement, slotDef: any, subItems: any[], baseGlobalIdx: number, unit: string, groupName: string, renderCellContentCallback?: Function) {
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

      const overlayLayer = stripeEl.querySelector('.cell-overlay-layer');
      if (overlayLayer) stripeEl.insertBefore(innerGrid, overlayLayer);
      else stripeEl.appendChild(innerGrid);

      subItems.forEach((itemData, slotIdx) => {
          const slot = document.createElement('div');
          slot.className = 'photostrip-slot';
          slot.dataset['slotIdx'] = String(slotIdx);
          slot.style.cssText = `
              position: relative;
              overflow: hidden;
              box-sizing: border-box;
          `;

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

          slotHandle.addEventListener('mouseenter', () => { slotHandle.style.opacity = '1'; });
          slotHandle.addEventListener('mouseleave', () => { slotHandle.style.opacity = '0.8'; });

          innerGrid.appendChild(slot);

          if (renderCellContentCallback) {
              renderCellContentCallback(slot, itemData, baseGlobalIdx + slotIdx, slotDef);
          }

          const imgEl = slot.querySelector('craftools-element');
          if (imgEl) {
              imgEl.setAttribute('draggable', 'false');
              const imgNode = imgEl.querySelector('img');
              if (imgNode) {
                  imgNode.setAttribute('draggable', 'false');
              }
          }
      });

      new Sortable(innerGrid, {
          group: groupName,
          handle: '.slot-drag-handle',
          animation: 150,
          ghostClass: 'sortable-ghost',
          onStart: (evt: any) => {
              const h = evt.item.querySelector('.slot-drag-handle');
              if (h) h.style.cursor = 'grabbing';
          },
          onEnd: (evt: any) => {
              const h = evt.item.querySelector('.slot-drag-handle');
              if (h) h.style.cursor = 'grab';
          }
      });

      return innerGrid;
  }

  _swapCellContent(cellA: HTMLElement, cellB: HTMLElement, unit: string) {
      const layerA = cellA.querySelector('.cell-content-layer') as HTMLElement;
      const layerB = cellB.querySelector('.cell-content-layer') as HTMLElement;
      if (!layerA || !layerB) return;

      const elsA = Array.from(layerA.children);
      const elsB = Array.from(layerB.children);

      const wA = parseFloat(cellA.style.width);
      const hA = parseFloat(cellA.style.height);
      const wB = parseFloat(cellB.style.width);
      const hB = parseFloat(cellB.style.height);

      const fit = (el: any, targetLayer: HTMLElement, targetW: number, targetH: number) => {
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

          el.setAttribute('w', String(innerW) + unit);
          el.setAttribute('h', String(innerH) + unit);
          el.setAttribute('x', String(padL) + unit);
          el.setAttribute('y', String(padT) + unit);
          el.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element: el } }));
      };

      elsA.forEach(el => { fit(el, layerB, wB, hB); layerB.appendChild(el); });
      elsB.forEach(el => { fit(el, layerA, wA, hA); layerA.appendChild(el); });
  }

  _buildStripeContainer(cellW: number, cellH: number, unit: string, grid: HTMLElement, globalIndex: number, activeSlot: any = null): HTMLElement {
      const slot = activeSlot || this.template;
      const isStripe = activeSlot ? this._isStripeSlot(activeSlot) : this.isPhotostrip;
      const paddings = String(slot.cellPadding || '0').split(" ").map(p => parseFloat(p));
      const pT = isNaN(paddings[0]) ? 0 : paddings[0];
      const pR = isNaN(paddings[1]) ? pT : paddings[1];
      const pB = isNaN(paddings[2]) ? pT : paddings[2];
      const pL = isNaN(paddings[3]) ? pR : paddings[3];

      const defaultBWidth = grid.dataset['borderWidth'] || '1';
      const defaultBStyle = grid.dataset['borderStyle'] || 'dashed';
      const defaultBColor = grid.dataset['borderColor'] || '#cccccc';

      let cellWrap = document.createElement('div');
      cellWrap.className = "craftools-grid-cell";
      cellWrap.dataset['cellId'] = `cell-${Date.now()}-${globalIndex}`;
      if (isStripe) {
          cellWrap.dataset['isPhotostrip'] = 'true';
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

      let contentLayer = document.createElement('div');
      contentLayer.className = "cell-content-layer";
      contentLayer.style.cssText = `
          position: absolute; inset: 0; z-index: 1;
          ${isStripe ? '' : `padding: ${pT}${unit} ${pR}${unit} ${pB}${unit} ${pL}${unit};`}
          box-sizing: border-box;
      `;
      cellWrap.appendChild(contentLayer);

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

      cellWrap.addEventListener('click', (e: Event) => {
          const target = e.target as HTMLElement;
          if (!target.closest('.photostrip-slot') && !target.closest('.album-drag-handle') && !target.closest('.cell-edit-btn')) {
              import('../tools/album/CellPanel.js').then(({ CellPanel }) => {
                  CellPanel.open(this.editor, cellWrap);
              });
          }
      });

      return cellWrap;
  }

  static updateBorders(editor: HTMLElement, width: string | number, style: string, color: string): void {
      if (!editor) return;

      editor.querySelectorAll<HTMLElement>('.craftools-grid-cell').forEach(cell => {
          cell.style.borderWidth = `${width}px`;
          cell.style.borderStyle = style;
          cell.style.borderColor = color;
          cell.style.setProperty('--cell-border-width', `${width}px`);
          cell.style.setProperty('--cell-border-style', style);
          cell.style.setProperty('--cell-border-color', color);
      });

      editor.querySelectorAll<HTMLElement>('.craftools-grid-container').forEach(grid => {
          grid.dataset['borderWidth'] = String(width);
          grid.dataset['borderStyle'] = style;
          grid.dataset['borderColor'] = color;
      });
  }
}
