import { I18n } from '../../settings/Translations.js';
import { PanelUI } from '../../utils/PanelUI.js';
import { Notify } from '../../utils/Notify.js';
import { renderColorPicker, cssFromValue, parseCssBackground, type ColorPickerValue } from '../../utils/ColorPickerUI.js';
import './PageTool_Translations.js';

// ─── Type helpers ─────────────────────────────────────────────────────────────

/** Drop-in for `window.craftoolsApp` global injected at runtime. */
interface CraftoolsApp {
  activeMedia?: {
    sizes: Array<{ name: string; size: string; sizeUnit: string }>;
  };
}

declare global {
  interface Window {
    craftoolsZoomLevel?: number;
    craftoolsAutoSnap?: boolean;
    craftoolsAutoSnapAlign?: string;
    craftoolsApp?: CraftoolsApp;
  }
}

// ─── Utility — mirrors CommonProperties._rgbToHex (no legacy import needed) ──

function _rgbToHex(rgb: string): string {
  if (!rgb || rgb.startsWith('#')) return rgb || '#ffffff';
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#ffffff';
  return '#' + m.slice(0, 3).map(x => parseInt(x, 10).toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────────────

export class PageTool {
  static attachPageEvents(editor: HTMLElement, pageEl: HTMLElement): void {
    pageEl.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      pageEl.classList.add('drag-over');
    });

    pageEl.addEventListener('dragleave', () => {
      pageEl.classList.remove('drag-over');
    });

    pageEl.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault();
      pageEl.classList.remove('drag-over');

      const toolType = e.dataTransfer!.getData('ToolType');

      if (toolType === 'album') {
        // AlbumTool.js's wizard logic was ported to AlbumWizard.ts.
        const { AlbumTool } = await import('../album/AlbumWizard');
        AlbumTool.setup(editor, pageEl);
      } else if (toolType === 'calendario') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod: any = await import('../calendar/CalendarTool.js');
        mod.CalendarTool.setup(editor);
      } else if (toolType === 'emoji') {
        const emoji = e.dataTransfer!.getData('EmojiChar');
        if (!emoji) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { EmojiTool } = await import('../emoji/EmojiTool.js') as any;
        const rect = pageEl.getBoundingClientRect();
        const scale = window.craftoolsZoomLevel || 1;
        const el = EmojiTool.createElement(emoji) as HTMLElement;
        const dropX = Math.max(10, Math.min((e.clientX - rect.left) / scale - 40, (rect.width / scale) - 90));
        const dropY = Math.max(10, Math.min((e.clientY - rect.top)  / scale - 40, (rect.height / scale) - 90));
        el.setAttribute('x', String(Math.round(dropX)));
        el.setAttribute('y', String(Math.round(dropY)));
        pageEl.appendChild(el);
        pageEl.querySelector('div[style*="font-size: 14px"]')?.remove();
      } else if (toolType === 'shape') {
        const shapeType = e.dataTransfer!.getData('ShapeType');
        if (!shapeType) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { ShapeTool } = await import('../shape/ShapeTool.js') as any;
        const rect = pageEl.getBoundingClientRect();
        const scale = window.craftoolsZoomLevel || 1;
        const el = ShapeTool.createElement(shapeType, editor) as HTMLElement;
        const dropX = Math.max(10, Math.min((e.clientX - rect.left) / scale - 60, (rect.width / scale) - 120));
        const dropY = Math.max(10, Math.min((e.clientY - rect.top)  / scale - 60, (rect.height / scale) - 120));
        el.setAttribute('x', String(Math.round(dropX)));
        el.setAttribute('y', String(Math.round(dropY)));
        pageEl.appendChild(el);
        pageEl.querySelector('div[style*="font-size: 14px"]')?.remove();
      } else if (toolType === 'icone') {
        const iconPackId = e.dataTransfer!.getData('IconPackId');
        const iconId     = e.dataTransfer!.getData('IconId');
        if (!iconPackId || !iconId) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { IconTool } = await import('../icon/IconTool.js') as any;
        const rect = pageEl.getBoundingClientRect();
        const scale = window.craftoolsZoomLevel || 1;
        const el = IconTool.createElement(iconPackId, iconId, editor) as HTMLElement;
        const dropX = Math.max(10, Math.min((e.clientX - rect.left) / scale - 50, (rect.width / scale) - 100));
        const dropY = Math.max(10, Math.min((e.clientY - rect.top)  / scale - 50, (rect.height / scale) - 100));
        el.setAttribute('x', String(Math.round(dropX)));
        el.setAttribute('y', String(Math.round(dropY)));
        pageEl.appendChild(el);
        pageEl.querySelector('div[style*="font-size: 14px"]')?.remove();
      } else if ([
        'titulo', 'paragrafo', 'imagem', 'qrcode', 'barcode',
        'minicalendario', 'emojikitchen', 'conteudovariavel',
      ].includes(toolType)) {
        const pRect  = pageEl.getBoundingClientRect();
        const scale  = window.craftoolsZoomLevel || 1;

        // Default element dimensions per tool type
        const elW = toolType === 'imagem'           ? 200
                  : toolType === 'qrcode'           ? 180
                  : toolType === 'barcode'          ? 220
                  : toolType === 'minicalendario'   ? 190
                  : toolType === 'emojikitchen'     ? 160
                  : toolType === 'conteudovariavel' ? 220 : 120;

        const elH = toolType === 'imagem'           ? 150
                  : toolType === 'qrcode'           ? 180
                  : toolType === 'barcode'          ? 100
                  : toolType === 'minicalendario'   ? 210
                  : toolType === 'emojikitchen'     ? 160
                  : toolType === 'conteudovariavel' ?  50 :  40;

        let dropX: number;
        let dropY: number;
        const targetContainer: HTMLElement = pageEl;

        const cellTarget = (e.target as HTMLElement).closest<HTMLElement>('.craftools-grid-cell');

        if (cellTarget && window.craftoolsAutoSnap !== false) {
          const cRect   = cellTarget.getBoundingClientRect();
          const align   = window.craftoolsAutoSnapAlign || 'bottom-center';
          const offset  = 5;
          const cLeft   = (cRect.left - pRect.left)   / scale;
          const cTop    = (cRect.top  - pRect.top)    / scale;
          const cWidth  = cRect.width  / scale;
          const cHeight = cRect.height / scale;

          dropX = align.includes('left')  ? cLeft + offset
                : align.includes('right') ? cLeft + cWidth  - elW - offset
                : cLeft + (cWidth  / 2) - (elW / 2);

          dropY = align.includes('top')    ? cTop + offset
                : align.includes('bottom') ? cTop + cHeight - elH - offset
                : cTop + (cHeight / 2) - (elH / 2);
        } else {
          dropX = (e.clientX - pRect.left) / scale;
          dropY = (e.clientY - pRect.top)  / scale;
          if      (toolType === 'imagem')           { dropX = Math.max(10, Math.min(dropX - 100, (pRect.width / scale) - 200)); dropY = Math.max(10, Math.min(dropY -  75, (pRect.height / scale) - 150)); }
          else if (toolType === 'qrcode')           { dropX = Math.max(10, Math.min(dropX -  90, (pRect.width / scale) - 180)); dropY = Math.max(10, Math.min(dropY -  90, (pRect.height / scale) - 180)); }
          else if (toolType === 'barcode')          { dropX = Math.max(10, Math.min(dropX - 110, (pRect.width / scale) - 220)); dropY = Math.max(10, Math.min(dropY -  50, (pRect.height / scale) - 100)); }
          else if (toolType === 'minicalendario')   { dropX = Math.max(10, Math.min(dropX -  95, (pRect.width / scale) - 190)); dropY = Math.max(10, Math.min(dropY - 105, (pRect.height / scale) - 210)); }
          else if (toolType === 'emojikitchen')     { dropX = Math.max(10, Math.min(dropX -  80, (pRect.width / scale) - 160)); dropY = Math.max(10, Math.min(dropY -  80, (pRect.height / scale) - 160)); }
          else if (toolType === 'conteudovariavel') { dropX = Math.max(10, Math.min(dropX - 110, (pRect.width / scale) - 220)); dropY = Math.max(10, Math.min(dropY -  25, (pRect.height / scale) -  50)); }
          else                                      { dropX = Math.max(10, Math.min(dropX -  60, (pRect.width / scale) - 120)); dropY = Math.max(10, Math.min(dropY -  20, (pRect.height / scale) -  40)); }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type AnyMod = { [k: string]: any };
        let el: HTMLElement;
        if (toolType === 'imagem') {
          const mod = await import('../image/ImageTool.js') as AnyMod;
          el = mod['ImageTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'qrcode') {
          const mod = await import('../qrcode/QRCodeTool.js') as AnyMod;
          el = mod['QRCodeTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'barcode') {
          const mod = await import('../barcode/BarcodeTool.js') as AnyMod;
          el = mod['BarcodeTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'minicalendario') {
          const mod = await import('../minicalendar/MiniCalendarTool.js') as AnyMod;
          el = mod['MiniCalendarTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'emojikitchen') {
          const mod = await import('../emojikitchen/EmojiKitchenTool.js') as AnyMod;
          el = mod['EmojiKitchenTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'conteudovariavel') {
          const mod = await import('../variablecontent/VariableContentTool.js') as AnyMod;
          el = mod['VariableContentTool'].createElement(toolType, editor) as HTMLElement;
        } else {
          // titulo, paragrafo (default text tool)
          const mod = await import('../text/TextTool.js') as AnyMod;
          el = mod['TextTool'].createElement(toolType, editor) as HTMLElement;
        }

        el.setAttribute('x', String(dropX));
        el.setAttribute('y', String(dropY));

        if (!el.parentNode) {
          targetContainer.appendChild(el);
        } else if (el.parentNode !== targetContainer) {
          el.parentNode.removeChild(el);
          targetContainer.appendChild(el);
        }

        // --- Business Card Cloning Logic ---
        if (cellTarget) {
          const grid = cellTarget.closest<HTMLElement>('.craftools-grid-container');
          if (grid && grid.dataset['gridMode'] === 'card') {
            const allCells  = Array.from(grid.querySelectorAll<HTMLElement>('.craftools-grid-cell'));
            const myIndex   = allCells.indexOf(cellTarget);
            const cRect     = cellTarget.getBoundingClientRect();
            const cX        = (cRect.left - pRect.left) / scale;
            const cY        = (cRect.top  - pRect.top)  / scale;
            const relX      = dropX - cX;
            const relY      = dropY - cY;
            const linkedId  = 'link-' + Date.now();
            (el as HTMLElement & { dataset: DOMStringMap }).dataset['linkedId'] = linkedId;

            allCells.forEach((cell, idx) => {
              if (idx === myIndex) return;
              const cellRect = cell.getBoundingClientRect();
              const ciX = (cellRect.left - pRect.left) / scale;
              const ciY = (cellRect.top  - pRect.top)  / scale;
              const clone = el.cloneNode(true) as HTMLElement;
              clone.setAttribute('x', String(ciX + relX));
              clone.setAttribute('y', String(ciY + relY));
              (clone as HTMLElement & { dataset: DOMStringMap }).dataset['linkedId'] = linkedId;
              targetContainer.appendChild(clone);
            });
          }
        }

        pageEl.querySelector('div[style*="font-size: 14px"]')?.remove();
      }
    });

    pageEl.addEventListener('click', async (e: MouseEvent) => {
      // Prevent deselecting element if clicking on an element handle
      if ((e.target as HTMLElement).closest('craftools-element')) return;

      const isPageClick =
        e.target === pageEl ||
        (e.target as HTMLElement).closest('.craftools-grid-container') ||
        (e.target as HTMLElement).id === 'canvas-area';

      if (isPageClick) {
        editor.querySelectorAll('.craftools-tool-btn').forEach(b => b.classList.remove('active'));

        // Check if page has a grid
        const gridContainer = pageEl.querySelector<HTMLElement>('.craftools-grid-container');
        if (gridContainer) {
          if (gridContainer.dataset['gridSource'] === 'calendario') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const calMod = await import('../calendar/CalendarTool.js') as { [k: string]: any };
            calMod['CalendarTool'].setup(editor);
            return;
          }
          // AlbumTool.js's wizard logic was ported to AlbumWizard.ts.
          const { AlbumTool } = await import('../album/AlbumWizard');
          AlbumTool.setup(editor, pageEl);
          return;
        }

        // Check if page has a paper element
        const paperEl = pageEl.querySelector<HTMLElement & { select?: () => void }>('craftools-element[data-craftool="papeis"]');
        if (paperEl && typeof paperEl.select === 'function') {
          paperEl.select();
          return;
        }

        const rightPanel  = document.getElementById('right-panel');
        const panelTitle  = document.getElementById('panel-title');
        const panelBody   = document.getElementById('panel-body');
        const defaultMenu = document.getElementById('panel-default-menu');
        const closePanel  = document.getElementById('close-panel');
        const panelLogo   = document.getElementById('panel-logo');

        if (panelTitle) panelTitle.textContent = I18n.t('pageTool.title');
        (editor as HTMLElement & { activePage: HTMLElement | null }).activePage = pageEl;

        // Parse current dimensions
        const currentWidthRaw  = pageEl.style.width     || '800px';
        const currentHeightRaw = pageEl.style.minHeight || '600px';
        const currentUnitMatch = currentWidthRaw.match(/[a-z%]+$/i);
        const currentUnit      = currentUnitMatch ? currentUnitMatch[0] : 'px';
        const currentW         = parseFloat(currentWidthRaw);
        const currentH         = parseFloat(currentHeightRaw);

        // Determine active media sizes from global state
        const presetsHtml = (window.craftoolsApp?.activeMedia?.sizes)
          ? window.craftoolsApp.activeMedia.sizes
              .map((s, i) => `<button class="craftools-pill preset-btn" data-index="${i}">${s.name}</button>`)
              .join('')
          : `<span style="font-size:11px;color:var(--text-muted)">${I18n.t('pageTool.noPresets')}</span>`;

        const currentColor = _rgbToHex(pageEl.style.backgroundColor || '#ffffff');

        if (panelBody) {
          const htmlSize = `
            <div class="ct-field">
              <span class="craftools-label">${I18n.t('pageTool.presets')}</span>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="presets-container">
                ${presetsHtml}
              </div>
            </div>
            <div class="ct-field">
              <span class="craftools-label">${I18n.t('pageTool.dimensions')}</span>
              <div style="display: flex; gap: 4px; margin-bottom: 6px;" id="unit-group">
                ${['px', 'mm', 'cm', 'in', '%'].map(u =>
                    `<button class="craftools-pill unit-btn ${u === currentUnit ? 'active' : ''}" data-unit="${u}">${u}</button>`
                  ).join('')}
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <input type="number" class="craftools-input" id="dim-w" style="width: 70px;" value="${currentW}">
                <span style="color: var(--text-muted); font-size: 13px;">×</span>
                <input type="number" class="craftools-input" id="dim-h" style="width: 70px;" value="${currentH}">
                <span style="color: var(--text-muted); font-size: 11px;" id="dim-unit-label">${currentUnit}</span>
              </div>
            </div>
          `;

          // Cor/Gradiente is rendered through the SAME standardized picker
          // (utils/ColorPickerUI.ts) every element tool's color field uses --
          // it owns its own Cor/Gradiente toggle internally (see
          // renderColorPicker() below), so this outer group only needs to
          // choose between "a flat color or gradient fill" and "an image".
          const htmlBackground = `
            <div class="ct-field">
              <span class="craftools-label">${I18n.t('pageTool.background')}</span>
              <div style="display: flex; gap: 4px; margin-bottom: 10px;" id="bg-type-group">
                <button class="craftools-pill bg-type-btn active" data-type="fill">${I18n.t('pageTool.color')}</button>
                <button class="craftools-pill bg-type-btn" data-type="image">${I18n.t('editor.image')}</button>
              </div>
              <div id="bg-fill-section"></div>
              <div id="bg-image-section" style="display: none;">
                <input type="url" class="craftools-input" id="page-bg-img-url" placeholder="${I18n.t('pageTool.imageUrl')}">
                <input type="file" id="page-bg-img-file" accept="image/*" style="margin-top: 8px; font-size: 11px; width: 100%;">
              </div>
            </div>
          `;

          const htmlActions = `
            <div class="ct-danger-section">
              <button class="craftools-danger-btn" id="delete-page-btn" style="width:100%; justify-content:center; gap:6px;">
                <span class="material-symbols-outlined" style="font-size:16px;">delete</span> ${I18n.t('pageTool.deletePage')}
              </button>
            </div>
          `;

          panelBody.innerHTML =
            PanelUI.accordion('page-tamanho', 'straighten', I18n.t('common.sectionTamanho') || 'Size & Position', htmlSize, { open: true }) +
            PanelUI.accordion('page-fundo',   'palette',    I18n.t('pageTool.background')   || 'Background',      htmlBackground) +
            PanelUI.accordion('page-acoes',   'warning',    I18n.t('pageTool.actions')       || 'Actions',         htmlActions);

          // BaseTool.renderPropertiesPanel() tracks which element #panel-body
          // last rendered (via a _ctRenderedElement expando) so it knows when
          // to wipe stale accordions before rendering a newly-selected
          // element's own schema. This panel bypasses that whole mechanism
          // (raw HTML, no selected element), so clear the marker here too --
          // otherwise selecting the same element again right after a page
          // click could, in principle, skip the wipe since the tracked
          // reference wouldn't have changed. Harmless today (this innerHTML
          // assignment already clears the DOM either way) but keeps the two
          // panel renderers' bookkeeping consistent.
          delete (panelBody as unknown as { _ctRenderedElement?: HTMLElement })._ctRenderedElement;

          PanelUI.bindAccordions(panelBody);
        }

        let activeUnit = currentUnit;

        // Bind Presets
        panelBody!.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx  = Number(btn.getAttribute('data-index'));
            const s    = window.craftoolsApp!.activeMedia!.sizes[idx];
            if (s.size !== '*') {
              const parts = s.size.split(',');
              (document.getElementById('dim-w') as HTMLInputElement).value = parts[0];
              (document.getElementById('dim-h') as HTMLInputElement).value = parts[1];
              activeUnit = s.sizeUnit;
              document.getElementById('dim-unit-label')!.innerText = activeUnit;
              panelBody!.querySelectorAll<HTMLButtonElement>('.unit-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-unit') === activeUnit);
              });
              pageEl.style.width     = parts[0] + activeUnit;
              pageEl.style.minHeight = parts[1] + activeUnit;
            }
          });
        });

        // Bind Dimensions
        // Uses `pageEl` (already in closure) rather than bouncing through
        // `editor.activePage` — see original comment in PageTool.js.
        const applyDims = (): void => {
          const w = (document.getElementById('dim-w') as HTMLInputElement).value;
          const h = (document.getElementById('dim-h') as HTMLInputElement).value;
          pageEl.style.width     = w + activeUnit;
          pageEl.style.minHeight = h + activeUnit;
        };

        (document.getElementById('dim-w') as HTMLInputElement).addEventListener('input', applyDims);
        (document.getElementById('dim-h') as HTMLInputElement).addEventListener('input', applyDims);

        panelBody!.querySelectorAll<HTMLButtonElement>('.unit-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            panelBody!.querySelectorAll<HTMLButtonElement>('.unit-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeUnit = btn.getAttribute('data-unit')!;
            document.getElementById('dim-unit-label')!.innerText = activeUnit;
            applyDims();
          });
        });

        // Bind Backgrounds
        const bgTypeBtns = panelBody!.querySelectorAll<HTMLButtonElement>('.bg-type-btn');
        const sections: Record<string, HTMLElement | null> = {
          fill:  document.getElementById('bg-fill-section'),
          image: document.getElementById('bg-image-section'),
        };

        bgTypeBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            bgTypeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const type = btn.getAttribute('data-type')!;
            Object.keys(sections).forEach(k => { if (sections[k]) sections[k]!.style.display = 'none'; });
            if (sections[type]) sections[type]!.style.display = 'block';
          });
        });

        // Color/Gradient background -- the standardized picker (same one
        // every element tool's color field uses). Seed its initial value
        // from the page's current background: a gradient if one's already
        // applied, otherwise the plain background-color.
        const fillSection = document.getElementById('bg-fill-section')!;
        const initialFillValue: ColorPickerValue = parseCssBackground(pageEl.style.background) ?? {
          mode: 'solid',
          solid: currentColor,
          gradient: { type: 'linear', angle: 90, stops: ['#f97316', '#facc15'] },
        };
        renderColorPicker(fillSection, initialFillValue, (next) => {
          pageEl.style.background = cssFromValue(next);
        }, { allowGradient: true });

        // Image Background
        const imgUrlInput = document.getElementById('page-bg-img-url') as HTMLInputElement;
        imgUrlInput.addEventListener('input', (e: Event) => {
          pageEl.style.background = `url(${(e.target as HTMLInputElement).value}) center/cover no-repeat`;
        });

        const imgFileInput = document.getElementById('page-bg-img-file') as HTMLInputElement;
        imgFileInput.addEventListener('change', (e: Event) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev: ProgressEvent<FileReader>) => {
              const result = ev.target!.result as string;
              imgUrlInput.value = result;
              pageEl.style.background = `url(${result}) center/cover no-repeat`;
            };
            reader.readAsDataURL(file);
          }
        });

        // Delete Page
        panelBody!.querySelector<HTMLButtonElement>('#delete-page-btn')!
          .addEventListener('click', async () => {
            if (await Notify.confirm(I18n.t('pageTool.confirmDelete'), { danger: true, confirmLabel: I18n.t('pageTool.deletePage') })) {
              const pagesWrapper = editor.querySelector<HTMLElement>('#pages-wrapper')!;
              if (pagesWrapper.querySelectorAll('.craftools-page').length > 1) {
                pageEl.remove();
                defaultMenu?.classList.remove('d-none');
                panelBody?.classList.add('d-none');
                closePanel?.classList.add('d-none');
                panelLogo?.classList.remove('d-none');
                if (panelTitle) panelTitle.textContent = '';
                (editor as HTMLElement & { activePage: HTMLElement | null }).activePage = null;
              } else {
                Notify.toast(I18n.t('pageTool.alertLastPage'), 'error');
              }
            }
          });

        defaultMenu?.classList.add('d-none');
        panelBody?.classList.remove('d-none');
        closePanel?.classList.remove('d-none');
        panelLogo?.classList.add('d-none');
        rightPanel?.classList.add('mobile-open');
      }
    });
  }

  static addNewPage(editor: HTMLElement): void {
    const pagesWrapper = editor.querySelector<HTMLElement>('#pages-wrapper')!;
    const lastPage     = pagesWrapper.querySelector<HTMLElement>('.craftools-page:last-child')!;

    // Clone the last page to preserve local dimensions
    const clone = lastPage.cloneNode(true) as HTMLElement;
    clone.id    = 'page-' + Date.now();

    // Remove child components entirely but keep the page shape
    clone.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 14px;">${I18n.t('pageTool.newPageLabel')}</div>`;

    // Attach events so the new page can be clicked locally
    this.attachPageEvents(editor, clone);
    pagesWrapper.appendChild(clone);

    document.dispatchEvent(new CustomEvent('craftools-page-add', { bubbles: true }));

    // Smoothly scroll to the newly added page
    pagesWrapper.parentElement!.scrollTo({ top: pagesWrapper.parentElement!.scrollHeight, behavior: 'smooth' });
  }
}
