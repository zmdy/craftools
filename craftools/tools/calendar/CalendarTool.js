import { I18n } from "../../settings/Translations.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { Notify } from "../../utils/Notify.js";
import { CalendarRenderer } from "../../utils/CalendarRenderer.js";
import "./CalendarTool_Translations.js";
import "../../components/CtFontSelect.js";

const c = (key) => I18n.t('calendarTool.' + key);

const MONTH_NAMES_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Fontes disponíveis nos seletores de "Estilo" (lista reduzida, print-friendly;
// TextTool.js tem sua própria lista maior, mas não é reaproveitável daqui).
const CALENDAR_FONTS = ['DM Sans', 'DM Serif Display', 'Open Sans', 'Georgia', 'Arial', 'Times New Roman', 'Quicksand', 'Lobster'];

const loadCalendarFonts = () => {
    const googleFonts = CALENDAR_FONTS.filter(f => !['Arial', 'Times New Roman', 'Georgia'].includes(f));
    const linkId = 'craftools-dynamic-fonts';
    let link = document.getElementById(linkId);
    if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
    const fontQuery = googleFonts.map(f => f.replace(/\s+/g, '+')).join('|');
    link.href = `https://fonts.googleapis.com/css?family=${fontQuery}&display=swap`;
};

// ── Presets de grid (todos para folha A4 210x297mm, margem 5mm) ────────────
// cols/rows já calculados para caber exatamente na área útil da folha
// (ver comentário de cada um) -- não dependem de nenhum motor externo.
const GRID_PRESETS = [
    { id: 'grid20', labelKey: 'layout20', cellWidth: 50, cellHeight: 50, cols: 4, rows: 5, margin: 5 },     // 4x5 = 20
    { id: 'grid8sq', labelKey: 'layout8sq', cellWidth: 70, cellHeight: 70, cols: 2, rows: 4, margin: 5 },   // 2x4 = 8
    { id: 'grid8rect', labelKey: 'layout8rect', cellWidth: 100, cellHeight: 70, cols: 2, rows: 4, margin: 5 }, // 2x4 = 8
    { id: 'grid4', labelKey: 'layout4', cellWidth: 100, cellHeight: 140, cols: 2, rows: 2, margin: 5 },     // 2x2 = 4
    { id: 'grid2', labelKey: 'layout2', cellWidth: 200, cellHeight: 140, cols: 1, rows: 2, margin: 5 },     // 1x2 = 2
];

const MAX_SHEETS_SAFETY = 60;

/**
 * CalendarTool
 *
 * Painel "Calendário" — assume o painel lateral inteiro (como GeradorTool /
 * AgendaExportTool), com abas: Modelo, Layout, Preenchimento, Estilo, Gerar.
 * Ao clicar em "Gerar", constrói páginas reais no documento (como o Álbum
 * faz com fotos), usando `.craftools-grid-container`/`.craftools-grid-cell`
 * (mesmas classes do motor de grid dos álbuns) preenchidas com cards de
 * calendário estáticos (CalendarRenderer.js) -- sem os controles de
 * arrastar/editar de foto, que não fazem sentido para conteúdo
 * auto-gerado.
 */
export class CalendarTool {

    static setup(editor) {
        const panelTitle = document.getElementById('panel-title');
        const panelBody = document.getElementById('panel-body');
        if (panelTitle) panelTitle.textContent = c('panelTitle');
        if (!panelBody) return;

        loadCalendarFonts();

        const now = new Date();
        const state = {
            model: 'simples',
            gridId: 'grid20',
            fillMode: 'sequencial',
            startYear: now.getFullYear(),
            startMonth: now.getMonth() + 1,
            sheetCount: 1,
            endYear: now.getFullYear(),
            endMonth: 12,
            theme: CalendarRenderer.defaultTheme(),
        };

        const currentPreset = () => GRID_PRESETS.find(p => p.id === state.gridId) || GRID_PRESETS[0];

        const renderPanel = () => {
            const sectionModel = this._renderModelSection(state);
            const sectionLayout = this._renderLayoutSection(state);
            const sectionFillMode = this._renderFillModeSection(state);
            const sectionStyle = this._renderStyleSection(state);
            const sectionGenerate = this._renderGenerateSection(state, currentPreset());

            panelBody.innerHTML = `
                <div id="cal-root">
                    ${PanelUI.accordion('cal-modelo', 'auto_stories', c('tabModel'), sectionModel, { open: true })}
                    ${PanelUI.accordion('cal-layout', 'grid_view', c('tabLayout'), sectionLayout)}
                    ${PanelUI.accordion('cal-preenchimento', 'repeat', c('tabFillMode') + ' / ' + c('tabPeriod'), sectionFillMode)}
                    ${PanelUI.accordion('cal-estilo', 'palette', c('tabStyle'), sectionStyle)}
                    ${PanelUI.accordion('cal-gerar', 'auto_awesome', c('tabGenerate'), sectionGenerate)}
                </div>
            `;

            PanelUI.bindAccordions(panelBody);
            bindEvents();
        };

        const bindEvents = () => {
            const root = panelBody.querySelector('#cal-root');
            if (!root) return;

            // ── Modelo ────────────────────────────────────────────────────
            root.querySelectorAll('.cal-model-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    state.model = btn.dataset.model;
                    renderPanel();
                });
            });

            // ── Layout ────────────────────────────────────────────────────
            root.querySelectorAll('.cal-grid-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    state.gridId = btn.dataset.gridId;
                    renderPanel();
                });
            });

            // ── Modo de preenchimento ─────────────────────────────────────
            root.querySelectorAll('.cal-fillmode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    state.fillMode = btn.dataset.fillMode;
                    renderPanel();
                });
            });

            const startMonthSel = root.querySelector('#cal-start-month');
            const startYearInput = root.querySelector('#cal-start-year');
            const endMonthSel = root.querySelector('#cal-end-month');
            const endYearInput = root.querySelector('#cal-end-year');
            const sheetCountInput = root.querySelector('#cal-sheet-count');

            if (startMonthSel) startMonthSel.addEventListener('change', () => {
                state.startMonth = parseInt(startMonthSel.value, 10);
                this._refreshGenerateSummary(root, state, currentPreset());
            });
            if (startYearInput) startYearInput.addEventListener('input', () => {
                state.startYear = parseInt(startYearInput.value, 10) || state.startYear;
                this._refreshGenerateSummary(root, state, currentPreset());
            });
            if (endMonthSel) endMonthSel.addEventListener('change', () => {
                state.endMonth = parseInt(endMonthSel.value, 10);
                this._refreshGenerateSummary(root, state, currentPreset());
            });
            if (endYearInput) endYearInput.addEventListener('input', () => {
                state.endYear = parseInt(endYearInput.value, 10) || state.endYear;
                this._refreshGenerateSummary(root, state, currentPreset());
            });
            if (sheetCountInput) sheetCountInput.addEventListener('input', () => {
                state.sheetCount = Math.max(1, parseInt(sheetCountInput.value, 10) || 1);
                this._refreshGenerateSummary(root, state, currentPreset());
            });

            // ── Estilo (delegação: todos os inputs com data-part/data-field) ──
            const stylePreview = root.querySelector('#cal-style-preview');
            const refreshPreview = () => {
                if (!stylePreview) return;
                stylePreview.innerHTML = '';
                const card = CalendarRenderer.buildCardElement(state.startYear, state.startMonth, { model: state.model, theme: state.theme });
                stylePreview.appendChild(card);
            };

            root.querySelectorAll('[data-part][data-field]').forEach(input => {
                const evt = (input.tagName === 'SELECT' || input.type === 'color' || input.type === 'number') ? 'input' : 'change';
                input.addEventListener(evt, () => {
                    const part = input.dataset.part;
                    const field = input.dataset.field;
                    const value = input.type === 'number' ? (parseFloat(input.value) || 0) : input.value;
                    if (part === 'cellBorder') {
                        state.theme.cellBorder[field] = value;
                    } else if (part === 'cell') {
                        state.theme.cellBg = value;
                    } else if (state.theme[part]) {
                        state.theme[part][field] = value;
                    }
                    refreshPreview();
                });
            });

            refreshPreview();

            // ── Gerar ─────────────────────────────────────────────────────
            const generateBtn = root.querySelector('#cal-generate-btn');
            if (generateBtn) {
                generateBtn.addEventListener('click', async () => {
                    const plan = this._buildSheetPlan(state, currentPreset());
                    if (plan === null) {
                        Notify.toast(c('tooManySheets'), 'error', 6000);
                        return;
                    }
                    if (!plan.length) return;

                    generateBtn.disabled = true;
                    const originalHtml = generateBtn.innerHTML;
                    generateBtn.innerHTML = `<span class="material-symbols-outlined spin" style="font-size:16px;">progress_activity</span> ${c('generating')}`;
                    try {
                        await this._generate(editor, plan, currentPreset(), state);
                        Notify.toast(c('generateSuccess'), 'success');
                    } catch (err) {
                        console.error('[CalendarTool] Falha ao gerar calendário:', err);
                        Notify.toast(c('generateError'), 'error', 6000);
                    } finally {
                        generateBtn.disabled = false;
                        generateBtn.innerHTML = originalHtml;
                    }
                });
            }
        };

        renderPanel();
    }

    // ── Aba: Modelo ───────────────────────────────────────────────────────

    static _renderModelSection(state) {
        return `
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${['simples', 'completo'].map(m => `
                    <button type="button" class="cal-model-btn craftools-pill ${state.model === m ? 'active' : ''}" data-model="${m}"
                        style="width:100%; text-align:left; padding:10px; display:flex; flex-direction:column; align-items:flex-start; gap:2px;">
                        <span style="font-weight:600; font-size:12px;">${c(m === 'simples' ? 'modelSimples' : 'modelCompleto')}</span>
                        <span style="font-size:10px; color:var(--text-secondary); font-weight:400;">${c(m === 'simples' ? 'modelSimplesDesc' : 'modelCompletoDesc')}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    // ── Aba: Layout ───────────────────────────────────────────────────────

    static _renderLayoutSection(state) {
        return `
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${GRID_PRESETS.map(p => `
                    <button type="button" class="cal-grid-btn craftools-pill ${state.gridId === p.id ? 'active' : ''}" data-grid-id="${p.id}"
                        style="width:100%; text-align:left; padding:10px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; font-weight:600;">${c(p.labelKey)}</span>
                        <span style="font-size:10px; color:var(--text-secondary);">${p.cols * p.rows} ${c('slotsSuffix')}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    // ── Aba: Modo de preenchimento + Período ─────────────────────────────

    static _renderFillModeSection(state) {
        const monthSelect = (id, selectedMonth) => `
            <select id="${id}" class="craftools-select" style="width:100%;">
                ${MONTH_NAMES_PT.map((name, i) => `<option value="${i + 1}" ${selectedMonth === i + 1 ? 'selected' : ''}>${name}</option>`).join('')}
            </select>
        `;

        const fillModes = `
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
                ${['sequencial', 'repetido1', 'repetido2'].map(fm => `
                    <button type="button" class="cal-fillmode-btn craftools-pill ${state.fillMode === fm ? 'active' : ''}" data-fill-mode="${fm}"
                        style="width:100%; text-align:left; padding:10px; display:flex; flex-direction:column; align-items:flex-start; gap:2px;">
                        <span style="font-weight:600; font-size:12px;">${c('fill' + fm.charAt(0).toUpperCase() + fm.slice(1))}</span>
                        <span style="font-size:10px; color:var(--text-secondary); font-weight:400;">${c('fill' + fm.charAt(0).toUpperCase() + fm.slice(1) + 'Desc')}</span>
                    </button>
                `).join('')}
            </div>
        `;

        let periodHtml = '';
        if (state.fillMode === 'sequencial') {
            periodHtml = `
                <div class="ct-field">
                    <span class="craftools-label">${c('startMonthYear')}</span>
                    <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px;">
                        ${monthSelect('cal-start-month', state.startMonth)}
                        <input type="number" id="cal-start-year" class="craftools-input" value="${state.startYear}" min="1900" max="2200">
                    </div>
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${c('sheetCount')}</span>
                    <input type="number" id="cal-sheet-count" class="craftools-input" value="${state.sheetCount}" min="1" max="${MAX_SHEETS_SAFETY}" style="width:100%;">
                    <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${c('sheetCountHelp')}</span>
                </div>
            `;
        } else {
            periodHtml = `
                <div class="ct-field">
                    <span class="craftools-label">${c('startMonthYear')}</span>
                    <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px;">
                        ${monthSelect('cal-start-month', state.startMonth)}
                        <input type="number" id="cal-start-year" class="craftools-input" value="${state.startYear}" min="1900" max="2200">
                    </div>
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${c('endMonthYear')}</span>
                    <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px;">
                        ${monthSelect('cal-end-month', state.endMonth)}
                        <input type="number" id="cal-end-year" class="craftools-input" value="${state.endYear}" min="1900" max="2200">
                    </div>
                    <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${c('periodHelp')}</span>
                </div>
            `;
        }

        return fillModes + periodHtml;
    }

    // ── Aba: Estilo (controle granular por parte) ─────────────────────────

    static _fontOptions(selected) {
        return CALENDAR_FONTS.map(f => `<option value="${f}" ${selected === f ? 'selected' : ''}>${f}</option>`).join('');
    }

    static _renderPartRow(key, label, part, opts = {}) {
        return `
            <div class="ct-field" style="border:1px solid var(--border, #e4e4e7); border-radius:8px; padding:8px; margin-bottom:8px;">
                <div style="font-weight:600; font-size:11px; margin-bottom:6px;">${label}</div>
                <div style="display:grid; grid-template-columns:${opts.showBg ? '1fr 1fr' : '1fr'}; gap:8px; margin-bottom:6px;">
                    ${opts.showBg ? `
                        <div>
                            <span class="craftools-label">${c('fieldBg')}</span>
                            <input type="color" class="craftools-color-swatch" data-part="${key}" data-field="bg" value="${part.bg}" style="width:100%;">
                        </div>
                    ` : ''}
                    <div>
                        <span class="craftools-label">${opts.colorLabel || c('fieldColor')}</span>
                        <input type="color" class="craftools-color-swatch" data-part="${key}" data-field="color" value="${part.color}" style="width:100%;">
                    </div>
                </div>
                ${opts.secondColorField ? `
                    <div class="ct-field" style="margin-bottom:6px;">
                        <span class="craftools-label">${opts.secondColorLabel}</span>
                        <input type="color" class="craftools-color-swatch" data-part="${key}" data-field="${opts.secondColorField}" value="${part[opts.secondColorField]}" style="width:100%;">
                    </div>
                ` : ''}
                <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px;">
                    <div>
                        <span class="craftools-label">${c('fieldFont')}</span>
                        <ct-font-select class="craftools-select" data-part="${key}" data-field="font" style="width:100%;">${this._fontOptions(part.font)}</ct-font-select>
                    </div>
                    <div>
                        <span class="craftools-label">${c('fieldFontSize')}</span>
                        <input type="number" class="craftools-input" data-part="${key}" data-field="fontSize" value="${part.fontSize}" step="0.5" min="2" max="30" style="width:100%;">
                    </div>
                </div>
            </div>
        `;
    }

    static _renderStyleSection(state) {
        const t = state.theme;
        const rows = [
            this._renderPartRow('titleBar', c('styleTitleBar'), t.titleBar, { showBg: true }),
            this._renderPartRow('weekHeader', c('styleWeekHeader'), t.weekHeader, { showBg: true }),
            this._renderPartRow('dayNumbers', c('styleDayNumbers'), t.dayNumbers, { secondColorField: 'sundayColor', secondColorLabel: c('fieldSundayColor') }),
            this._renderPartRow('holidays', c('styleHolidays'), t.holidays, {}),
        ];
        if (state.model === 'completo') {
            rows.push(this._renderPartRow('moonPhases', c('styleMoonPhases'), t.moonPhases, {}));
        }

        const borderRow = `
            <div class="ct-field" style="border:1px solid var(--border, #e4e4e7); border-radius:8px; padding:8px; margin-bottom:8px;">
                <div style="font-weight:600; font-size:11px; margin-bottom:6px;">${c('styleCellBorder')}</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:6px;">
                    <div>
                        <span class="craftools-label">${c('fieldCellBg')}</span>
                        <input type="color" class="craftools-color-swatch" data-part="cell" data-field="cellBg" value="${t.cellBg}" style="width:100%;">
                    </div>
                    <div>
                        <span class="craftools-label">${c('fieldBorderColor')}</span>
                        <input type="color" class="craftools-color-swatch" data-part="cellBorder" data-field="color" value="${t.cellBorder.color}" style="width:100%;">
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <div>
                        <span class="craftools-label">${c('fieldBorderWidth')}</span>
                        <input type="number" class="craftools-input" data-part="cellBorder" data-field="width" value="${t.cellBorder.width}" min="0" max="10" style="width:100%;">
                    </div>
                    <div>
                        <span class="craftools-label">${c('fieldBorderStyle')}</span>
                        <select class="craftools-select" data-part="cellBorder" data-field="style" style="width:100%;">
                            ${['none', 'solid', 'dashed', 'dotted'].map(s => `<option value="${s}" ${t.cellBorder.style === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
        `;

        return `
            <div class="ct-field">
                <span class="craftools-label">${c('stylePreviewLabel')}</span>
                <div id="cal-style-preview" style="width:100%; aspect-ratio:1/1; max-width:220px; margin:0 auto 12px;"></div>
            </div>
            ${rows.join('')}
            ${borderRow}
        `;
    }

    // ── Aba: Gerar ────────────────────────────────────────────────────────

    static _renderGenerateSection(state, preset) {
        const plan = this._buildSheetPlan(state, preset);
        const total = plan ? plan.length : 0;
        return `
            <p style="font-size:11px; color:var(--text-secondary); margin-bottom:10px;">${c('generateIntro')}</p>
            <div class="ct-field" id="cal-generate-summary-wrap" style="display:flex; justify-content:space-between; align-items:center; background:rgba(99,102,241,0.08); border-radius:6px; padding:8px 10px; margin-bottom:12px;">
                <span style="font-size:12px;">${c('generateSummary')}</span>
                <span id="cal-generate-summary" style="font-size:14px; font-weight:700;">${total}</span>
            </div>
            <button type="button" id="cal-generate-btn" class="craftools-topbtn" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px;">
                <span class="material-symbols-outlined" style="font-size:18px;">auto_awesome</span>
                ${c('generateButton')}
            </button>
        `;
    }

    static _refreshGenerateSummary(root, state, preset) {
        const el = root.querySelector('#cal-generate-summary');
        if (!el) return;
        const plan = this._buildSheetPlan(state, preset);
        el.textContent = plan ? plan.length : '—';
    }

    // ── Planejamento de folhas (meses por slot, por folha) ────────────────

    /**
     * @returns {Array<Array<{year:number,month:number}|null>>|null} null se
     * o plano excederia o limite de segurança de folhas.
     */
    static _buildSheetPlan(state, preset) {
        const slotsPerSheet = preset.cols * preset.rows;

        if (state.fillMode === 'sequencial') {
            const sheetCount = Math.max(1, Math.min(MAX_SHEETS_SAFETY, state.sheetCount || 1));
            const total = sheetCount * slotsPerSheet;
            const months = [];
            let y = state.startYear, m = state.startMonth;
            for (let i = 0; i < total; i++) {
                months.push({ year: y, month: m });
                m++;
                if (m > 12) { m = 1; y++; }
            }
            const sheets = [];
            for (let i = 0; i < months.length; i += slotsPerSheet) {
                sheets.push(months.slice(i, i + slotsPerSheet));
            }
            return sheets;
        }

        // repetido1 / repetido2: enumera os meses do período (inclusive)
        const periodMonths = [];
        let y = state.startYear, m = state.startMonth;
        let guard = 0;
        while ((y < state.endYear || (y === state.endYear && m <= state.endMonth)) && guard < 2000) {
            periodMonths.push({ year: y, month: m });
            m++;
            if (m > 12) { m = 1; y++; }
            guard++;
        }
        if (!periodMonths.length) return [];

        if (state.fillMode === 'repetido1') {
            if (periodMonths.length > MAX_SHEETS_SAFETY) return null;
            return periodMonths.map(pm => new Array(slotsPerSheet).fill(pm));
        }

        // repetido2 -- 2 meses por folha, metade dos slots cada
        const half = Math.floor(slotsPerSheet / 2);
        const sheetsNeeded = Math.ceil(periodMonths.length / 2);
        if (sheetsNeeded > MAX_SHEETS_SAFETY) return null;

        const sheets = [];
        for (let i = 0; i < periodMonths.length; i += 2) {
            const monthA = periodMonths[i];
            const monthB = periodMonths[i + 1] || null;
            const sheet = [
                ...new Array(half).fill(monthA),
                ...new Array(slotsPerSheet - half).fill(monthB),
            ];
            sheets.push(sheet);
        }
        return sheets;
    }

    // ── Geração real das páginas ──────────────────────────────────────────

    static async _generate(editor, sheets, preset, state) {
        const { PageTool } = await import('../page/PageTool.js');
        const pagesWrapper = editor.querySelector('#pages-wrapper');
        if (!pagesWrapper) return;

        for (let s = 0; s < sheets.length; s++) {
            PageTool.addNewPage(editor);
            const page = pagesWrapper.querySelector('.craftools-page:last-child');
            if (!page) continue;

            page.style.width = '210mm';
            page.style.minHeight = '297mm';
            page.style.background = '#ffffff';
            page.style.position = 'relative';
            page.innerHTML = '';

            const grid = document.createElement('div');
            grid.className = 'craftools-grid-container';
            grid.style.cssText = `
                position:absolute; top:${preset.margin}mm; right:${preset.margin}mm; bottom:${preset.margin}mm; left:${preset.margin}mm;
                display:grid; grid-template-columns:repeat(${preset.cols}, ${preset.cellWidth}mm); grid-auto-rows:${preset.cellHeight}mm;
                gap:0mm; box-sizing:border-box;
            `;
            page.appendChild(grid);

            sheets[s].forEach(slot => {
                const cell = document.createElement('div');
                cell.className = 'craftools-grid-cell';
                cell.style.cssText = `width:${preset.cellWidth}mm; height:${preset.cellHeight}mm; box-sizing:border-box; position:relative; overflow:hidden;`;
                if (slot) {
                    const card = CalendarRenderer.buildCardElement(slot.year, slot.month, { model: state.model, theme: state.theme });
                    cell.appendChild(card);
                }
                grid.appendChild(cell);
            });
        }

        document.dispatchEvent(new CustomEvent('craftools-page-add', { bubbles: true }));
    }
}
