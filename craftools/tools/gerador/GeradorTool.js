import { I18n } from "../../settings/Translations.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { AlbumPreviewSVG } from "../../utils/AlbumPreviewSVG.js";
import { UserTemplates } from "../../utils/UserTemplates.js";
import "./GeradorTool_Translations.js";

const g = (key) => I18n.t('geradorTool.' + key);

// ── Margin helpers ─────────────────────────────────────────────────────────
const parseMarginStr = (s) => {
    const parts = String(s || '0 0 0 0').trim().split(/\s+/).map(Number);
    const [t = 0, r, b, l] = parts;
    return {
        top:    t,
        right:  r !== undefined ? r : t,
        bottom: b !== undefined ? b : t,
        left:   l !== undefined ? l : (r !== undefined ? r : t),
    };
};
const marginToStr = (m) => `${m.top} ${m.right} ${m.bottom} ${m.left}`;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ── Auto-center helpers ──────────────────────────────────────────────────────
// Calcula o tamanho "natural" que o conteúdo (grade ou kit) ocupa quando
// encaixado no maior número possível de células/blocos, ignorando margens —
// usado para centralizar automaticamente a página (margens simétricas).
const computeGridContentBounds = (cellWidth, cellHeight, cellGap, docW, docH) => {
    const gap = parseFloat(cellGap) || 0;
    const cW  = parseFloat(cellWidth)  || 1;
    const cH  = parseFloat(cellHeight) || 1;
    const cols = Math.max(1, Math.floor((docW + gap) / (cW + gap)));
    const rows = Math.max(1, Math.floor((docH + gap) / (cH + gap)));
    return {
        width:  cols * cW + (cols > 1 ? (cols - 1) * gap : 0),
        height: rows * cH + (rows > 1 ? (rows - 1) * gap : 0),
    };
};

const computePromoContentBounds = (promoSlots, kitGap, docW) => {
    const gap = parseFloat(kitGap) || 0;
    let curX = 0, curY = 0, shelfH = 0, maxRowWidth = 0;

    (promoSlots || []).forEach(slot => {
        const slotGap = slot.cellGap !== undefined ? (parseFloat(slot.cellGap) || 0) : gap;
        const cW = parseFloat(slot.cellWidth)  || 1;
        const cH = parseFloat(slot.cellHeight) || 1;
        let cols, rows;
        if (slot.slotColumns && slot.slotLines) {
            cols = slot.slotColumns;
            rows = slot.slotLines;
        } else {
            const Kmax = Math.floor((docW + slotGap) / (cW + slotGap)) || 1;
            cols = Math.min(slot.cellCount || 1, Kmax);
            rows = Math.ceil((slot.cellCount || 1) / cols);
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

// Standard page sizes always available in the builder
const STANDARD_SIZES = [
    { name: "A4",     size: "210,297", sizeUnit: "mm" },
    { name: "A5",     size: "148,210", sizeUnit: "mm" },
    { name: "A3",     size: "297,420", sizeUnit: "mm" },
    { name: "10×15",  size: "100,150", sizeUnit: "mm" },
    { name: "15×21",  size: "150,210", sizeUnit: "mm" },
    { name: "20×30",  size: "200,300", sizeUnit: "mm" },
    { name: "30×40",  size: "300,400", sizeUnit: "mm" },
];

const MAX_PROMO_SLOTS = 6;

export class GeradorTool {

    /**
     * Renders the Gerador (template builder) panel.
     * @param {HTMLElement} panelBody
     * @param {object} editor
     */
    static setup(editor) {
        const panelTitle = document.getElementById('panel-title');
        const panelBody  = document.getElementById('panel-body');

        if (panelTitle) panelTitle.textContent = g('panelTitle');  // "Generator"

        // ── State ─────────────────────────────────────────────────────────────
        let editingId    = null;   // _id of template being edited (null = new)
        let name         = '';
        let selectedSize = null;
        let layoutType   = 'grid'; // 'grid' | 'strip' | 'promo'

        // Grid / Strip state — margins stored as objects {top,right,bottom,left}
        let cfg = {
            cellWidth:   60,
            cellHeight:  85,
            cellGap:     2,
            cellPadding: { top: 3,  right: 3,  bottom: 20, left: 3 },
            pageMargin:  { top: 5,  right: 5,  bottom: 5,  left: 5 },
            cellLines:   0,
            cellColumns: 0,
            autoCenter:  false,
        };

        // Promo Kit state — cellPadding also as object
        let promoSlots = [
            { cellWidth: 80, cellHeight: 105, cellCount: 2, cellPadding: { top: 3, right: 3, bottom: 20, left: 3 }, cellGap: 2, slotLines: 0, slotColumns: 0 },
        ];

        // Merge standard sizes with active config sizes
        const activeSizes = (window.craftoolsApp?.activeMedia?.sizes || []).filter(s => s.size !== '*');
        const existingKeys = new Set(activeSizes.map(s => s.size));
        const allSizes = [
            ...activeSizes,
            ...STANDARD_SIZES.filter(s => !existingKeys.has(s.size)),
        ];
        if (allSizes.length > 0) selectedSize = allSizes[0];

        // ── Build config from template (for edit mode) ─────────────────────
        const loadTemplate = (t) => {
            editingId  = t._id || null;
            name       = t.name || '';
            const matchedSize = allSizes.find(s => (t.sizes || []).includes(s.size));
            if (matchedSize) selectedSize = matchedSize;

            if (t.type === 'promo_kit') {
                layoutType = 'promo';
                promoSlots = (t.cellSlots || []).map(s => ({
                    ...s,
                    cellPadding: parseMarginStr(s.cellPadding),
                }));
                cfg = {
                    ...cfg,
                    pageMargin:  parseMarginStr(t.pageMargin ?? '5 5 5 5'),
                    autoCenter:  !!t.autoCenterMargin,
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

        // ── Template object builder ────────────────────────────────────────
        const buildTemplateObject = () => {
            const base = {
                name,
                sizes:      selectedSize ? [selectedSize.size] : [],
                pageMargin: marginToStr(cfg.pageMargin),
                cellGap:    parseFloat(cfg.cellGap) || 0,
                autoCenterMargin: !!cfg.autoCenter,
            };

            if (layoutType === 'promo') {
                return {
                    ...base,
                    type:        'promo_kit',
                    cellWidth:   0,
                    cellHeight:  0,
                    cellPadding: '0 0 0 0',
                    cellSlots:   promoSlots.map(s => ({
                        cellWidth:   parseFloat(s.cellWidth)  || 0,
                        cellHeight:  parseFloat(s.cellHeight) || 0,
                        cellCount:   parseInt(s.cellCount)    || 1,
                        cellPadding: marginToStr(s.cellPadding),
                        cellGap:     parseFloat(s.cellGap)    || 0,
                        ...(s.slotLines   ? { slotLines:   parseInt(s.slotLines)   } : {}),
                        ...(s.slotColumns ? { slotColumns: parseInt(s.slotColumns) } : {}),
                    })),
                };
            }

            const obj = {
                ...base,
                cellWidth:   parseFloat(cfg.cellWidth)  || 60,
                cellHeight:  parseFloat(cfg.cellHeight) || 85,
                cellPadding: marginToStr(cfg.cellPadding),
            };

            if (layoutType === 'strip') {
                obj.cellLines   = parseInt(cfg.cellLines)   || 1;
                obj.cellColumns = parseInt(cfg.cellColumns) || 1;
            }

            return obj;
        };

        // ── Live preview SVG on Page Canvas ────────────────────────────────
        const renderPreview = () => {
            const canvasArea = document.getElementById('canvas-area');
            const pagesWrapper = document.getElementById('pages-wrapper');
            const mainPage = document.getElementById('main-page');
            if (!canvasArea || !mainPage) return;

            // Make sure pages wrapper is visible so the page sheet is shown
            if (pagesWrapper) pagesWrapper.style.display = '';

            // Handle floating preview badge in canvasArea (outside the page)
            let badge = document.getElementById('gerador-canvas-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.id = 'gerador-canvas-badge';
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

            const parts = String(selectedSize.size || '210,297').split(',').map(Number);
            const docW  = parts[0] || 210;
            const docH  = parts[1] || 297;
            const unit  = selectedSize.sizeUnit || 'mm';

            // Resize the actual canvas page to reflect the selected size
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

                // Reflete os valores recalculados nos campos (readonly) de margem
                // imediatamente, sem um re-render completo do painel — assim o
                // usuário vê a margem se ajustar em tempo real conforme muda o
                // tamanho da célula/gap/página, mesmo sem re-renderizar o campo
                // que ele está editando (evita perder o foco do input).
                const root = panelBody.querySelector('#gerador-root');
                if (root) {
                    root.querySelectorAll('.margin-part-input[data-prefix="cfg-pageMargin"]').forEach(el => {
                        const side = el.dataset.side;
                        if (side && cfg.pageMargin[side] !== undefined) {
                            el.value = cfg.pageMargin[side];
                        }
                    });
                }
            }

            const tmpl = buildTemplateObject();
            const svgHtml = AlbumPreviewSVG.build(tmpl, selectedSize, { maxW: 2000, maxH: 2000 });
            mainPage.innerHTML = svgHtml;

            const svgEl = mainPage.querySelector('svg');
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

        // ── Saved templates list HTML ─────────────────────────────────────
        const buildSavedListHtml = () => {
            const saved = UserTemplates.load();
            if (saved.length === 0) {
                return `<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:10px 0;">${g('noSaved')}</div>`;
            }
            return saved.map(t => `
                <div class="gerador-saved-row" data-id="${t._id}" style="
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
                    <button class="gerador-edit-btn craftools-topbtn" data-id="${t._id}" style="padding:3px 8px; font-size:10px; gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:13px;">edit</span>${g('editBtn')}
                    </button>
                    <button class="gerador-del-btn craftools-topbtn" data-id="${t._id}" style="padding:3px 8px; font-size:10px; gap:4px; background:rgba(239,68,68,0.15); color:#f87171; border-color:rgba(239,68,68,0.3);">
                        <span class="material-symbols-outlined" style="font-size:13px;">delete</span>
                    </button>
                </div>
            `).join('');
        };

        // ── Config section HTML ────────────────────────────────────────────
        const buildConfigHtml = () => {
            const numInput = (id, label, value, min = 0, max = 999, step = 0.5) =>
                `<div class="craftools-field" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                    <label style="font-size:11px; color:var(--text-secondary); flex:1;">${label}</label>
                    <input type="number" id="${id}" class="craftools-input" value="${value}" min="${min}" max="${max}" step="${step}"
                        style="width:72px; text-align:right; padding:4px 6px;">
                </div>`;

            // Renders 4 individual number inputs (T/R/B/L) for margin/padding fields.
            // When `autoCenterToggle` is true, also renders the "Centralizar
            // Automaticamente" switch above the inputs; while active, the inputs
            // become readonly (margins are computed, not manually editable).
            const marginInputGroup = (idPrefix, label, value, opts = {}) => {
                const { autoCenterToggle = false } = opts;
                const isAuto = autoCenterToggle && !!cfg.autoCenter;
                const toggleHtml = autoCenterToggle ? `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span class="craftools-label" style="margin:0; font-size:11px; color:var(--text-secondary);">${g('autoCenterLabel')}</span>
                        <button type="button" class="craftools-pill gerador-autocenter-btn ${isAuto ? 'active' : ''}" style="display:flex; align-items:center; gap:4px;">
                            <span class="material-symbols-outlined" style="font-size:14px;">center_focus_strong</span>
                            ${isAuto ? g('enabled') : g('disabled')}
                        </button>
                    </div>` : '';
                return `<div class="craftools-field" style="margin-bottom:10px;">
                    <label style="font-size:11px; color:var(--text-secondary); display:block; margin-bottom:5px;">${label}</label>
                    ${toggleHtml}
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">
                        ${['top','right','bottom','left'].map(side => `
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
            const slotMarginGroup = (slotIdx, label, value) =>
                `<div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-muted); display:block; margin-bottom:3px;">${label}</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        ${['top','right','bottom','left'].map(side => `
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
                    <div class="gerador-promo-slot" data-slot="${i}" style="
                        background:var(--bg-input,#1e1e2e); border:1px solid var(--border,#374151);
                        border-radius:8px; padding:10px; margin-bottom:8px;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                            <span style="font-size:11px; font-weight:600; color:var(--text-secondary);">Slot ${i + 1}</span>
                            ${promoSlots.length > 1 ? `<button class="gerador-remove-slot craftools-topbtn" data-slot="${i}" style="padding:2px 7px; font-size:10px; color:#f87171; background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.3);">
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
                    <div id="gerador-promo-slots">${slotsHtml}</div>
                    ${canAddSlot ? `<button id="gerador-add-slot" class="craftools-topbtn" style="width:100%; justify-content:center; margin-bottom:8px;">
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

        // ── Full panel HTML ────────────────────────────────────────────────
        const renderPanel = () => {
            const sizePills = allSizes.map((s, i) =>
                `<button class="craftools-pill gerador-size-btn ${selectedSize === s ? 'active' : ''}" data-idx="${i}">${s.name}</button>`
            ).join('');

            const typeCards = [
                { type: 'grid',  icon: 'grid_view',   label: g('typeGrid')  },
                { type: 'strip', icon: 'view_column',  label: g('typeStrip') },
                { type: 'promo', icon: 'dashboard',    label: g('typePromo') },
            ].map(({ type, icon, label }) => `
                <button class="gerador-type-btn" data-type="${type}" style="
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
                    <input type="text" id="gerador-name" class="craftools-input" value="${name}"
                        placeholder="${g('namePlaceholder')}" style="width:100%; padding:8px 10px; font-size:13px; font-weight:600;">
                </div>
            `;

            const sectionSize = `<div style="display:flex; flex-wrap:wrap; gap:5px;">${sizePills}</div>`;

            const sectionType = `<div style="display:flex; gap:8px;">${typeCards}</div>`;

            const sectionConfig = buildConfigHtml();

            const sectionSaved = buildSavedListHtml();

            const saveLabel = isEditing ? g('saveUpdate') : g('saveBtn');
            const saveFooter = `
                <div style="padding:10px 0 4px; display:flex; gap:8px;">
                    ${isEditing ? `<button id="gerador-new-btn" class="craftools-topbtn" style="flex:0 0 auto; padding:8px 12px;">
                        <span class="material-symbols-outlined" style="font-size:14px;">add</span>${g('newTemplate')}
                    </button>` : ''}
                    <button id="gerador-save-btn" class="craftools-topbtn" style="
                        flex:1; justify-content:center; padding:10px;
                        background:linear-gradient(135deg,#f97316,#ef4444); color:#fff;
                        border:none; font-weight:700; font-size:13px; border-radius:8px;
                    ">
                        <span class="material-symbols-outlined" style="font-size:16px;">${isEditing ? 'update' : 'save'}</span>
                        ${saveLabel}
                    </button>
                </div>
            `;

            panelBody.innerHTML = `
                <div id="gerador-root">
                    ${PanelUI.accordion('gdr-name',    'badge',       g('sectionName'),    sectionName,    { open: true })}
                    ${PanelUI.accordion('gdr-size',    'straighten',  g('sectionSize'),    sectionSize,    { open: true })}
                    ${PanelUI.accordion('gdr-type',    'category',    g('sectionType'),    sectionType,    { open: true })}
                    ${PanelUI.accordion('gdr-config',  'tune',        g('sectionConfig'),  sectionConfig,  { open: true })}
                    ${PanelUI.accordion('gdr-saved',   'folder_open', g('sectionSaved'),   sectionSaved,   { open: false })}
                    ${saveFooter}
                </div>
            `;

            PanelUI.bindAccordions(panelBody);
            renderPreview();
            bindEvents();
        };

        // ── Event binding ──────────────────────────────────────────────────
        const bindEvents = () => {
            const root = panelBody.querySelector('#gerador-root');
            if (!root) return;

            // Name input
            const nameInput = root.querySelector('#gerador-name');
            if (nameInput) {
                nameInput.addEventListener('input', e => {
                    name = e.target.value;
                });
            }

            // Size pills
            root.querySelectorAll('.gerador-size-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedSize = allSizes[parseInt(btn.dataset.idx)];
                    root.querySelectorAll('.gerador-size-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderPreview();
                });
            });

            // Layout type
            root.querySelectorAll('.gerador-type-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    layoutType = btn.dataset.type;
                    // Reset strip fields when changing type
                    if (layoutType === 'strip' && !cfg.cellLines) cfg.cellLines = 2;
                    if (layoutType === 'strip' && !cfg.cellColumns) cfg.cellColumns = 1;
                    renderPanel();
                });
            });

            // Numeric config inputs (grid/strip) — cellPadding/pageMargin handled separately
            ['cfg-cellWidth','cfg-cellHeight','cfg-cellGap','cfg-cellLines','cfg-cellColumns'].forEach(id => {
                const el = root.querySelector(`#${id}`);
                if (!el) return;
                el.addEventListener('input', e => {
                    const field = id.replace('cfg-', '');
                    cfg[field] = e.target.value;
                    renderPreview();
                });
            });

            // Individual margin inputs for cfg.cellPadding / cfg.pageMargin
            root.querySelectorAll('.margin-part-input').forEach(el => {
                el.addEventListener('input', e => {
                    const prefix = e.target.dataset.prefix;
                    const side   = e.target.dataset.side;
                    const field  = prefix.replace('cfg-', '');
                    if (!cfg[field] || typeof cfg[field] !== 'object') cfg[field] = { top: 0, right: 0, bottom: 0, left: 0 };
                    cfg[field][side] = parseFloat(e.target.value) || 0;
                    renderPreview();
                });
            });

            // Auto-center margins toggle
            const autoCenterBtn = root.querySelector('.gerador-autocenter-btn');
            if (autoCenterBtn) {
                autoCenterBtn.addEventListener('click', () => {
                    cfg.autoCenter = !cfg.autoCenter;
                    renderPanel();
                });
            }

            // Promo slot fields (non-margin)
            root.querySelectorAll('.slot-field').forEach(el => {
                el.addEventListener('input', e => {
                    const i     = parseInt(e.target.dataset.slot);
                    const field = e.target.dataset.field;
                    promoSlots[i][field] = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                    renderPreview();
                });
            });

            // Individual margin inputs for promo slot cellPadding
            root.querySelectorAll('.slot-margin-field').forEach(el => {
                el.addEventListener('input', e => {
                    const i    = parseInt(e.target.dataset.slot);
                    const side = e.target.dataset.side;
                    if (!promoSlots[i].cellPadding || typeof promoSlots[i].cellPadding !== 'object') {
                        promoSlots[i].cellPadding = { top: 0, right: 0, bottom: 0, left: 0 };
                    }
                    promoSlots[i].cellPadding[side] = parseFloat(e.target.value) || 0;
                    renderPreview();
                });
            });

            // Add slot
            const addSlotBtn = root.querySelector('#gerador-add-slot');
            if (addSlotBtn) {
                addSlotBtn.addEventListener('click', () => {
                    if (promoSlots.length >= MAX_PROMO_SLOTS) return;
                    promoSlots.push({ cellWidth: 60, cellHeight: 85, cellCount: 1, cellPadding: { top: 3, right: 3, bottom: 20, left: 3 }, cellGap: 2, slotLines: 0, slotColumns: 0 });
                    renderPanel();
                });
            }

            // Remove slot
            root.querySelectorAll('.gerador-remove-slot').forEach(btn => {
                btn.addEventListener('click', () => {
                    const i = parseInt(btn.dataset.slot);
                    promoSlots.splice(i, 1);
                    renderPanel();
                });
            });

            // Save
            const saveBtn = root.querySelector('#gerador-save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const currentName = root.querySelector('#gerador-name')?.value?.trim() || name.trim();
                    name = currentName;

                    if (!name) { showToast(g('errorName'), 'error'); return; }
                    if (!selectedSize) { showToast(g('errorSize'), 'error'); return; }

                    const tmpl = buildTemplateObject();
                    if (editingId) tmpl._id = editingId;
                    const saved = UserTemplates.save(tmpl);
                    editingId = saved._id;

                    // Invalidate ApiDataLoader cache so AlbumTool picks up changes
                    invalidateApiCache();

                    showToast(g('savedOk'));

                    // Refresh the saved list
                    const savedAccordion = root.querySelector('[data-accordion-id="gdr-saved"] .ct-accordion-content');
                    if (savedAccordion) savedAccordion.innerHTML = buildSavedListHtml();
                    bindSavedListEvents(root);

                    // Update save button label
                    if (saveBtn) {
                        saveBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">update</span>${g('saveUpdate')}`;
                    }
                });
            }

            // New template button (when editing)
            const newBtn = root.querySelector('#gerador-new-btn');
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

        const bindSavedListEvents = (root) => {
            // Edit
            root.querySelectorAll('.gerador-edit-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const t = UserTemplates.getById(btn.dataset.id);
                    if (!t) return;
                    loadTemplate(t);
                    renderPanel();
                });
            });

            // Delete
            root.querySelectorAll('.gerador-del-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    UserTemplates.delete(btn.dataset.id);
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
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function invalidateApiCache() {
    try {
        // Dynamic import to avoid circular deps
        import('../../utils/ApiDataLoader.js').then(m => {
            if (typeof m.invalidateApiDataCache === 'function') m.invalidateApiDataCache();
        }).catch(() => {});
    } catch {}
}

function showToast(msg, type = 'success') {
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
