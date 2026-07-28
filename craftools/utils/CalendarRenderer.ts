/**
 * CalendarRenderer.ts
 */

import { BrazilianHolidays } from "./BrazilianHolidays.js";
import { MoonPhases } from "./MoonPhases.js";
import { normalizeValue, cssFromValue } from "./ColorPickerUI.js";

const MONTH_NAMES_PT = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];
const WEEKDAY_LETTERS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const MOON_SYMBOLS: Record<string, string> = {
  nova: '●',
  crescente: '◑',
  cheia: '○',
  minguante: '◐',
};
const MOON_LABELS_PT: Record<string, string> = { nova: 'NOVA', crescente: 'CRESC.', cheia: 'CHEIA', minguante: 'MING.' };

/**
 * `titleBar.bg`, `cellBg` and `weekendBg` are "resolvable" fields: they
 * accept anything utils/ColorPickerUI.ts's `normalizeValue()` understands
 * (a bare hex string, a JSON `ColorPickerValue` string, or a
 * `ColorPickerValue` object) -- buildCardHtml() below resolves them via
 * `cssFromValue(normalizeValue(...))` right before painting, so a gradient
 * picked in the standardized color-picker UI (MiniCalendarTool.ts's Theme
 * section / Variable Content's miniCalendar theme fields) renders as a real
 * CSS gradient here, since both spots use the `background` shorthand (which,
 * unlike `background-color`, happily accepts a `linear-gradient(...)` /
 * `radial-gradient(...)` string). Every other color field here (text/border
 * colors) stays solid-only -- CSS has no gradient `color`/`border-color`
 * without extra tricks (background-clip:text, border-image) this
 * HTML-string-based renderer doesn't attempt -- so those are always plain
 * hex strings, used as-is.
 */
export interface CalendarTheme {
  titleBar?: { bg?: string; color?: string; font?: string; fontWeight?: number; fontSize?: number };
  weekHeader?: { bg?: string; color?: string; font?: string; fontSize?: number; innerBorderWidth?: number; innerBorderStyle?: string; innerBorderColor?: string };
  dayNumbers?: { color?: string; sundayColor?: string; font?: string; fontSize?: number; rowGap?: number; innerBorderWidth?: number; innerBorderStyle?: string; innerBorderColor?: string };
  holidays?: { color?: string; font?: string; fontSize?: number };
  moonPhases?: { color?: string; font?: string; fontSize?: number };
  cellBg?: string;
  cellBorder?: { width?: number; style?: string; color?: string };
  /**
   * Background painted on Saturday/Sunday day-number cells (in addition to
   * the ambient grid border), independent of `dayNumbers.sundayColor`'s
   * text-color-only styling. Empty/unset = no special weekend background
   * (matches the original, pre-Theme-fix visual). A highlighted day (see
   * CalendarOptions.highlight) always takes priority over this.
   */
  weekendBg?: string;
}

export interface CalendarOptions {
  model?: 'simples' | 'completo';
  theme?: CalendarTheme;
  parts?: {
      header?: boolean;
      week?: boolean;
      days?: boolean;
      holidaysBox?: boolean;
      moonBox?: boolean;
  };
  /**
   * Highlights a single chosen day-of-month in the days grid with its own
   * background/text/border, independent of the sunday/holiday color logic
   * in buildCardHtml()'s day loop -- same "highlight one cell out of a
   * grid, with a configurable color+border" idea as VariableEngine.ts's
   * DAYS_BOX date format (daysBoxHighlightColor/daysBoxBorderColor/
   * daysBoxBorderStyle/daysBoxBorderWidth), applied here to a month grid
   * instead of a week-letters row. `day` is 1-based (day-of-month); no
   * effect if it falls outside the rendered month's actual day count.
   */
  highlight?: {
      enabled?: boolean;
      day?: number;
      bg?: string;
      textColor?: string;
      borderWidth?: number;
      borderStyle?: string;
      borderColor?: string;
      borderRadius?: number;
  };
  /**
   * Which day starts the week's column order -- 'sunday' (default, matches
   * the original hardcoded behavior) or 'monday'. Only affects the leading
   * blank-cell count in the days grid and the weekHeader letter order;
   * `isSunday`'s red-highlight logic in buildCardHtml()'s day loop always
   * stays keyed to the standard 0=Sunday JS `Date.getDay()` reference frame
   * regardless of this option, since a Monday-start grid still needs to
   * know which cell is *actually* a Sunday to color it correctly.
   */
  weekStart?: 'sunday' | 'monday';
}

export class CalendarRenderer {

  static defaultTheme(): CalendarTheme {
      return {
          titleBar: { bg: '#e11d2e', color: '#ffffff', font: 'DM Sans', fontWeight: 700, fontSize: 7 },
          weekHeader: { bg: '#1a1a1a', color: '#ffffff', font: 'DM Sans', fontSize: 5, innerBorderWidth: 0, innerBorderStyle: 'solid', innerBorderColor: '#ffffff' },
          dayNumbers: { color: '#1a1a1a', sundayColor: '#e11d2e', font: 'DM Sans', fontSize: 5.5, rowGap: 0, innerBorderWidth: 0, innerBorderStyle: 'solid', innerBorderColor: '#cccccc' },
          holidays: { color: '#e11d2e', font: 'DM Sans', fontSize: 3.2 },
          moonPhases: { color: '#1a1a1a', font: 'DM Sans', fontSize: 3.2 },
          cellBg: '#ffffff',
          cellBorder: { width: 1, style: 'dashed', color: '#cccccc' },
          weekendBg: '',
      };
  }

  static mergeTheme(theme?: CalendarTheme): Required<CalendarTheme> {
      const base = this.defaultTheme() as Required<CalendarTheme>;
      if (!theme) return base;
      return {
          titleBar: { ...base.titleBar, ...(theme.titleBar || {}) },
          weekHeader: { ...base.weekHeader, ...(theme.weekHeader || {}) },
          dayNumbers: { ...base.dayNumbers, ...(theme.dayNumbers || {}) },
          holidays: { ...base.holidays, ...(theme.holidays || {}) },
          moonPhases: { ...base.moonPhases, ...(theme.moonPhases || {}) },
          cellBg: theme.cellBg || base.cellBg,
          cellBorder: { ...base.cellBorder, ...(theme.cellBorder || {}) },
          weekendBg: theme.weekendBg || base.weekendBg,
      } as Required<CalendarTheme>;
  }

  static buildCardHtml(year: number, month: number, options: CalendarOptions = {}): string {
      const model = options.model === 'completo' ? 'completo' : 'simples';
      const t = this.mergeTheme(options.theme) as any;

      // Resolve gradient-capable fields (see CalendarTheme's own doc comment)
      // to real CSS once, up front -- idempotent for plain hex strings
      // (normalizeValue()/cssFromValue() just pass them through unchanged),
      // so this is safe even for legacy themes that never went through the
      // color-picker UI at all.
      const titleBarBg = cssFromValue(normalizeValue(t.titleBar.bg));
      const cellBgResolved = cssFromValue(normalizeValue(t.cellBg));
      const weekendBgResolved = t.weekendBg ? cssFromValue(normalizeValue(t.weekendBg)) : '';

      const parts = Object.assign({
          header: true,
          week: true,
          days: true,
          holidaysBox: true,
          moonBox: model === 'completo',
      }, options.parts || {});

      const firstDay = new Date(year, month - 1, 1);
      const daysInMonth = new Date(year, month, 0).getDate();
      const startWeekday = firstDay.getDay();
      const weekStartsMonday = options.weekStart === 'monday';
      // Leading blank cells before day 1: with a Sunday-first grid this is
      // just `startWeekday` (0 blanks if the month starts on a Sunday).
      // With a Monday-first grid, Sunday (0) is now the LAST column, so a
      // month starting on Sunday needs 6 leading blanks instead of 0 --
      // shift the 0-6 range by -1 (mod 7) to re-anchor it on Monday=0.
      const leadingEmpty = weekStartsMonday ? (startWeekday + 6) % 7 : startWeekday;

      const holidays = BrazilianHolidays.getHolidaysForMonth(year, month);
      const holidayByDay = new Map(holidays.map((h: any) => [h.day, h.name]));

      const dayCellBorder = (t.dayNumbers.innerBorderWidth > 0)
          ? `border:${t.dayNumbers.innerBorderWidth}px ${this._esc(t.dayNumbers.innerBorderStyle)} ${this._esc(t.dayNumbers.innerBorderColor)}; box-sizing:border-box;`
          : '';
      const highlight = options.highlight;
      let cells = '';
      for (let i = 0; i < leadingEmpty; i++) {
          cells += `<span style="display:block; ${dayCellBorder}"></span>`;
      }
      for (let day = 1; day <= daysInMonth; day++) {
          const weekday = (startWeekday + day - 1) % 7;
          const isSunday = weekday === 0;
          const isHoliday = holidayByDay.has(day);
          const isHighlighted = !!highlight?.enabled && highlight.day === day;

          const color = isHighlighted && highlight!.textColor
              ? highlight!.textColor
              : (isSunday || isHoliday) ? t.dayNumbers.sundayColor : t.dayNumbers.color;
          const weight = (isSunday || isHoliday || isHighlighted) ? '700' : '400';

          // The highlighted cell's own background/border REPLACE the
          // ambient grid's `dayCellBorder` entirely (rather than combining
          // with it) -- a highlighted day is meant to stand out as its own
          // distinct cell, not inherit the plain grid-line look every other
          // cell has.
          let cellExtra = dayCellBorder;
          if (isHighlighted) {
              const hlBg          = this._esc(highlight!.bg || 'var(--accent, #f97316)');
              const hlBorderWidth = highlight!.borderWidth ?? 1;
              const hlBorderStyle = this._esc(highlight!.borderStyle || 'solid');
              const hlBorderColor = this._esc(highlight!.borderColor || hlBg);
              const hlRadius      = highlight!.borderRadius ?? 0;
              const hlBorderCss   = hlBorderWidth > 0
                  ? `border:${hlBorderWidth}px ${hlBorderStyle} ${hlBorderColor}; box-sizing:border-box;`
                  : '';
              cellExtra = `background:${hlBg}; ${hlBorderCss} ${hlRadius ? `border-radius:${hlRadius}px;` : ''}`;
          } else if (weekendBgResolved && (weekday === 0 || weekday === 6)) {
              // Saturday/Sunday background (CalendarTheme.weekendBg) -- layers
              // on top of the ambient grid border rather than replacing it,
              // unlike the highlight cell above (which is meant to stand out
              // as its own distinct cell).
              cellExtra = `background:${this._esc(weekendBgResolved)}; ${dayCellBorder}`;
          }

          cells += `<span style="display:block; text-align:center; padding:1px 0; color:${this._esc(color)}; font-weight:${weight}; ${cellExtra}">${day}</span>`;
      }

      const daysGridHtml = parts.days ? `
          <div class="cal-days-grid" style="display:grid; grid-template-columns:repeat(7, 1fr); font-family:'${this._esc(t.dayNumbers.font)}', sans-serif; font-size:${t.dayNumbers.fontSize}pt; line-height:1.25; flex:1; row-gap:${t.dayNumbers.rowGap || 0}px;">
              ${cells}
          </div>
      ` : '';

      const holidaysHtml = (parts.holidaysBox && holidays.length)
          ? `<div class="cal-holidays" style="color:${this._esc(t.holidays.color)}; font-family:'${this._esc(t.holidays.font)}', sans-serif; font-size:${t.holidays.fontSize}pt; text-align:center; line-height:1.3; padding:1px 2px;">
              ${holidays.map((h: any) => `${String(h.day).padStart(2, '0')}. ${this._esc(h.name)}`).join(' &nbsp;&nbsp; ')}
             </div>`
          : '';

      let moonHtml = '';
      if (parts.moonBox) {
          const phases = MoonPhases.getMoonPhasesForMonth(year, month);
          if (phases.length) {
              moonHtml = `
                  <div class="cal-moons" style="display:flex; justify-content:space-around; flex-wrap:wrap; color:${this._esc(t.moonPhases.color)}; font-family:'${this._esc(t.moonPhases.font)}', sans-serif; font-size:${t.moonPhases.fontSize}pt; padding:1px 2px;">
                      ${phases.map((p: any) => `<span style="white-space:nowrap;">${MOON_SYMBOLS[p.phase] || ''} ${String(p.day).padStart(2, '0')} <span style="font-size:0.8em;">${MOON_LABELS_PT[p.phase] || ''}</span></span>`).join('')}
                  </div>
              `;
          }
      }

      const titleBarHtml = parts.header ? `
              <div class="cal-title-bar" style="background:${this._esc(titleBarBg)}; color:${this._esc(t.titleBar.color)}; font-family:'${this._esc(t.titleBar.font)}', sans-serif; font-weight:${t.titleBar.fontWeight}; font-size:${t.titleBar.fontSize}pt; text-align:center; padding:2px 0; letter-spacing:0.3px;">
                  ${MONTH_NAMES_PT[month - 1]} ${year}
              </div>` : '';

      // Rotate the Sunday-first letters array left by 1 for a Monday-first
      // grid (S T Q Q S S D instead of D S T Q Q S S), matching the same
      // shift applied to `leadingEmpty` above.
      const weekHeaderLetters = weekStartsMonday
          ? [...WEEKDAY_LETTERS_PT.slice(1), WEEKDAY_LETTERS_PT[0]]
          : WEEKDAY_LETTERS_PT;

      const weekHeaderHtml = parts.week ? `
              <div class="cal-week-header" style="display:flex; background:${this._esc(t.weekHeader.bg)}; color:${this._esc(t.weekHeader.color)}; font-family:'${this._esc(t.weekHeader.font)}', sans-serif; font-size:${t.weekHeader.fontSize}pt;">
                  ${weekHeaderLetters.map((l, i) => {
                      const isLast = i === weekHeaderLetters.length - 1;
                      const border = (t.weekHeader.innerBorderWidth > 0 && !isLast)
                          ? `border-right:${t.weekHeader.innerBorderWidth}px ${this._esc(t.weekHeader.innerBorderStyle)} ${this._esc(t.weekHeader.innerBorderColor)}; box-sizing:border-box;`
                          : '';
                      return `<span style="flex:1; text-align:center; padding:1px 0; ${border}">${l}</span>`;
                  }).join('')}
              </div>` : '';

      return `
          <div class="cal-month-card" style="width:100%; height:100%; display:flex; flex-direction:column; overflow:hidden; box-sizing:border-box; background:${this._esc(cellBgResolved)}; border:${t.cellBorder.width}px ${this._esc(t.cellBorder.style)} ${this._esc(t.cellBorder.color)};">
              ${titleBarHtml}
              ${weekHeaderHtml}
              ${daysGridHtml}
              ${holidaysHtml}
              ${moonHtml}
          </div>
      `.trim();
  }

  static buildCardElement(year: number, month: number, options: CalendarOptions = {}): HTMLElement {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = this.buildCardHtml(year, month, options);
      return wrapper.firstElementChild as HTMLElement;
  }

  static _esc(val: any): string {
      return String(val == null ? '' : val).replace(/"/g, '&quot;');
  }
}
