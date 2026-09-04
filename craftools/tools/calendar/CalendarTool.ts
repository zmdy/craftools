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
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { FieldRegistry } from '../../utils/FieldRegistry';
import { calendarStyleSections, quickStyleSection } from '../../utils/CalendarStyleSchema';
import { CALENDAR_THEME_KEY_PATHS, getThemePath, applyCalendarStyleChange, deriveQuickStyleState } from '../../utils/CalendarThemeKeyPaths';
import './CalendarTool_Translations.js';
import '../../components/CtFontSelect.js';

const c = (key: string): string => I18n.t('calendarTool.' + key);

import { FONTS, loadCraftoolsFonts } from '../../utils/FontList.ts';

const CALENDAR_FONTS = FONTS;
const loadCalendarFonts = (): void => loadCraftoolsFonts(CALENDAR_FONTS);

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
  { id: 'grid12',    labelKey: 'layout12',    cellWidth: 66,  cellHeight: 71,  cols: 3, rows: 4, margin: 5 }, // 3x4 = 12 (1 sheet per year -- classic yearly calendar poster)
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
  /**
   * Which page the live preview actually hijacked, when the tool was opened
   * against a specific page (drag-drop onto a non-first page, or clicking an
   * existing calendar page) rather than the plain sidebar-button click.
   * Editor.ts's restoreOriginalCanvas() prefers this over #main-page when
   * restoring, and clears it afterwards. Left unset (defaulting to
   * #main-page) for the plain sidebar-click path, matching Generator's
   * existing convention.
   */
  _previewTargetEl?: HTMLElement;
  restoreOriginalCanvas?: () => void;
};

export class CalendarTool {

  public static setup(editor: HTMLElement, targetPage?: HTMLElement): void {
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
    // Previews on `targetPage` when one was passed in (drag-drop onto a
    // specific page, or clicking an existing calendar page) instead of
    // always hijacking #main-page -- see _renderCanvasPreview()'s own
    // comment and EditorEl._previewTargetEl above.
    const updatePreview = (): void => CalendarTool._renderCanvasPreview(ed, state, currentPreset(), targetPage);

    // Padding wrapper for every hand-rolled tab's body -- .ct-accordion-content
    // itself has zero horizontal padding (see craftools.css), relying on each
    // schema-field wrapper (.ct-field/.ct-field--block/...) to carry its own
    // 12px side padding. This panel's tabs predate the schema system and
    // never got that treatment, so their controls sat flush against the
    // panel walls. The 5 style tabs below don't need this -- they're built
    // through PropertyRenderer, which already produces correctly-padded
    // field wrappers, same as every other element's properties panel.
    const pad = (html: string): string => `<div style="padding:10px 14px 14px;">${html}</div>`;

    const renderPanel = (): void => {
      const sectionCalendar = CalendarTool._renderCalendarSection(state);
      const sectionFillMode = CalendarTool._renderFillModeSection(state);
      const sectionGenerate = CalendarTool._renderGenerateSection(state, currentPreset());

      // Only shown when this panel is tied to a real, already-on-canvas
      // page (dragged/clicked onto one) -- lets the user reach the real
      // Page Settings panel (dimensions/background/clone/delete) from here,
      // since clicking a calendar-generated page normally redirects
      // straight back into this panel instead (see PageTool.ts's page-click
      // handler), which used to make such a page's delete button
      // unreachable entirely.
      const pageSettingsHtml = targetPage ? `
        <div style="padding:0 12px 8px;">
          <button type="button" id="cal-page-settings-btn" class="craftools-topbtn" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; padding:8px;">
            <span class="material-symbols-outlined" style="font-size:16px;">settings</span>
            ${I18n.t('pageTool.title')}
          </button>
        </div>
      ` : '';

      PanelUI.withStatePreservation(panelBody, () => {
        panelBody.innerHTML = `
          <div id="cal-root">
            ${pageSettingsHtml}
            ${PanelUI.accordion('cal-calendario', 'calendar_month', c('tabCalendar'), pad(sectionCalendar), { open: true })}
            ${PanelUI.accordion('cal-preenchimento', 'repeat', c('tabFillMode') + ' / ' + c('tabPeriod'), pad(sectionFillMode))}
            <div id="cal-style-sections"></div>
            ${PanelUI.accordion('cal-gerar', 'auto_awesome', c('tabGenerate'), pad(sectionGenerate))}
          </div>
        `;
      });

      PanelUI.bindAccordions(panelBody);
      CalendarTool._renderStyleSections(panelBody, state, updatePreview);
      bindEvents();
      updatePreview();
    };

    const bindEvents = (): void => {
      const root = panelBody.querySelector<HTMLElement>('#cal-root');
      if (!root) return;

      // ── Página (only present when targetPage is known) ────────────────
      const pageSettingsBtn = root.querySelector<HTMLButtonElement>('#cal-page-settings-btn');
      if (pageSettingsBtn && targetPage) {
        pageSettingsBtn.addEventListener('click', () => {
          PageTool.openPageSettings(editor, targetPage);
        });
      }

      // ── Modelo ──────────────────────────────────────────────────────
      root.querySelectorAll<HTMLElement>('.cal-model-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.model = btn.dataset.model as CalendarModel;
          renderPanel();
        });
      });

      // Standard toggle switch (same FieldRegistry 'toggle' handler every
      // schema-driven panel uses) instead of a bare <input type="checkbox">
      // -- invoked directly since this whole tab is still hand-rolled HTML,
      // not a PropertySchema, so there's no full PropertyRenderer.render()
      // pass to hang a real field off of.
      const weekSundayToggleWrap = root.querySelector<HTMLElement>('#cal-week-sunday-toggle');
      if (weekSundayToggleWrap) {
        const toggleHandler = FieldRegistry.get('toggle')!;
        const toggleField = { type: 'toggle' as const, key: 'weekStartSunday', label: c('weekStartSunday') };
        toggleHandler.render(weekSundayToggleWrap, toggleField, state.weekStartSunday);
        toggleHandler.bind(weekSundayToggleWrap, toggleField, (value) => {
          state.weekStartSunday = value as boolean;
          updatePreview();
        });
      }

      // ── Layout (native select, same convention as MiniCalendarTool.ts's
      // own "Calendar" tab -- calendarType/displayMode are both `type:
      // 'select'` there too, not a vertical card list) ────────────────
      const layoutSelect = root.querySelector<HTMLSelectElement>('#cal-layout-select');
      if (layoutSelect) {
        layoutSelect.addEventListener('change', () => {
          state.gridId = layoutSelect.value;
          renderPanel();
        });
      }

      // ── Fill mode ───────────────────────────────────────────────────
      root.querySelectorAll<HTMLElement>('.cal-fillmode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.fillMode = btn.dataset.fillMode as FillMode;
          renderPanel();
        });
      });

      // Single native <input type="month"> per month/year field (was a
      // month <select> + year number-input pair) -- value is "YYYY-MM",
      // split back into the two separate numbers CalendarState still wants.
      const startMonthYearInput = root.querySelector<HTMLInputElement>('#cal-start-month-year');
      const endMonthYearInput   = root.querySelector<HTMLInputElement>('#cal-end-month-year');
      const sheetCountInput = root.querySelector<HTMLInputElement>('#cal-sheet-count');

      if (startMonthYearInput) startMonthYearInput.addEventListener('change', () => {
        const [y, m] = startMonthYearInput.value.split('-').map(n => parseInt(n, 10));
        if (!isNaN(y)) state.startYear = y;
        if (!isNaN(m)) state.startMonth = m;
        CalendarTool._refreshGenerateSummary(root, state, currentPreset());
        updatePreview();
      });
      if (endMonthYearInput) endMonthYearInput.addEventListener('change', () => {
        const [y, m] = endMonthYearInput.value.split('-').map(n => parseInt(n, 10));
        if (!isNaN(y)) state.endYear = y;
        if (!isNaN(m)) state.endMonth = m;
        CalendarTool._refreshGenerateSummary(root, state, currentPreset());
        updatePreview();
      });
      if (sheetCountInput) sheetCountInput.addEventListener('input', () => {
        state.sheetCount = Math.max(1, parseInt(sheetCountInput.value, 10) || 1);
        CalendarTool._refreshGenerateSummary(root, state, currentPreset());
        updatePreview();
      });

      // ── Estilo: handled entirely by _renderStyleSections()'s own
      // PropertyRenderer.render() call in renderPanel() -- its onChange
      // writes straight into state.theme and calls updatePreview() itself,
      // no delegation needed here.

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

  // ── Tab: Calendário (merges the former Modelo + Layout tabs) ─────────

  private static _renderCalendarSection(state: CalendarState): string {
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
      <!-- Layout: native select instead of a vertical card list -- same
           convention MiniCalendarTool.ts's own "Calendar" tab already uses
           for its calendarType/displayMode pickers. -->
      <div class="ct-field" style="margin-top:12px;">
        <span class="craftools-label">${c('tabLayout')}</span>
        <select id="cal-layout-select" class="craftools-select">
          ${GRID_PRESETS.map(p => `
            <option value="${p.id}" ${state.gridId === p.id ? 'selected' : ''}>${c(p.labelKey)} (${p.cols * p.rows} ${c('slotsSuffix')})</option>
          `).join('')}
        </select>
      </div>
      <div id="cal-week-sunday-toggle" style="margin-top:12px;"></div>
    `;
  }

  // ── Tab: Fill mode + Period ─────────────────────────────────────────

  private static _renderFillModeSection(state: CalendarState): string {
    // Native <input type="month"> -- one control instead of the previous
    // month <select> + year number-input pair. Value is the input's own
    // "YYYY-MM" string format; bindEvents() above splits it back into
    // separate year/month numbers.
    const monthYearInput = (id: string, year: number, month: number): string => `
      <input type="month" id="${id}" class="craftools-input" style="width:100%;"
        value="${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}" min="1900-01" max="2200-12">
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
          ${monthYearInput('cal-start-month-year', state.startYear, state.startMonth)}
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
          ${monthYearInput('cal-start-month-year', state.startYear, state.startMonth)}
        </div>
        <div class="ct-field">
          <span class="craftools-label">${c('endMonthYear')}</span>
          ${monthYearInput('cal-end-month-year', state.endYear, state.endMonth)}
          <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${c('periodHelp')}</span>
        </div>
      `;
    }

    return fillModes + periodHtml;
  }

  // ── Tab: Estilo (5 separate accordions, one per calendar region) ─────
  //
  // Renders utils/CalendarStyleSchema.ts's 5 sections (Estilo do Cartão /
  // Barra do Mês / Tabela de Dias / Cabeçalho dos Dias / Feriados e Fases
  // da Lua) as their OWN top-level accordions inside #cal-style-sections,
  // alongside Modelo/Layout/Preenchimento/Gerar -- via PropertyRenderer +
  // a synthetic detached-element adapter (same pattern SettingsTool.ts uses
  // for AppSettings, since `state.theme` is a plain object too, not a real
  // canvas element with its own dataset.ctState). Every field/label/i18n key
  // comes from the same canonical schema MiniCalendarTool.ts and
  // VariablePanel.ts's miniCalendar config also render, so this tool's
  // style controls look and behave identically to theirs (and to every
  // other element's Typography section: font-select/slider/align,
  // gradient-capable color-picker, 4-corner radius, toggles).
  private static _renderStyleSections(panelBody: HTMLElement, state: CalendarState, onThemeChange: () => void): void {
    const wrap = panelBody.querySelector<HTMLElement>('#cal-style-sections');
    if (!wrap) return;

    const fakeEl = document.createElement('div');
    // "Estilos Rápidos" (quickStyleSection()) rendered first, ahead of the 5
    // detailed sections -- same bulk-write-through-the-same-paths model, via
    // applyCalendarStyleChange() (handles both a quick key's multi-target
    // fan-out and a plain single-path canonical key with one shared branch).
    const schema = [quickStyleSection(), ...calendarStyleSections()];

    const onChange = (key: string, value: unknown): void => {
      applyCalendarStyleChange(state.theme as unknown as Record<string, unknown>, key, value);
      // Re-derive the WHOLE ctState fresh from the just-mutated theme --
      // NOT just a single-key PropertyRenderer.applyChange(fakeEl, key,
      // value) -- because a quick-style key fans out to SEVERAL canonical
      // keys at once (see QUICK_STYLE_TARGETS). Writing only `key` back
      // would leave every OTHER cascaded field's own displayed value (e.g.
      // Barra do Mês's "Fundo" swatch after picking "Cor do Calendário")
      // stuck showing the OLD colour until the next full renderPanel(),
      // even though `state.theme` itself -- and therefore the live canvas
      // preview, which reads it directly -- is already fully correct.
      fakeEl.dataset.ctState = JSON.stringify(CalendarTool._themeToCtState(state.theme));
      PropertyRenderer.render(wrap, schema, fakeEl, onChange);
      onThemeChange();
    };

    fakeEl.dataset.ctState = JSON.stringify(CalendarTool._themeToCtState(state.theme));
    PropertyRenderer.render(wrap, schema, fakeEl, onChange);
  }

  /** Maps a CalendarTheme onto CalendarStyleSchema.ts's flat canonical keys
   *  (via CALENDAR_THEME_KEY_PATHS) plus "Estilos Rápidos"'s own bulk keys
   *  (via deriveQuickStyleState()). */
  private static _themeToCtState(theme: CalendarTheme): Record<string, unknown> {
    const defaults = CalendarRenderer.defaultTheme();
    const state: Record<string, unknown> = {};
    for (const [flatKey, path] of Object.entries(CALENDAR_THEME_KEY_PATHS)) {
      const fromTheme   = getThemePath(theme, path);
      const fromDefault = getThemePath(defaults, path);
      state[flatKey] = fromTheme !== undefined ? fromTheme : fromDefault;
    }
    Object.assign(state, deriveQuickStyleState(theme, defaults));
    return state;
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

  // ── Live preview on the target page ──────────────────────────────────────
  //
  // Just like the Album wizard, the Calendar panel takes over a page as a
  // preview area while it's open, showing the same floating badge, and
  // restores the original content when switching tools (via Editor.ts's
  // restoreOriginalCanvas()). Defaults to #main-page (the plain
  // sidebar-button-click path, matching Generator's convention) unless a
  // specific `targetPage` was passed in -- see setup()'s own comment and
  // EditorEl._previewTargetEl above.
  private static _renderCanvasPreview(editor: EditorEl, state: CalendarState, preset: GridPreset, targetPage?: HTMLElement): void {
    const canvasArea   = document.getElementById('canvas-area');
    const pagesWrapper = document.getElementById('pages-wrapper');
    const mainPage     = targetPage ?? document.getElementById('main-page');
    if (!canvasArea || !mainPage) return;

    if (pagesWrapper) pagesWrapper.style.display = '';

    // Save the page's original content only the first time (same logic as
    // GeneratorTool.ts) -- restored when switching to a different tool.
    //
    // Must save BOTH innerHTML and style.cssText here: Editor.ts's
    // restoreOriginalCanvas() unconditionally does
    // `mainPage.style.cssText = this._savedPageCssText ?? ''` on close, so
    // leaving _savedPageCssText unset made it reset to an EMPTY string --
    // wiping out the page's own width/min-height/position inline styles
    // (normally set by PageTool) the moment the calendar preview closed.
    // With no dimensions left, the page collapsed to 0x0 and visually
    // vanished from the canvas -- indistinguishable from the page actually
    // having been deleted, even though the DOM node (and its content) were
    // still there untouched. AgendaExportTool.ts's equivalent save call
    // already does this correctly; this brings CalendarTool in line with it.
    if (editor._savedPageHtml === undefined) {
      editor._savedPageHtml    = mainPage.innerHTML;
      editor._savedPageCssText = mainPage.style.cssText;
      // Track which page this save actually belongs to, so
      // restoreOriginalCanvas() restores THAT page instead of always
      // assuming #main-page -- otherwise previewing on page 2, say, would
      // both leave page 2 stuck showing the preview AND wipe #main-page's
      // real content with page 2's saved html/cssText on close.
      if (targetPage) editor._previewTargetEl = targetPage;
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
