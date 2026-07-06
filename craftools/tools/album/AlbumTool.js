import { ImageTool } from "../image/ImageTool.js";
import { ImageTransform } from "../image/ImageTransform.js";
import { ImageFilters } from "../image/ImageFilters.js";
import { I18n } from "../../settings/Translations.js";
import { Craftools_LayoutGrid } from "../../utils/LayoutGrid.js";
import { GridSizes } from "../../utils/GridSizes.js";
import { loadGridSizes } from "../../utils/ApiDataLoader.js";
import { CommonProperties } from "../../utils/CommonProperties.js";
import { PageTool } from "../page/PageTool.js";
import { BaseTool } from "../BaseTool.js";
import { CellPanel } from "./CellPanel.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { AlbumPreviewSVG } from "../../utils/AlbumPreviewSVG.js";
import "./AlbumTool_Translations.js";

export class AlbumTool extends BaseTool {
    static async setup(editor, pageEl) {
        const rightPanel = document.getElementById('right-panel');
        const panelTitle = document.getElementById('panel-title');
        const panelBody = document.getElementById('panel-body');
        const defaultMenu = document.getElementById('panel-default-menu');
        const closePanel = document.getElementById('close-panel');
        const panelLogo = document.getElementById('panel-logo');

        if (panelTitle) panelTitle.textContent = I18n.t('albumTool.panelTitle');
        editor.activePage = pageEl;

        // ── State ──────────────────────────────────────────────────────────
        let selectedSize = null;
        let selectedTemplate = null;
        let selectedMode = 'album';      // 'album' | 'card'
        let photos = [];                 // Album mode
        let cardPhoto = null;            // Card mode – single file
        let cardQuantityMode = 'auto';   // 'auto' | 'manual'
        let cardManualQty = 1;
        let smartFit = false;            // Auto rotate mismatched aspect ratios

        // Load sizes from global settings
        let availableSizes = [];
        if (window.craftoolsApp && window.craftoolsApp.activeMedia && window.craftoolsApp.activeMedia.sizes) {
            availableSizes = window.craftoolsApp.activeMedia.sizes.filter(s => s.size !== "*");
        } else {
            availableSizes = [
                { name: "A4", size: "210,297", sizeUnit: "mm" },
                { name: "A5", size: "148,210", sizeUnit: "mm" }
            ];
        }

        if (availableSizes.length > 0) selectedSize = availableSizes[0];

        // ── Template normalizer ───────────────────────────────────────────
        // The API may return numeric or missing values for fields that the local
        // GridSizes.js always provides as strings. This function sanitises an
        // entry before any rendering/calc logic touches it.
        const normalizeTemplate = (t) => {
            const toSpaceStr = (val, fallback = '0 0 0 0') => {
                if (typeof val === 'string' && val.trim()) return val;
                if (typeof val === 'number') return `${val} ${val} ${val} ${val}`;
                return fallback;
            };
            return {
                ...t,
                pageMargin:  toSpaceStr(t.pageMargin,  '5 5 5 5'),
                cellPadding: toSpaceStr(t.cellPadding, '3 3 3 3'),
                cellGap:     typeof t.cellGap  === 'number' ? t.cellGap  : 0,
                cellWidth:   typeof t.cellWidth  === 'number' ? t.cellWidth  : 50,
                cellHeight:  typeof t.cellHeight === 'number' ? t.cellHeight : 50,
                sizes:       Array.isArray(t.sizes) ? t.sizes : [],
            };
        };

        // ── Helpers ────────────────────────────────────────────────────────
        const calcPerPage = (template, size) => {
            if (template.type === 'promo_kit') {
                // Slots that are themselves photostrips (cellLines/cellColumns) consume
                // cellLines*cellColumns items per instance instead of just 1.
                // Slots with slotLines/slotColumns are regular cells (1 photo each)
                // — cellCount is already the total number of individual photos.
                return template.cellSlots.reduce((sum, slot) => {
                    const itemsPerUnit = (slot.cellLines || slot.cellColumns) ? (slot.cellLines || 1) * (slot.cellColumns || 1) : 1;
                    return sum + slot.cellCount * itemsPerUnit;
                }, 0);
            }
            const parts = size.size.split(',').map(Number);
            const docW = parts[0];
            const docH = parts[1];
            const margins = template.pageMargin.split(" ").map(v => parseFloat(v));
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
        const gridSizes = await loadGridSizes();
        const renderPanel = () => {
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

            const buildSlotPreview = (t) => {
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
                const outerW = Math.round(t.cellWidth  * scale);
                const outerH = Math.round(t.cellHeight * scale);

                const sPadT = Math.round(padT * scale);
                const sPadR = Math.round(padR * scale);
                const sPadB = Math.round(padB * scale);
                const sPadL = Math.round(padL * scale);

                const isStripe = !!(t.cellLines || t.cellColumns);

                if (isStripe) {
                    // Photostrip preview: show the inner grid of slots
                    const sLines = t.cellLines || 1;
                    const sCols  = t.cellColumns || 1;
                    const innerW = outerW - sPadL - sPadR;
                    const innerH = outerH - sPadT - sPadB;
                    const slotW  = Math.floor(innerW / sCols);
                    const slotH  = Math.floor(innerH / sLines);
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
            const buildPagePreview = (t) => {
                return AlbumPreviewSVG.build(t, selectedSize, { maxW: 180, maxH: 140 });
            };


            const templateHtml = matchingTemplates.length > 0
                ? matchingTemplates.map((t, idx) => {
                    const slotPreview = buildSlotPreview(t);
                    const isActive = selectedTemplate === t;
                    const rowStyle = isActive
                        ? `background:var(--accent); border-color:var(--accent);`
                        : `background:var(--bg-input,#1e1e2e); border-color:var(--border,#374151);`;
                    const textColor = isActive ? 'color:#fff;' : '';
                    const mutedColor = isActive ? 'color:rgba(255,255,255,0.7);' : 'color:var(--text-muted);';
                    const secColor  = isActive ? 'color:rgba(255,255,255,0.85);' : 'color:var(--text-secondary);';

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
                            border:1px solid; transition:all .12s;
                            ${rowStyle}
                        ">
                            <div style="flex:0 0 ${wrapW}px; width:${wrapW}px; height:${wrapH}px; display:flex; align-items:center; justify-content:center;">
                                ${slotPreview}
                            </div>
                            <div style="flex:1; min-width:0; overflow:hidden;">
                                <div style="font-size:12px; font-weight:600; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ${textColor}">${t.name}${userBadge}</div>
                                <div style="font-size:10px; margin-bottom:2px; ${secColor}">${isPromo ? I18n.t('albumTool.mixedSizes') : `${t.cellWidth} × ${t.cellHeight} mm`}</div>
                                <div style="font-size:10px; margin-bottom:6px; ${mutedColor}">${I18n.t('albumTool.gapLabel')}: ${t.cellGap} mm</div>
                                <button class="page-preview-btn" data-tidx="${idx}" style="
                                    font-size:9px; padding:2px 7px; border-radius:4px;
                                    background:transparent; border:1px solid ${isActive ? 'rgba(255,255,255,0.5)' : 'var(--border,#374151)'};
                                    color:${isActive ? '#fff' : 'var(--text-secondary)'}; cursor:pointer;
                                    display:inline-flex; align-items:center; gap:3px;
                                ">
                                    <span class="material-symbols-outlined" style="font-size:11px;">grid_view</span>
                                    ${I18n.t('albumTool.viewPage')}
                                </button>
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
                                ${photos.length > 0 ? I18n.t('albumTool.photosSelectedCount').replace('{n}', photos.length) : I18n.t('albumTool.selectPhotos')}
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
            const existingGrid = pageEl.querySelector('.craftools-grid-container');


            // Generate button — validation per mode
            const canGenerate = selectedTemplate &&
                (selectedMode === 'album' ? photos.length > 0 : cardPhoto !== null);

            const htmlTamanhoLayout = `
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('albumTool.step1')}</span>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">${sizeHtml}</div>
                </div>

                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('albumTool.step2')}</span>
                    <div style="display: flex; flex-direction: column; gap: 0;">${templateHtml}</div>
                </div>
            `;

            const htmlConteudo = selectedTemplate ? `
                <div class="ct-field">
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

            const htmlConfigs = `
                <div class="ct-field">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span class="craftools-label" style="margin:0;">${I18n.t('albumTool.autoAlign')}</span>
                        <button class="craftools-pill auto-snap-btn ${window.craftoolsAutoSnap !== false ? 'active' : ''}" style="display:flex; align-items:center; gap:4px;">
                            <span class="material-symbols-outlined" style="font-size:14px;">center_focus_strong</span>
                            ${window.craftoolsAutoSnap !== false ? I18n.t('albumTool.enabled') : I18n.t('albumTool.disabled')}
                        </button>
                    </div>

                    ${window.craftoolsAutoSnap !== false ? `
                    <div style="margin-bottom: 10px;">
                        <span class="craftools-label" style="margin:0 0 4px 0;">${I18n.t('albumTool.snapPosition')}</span>
                        <select class="craftools-input snap-align-select" style="width: 100%; padding: 4px; font-size: 12px;">
                            <option value="top-left" ${window.craftoolsAutoSnapAlign === 'top-left' ? 'selected' : ''}>${I18n.t('albumTool.snapTopLeft')}</option>
                            <option value="top-center" ${window.craftoolsAutoSnapAlign === 'top-center' ? 'selected' : ''}>${I18n.t('albumTool.snapTopCenter')}</option>
                            <option value="top-right" ${window.craftoolsAutoSnapAlign === 'top-right' ? 'selected' : ''}>${I18n.t('albumTool.snapTopRight')}</option>
                            <option value="center-left" ${window.craftoolsAutoSnapAlign === 'center-left' ? 'selected' : ''}>${I18n.t('albumTool.snapCenterLeft')}</option>
                            <option value="center-center" ${window.craftoolsAutoSnapAlign === 'center-center' ? 'selected' : ''}>${I18n.t('albumTool.snapCenterCenter')}</option>
                            <option value="center-right" ${window.craftoolsAutoSnapAlign === 'center-right' ? 'selected' : ''}>${I18n.t('albumTool.snapCenterRight')}</option>
                            <option value="bottom-left" ${window.craftoolsAutoSnapAlign === 'bottom-left' ? 'selected' : ''}>${I18n.t('albumTool.snapBottomLeft')}</option>
                            <option value="bottom-center" ${(window.craftoolsAutoSnapAlign || 'bottom-center') === 'bottom-center' ? 'selected' : ''}>${I18n.t('albumTool.snapBottomCenter')}</option>
                            <option value="bottom-right" ${window.craftoolsAutoSnapAlign === 'bottom-right' ? 'selected' : ''}>${I18n.t('albumTool.snapBottomRight')}</option>
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
                    <span style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 4px;">${I18n.t('albumTool.smartFitHelp')}</span>
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

            // Determine which accordion should be open based on step completion
            let openTamanho = true;
            let openConteudo = false;
            let openConfigs = false;
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

            panelBody.innerHTML = 
                PanelUI.accordion('album-tamanho', 'straighten', I18n.t('albumTool.sizeAndLayout') || 'Tamanho & Layout', htmlTamanhoLayout, { open: openTamanho }) +
                PanelUI.accordion('album-conteudo', 'imagesmode', I18n.t('albumTool.content') || 'Conteúdo', htmlConteudo, { open: openConteudo }) +
                PanelUI.accordion('album-configs', 'settings', I18n.t('albumTool.settings') || 'Configurações', htmlConfigs, { open: openConfigs }) +
                PanelUI.accordion('album-acoes', 'play_arrow', I18n.t('albumTool.actions') || 'Ações', htmlAcoes, { open: openAcoes });

            // ── Bind: Step 1 — Size ────────────────────────────────────────
            panelBody.querySelectorAll('.size-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedSize = availableSizes[btn.getAttribute('data-idx')];
                    selectedTemplate = null;
                    if (selectedSize) {
                        const parts = selectedSize.size.split(',');
                        pageEl.style.width = parts[0] + selectedSize.sizeUnit;
                        pageEl.style.minHeight = parts[1] + selectedSize.sizeUnit;
                        window.craftoolsSize = selectedSize;
                    }
                    renderPanel();
                });
            });

            // ── Bind: Step 2 — Template (now div, not button) ────────────────
            panelBody.querySelectorAll('.template-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    // Ignore clicks that originated from the page-preview-btn
                    if (e.target.closest('.page-preview-btn')) return;
                    selectedTemplate = matchingTemplates[btn.getAttribute('data-idx')];
                    renderPanel();
                });
            });

            // ── Bind: Page preview toggle ──────────────────────────────────
            panelBody.querySelectorAll('.page-preview-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // don't trigger template-btn
                    const tidx = btn.getAttribute('data-tidx');
                    const panel = panelBody.querySelector(`.page-preview-panel[data-tidx="${tidx}"]`);
                    if (!panel) return;
                    const isOpen = panel.style.display !== 'none';
                    panel.style.display = isOpen ? 'none' : 'block';
                    btn.style.background = isOpen ? 'transparent' : 'var(--accent-dim, #1e3a5f)';
                    btn.style.color = isOpen ? 'var(--text-secondary)' : 'var(--accent, #3b82f6)';
                    btn.style.borderColor = isOpen ? 'var(--border,#374151)' : 'var(--accent, #3b82f6)';
                });
            });

            // ── Bind: Step 3 — Mode ────────────────────────────────────────
            panelBody.querySelectorAll('.mode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedMode = btn.dataset.mode;
                    photos = [];
                    cardPhoto = null;
                    renderPanel();
                });
            });

            // ── Bind: Album — file input ───────────────────────────────────
            const albumFileInput = panelBody.querySelector('#album-file-input');
            const albumSelectBtn = panelBody.querySelector('#album-select-btn');
            if (albumFileInput && albumSelectBtn) {
                albumSelectBtn.addEventListener('click', () => albumFileInput.click());
                albumFileInput.addEventListener('change', (e) => {
                    photos = Array.from(e.target.files);
                    renderPanel();
                });
            }

            // ── Bind: Card — quantity mode ─────────────────────────────────
            panelBody.querySelectorAll('.qty-mode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    cardQuantityMode = btn.dataset.qmode;
                    renderPanel();
                });
            });
            const cardQtyInput = panelBody.querySelector('#card-qty-input');
            if (cardQtyInput) {
                cardQtyInput.addEventListener('input', (e) => {
                    cardManualQty = Math.max(1, parseInt(e.target.value) || 1);
                });
            }

            // ── Bind: Card — image file input ──────────────────────────────
            const cardFileInput = panelBody.querySelector('#card-file-input');
            const cardSelectBtn = panelBody.querySelector('#card-select-btn');
            if (cardFileInput && cardSelectBtn) {
                cardSelectBtn.addEventListener('click', () => cardFileInput.click());
                cardFileInput.addEventListener('change', (e) => {
                    cardPhoto = e.target.files[0] || null;
                    renderPanel();
                });
            }

            // ── Bind: Smart Fit & Snap Toggle ──────────────────────────────
            const smartFitBtn = panelBody.querySelector('.smart-fit-btn');
            if (smartFitBtn) {
                smartFitBtn.addEventListener('click', () => {
                    smartFit = !smartFit;
                    renderPanel();
                });
            }
            
            const autoSnapBtn = panelBody.querySelector('.auto-snap-btn');
            if (autoSnapBtn) {
                autoSnapBtn.addEventListener('click', () => {
                    window.craftoolsAutoSnap = window.craftoolsAutoSnap === false ? true : false;
                    renderPanel();
                });
            }
            
            const snapAlignSelect = panelBody.querySelector('.snap-align-select');
            if (snapAlignSelect) {
                snapAlignSelect.addEventListener('change', (e) => {
                    window.craftoolsAutoSnapAlign = e.target.value;
                });
            }

            // ── Bind: Clear Album ──────────────────────────────────────────
            const albumClearBtn = panelBody.querySelector('#album-clear-btn');
            if (albumClearBtn) {
                albumClearBtn.addEventListener('click', () => {
                    // Limpar a página toda, assim como no botão de apagar página
                    pageEl.innerHTML = '';
                    pageEl.style.backgroundColor = '#ffffff';
                    const bgEl = document.getElementById('page-bg-color');
                    if (bgEl) bgEl.value = '#ffffff';

                    editor.querySelectorAll('.craftools-element').forEach(el => {
                        if (el.deselect) el.deselect();
                    });
                    renderPanel();
                    
                    const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element: pageEl } });
                    pageEl.dispatchEvent(event);
                });
            }

            // ── Bind: Generate ─────────────────────────────────────────────
            const generateBtn = panelBody.querySelector('#album-generate-btn');
            if (generateBtn) {
                generateBtn.addEventListener('click', () => {
                    if (selectedMode === 'album') {
                        this.processAlbum(editor, pageEl, selectedSize, selectedTemplate, photos, smartFit);
                    } else {
                        const qty = cardQuantityMode === 'auto'
                            ? calcPerPage(selectedTemplate, selectedSize)
                            : cardManualQty;
                        this.processBusinessCard(editor, pageEl, selectedSize, selectedTemplate, cardPhoto, qty, smartFit);
                    }
                    if(defaultMenu) defaultMenu.classList.remove('d-none');
                    if(panelBody) panelBody.classList.add('d-none');
                    if(closePanel) closePanel.classList.add('d-none');
                    if(panelLogo) panelLogo.classList.remove('d-none');
                    if(panelTitle) panelTitle.textContent = '';
                    if(rightPanel) {
                        rightPanel.classList.remove('panel-open');
                        rightPanel.classList.remove('mobile-modal-mode');
                    }
                    // Mobile: fecha o overlay ao processar o álbum
                    if(window.innerWidth <= 768) {
                        const sideOverlay = document.querySelector('.craftools-sidebar-overlay');
                        if(sideOverlay) sideOverlay.classList.remove('visible');
                        const menuIcon2 = document.getElementById('pwa-menu-icon');
                        if(menuIcon2) menuIcon2.textContent = 'menu';
                    }
                });
            }

            // ── Bind: Borders ──────────────────────────────────────────────
            if (existingGrid) {
                // Mock an element structure for CommonProperties
                const mockElement = {
                    contentArea: pageEl,
                    style: existingGrid.style,
                    dispatchEvent: () => {}
                };

                CommonProperties.renderBorder(panelBody, mockElement, '.craftools-grid-cell', () => {
                     const bWidth = panelBody.querySelector('#cp-border-w')?.value || 0;
                     const bStyle = panelBody.querySelector('#cp-border-style')?.value || 'none';
                     const bColor = panelBody.querySelector('#cp-border-color')?.value || '#000000';
                     Craftools_LayoutGrid.updateBorders(editor, bWidth, bStyle, bColor);
                });
            }

            // Bind accordion toggles at the very end so dynamic accordions like "Forma" are also bound
            PanelUI.bindAccordions(panelBody);
        };

        renderPanel();
        
        if(defaultMenu) defaultMenu.classList.add('d-none');
        if(panelBody) panelBody.classList.remove('d-none');
        if(closePanel) closePanel.classList.remove('d-none');
        if(panelLogo) panelLogo.classList.add('d-none');
        if(rightPanel) {
            rightPanel.classList.add('panel-open');
            rightPanel.classList.remove('sidenav-collapsed');
            if (window.innerWidth <= 768) rightPanel.classList.add('mobile-modal-mode');
        }
        const menuIcon = document.getElementById('pwa-menu-icon');
        if(menuIcon && menuIcon.textContent !== 'close') {
            menuIcon.textContent = 'close';
        }
        // Mobile: mostra o overlay para que tocar fora feche o painel
        if(window.innerWidth <= 768) {
            const sideOverlay = document.querySelector('.craftools-sidebar-overlay');
            if(sideOverlay) sideOverlay.classList.add('visible');
        }
    }

    // ── Helpers: build a locked ImageTool element for a grid cell ────────────
    static _buildCellElement(editor, src, pl, pt, cw, ch, unit = 'px') {

        const imgEl = ImageTool.createElement('imagem', editor);
        imgEl.setAttribute('x', pl + unit);
        imgEl.setAttribute('y', pt + unit);
        imgEl.setAttribute('w', cw + unit);
        imgEl.setAttribute('h', ch + unit);
        imgEl.setAttribute('data-locked', 'true');

        imgEl._craftoolsMeta.bgBlur = 30; // Ativa por padrão no álbum
        imgEl._craftoolsMeta.src = src;
        const imgTag = imgEl.querySelector('img');
        if (imgTag) imgTag.src = src;

        return imgEl;
    }

    static _cellDimensions(template, pageSize) {
        const p = template.cellPadding.split(" ");
        const pt = parseFloat(p[0]);
        const pr = parseFloat(p[1]);
        const pb = parseFloat(p[2]);
        const pl = parseFloat(p[3]);
        const isStripe = !!(template.cellLines || template.cellColumns);
        const sLines = template.cellLines   || 1;
        const sCols  = template.cellColumns || 1;
        // For photostrips, each slot is a subdivision of the stripe's inner area
        const innerW = template.cellWidth  - pl - pr;
        const innerH = template.cellHeight - pt - pb;
        return {
            pt: isStripe ? 0  : pt,
            pr: isStripe ? 0  : pr,
            pb: isStripe ? 0  : pb,
            pl: isStripe ? 0  : pl,
            cw: isStripe ? innerW / sCols  : innerW,
            ch: isStripe ? innerH / sLines : innerH,
            isStripe,
        };
    }

    // ── Mode 1: Álbum de fotos ────────────────────────────────────────────────
    static async processAlbum(editor, startPage, pageSize, template, files, smartFit = false) {
        const images = await Promise.all(files.map(f => new Promise(resolve => {
            const fr = new FileReader();
            fr.onload = e => {
                const img = new Image();
                img.onload = () => resolve({ src: e.target.result, w: img.width, h: img.height });
                img.src = e.target.result;
            };
            fr.readAsDataURL(f);
        })));

        const gridSystem = new Craftools_LayoutGrid(editor, startPage, pageSize, template);
        const unit = pageSize.sizeUnit || 'px';

        await gridSystem.render(images, (cellContainer, imgData, idx, slotOverride) => {
            cellContainer.style.background = "white";

            const activeSlot = slotOverride || template;
            const { pt, pr, pb, pl, cw, ch } = this._cellDimensions(activeSlot, pageSize);

            // In photostrip mode, the slot fills the entire container (no padding offset)
            // because the inner-grid already handles the stripe-level padding positioning.
            const imgEl = this._buildCellElement(editor, imgData.src, pl, pt, cw, ch, unit);

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
                    
                    const imgTag = imgEl.querySelector('img');
                    if (imgTag) imgTag.style.objectFit = 'contain';
                }
            }

            cellContainer.appendChild(imgEl);
        });

        // Wire os botões de editar cell
        AlbumTool._bindCellEditButtons(editor);
    }

    // ── Mode 2: Cartão de visita ──────────────────────────────────────────────
    static async processBusinessCard(editor, startPage, pageSize, template, file, quantity, smartFit = false) {
        const imgData = await new Promise(resolve => {
            const fr = new FileReader();
            fr.onload = e => {
                const img = new Image();
                img.onload = () => resolve({ src: e.target.result, w: img.width, h: img.height });
                img.src = e.target.result;
            };
            fr.readAsDataURL(file);
        });

        // Único objeto meta compartilhado entre todos os cartões
        const sharedMeta = ImageTool.getDefaultMeta();
        sharedMeta.src = imgData.src;

        const allElements = [];
        const items = Array(quantity).fill(imgData);

        const gridSystem = new Craftools_LayoutGrid(editor, startPage, pageSize, template);
        const unit = pageSize.sizeUnit || 'px';

        await gridSystem.render(items, (cellContainer, imgData, idx, slotOverride) => {
            const grid = cellContainer.closest('.craftools-grid-container');
            if (grid) grid.dataset.gridMode = 'card';
            
            cellContainer.style.background = "white";

            const activeSlot = slotOverride || template;
            const { pt, pl, cw, ch } = this._cellDimensions(activeSlot, pageSize);

            const imgEl = ImageTool.createElement('imagem', editor);
            imgEl.setAttribute('x', pl + unit);
            imgEl.setAttribute('y', pt + unit);
            imgEl.setAttribute('w', cw + unit);
            imgEl.setAttribute('h', ch + unit);
            imgEl.setAttribute('data-locked', 'true');

            // Camada de fundo desfocada interna
            sharedMeta.bgBlur = 30;

            if (smartFit) {
                const slotAspect = cw / ch;
                const imgAspect = imgData.w / imgData.h;
                
                if ((slotAspect > 1 && imgAspect < 1) || (slotAspect < 1 && imgAspect > 1)) {
                    sharedMeta.rotation = 90;
                    sharedMeta.objectFit = 'contain';
                    
                    const sContain = Math.min(cw / imgData.w, ch / imgData.h);
                    const rW = imgData.w * sContain;
                    const rH = imgData.h * sContain;
                    const zoom = Math.max(cw / rH, ch / rW);
                    
                    sharedMeta.zoom = parseFloat(zoom.toFixed(2));
                }
            }

            // Compartilha o mesmo meta — zoom/pan/filtros ficam sincronizados
            imgEl._craftoolsMeta = sharedMeta;

            const imgTag = imgEl.querySelector('img');
            if (imgTag) {
                imgTag.src = imgData.src;
                if (smartFit && sharedMeta.objectFit === 'contain') {
                    imgTag.style.objectFit = 'contain';
                }
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
    static _bindCellEditButtons(editor) {
        editor.querySelectorAll('.cell-edit-btn').forEach(btn => {
            // Remove listener antigo se houver (re-geração)
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cellEl = newBtn.closest('.craftools-grid-cell');
                if (cellEl) {
                    const imgEl = cellEl.querySelector('craftools-element[data-craftool="imagem"]');
                    if (imgEl) {
                        imgEl.select();
                    } else {
                        // Caso a célula não tenha imagem por algum motivo, abre as propriedades da célula legada
                        CellPanel.open(editor, cellEl);
                    }
                }
            });
        });
    }
}
