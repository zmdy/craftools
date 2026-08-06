/**
 * GeneratorTool.ts
 *
 * "Generator" panel — a custom grid-template builder. Takes over the entire
 * side panel (like CalendarTool / AgendaExportTool) and lets the user design
 * a reusable album-page template (grid / strip / promo-kit layout), preview
 * it live on the main page as an SVG mockup, and save it to
 * `UserTemplates` (localStorage) so it shows up alongside the built-in
 * `GridSizes` templates when using the Album wizard.
 *
 * Recovered from the pre-migration GeneratorTool.js (deleted by the "Purge
 * legacy JS" commit without this logic being ported) -- the previous
 * GeneratorTool.ts was a ToolRegistry.register()-only stub with no setup()
 * at all, so clicking the sidebar button threw
 * "Cannot read properties of undefined (reading 'bind')" in Editor.ts's
 * PANEL_SETUP_MAP.
 */
import { I18n } from '../../settings/Translations.js';
import { PanelUI } from '../../utils/PanelUI';
import { AlbumPreviewSVG } from '../../utils/AlbumPreviewSVG';
import { UserTemplates } from '../../utils/UserTemplates';
import { getEffectiveDimensions, type GridTemplate, type GridTemplateSlot, type Orientation } from '../../utils/GridSizes.js';
import { ToolRegistry } from '../../utils/ToolRegistry';
import './GeneratorTool_Translations.js';

const g = (key: string): string => I18n.t('generatorTool.' + key);

interface MarginObj {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ── Margin helpers ──────────────────────────────────────────────────────
const parseMarginStr = (s?: string): MarginObj => {
  const parts = String(s || '0 0 0 0').trim().split(/\s+/).map(Number);
  const [t = 0, r, b, l] = parts;
  return {
    top:    t,
    right:  r !== undefined ? r : t,
    bottom: b !== undefined ? b : t,
    left:   l !== undefined ? l : (r !== undefined ? r : t),
  };
};
const marginToStr = (m: MarginObj): string => `${m.top} ${m.right} ${m.bottom} ${m.left}`;
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ── Auto-center helpers ─────────────────────────────────────────────────
// Computes the "natural" size that the content (grid or kit) occupies when
// fit into as many cells/blocks as possible, ignoring margins -- used to
// auto-center the page (symmetric margins).
const computeGridContentBounds = (
  cellWidth: number | string, cellHeight: number | string, cellGap: number | string,
  docW: number, docH: number,
): { width: number; height: number } => {
  const gap = parseFloat(String(cellGap)) || 0;
  const cW  = parseFloat(String(cellWidth))  || 1;
  const cH  = parseFloat(String(cellHeight)) || 1;
  const cols = Math.max(1, Math.floor((docW + gap) / (cW + gap)));
  const rows = Math.max(1, Math.floor((docH + gap) / (cH + gap)));
  return {
    width:  cols * cW + (cols > 1 ? (cols - 1) * gap : 0),
    height: rows * cH + (rows > 1 ? (rows - 1) * gap : 0),
  };
};

const computePromoContentBounds = (
  promoSlots: PromoSlotState[], kitGap: number | string, docW: number,
): { width: number; height: number } => {
  const gap = parseFloat(String(kitGap)) || 0;
  let curX = 0, curY = 0, shelfH = 0, maxRowWidth = 0;

  (promoSlots || []).forEach(slot => {
    const slotGap = slot.cellGap !== undefined ? (parseFloat(String(slot.cellGap)) || 0) : gap;
    const cW = parseFloat(String(slot.cellWidth))  || 1;
    const cH = parseFloat(String(slot.cellHeight)) || 1;
    let cols: number, rows: number;
    if (slot.slotColumns && slot.slotLines) {
      cols = Number(slot.slotColumns);
      rows = Number(slot.slotLines);
    } else {
      const Kmax = Math.floor((docW + slotGap) / (cW + slotGap)) || 1;
      cols = Math.min(Number(slot.cellCount) || 1, Kmax);
      rows = Math.ceil((Number(slot.cellCount) || 1) / cols);
    }
    const blockW = cols * cW + (cols > 1 ? (cols - 1) * slotGap : 0);
    const blockH = rows * cH + (rows > 1 ? (rows - 1) * slotGap : 0);

    if (curX + blockW > docW && curX > 0) {
      maxRowWidth = Math.max(maxRowWidth, curX - gap);
      curX = 0; curY += shelfH + gap; shelfH = 0;
    }
    curX += blockW + gap;
    shelfH = Math.max(shelfH, blockH);
  });
  maxRowWidth = Math.max(maxRowWidth, curX - gap);

  return {
    width:  Math.max(0, maxRowWidth),
    height: Math.max(0, curY + shelfH),
  };
};

interface SizeOption {
  name: string;
  size: string;
  sizeUnit: string;
}

// Standard page sizes always available in the builder
const STANDARD_SIZES: SizeOption[] = [
  { name: 'A4',            size: '210,297', sizeUnit: 'mm' },
  { name: 'A5',            size: '148,210', sizeUnit: 'mm' },
  { name: 'A6',            size: '105,148', sizeUnit: 'mm' },
  { name: 'A3',            size: '297,420', sizeUnit: 'mm' },
  { name: '10×15',         size: '100,150', sizeUnit: 'mm' },
  { name: '15×21',         size: '150,210', sizeUnit: 'mm' },
  { name: '20×30',         size: '200,300', sizeUnit: 'mm' },
  { name: '30×40',         size: '300,400', sizeUnit: 'mm' },
  { name: 'Personalizado', size: 'custom',  sizeUnit: 'mm' },
];

const MAX_PROMO_SLOTS = 6;

type LayoutType = 'grid' | 'strip' | 'promo';

interface CfgState {
  cellWidth: number | string;
  cellHeight: number | string;
  cellGap: number | string;
  cellPadding: MarginObj;
  pageMargin: MarginObj;
  cellLines: number | string;
  cellColumns: number | string;
  autoCenter: boolean;
}

interface PromoSlotState {
  cellWidth: number | string;
  cellHeight: number | string;
  cellCount: number | string;
  cellPadding: MarginObj;
  cellGap: number | string;
  slotLines: number | string;
  slotColumns: number | string;
}

// Ad hoc global set elsewhere in the app (Settings.js / index.html inline
// scripts) -- same pragmatic `window as any` pattern AlbumWizard.ts and
// Editor.ts already use for craftoolsSize/craftoolsApp.
type CraftoolsWindow = typeof window & {
  craftoolsApp?: { activeMedia?: { sizes?: SizeOption[] } };
};

export class GeneratorTool {

  public static pendingTemplateToLoad: GridTemplate | null = null;

  public static loadTemplateForEdit(template: GridTemplate): void {
    GeneratorTool.pendingTemplateToLoad = template;
    const btn = document.querySelector('[data-tool="generator"]') as HTMLElement | null;
    if (btn) {
      btn.click();
    }
  }

  public static setup(editor: HTMLElement): void {
    const panelTitle = document.getElementById('panel-title');
    const panelBody  = document.getElementById('panel-body');

    if (panelTitle) panelTitle.textContent = g('panelTitle');
    if (!panelBody) return;

    // ── State ──────────────────────────────────────────────────────────
    let editingId: string | null = null;
    let name = '';
    let selectedSize: SizeOption | null = null;
    let orientation: Orientation = 'portrait';
    let customWidth = 210;
    let customHeight = 297;
    let layoutType: LayoutType = 'grid';

    // Grid / Strip state -- margins stored as MarginObj
    let cfg: CfgState = {
      cellWidth:   60,
      cellHeight:  85,
      cellGap:     2,
      cellPadding: { top: 3,  right: 3,  bottom: 20, left: 3 },
      pageMargin:  { top: 5,  right: 5,  bottom: 5,  left: 5 },
      cellLines:   0,
      cellColumns: 0,
      autoCenter:  false,
    };

    // Promo Kit state -- cellPadding also as MarginObj
    let promoSlots: PromoSlotState[] = [
      { cellWidth: 80, cellHeight: 105, cellCount: 2, cellPadding: { top: 3, right: 3, bottom: 20, left: 3 }, cellGap: 2, slotLines: 0, slotColumns: 0 },
    ];

    // Merge standard sizes with active config sizes
    const win = window as CraftoolsWindow;
    const activeSizes = (win.craftoolsApp?.activeMedia?.sizes || []).filter(s => s.size !== '*');
    const existingKeys = new Set(activeSizes.map(s => s.size));
    const allSizes: SizeOption[] = [
      ...activeSizes,
      ...STANDARD_SIZES.filter(s => !existingKeys.has(s.size)),
    ];
    if (allSizes.length > 0) selectedSize = allSizes[0];

    // ── Build config from template (for edit mode) ─────────────────────
    const loadTemplate = (t: GridTemplate): void => {
      editingId = t._id || null;
      name      = t.name || '';
      const matchedSize = allSizes.find(s => (t.sizes || []).includes(s.size));
      if (matchedSize) selectedSize = matchedSize;

      if (t.type === 'promo_kit') {
        layoutType = 'promo';
        promoSlots = (t.cellSlots || []).map(s => ({
          cellWidth:   s.cellWidth,
          cellHeight:  s.cellHeight,
          cellCount:   s.cellCount,
          cellGap:     s.cellGap ?? 0,
          slotLines:   s.slotLines ?? 0,
          slotColumns: s.slotColumns ?? 0,
          cellPadding: parseMarginStr(s.cellPadding),
        }));
        cfg = {
          ...cfg,
          pageMargin: parseMarginStr(t.pageMargin ?? '5 5 5 5'),
          autoCenter: !!t.autoCenterMargin,
        };
      } else if (t.cellLines || t.cellColumns) {
        layoutType = 'strip';
        cfg = {
          cellWidth:   t.cellWidth   ?? 60,
          cellHeight:  t.cellHeight  ?? 85,
          cellGap:     t.cellGap     ?? 2,
          cellPadding: parseMarginStr(t.cellPadding ?? '3 3 3 3'),
          pageMargin:  parseMarginStr(t.pageMargin  ?? '5 5 5 5'),
          cellLines:   t.cellLines   ?? 2,
          cellColumns: t.cellColumns ?? 1,
          autoCenter:  !!t.autoCenterMargin,
        };
      } else {
        layoutType = 'grid';
        cfg = {
          cellWidth:   t.cellWidth   ?? 60,
          cellHeight:  t.cellHeight  ?? 85,
          cellGap:     t.cellGap     ?? 2,
          cellPadding: parseMarginStr(t.cellPadding ?? '3 3 20 3'),
          pageMargin:  parseMarginStr(t.pageMargin  ?? '5 5 5 5'),
          cellLines:   0,
          cellColumns: 0,
          autoCenter:  !!t.autoCenterMargin,
        };
      }
    };

    // Check if a template was requested for editing from AlbumWizard or elsewhere
    if (GeneratorTool.pendingTemplateToLoad) {
      const templateToEdit = GeneratorTool.pendingTemplateToLoad;
      GeneratorTool.pendingTemplateToLoad = null;

      loadTemplate(templateToEdit);

      // If user-created (_source === 'user' with _id), preserve editingId so save updates it.
      // If built-in JS or API template, clear editingId so saving creates a NEW user template.
      if (templateToEdit._source === 'user' && templateToEdit._id) {
        editingId = templateToEdit._id;
      } else {
        editingId = null;
      }
    }

    // ── Template object builder ────────────────────────────────────────
    const buildTemplateObject = (): GridTemplate => {
      const sizeStr = selectedSize?.size === 'custom'
        ? `${customWidth},${customHeight}`
        : (selectedSize?.size || '210,297');

      const base = {
        name,
        sizes: [sizeStr],
        allowedOrientations: [orientation],
        pageMargin: marginToStr(cfg.pageMargin),
        cellGap:    parseFloat(String(cfg.cellGap)) || 0,
        autoCenterMargin: !!cfg.autoCenter,
      };

      if (layoutType === 'promo') {
        const cellSlots: GridTemplateSlot[] = promoSlots.map(s => ({
          cellWidth:   parseFloat(String(s.cellWidth))  || 0,
          cellHeight:  parseFloat(String(s.cellHeight)) || 0,
          cellCount:   parseInt(String(s.cellCount), 10)    || 1,
          cellPadding: marginToStr(s.cellPadding),
          cellGap:     parseFloat(String(s.cellGap))    || 0,
          ...(s.slotLines   ? { slotLines:   parseInt(String(s.slotLines), 10)   } : {}),
          ...(s.slotColumns ? { slotColumns: parseInt(String(s.slotColumns), 10) } : {}),
        }));
        return {
          ...base,
          type:        'promo_kit',
          cellWidth:   0,
          cellHeight:  0,
          cellPadding: '0 0 0 0',
          cellSlots,
        };
      }

      const obj: GridTemplate = {
        ...base,
        cellWidth:   parseFloat(String(cfg.cellWidth))  || 60,
        cellHeight:  parseFloat(String(cfg.cellHeight)) || 85,
        cellPadding: marginToStr(cfg.cellPadding),
      };

      if (layoutType === 'strip') {
        obj.cellLines   = parseInt(String(cfg.cellLines), 10)   || 1;
        obj.cellColumns = parseInt(String(cfg.cellColumns), 10) || 1;
      }

      return obj;
    };

    // ── Live preview SVG on Page Canvas ─────────────────────────────────
    const renderPreview = (): void => {
      const canvasArea   = document.getElementById('canvas-area');
      const pagesWrapper = document.getElementById('pages-wrapper');
      const mainPage     = document.getElementById('main-page') as HTMLElement | null;
      if (!canvasArea || !mainPage) return;

      // Make sure pages wrapper is visible so the page sheet is shown
      if (pagesWrapper) (pagesWrapper as HTMLElement).style.display = '';

      // Handle floating preview badge in canvasArea (outside the page)
      let badge = document.getElementById('generator-canvas-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'generator-canvas-badge';
        badge.style.cssText = `
          position: absolute;
          top: 20px;
          left: 20px;
          background: #f97316;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 30px;
          z-index: 100;
          box-shadow: 0 4px 12px rgba(249,115,22,0.3);
          display: flex;
          align-items: center;
          gap: 6px;
          pointer-events: none;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          animation: pageIn 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        `;
        badge.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: 15px;">visibility</span>
          ${g('previewBadge')}
        `;
        canvasArea.appendChild(badge);
      }

      if (!selectedSize) {
        mainPage.innerHTML = '';
        return;
      }

      let baseW = 210;
      let baseH = 297;
      if (selectedSize.size === 'custom') {
        baseW = customWidth || 210;
        baseH = customHeight || 297;
      } else {
        const parts = String(selectedSize.size || '210,297').split(',').map(Number);
        baseW = parts[0] || 210;
        baseH = parts[1] || 297;
      }

      const { docW, docH } = getEffectiveDimensions(baseW, baseH, orientation);
      const unit = selectedSize.sizeUnit || 'mm';

      // Resize the actual canvas page to reflect the selected size and orientation
      mainPage.style.width = docW + unit;
      mainPage.style.height = docH + unit;
      mainPage.style.minHeight = docH + unit;

      if (cfg.autoCenter) {
        const bounds = layoutType === 'promo'
          ? computePromoContentBounds(promoSlots, cfg.cellGap, docW)
          : computeGridContentBounds(cfg.cellWidth, cfg.cellHeight, cfg.cellGap, docW, docH);
        const mLR = Math.max(0, round2((docW - bounds.width)  / 2));
        const mTB = Math.max(0, round2((docH - bounds.height) / 2));
        cfg.pageMargin = { top: mTB, right: mLR, bottom: mTB, left: mLR };

        // Reflect the recalculated values into the (readonly) margin fields
        // immediately, without a full panel re-render -- so the user sees
        // the margin adjust in real time as they change the cell/gap/page
        // size, even without re-rendering the field they're currently
        // editing (avoids losing input focus).
        const root = panelBody.querySelector('#generator-root');
        if (root) {
          root.querySelectorAll<HTMLInputElement>('.margin-part-input[data-prefix="cfg-pageMargin"]').forEach(el => {
            const side = el.dataset.side as keyof MarginObj | undefined;
            if (side && cfg.pageMargin[side] !== undefined) {
              el.value = String(cfg.pageMargin[side]);
            }
          });
        }
      }

      const tmpl = buildTemplateObject();
      const svgHtml = AlbumPreviewSVG.build(tmpl, selectedSize, { maxW: 2000, maxH: 2000 });
      mainPage.innerHTML = svgHtml;

      const svgEl = mainPage.querySelector<SVGElement>('svg');
      if (svgEl) {
        svgEl.style.border = 'none';
        svgEl.style.boxShadow = 'none';
        svgEl.style.borderRadius = '0';
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.style.maxWidth = '100%';
        svgEl.style.maxHeight = '100%';
        svgEl.style.margin = '0';
        svgEl.style.display = 'block';
      }
    };

    // ── Saved templates list HTML ───────────────────────────────────────
    const buildSavedListHtml = (): string => {
      const saved = UserTemplates.load();
      if (saved.length === 0) {
        return `<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:10px 0;">${g('noSaved')}</div>`;
      }
      return saved.map(t => `
        <div class="generator-saved-row" data-id="${t._id}" style="
          display:flex; align-items:center; gap:8px; padding:8px 10px;
          border-radius:7px; background:var(--bg-input,#1e1e2e);
          border:1px solid var(--border,#374151); margin-bottom:6px;
        ">
          <span style="
            font-size:10px; font-weight:700; color:#fff;
            background:#f97316; padding:2px 7px; border-radius:8px; flex-shrink:0;
          ">${g('badgeUser')}</span>
          <span style="flex:1; font-size:12px; font-weight:600; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.name || '—'}</span>
          <span style="font-size:10px; color:var(--text-muted); flex-shrink:0;">${(t.sizes || [])[0] || ''}</span>
          <button class="generator-edit-btn craftools-topbtn" data-id="${t._id}" style="padding:3px 8px; font-size:10px; gap:4px;">
            <span class="material-symbols-outlined" style="font-size:13px;">edit</span>${g('editBtn')}
          </button>
          <button class="generator-del-btn craftools-topbtn" data-id="${t._id}" style="padding:3px 8px; font-size:10px; gap:4px; background:rgba(239,68,68,0.15); color:#f87171; border-color:rgba(239,68,68,0.3);">
            <span class="material-symbols-outlined" style="font-size:13px;">delete</span>
          </button>
        </div>
      `).join('');
    };

    // ── Config section HTML ──────────────────────────────────────────────
    const buildConfigHtml = (): string => {
      const numInput = (id: string, label: string, value: number | string, min = 0, max = 999, step = 0.5): string =>
        `<div class="craftools-field" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <label style="font-size:11px; color:var(--text-secondary); flex:1;">${label}</label>
          <input type="number" id="${id}" class="craftools-input" value="${value}" min="${min}" max="${max}" step="${step}"
            style="width:72px; text-align:right; padding:4px 6px;">
        </div>`;

      // Renders 4 individual number inputs (T/R/B/L) for margin/padding fields.
      // When `autoCenterToggle` is true, also renders the "Auto-center"
      // switch above the inputs; while active, the inputs become readonly
      // (margins are computed, not manually editable).
      const marginInputGroup = (idPrefix: string, label: string, value: MarginObj, opts: { autoCenterToggle?: boolean } = {}): string => {
        const { autoCenterToggle = false } = opts;
        const isAuto = autoCenterToggle && !!cfg.autoCenter;
        const toggleHtml = autoCenterToggle ? `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span class="craftools-label" style="margin:0; font-size:11px; color:var(--text-secondary);">${g('autoCenterLabel')}</span>
            <button type="button" class="craftools-pill generator-autocenter-btn ${isAuto ? 'active' : ''}" style="display:flex; align-items:center; gap:4px;">
              <span class="material-symbols-outlined" style="font-size:14px;">center_focus_strong</span>
              ${isAuto ? g('enabled') : g('disabled')}
            </button>
          </div>` : '';
        return `<div class="craftools-field" style="margin-bottom:10px;">
          <label style="font-size:11px; color:var(--text-secondary); display:block; margin-bottom:5px;">${label}</label>
          ${toggleHtml}
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">
            ${(['top', 'right', 'bottom', 'left'] as const).map(side => `
            <div style="display:flex; flex-direction:column; gap:2px;">
              <label style="font-size:9px; color:var(--text-muted); text-align:center; text-transform:uppercase; letter-spacing:.5px;">${g('margin' + side.charAt(0).toUpperCase() + side.slice(1))}</label>
              <input type="number" class="craftools-input margin-part-input" data-prefix="${idPrefix}" data-side="${side}"
                value="${value[side]}" min="0" max="200" step="0.5" ${isAuto ? 'readonly' : ''}
                style="padding:4px; text-align:center; width:100%; ${isAuto ? 'opacity:.6; cursor:not-allowed; background:var(--bg-disabled,var(--bg-input,#27272a));' : ''}">
            </div>`).join('')}
          </div>
        </div>`;
      };

      // Same but for promo slot cellPadding
      const slotMarginGroup = (slotIdx: number, label: string, value: MarginObj): string =>
        `<div style="margin-top:6px;">
          <label style="font-size:10px; color:var(--text-muted); display:block; margin-bottom:3px;">${label}</label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
            ${(['top', 'right', 'bottom', 'left'] as const).map(side => `
            <div style="display:flex; flex-direction:column; gap:2px;">
              <label style="font-size:9px; color:var(--text-muted); text-align:center; text-transform:uppercase; letter-spacing:.5px;">${g('margin' + side.charAt(0).toUpperCase() + side.slice(1))}</label>
              <input type="number" class="craftools-input slot-margin-field" data-slot="${slotIdx}" data-side="${side}"
                value="${value[side]}" min="0" max="200" step="0.5"
                style="padding:4px; text-align:center; width:100%;">
            </div>`).join('')}
          </div>
        </div>`;

      if (layoutType === 'promo') {
        const slotsHtml = promoSlots.map((slot, i) => `
          <div class="generator-promo-slot" data-slot="${i}" style="
            background:var(--bg-input,#1e1e2e); border:1px solid var(--border,#374151);
            border-radius:8px; padding:10px; margin-bottom:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <span style="font-size:11px; font-weight:600; color:var(--text-secondary);">Slot ${i + 1}</span>
              ${promoSlots.length > 1 ? `<button class="generator-remove-slot craftools-topbtn" data-slot="${i}" style="padding:2px 7px; font-size:10px; color:#f87171; background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.3);">
                <span class="material-symbols-outlined" style="font-size:12px;">remove</span>${g('removeSlot')}
              </button>` : ''}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px;">
              <div>
                <label style="font-size:10px; color:var(--text-muted);">${g('slotWidth')}</label>
                <input type="number" class="craftools-input slot-field" data-slot="${i}" data-field="cellWidth"
                  value="${slot.cellWidth}" min="5" max="500" step="0.5" style="width:100%; padding:4px; margin-top:2px;">
              </div>
              <div>
                <label style="font-size:10px; color:var(--text-muted);">${g('slotHeight')}</label>
                <input type="number" class="craftools-input slot-field" data-slot="${i}" data-field="cellHeight"
                  value="${slot.cellHeight}" min="5" max="500" step="0.5" style="width:100%; padding:4px; margin-top:2px;">
              </div>
              <div>
                <label style="font-size:10px; color:var(--text-muted);">${g('slotCount')}</label>
                <input type="number" class="craftools-input slot-field" data-slot="${i}" data-field="cellCount"
                  value="${slot.cellCount}" min="1" max="50" step="1" style="width:100%; padding:4px; margin-top:2px;">
              </div>
              <div>
                <label style="font-size:10px; color:var(--text-muted);">${g('slotGap')}</label>
                <input type="number" class="craftools-input slot-field" data-slot="${i}" data-field="cellGap"
                  value="${slot.cellGap}" min="0" max="30" step="0.5" style="width:100%; padding:4px; margin-top:2px;">
              </div>
              <div>
                <label style="font-size:10px; color:var(--text-muted);">${g('slotRows')}</label>
                <input type="number" class="craftools-input slot-field" data-slot="${i}" data-field="slotLines"
                  value="${slot.slotLines || 0}" min="0" max="20" step="1" style="width:100%; padding:4px; margin-top:2px;" title="0 = sem subdivisão">
              </div>
              <div>
                <label style="font-size:10px; color:var(--text-muted);">${g('slotCols')}</label>
                <input type="number" class="craftools-input slot-field" data-slot="${i}" data-field="slotColumns"
                  value="${slot.slotColumns || 0}" min="0" max="20" step="1" style="width:100%; padding:4px; margin-top:2px;" title="0 = sem subdivisão">
              </div>
            </div>
            ${slotMarginGroup(i, g('slotPaddingLabel'), slot.cellPadding)}
          </div>
        `).join('');

        const canAddSlot = promoSlots.length < MAX_PROMO_SLOTS;

        return `
          <div id="generator-promo-slots">${slotsHtml}</div>
          ${canAddSlot ? `<button id="generator-add-slot" class="craftools-topbtn" style="width:100%; justify-content:center; margin-bottom:8px;">
            <span class="material-symbols-outlined" style="font-size:14px;">add</span>${g('addSlot')}
          </button>` : ''}
          ${marginInputGroup('cfg-pageMargin', g('pageMarginLabel'), cfg.pageMargin, { autoCenterToggle: true })}
          ${numInput('cfg-cellGap', g('cellGap') + ' (kit)', cfg.cellGap, 0, 30, 0.5)}
        `;
      }

      let html = `
        ${numInput('cfg-cellWidth',  g('cellWidth'),  cfg.cellWidth,  5, 500, 0.5)}
        ${numInput('cfg-cellHeight', g('cellHeight'), cfg.cellHeight, 5, 500, 0.5)}
        ${numInput('cfg-cellGap',    g('cellGap'),    cfg.cellGap,    0, 30,  0.5)}
        ${marginInputGroup('cfg-cellPadding', g('cellPaddingLabel'), cfg.cellPadding)}
        ${marginInputGroup('cfg-pageMargin',  g('pageMarginLabel'),  cfg.pageMargin, { autoCenterToggle: true })}
      `;

      if (layoutType === 'strip') {
        html += `
          <div style="height:1px; background:var(--border,#374151); margin:10px 0;"></div>
          ${numInput('cfg-cellLines',   g('stripLines'), cfg.cellLines   || 2, 1, 20, 1)}
          ${numInput('cfg-cellColumns', g('stripCols'),  cfg.cellColumns || 1, 1, 20, 1)}
        `;
      }

      return html;
    };

    // ── Full panel HTML ─────────────────────────────────────────────────
    const renderPanel = (): void => {
      const sizePills = allSizes.map((s, i) =>
        `<button class="craftools-pill generator-size-btn ${selectedSize === s ? 'active' : ''}" data-idx="${i}">${s.name}</button>`,
      ).join('');

      const typeCards = ([
        { type: 'grid',  icon: 'grid_view',    label: g('typeGrid')  },
        { type: 'strip', icon: 'view_column',  label: g('typeStrip') },
        { type: 'promo', icon: 'dashboard',    label: g('typePromo') },
      ] as Array<{ type: LayoutType; icon: string; label: string }>).map(({ type, icon, label }) => `
        <button class="generator-type-btn" data-type="${type}" style="
          flex:1; display:flex; flex-direction:column; align-items:center; gap:5px;
          padding:10px 6px; border-radius:8px; cursor:pointer; font-size:10px;
          border:2px solid ${layoutType === type ? 'var(--accent)' : 'var(--border,#374151)'};
          background:${layoutType === type ? 'rgba(var(--accent-rgb,99,102,241),0.15)' : 'transparent'};
          color:${layoutType === type ? 'var(--accent)' : 'var(--text-secondary)'};
          font-weight:${layoutType === type ? '700' : '400'};
          transition:all .15s;
        ">
          <span class="material-symbols-outlined" style="font-size:22px;">${icon}</span>
          ${label}
        </button>
      `).join('');

      const isEditing = !!editingId;

      const sectionName = `
        <div class="craftools-field" style="margin-bottom:6px;">
          <label style="font-size:11px; color:var(--text-secondary); display:block; margin-bottom:5px;">${g('nameLabel')}</label>
          <input type="text" id="generator-name" class="craftools-input" value="${name}"
            placeholder="${g('namePlaceholder')}" style="width:100%; padding:8px 10px; font-size:13px; font-weight:600;">
        </div>
      `;

      const sectionSize = `
        <div style="display:flex; flex-wrap:wrap; gap:5px;">${sizePills}</div>
        ${selectedSize?.size === 'custom' ? `
          <div style="display:flex; gap:8px; margin-top:8px;" id="generator-custom-size-wrap">
            <div class="craftools-field" style="flex:1;">
              <label style="font-size:10px; color:var(--text-muted); display:block; margin-bottom:3px;">Largura (mm)</label>
              <input type="number" id="generator-custom-width" class="craftools-input" value="${customWidth}" min="10" max="2000" step="1" style="width:100%; text-align:center; padding:4px 6px;">
            </div>
            <div class="craftools-field" style="flex:1;">
              <label style="font-size:10px; color:var(--text-muted); display:block; margin-bottom:3px;">Altura (mm)</label>
              <input type="number" id="generator-custom-height" class="craftools-input" value="${customHeight}" min="10" max="2000" step="1" style="width:100%; text-align:center; padding:4px 6px;">
            </div>
          </div>
        ` : ''}
        <div class="craftools-field" style="margin-top:10px;">
          <label style="font-size:11px; color:var(--text-secondary); display:block; margin-bottom:5px;">Orientação</label>
          <div style="display:flex; gap:6px;">
            <button type="button" class="craftools-pill generator-orient-btn ${orientation === 'portrait' ? 'active' : ''}" data-orient="portrait" style="flex:1; justify-content:center; gap:4px; padding:6px;">
              <span class="material-symbols-outlined" style="font-size:16px;">crop_portrait</span>
              Retrato
            </button>
            <button type="button" class="craftools-pill generator-orient-btn ${orientation === 'landscape' ? 'active' : ''}" data-orient="landscape" style="flex:1; justify-content:center; gap:4px; padding:6px;">
              <span class="material-symbols-outlined" style="font-size:16px;">crop_landscape</span>
              Paisagem
            </button>
          </div>
        </div>
      `;

      const sectionType = `<div style="display:flex; gap:8px;">${typeCards}</div>`;

      const sectionConfig = buildConfigHtml();

      const sectionSaved = buildSavedListHtml();

      const saveLabel = isEditing ? g('saveUpdate') : g('saveBtn');
      const saveFooter = `
        <div style="padding:10px 0 4px; display:flex; gap:8px;">
          ${isEditing ? `<button id="generator-new-btn" class="craftools-topbtn" style="flex:0 0 auto; padding:8px 12px;">
            <span class="material-symbols-outlined" style="font-size:14px;">add</span>${g('newTemplate')}
          </button>` : ''}
          <button id="generator-save-btn" class="craftools-topbtn" style="
            flex:1; justify-content:center; padding:10px;
            background:linear-gradient(135deg,#f97316,#ef4444); color:#fff;
            border:none; font-weight:700; font-size:13px; border-radius:8px;
          ">
            <span class="material-symbols-outlined" style="font-size:16px;">${isEditing ? 'update' : 'save'}</span>
            ${saveLabel}
          </button>
        </div>
      `;

      PanelUI.withStatePreservation(panelBody, () => {
        panelBody.innerHTML = `
          <div id="generator-root">
            ${PanelUI.accordion('gdr-name',   'badge',       g('sectionName'),   sectionName,   { open: true })}
            ${PanelUI.accordion('gdr-size',   'straighten',  g('sectionSize'),   sectionSize,   { open: true })}
            ${PanelUI.accordion('gdr-type',   'category',    g('sectionType'),   sectionType,   { open: true })}
            ${PanelUI.accordion('gdr-config', 'tune',        g('sectionConfig'), sectionConfig, { open: true })}
            ${PanelUI.accordion('gdr-saved',  'folder_open', g('sectionSaved'),  sectionSaved,  { open: false })}
            ${saveFooter}
          </div>
        `;
      });

      PanelUI.bindAccordions(panelBody);
      renderPreview();
      bindEvents();
    };

    // ── Event binding ────────────────────────────────────────────────────
    const bindEvents = (): void => {
      const root = panelBody.querySelector<HTMLElement>('#generator-root');
      if (!root) return;

      // Name input
      const nameInput = root.querySelector<HTMLInputElement>('#generator-name');
      if (nameInput) {
        nameInput.addEventListener('input', () => {
          name = nameInput.value;
        });
      }

      // Size pills
      root.querySelectorAll<HTMLElement>('.generator-size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedSize = allSizes[parseInt(btn.dataset.idx!, 10)];
          renderPanel();
        });
      });

      // Custom size inputs
      const customWInput = root.querySelector<HTMLInputElement>('#generator-custom-width');
      const customHInput = root.querySelector<HTMLInputElement>('#generator-custom-height');
      if (customWInput) {
        customWInput.addEventListener('input', () => {
          customWidth = parseFloat(customWInput.value) || 210;
          renderPreview();
        });
      }
      if (customHInput) {
        customHInput.addEventListener('input', () => {
          customHeight = parseFloat(customHInput.value) || 297;
          renderPreview();
        });
      }

      // Orientation pills
      root.querySelectorAll<HTMLElement>('.generator-orient-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          orientation = (btn.dataset.orient as Orientation) || 'portrait';
          renderPanel();
        });
      });

      // Layout type
      root.querySelectorAll<HTMLElement>('.generator-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          layoutType = btn.dataset.type as LayoutType;
          // Reset strip fields when changing type
          if (layoutType === 'strip' && !cfg.cellLines) cfg.cellLines = 2;
          if (layoutType === 'strip' && !cfg.cellColumns) cfg.cellColumns = 1;
          renderPanel();
        });
      });

      // Numeric config inputs (grid/strip) -- cellPadding/pageMargin handled separately
      (['cfg-cellWidth', 'cfg-cellHeight', 'cfg-cellGap', 'cfg-cellLines', 'cfg-cellColumns'] as const).forEach(id => {
        const el = root.querySelector<HTMLInputElement>(`#${id}`);
        if (!el) return;
        el.addEventListener('input', () => {
          const field = id.replace('cfg-', '') as keyof CfgState;
          (cfg as unknown as Record<string, string>)[field] = el.value;
          renderPreview();
        });
      });

      // Individual margin inputs for cfg.cellPadding / cfg.pageMargin
      root.querySelectorAll<HTMLInputElement>('.margin-part-input').forEach(el => {
        el.addEventListener('input', () => {
          const prefix = el.dataset.prefix!;
          const side   = el.dataset.side as keyof MarginObj;
          const field  = prefix.replace('cfg-', '') as 'cellPadding' | 'pageMargin';
          if (!cfg[field] || typeof cfg[field] !== 'object') cfg[field] = { top: 0, right: 0, bottom: 0, left: 0 };
          cfg[field][side] = parseFloat(el.value) || 0;
          renderPreview();
        });
      });

      // Auto-center margins toggle
      const autoCenterBtn = root.querySelector<HTMLElement>('.generator-autocenter-btn');
      if (autoCenterBtn) {
        autoCenterBtn.addEventListener('click', () => {
          cfg.autoCenter = !cfg.autoCenter;
          renderPanel();
        });
      }

      // Promo slot fields (non-margin)
      root.querySelectorAll<HTMLInputElement>('.slot-field').forEach(el => {
        el.addEventListener('input', () => {
          const i     = parseInt(el.dataset.slot!, 10);
          const field = el.dataset.field as keyof PromoSlotState;
          (promoSlots[i] as unknown as Record<string, unknown>)[field] = el.type === 'number' ? (parseFloat(el.value) || 0) : el.value;
          renderPreview();
        });
      });

      // Individual margin inputs for promo slot cellPadding
      root.querySelectorAll<HTMLInputElement>('.slot-margin-field').forEach(el => {
        el.addEventListener('input', () => {
          const i    = parseInt(el.dataset.slot!, 10);
          const side = el.dataset.side as keyof MarginObj;
          if (!promoSlots[i].cellPadding || typeof promoSlots[i].cellPadding !== 'object') {
            promoSlots[i].cellPadding = { top: 0, right: 0, bottom: 0, left: 0 };
          }
          promoSlots[i].cellPadding[side] = parseFloat(el.value) || 0;
          renderPreview();
        });
      });

      // Add slot
      const addSlotBtn = root.querySelector<HTMLElement>('#generator-add-slot');
      if (addSlotBtn) {
        addSlotBtn.addEventListener('click', () => {
          if (promoSlots.length >= MAX_PROMO_SLOTS) return;
          promoSlots.push({ cellWidth: 60, cellHeight: 85, cellCount: 1, cellPadding: { top: 3, right: 3, bottom: 20, left: 3 }, cellGap: 2, slotLines: 0, slotColumns: 0 });
          renderPanel();
        });
      }

      // Remove slot
      root.querySelectorAll<HTMLElement>('.generator-remove-slot').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.dataset.slot!, 10);
          promoSlots.splice(i, 1);
          renderPanel();
        });
      });

      // Save
      const saveBtn = root.querySelector<HTMLButtonElement>('#generator-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          const currentName = root.querySelector<HTMLInputElement>('#generator-name')?.value?.trim() || name.trim();
          name = currentName;

          if (!name) { showToast(g('errorName'), 'error'); return; }
          if (!selectedSize) { showToast(g('errorSize'), 'error'); return; }

          const tmpl = buildTemplateObject();
          if (editingId) tmpl._id = editingId;
          const saved = UserTemplates.save(tmpl);
          editingId = saved._id ?? null;

          // Invalidate ApiDataLoader cache so AlbumTool picks up changes
          invalidateApiCache();

          showToast(g('savedOk'));

          // Refresh the saved list
          const savedAccordion = root.querySelector('[data-accordion-id="gdr-saved"] .ct-accordion-content');
          if (savedAccordion) savedAccordion.innerHTML = buildSavedListHtml();
          bindSavedListEvents(root);

          // Update save button label
          saveBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">update</span>${g('saveUpdate')}`;
        });
      }

      // New template button (when editing)
      const newBtn = root.querySelector<HTMLElement>('#generator-new-btn');
      if (newBtn) {
        newBtn.addEventListener('click', () => {
          editingId  = null;
          name       = '';
          layoutType = 'grid';
          cfg        = { cellWidth: 60, cellHeight: 85, cellGap: 2, cellPadding: { top: 3, right: 3, bottom: 20, left: 3 }, pageMargin: { top: 5, right: 5, bottom: 5, left: 5 }, cellLines: 0, cellColumns: 0, autoCenter: false };
          promoSlots = [{ cellWidth: 80, cellHeight: 105, cellCount: 2, cellPadding: { top: 3, right: 3, bottom: 20, left: 3 }, cellGap: 2, slotLines: 0, slotColumns: 0 }];
          renderPanel();
        });
      }

      bindSavedListEvents(root);
    };

    const bindSavedListEvents = (root: HTMLElement): void => {
      // Edit
      root.querySelectorAll<HTMLElement>('.generator-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = UserTemplates.getById(btn.dataset.id!);
          if (!t) return;
          loadTemplate(t);
          renderPanel();
        });
      });

      // Delete
      root.querySelectorAll<HTMLElement>('.generator-del-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          UserTemplates.delete(btn.dataset.id!);
          invalidateApiCache();
          // If we're editing that one, reset to new
          if (editingId === btn.dataset.id) {
            editingId = null;
            name = '';
          }
          const savedAccordion = root.querySelector('[data-accordion-id="gdr-saved"] .ct-accordion-content');
          if (savedAccordion) savedAccordion.innerHTML = buildSavedListHtml();
          bindSavedListEvents(root);
          showToast(g('deletedOk'));
        });
      });
    };

    renderPanel();
    // `editor` isn't referenced directly by this panel's logic (unlike
    // Calendar/Agenda, Generator only edits localStorage-backed templates and
    // takes over #main-page via plain DOM ids), but it's still accepted to
    // match the PanelSetupFn signature every panel-only tool must satisfy.
    void editor;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function invalidateApiCache(): void {
  try {
    // Dynamic import to avoid circular deps
    import('../../utils/ApiDataLoader.js').then(m => {
      if (typeof m.invalidateApiDataCache === 'function') m.invalidateApiDataCache();
    }).catch(() => {});
  } catch {
    // no-op
  }
}

function showToast(msg: string, type: 'success' | 'error' = 'success'): void {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:${type === 'error' ? '#ef4444' : '#10b981'};
    color:#fff; padding:10px 20px; border-radius:8px;
    font-size:13px; font-weight:600; z-index:99999;
    box-shadow:0 4px 20px rgba(0,0,0,0.35);
    animation:ct-fadeInUp .25s ease;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// icon matches the desktop sidebar (index.html #pwa-sidebar-generator).
ToolRegistry.register({
  key: 'generator',
  label: 'editor.generator',
  icon: 'dashboard_customize',
  panelOnly: true,
  showInFooterNav: false,
  category: 'tools',
});
