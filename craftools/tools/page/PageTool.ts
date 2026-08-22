import { I18n } from '../../settings/Translations.js';
import { PanelUI } from '../../utils/PanelUI.js';
import { Notify } from '../../utils/Notify.js';
import { renderColorPicker, cssFromValue, parseCssBackground, normalizeValue, type ColorPickerValue } from '../../utils/ColorPickerUI.js';
import { PaperTool, PAPER_TYPES, PAPER_SIZES, THEMES, PaperThemes, type PaperMeta } from '../paper/PaperTool.js';
import { PropertyRenderer } from '../../utils/PropertyRenderer.js';
import { MobileToolbar } from '../../utils/MobileToolbar.js';
import { CropMarks, type CropMarksConfig, type CropMarksStyle } from '../../utils/CropMarks.js';
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
    // Idempotency guard -- attachPageEvents() is called from four different
    // places (initial page load, restoreOriginalCanvas() after leaving a
    // Calendar/Generator/ImageSlicer preview, addNewPage()'s clone, and
    // Editor.ts's _reattachAllPageEvents() after undo/redo/session
    // restore), and every one of them binds a fresh 'dragover'/'dragleave'/
    // 'drop' listener set with anonymous closures -- addEventListener()
    // doesn't dedupe those, so calling this twice on the SAME page node
    // stacks a second, independent 'drop' handler on top of the first.
    // From then on every single drag-drop onto that page ran BOTH handlers,
    // each creating its own element -- "drops a duplicate" (previously only
    // guarded against by a `_craftoolsEventsAttached` flag that
    // _reattachAllPageEvents() set and checked itself, but the other three
    // call sites neither set nor checked it, so restoreOriginalCanvas()
    // alone -- called every time a Calendar/Generator/ImageSlicer preview is
    // cancelled -- could double- or triple-bind the same page with no
    // undo/redo involved at all). Centralizing the guard here instead of in
    // each caller means every call site is safe by construction, including
    // ones added later.
    // Refresh the live crop-marks/bleed on-canvas preview every time this
    // runs (initial load, undo/redo/session restore, .craftools import,
    // restoreOriginalCanvas(), addNewPage() clone) -- unlike the event
    // listeners below this is cheap and idempotent, so it deliberately
    // sits OUTSIDE the `_craftoolsEventsAttached` guard.
    CropMarks.renderLiveOverlay(pageEl);

    const p = pageEl as HTMLElement & { _craftoolsEventsAttached?: boolean };
    if (p._craftoolsEventsAttached) return;
    p._craftoolsEventsAttached = true;

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
      } else if (toolType === 'calendar') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod: any = await import('../calendar/CalendarTool.js');
        // Was called with no page argument at all -- CalendarTool.setup()
        // took none, and its live preview hardcoded #main-page, so dropping
        // Calendar onto ANY page always previewed/generated relative to
        // page 1 regardless of where it was actually dropped. Now mirrors
        // the 'album' branch above: pass the real drop target through.
        mod.CalendarTool.setup(editor, pageEl);
      } else if (toolType === 'generator' || toolType === 'agenda' || toolType === 'imageslicer') {
        // Delegate to the real sidebar button click instead of duplicating
        // its setup logic here: generator's click handler in Editor.ts also
        // saves the page's original HTML/cssText (this._savedPageHtml)
        // before opening the live preview, state restoreOriginalCanvas()
        // depends on later. PageTool.ts has no access to that Editor-only
        // bookkeeping, so re-triggering the actual button click keeps
        // drag-activation and click-activation for these tools identical by
        // construction, with no risk of drift between the two paths.
        (document.querySelector(`[data-tool="${toolType}"]`) as HTMLElement | null)?.click();
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
      } else if (toolType === 'icon') {
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
      } else if (toolType === 'table') {
        const templateId = e.dataTransfer!.getData('TableTemplateId') || 'simple';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { TableTool } = await import('../table/TableTool.js') as any;
        const rect = pageEl.getBoundingClientRect();
        const scale = window.craftoolsZoomLevel || 1;
        const el = TableTool.createElement('table', editor) as HTMLElement;
        TableTool.applyTemplate(el, templateId);
        const dropX = Math.max(10, Math.min((e.clientX - rect.left) / scale - 160, (rect.width / scale) - 320));
        const dropY = Math.max(10, Math.min((e.clientY - rect.top)  / scale - 80, (rect.height / scale) - 160));
        el.setAttribute('x', String(Math.round(dropX)));
        el.setAttribute('y', String(Math.round(dropY)));
        pageEl.appendChild(el);
        pageEl.querySelector('div[style*="font-size: 14px"]')?.remove();
      } else if ([
        'title', 'paragraph', 'image', 'qrcode', 'barcode',
        'minicalendar', 'emojikitchen', 'variablecontent',
        'curvedtext', 'stamp', 'lettering',
      ].includes(toolType)) {
        const pRect  = pageEl.getBoundingClientRect();
        const scale  = window.craftoolsZoomLevel || 1;

        // Default element dimensions per tool type
        const elW = toolType === 'image'           ? 200
                  : toolType === 'qrcode'           ? 180
                  : toolType === 'barcode'          ? 220
                  : toolType === 'minicalendar'   ? 190
                  : toolType === 'emojikitchen'     ? 160
                  : toolType === 'curvedtext'       ? 160
                  : toolType === 'stamp'            ? 160
                  : toolType === 'lettering'         ? 360
                  : toolType === 'variablecontent' ? 220 : 120;

        const elH = toolType === 'image'           ? 150
                  : toolType === 'qrcode'           ? 180
                  : toolType === 'barcode'          ? 100
                  : toolType === 'minicalendar'   ? 210
                  : toolType === 'emojikitchen'     ? 160
                  : toolType === 'curvedtext'       ? 160
                  : toolType === 'stamp'            ? 160
                  : toolType === 'lettering'         ? 140
                  : toolType === 'variablecontent' ?  50 :  40;

        let dropX: number;
        let dropY: number;
        const targetContainer: HTMLElement = pageEl;

        // Dropped elements are never nested inside .craftools-grid-cell in
        // the DOM -- they're always appended as siblings of the grid and
        // just positioned (x/y) to line up visually with the cell. So once
        // a cell already has an element in it, a 2nd+ drop landing on top
        // of that existing element makes e.target resolve to the sibling
        // element (not a descendant of the cell), and closest() walking up
        // from it never reaches the cell -- silently skipping the Business
        // Card cloning logic below. Fall back to a position-based hit test
        // against every grid cell's rect so this still resolves correctly.
        let cellTarget = (e.target as HTMLElement).closest<HTMLElement>('.craftools-grid-cell');
        if (!cellTarget) {
          const gridCells = Array.from(pageEl.querySelectorAll<HTMLElement>('.craftools-grid-cell'));
          cellTarget = gridCells.find(cell => {
            const r = cell.getBoundingClientRect();
            return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          }) || null;
        }

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
          if      (toolType === 'image')           { dropX = Math.max(10, Math.min(dropX - 100, (pRect.width / scale) - 200)); dropY = Math.max(10, Math.min(dropY -  75, (pRect.height / scale) - 150)); }
          else if (toolType === 'qrcode')           { dropX = Math.max(10, Math.min(dropX -  90, (pRect.width / scale) - 180)); dropY = Math.max(10, Math.min(dropY -  90, (pRect.height / scale) - 180)); }
          else if (toolType === 'barcode')          { dropX = Math.max(10, Math.min(dropX - 110, (pRect.width / scale) - 220)); dropY = Math.max(10, Math.min(dropY -  50, (pRect.height / scale) - 100)); }
          else if (toolType === 'minicalendar')   { dropX = Math.max(10, Math.min(dropX -  95, (pRect.width / scale) - 190)); dropY = Math.max(10, Math.min(dropY - 105, (pRect.height / scale) - 210)); }
          else if (toolType === 'emojikitchen')     { dropX = Math.max(10, Math.min(dropX -  80, (pRect.width / scale) - 160)); dropY = Math.max(10, Math.min(dropY -  80, (pRect.height / scale) - 160)); }
          else if (toolType === 'curvedtext' || toolType === 'stamp') { dropX = Math.max(10, Math.min(dropX - 80, (pRect.width / scale) - 160)); dropY = Math.max(10, Math.min(dropY - 80, (pRect.height / scale) - 160)); }
          else if (toolType === 'lettering') { dropX = Math.max(10, Math.min(dropX - 180, (pRect.width / scale) - 360)); dropY = Math.max(10, Math.min(dropY - 70, (pRect.height / scale) - 140)); }
          else if (toolType === 'variablecontent') { dropX = Math.max(10, Math.min(dropX - 110, (pRect.width / scale) - 220)); dropY = Math.max(10, Math.min(dropY -  25, (pRect.height / scale) -  50)); }
          else                                      { dropX = Math.max(10, Math.min(dropX -  60, (pRect.width / scale) - 120)); dropY = Math.max(10, Math.min(dropY -  20, (pRect.height / scale) -  40)); }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type AnyMod = { [k: string]: any };
        let el: HTMLElement;
        if (toolType === 'image') {
          const mod = await import('../image/ImageTool.js') as AnyMod;
          el = mod['ImageTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'qrcode') {
          const mod = await import('../qrcode/QRCodeTool.js') as AnyMod;
          el = mod['QRCodeTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'barcode') {
          const mod = await import('../barcode/BarcodeTool.js') as AnyMod;
          el = mod['BarcodeTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'minicalendar') {
          const mod = await import('../minicalendar/MiniCalendarTool.js') as AnyMod;
          el = mod['MiniCalendarTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'emojikitchen') {
          const mod = await import('../emojikitchen/EmojiKitchenTool.js') as AnyMod;
          el = mod['EmojiKitchenTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'variablecontent') {
          const mod = await import('../variablecontent/VariableContentTool.js') as AnyMod;
          el = mod['VariableContentTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'curvedtext') {
          const mod = await import('../curvedtext/CurvedTextTool.js') as AnyMod;
          el = mod['CurvedTextTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'stamp') {
          const mod = await import('../stamp/StampTool.js') as AnyMod;
          el = mod['StampTool'].createElement(toolType, editor) as HTMLElement;
        } else if (toolType === 'lettering') {
          const mod = await import('../lettering/LetteringTool.js') as AnyMod;
          el = mod['LetteringTool'].createElement(toolType, editor) as HTMLElement;
        } else {
          // title, paragraph (default text tool)
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
        // Same selector Editor.ts's own clearToolActive() uses -- this used
        // to only match '.craftools-tool-btn' (the mobile footer toolbar's
        // class), never the desktop sidebar's '.sidenav-nav a' buttons, so
        // clicking empty canvas never actually cleared a highlighted
        // sidebar tool.
        editor.querySelectorAll('.craftools-tool-btn, .footer-nav-btn, .sidenav-nav a').forEach(b => b.classList.remove('active'));

        // Check if page has a grid
        const gridContainer = pageEl.querySelector<HTMLElement>('.craftools-grid-container');
        if (gridContainer) {
          if (gridContainer.dataset['gridSource'] === 'calendar') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const calMod = await import('../calendar/CalendarTool.js') as { [k: string]: any };
            calMod['CalendarTool'].setup(editor, pageEl);
            return;
          }
          // AlbumTool.js's wizard logic was ported to AlbumWizard.ts.
          const { AlbumTool } = await import('../album/AlbumWizard');
          AlbumTool.setup(editor, pageEl);
          return;
        }

        // Paper used to be a standalone element the user dragged onto the
        // canvas -- clicking a page that already had one used to redirect
        // here to select() that raw element directly instead of showing
        // Page Settings. Paper is now entirely managed via this panel's own
        // "Papel personalizado" tab below (see PaperTool.ts's own header
        // comment on ToolRegistry.register()), so a page click always shows
        // Page Settings, with that tab reflecting whatever paper element
        // (if any) already exists on this page.

        PageTool.openPageSettings(editor, pageEl);
      }
    });
  }

  // ── Page Settings panel (dimensions/background/clone/delete) ───────────────
  //
  // Extracted from the page-click handler above so it can also be opened
  // from tools that hijack a page's click (e.g. CalendarTool.ts's own panel
  // exposes a "Configurações da Página" action that routes here) instead of
  // that click always redirecting into the tool's own panel with no way to
  // reach page deletion. See CalendarTool.ts for the calling side.
  public static openPageSettings(editor: HTMLElement, pageEl: HTMLElement): void {
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
            <div class="ct-field ct-field--block">
              <span class="craftools-label">${I18n.t('pageTool.presets')}</span>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="presets-container">
                ${presetsHtml}
              </div>
            </div>
            <div class="ct-field ct-field--block">
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
            <div class="ct-field ct-field--block">
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
            <div class="ct-field ct-field--block" style="margin-bottom:8px;">
              <button class="craftools-topbtn" id="clone-page-btn" style="width:100%; justify-content:center; gap:6px; margin-bottom:8px;">
                <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span> ${I18n.t('pageTool.clonePage')}
              </button>
              <button class="craftools-topbtn" id="clone-alt-page-btn" style="width:100%; justify-content:center; gap:6px;">
                <span class="material-symbols-outlined" style="font-size:16px;">flip</span> ${I18n.t('pageTool.cloneAltPage')}
              </button>
            </div>
            <div class="ct-danger-section">
              <button class="craftools-danger-btn" id="delete-page-btn" style="width:100%; justify-content:center; gap:6px;">
                <span class="material-symbols-outlined" style="font-size:16px;">delete</span> ${I18n.t('pageTool.deletePage')}
              </button>
            </div>
          `;

          // "Papel personalizado" -- Paper used to be its own draggable
          // sidebar tool/element (PaperTool.ts); every one of its controls
          // now lives here instead, reading/writing whichever paper element
          // (if any) already exists on THIS page. See PageTool._renderPaperTabHtml().
          const existingPaperEl = PageTool._findPaperElement(pageEl);
          const paperMeta = existingPaperEl ? (existingPaperEl as HTMLElement & { _craftoolsMeta?: PaperMeta })._craftoolsMeta ?? null : null;
          const htmlPaper = PageTool._renderPaperTabHtml(paperMeta, existingPaperEl);

          // "Marcas de Corte" -- crop marks + bleed, stored directly on this
          // page's own dataset (CropMarks.ts). Unlike "Papel personalizado"
          // this has no separate underlying element -- it's a pure
          // page-property tab, config read/written straight off `pageEl`.
          const htmlCropMarks = PageTool._renderCropMarksTabHtml(CropMarks.readConfig(pageEl));

          PanelUI.withStatePreservation(panelBody, () => {
            panelBody.innerHTML =
              PanelUI.accordion('page-tamanho',    'straighten',  I18n.t('common.sectionTamanho') || 'Size & Position', htmlSize, { open: true }) +
              PanelUI.accordion('page-fundo',      'palette',     I18n.t('pageTool.background')   || 'Background',      htmlBackground) +
              PanelUI.accordion('page-papel',      'description', I18n.t('pageTool.customPaperTab') || 'Custom Paper',  htmlPaper) +
              PanelUI.accordion('page-cropmarks',  'content_cut', I18n.t('pageTool.cropMarksTab') || 'Crop Marks',      htmlCropMarks) +
              PanelUI.accordion('page-acoes',      'warning',     I18n.t('pageTool.actions')       || 'Actions',         htmlActions);
          });

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
          PageTool._bindPaperTab(panelBody, editor, pageEl);
          PageTool._bindCropMarksTab(panelBody, pageEl);
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
              CropMarks.renderLiveOverlay(pageEl);
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
          // Crop-marks/bleed live preview geometry depends on trim size.
          CropMarks.renderLiveOverlay(pageEl);
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

        // Clone Page
        panelBody!.querySelector<HTMLButtonElement>('#clone-page-btn')!
          .addEventListener('click', () => {
            PageTool._duplicatePage(editor, pageEl, false);
          });

        // Alternate Clone Page
        panelBody!.querySelector<HTMLButtonElement>('#clone-alt-page-btn')!
          .addEventListener('click', () => {
            PageTool._duplicatePage(editor, pageEl, true);
          });

        // Delete Page
        panelBody!.querySelector<HTMLButtonElement>('#delete-page-btn')!
          .addEventListener('click', () => { PageTool.deletePage(editor, pageEl); });

        defaultMenu?.classList.add('d-none');
        panelBody?.classList.remove('d-none');
        closePanel?.classList.remove('d-none');
        panelLogo?.classList.add('d-none');

        // Force the sidebar fully open even if it was left collapsed
        // (icons-only) from a previous interaction. 'mobile-open' (the
        // class this used to add) only affects `.craftools-sidebar`'s CSS,
        // not `#right-panel` (which is `.sidenav-panel` and is instead
        // driven by `.panel-open` / `.sidenav-collapsed`, per index.html's
        // inline styles) -- so this never actually expanded a collapsed
        // desktop panel. Every other panel-opening call site (Editor.ts's
        // openPanelMenu, CalendarTool.ts, AlbumWizard.ts) uses this same
        // add('panel-open') + remove('sidenav-collapsed') pair; this page
        // click handler was the one path missing it.
        rightPanel?.classList.add('panel-open');
        rightPanel?.classList.remove('sidenav-collapsed');
        if (rightPanel) {
          rightPanel.style.removeProperty('width');
          if (rightPanel.dataset.expandedWidth) rightPanel.style.width = rightPanel.dataset.expandedWidth;
        }
        if (window.innerWidth <= 768) rightPanel?.classList.add('mobile-modal-mode');
        // Swap the footer for the page-thumbnail strip while this page's
        // panel is open -- runs on every device: desktop's #footerNav is
        // the same fixed bottom bar (see MobileToolbar.showPageMode()'s
        // own doc comment), not mobile-only chrome. This is the only place
        // a page panel actually opens, so it's the right (and only) hook
        // needed on the "entering page mode" side.
        MobileToolbar.showPageMode(pageEl);
  }

  // ── Delete page (shared by Page Settings' own button and the
  //    page-thumbnail footer strip's trash icon -- MobileToolbar.ts) ────────
  //
  // Confirms, guards against deleting the last remaining page, removes the
  // page, and resets the properties panel + footer back to their default
  // state -- identical to what closePanelMenu() (Editor.ts) does when a
  // panel is closed normally, since the page it was showing settings for no
  // longer exists. Returns whether the page was actually deleted (false if
  // cancelled or blocked by the last-page guard), so callers that need to
  // react (e.g. re-render something) can check.
  public static async deletePage(editor: HTMLElement, pageEl: HTMLElement): Promise<boolean> {
    if (!(await Notify.confirm(I18n.t('pageTool.confirmDelete'), { danger: true, confirmLabel: I18n.t('pageTool.deletePage') }))) {
      return false;
    }
    const pagesWrapper = editor.querySelector<HTMLElement>('#pages-wrapper')!;
    if (pagesWrapper.querySelectorAll('.craftools-page').length <= 1) {
      Notify.toast(I18n.t('pageTool.alertLastPage'), 'error');
      return false;
    }
    pageEl.remove();

    const defaultMenu = document.getElementById('panel-default-menu');
    const panelBody   = document.getElementById('panel-body');
    const closePanel  = document.getElementById('close-panel');
    const panelLogo   = document.getElementById('panel-logo');
    const panelTitle  = document.getElementById('panel-title');
    defaultMenu?.classList.remove('d-none');
    panelBody?.classList.add('d-none');
    closePanel?.classList.add('d-none');
    panelLogo?.classList.remove('d-none');
    if (panelTitle) panelTitle.textContent = '';
    (editor as HTMLElement & { activePage: HTMLElement | null }).activePage = null;

    // The deleted page's own settings panel was the thing driving the
    // footer's page-thumbnail strip -- leave that mode too (same pairing
    // Editor.ts's closePanelMenu() uses) instead of leaving it stuck
    // showing a strip whose active thumbnail no longer exists.
    MobileToolbar.exitPageMode();
    if (window.innerWidth <= 768) MobileToolbar.showToolMode();

    return true;
  }

  // ── "Papel personalizado" (custom paper background) ────────────────────────
  //
  // Paper used to be its own draggable sidebar tool/element (PaperTool.ts) --
  // dragging one onto a page created a `<craftools-element data-craftool=
  // "paper">` sized to the page, locked, sitting at the bottom of the
  // stack. Every one of its controls (type/size/theme, lines, margins,
  // background, extras) now lives here in Page Settings instead: this tab
  // finds (or creates, on enable) that same underlying element on the
  // CURRENT page and drives it directly via PaperTool.updatePaperSVG(),
  // rather than duplicating any of its pattern-generation logic.

  private static _findPaperElement(pageEl: HTMLElement): (HTMLElement & { _craftoolsMeta?: PaperMeta }) | null {
    return pageEl.querySelector<HTMLElement & { _craftoolsMeta?: PaperMeta }>('craftools-element[data-craftool="paper"]');
  }

  private static _paperOptionsHtml(opts: Array<{ value: string; label: string }>, current: string): string {
    return opts.map(o => `<option value="${o.value}" ${o.value === current ? 'selected' : ''}>${I18n.t(`paperTool.${o.value}`) || o.label}</option>`).join('');
  }

  // Wrapped in the standard `.ct-field` class (not a bare `.ct-field-row`
  // with hand-rolled padding) so it picks up .ct-accordion-content's
  // Elementor-style row CSS -- label left, 12px horizontal padding,
  // 34px min-height -- exactly like every other field in this panel
  // (see fields/toggle.field.ts, which this markup mirrors) instead of
  // hugging the accordion's left/right edges with no horizontal padding.
  private static _toggleRowHtml(id: string, label: string, checked: boolean): string {
    return `
      <div class="ct-field">
        <span class="craftools-label" style="margin:0;">${label}</span>
        <label class="ct-toggle-label" style="display:flex; align-items:center; cursor:pointer; gap:6px; margin-left:auto;">
          <input type="checkbox" id="${id}" class="ct-fi" style="display:none;" ${checked ? 'checked' : ''}>
          <span class="ct-toggle-track" style="
            width:32px; height:18px; border-radius:99px;
            background:${checked ? 'var(--accent, #3b82f6)' : 'var(--border, #e4e4e7)'}; position:relative; transition:background .15s; flex-shrink:0;">
            <span class="ct-toggle-thumb" style="
              position:absolute; top:2px; left:2px;
              width:14px; height:14px; border-radius:50%;
              background:#fff; transition:transform .15s; box-shadow:0 1px 3px rgba(0,0,0,.2);
              transform: ${checked ? 'translateX(14px)' : 'translateX(0)'};">
            </span>
          </span>
        </label>
      </div>`;
  }

  private static _renderPaperTabHtml(meta: PaperMeta | null, paperEl?: HTMLElement | null): string {
    const enabled = meta !== null;
    const m = meta ?? PaperTool.getDefaultMeta();
    // "Espelhar conteúdo em páginas alternadas" (CommonSchema.ts's
    // flipAlternateSection()) isn't part of PaperMeta -- it's the same
    // generic per-element `dataset.ctState` field every other tool's
    // schema exposes, and PageTool.ts's own _duplicatePage()/
    // AgendaExport.ts's _applyAlternateLayout() already read it off ANY
    // craftools-element (including this paper one) unconditionally. So
    // this tab just needs to surface a toggle for it -- read/write
    // straight off the underlying element via PropertyRenderer, no new
    // PaperMeta field or PaperTool._applyProperty() case needed.
    const flipAlternate = paperEl ? PropertyRenderer._readState(paperEl).flipAlternate === true : false;

    return `
      ${PageTool._toggleRowHtml('paper-enable-chk', I18n.t('pageTool.paperEnable'), enabled)}
      <div id="paper-fields-wrap" style="${enabled ? '' : 'display:none;'}">
        <div class="ct-field" style="margin-top:8px;">
          <span class="craftools-label">${I18n.t('paperTool.paperType')}</span>
          <select class="craftools-select" id="paper-type">${PageTool._paperOptionsHtml(PAPER_TYPES, m.paperType)}</select>
        </div>
        <div class="ct-field">
          <span class="craftools-label">${I18n.t('paperTool.theme')}</span>
          <select class="craftools-select" id="paper-theme">${PageTool._paperOptionsHtml(THEMES, m.theme)}</select>
        </div>

        <div class="ct-field ct-field--block" style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--border, #e4e4e7);">
          <span class="craftools-label">${I18n.t('pageTool.paperLines')}</span>
          <div id="paper-line-color-section" style="margin-bottom:8px;"></div>
          <div class="ct-field" id="paper-line-gradient-mode-wrap" style="margin-bottom:8px; ${normalizeValue(m.lineColor).mode === 'gradient' ? '' : 'display:none;'}">
            <span class="craftools-label">${I18n.t('pageTool.paperLineGradientMode')}</span>
            <select class="craftools-select" id="paper-line-gradient-mode">
              <option value="per-line" ${m.lineGradientMode !== 'per-page' ? 'selected' : ''}>${I18n.t('pageTool.paperLineGradientPerLine')}</option>
              <option value="per-page" ${m.lineGradientMode === 'per-page' ? 'selected' : ''}>${I18n.t('pageTool.paperLineGradientPerPage')}</option>
            </select>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
            <div>
              <span class="craftools-label">${I18n.t('paperTool.lineStyle')}</span>
              <select class="craftools-select" id="paper-line-style">
                <option value="solid"  ${m.lineStyle === 'solid'  ? 'selected' : ''}>${I18n.t('paperTool.solid')}</option>
                <option value="dashed" ${m.lineStyle === 'dashed' ? 'selected' : ''}>${I18n.t('paperTool.dashed')}</option>
                <option value="dotted" ${m.lineStyle === 'dotted' ? 'selected' : ''}>${I18n.t('paperTool.dotted')}</option>
              </select>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <span class="craftools-label">${I18n.t('paperTool.lineSpacing')}</span>
              <input type="number" class="craftools-input" id="paper-line-spacing" value="${m.lineSpacing}" min="4" max="20" step="0.5">
            </div>
            <div>
              <span class="craftools-label">${I18n.t('paperTool.lineWidth')}</span>
              <input type="number" class="craftools-input" id="paper-line-width" value="${m.lineWidth}" min="0.1" max="5" step="0.1">
            </div>
          </div>
          ${m.paperType === 'todo_list' ? `
          <div class="ct-field" style="margin-top:8px;">
            <span class="craftools-label">${I18n.t('paperTool.checkboxShape')}</span>
            <select class="craftools-select" id="paper-checkbox-shape">
              <option value="square" ${m.checkboxShape === 'square' ? 'selected' : ''}>${I18n.t('paperTool.checkboxSquare')}</option>
              <option value="circle" ${m.checkboxShape === 'circle' ? 'selected' : ''}>${I18n.t('paperTool.checkboxCircle')}</option>
              <option value="star"   ${m.checkboxShape === 'star'   ? 'selected' : ''}>${I18n.t('paperTool.checkboxStar')}</option>
              <option value="heart"  ${m.checkboxShape === 'heart'  ? 'selected' : ''}>${I18n.t('paperTool.checkboxHeart')}</option>
            </select>
          </div>` : ''}
        </div>

        <div class="ct-field ct-field--block" style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--border, #e4e4e7);">
          <span class="craftools-label">${I18n.t('pageTool.paperMargins')}</span>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <span class="craftools-label">${I18n.t('paperTool.topMargin')}</span>
              <input type="number" class="craftools-input" id="paper-margin-top" value="${m.margins.top}" min="0" max="50" step="1">
            </div>
            <div>
              <span class="craftools-label">${I18n.t('paperTool.rightMargin')}</span>
              <input type="number" class="craftools-input" id="paper-margin-right" value="${m.margins.right}" min="0" max="50" step="1">
            </div>
            <div>
              <span class="craftools-label">${I18n.t('paperTool.bottomMargin')}</span>
              <input type="number" class="craftools-input" id="paper-margin-bottom" value="${m.margins.bottom}" min="0" max="50" step="1">
            </div>
            <div>
              <span class="craftools-label">${I18n.t('paperTool.leftMargin')}</span>
              <input type="number" class="craftools-input" id="paper-margin-left" value="${m.margins.left}" min="0" max="50" step="1">
            </div>
          </div>
        </div>

        <div class="ct-field ct-field--block" style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--border, #e4e4e7);">
          <span class="craftools-label" style="margin-bottom:8px; display:block;">${I18n.t('pageTool.paperExtras')}</span>
          ${PageTool._toggleRowHtml('paper-sidebar-enabled',     I18n.t('paperTool.enableSidebar'),   m.sidebar.enabled)}
          ${PageTool._toggleRowHtml('paper-watermark-enabled',   I18n.t('paperTool.enableWatermark'), m.watermark.enabled)}
          ${PageTool._toggleRowHtml('paper-logo-enabled',        I18n.t('paperTool.enableLogo'),      m.logo.enabled)}
          ${PageTool._toggleRowHtml('paper-page-number-enabled', I18n.t('paperTool.showPageNumber'),  m.pageSettings.showPageNumber)}
        </div>

        <div class="ct-field ct-field--block" style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--border, #e4e4e7);">
          <span class="craftools-label">${I18n.t('paperTool.orientation')}</span>
          <div class="ct-pill-group" id="paper-orientation-group" style="display:flex; gap:6px; margin-top:4px;">
            <button type="button" class="craftools-topbtn paper-orientation-btn" data-orientation="left"  style="flex:1; justify-content:center; ${(m.orientation ?? 'left') === 'left'  ? 'background:var(--accent, #3b82f6); color:#fff;' : ''}">${I18n.t('paperTool.orientationLeft')}</button>
            <button type="button" class="craftools-topbtn paper-orientation-btn" data-orientation="right" style="flex:1; justify-content:center; ${(m.orientation ?? 'left') === 'right' ? 'background:var(--accent, #3b82f6); color:#fff;' : ''}">${I18n.t('paperTool.orientationRight')}</button>
          </div>
          <div style="margin-top:10px;">
            ${PageTool._toggleRowHtml('paper-flip-alternate', I18n.t('common.flipAlternate'), flipAlternate)}
          </div>
        </div>
      </div>
    `;
  }


  /**
   * Wires the "Papel personalizado" tab's enable toggle + every field.
   * Re-renders just this tab's own HTML (via _renderPaperTabHtml()) and
   * re-binds after each change instead of trying to keep a live meta
   * object in sync field-by-field -- this tab's HTML is cheap to rebuild
   * and it keeps every field trivially reading its true current value
   * (mirrors how the enable toggle itself already has to swap the whole
   * fields block in/out).
   */
  private static _bindPaperTab(panelBody: HTMLElement, editor: HTMLElement, pageEl: HTMLElement): void {
    const wrap = panelBody.querySelector<HTMLElement>('#page-papel .ct-accordion-content') ?? panelBody;

    const rerender = (): void => {
      const paperEl = PageTool._findPaperElement(pageEl);
      const meta = paperEl?._craftoolsMeta ?? null;
      // PanelUI.accordion() uses data-accordion-id, not data-ct-section
      const target = panelBody.querySelector<HTMLElement>('[data-accordion-id="page-papel"] .ct-accordion-content');
      if (target) target.innerHTML = PageTool._renderPaperTabHtml(meta, paperEl);
      PageTool._bindPaperTab(panelBody, editor, pageEl);
    };

    const getOrCreatePaperEl = (): HTMLElement & { _craftoolsMeta?: PaperMeta } => {
      let paperEl = PageTool._findPaperElement(pageEl);
      if (!paperEl) {
        paperEl = PaperTool.createElement('paper', editor) as HTMLElement & { _craftoolsMeta?: PaperMeta };
        pageEl.appendChild(paperEl);
        pageEl.querySelector('div[style*="font-size: 14px"]')?.remove();
      }
      return paperEl;
    };

    const enableChk = wrap.querySelector<HTMLInputElement>('#paper-enable-chk');
    if (enableChk) {
      enableChk.onchange = () => {
        const paperEl = PageTool._findPaperElement(pageEl);
        if (paperEl) {
          // Disable: the underlying element is removed entirely (matches
          // "papel personalizado" being an opt-in overlay, not a permanent
          // page property) -- re-enabling later starts from a fresh default
          // rather than resurrecting the old configuration.
          paperEl.remove();
        } else {
          getOrCreatePaperEl();
        }
        rerender();
      };
    }

    const fieldsWrap = wrap.querySelector<HTMLElement>('#paper-fields-wrap');
    if (!fieldsWrap) return; // Disabled -- nothing else to bind.

    const applyMeta = (patch: Partial<PaperMeta> | ((m: PaperMeta) => void)): void => {
      const paperEl = getOrCreatePaperEl();
      const meta = (paperEl._craftoolsMeta ?? PaperTool.getDefaultMeta()) as PaperMeta;
      if (typeof patch === 'function') patch(meta);
      else Object.assign(meta, patch);
      paperEl._craftoolsMeta = meta;
      PaperTool.updatePaperSVG(paperEl);
    };

    fieldsWrap.querySelector<HTMLSelectElement>('#paper-type')?.addEventListener('change', e => {
      applyMeta({ paperType: (e.target as HTMLSelectElement).value });
      // The checkbox-shape select only shows up for paperType === 'todo_list'
      // -- re-render the tab so switching in/out of it appears immediately,
      // same as the enable/disable toggle above.
      rerender();
    });
    fieldsWrap.querySelector<HTMLSelectElement>('#paper-theme')?.addEventListener('change', e => {
      const theme = (e.target as HTMLSelectElement).value;
      const cfg = (PaperThemes as Record<string, { bg: string; line: string }>)[theme];
      if (cfg) applyMeta({ theme, bgColor: cfg.bg, lineColor: cfg.line });
      else applyMeta({ theme });
    });
    fieldsWrap.querySelector<HTMLSelectElement>('#paper-line-style')?.addEventListener('change', e => applyMeta({ lineStyle: (e.target as HTMLSelectElement).value }));
    fieldsWrap.querySelector<HTMLInputElement>('#paper-line-spacing')?.addEventListener('input', e => applyMeta({ lineSpacing: parseFloat((e.target as HTMLInputElement).value) || 0 }));
    fieldsWrap.querySelector<HTMLInputElement>('#paper-line-width')?.addEventListener('input', e => applyMeta({ lineWidth: parseFloat((e.target as HTMLInputElement).value) || 0 }));
    fieldsWrap.querySelector<HTMLSelectElement>('#paper-checkbox-shape')?.addEventListener('change', e => applyMeta({ checkboxShape: (e.target as HTMLSelectElement).value }));
    fieldsWrap.querySelector<HTMLInputElement>('#paper-margin-top')?.addEventListener('input', e => applyMeta(m => { m.margins.top = parseFloat((e.target as HTMLInputElement).value) || 0; }));
    fieldsWrap.querySelector<HTMLInputElement>('#paper-margin-right')?.addEventListener('input', e => applyMeta(m => { m.margins.right = parseFloat((e.target as HTMLInputElement).value) || 0; }));
    fieldsWrap.querySelector<HTMLInputElement>('#paper-margin-bottom')?.addEventListener('input', e => applyMeta(m => { m.margins.bottom = parseFloat((e.target as HTMLInputElement).value) || 0; }));
    fieldsWrap.querySelector<HTMLInputElement>('#paper-margin-left')?.addEventListener('input', e => applyMeta(m => { m.margins.left = parseFloat((e.target as HTMLInputElement).value) || 0; }));
    fieldsWrap.querySelector<HTMLSelectElement>('#paper-bg-pattern')?.addEventListener('change', e => applyMeta({ bgPattern: (e.target as HTMLSelectElement).value }));
    fieldsWrap.querySelector<HTMLInputElement>('#paper-sidebar-enabled')?.addEventListener('change', e => applyMeta(m => { m.sidebar.enabled = (e.target as HTMLInputElement).checked; }));
    fieldsWrap.querySelector<HTMLInputElement>('#paper-watermark-enabled')?.addEventListener('change', e => applyMeta(m => { m.watermark.enabled = (e.target as HTMLInputElement).checked; }));
    fieldsWrap.querySelector<HTMLInputElement>('#paper-logo-enabled')?.addEventListener('change', e => applyMeta(m => { m.logo.enabled = (e.target as HTMLInputElement).checked; }));
    fieldsWrap.querySelector<HTMLInputElement>('#paper-page-number-enabled')?.addEventListener('change', e => applyMeta(m => { m.pageSettings.showPageNumber = (e.target as HTMLInputElement).checked; }));

    // Line color picker
    const paperElNow = PageTool._findPaperElement(pageEl);
    const currentMeta = paperElNow?._craftoolsMeta ?? PaperTool.getDefaultMeta();

    const lineColorSection = fieldsWrap.querySelector<HTMLElement>('#paper-line-color-section');
    const gradientModeWrap = fieldsWrap.querySelector<HTMLElement>('#paper-line-gradient-mode-wrap');
    if (lineColorSection) {
      const val = normalizeValue(currentMeta.lineColor);
      renderColorPicker(lineColorSection, val, (next) => {
        applyMeta({ lineColor: JSON.stringify(next) });
        // The extra per-line/per-page control only makes sense once a
        // gradient is actually selected -- show/hide it live as the user
        // switches the line color picker between solid and gradient,
        // instead of only reflecting it on the next full tab re-render.
        if (gradientModeWrap) gradientModeWrap.style.display = next.mode === 'gradient' ? '' : 'none';
      }, { allowGradient: true });
    }
    fieldsWrap.querySelector<HTMLSelectElement>('#paper-line-gradient-mode')?.addEventListener('change', e => applyMeta({ lineGradientMode: (e.target as HTMLSelectElement).value }));

    // Orientation pills (left/right) -- horizontally mirrors the drawn
    // pattern within the page, e.g. moves todo_list's checkboxes to the
    // other side. See PaperPatterns.ts's generateContent() and PaperMeta's
    // own doc comment (PaperTool.ts) for how this composes with the
    // flip-alternate toggle below.
    fieldsWrap.querySelectorAll<HTMLButtonElement>('.paper-orientation-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyMeta({ orientation: btn.getAttribute('data-orientation') === 'right' ? 'right' : 'left' });
        fieldsWrap.querySelectorAll<HTMLButtonElement>('.paper-orientation-btn').forEach(b => {
          const active = b === btn;
          b.style.background = active ? 'var(--accent, #3b82f6)' : '';
          b.style.color      = active ? '#fff' : '';
        });
      });
    });

    // "Espelhar conteúdo em páginas alternadas" -- see _renderPaperTabHtml()'s
    // doc comment above for why this writes straight to the element's
    // dataset.ctState (via PropertyRenderer) rather than PaperMeta: it's
    // the same generic per-element field every other tool's schema exposes
    // (CommonSchema.ts's flipAlternateSection()), already consumed
    // unconditionally by PageTool.ts's own _duplicatePage() and
    // AgendaExport.ts's _applyAlternateLayout() for ANY craftools-element.
    fieldsWrap.querySelector<HTMLInputElement>('#paper-flip-alternate')?.addEventListener('change', e => {
      const paperEl = getOrCreatePaperEl();
      PropertyRenderer.applyChange(paperEl, 'flipAlternate', (e.target as HTMLInputElement).checked);
    });

    // Wire standard toggle track/thumb animation for every ct-fi checkbox in the
    // paper tab (extras toggles + the main enable toggle).
    wrap.querySelectorAll<HTMLInputElement>('input.ct-fi').forEach(input => {
      input.addEventListener('change', () => {
        const track = input.closest('label')?.querySelector<HTMLElement>('.ct-toggle-track');
        const thumb = input.closest('label')?.querySelector<HTMLElement>('.ct-toggle-thumb');
        if (track) track.style.background = input.checked ? 'var(--accent, #3b82f6)' : 'var(--border, #e4e4e7)';
        if (thumb) thumb.style.transform   = input.checked ? 'translateX(14px)' : 'translateX(0)';
      });
    });
  }

  // ── "Marcas de Corte" (crop marks + bleed) tab ──────────────────────────
  //
  // Pure page-property tab -- no underlying element the way "Papel
  // personalizado" has one (PaperTool's element). Config lives directly on
  // `pageEl.dataset` via CropMarks.readConfig()/writeConfig(); rendering
  // and export pipelines (PdfExport.ts, ImageExport.ts, AgendaSvgExport.ts,
  // PdfVectorExport.ts) read it back off that same page element (or its
  // clones, which inherit dataset) at export time.

  private static readonly _CROP_MARKS_STYLES: Array<{ value: CropMarksStyle; labelKey: string }> = [
    { value: 'standard', labelKey: 'cropMarksStyleStandard' },
    { value: 'cross',    labelKey: 'cropMarksStyleCross' },
    { value: 'circle',   labelKey: 'cropMarksStyleCircle' },
  ];

  private static _renderCropMarksTabHtml(config: CropMarksConfig): string {
    return `
      ${PageTool._toggleRowHtml('cropmarks-enable-chk', I18n.t('pageTool.cropMarksEnable'), config.enabled)}
      <div id="cropmarks-fields-wrap" style="${config.enabled ? '' : 'display:none;'} margin-top:8px;">
        <div class="ct-field ct-field--block">
          <span class="craftools-label">${I18n.t('pageTool.cropMarksStyle')}</span>
          <div class="ct-pill-group" id="cropmarks-style-group" style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap;">
            ${PageTool._CROP_MARKS_STYLES.map(s => `
              <button type="button" class="craftools-topbtn cropmarks-style-btn" data-style="${s.value}" style="flex:1; justify-content:center; min-width:70px; ${config.style === s.value ? 'background:var(--accent, #3b82f6); color:#fff;' : ''}">${I18n.t(`pageTool.${s.labelKey}`)}</button>
            `).join('')}
          </div>
        </div>
        <div class="ct-field ct-field--block" style="margin-top:8px;">
          <span class="craftools-label">${I18n.t('pageTool.cropMarksCount')}</span>
          <div class="ct-pill-group" id="cropmarks-count-group" style="display:flex; gap:6px; margin-top:4px;">
            <button type="button" class="craftools-topbtn cropmarks-count-btn" data-count="4" style="flex:1; justify-content:center; ${config.count === 4 ? 'background:var(--accent, #3b82f6); color:#fff;' : ''}">${I18n.t('pageTool.cropMarksCount4')}</button>
            <button type="button" class="craftools-topbtn cropmarks-count-btn" data-count="6" style="flex:1; justify-content:center; ${config.count === 6 ? 'background:var(--accent, #3b82f6); color:#fff;' : ''}">${I18n.t('pageTool.cropMarksCount6')}</button>
            <button type="button" class="craftools-topbtn cropmarks-count-btn" data-count="8" style="flex:1; justify-content:center; ${config.count === 8 ? 'background:var(--accent, #3b82f6); color:#fff;' : ''}">${I18n.t('pageTool.cropMarksCount8')}</button>
          </div>
        </div>
      </div>
      <div class="ct-field ct-field--block" style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--border, #e4e4e7);">
        <span class="craftools-label">${I18n.t('pageTool.bleedLabel')}</span>
        <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
          <input type="number" class="craftools-input" id="cropmarks-bleed-mm" style="width:80px;" value="${config.bleedMm}" min="0" max="50" step="0.5">
          <span style="color:var(--text-muted); font-size:11px;">mm</span>
        </div>
        <p style="margin:6px 0 0 0; font-size:10px; color:var(--text-muted); line-height:1.4;">${I18n.t('pageTool.bleedHint')}</p>
      </div>
    `;
  }

  private static _bindCropMarksTab(panelBody: HTMLElement, pageEl: HTMLElement): void {
    const wrap = panelBody.querySelector<HTMLElement>('[data-accordion-id="page-cropmarks"] .ct-accordion-content') ?? panelBody;

    const rerender = (): void => {
      const target = panelBody.querySelector<HTMLElement>('[data-accordion-id="page-cropmarks"] .ct-accordion-content');
      if (target) target.innerHTML = PageTool._renderCropMarksTabHtml(CropMarks.readConfig(pageEl));
      PageTool._bindCropMarksTab(panelBody, pageEl);
    };

    const enableChk = wrap.querySelector<HTMLInputElement>('#cropmarks-enable-chk');
    if (enableChk) {
      enableChk.onchange = () => {
        CropMarks.writeConfig(pageEl, { enabled: enableChk.checked });
        CropMarks.renderLiveOverlay(pageEl);
        rerender();
      };
    }

    wrap.querySelectorAll<HTMLButtonElement>('.cropmarks-style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const style = (btn.getAttribute('data-style') as CropMarksStyle) || 'standard';
        CropMarks.writeConfig(pageEl, { style });
        CropMarks.renderLiveOverlay(pageEl);
        wrap.querySelectorAll<HTMLButtonElement>('.cropmarks-style-btn').forEach(b => {
          const active = b === btn;
          b.style.background = active ? 'var(--accent, #3b82f6)' : '';
          b.style.color      = active ? '#fff' : '';
        });
      });
    });

    wrap.querySelectorAll<HTMLButtonElement>('.cropmarks-count-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const countAttr = btn.getAttribute('data-count');
        const count = countAttr === '8' ? 8 : countAttr === '6' ? 6 : 4;
        CropMarks.writeConfig(pageEl, { count });
        CropMarks.renderLiveOverlay(pageEl);
        wrap.querySelectorAll<HTMLButtonElement>('.cropmarks-count-btn').forEach(b => {
          const active = b === btn;
          b.style.background = active ? 'var(--accent, #3b82f6)' : '';
          b.style.color      = active ? '#fff' : '';
        });
      });
    });

    wrap.querySelector<HTMLInputElement>('#cropmarks-bleed-mm')?.addEventListener('input', e => {
      const bleedMm = parseFloat((e.target as HTMLInputElement).value) || 0;
      CropMarks.writeConfig(pageEl, { bleedMm });
      CropMarks.renderLiveOverlay(pageEl);
    });

    // Standard toggle track/thumb animation for this tab's own ct-fi checkbox.
    wrap.querySelectorAll<HTMLInputElement>('input.ct-fi').forEach(input => {
      input.addEventListener('change', () => {
        const track = input.closest('label')?.querySelector<HTMLElement>('.ct-toggle-track');
        const thumb = input.closest('label')?.querySelector<HTMLElement>('.ct-toggle-thumb');
        if (track) track.style.background = input.checked ? 'var(--accent, #3b82f6)' : 'var(--border, #e4e4e7)';
        if (thumb) thumb.style.transform   = input.checked ? 'translateX(14px)' : 'translateX(0)';
      });
    });
  }

  /**
   * Converts a page's authored CSS width (e.g. "210mm", "800px") into the
   * given target unit -- see AgendaExport.ts's identical helper (same
   * root cause fixed there: the alternated/mirrored clone below assumed
   * every element's x/w is in px, but PaperTool.createElement() authors
   * the background Paper element's x/w in the PAGE's own unit, commonly
   * "mm", so it lines up exactly with the page).
   */
  private static _pageWidthInUnit(rawPageWidth: string, targetUnit: string): number {
    const PX_PER_UNIT: Record<string, number> = { mm: 3.7795, cm: 37.795, in: 96, px: 1, '': 1 };
    const sourceUnit = rawPageWidth.replace(/[0-9.-]/g, '') || 'px';
    const sourceNum  = parseFloat(rawPageWidth) || 0;
    const tUnit      = targetUnit || 'px';
    if (sourceUnit === tUnit) return sourceNum;
    const px = sourceNum * (PX_PER_UNIT[sourceUnit] ?? 1);
    return px / (PX_PER_UNIT[tUnit] ?? 1);
  }

  static _duplicatePage(editor: HTMLElement, pageEl: HTMLElement, alternated: boolean): void {
    const clone = pageEl.cloneNode(true) as HTMLElement;
    clone.id = 'page-' + Date.now();
    delete (clone as HTMLElement & { _craftoolsEventsAttached?: boolean })._craftoolsEventsAttached;

    // `cloneNode(true)` copies EVERY attribute verbatim, including
    // `data-ct-id` -- StateSerializer.ts's own identity key, set lazily by
    // serialize() (e.g. via HistoryManager tracking an edit) the first
    // time this exact page/element is ever serialized. Left uncleared, the
    // clone silently carries the SAME ctId as its source for as long as
    // the session lasts, and once this project gets exported and
    // re-imported, StateSerializer.reconcile() sees two page (or element)
    // entries sharing one id: its own dedup guard now catches that and
    // mints a fresh replacement, but only as a safety net -- the two are
    // meant to be independent pages/elements from the moment they're
    // created here, not near-duplicates that merely happen to collide
    // later. Deleting it (rather than assigning a new value) lets
    // serialize() regenerate a proper fresh one exactly like it does for
    // any other never-before-serialized node.
    delete clone.dataset.ctId;
    clone.querySelectorAll<HTMLElement>('craftools-element').forEach(el => { delete el.dataset.ctId; });

    // A largura da página em pixels lógicos
    const pageWidthPx  = pageEl.offsetWidth;
    const rawPageWidth = pageEl.style.width || '210mm';

    // Parear elementos para copiar estado interno e (se alternado) espelhar posições
    const origEls = Array.from(pageEl.querySelectorAll<HTMLElement>('craftools-element'));
    const cloneEls = Array.from(clone.querySelectorAll<HTMLElement>('craftools-element'));

    // Elements with CommonSchema.ts's "Espelhar conteúdo em páginas
    // alternadas" (flipAlternate) turned on -- collected here and applied
    // AFTER `pageEl.after(clone)` below reconnects the clone to the
    // document, not inline in this loop. Reason: `cl` isn't connected yet
    // at this point, and the moment it IS (via that DOM insertion),
    // Element.ts's connectedCallback()/_applyTransform() rebuilds
    // style.transform from scratch purely from the x/y/w/h/r attributes
    // just set below -- any style.transform written before that point
    // would be silently discarded.
    const flipTargets: HTMLElement[] = [];

    for (let i = 0; i < origEls.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orig = origEls[i] as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cl = cloneEls[i] as any;

      cl._craftoolsMeta = orig._craftoolsMeta;
      cl._craftoolsAutoResize = orig._craftoolsAutoResize;
      cl.removeAttribute('data-linked-id');

      if (alternated) {
        const px = parseFloat(orig.getAttribute('x') || '0');
        const pw = parseFloat(orig.getAttribute('w') || '100');
        const pr = parseFloat(orig.getAttribute('r') || '0');

        // Mantém a unidade original pegando as letras
        const unitX = (orig.getAttribute('x') || '').replace(/[0-9.-]/g, '') || 'px';

        // Use the page's width IN THIS ELEMENT'S OWN UNIT (see
        // _pageWidthInUnit() above) -- not always pageWidthPx -- so e.g.
        // the Paper background element (authored in mm) mirrors correctly
        // instead of subtracting a px pageWidth from mm coordinates,
        // which used to push it far outside the visible page.
        const effectivePageWidth = unitX === 'px' ? pageWidthPx : PageTool._pageWidthInUnit(rawPageWidth, unitX);

        // Força a atualização dos getters do componente via attributes
        // O Componente ao entrar no DOM via clone, chamará connectedCallback()
        // e fará o _applyTransform() ler os atributos!
        cl.setAttribute('x', String(Math.round(effectivePageWidth - px - pw)) + unitX);
        if (pr !== 0) cl.setAttribute('r', String(-pr));

        if (PropertyRenderer._readState(cl).flipAlternate === true) {
          flipTargets.push(cl);
        }
      }
    }

    this.attachPageEvents(editor, clone);
    pageEl.after(clone);

    // Now that connectedCallback() has already derived the base
    // translate/rotate transform from the mirrored x/r attributes above,
    // tack the content-mirroring scaleX(-1) onto the end of it -- see
    // flipTargets' own comment above for why this has to happen here,
    // after insertion, instead of inside the loop.
    flipTargets.forEach(cl => {
      cl.style.transform = `${cl.style.transform} scaleX(-1)`.trim();
    });

    document.dispatchEvent(new CustomEvent('craftools-page-add', { bubbles: true }));

    // Rolagem suave para a nova página
    clone.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  static addNewPage(editor: HTMLElement): void {
    const pagesWrapper = editor.querySelector<HTMLElement>('#pages-wrapper')!;
    const lastPage     = pagesWrapper.querySelector<HTMLElement>('.craftools-page:last-child')!;

    // Clone the last page to preserve local dimensions
    const clone = lastPage.cloneNode(true) as HTMLElement;
    clone.id    = 'page-' + Date.now();
    // See _duplicatePage()'s matching comment: cloneNode(true) copies
    // `data-ct-id` too, which would otherwise leave this brand-new page
    // silently sharing StateSerializer.ts's identity key with `lastPage`.
    delete clone.dataset.ctId;

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
