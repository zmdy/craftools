import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import { calendarStyleSections } from '../../utils/CalendarStyleSchema';
import { CALENDAR_THEME_KEY_PATHS, getThemePath, setThemePath } from '../../utils/CalendarThemeKeyPaths';
import { normalizeValue } from '../../utils/ColorPickerUI.js';
import { CalendarRenderer, type CalendarTheme, type CalendarOptions } from '../../utils/CalendarRenderer';
import { AppSettings } from '../../utils/AppSettings.js';
import type { PropertySchema } from '../../types/PropertySchema';
// Registers the 'miniCalendarTool.*' i18n keys used by DISPLAY_MODES' per-
// option i18nKey below (falls back to the literal English labels without
// it, via utils/i18nLabel.ts's tr() -- see QRCodeTool.ts for the pattern).
import './MiniCalendarTool_Translations.js';

interface MiniCalendarMeta {
  /**
   * How many months this element renders, as a string (matches the
   * 'select' field's own value type) -- '1' (default, single card, all
   * pre-existing behavior unchanged) | '2' | '3' | '6' | '12'. > 1 lays out
   * that many CalendarRenderer cards in a grid inside the same element
   * (see _buildMultiCard()), all sharing this meta's theme/displayMode/
   * weekStartSunday/highlight settings -- only the month/year shown in each
   * card differs.
   */
  calendarType?: string;
  /**
   * Only meaningful (and only shown in the panel) when calendarType !== '1'.
   * true = every card in the grid shows the SAME month/year (meta.year/
   * meta.month) -- mirrors CalendarTool.ts's (the full-page "Calendário"
   * generator) 'repetido1' fill mode. false/default = cards show
   * SEQUENTIAL months starting from meta.year/meta.month.
   */
  singleMonthMode?: boolean;
  displayMode: string;
  year:        number;
  month:       number;
  theme:       CalendarTheme;
  highlight?:  CalendarOptions['highlight'];
  /**
   * 'today' (default) = highlight.day is recomputed as the current
   * day-of-month every time the card is rebuilt, so the highlighted cell
   * always tracks the real "today" instead of freezing at whatever day it
   * happened to be when the toggle was first turned on. 'fixed' = use the
   * manually-entered highlight.day as a permanent stored value (e.g. to
   * always mark a birthday, independent of the current date).
   */
  highlightDaySource?: 'today' | 'fixed';
  /** true (default, matches original behavior) = week starts Sunday; false = Monday. */
  weekStartSunday?: boolean;
}

const getMeta = (el: HTMLElement): Partial<MiniCalendarMeta> =>
  (el as HTMLElement & { _craftoolsMeta?: MiniCalendarMeta })._craftoolsMeta ?? {};

// Must match MiniCalendarTool.js's real DISPLAY_MODES exactly (id + order) --
// CalendarRenderer only knows how to render these 7 modes. The previous list
// here ('mes'/'semana'/'mini'/'lista') didn't correspond to anything the
// renderer implements (picking them silently fell back to 'complete1'), and
// 5 real modes (weekdays/calendar/header/holidaysBox/moonBox) were
// missing entirely.
// SelectField.options now supports an optional per-option i18nKey (see
// types/PropertySchema.ts) -- these already exist in
// MiniCalendarTool_Translations.ts (used by the legacy panel/VariablePanel's
// miniCalendar config), just weren't wired up here yet.
// Matches CalendarTool.ts's own 12-per-sheet grid shape (3 cols x 4 rows)
// for calendarType '12', and keeps every other count in a single row --
// simple, predictable layouts rather than trying to auto-balance an
// arbitrary aspect ratio. Only calendarType values with an entry here are
// offered in CALENDAR_TYPE_OPTIONS below, so this table is exhaustive.
const CALENDAR_TYPE_COLS: Record<string, number> = { '1': 1, '2': 2, '3': 3, '6': 3, '12': 3 };

const CALENDAR_TYPE_OPTIONS = [
  { value: '1',  label: '1 month',   i18nKey: 'miniCalendarTool.calendarType1' },
  { value: '2',  label: '2 months',  i18nKey: 'miniCalendarTool.calendarType2' },
  { value: '3',  label: '3 months',  i18nKey: 'miniCalendarTool.calendarType3' },
  { value: '6',  label: '6 months',  i18nKey: 'miniCalendarTool.calendarType6' },
  { value: '12', label: '12 months', i18nKey: 'miniCalendarTool.calendarType12' },
];

const DISPLAY_MODES = [
  { value: 'weekdays',  label: 'Days table only (with holidays marked)', i18nKey: 'miniCalendarTool.modeWeekdays' },
  { value: 'calendar',  label: 'Calendar (header + days table)',         i18nKey: 'miniCalendarTool.modeCalendar' },
  { value: 'header',      label: 'Header only (month and year)',          i18nKey: 'miniCalendarTool.modeHeader' },
  { value: 'holidaysBox', label: 'Holidays box only',                     i18nKey: 'miniCalendarTool.modeHolidaysBox' },
  { value: 'moonBox',     label: 'Moon phases box only',                  i18nKey: 'miniCalendarTool.modeMoonBox' },
  { value: 'complete1',   label: 'Calendar with holidays',                i18nKey: 'miniCalendarTool.modeComplete1' },
  { value: 'complete2',   label: 'Full calendar with moon phases',        i18nKey: 'miniCalendarTool.modeComplete2' },
];

// id -> CalendarRenderer's `parts` flags for that display mode.
const DISPLAY_MODE_PARTS: Record<string, { header: boolean; week: boolean; days: boolean; holidaysBox: boolean; moonBox: boolean }> = {
  weekdays:  { header: false, week: true,  days: true,  holidaysBox: false, moonBox: false },
  calendar:  { header: true,  week: true,  days: true,  holidaysBox: false, moonBox: false },
  header:      { header: true,  week: false, days: false, holidaysBox: false, moonBox: false },
  holidaysBox: { header: false, week: false, days: false, holidaysBox: true,  moonBox: false },
  moonBox:     { header: false, week: false, days: false, holidaysBox: false, moonBox: true  },
  complete1:   { header: true,  week: true,  days: true,  holidaysBox: true,  moonBox: false },
  complete2:   { header: true,  week: true,  days: true,  holidaysBox: true,  moonBox: true  },
};

const now = new Date();

export class MiniCalendarTool extends BaseTool {

  /**
   * Default meta for a freshly-created mini-calendar element. Recovered
   * from the pre-migration MiniCalendarTool.js (deleted by the "Purge
   * legacy JS" commit) -- theme uses CalendarRenderer's real (nested)
   * CalendarTheme shape, same as the original.
   */
  public static getDefaultMeta(): MiniCalendarMeta {
    return {
      calendarType: '1',
      singleMonthMode: false,
      displayMode: 'complete1',
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      theme: CalendarRenderer.defaultTheme(),
      weekStartSunday: AppSettings.get('defaultWeekStart') === 'sunday',
      highlightDaySource: 'today',
    };
  }

  private static _currentParts(displayMode: string) {
    return DISPLAY_MODE_PARTS[displayMode] ?? DISPLAY_MODE_PARTS.complete1;
  }

  /**
   * Resolves the final highlight object passed to CalendarRenderer, with
   * `day` computed fresh from "today" unless the user explicitly opted into
   * a fixed day (see MiniCalendarMeta.highlightDaySource's doc comment).
   */
  private static _resolveHighlight(meta: MiniCalendarMeta): CalendarOptions['highlight'] {
    if (!meta.highlight?.enabled) return meta.highlight;
    const useFixed = meta.highlightDaySource === 'fixed';
    return {
      ...meta.highlight,
      day: useFixed ? (meta.highlight.day ?? new Date().getDate()) : new Date().getDate(),
    };
  }

  /** Normalizes meta.calendarType to one of CALENDAR_TYPE_COLS' known keys, defaulting to '1'. */
  private static _calendarType(meta: MiniCalendarMeta): string {
    const t = meta.calendarType ?? '1';
    return t in CALENDAR_TYPE_COLS ? t : '1';
  }

  private static _monthCount(meta: MiniCalendarMeta): number {
    return parseInt(MiniCalendarTool._calendarType(meta), 10) || 1;
  }

  /** Builds a single CalendarRenderer card for one specific year/month,
   *  using every OTHER display setting (theme/displayMode/weekStart/
   *  highlight) from `meta` -- shared identically by every card when
   *  calendarType > 1 renders several of these into a grid. */
  private static _buildSingleCard(year: number, month: number, meta: MiniCalendarMeta): HTMLElement {
    const card = CalendarRenderer.buildCardElement(year, month, {
      theme: meta.theme,
      parts: MiniCalendarTool._currentParts(meta.displayMode),
      highlight: MiniCalendarTool._resolveHighlight(meta),
      weekStart: meta.weekStartSunday === false ? 'monday' : 'sunday',
    });
    card.style.userSelect = 'none';
    return card;
  }

  /**
   * Lays `count` month cards out in a CSS grid filling the element -- cols
   * from CALENDAR_TYPE_COLS, rows = count / cols (always exact, since every
   * entry in that table was chosen to divide evenly). Explicit
   * `grid-template-rows: repeat(rows, 1fr)` (rather than leaving rows
   * `auto`) is required here: each card's own root element is styled
   * `width:100%; height:100%` (CalendarRenderer.ts), and a percentage
   * height on a grid item only resolves against a track with a DEFINITE
   * size -- an `auto` row sized off its own 100%-height content is
   * circular and collapses unpredictably. `1fr` against the wrap's own
   * (definite, from the element's resize box) height avoids that.
   *
   * `singleMonthMode` freezes every card on meta.year/meta.month instead of
   * advancing -- mirrors CalendarTool.ts's 'repetido1' fill mode for the
   * full-page Calendar generator.
   */
  private static _buildMultiCard(meta: MiniCalendarMeta, count: number): HTMLElement {
    const cols = CALENDAR_TYPE_COLS[String(count)] ?? count;
    const rows = Math.max(1, Math.ceil(count / cols));
    const single = meta.singleMonthMode === true;

    const wrap = document.createElement('div');
    wrap.className = 'mini-cal-multi-grid mini-cal-root';
    wrap.style.cssText = `display:grid; grid-template-columns:repeat(${cols}, 1fr); grid-template-rows:repeat(${rows}, 1fr); gap:6px; width:100%; height:100%; box-sizing:border-box; user-select:none;`;

    let y = meta.year ?? now.getFullYear();
    let m = meta.month ?? (now.getMonth() + 1);
    for (let i = 0; i < count; i++) {
      wrap.appendChild(MiniCalendarTool._buildSingleCard(y, m, meta));
      if (!single) {
        m++;
        if (m > 12) { m = 1; y++; }
      }
    }
    return wrap;
  }

  private static _buildCard(meta: MiniCalendarMeta): HTMLElement {
    const count = MiniCalendarTool._monthCount(meta);
    if (count <= 1) {
      const card = MiniCalendarTool._buildSingleCard(meta.year, meta.month, meta);
      card.classList.add('mini-cal-root');
      return card;
    }
    return MiniCalendarTool._buildMultiCard(meta, count);
  }

  /**
   * Rebuilds the card from the element's current _craftoolsMeta. Called
   * directly after every property edit (desktop schema panel's
   * _applyProperty() below) -- previously this only dispatched a
   * 'craftools-minicalendar-regenerate' custom event that nothing listened
   * for, so edits from the desktop panel never actually rebuilt the card.
   *
   * Used to do `element.innerHTML = ''` then append the fresh card straight
   * onto `element` -- which wiped out Element.ts's own `_content`/`_overlay`/
   * `_ctrlbar` children (built once by `_build()` when the element first
   * connects, and never rebuilt afterwards) along with whatever old card was
   * there. `_overlay` is what captures pointerdown to start a drag, and
   * `_ctrlbar` holds the resize/rotate/delete handles -- destroying both
   * meant the very FIRST property edit (display mode, year, month, any
   * theme color) silently made the element permanently undraggable and
   * handle-less, indistinguishable from being locked, for the rest of the
   * session. Now finds and replaces only the previous `.mini-cal-root`
   * (either a single `.cal-month-card`, CalendarRenderer.ts's
   * buildCardElement() root, or a multi-month `.mini-cal-multi-grid`
   * wrapping several of them -- see _buildCard()'s doc comment) in place,
   * leaving Element.ts's own structure untouched.
   */
  public static _regenerate(element: HTMLElement): void {
    const e = element as HTMLElement & { _craftoolsMeta?: MiniCalendarMeta; contentArea?: HTMLElement };
    const meta = e._craftoolsMeta;
    if (!meta) return;
    // Before the element has connected (Element.ts's _build() hasn't run
    // yet), `contentArea` is undefined and the card is still a direct child
    // of `element` itself (see createElement() above) -- same fallback
    // pattern ImageTool.ts uses for its own pre/post-connection <img> host.
    const host = e.contentArea ?? element;
    const oldCard = host.querySelector<HTMLElement>('.mini-cal-root');
    const freshCard = MiniCalendarTool._buildCard(meta);
    if (oldCard) {
      oldCard.replaceWith(freshCard);
    } else {
      host.appendChild(freshCard);
    }
    MiniCalendarTool._triggerChange(element);
  }

  private static _triggerChange(element: HTMLElement): void {
    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }

  /**
   * Builds a fresh `<craftools-element data-craftool="minicalendar">`
   * with a real calendar card inside. Recovered from the pre-migration
   * MiniCalendarTool.js (deleted by the "Purge legacy JS" commit without
   * this logic being ported) -- the previous file had no createElement()
   * at all, throwing "createElement is not a function" for every
   * mini-calendar element creation.
   */
  public static createElement(_type: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsMeta?: MiniCalendarMeta };
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', '190');
    el.setAttribute('h', '210');
    el.setAttribute('data-craftool', 'minicalendar');

    el._craftoolsMeta = MiniCalendarTool.getDefaultMeta();
    el.appendChild(MiniCalendarTool._buildCard(el._craftoolsMeta));

    return el;
  }

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    if (!('calendarType' in existing)) patch.calendarType = meta.calendarType ?? '1';
    if (!('singleMonthMode' in existing)) patch.singleMonthMode = meta.singleMonthMode ?? false;
    if (!('displayMode' in existing)) patch.displayMode = meta.displayMode ?? 'complete1';
    // Single native <input type="month"> field -- see types/PropertySchema.ts's
    // MonthField doc comment. Formatted from meta.year/meta.month (still kept
    // as separate numbers internally -- CalendarRenderer.buildCardElement()
    // and every other _craftoolsMeta consumer below wants two numeric args,
    // not a "YYYY-MM" string) into the native input's own string format.
    if (!('monthYear' in existing)) {
      const y = meta.year ?? now.getFullYear();
      const m = meta.month ?? (now.getMonth() + 1);
      patch.monthYear = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
    }
    if (!('weekStartSunday' in existing)) patch.weekStartSunday = meta.weekStartSunday ?? (AppSettings.get('defaultWeekStart') === 'sunday');
    if (!('highlightDaySource' in existing)) patch.highlightDaySource = meta.highlightDaySource ?? 'today';
    // Theme colors/fonts/radius now read from CalendarTheme's REAL nested
    // shape through CALENDAR_THEME_KEY_PATHS's generic path table (see
    // utils/CalendarThemeKeyPaths.ts) -- falls back to CalendarRenderer's
    // own defaults so a freshly primed panel shows the same values the card
    // actually renders with.
    const theme = (meta.theme ?? {}) as CalendarTheme;
    const defaults = CalendarRenderer.defaultTheme();
    for (const [flatKey, path] of Object.entries(CALENDAR_THEME_KEY_PATHS)) {
      if (flatKey in existing) continue;
      const fromTheme   = getThemePath(theme, path);
      const fromDefault = getThemePath(defaults, path);
      patch[flatKey] = fromTheme !== undefined ? fromTheme : fromDefault;
    }
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Calendar',
        i18nKey: 'miniCalendarTool.sectionCalendar',
        icon: 'calendar_month',
        defaultOpen: true,
        fields: [
          { type: 'select', key: 'calendarType',    label: 'Calendar type',                        i18nKey: 'miniCalendarTool.calendarTypeLabel', options: CALENDAR_TYPE_OPTIONS },
          // Only meaningful (and only shown) when more than one month is on
          // screen -- with calendarType '1' there's nothing to freeze on a
          // single shared month, so the toggle would be dead UI.
          {
            type: 'toggle', key: 'singleMonthMode', label: 'Show single month', i18nKey: 'miniCalendarTool.singleMonthMode',
            hidden: (el) => PropertyRenderer._readState(el).calendarType === '1',
          },
          { type: 'select', key: 'displayMode',    label: 'Display',                              i18nKey: 'miniCalendarTool.displayModeLabel', options: DISPLAY_MODES },
          { type: 'month',  key: 'monthYear',       label: 'Month / Year',                         i18nKey: 'miniCalendarTool.monthYearLabel' },
          { type: 'toggle', key: 'weekStartSunday', label: 'Start week on Sunday (off = Monday)',  i18nKey: 'miniCalendarTool.weekStartSunday' },
        ],
      },
      // Wired to CalendarTheme's real nested shape via THEME_KEY_PATHS below.
      // These 5 sections come from utils/CalendarStyleSchema.ts -- the same
      // canonical field definitions CalendarTool.ts and VariablePanel.ts's
      // miniCalendar config also render, so all three surfaces expose
      // identical style controls (font-select/slider/align typography,
      // gradient-capable color-picker backgrounds, 4-corner radius, toggles)
      // over the exact same CalendarTheme shape.
      ...calendarStyleSections(),
      // Highlights a single chosen day-of-month in the days grid with its
      // own background/text/border -- e.g. "today", or any other date the
      // user wants to stand out. Same standardized color-picker/border
      // vocabulary CommonSchema.ts's borderSection() uses elsewhere in the
      // app, though the resulting value is flattened to a solid hex before
      // reaching CalendarRenderer.ts (see HIGHLIGHT_COLOR_KEYS below) --
      // unlike the Theme section's background fields above, a single
      // highlighted cell's bg/border don't currently resolve gradients.
      {
        section: 'Highlight',
        i18nKey: 'miniCalendarTool.sectionHighlight',
        icon: 'star',
        collapsible: true,
        defaultOpen: false,
        fields: [
          { type: 'toggle', key: 'highlightEnabled', label: 'Highlight a day', i18nKey: 'miniCalendarTool.highlightEnabled' },
          {
            type: 'select', key: 'highlightDaySource', label: 'Day to highlight', i18nKey: 'miniCalendarTool.dayToHighlight',
            options: [
              { value: 'today', label: 'Today (automatic)', i18nKey: 'miniCalendarTool.highlightToday' },
              { value: 'fixed', label: 'Fixed day',         i18nKey: 'miniCalendarTool.highlightFixed' },
            ],
          },
          {
            type: 'number', key: 'highlightDay', label: 'Day', i18nKey: 'miniCalendarTool.highlightDay', min: 1, max: 31, step: 1,
            // Only meaningful (and only shown) when highlightDaySource is
            // 'fixed' -- with 'today' the day is always recomputed, so a
            // manual number here would be misleading dead UI.
            hidden: (el) => PropertyRenderer._readState(el).highlightDaySource !== 'fixed',
          },
          { type: 'color-picker', key: 'highlightBg',          label: 'Background', i18nKey: 'common.background' },
          { type: 'color-picker', key: 'highlightTextColor',   label: 'Text color', i18nKey: 'miniCalendarTool.textColor' },
          { type: 'number', key: 'highlightBorderWidth',  label: 'Border width',  i18nKey: 'common.borderWidth',  min: 0, max: 20, unit: 'px' },
          {
            type: 'select', key: 'highlightBorderStyle', label: 'Border style', i18nKey: 'common.borderStyle',
            options: [
              { value: 'solid',  label: 'Solid' },
              { value: 'dashed', label: 'Dashed' },
              { value: 'dotted', label: 'Dotted' },
              { value: 'double', label: 'Double' },
              { value: 'none',   label: 'None' },
            ],
          },
          { type: 'color-picker', key: 'highlightBorderColor',  label: 'Border color',  i18nKey: 'common.borderColor' },
          { type: 'number',       key: 'highlightBorderRadius', label: 'Border radius',  i18nKey: 'common.borderRadius', min: 0, max: 100, unit: 'px' },
        ],
      },
      zIndexSection(),
    ];
  }

  /** Keys whose value is a JSON ColorPickerValue string (color-picker field
   * type) rather than a plain literal -- extracted down to a bare solid hex
   * for CalendarRenderer.ts, which paints a plain CSS background/border
   * color, not a gradient (same "solid-only, no gradient" call DAYS_BOX
   * makes for its own day-highlight color -- see VariablePanel.ts's
   * `renderColorPicker(..., { allowGradient: false })`). */
  private static readonly HIGHLIGHT_COLOR_KEYS = new Set(['highlightBg', 'highlightTextColor', 'highlightBorderColor']);

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const e = element as HTMLElement & { _craftoolsMeta?: MiniCalendarMeta };
    if (e._craftoolsMeta) {
      const themePath = CALENDAR_THEME_KEY_PATHS[key];
      if (key === 'monthYear') {
        // "YYYY-MM" from the native <input type="month"> -- split back into
        // the two separate numbers _buildCard()/CalendarRenderer still want.
        const [yStr, mStr] = String(value).split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        if (!isNaN(y)) e._craftoolsMeta.year = y;
        if (!isNaN(m)) e._craftoolsMeta.month = m;
      } else if (key === 'displayMode' || key === 'weekStartSunday' || key === 'highlightDaySource' || key === 'calendarType' || key === 'singleMonthMode') {
        (e._craftoolsMeta as unknown as Record<string, unknown>)[key] = value;
      } else if (themePath) {
        const theme = (e._craftoolsMeta.theme ?? {}) as unknown as Record<string, unknown>;
        setThemePath(theme, themePath, value);
        (e._craftoolsMeta as unknown as Record<string, unknown>).theme = theme;
      } else if (key.startsWith('highlight')) {
        const highlight = (e._craftoolsMeta.highlight as unknown as Record<string, unknown>) ?? {};
        const highlightKey = key.replace('highlight', '').replace(/^./, c => c.toLowerCase());
        highlight[highlightKey] = MiniCalendarTool.HIGHLIGHT_COLOR_KEYS.has(key)
          ? normalizeValue(value as string).solid
          : value;
        (e._craftoolsMeta as unknown as Record<string, unknown>).highlight = highlight;
      } else if (key === 'zIndex') {
        element.style.zIndex = String(value);
      }
    }
    // Calls _regenerate() directly (previously dispatched an unlistened
    // 'craftools-minicalendar-regenerate' custom event, so panel edits
    // never actually rebuilt the rendered card).
    MiniCalendarTool._regenerate(element);
  }
}

MiniCalendarTool.registeredKeys = ['minicalendar'];
// icon matches the desktop sidebar (index.html #pwa-sidebar-minicalendar).
ToolRegistry.register({ key: 'minicalendar', label: 'editor.miniCalendar', icon: 'today', tool: MiniCalendarTool, draggable: true, showInFooterNav: false, category: 'elements' });
