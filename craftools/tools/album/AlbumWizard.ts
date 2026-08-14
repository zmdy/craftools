// @ts-nocheck
/**
 * AlbumWizard.ts — TypeScript port of AlbumTool.js's wizard-style panel.
 *
 * AlbumTool is NOT schema-driven (unlike TextTool, BarcodeTool, etc.): it
 * calls setup(editor, pageEl) to take over the ENTIRE properties panel and
 * manages all state (selected template, uploaded photos, quantity mode)
 * inside its own closure, re-rendering raw HTML on every change. There is no
 * canvas element and no _craftoolsMeta for a "wizard" itself — it generates a
 * craftools-grid-container directly on the page, filled with ImageTool
 * elements via Craftools_LayoutGrid. This shape is fundamentally
 * incompatible with PropertyRenderer's Section/Field schema model, so this
 * port keeps the exact same imperative structure as AlbumTool.js rather than
 * schema-ifying it.
 *
 * Split from AlbumTool.ts on purpose: AlbumTool.ts is eagerly imported by
 * Editor.ts (side-effect import, purely for ToolRegistry.register() so the
 * sidebar button/category exist) — if this whole wizard lived there too, its
 * ~800 lines (plus CellPanel.js/ApiPicker.js/CellBackground.js pulled in
 * transitively) would bloat the main bundle for every user, even those who
 * never open Album. Instead, Editor.ts's PANEL_SETUP_MAP dynamically
 * imports THIS file only when the user actually clicks the Album tool,
 * exactly like it dynamically imported AlbumTool.js before this port.
 *
 * AlbumTool.js itself is now dead code (nothing imports it anymore) but is
 * left on disk since this sandboxed environment cannot delete files --
 * safe to delete manually.
 */

// Imported with an explicit .js extension so Vite's runtime resolution (which
// only prefers .ts for BARE specifiers, per vite.config.ts) loads the real
// legacy ImageTool.js class (createElement/getDefaultMeta live there, not on
// the schema-based ImageTool.ts BaseTool subclass). TypeScript's "bundler"
// moduleResolution, however, statically prefers the .ts twin for typing
// purposes, so the import is cast to `any` here to match the actual runtime
// shape instead of fighting the resolver.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { ImageTool as ImageToolTyped } from '../image/ImageTool.js';
const ImageTool = ImageToolTyped as any;
import { I18n } from '../../settings/Translations.js';
import { Craftools_LayoutGrid } from '../../utils/LayoutGrid.js';
import { loadGridSizes } from '../../utils/ApiDataLoader.js';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { borderSection } from '../../utils/CommonSchema';
import { CellPanel } from './CellPanel.js';
import { GeneratorTool } from '../generator/GeneratorTool.js';
import { PanelUI } from '../../utils/PanelUI.js';
import { AppSettings } from '../../utils/AppSettings.js';
import { AlbumPreviewSVG } from '../../utils/AlbumPreviewSVG.js';
import { CropMarks, type CropMarksConfig, type CropMarksStyle } from '../../utils/CropMarks.js';
import * as ImageQuality from '../../utils/ImageQuality.js';
import './AlbumTool_Translations.js';

// ── Utilities ────────────────────────────────────────────────────────────────

/** Convert a CSS rgb(...) string to a #rrggbb hex string for color inputs. */
function _rgbToHex(rgb: string): string {
  if (!rgb) return '#000000';
  if (rgb === 'white') return '#ffffff';
  if (rgb === 'black') return '#000000';
  if (rgb === 'transparent') return '#ffffff';
  if (!rgb.startsWith('rgb')) return rgb;
  const parts = rgb.match(/\d+/g);
  if (!parts) return rgb;
  const hex = (x: string) => ('0' + parseInt(x).toString(16)).slice(-2);
  return '#' + hex(parts[0]) + hex(parts[1]) + hex(parts[2]);
}

/**
 * Flat list of individual-photo slot sizes (in the template's own physical
 * unit -- same unit as the page's `sizeUnit`, mm in every built-in
 * GridSizes.ts entry) for ONE full pass through the template's layout, in
 * the same left-to-right/top-to-bottom order photos are expected to fill
 * cells (mirrors `calcPerPage()`'s own counting logic just above/below this
 * function, so the two stay consistent).
 *
 * A "cell" can itself be a mini sub-grid of `cellLines` x `cellColumns`
 * stacked photos (e.g. a 3-photo vertical strip) -- each individual photo
 * then only gets `cellHeight/cellLines` (or `/cellColumns`) of the outer
 * cell's physical size, not the whole thing. Used only for the Qualidade
 * tab's DPI estimate, which doesn't need pixel-perfect fidelity with the
 * actual grid-building code (Craftools_LayoutGrid) -- just a good-enough
 * approximation of "how big will each photo actually end up on paper".
 */
function _photoSlotSizesMm(template: AlbumTemplate): Array<{ w: number; h: number }> {
  const oneCell = (cw: number, ch: number, lines?: number, cols?: number): { w: number; h: number } => ({
    w: cw / (cols || 1),
    h: ch / (lines || 1),
  });

  if (template.type === 'promo_kit' && Array.isArray(template.cellSlots) && template.cellSlots.length) {
    const out: Array<{ w: number; h: number }> = [];
    template.cellSlots.forEach((slot: CellSlot & { cellWidth?: number; cellHeight?: number }) => {
      const cw = typeof slot.cellWidth === 'number' ? slot.cellWidth : template.cellWidth;
      const ch = typeof slot.cellHeight === 'number' ? slot.cellHeight : template.cellHeight;
      const single = oneCell(cw, ch, slot.cellLines, slot.cellColumns);
      const itemsPerUnit = (slot.cellLines || slot.cellColumns) ? (slot.cellLines || 1) * (slot.cellColumns || 1) : 1;
      const total = (slot.cellCount || 0) * itemsPerUnit;
      for (let i = 0; i < total; i++) out.push(single);
    });
    return out;
  }

  // Regular grid: every cell is the same size (possibly itself a
  // cellLines x cellColumns sub-grid of stacked photos).
  return [oneCell(template.cellWidth, template.cellHeight, template.cellLines, template.cellColumns)];
}

// ── Loose domain types ───────────────────────────────────────────────────────
// GridSizes.js / the templates API return dynamically-shaped entries (some
// fields arrive as numbers instead of strings, etc. -- see normalizeTemplate
// below, ported verbatim from AlbumTool.js). Kept loose (index signature)
// rather than fully modeled, since the shape is genuinely API-driven.

interface PageSize {
  name: string;
  size: string;
  sizeUnit: string;
}

interface CellSlot {
  cellCount: number;
  cellLines?: number;
  cellColumns?: number;
}

interface AlbumTemplate {
  type?: string;
  name: string;
  pageMargin: string;
  cellPadding: string;
  cellGap: number;
  cellWidth: number;
  cellHeight: number;
  cellLines?: number;
  cellColumns?: number;
  cellSlots?: CellSlot[];
  sizes: string[];
  _source?: string;
  [key: string]: unknown;
}

interface PhotoImageData {
  src: string;
  w: number;
  h: number;
}

// Ad hoc globals set elsewhere in the app (Settings.js / PageTool.js /
// index.html inline scripts) -- same pragmatic `window as any` pattern
// Editor.ts itself already uses for `craftoolsSize`.
type CraftoolsWindow = typeof window & {
  craftoolsApp?: { activeMedia?: { sizes?: Array<{ size: string; name: string; sizeUnit: string }> } };
  craftoolsSize?: PageSize;
  craftoolsAutoSnap?: boolean;
  craftoolsAutoSnapAlign?: string;
};

export class AlbumTool {
  static async setup(editor: HTMLElement, pageEl: HTMLElement): Promise<void> {
    const win = window as CraftoolsWindow;
    const rightPanel = document.getElementById('right-panel');
    const panelTitle = document.getElementById('panel-title');
    const panelBody = document.getElementById('panel-body');
    const defaultMenu = document.getElementById('panel-default-menu');
    const closePanel = document.getElementById('close-panel');

    if (panelTitle) panelTitle.textContent = I18n.t('albumTool.panelTitle');
    (editor as unknown as { activePage?: HTMLElement | null }).activePage = pageEl;

    // ── State ──────────────────────────────────────────────────────────
    let selectedSize: PageSize | null = null;
    let selectedTemplate: AlbumTemplate | null = null;
    let selectedMode: 'album' | 'card' = 'album';
    let photos: File[] = [];
    let cardPhoto: File | null = null;
    let cardQuantityMode: 'auto' | 'manual' = 'auto';
    let cardManualQty = 1;
    let smartFit = false; // Auto rotate mismatched aspect ratios
    let autoEnhanceAll = false; // Auto enhance image quality for all album photos

    // Qualidade tab: object URLs created for the photo thumbnails/DPI probe
    // images, tracked so they can be revoked on the next render instead of
    // leaking one per photo per re-render (renderPanel() runs on every
    // state change, e.g. every checkbox toggle elsewhere in the wizard).
    let qualityObjectUrls: string[] = [];

    // Load sizes from global settings
    let availableSizes: PageSize[];
    if (win.craftoolsApp?.activeMedia?.sizes) {
      availableSizes = win.craftoolsApp.activeMedia.sizes.filter(s => s.size !== '*');
    } else {
      availableSizes = [
        { name: 'A4', size: '210,297', sizeUnit: 'mm' },
        { name: 'A5', size: '148,210', sizeUnit: 'mm' },
      ];
    }

    if (availableSizes.length > 0) selectedSize = availableSizes[0];

    // ── Template normalizer ───────────────────────────────────────────
    // The API may return numeric or missing values for fields that the local
    // GridSizes.js always provides as strings. This function sanitises an
    // entry before any rendering/calc logic touches it.
    const normalizeTemplate = (t: AlbumTemplate): AlbumTemplate => {
      const toSpaceStr = (val: unknown, fallback = '0 0 0 0'): string => {
        if (typeof val === 'string' && val.trim()) return val;
        if (typeof val === 'number') return `${val} ${val} ${val} ${val}`;
        return fallback;
      };
      return {
        ...t,
        pageMargin: toSpaceStr(t.pageMargin, '5 5 5 5'),
        cellPadding: toSpaceStr(t.cellPadding, '3 3 3 3'),
        cellGap: typeof t.cellGap === 'number' ? t.cellGap : 0,
        cellWidth: typeof t.cellWidth === 'number' ? t.cellWidth : 50,
        cellHeight: typeof t.cellHeight === 'number' ? t.cellHeight : 50,
        sizes: Array.isArray(t.sizes) ? t.sizes : [],
      };
    };

    // ── Helpers ────────────────────────────────────────────────────────
    const calcPerPage = (template: AlbumTemplate, size: PageSize): number => {
      if (template.type === 'promo_kit') {
        // Slots that are themselves photostrips (cellLines/cellColumns) consume
        // cellLines*cellColumns items per instance instead of just 1.
        // Slots with slotLines/slotColumns are regular cells (1 photo each)
        // — cellCount is already the total number of individual photos.
        return (template.cellSlots ?? []).reduce((sum, slot) => {
          const itemsPerUnit = (slot.cellLines || slot.cellColumns) ? (slot.cellLines || 1) * (slot.cellColumns || 1) : 1;
          return sum + slot.cellCount * itemsPerUnit;
        }, 0);
      }
      const parts = size.size.split(',').map(Number);
      const docW = parts[0];
      const docH = parts[1];
      const margins = template.pageMargin.split(' ').map(v => parseFloat(v));
      const [mT, mR, mB, mL] = margins;
      const cellW = template.cellWidth;
      const cellH = template.cellHeight;
      const gap = template.cellGap;
      const cols = Math.floor((docW - mL - mR + gap) / (cellW + gap)) || 1;
      const rows = Math.floor((docH - mT - mB + gap) / (cellH + gap)) || 1;
      const stripesPerPage = cols * rows;
      // For photostrips, multiply by number of slots per stripe
      const itemsPerStripe = (template.cellLines || 1) * (template.cellColumns || 1);
      return stripesPerPage * itemsPerStripe;
    };

    // ── Panel renderer ─────────────────────────────────────────────────
    // GridSizes vêm da API (com fallback para o arquivo local GridSizes.js)
    // loadGridSizes()'s JSDoc return type is the generic `Promise<object[]>`
    // (loose on purpose, since entries are API-driven) -- cast to the modeled
    // shape rather than fighting the loose upstream annotation.
    // gridSizes starts empty — loaded asynchronously below so the panel opens instantly.
    let gridSizes: AlbumTemplate[] = [];

    const renderPanel = (): void => {
      if (!panelBody) return;

      // Templates with empty/missing sizes array are universal (compatible with all page sizes).
      // Only filter by size when the template explicitly declares supported sizes.
      // normalizeTemplate() sanitises API entries that may have numeric/missing fields.
      const matchingTemplates = gridSizes
        .filter(t => {
          if (!selectedSize) return false;
          const sizes = Array.isArray(t.sizes) ? t.sizes : [];
          if (sizes.length === 0) return true; // universal template
          return sizes.includes(selectedSize.size);
        })
        .map(normalizeTemplate);

      const sizeHtml = availableSizes.map((s, idx) =>
        `<button class="craftools-pill size-btn ${selectedSize === s ? 'active' : ''}" data-idx="${idx}">${s.name}</button>`
      ).join('');

      const buildSlotPreview = (t: AlbumTemplate): string => {
        if (t.type === 'promo_kit') {
          return `<div class="card_preview" style="width:72px; height:68px; background:#ffffff; border:1px solid #d1d5db; border-radius:3px; box-shadow:0 1px 4px rgba(0,0,0,0.18); flex-shrink:0; display:flex; padding:4px; gap:4px; box-sizing:border-box;">
                        <div style="flex:2; background:#9ca3af; height:100%; border-radius:1px;"></div>
                        <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                            <div style="flex:1; background:#9ca3af; border-radius:1px;"></div>
                            <div style="flex:1; background:#9ca3af; border-radius:1px;"></div>
                        </div>
                    </div>`;
        }

        const padParts = t.cellPadding.split(' ').map(v => parseFloat(v));
        const [padT, padR, padB, padL] = padParts;

        // Scale so the outer cell fits in 72×68px max
        const SLOT_MAX_W = 72;
        const SLOT_MAX_H = 68;
        const scale = Math.min(SLOT_MAX_W / t.cellWidth, SLOT_MAX_H / t.cellHeight, 1);
        const outerW = Math.round(t.cellWidth * scale);
        const outerH = Math.round(t.cellHeight * scale);

        const sPadT = Math.round(padT * scale);
        const sPadR = Math.round(padR * scale);
        const sPadB = Math.round(padB * scale);
        const sPadL = Math.round(padL * scale);

        const isStripe = !!(t.cellLines || t.cellColumns);

        if (isStripe) {
          // Photostrip preview: show the inner grid of slots
          const sLines = t.cellLines || 1;
          const sCols = t.cellColumns || 1;
          const innerW = outerW - sPadL - sPadR;
          const innerH = outerH - sPadT - sPadB;
          const slotW = Math.floor(innerW / sCols);
          const slotH = Math.floor(innerH / sLines);
          let slotsHtml = '';
          for (let r = 0; r < sLines; r++) {
            for (let c = 0; c < sCols; c++) {
              slotsHtml += `<div style="width:${slotW}px;height:${slotH}px;background:#9ca3af;"></div>`;
            }
          }
          return `<div class="card_preview" style="
                        width:${outerW}px; height:${outerH}px;
                        padding:${sPadT}px ${sPadR}px ${sPadB}px ${sPadL}px;
                        box-sizing:border-box;
                        background:#ffffff;
                        border:1px solid #d1d5db;
                        border-radius:3px;
                        box-shadow:0 1px 4px rgba(0,0,0,0.18);
                        flex-shrink:0;
                        overflow:hidden;
                        display:grid;
                        grid-template-columns:repeat(${sCols},1fr);
                        grid-template-rows:repeat(${sLines},1fr);
                        gap:1px;
                    ">${slotsHtml}</div>`;
        }

        // Standard (non-photostrip) preview
        return `<div class="card_preview" style="
                    width:${outerW}px; height:${outerH}px;
                    padding:${sPadT}px ${sPadR}px ${sPadB}px ${sPadL}px;
                    box-sizing:border-box;
                    background:#ffffff;
                    border:1px solid #d1d5db;
                    border-radius:3px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
                    flex-shrink:0;
                    overflow:hidden;
                ">
                    <div class="img_preview" style="
                        width:100%; height:100%;
                        background:#9ca3af;
                    "></div>
                </div>`;
      };

      // ── Helper: full page preview rendered as SVG ─────────────────
      const buildPagePreview = (t: AlbumTemplate): string => {
        // Only called once a size is selected (renderPanel's template list is
        // itself gated on selectedSize being set), so the non-null assertion
        // matches the legacy JS behavior -- AlbumPreviewSVG.build()'s JSDoc
        // types this param as plain `object` regardless.
        return AlbumPreviewSVG.build(t, selectedSize!, { maxW: 180, maxH: 140 });
      };

      // Show a spinner while gridSizes hasn't arrived from the API/local file yet.
      const isLoadingTemplates = gridSizes.length === 0;
      const templateHtml = isLoadingTemplates
        ? `<div style="font-size:12px; color:var(--text-muted); padding:10px 0; display:flex; align-items:center; gap:6px;">
               <span class="material-symbols-outlined" style="font-size:15px;">sync</span>
               Carregando layouts...
           </div>`
        : matchingTemplates.length > 0
          ? matchingTemplates.map((t, idx) => {
            const slotPreview = buildSlotPreview(t);
            const isActive = !!selectedTemplate && (
              selectedTemplate === t ||
              (selectedTemplate.id && t.id ? selectedTemplate.id === t.id : selectedTemplate.name === t.name)
            );
            const rowStyle = isActive
              ? `background:rgba(249,115,22,0.08); border:2px solid var(--accent,#f97316); box-shadow:0 0 0 1px var(--accent,#f97316), 0 2px 8px rgba(249,115,22,0.18);`
              : `background:var(--bg-input,#f4f4f5); border:1px solid var(--border,#e4e4e7);`;
            const textColor = isActive ? 'color:var(--accent,#f97316);' : 'color:var(--text-primary);';
            const mutedColor = 'color:var(--text-muted);';
            const secColor = 'color:var(--text-secondary);';
            const checkBadge = isActive
              ? `<span class="material-symbols-outlined" style="font-size:18px; color:var(--accent,#f97316); flex-shrink:0;">check_circle</span>`
              : '';

            const isPromo = t.type === 'promo_kit';
            const isUserTemplate = t._source === 'user';
            const userBadge = isUserTemplate
              ? `<span style="display:inline-block; background:#f97316; color:#fff; font-size:8px; padding:1px 5px; border-radius:8px; font-weight:700; margin-left:4px; vertical-align:middle;">✦ Meu Kit</span>`
              : '';

            // Calculate slot preview dimensions for the wrapper
            let wrapW = 72;
            let wrapH = 68;
            if (!isPromo) {
              const scale = Math.min(72 / t.cellWidth, 68 / t.cellHeight, 1);
              wrapW = Math.round(t.cellWidth * scale);
              wrapH = Math.round(t.cellHeight * scale);
            }

            return `
                      <div class="template-row" data-idx="${idx}" style="margin-bottom:6px;">
                          <div class="template-btn" data-idx="${idx}" style="
                              width:100%; padding:10px 12px; box-sizing:border-box;
                              display:flex; align-items:center; gap:12px;
                              border-radius:8px; cursor:pointer; overflow:hidden;
                              transition:all .12s;
                              ${rowStyle}
                          ">
                              <div style="flex:0 0 ${wrapW}px; width:${wrapW}px; height:${wrapH}px; display:flex; align-items:center; justify-content:center;">
                                  ${slotPreview}
                              </div>
                              <div style="flex:1; min-width:0; overflow:hidden;">
                                  <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; margin-bottom:4px;">
                                      <div style="font-size:12px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ${textColor}">${t.name}${userBadge}</div>
                                      ${checkBadge}
                                  </div>
                                  <div style="font-size:10px; margin-bottom:2px; ${secColor}">${isPromo ? I18n.t('albumTool.mixedSizes') : `${t.cellWidth} × ${t.cellHeight} mm`}</div>
                                  <div style="font-size:10px; margin-bottom:6px; ${mutedColor}">${I18n.t('albumTool.gapLabel')}: ${t.cellGap} mm</div>
                                  <div style="display:flex; gap:6px; align-items:center;">
                                      <button class="page-preview-btn" data-tidx="${idx}" style="
                                          font-size:9px; padding:2px 7px; border-radius:4px;
                                          background:transparent; border:1px solid ${isActive ? 'var(--accent,#f97316)' : 'var(--border,#374151)'};
                                          color:${isActive ? 'var(--accent,#f97316)' : 'var(--text-secondary)'}; cursor:pointer;
                                          display:inline-flex; align-items:center; gap:3px;
                                      ">
                                          <span class="material-symbols-outlined" style="font-size:11px;">grid_view</span>
                                          ${I18n.t('albumTool.viewPage')}
                                      </button>
                                      <button class="edit-template-btn" data-tidx="${idx}" style="
                                          font-size:9px; padding:2px 7px; border-radius:4px;
                                          background:transparent; border:1px solid ${isActive ? 'var(--accent,#f97316)' : 'var(--border,#374151)'};
                                          color:${isActive ? 'var(--accent,#f97316)' : 'var(--text-secondary)'}; cursor:pointer;
                                          display:inline-flex; align-items:center; gap:3px;
                                      ">
                                          <span class="material-symbols-outlined" style="font-size:11px;">edit</span>
                                          ${I18n.t('albumTool.editTemplate')}
                                      </button>
                                  </div>
                              </div>
                          </div>
                          <div class="page-preview-panel" data-tidx="${idx}" style="display:none; padding:6px; border-radius:6px; background:var(--bg-input,#1e1e2e); border:1px solid var(--border,#374151); margin-top:3px; text-align:center;">
                              ${buildPagePreview(t)}
                          </div>
                      </div>`;
          }).join('')
          : `<div style="font-size: 12px; color: var(--text-muted)">${I18n.t('albumTool.noTemplate')}</div>`;

      // Step 4 — specific to each mode
      let step4Html = '';
      if (selectedTemplate) {
        if (selectedMode === 'album') {
          step4Html = `
                        <div class="craftools-field">
                            <span class="craftools-label">${I18n.t('albumTool.step4SelectPhotos')}</span>
                            <input type="file" id="album-file-input" multiple accept="image/*" style="display: none;">
                            <button class="craftools-topbtn" id="album-select-btn" style="width: 100%; justify-content: center;">
                                <span class="material-symbols-outlined">imagesmode</span>
                                ${photos.length > 0 ? I18n.t('albumTool.photosSelectedCount').replace('{n}', String(photos.length)) : I18n.t('albumTool.selectPhotos')}
                            </button>
                        </div>`;
        } else {
          const autoQty = selectedSize ? calcPerPage(selectedTemplate, selectedSize) : '—';
          step4Html = `
                        <div class="craftools-field">
                            <span class="craftools-label">${I18n.t('albumTool.step4CardQty')}</span>
                            <div style="display: flex; gap: 6px; margin-bottom: 10px;">
                                <button class="craftools-pill qty-mode-btn ${cardQuantityMode === 'auto' ? 'active' : ''}" data-qmode="auto" style="flex:1; text-align:center;">
                                    <span class="material-symbols-outlined" style="font-size:13px; vertical-align:middle;">auto_awesome</span> ${I18n.t('albumTool.auto')} (${autoQty})
                                </button>
                                <button class="craftools-pill qty-mode-btn ${cardQuantityMode === 'manual' ? 'active' : ''}" data-qmode="manual" style="flex:1; text-align:center;">
                                    <span class="material-symbols-outlined" style="font-size:13px; vertical-align:middle;">edit</span> ${I18n.t('albumTool.manual')}
                                </button>
                            </div>
                            ${cardQuantityMode === 'manual' ? `
                                <input type="number" id="card-qty-input" class="craftools-input"
                                    min="1" max="999" value="${cardManualQty}"
                                    style="width: 100%; text-align: center; font-size: 20px; font-weight: 700; padding: 10px;">
                            ` : ''}
                        </div>
                        <div class="craftools-field">
                            <span class="craftools-label">${I18n.t('albumTool.step5CardImage')}</span>
                            <input type="file" id="card-file-input" accept="image/*" style="display: none;">
                            <button class="craftools-topbtn" id="card-select-btn" style="width: 100%; justify-content: center;">
                                <span class="material-symbols-outlined">photo_camera</span>
                                ${cardPhoto ? I18n.t('albumTool.cardImageSelected') : I18n.t('albumTool.selectImageBtn')}
                            </button>
                        </div>`;
        }
      }

      // Detect existing grid configuration on page
      const existingGrid = pageEl.querySelector<HTMLElement>('.craftools-grid-container');

      // Crop marks aligned to the photo grid -- config lives on `pageEl.dataset`
      // (see CropMarks.ts's readAlbumConfig()/writeAlbumConfig() doc comment),
      // independent of the page-level "Marcas de Corte" tab in Page Settings.
      const cmConfig = CropMarks.readAlbumConfig(pageEl);

      // Generate button — validation per mode
      const canGenerate = !!selectedTemplate &&
        (selectedMode === 'album' ? photos.length > 0 : cardPhoto !== null);

      const htmlTamanhoLayout = `
                <div class="ct-field ct-field--block">
                    <span class="craftools-label">${I18n.t('albumTool.step1')}</span>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">${sizeHtml}</div>
                </div>

                <div class="ct-field ct-field--block">
                    <span class="craftools-label">${I18n.t('albumTool.step2')}</span>
                    <div style="display: flex; flex-direction: column; gap: 0;">${templateHtml}</div>
                </div>
            `;

      const htmlConteudo = selectedTemplate ? `
                <div class="ct-field ct-field--block">
                    <span class="craftools-label">${I18n.t('albumTool.step3Mode')}</span>
                    <div style="display: flex; gap: 6px;">
                        <button class="craftools-pill mode-btn ${selectedMode === 'album' ? 'active' : ''}" data-mode="album"
                            style="flex:1; text-align:center; padding: 10px 6px; flex-direction:column; display:flex; align-items:center; gap:4px; height:auto;">
                            <span class="material-symbols-outlined" style="font-size:22px;">photo_library</span>
                            <span style="font-size:10px;">${I18n.t('albumTool.modePhotoAlbum')}</span>
                        </button>
                        <button class="craftools-pill mode-btn ${selectedMode === 'card' ? 'active' : ''}" data-mode="card"
                            style="flex:1; text-align:center; padding: 10px 6px; flex-direction:column; display:flex; align-items:center; gap:4px; height:auto;">
                            <span class="material-symbols-outlined" style="font-size:22px;">contact_page</span>
                            <span style="font-size:10px;">${I18n.t('albumTool.modeBusinessCard')}</span>
                        </button>
                    </div>
                </div>
                ${step4Html}
            ` : `<div style="padding:10px; font-size:11px; color:var(--text-muted); text-align:center;">Selecione um layout primeiro.</div>`;

      // ── Qualidade tab (DPI per photo vs its slot in the chosen layout) ──
      // Revoke object URLs from the previous render before creating new
      // ones -- renderPanel() re-runs on every state change elsewhere in
      // the wizard (template pick, checkbox toggles, etc.), so without this
      // each re-render would leak one blob URL per photo.
      qualityObjectUrls.forEach(u => URL.revokeObjectURL(u));
      qualityObjectUrls = [];

      const _buildQualityCard = (file: File, idx: number): string => {
        const url = URL.createObjectURL(file);
        qualityObjectUrls.push(url);
        return `
                <div class="album-quality-card" style="display:flex; gap:10px; padding:8px; border-radius:8px; border:1px solid var(--border, #374151); align-items:center;">
                    <img class="album-quality-thumb" data-qidx="${idx}" src="${url}" style="width:48px; height:48px; object-fit:cover; border-radius:6px; flex-shrink:0; background:#000;">
                    <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;">
                        <span style="font-size:11px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${file.name}</span>
                        <span class="album-quality-dpi" data-qidx="${idx}" style="font-size:11px; color:var(--text-muted);">${I18n.t('albumTool.qualityCalculating') || 'Calculando qualidade...'}</span>
                    </div>
                </div>`;
      };

      let htmlQualidade: string;
      if (!selectedTemplate) {
        htmlQualidade = `<div style="padding:10px; font-size:11px; color:var(--text-muted); text-align:center;">${I18n.t('albumTool.qualityNeedsTemplate') || 'Selecione um layout primeiro.'}</div>`;
      } else if (selectedMode === 'album') {
        htmlQualidade = photos.length
          ? `<div style="display:flex; flex-direction:column; gap:6px;">${photos.map((f, i) => _buildQualityCard(f, i)).join('')}</div>`
          : `<div style="padding:10px; font-size:11px; color:var(--text-muted); text-align:center;">${I18n.t('albumTool.qualityNeedsPhotos') || 'Selecione as fotos para ver a qualidade de impressão de cada uma.'}</div>`;
      } else {
        htmlQualidade = cardPhoto
          ? `<div style="display:flex; flex-direction:column; gap:6px;">${_buildQualityCard(cardPhoto, 0)}</div>`
          : `<div style="padding:10px; font-size:11px; color:var(--text-muted); text-align:center;">${I18n.t('albumTool.qualityNeedsCardPhoto') || 'Selecione a foto do cartão para ver a qualidade de impressão.'}</div>`;
      }

      const htmlConfigs = `
                <div class="ct-field ct-field--block">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span class="craftools-label" style="margin:0;">${I18n.t('albumTool.autoAlign')}</span>
                        <button class="craftools-pill auto-snap-btn ${win.craftoolsAutoSnap !== false ? 'active' : ''}" style="display:flex; align-items:center; gap:4px;">
                            <span class="material-symbols-outlined" style="font-size:14px;">center_focus_strong</span>
                            ${win.craftoolsAutoSnap !== false ? I18n.t('albumTool.enabled') : I18n.t('albumTool.disabled')}
                        </button>
                    </div>

                    ${win.craftoolsAutoSnap !== false ? `
                    <div style="margin-bottom: 10px;">
                        <span class="craftools-label" style="margin:0 0 4px 0;">${I18n.t('albumTool.snapPosition')}</span>
                        <select class="craftools-input snap-align-select" style="width: 100%; padding: 4px; font-size: 12px;">
                            <option value="top-left" ${win.craftoolsAutoSnapAlign === 'top-left' ? 'selected' : ''}>${I18n.t('albumTool.snapTopLeft')}</option>
                            <option value="top-center" ${win.craftoolsAutoSnapAlign === 'top-center' ? 'selected' : ''}>${I18n.t('albumTool.snapTopCenter')}</option>
                            <option value="top-right" ${win.craftoolsAutoSnapAlign === 'top-right' ? 'selected' : ''}>${I18n.t('albumTool.snapTopRight')}</option>
                            <option value="center-left" ${win.craftoolsAutoSnapAlign === 'center-left' ? 'selected' : ''}>${I18n.t('albumTool.snapCenterLeft')}</option>
                            <option value="center-center" ${win.craftoolsAutoSnapAlign === 'center-center' ? 'selected' : ''}>${I18n.t('albumTool.snapCenterCenter')}</option>
                            <option value="center-right" ${win.craftoolsAutoSnapAlign === 'center-right' ? 'selected' : ''}>${I18n.t('albumTool.snapCenterRight')}</option>
                            <option value="bottom-left" ${win.craftoolsAutoSnapAlign === 'bottom-left' ? 'selected' : ''}>${I18n.t('albumTool.snapBottomLeft')}</option>
                            <option value="bottom-center" ${(win.craftoolsAutoSnapAlign || 'bottom-center') === 'bottom-center' ? 'selected' : ''}>${I18n.t('albumTool.snapBottomCenter')}</option>
                            <option value="bottom-right" ${win.craftoolsAutoSnapAlign === 'bottom-right' ? 'selected' : ''}>${I18n.t('albumTool.snapBottomRight')}</option>
                        </select>
                    </div>
                    ` : ''}

                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="craftools-label" style="margin:0;">${I18n.t('albumTool.smartFit')}</span>
                        <button class="craftools-pill smart-fit-btn ${smartFit ? 'active' : ''}" style="display:flex; align-items:center; gap:4px;">
                            <span class="material-symbols-outlined" style="font-size:14px;">auto_fix_high</span>
                            ${smartFit ? I18n.t('albumTool.enabled') : I18n.t('albumTool.disabled')}
                        </button>
                    </div>
                    <span style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 4px; margin-bottom: 10px;">${I18n.t('albumTool.smartFitHelp')}</span>

                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px dashed var(--border);">
                        <span class="craftools-label" style="margin:0;">Melhorar Qualidade de Imagens</span>
                        <button class="craftools-pill auto-enhance-all-btn ${autoEnhanceAll ? 'active' : ''}" style="display:flex; align-items:center; gap:4px;">
                            <span class="material-symbols-outlined" style="font-size:14px;">auto_fix_high</span>
                            ${autoEnhanceAll ? I18n.t('albumTool.enabled') : I18n.t('albumTool.disabled')}
                        </button>
                    </div>
                    <span style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 4px;">Aplica o ajuste de qualidade e cor a todas as fotos do álbum.</span>
                </div>
            `;

      const htmlAcoes = `
                <div class="ct-danger-section">
                    <button class="craftools-topbtn" id="album-generate-btn"
                        style="width: 100%; justify-content: center; background: var(--accent); color: white; border: none; margin-bottom: 4px;"
                        ${!canGenerate ? 'disabled' : ''}>
                        <span class="material-symbols-outlined">dynamic_feed</span> ${existingGrid ? I18n.t('albumTool.generateAgain') : I18n.t('albumTool.generateAlbum')}
                    </button>
                    ${existingGrid ? `
                    <button class="craftools-danger-btn" id="album-clear-btn"
                        style="width: 100%; justify-content: center; gap: 6px;">
                        <span class="material-symbols-outlined" style="font-size: 16px;">delete</span> ${I18n.t('albumTool.clearAlbum')}
                    </button>
                    ` : ''}
                </div>
            `;

      // Same 4 options as Page Settings' "Marcas de Corte" tab (enable,
      // style, count, bleed), but scoped to the photo grid
      // (`.craftools-grid-container`) instead of the whole page -- marks
      // track the grid's own rect, whatever size/position it ends up at,
      // rather than the page's fixed size. See CropMarks.ts's "Album grid
      // config" section for the full model.
      const htmlCropMarks = `
                <div class="ct-field ct-field--block">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span class="craftools-label" style="margin:0;">${I18n.t('albumTool.cropMarksEnable')}</span>
                        <button class="craftools-pill album-cropmarks-enable-btn ${cmConfig.enabled ? 'active' : ''}" style="display:flex; align-items:center; gap:4px;">
                            <span class="material-symbols-outlined" style="font-size:14px;">content_cut</span>
                            ${cmConfig.enabled ? I18n.t('albumTool.enabled') : I18n.t('albumTool.disabled')}
                        </button>
                    </div>
                    ${!existingGrid ? `<p style="margin:0 0 10px 0; font-size:10px; color:var(--text-muted); line-height:1.4;">${I18n.t('albumTool.cropMarksNoGridHint')}</p>` : ''}
                    ${cmConfig.enabled ? `
                    <div class="ct-field ct-field--block">
                        <span class="craftools-label">${I18n.t('pageTool.cropMarksStyle')}</span>
                        <div class="ct-pill-group" id="album-cropmarks-style-group" style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap;">
                            ${AlbumTool._CROP_MARKS_STYLES.map(s => `
                                <button type="button" class="craftools-topbtn album-cropmarks-style-btn" data-style="${s.value}" style="flex:1; justify-content:center; min-width:70px; ${cmConfig.style === s.value ? 'background:var(--accent, #3b82f6); color:#fff;' : ''}">${I18n.t(`pageTool.${s.labelKey}`)}</button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="ct-field ct-field--block" style="margin-top:8px;">
                        <span class="craftools-label">${I18n.t('pageTool.cropMarksCount')}</span>
                        <div class="ct-pill-group" id="album-cropmarks-count-group" style="display:flex; gap:6px; margin-top:4px;">
                            <button type="button" class="craftools-topbtn album-cropmarks-count-btn" data-count="4" style="flex:1; justify-content:center; ${cmConfig.count === 4 ? 'background:var(--accent, #3b82f6); color:#fff;' : ''}">${I18n.t('pageTool.cropMarksCount4')}</button>
                            <button type="button" class="craftools-topbtn album-cropmarks-count-btn" data-count="6" style="flex:1; justify-content:center; ${cmConfig.count === 6 ? 'background:var(--accent, #3b82f6); color:#fff;' : ''}">${I18n.t('pageTool.cropMarksCount6')}</button>
                            <button type="button" class="craftools-topbtn album-cropmarks-count-btn" data-count="8" style="flex:1; justify-content:center; ${cmConfig.count === 8 ? 'background:var(--accent, #3b82f6); color:#fff;' : ''}">${I18n.t('pageTool.cropMarksCount8')}</button>
                        </div>
                    </div>
                    <div class="ct-field ct-field--block" style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--border, #e4e4e7);">
                        <span class="craftools-label">${I18n.t('pageTool.bleedLabel')}</span>
                        <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
                            <input type="number" class="craftools-input" id="album-cropmarks-bleed-mm" style="width:80px;" value="${cmConfig.bleedMm}" min="0" max="50" step="0.5">
                            <span style="color:var(--text-muted); font-size:11px;">mm</span>
                        </div>
                        <p style="margin:6px 0 0 0; font-size:10px; color:var(--text-muted); line-height:1.4;">${I18n.t('albumTool.cropMarksBleedHint')}</p>
                    </div>
                    ` : ''}
                </div>
            `;

      // Determine which accordion should be open based on step completion
      // (wizard-step UX: guide the user to the next relevant section).
      let openTamanho = true;
      let openConteudo = false;
      let openConfigs = false;
      let openCropMarks = false;
      let openAcoes = false;

      if (selectedTemplate) {
        openTamanho = false;
        if ((selectedMode === 'album' && photos.length > 0) || (selectedMode === 'card' && cardPhoto !== null)) {
          openConteudo = false;
          openAcoes = true;
        } else {
          openConteudo = true;
        }
      }

      PanelUI.withStatePreservation(panelBody, () => {
        panelBody.innerHTML =
          PanelUI.accordion('album-tamanho', 'straighten', I18n.t('albumTool.sizeAndLayout') || 'Tamanho & Layout', htmlTamanhoLayout, { open: openTamanho }) +
          PanelUI.accordion('album-conteudo', 'imagesmode', I18n.t('albumTool.content') || 'Conteúdo', htmlConteudo, { open: openConteudo }) +
          PanelUI.accordion('album-qualidade', 'high_quality', I18n.t('albumTool.qualityTab') || 'Qualidade', htmlQualidade, { open: false }) +
          PanelUI.accordion('album-configs', 'settings', I18n.t('albumTool.settings') || 'Configurações', htmlConfigs, { open: openConfigs }) +
          PanelUI.accordion('album-cropmarks', 'content_cut', I18n.t('albumTool.cropMarksTab') || 'Marcas de Corte', htmlCropMarks, { open: openCropMarks }) +
          PanelUI.accordion('album-acoes', 'play_arrow', I18n.t('albumTool.actions') || 'Ações', htmlAcoes, { open: openAcoes });
      });

      // ── Qualidade tab: async DPI enrichment ─────────────────────────
      // `naturalWidth`/`naturalHeight` aren't known synchronously from a
      // File, so the cards above render with a "Calculando..." placeholder
      // and get patched in place here once each photo decodes. Reuses the
      // thumbnail's own blob URL (already created above) instead of
      // creating a second one per photo.
      (() => {
        const badges = panelBody.querySelectorAll<HTMLElement>('.album-quality-dpi[data-qidx]');
        if (!badges.length || !selectedTemplate) return;
        const sourceFiles: File[] = selectedMode === 'album' ? photos : (cardPhoto ? [cardPhoto] : []);
        const slots = _photoSlotSizesMm(selectedTemplate);
        const unit = selectedSize?.sizeUnit || 'mm';
        const toIn = (v: number) => unit === 'cm' ? ImageQuality.cmToInches(v) : ImageQuality.mmToInches(v);
        const thresholds = AppSettings.get('dpiQualityThresholds');

        const LEVEL_LABEL: Record<string, string> = {
          excellent: I18n.t('albumTool.qualityExcellent') || 'Excelente',
          good:      I18n.t('albumTool.qualityGood') || 'Boa qualidade',
          fair:      I18n.t('albumTool.qualityFair') || 'Aceitável (foto grande / vista de longe)',
          poor:      I18n.t('albumTool.qualityPoor') || 'Baixa qualidade — pode sair borrada',
        };
        const LEVEL_ICON: Record<string, string> = {
          excellent: 'check_circle', good: 'check_circle', fair: 'warning', poor: 'error',
        };

        badges.forEach(badge => {
          const idx = Number(badge.getAttribute('data-qidx'));
          const file = sourceFiles[idx];
          const thumb = panelBody.querySelector<HTMLImageElement>(`.album-quality-thumb[data-qidx="${idx}"]`);
          const slot = slots.length ? slots[idx % slots.length] : null;
          if (!file || !thumb || !slot) return;

          const probe = new Image();
          probe.onload = () => {
            const dpi = ImageQuality.computeEffectiveDpi(probe.naturalWidth, probe.naturalHeight, toIn(slot.w), toIn(slot.h), 'cover', 1);
            const level = ImageQuality.classifyDpi(dpi, thresholds);
            const color = ImageQuality.dpiLevelColor(level);
            badge.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; font-weight:600; color:${color};"><span class="material-symbols-outlined" style="font-size:14px;">${LEVEL_ICON[level]}</span>${Math.round(dpi)} DPI · ${LEVEL_LABEL[level]}</span>`;
          };
          probe.onerror = () => {
            badge.textContent = I18n.t('albumTool.qualityReadError') || 'Não foi possível ler a imagem';
          };
          probe.src = thumb.src;
        });
      })();

      // ── Bind: Step 1 — Size ────────────────────────────────────────
      panelBody.querySelectorAll<HTMLButtonElement>('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedSize = availableSizes[Number(btn.getAttribute('data-idx'))];
          selectedTemplate = null;
          if (selectedSize) {
            const parts = selectedSize.size.split(',');
            pageEl.style.width = parts[0] + selectedSize.sizeUnit;
            pageEl.style.minHeight = parts[1] + selectedSize.sizeUnit;
            win.craftoolsSize = selectedSize;
          }
          renderPanel();
        });
      });

      // ── Bind: Step 2 — Template (now div, not button) ────────────────
      panelBody.querySelectorAll<HTMLElement>('.template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          // Ignore clicks that originated from page-preview-btn or edit-template-btn
          if ((e.target as HTMLElement).closest('.page-preview-btn') || (e.target as HTMLElement).closest('.edit-template-btn')) return;
          selectedTemplate = matchingTemplates[Number(btn.getAttribute('data-idx'))];
          renderPanel();
        });
      });

      // ── Bind: Page preview toggle ──────────────────────────────────
      panelBody.querySelectorAll<HTMLElement>('.page-preview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation(); // don't trigger template-btn
          const tidx = btn.getAttribute('data-tidx');
          const panel = panelBody.querySelector<HTMLElement>(`.page-preview-panel[data-tidx="${tidx}"]`);
          if (!panel) return;
          const isOpen = panel.style.display !== 'none';
          panel.style.display = isOpen ? 'none' : 'block';
          btn.style.background = isOpen ? 'transparent' : 'var(--accent-dim, #1e3a5f)';
          btn.style.color = isOpen ? 'var(--text-secondary)' : 'var(--accent, #3b82f6)';
          btn.style.borderColor = isOpen ? 'var(--border,#374151)' : 'var(--accent, #3b82f6)';
        });
      });

      // ── Bind: Edit template in Generator ───────────────────────────
      panelBody.querySelectorAll<HTMLElement>('.edit-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tidx = Number(btn.getAttribute('data-tidx'));
          const tmpl = matchingTemplates[tidx];
          if (!tmpl) return;
          GeneratorTool.loadTemplateForEdit(tmpl);
        });
      });

      // ── Bind: Step 3 — Mode ────────────────────────────────────────
      panelBody.querySelectorAll<HTMLElement>('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedMode = btn.dataset.mode as 'album' | 'card';
          photos = [];
          cardPhoto = null;
          renderPanel();
        });
      });

      // ── Bind: Album — file input ───────────────────────────────────
      const albumFileInput = panelBody.querySelector<HTMLInputElement>('#album-file-input');
      const albumSelectBtn = panelBody.querySelector<HTMLButtonElement>('#album-select-btn');
      if (albumFileInput && albumSelectBtn) {
        albumSelectBtn.addEventListener('click', () => albumFileInput.click());
        albumFileInput.addEventListener('change', (e) => {
          photos = Array.from((e.target as HTMLInputElement).files ?? []);
          renderPanel();
        });
      }

      // ── Bind: Card — quantity mode ─────────────────────────────────
      panelBody.querySelectorAll<HTMLElement>('.qty-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          cardQuantityMode = btn.dataset.qmode as 'auto' | 'manual';
          renderPanel();
        });
      });
      const cardQtyInput = panelBody.querySelector<HTMLInputElement>('#card-qty-input');
      if (cardQtyInput) {
        cardQtyInput.addEventListener('input', (e) => {
          cardManualQty = Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1);
        });
      }

      // ── Bind: Card — image file input ──────────────────────────────
      const cardFileInput = panelBody.querySelector<HTMLInputElement>('#card-file-input');
      const cardSelectBtn = panelBody.querySelector<HTMLButtonElement>('#card-select-btn');
      if (cardFileInput && cardSelectBtn) {
        cardSelectBtn.addEventListener('click', () => cardFileInput.click());
        cardFileInput.addEventListener('change', (e) => {
          cardPhoto = (e.target as HTMLInputElement).files?.[0] ?? null;
          renderPanel();
        });
      }

      // ── Bind: Smart Fit & Snap Toggle ──────────────────────────────
      const smartFitBtn = panelBody.querySelector<HTMLButtonElement>('.smart-fit-btn');
      if (smartFitBtn) {
        smartFitBtn.addEventListener('click', () => {
          smartFit = !smartFit;
          renderPanel();
        });
      }

      const autoEnhanceAllBtn = panelBody.querySelector<HTMLButtonElement>('.auto-enhance-all-btn');
      if (autoEnhanceAllBtn) {
        autoEnhanceAllBtn.addEventListener('click', () => {
          autoEnhanceAll = !autoEnhanceAll;
          renderPanel();

          // Apply to existing album image elements on canvas
          const albumImages = editor.querySelectorAll<HTMLElement>('.craftools-grid-container craftools-element[data-craftool="image"]');
          albumImages.forEach(el => {
            ImageTool._applyProperty(el, 'autoEnhance', autoEnhanceAll);
          });
        });
      }

      const autoSnapBtn = panelBody.querySelector<HTMLButtonElement>('.auto-snap-btn');
      if (autoSnapBtn) {
        autoSnapBtn.addEventListener('click', () => {
          win.craftoolsAutoSnap = win.craftoolsAutoSnap === false ? true : false;
          renderPanel();
        });
      }

      const snapAlignSelect = panelBody.querySelector<HTMLSelectElement>('.snap-align-select');
      if (snapAlignSelect) {
        snapAlignSelect.addEventListener('change', (e) => {
          win.craftoolsAutoSnapAlign = (e.target as HTMLSelectElement).value;
        });
      }

      // ── Bind: Clear Album ──────────────────────────────────────────
      const albumClearBtn = panelBody.querySelector<HTMLButtonElement>('#album-clear-btn');
      if (albumClearBtn) {
        albumClearBtn.addEventListener('click', () => {
          // Clearing only `pageEl` (the page the wizard happened to be
          // opened on) left album content behind on any other auto-added
          // pages the album spilled onto -- see _findAlbumPages()'s doc
          // comment for why every page needs to be found, not just this one.
          const pagesWrapper = editor.querySelector<HTMLElement>('#pages-wrapper');
          const albumPages = AlbumTool._findAlbumPages(editor, pageEl);

          albumPages.forEach(page => {
            // Extra pages the album itself created hold nothing but its
            // grid -- remove them outright instead of leaving a blank page
            // behind, same as the "Apagar página" action, guarded the same
            // way (never remove the last remaining page). The primary page
            // (`pageEl`, where the wizard panel lives) is always just
            // cleared in place, matching the previous single-page behavior.
            if (page !== pageEl && pagesWrapper && pagesWrapper.querySelectorAll('.craftools-page').length > 1) {
              page.remove();
              return;
            }
            page.innerHTML = '';
            page.style.backgroundColor = '#ffffff';
          });

          const bgEl = document.getElementById('page-bg-color') as HTMLInputElement | null;
          if (bgEl) bgEl.value = '#ffffff';

          editor.querySelectorAll<HTMLElement & { deselect?: () => void }>('.craftools-element').forEach(el => {
            el.deselect?.();
          });
          renderPanel();

          const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element: pageEl } });
          pageEl.dispatchEvent(event);
        });
      }

      // ── Bind: Generate ─────────────────────────────────────────────
      const generateBtn = panelBody.querySelector<HTMLButtonElement>('#album-generate-btn');
      if (generateBtn) {
        generateBtn.addEventListener('click', () => {
          if (!selectedTemplate || !selectedSize) return;
          if (selectedMode === 'album') {
            AlbumTool.processAlbum(editor, pageEl, selectedSize, selectedTemplate, photos, smartFit, autoEnhanceAll);
          } else if (cardPhoto) {
            const qty = cardQuantityMode === 'auto'
              ? calcPerPage(selectedTemplate, selectedSize)
              : cardManualQty;
            AlbumTool.processBusinessCard(editor, pageEl, selectedSize, selectedTemplate, cardPhoto, qty, smartFit, autoEnhanceAll);
          }
          if (defaultMenu) defaultMenu.classList.remove('d-none');
          if (panelBody) panelBody.classList.add('d-none');
          if (closePanel) closePanel.classList.add('d-none');
          if (panelTitle) panelTitle.textContent = '';
          if (rightPanel) {
            if (window.innerWidth <= 768) {
              // Mobile: esconde a sidebar (era um modal)
              rightPanel.classList.remove('panel-open');
            } else {
              // Desktop: recolhe para modo somente ícones
              rightPanel.classList.add('sidenav-collapsed');
              (rightPanel as HTMLElement).style.marginLeft = '';
            }
            rightPanel.classList.remove('mobile-modal-mode');
          }
          // Mobile: fecha o overlay ao processar o álbum
          if (window.innerWidth <= 768) {
            const sideOverlay = document.querySelector('.craftools-sidebar-overlay');
            if (sideOverlay) sideOverlay.classList.remove('visible');
            const menuIcon2 = document.getElementById('pwa-menu-icon');
            if (menuIcon2) menuIcon2.textContent = 'menu';
          }
        });
      }

      // ── Bind: Borders ──────────────────────────────────────────────
      if (existingGrid) {
        // Build a fake element seeded with the current grid-cell border so
        // PropertyRenderer can show the right initial values. Uses borderSection()
        // from CommonSchema instead of the legacy CommonProperties.renderBorder().
        const gridCell = pageEl?.querySelector('.craftools-grid-cell') as HTMLElement | null;
        const rawColor = gridCell?.style.borderColor ?? '';
        const initialBorderColor = _rgbToHex(rawColor) || '#000000';
        const fakeEl = document.createElement('div');
        fakeEl.dataset.ctState = JSON.stringify({
          borderWidth: parseFloat(gridCell?.style.borderWidth ?? '0') || 0,
          borderStyle: gridCell?.style.borderStyle || 'none',
          borderColor: initialBorderColor,
        });

        PropertyRenderer.render(panelBody, [borderSection()], fakeEl, (key, value) => {
          PropertyRenderer.applyChange(fakeEl, key, value);
          const s = PropertyRenderer._readState(fakeEl);

          let parsedColor = String(s.borderColor ?? '#000000');
          if (parsedColor.startsWith('{')) {
            try {
              const v = JSON.parse(parsedColor);
              parsedColor = v.solid ?? '#000000';
            } catch {}
          }

          Craftools_LayoutGrid.updateBorders(
            editor,
            s.borderWidth ?? 0,
            s.borderStyle ?? 'none',
            parsedColor,
          );
        });
      }

      // ── Bind: Marcas de Corte (grid-aligned crop marks) ──────────────
      // Every album page (see _findAlbumPages()'s doc comment) gets the
      // SAME config written to its own dataset -- CropMarks config lives
      // per-page, so without this only `pageEl` (the one page the wizard
      // happened to be opened on) would ever show marks, leaving every
      // other page the album spilled onto unmarked.
      const cmEnableBtn = panelBody.querySelector<HTMLButtonElement>('.album-cropmarks-enable-btn');
      if (cmEnableBtn) {
        cmEnableBtn.addEventListener('click', () => {
          AlbumTool._findAlbumPages(editor, pageEl).forEach(page => {
            CropMarks.writeAlbumConfig(page, { enabled: !cmConfig.enabled });
            CropMarks.renderLiveGridOverlay(page);
          });
          renderPanel();
        });
      }

      panelBody.querySelectorAll<HTMLButtonElement>('.album-cropmarks-style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const style = (btn.getAttribute('data-style') as CropMarksStyle) || 'standard';
          AlbumTool._findAlbumPages(editor, pageEl).forEach(page => {
            CropMarks.writeAlbumConfig(page, { style });
            CropMarks.renderLiveGridOverlay(page);
          });
          renderPanel();
        });
      });

      panelBody.querySelectorAll<HTMLButtonElement>('.album-cropmarks-count-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const countAttr = btn.getAttribute('data-count');
          const count = countAttr === '8' ? 8 : countAttr === '6' ? 6 : 4;
          AlbumTool._findAlbumPages(editor, pageEl).forEach(page => {
            CropMarks.writeAlbumConfig(page, { count });
            CropMarks.renderLiveGridOverlay(page);
          });
          renderPanel();
        });
      });

      const cmBleedInput = panelBody.querySelector<HTMLInputElement>('#album-cropmarks-bleed-mm');
      if (cmBleedInput) {
        cmBleedInput.addEventListener('input', e => {
          const bleedMm = parseFloat((e.target as HTMLInputElement).value) || 0;
          AlbumTool._findAlbumPages(editor, pageEl).forEach(page => {
            CropMarks.writeAlbumConfig(page, { bleedMm });
            CropMarks.renderLiveGridOverlay(page);
          });
        });
      }

      // Bind accordion toggles at the very end so dynamic accordions like "Forma" are also bound
      PanelUI.bindAccordions(panelBody);

      // Refresh the on-canvas grid-marks preview every time the panel
      // re-renders (page load, undo/redo restore, right after any of the
      // writeAlbumConfig() calls above, or right after a "Gerar Álbum"/
      // "Gerar Novamente" run that just created new sibling pages) --
      // mirrors PageTool.ts's own CropMarks.renderLiveOverlay() call in
      // attachPageEvents(). Re-propagates `pageEl`'s own config to every
      // sibling album page on EVERY render (not just on an explicit
      // control interaction), so freshly-generated extra pages that never
      // went through the handlers above still end up in sync.
      AlbumTool._findAlbumPages(editor, pageEl).forEach(page => {
        if (page !== pageEl) CropMarks.writeAlbumConfig(page, cmConfig);
        CropMarks.renderLiveGridOverlay(page);
      });
    };

    // ── Open panel immediately (before gridSizes API resolves) ────────────
    if (defaultMenu) defaultMenu.classList.add('d-none');
    if (panelBody) panelBody.classList.remove('d-none');
    if (closePanel) closePanel.classList.remove('d-none');
    if (rightPanel) {
      rightPanel.classList.add('panel-open');
      rightPanel.classList.remove('sidenav-collapsed');
      rightPanel.style.removeProperty('width');
      if (rightPanel.dataset.expandedWidth) rightPanel.style.width = rightPanel.dataset.expandedWidth;
      if (window.innerWidth <= 768) rightPanel.classList.add('mobile-modal-mode');
    }
    const menuIcon = document.getElementById('pwa-menu-icon');
    if (menuIcon && menuIcon.textContent !== 'close') {
      menuIcon.textContent = 'close';
    }
    // Mobile: mostra o overlay para que tocar fora feche o painel
    if (window.innerWidth <= 768) {
      const sideOverlay = document.querySelector('.craftools-sidebar-overlay');
      if (sideOverlay) sideOverlay.classList.add('visible');
    }

    // Render initial panel (gridSizes still empty → template list shows loading spinner)
    renderPanel();

    // Load grid sizes in the background — re-render once ready, non-blocking
    loadGridSizes().then((sizes) => {
      gridSizes = sizes as unknown as AlbumTemplate[];
      renderPanel();
    });
  }

  // ── Marcas de Corte tab -- style pill options (reuses PageTool.ts's own
  // pageTool.cropMarksStyle* i18n keys since the copy is identical; only
  // the enable/hint copy below is Album-specific, under the albumTool
  // namespace). ──────────────────────────────────────────────────────────
  private static readonly _CROP_MARKS_STYLES: Array<{ value: CropMarksStyle; labelKey: string }> = [
    { value: 'standard', labelKey: 'cropMarksStyleStandard' },
    { value: 'cross',    labelKey: 'cropMarksStyleCross' },
    { value: 'circle',   labelKey: 'cropMarksStyleCircle' },
  ];

  /**
   * A multi-photo album that doesn't fit on one page spills onto extra
   * pages via `Craftools_LayoutGrid.render()` (utils/LayoutGrid.ts), which
   * calls `PageTool.addNewPage()` and tags EVERY page it fills (including
   * the first) with a `.craftools-grid-container[data-grid-source="album"]`
   * marker. `pageEl` is only ever the ONE page the wizard panel happens to
   * be open on -- anything scoped to just `pageEl` (crop-marks config, the
   * old "Apagar Álbum" behavior before it was fixed the same way) silently
   * misses every other page the same album spans. Finds all of them.
   *
   * Caveat (pre-existing, not introduced here): the marker isn't scoped to
   * a single "Generate Album" run, so two independent albums coexisting in
   * the same document would both match here. Matches the existing
   * `#album-clear-btn` handler's own tradeoff.
   */
  private static _findAlbumPages(editor: HTMLElement, pageEl: HTMLElement): HTMLElement[] {
    const pagesWrapper = editor.querySelector<HTMLElement>('#pages-wrapper');
    if (!pagesWrapper) return [pageEl];
    return [...pagesWrapper.querySelectorAll<HTMLElement>('.craftools-page')]
      .filter(p => p === pageEl || p.querySelector('.craftools-grid-container[data-grid-source="album"]'));
  }

  // ── Helpers: build a locked ImageTool element for a grid cell ────────────
  static _buildCellElement(editor: HTMLElement, src: string, pl: number, pt: number, cw: number, ch: number, unit = 'px', autoEnhance = false): HTMLElement {
    const imgEl = ImageTool.createElement('image', editor) as HTMLElement & {
      _craftoolsMeta: Record<string, unknown>;
    };
    imgEl.setAttribute('x', pl + unit);
    imgEl.setAttribute('y', pt + unit);
    imgEl.setAttribute('w', String(cw) + unit);
    imgEl.setAttribute('h', String(ch) + unit);
    imgEl.setAttribute('data-locked', 'true');

    imgEl._craftoolsMeta.bgBlur = 30; // Ativa por padrão no álbum
    imgEl._craftoolsMeta.src = src;
    imgEl._craftoolsMeta.originalSrc = src;

    const imgTag = imgEl.querySelector<HTMLImageElement>('img');
    if (imgTag) imgTag.src = src;

    if (autoEnhance) {
      ImageTool._applyProperty(imgEl, 'autoEnhance', true);
    }

    return imgEl;
  }

  static _cellDimensions(template: AlbumTemplate, _pageSize: PageSize) {
    const p = template.cellPadding.split(' ');
    const pt = parseFloat(p[0]);
    const pr = parseFloat(p[1]);
    const pb = parseFloat(p[2]);
    const pl = parseFloat(p[3]);
    const isStripe = !!(template.cellLines || template.cellColumns);
    const sLines = template.cellLines || 1;
    const sCols = template.cellColumns || 1;
    // For photostrips, each slot is a subdivision of the stripe's inner area
    const innerW = template.cellWidth - pl - pr;
    const innerH = template.cellHeight - pt - pb;
    return {
      pt: isStripe ? 0 : pt,
      pr: isStripe ? 0 : pr,
      pb: isStripe ? 0 : pb,
      pl: isStripe ? 0 : pl,
      cw: isStripe ? innerW / sCols : innerW,
      ch: isStripe ? innerH / sLines : innerH,
      isStripe,
    };
  }

  // ── Mode 1: Álbum de fotos ────────────────────────────────────────────────
  static async processAlbum(
    editor: HTMLElement,
    startPage: HTMLElement,
    pageSize: PageSize,
    template: AlbumTemplate,
    files: File[],
    smartFit = false,
    autoEnhanceAll = false,
  ): Promise<void> {
    const images: PhotoImageData[] = await Promise.all(files.map(f => new Promise<PhotoImageData>(resolve => {
      const fr = new FileReader();
      fr.onload = e => {
        const img = new Image();
        img.onload = () => resolve({ src: e.target?.result as string, w: img.width, h: img.height });
        img.src = e.target?.result as string;
      };
      fr.readAsDataURL(f);
    })));

    const gridSystem = new Craftools_LayoutGrid(editor, startPage, pageSize, template);
    const unit = pageSize.sizeUnit || 'px';

    await gridSystem.render(images, (cellContainer: HTMLElement, imgData: PhotoImageData, _idx: number, slotOverride?: AlbumTemplate) => {
      cellContainer.style.background = 'white';

      const activeSlot = slotOverride || template;
      const { pt, pl, cw, ch } = AlbumTool._cellDimensions(activeSlot, pageSize);

      // In photostrip mode, the slot fills the entire container (no padding offset)
      // because the inner-grid already handles the stripe-level padding positioning.
      const imgEl = AlbumTool._buildCellElement(editor, imgData.src, pl, pt, cw, ch, unit, autoEnhanceAll) as HTMLElement & {
        _craftoolsMeta: Record<string, unknown>;
      };

      if (smartFit) {
        const slotAspect = cw / ch;
        const imgAspect = imgData.w / imgData.h;

        // Rotaciona se o slot for retrato (<1) e a foto for paisagem (>1), ou vice-versa
        if ((slotAspect > 1 && imgAspect < 1) || (slotAspect < 1 && imgAspect > 1)) {
          imgEl._craftoolsMeta.rotation = 90;
          imgEl._craftoolsMeta.objectFit = 'contain';

          const sContain = Math.min(cw / imgData.w, ch / imgData.h);
          const rW = imgData.w * sContain;
          const rH = imgData.h * sContain;
          const zoom = Math.max(cw / rH, ch / rW);

          imgEl._craftoolsMeta.zoom = parseFloat(zoom.toFixed(2));

          const imgTag = imgEl.querySelector<HTMLImageElement>('img');
          if (imgTag) imgTag.style.objectFit = 'contain';
        }
      }

      cellContainer.appendChild(imgEl);
    });

    // Wire os botões de editar cell
    AlbumTool._bindCellEditButtons(editor);
  }

  // ── Mode 2: Cartão de visita ──────────────────────────────────────────────
  static async processBusinessCard(
    editor: HTMLElement,
    startPage: HTMLElement,
    pageSize: PageSize,
    template: AlbumTemplate,
    file: File,
    quantity: number,
    smartFit = false,
    autoEnhanceAll = false,
  ): Promise<void> {
    const imgData: PhotoImageData = await new Promise(resolve => {
      const fr = new FileReader();
      fr.onload = e => {
        const img = new Image();
        img.onload = () => resolve({ src: e.target?.result as string, w: img.width, h: img.height });
        img.src = e.target?.result as string;
      };
      fr.readAsDataURL(file);
    });

    // Único objeto meta compartilhado entre todos os cartões
    const sharedMeta = ImageTool.getDefaultMeta() as Record<string, unknown>;
    sharedMeta.src = imgData.src;

    const allElements: Array<HTMLElement & { _linkedElements?: HTMLElement[] }> = [];
    const items = Array(quantity).fill(imgData);

    const gridSystem = new Craftools_LayoutGrid(editor, startPage, pageSize, template);
    const unit = pageSize.sizeUnit || 'px';

    await gridSystem.render(items, (cellContainer: HTMLElement, cardImgData: PhotoImageData, _idx: number, slotOverride?: AlbumTemplate) => {
      const grid = cellContainer.closest<HTMLElement>('.craftools-grid-container');
      if (grid) grid.dataset.gridMode = 'card';

      cellContainer.style.background = 'white';

      const activeSlot = slotOverride || template;
      const { pt, pl, cw, ch } = AlbumTool._cellDimensions(activeSlot, pageSize);

      const imgEl = ImageTool.createElement('image', editor) as HTMLElement & {
        _craftoolsMeta: Record<string, unknown>;
        _linkedElements?: HTMLElement[];
      };
      imgEl.setAttribute('x', pl + unit);
      imgEl.setAttribute('y', pt + unit);
      imgEl.setAttribute('w', String(cw) + unit);
      imgEl.setAttribute('h', String(ch) + unit);
      imgEl.setAttribute('data-locked', 'true');

      // Camada de fundo desfocada interna
      sharedMeta.bgBlur = 30;

      if (smartFit) {
        const slotAspect = cw / ch;
        const imgAspect = cardImgData.w / cardImgData.h;

        if ((slotAspect > 1 && imgAspect < 1) || (slotAspect < 1 && imgAspect > 1)) {
          sharedMeta.rotation = 90;
          sharedMeta.objectFit = 'contain';

          const sContain = Math.min(cw / cardImgData.w, ch / cardImgData.h);
          const rW = cardImgData.w * sContain;
          const rH = cardImgData.h * sContain;
          const zoom = Math.max(cw / rH, ch / rW);

          sharedMeta.zoom = parseFloat(zoom.toFixed(2));
        }
      }

      // Compartilha o mesmo meta — zoom/pan/filtros ficam sincronizados
      imgEl._craftoolsMeta = sharedMeta;

      const imgTag = imgEl.querySelector<HTMLImageElement>('img');
      if (imgTag) {
        imgTag.src = cardImgData.src;
        if (smartFit && sharedMeta.objectFit === 'contain') {
          imgTag.style.objectFit = 'contain';
        }
      }

      if (autoEnhanceAll) {
        ImageTool._applyProperty(imgEl, 'autoEnhance', true);
      }

      allElements.push(imgEl);
      cellContainer.appendChild(imgEl);
    });

    // Liga todos os elementos entre si
    allElements.forEach(el => { el._linkedElements = allElements; });

    // Wire os botões de editar cell
    AlbumTool._bindCellEditButtons(editor);
  }

  /**
   * Conecta os botões .cell-edit-btn à seleção do elemento de imagem da célula.
   * Isso faz com que as propriedades da célula abram na barra lateral de propriedades da imagem.
   */
  static _bindCellEditButtons(editor: HTMLElement): void {
    editor.querySelectorAll<HTMLElement>('.cell-edit-btn').forEach(btn => {
      // Remove listener antigo se houver (re-geração)
      const newBtn = btn.cloneNode(true) as HTMLElement;
      btn.parentNode?.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cellEl = newBtn.closest<HTMLElement>('.craftools-grid-cell');
        if (cellEl) {
          const imgEl = cellEl.querySelector<HTMLElement & { select?: () => void }>('craftools-element[data-craftool="image"]');
          if (imgEl) {
            imgEl.select?.();
          } else {
            // Caso a célula não tenha imagem por algum motivo, abre as propriedades da célula legada
            CellPanel.open(editor, cellEl);
          }
        }
      });
    });
  }
}
