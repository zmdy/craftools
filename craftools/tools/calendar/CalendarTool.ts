/**
 * CalendarTool.ts
 *
 * "Calendário" panel — takes over the entire side panel (like GeneratorTool /
 * AgendaExportTool), with 5 accordion tabs: Modelo, Layout, Preenchimento,
 * Estilo, Gerar. Clicking "Gerar" builds real pages in the document (like
 * the Album wizard does with photos), using the same
 * `.craftools-grid-container` / `.craftools-grid-cell` grid engine, filled
 * with static calendar cards (CalendarRenderer.buildCardElement) instead of
 * draggable/editable photo slots.
 *
 * Recovered from the pre-migration CalendarTool.js (deleted by the "Purge
 * legacy JS" commit without this logic being ported) -- the previous
 * CalendarTool.ts was a ToolRegistry.register()-only stub with no setup()
 * at all, so clicking the sidebar button threw
 * "Cannot read properties of undefined (reading 'bind')" in Editor.ts's
 * PANEL_SETUP_MAP.
 */
import { I18n } from '../../settings/Translations.js';
import { PanelUI } from '../../utils/PanelUI';
import { Notify } from '../../utils/Notify';
import { CalendarRenderer, type CalendarTheme } from '../../utils/CalendarRenderer';
import { PageTool } from '../page/PageTool.js';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { AppSettings } from '../../utils/AppSettings.js';
import './CalendarTool_Translations.js';
import '../../components/CtFontSelect.js';

const c = (key: string): string => I18n.t('calendarTool.' + key);

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Fonts available in the "Estilo" selectors (reduced, print-friendly list;
// TextTool.ts has its own larger list, but it isn't reusable from here).
const CALENDAR_FONTS = ['DM Sans', 'DM Serif Display', 'Open Sans', 'Georgia', 'Arial', 'Times New Roman', 'Quicksand', 'Lobster'];

const loadCalendarFonts = (): void => {
  const googleFonts = CALENDAR_FONTS.filter(f => !['Arial', 'Times New Roman', 'Georgia'].includes(f));
  const linkId = 'craftools-dynamic-fonts';
  let link = document.getElementById(linkId) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  const fontQuery = googleFonts.map(f => f.replace(/\s+/g, '+')).join('|');
  link.href = `https://fonts.googleapis.com/css?family=${fontQuery}&display=swap`;
};

interface GridPreset {
  id: string;
  labelKey: string;
  cellWidth: number;
  cellHeight: number;
  cols: number;
  rows: number;
  margin: number;
}

// ── Grid presets (all for an A4 210x297mm sheet, 5mm margin) ───────────────
// cols/rows are pre-computed to fit exactly the usable sheet area -- no
// external layout engine involved.
const GRID_PRESETS: GridPreset[] = [
  { id: 'grid20',    labelKey: 'layout20',    cellWidth: 50,  cellHeight: 50,  cols: 4, rows: 5, margin: 5 }, // 4x5 = 20
  { id: 'grid8sq',   labelKey: 'layout8sq',   cellWidth: 70,  cellHeight: 70,  cols: 2, rows: 4, margin: 5 }, // 2x4 = 8
  { id: 'grid8rect', labelKey: 'layout8rect', cellWidth: 100, cellHeight: 70,  cols: 2, rows: 4, margin: 5 }, // 2x4 = 8
  { id: 'grid4',     labelKey: 'layout4',     cellWidth: 100, cellHeight: 140, cols: 2, rows: 2, margin: 5 }, // 2x2 = 4
  { id: 'grid2',     labelKey: 'layout2',     cellWidth: 200, cellHeight: 140, cols: 1, rows: 2, margin: 5 }, // 1x2 = 2
];

const MAX_SHEETS_SAFETY = 60;

type FillMode = 'sequencial' | 'repetido1' | 'repetido2';
type CalendarModel = 'simples' | 'completo';

interface CalendarState {
  model: CalendarModel;
  gridId: string;
  fillMode: FillMode;
  startYear: number;
  startMonth: number;
  sheetCount: number;
  endYear: number;
  endMonth: number;
  theme: CalendarTheme;
  /** true (default) = week starts Sunday; false = Monday. Same option CalendarRenderer.ts's buildCardHtml()/buildCardElement() already support for MiniCalendarTool.ts. */
  weekStartSunday: boolean;
}

type MonthSlot = { year: number; month: number } | null;

/** Editor instance shape this tool relies on beyond plain HTMLElement. */
type EditorEl = HTMLElement & {
  _savedPageHtml?: string;
  _savedPageCssText?: string;
  restoreOriginalCanvas?: () => void;
};

export class CalendarTool {

  public static setup(editor: HTMLElement): void {
    const panelTitle  = document.getElementById('panel-title');
    const panelBody   = document.getElementById('panel-body');
    const defaultMenu = document.getElementById('panel-default-menu');
    const closePanel  = document.getElementById('close-panel');
    const rightPanel  = document.getElementById('right-panel');
    if (panelTitle) panelTitle.textContent = c('panelTitle');
    if (!panelBody) return;

    // Reveal the panel body / hide the default sidebar menu -- matches
    // AlbumWizard.ts's setup(). Previously only the title was set here, so
    // calling this from a context that doesn't already have the panel open
    // (Editor.ts's tool-drag flow does, via openPanelMenu(), but
    // PageTool.ts's "click a calendar-generated page" handler calls this
    // directly) left panelBody's real content built correctly but hidden
    // behind the still-visible default menu -- the title changed while the
    // body underneath looked untouched.
    if (defaultMenu) defaultMenu.classList.add('d-none');
    if (panelBody)   panelBody.classList.remove('d-none');
    if (closePanel)  closePanel.classList.remove('d-none');
    if (rightPanel) {
      rightPanel.classList.add('panel-open');
      rightPanel.classList.remove('sidenav-collapsed');
      rightPanel.style.removeProperty('width');
      if (rightPanel.dataset.expandedWidth) rightPanel.style.width = rightPanel.dataset.expandedWidth;
      if (window.innerWidth <= 768) rightPanel.classList.add('mobile-modal-mode');
    }
    const menuIcon = document.getElementById('pwa-menu-icon');
    if (menuIcon && menuIcon.textContent !== 'close') menuIcon.textContent = 'close';

    const ed = editor as EditorEl;

    loadCalendarFonts();

    const now = new Date();
    const state: CalendarState = {
      model: 'simples',
      gridId: 'grid20',
      fillMode: 'sequencial',
      startYear: now.getFullYear(),
      startMonth: now.getMonth() + 1,
      sheetCount: 1,
      endYear: now.getFullYear(),
      endMonth: 12,
      theme: CalendarRenderer.defaultTheme(),
      weekStartSunday: AppSettings.get('defaultWeekStart') === 'sunday',
    };

    const currentPreset = (): GridPreset =>
      GRID_PRESETS.find(p => p.id === state.gridId) || GRID_PRESETS[0];

    // Live preview on the main page (same as the Album wizard, including
    // the floating badge) -- called whenever anything in the panel changes.
    const updatePreview = (): void => CalendarTool._renderCanvasPreview(ed, state, currentPreset());

    const renderPanel = (): void => {
      const sectionModel    = CalendarTool._renderModelSection(state);
      const sectionLayout   = CalendarTool._renderLayoutSection(state);
      const sectionFillMode = CalendarTool._renderFillModeSection(state);
      const sectionStyle    = CalendarTool._renderStyleSection(state);
      const sectionGenerate = CalendarTool._renderGenerateSection(state, currentPreset());

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
      updatePreview();
    };

    const bindEvents = (): void => {
      const root = panelBody.querySelector<HTMLElement>('#cal-root');
      if (!root) return;

      // ── Modelo ──────────────────────────────────────────────────────
      root.querySelectorAll<HTMLElement>('.cal-model-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.model = btn.dataset.model as CalendarModel;
          renderPanel();
        });
      });

      const weekSundayCheckbox = root.querySelector<HTMLInputElement>('#cal-week-sunday');
      if (weekSundayCheckbox) weekSundayCheckbox.addEventListener('change', () => {
        state.weekStartSunday = weekSundayCheckbox.checked;
        updatePreview();
      });

      // ── Layout ──────────────────────────────────────────────────────
      root.querySelectorAll<HTMLElement>('.cal-grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.gridId = btn.dataset.gridId!;
          renderPanel();
        });
      });

      // ── Fill mode ───────────────────────────────────────────────────
      root.querySelectorAll<HTMLElement>('.cal-fillmode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.fillMode = btn.dataset.fillMode as FillMode;
          renderPanel();
        });
      });

      const startMonthSel  = root.querySelector<HTMLSelectElement>('#cal-start-month');
      const startYearInput = root.querySelector<HTMLInputElement>('#cal-start-year');
      const endMonthSel    = root.querySelector<HTMLSelectElement>('#cal-end-month');
      const endYearInput   = root.querySelector<HTMLInputElement>('#cal-end-year');
      const sheetCountInput = root.querySelector<HTMLInputElement>('#cal-sheet-count');

      if (startMonthSel) startMonthSel.addEventListener('change', () => {
        state.startMonth = parseInt(startMonthSel.value, 10);
        CalendarTool._refreshGenerateSummary(root, state, currentPreset());
        updatePreview();
      });
      if (startYearInput) startYearInput.addEventListener('input', () => {
        state.startYear = parseInt(startYearInput.value, 10) || state.startYear;
        CalendarTool._refreshGenerateSummary(root, state, currentPreset());
        updatePreview();
      });
      if (endMonthSel) endMonthSel.addEventListener('change', () => {
        state.endMonth = parseInt(endMonthSel.value, 10);
        CalendarTool._refreshGenerateSummary(root, state, currentPreset());
        updatePreview();
      });
      if (endYearInput) endYearInput.addEventListener('input', () => {
        state.endYear = parseInt(endYearInput.value, 10) || state.endYear;
        CalendarTool._refreshGenerateSummary(root, state, currentPreset());
        updatePreview();
      });
      if (sheetCountInput) sheetCountInput.addEventListener('input', () => {
        state.sheetCount = Math.max(1, parseInt(sheetCountInput.value, 10) || 1);
        CalendarTool._refreshGenerateSummary(root, state, currentPreset());
        updatePreview();
      });

      // ── Estilo (delegation: every input with data-part/data-field) ───
      // The preview is now shown live on the page (updatePreview), no
      // longer in an isolated sidebar card.
      root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-part][data-field]').forEach(input => {
        const evt = (input.tagName === 'SELECT' || (input as HTMLInputElement).type === 'color' || (input as HTMLInputElement).type === 'number') ? 'input' : 'change';
        input.addEventListener(evt, () => {
          const part  = input.dataset.part!;
          const field = input.dataset.field!;
          const value: string | number = (input as HTMLInputElement).type === 'number'
            ? (parseFloat(input.value) || 0)
            : input.value;
          const theme = state.theme as unknown as Record<string, unknown>;
          if (part === 'cellBorder') {
            (theme.cellBorder as Record<string, unknown>)[field] = value;
          } else if (part === 'cell') {
            state.theme.cellBg = value as string;
          } else if (theme[part]) {
            (theme[part] as Record<string, unknown>)[field] = value;
          }
          updatePreview();
        });
      });

      // ── Gerar ─────────────────────────────────────────────────────
      const generateBtn = root.querySelector<HTMLButtonElement>('#cal-generate-btn');
      if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
          const plan = CalendarTool._buildSheetPlan(state, currentPreset());
          if (plan === null) {
            Notify.toast(c('tooManySheets'), 'error', 6000);
            return;
          }
          if (!plan.length) return;

          generateBtn.disabled = true;
          const originalHtml = generateBtn.innerHTML;
          generateBtn.innerHTML = `<span class="material-symbols-outlined spin" style="font-size:16px;">progress_activity</span> ${c('generating')}`;
          try {
            await CalendarTool._generate(ed, plan, currentPreset(), state);
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

  // ── Tab: Modelo ─────────────────────────────────────────────────────

  private static _renderModelSection(state: CalendarState): string {
    return `
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${(['simples', 'completo'] as CalendarModel[]).map(m => `
          <button type="button" class="cal-model-btn craftools-pill ${state.model === m ? 'active' : ''}" data-model="${m}"
            style="width:100%; text-align:left; padding:10px; display:flex; flex-direction:column; align-items:flex-start; gap:2px;">
            <span style="font-weight:600; font-size:12px;">${c(m === 'simples' ? 'modelSimples' : 'modelCompleto')}</span>
            <span style="font-size:10px; color:var(--text-secondary); font-weight:400;">${c(m === 'simples' ? 'modelSimplesDesc' : 'modelCompletoDesc')}</span>
          </button>
        `).join('')}
      </div>
      <label class="ct-field" style="flex-direction:row; align-items:center; gap:6px; cursor:pointer; margin-top:12px;">
        <input type="checkbox" id="cal-week-sunday" ${state.weekStartSunday !== false ? 'checked' : ''}>
        <span class="craftools-label" style="margin:0;">${c('weekStartSunday')}</span>
      </label>
    `;
  }

  // ── Tab: Layout ─────────────────────────────────────────────────────

  private static _renderLayoutSection(state: CalendarState): string {
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

  // ── Tab: Fill mode + Period ─────────────────────────────────────────

  private static _renderFillModeSection(state: CalendarState): string {
    const monthSelect = (id: string, selectedMonth: number): string => `
      <select id="${id}" class="craftools-select" style="width:100%;">
        ${MONTH_NAMES_PT.map((name, i) => `<option value="${i + 1}" ${selectedMonth === i + 1 ? 'selected' : ''}>${name}</option>`).join('')}
      </select>
    `;

    const fillModes = `
      <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
        ${(['sequencial', 'repetido1', 'repetido2'] as FillMode[]).map(fm => `
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

  // ── Tab: Estilo (granular control per part) ──────────────────────────

  private static _fontOptions(selected: string): string {
    return CALENDAR_FONTS.map(f => `<option value="${f}" ${selected === f ? 'selected' : ''}>${f}</option>`).join('');
  }

  private static _renderPartRow(
    key: string,
    label: string,
    part: Record<string, unknown>,
    opts: {
      showBg?: boolean;
      colorLabel?: string;
      secondColorField?: string;
      secondColorLabel?: string;
      numberField?: string;
      numberFieldLabel?: string;
      numberFieldMin?: number;
      numberFieldMax?: number;
      numberFieldStep?: number;
      innerBorder?: boolean;
    } = {},
  ): string {
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
        ${opts.numberField ? `
          <div class="ct-field" style="margin-bottom:6px;">
            <span class="craftools-label">${opts.numberFieldLabel}</span>
            <input type="number" class="craftools-input" data-part="${key}" data-field="${opts.numberField}"
              value="${part[opts.numberField] ?? 0}" min="${opts.numberFieldMin ?? 0}" max="${opts.numberFieldMax ?? 10}" step="${opts.numberFieldStep ?? 0.5}" style="width:100%;">
          </div>
        ` : ''}
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px;">
          <div>
            <span class="craftools-label">${c('fieldFont')}</span>
            <ct-font-select class="craftools-select" data-part="${key}" data-field="font" style="width:100%;">${CalendarTool._fontOptions(part.font as string)}</ct-font-select>
          </div>
          <div>
            <span class="craftools-label">${c('fieldFontSize')}</span>
            <input type="number" class="craftools-input" data-part="${key}" data-field="fontSize" value="${part.fontSize}" step="0.5" min="2" max="30" style="width:100%;">
          </div>
        </div>
        ${opts.innerBorder ? CalendarTool._renderInnerBorderFields(key, part) : ''}
      </div>
    `;
  }

  // Reusable sub-block: inner (grid) borders for the week-day header and/or
  // day numbers -- opt-in via opts.innerBorder in _renderPartRow. Width 0
  // means off (default).
  private static _renderInnerBorderFields(key: string, part: Record<string, unknown>): string {
    return `
      <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border, #e4e4e7);">
        <div style="font-weight:600; font-size:10px; margin-bottom:6px; color:var(--text-secondary);">${c('fieldInnerBorder')}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:6px;">
          <div>
            <span class="craftools-label">${c('fieldBorderWidth')}</span>
            <input type="number" class="craftools-input" data-part="${key}" data-field="innerBorderWidth"
              value="${part.innerBorderWidth ?? 0}" min="0" max="5" step="0.5" style="width:100%;">
          </div>
          <div>
            <span class="craftools-label">${c('fieldBorderColor')}</span>
            <input type="color" class="craftools-color-swatch" data-part="${key}" data-field="innerBorderColor" value="${part.innerBorderColor || '#cccccc'}" style="width:100%;">
          </div>
        </div>
        <div>
          <span class="craftools-label">${c('fieldBorderStyle')}</span>
          <select class="craftools-select" data-part="${key}" data-field="innerBorderStyle" style="width:100%;">
            ${['solid', 'dashed', 'dotted'].map(s => `<option value="${s}" ${(part.innerBorderStyle || 'solid') === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
  }

  private static _renderStyleSection(state: CalendarState): string {
    const t = state.theme as unknown as Record<string, Record<string, unknown>>;
    const rows = [
      CalendarTool._renderPartRow('titleBar', c('styleTitleBar'), t.titleBar, { showBg: true }),
      CalendarTool._renderPartRow('weekHeader', c('styleWeekHeader'), t.weekHeader, { showBg: true, innerBorder: true }),
      CalendarTool._renderPartRow('dayNumbers', c('styleDayNumbers'), t.dayNumbers, {
        secondColorField: 'sundayColor', secondColorLabel: c('fieldSundayColor'),
        numberField: 'rowGap', numberFieldLabel: c('fieldRowGap'), numberFieldMin: 0, numberFieldMax: 8, numberFieldStep: 0.5,
        innerBorder: true,
      }),
      CalendarTool._renderPartRow('holidays', c('styleHolidays'), t.holidays, {}),
    ];
    if (state.model === 'completo') {
      rows.push(CalendarTool._renderPartRow('moonPhases', c('styleMoonPhases'), t.moonPhases, {}));
    }

    return `
      ${rows.join('')}
      ${CalendarTool._renderBorderRow(state.theme)}
    `;
  }

  // "Border / card background" row -- kept as its own method so it can also
  // be reused by MiniCalendarTool.ts (same theme engine).
  private static _renderBorderRow(t: CalendarTheme): string {
    const cellBorder = t.cellBorder!;
    return `
      <div class="ct-field" style="border:1px solid var(--border, #e4e4e7); border-radius:8px; padding:8px; margin-bottom:8px;">
        <div style="font-weight:600; font-size:11px; margin-bottom:6px;">${c('styleCellBorder')}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:6px;">
          <div>
            <span class="craftools-label">${c('fieldCellBg')}</span>
            <input type="color" class="craftools-color-swatch" data-part="cell" data-field="cellBg" value="${t.cellBg}" style="width:100%;">
          </div>
          <div>
            <span class="craftools-label">${c('fieldBorderColor')}</span>
            <input type="color" class="craftools-color-swatch" data-part="cellBorder" data-field="color" value="${cellBorder.color}" style="width:100%;">
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div>
            <span class="craftools-label">${c('fieldBorderWidth')}</span>
            <input type="number" class="craftools-input" data-part="cellBorder" data-field="width" value="${cellBorder.width}" min="0" max="10" style="width:100%;">
          </div>
          <div>
            <span class="craftools-label">${c('fieldBorderStyle')}</span>
            <select class="craftools-select" data-part="cellBorder" data-field="style" style="width:100%;">
              ${['none', 'solid', 'dashed', 'dotted'].map(s => `<option value="${s}" ${cellBorder.style === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  // ── Tab: Gerar ────────────────────────────────────────────────────────

  private static _renderGenerateSection(state: CalendarState, preset: GridPreset): string {
    const plan = CalendarTool._buildSheetPlan(state, preset);
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

  private static _refreshGenerateSummary(root: HTMLElement, state: CalendarState, preset: GridPreset): void {
    const el = root.querySelector('#cal-generate-summary');
    if (!el) return;
    const plan = CalendarTool._buildSheetPlan(state, preset);
    el.textContent = plan ? String(plan.length) : '—';
  }

  // ── Sheet planning (months per slot, per sheet) ────────────────────────

  /** Returns null if the plan would exceed the sheet-count safety cap. */
  private static _buildSheetPlan(state: CalendarState, preset: GridPreset): MonthSlot[][] | null {
    const slotsPerSheet = preset.cols * preset.rows;

    if (state.fillMode === 'sequencial') {
      const sheetCount = Math.max(1, Math.min(MAX_SHEETS_SAFETY, state.sheetCount || 1));
      const total = sheetCount * slotsPerSheet;
      const months: MonthSlot[] = [];
      let y = state.startYear, m = state.startMonth;
      for (let i = 0; i < total; i++) {
        months.push({ year: y, month: m });
        m++;
        if (m > 12) { m = 1; y++; }
      }
      const sheets: MonthSlot[][] = [];
      for (let i = 0; i < months.length; i += slotsPerSheet) {
        sheets.push(months.slice(i, i + slotsPerSheet));
      }
      return sheets;
    }

    // repetido1 / repetido2: enumerate the months in the period (inclusive)
    const periodMonths: { year: number; month: number }[] = [];
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

    // repetido2 -- 2 months per sheet, half the slots each
    const half = Math.floor(slotsPerSheet / 2);
    const sheetsNeeded = Math.ceil(periodMonths.length / 2);
    if (sheetsNeeded > MAX_SHEETS_SAFETY) return null;

    const sheets: MonthSlot[][] = [];
    for (let i = 0; i < periodMonths.length; i += 2) {
      const monthA = periodMonths[i];
      const monthB = periodMonths[i + 1] || null;
      const sheet: MonthSlot[] = [
        ...new Array(half).fill(monthA),
        ...new Array(slotsPerSheet - half).fill(monthB),
      ];
      sheets.push(sheet);
    }
    return sheets;
  }

  // Builds the `<div class="craftools-grid-container">` element for a
  // sheet -- reused both by real page generation and the live preview
  // (same markup/CSS in both cases).
  private static _buildSheetGridElement(sheet: MonthSlot[], preset: GridPreset, state: CalendarState): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'craftools-grid-container';
    // Marks the grid's origin -- PageTool.ts uses this to reopen the
    // Calendar panel (instead of Album) when clicking the page.
    grid.dataset.gridSource = 'calendar';
    grid.style.cssText = `
      position:absolute; top:${preset.margin}mm; right:${preset.margin}mm; bottom:${preset.margin}mm; left:${preset.margin}mm;
      display:grid; grid-template-columns:repeat(${preset.cols}, ${preset.cellWidth}mm); grid-auto-rows:${preset.cellHeight}mm;
      gap:0mm; box-sizing:border-box;
    `;

    // Each .craftools-grid-cell draws its OWN border via a ::before overlay
    // (craftools.css), driven by --cell-border-width/-style/-color -- a
    // completely separate layer from the .cal-month-card's own CSS border
    // (already configurable below via _renderBorderRow()'s panel section,
    // and correctly threaded through CalendarRenderer.buildCardElement()).
    // This tool never set these custom properties anywhere, so every cell
    // silently fell back to craftools.css's own default (1px dashed
    // #cccccc) no matter what the "Border / cell background" panel section
    // was set to -- the cell's guide border was effectively impossible to
    // remove. Set from the SAME theme.cellBorder values the panel already
    // edits, inherited by every cell (CSS custom properties cascade).
    const cellBorder = state.theme.cellBorder;
    if (cellBorder) {
      grid.style.setProperty('--cell-border-width', `${cellBorder.width ?? 0}px`);
      grid.style.setProperty('--cell-border-style', cellBorder.style ?? 'none');
      grid.style.setProperty('--cell-border-color', cellBorder.color ?? '#cccccc');
    }

    sheet.forEach(slot => {
      const cell = document.createElement('div');
      cell.className = 'craftools-grid-cell';
      cell.style.cssText = `width:${preset.cellWidth}mm; height:${preset.cellHeight}mm; box-sizing:border-box; position:relative; overflow:hidden;`;
      if (slot) {
        const card = CalendarRenderer.buildCardElement(slot.year, slot.month, {
          model: state.model,
          theme: state.theme,
          weekStart: state.weekStartSunday === false ? 'monday' : 'sunday',
        });
        cell.appendChild(card);
      }
      grid.appendChild(cell);
    });

    return grid;
  }

  // ── Live preview on the main page ──────────────────────────────────────
  //
  // Just like the Album wizard, the Calendar panel takes over the main
  // page (#main-page) as a preview area while it's open, showing the same
  // floating badge, and restores the original content when switching tools
  // (via Editor.ts's restoreOriginalCanvas()).
  private static _renderCanvasPreview(editor: EditorEl, state: CalendarState, preset: GridPreset): void {
    const canvasArea   = document.getElementById('canvas-area');
    const pagesWrapper = document.getElementById('pages-wrapper');
    const mainPage     = document.getElementById('main-page');
    if (!canvasArea || !mainPage) return;

    if (pagesWrapper) pagesWrapper.style.display = '';

    // Save the page's original content only the first time (same logic as
    // GeneratorTool.ts) -- restored when switching to a different tool.
    if (editor._savedPageHtml === undefined) {
      editor._savedPageHtml = mainPage.innerHTML;
    }

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
        ${c('stylePreviewLabel')}
      `;
      canvasArea.appendChild(badge);
    }

    const plan = CalendarTool._buildSheetPlan(state, preset);
    const sheet = plan && plan.length ? plan[0] : null;

    mainPage.innerHTML = '';
    if (sheet) {
      mainPage.appendChild(CalendarTool._buildSheetGridElement(sheet, preset, state));
    }
  }

  // ── Real page generation ────────────────────────────────────────────────

  private static async _generate(editor: EditorEl, sheets: MonthSlot[][], preset: GridPreset, state: CalendarState): Promise<void> {
    const pagesWrapper = editor.querySelector('#pages-wrapper');
    if (!pagesWrapper) return;

    // Restore the main page (which was showing the live preview) before
    // adding the real generated sheets -- otherwise the document's first
    // page would stay stuck showing the preview.
    if (typeof editor.restoreOriginalCanvas === 'function') {
      editor.restoreOriginalCanvas();
    }

    for (let s = 0; s < sheets.length; s++) {
      PageTool.addNewPage(editor);
      const page = pagesWrapper.querySelector<HTMLElement>('.craftools-page:last-child');
      if (!page) continue;

      page.style.width = '210mm';
      page.style.minHeight = '297mm';
      page.style.background = '#ffffff';
      page.style.position = 'relative';
      page.innerHTML = '';
      page.appendChild(CalendarTool._buildSheetGridElement(sheets[s], preset, state));
    }

    document.dispatchEvent(new CustomEvent('craftools-page-add', { bubbles: true }));
  }
}

// label matches the desktop sidebar (index.html #pwa-sidebar-calendar) --
// 'editor.calendar' isn't a registered translation key, so it rendered
// literally instead of "Calendário".
ToolRegistry.register({
  key: 'calendar',
  label: 'editor.calendarTool',
  icon: 'calendar_month',
  panelOnly: true,
  showInFooterNav: false,
  category: 'tools',
});
