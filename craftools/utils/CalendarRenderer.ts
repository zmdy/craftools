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
 * Independent per-corner radius (top-left/top-right/bottom-right/
 * bottom-left) -- CSS `border-radius` shorthand order is TL TR BR BL, NOT
 * clockwise starting top-left (BR and BL are swapped vs. what "reading
 * order" would suggest), so `_radiusCss()` below is the one place that
 * ordering needs to be gotten right; every field/schema in this codebase
 * that produces a RadiusCorners value can just use tl/tr/br/bl in any order
 * without worrying about CSS's own quirky shorthand ordering.
 */
export interface RadiusCorners { tl?: number; tr?: number; br?: number; bl?: number; }

/**
 * `titleBar.bg`, `cellBg`, `weekendBg`, `weekHeader.letterBg`,
 * `dayNumbers.cellBg`, `holidays.bg` and `moonPhases.bg` are all
 * "resolvable" fields: they accept anything utils/ColorPickerUI.ts's
 * `normalizeValue()` understands (a bare hex string, a JSON
 * `ColorPickerValue` string, or a `ColorPickerValue` object) --
 * buildCardHtml() below resolves each via `cssFromValue(normalizeValue(...))`
 * right before painting, so a gradient picked in the standardized
 * color-picker UI renders as a real CSS gradient here, since all of these
 * use the `background` shorthand (which, unlike `background-color`, happily
 * accepts a `linear-gradient(...)` / `radial-gradient(...)` string). Every
 * other color field here (text/border colors) stays solid-only -- CSS has no
 * gradient `color`/`border-color` without extra tricks (background-clip:text,
 * border-image) this HTML-string-based renderer doesn't attempt -- so those
 * are always plain hex strings, used as-is.
 */
export interface CalendarTheme {
  titleBar?: {
    bg?: string; color?: string; font?: string; fontWeight?: number; fontSize?: number;
    /** Horizontal alignment of the "MÊS ANO" text -- ignored (overridden by
     * `splitMonthYear`'s own space-between layout) when that's on. */
    align?: 'left' | 'center' | 'right';
    /**
     * Splits the month name and year to opposite ends of the title bar
     * (`justify-content:space-between`) instead of one centered
     * "JANEIRO 2027" string -- lets a template put the month on the left
     * and the year on the right (or vice-versa via CSS `direction`, not
     * exposed here).
     */
    splitMonthYear?: boolean;
    radius?: RadiusCorners;
  };
  weekHeader?: {
    bg?: string; color?: string; font?: string; fontSize?: number;
    /** Horizontal alignment of each weekday letter inside its own cell. */
    align?: 'left' | 'center' | 'right';
    innerBorderWidth?: number; innerBorderStyle?: string; innerBorderColor?: string;
    radius?: RadiusCorners;
    /**
     * When true, each weekday letter (D/S/T/Q/Q/S/S) paints inside its own
     * fixed-size inner box (`letterBg`/`letterRadius`/`letterSize`) instead
     * of sitting bare in its flex cell -- setting `letterRadius` to a large
     * value (defaultTheme() below defaults to 999, i.e. a full pill/circle)
     * produces a "circle around each weekday initial" look.
     */
    letterShape?: boolean;
    letterBg?: string;
    letterRadius?: RadiusCorners;
    /** Width/height (px) of the per-letter shape box. */
    letterSize?: number;
  };
  /**
   * `cellStyleEnabled` gates the whole per-day-cell background/border/radius
   * group below (`cellBg`/`innerBorder*`/`radius`) -- off by default so a
   * freshly-created calendar keeps the original plain-grid look even though
   * the underlying values may already be non-zero (e.g. right after toggling
   * it on and back off without touching the individual fields). Saturday/
   * Sunday's `weekendBg` and a single-day `CalendarOptions.highlight` are
   * independent of this toggle and always apply on top when set.
   */
  dayNumbers?: {
    color?: string; sundayColor?: string; font?: string; fontSize?: number; rowGap?: number;
    /** Horizontal gap (px) between the 7 day columns of the grid -- 0 (default)
     * keeps the original edge-to-edge columns. Pairs with `rowGap`. */
    colGap?: number;
    /** Horizontal alignment of the day number inside its own cell. */
    align?: 'left' | 'center' | 'right';
    cellStyleEnabled?: boolean;
    cellBg?: string;
    innerBorderWidth?: number; innerBorderStyle?: string; innerBorderColor?: string;
    radius?: RadiusCorners;
    /**
     * When true, the leading/trailing grid cells that belong to the PREVIOUS
     * and NEXT months (the ones normally left blank) render their real day
     * numbers, styled with `otherMonthColor` + the `otherMonthBorder*` trio.
     * When false (default), those cells are truly empty spacers with NO border
     * or background -- so a per-day cell border (the "circle around each day"
     * look) is not drawn on cells that aren't real days of this month.
     */
    otherMonthShow?: boolean;
    otherMonthColor?: string;
    otherMonthBorderWidth?: number; otherMonthBorderStyle?: string; otherMonthBorderColor?: string;
  };
  holidays?: { color?: string; font?: string; fontSize?: number; align?: 'left' | 'center' | 'right'; bg?: string; radius?: RadiusCorners };
  moonPhases?: { color?: string; font?: string; fontSize?: number; bg?: string; radius?: RadiusCorners };
  cellBg?: string;
  cellBorder?: { width?: number; style?: string; color?: string };
  /** Radius of the outer card (the whole `.cal-month-card` container). */
  cardRadius?: RadiusCorners;
  /**
   * Background painted on Saturday/Sunday day-number cells (in addition to
   * the ambient grid border), independent of `dayNumbers.sundayColor`'s
   * text-color-only styling. Empty/unset = no special weekend background
   * (matches the original, pre-Theme-fix visual). A highlighted day (see
   * CalendarOptions.highlight) always takes priority over this.
   */
  weekendBg?: string;
  /**
   * Vertical gap (px) between the card's direct sections (title bar, week
   * header, days grid, holidays box, moon-phases box) -- 0 (default)
   * matches the original stacked-with-no-gap look.
   */
  sectionGap?: number;
  /**
   * Inner padding (px) of the card's own content, i.e. the space between
   * `.cal-month-card`'s outer edge (border/background) and everything
   * painted inside it (title bar, week header, days grid, ...) -- 0
   * (default) matches the original edge-to-edge look. Uniform on all 4
   * sides; unlike sectionGap (which only separates sections FROM each
   * other), this also pulls the FIRST/LAST section in from the card's own
   * outer edge.
   */
  cardPadding?: number;
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
          titleBar: {
              bg: '#e11d2e', color: '#ffffff', font: 'DM Sans', fontWeight: 700, fontSize: 7,
              align: 'center', splitMonthYear: false, radius: {},
          },
          weekHeader: {
              bg: '#1a1a1a', color: '#ffffff', font: 'DM Sans', fontSize: 5, align: 'center',
              innerBorderWidth: 0, innerBorderStyle: 'solid', innerBorderColor: '#ffffff',
              radius: {}, letterShape: false, letterBg: '#ffffff',
              letterRadius: { tl: 999, tr: 999, br: 999, bl: 999 }, letterSize: 18,
          },
          dayNumbers: {
              color: '#1a1a1a', sundayColor: '#e11d2e', font: 'DM Sans', fontSize: 5.5, rowGap: 0, colGap: 0, align: 'center',
              cellStyleEnabled: false, cellBg: '',
              innerBorderWidth: 0, innerBorderStyle: 'solid', innerBorderColor: '#cccccc', radius: {},
              otherMonthShow: false, otherMonthColor: '#c0c0c0',
              otherMonthBorderWidth: 0, otherMonthBorderStyle: 'solid', otherMonthBorderColor: '#e0e0e0',
          },
          holidays: { color: '#e11d2e', font: 'DM Sans', fontSize: 3.2, align: 'center', bg: '', radius: {} },
          moonPhases: { color: '#1a1a1a', font: 'DM Sans', fontSize: 3.2, bg: '', radius: {} },
          cellBg: '#ffffff',
          cellBorder: { width: 1, style: 'dashed', color: '#cccccc' },
          cardRadius: {},
          weekendBg: '',
          sectionGap: 0,
          cardPadding: 0,
      };
  }

  static mergeTheme(theme?: CalendarTheme): Required<CalendarTheme> {
      const base = this.defaultTheme() as Required<CalendarTheme>;
      if (!theme) return base;
      return {
          titleBar: { ...base.titleBar, ...(theme.titleBar || {}), radius: { ...base.titleBar.radius, ...(theme.titleBar?.radius || {}) } },
          weekHeader: {
              ...base.weekHeader, ...(theme.weekHeader || {}),
              radius: { ...base.weekHeader.radius, ...(theme.weekHeader?.radius || {}) },
              letterRadius: { ...base.weekHeader.letterRadius, ...(theme.weekHeader?.letterRadius || {}) },
          },
          dayNumbers: { ...base.dayNumbers, ...(theme.dayNumbers || {}), radius: { ...base.dayNumbers.radius, ...(theme.dayNumbers?.radius || {}) } },
          holidays: { ...base.holidays, ...(theme.holidays || {}), radius: { ...base.holidays.radius, ...(theme.holidays?.radius || {}) } },
          moonPhases: { ...base.moonPhases, ...(theme.moonPhases || {}), radius: { ...base.moonPhases.radius, ...(theme.moonPhases?.radius || {}) } },
          cellBg: theme.cellBg || base.cellBg,
          cellBorder: { ...base.cellBorder, ...(theme.cellBorder || {}) },
          cardRadius: { ...base.cardRadius, ...(theme.cardRadius || {}) },
          weekendBg: theme.weekendBg || base.weekendBg,
          sectionGap: typeof theme.sectionGap === 'number' ? theme.sectionGap : base.sectionGap,
          cardPadding: typeof theme.cardPadding === 'number' ? theme.cardPadding : base.cardPadding,
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
      // Day-header (weekday letters row) background -- was emitted RAW, so any
      // colour picked through the gradient-capable color-picker (stored as a
      // JSON ColorPickerValue string) produced invalid CSS and silently showed
      // no background. Resolved here like every other background field;
      // idempotent for the plain-hex default ('#1a1a1a').
      const weekHeaderBgResolved = cssFromValue(normalizeValue(t.weekHeader.bg));
      const cellBgResolved = cssFromValue(normalizeValue(t.cellBg));
      const weekendBgResolved = t.weekendBg ? cssFromValue(normalizeValue(t.weekendBg)) : '';
      // Per-day-cell background applies as soon as one is set (no longer gated
      // behind the separate Cell Style toggle) -- an empty default still paints
      // nothing, so the plain grid is unchanged. 'transparent' counts as unset.
      const dayCellBgResolved = (t.dayNumbers.cellBg && t.dayNumbers.cellBg !== 'transparent')
          ? cssFromValue(normalizeValue(t.dayNumbers.cellBg)) : '';
      const letterBgResolved = t.weekHeader.letterShape && t.weekHeader.letterBg
          ? cssFromValue(normalizeValue(t.weekHeader.letterBg)) : 'transparent';
      const holidaysBgResolved = t.holidays.bg ? cssFromValue(normalizeValue(t.holidays.bg)) : '';
      const moonBgResolved = t.moonPhases.bg ? cssFromValue(normalizeValue(t.moonPhases.bg)) : '';

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

      // Per-day-cell border/radius/background. Previously ALL of these were
      // gated behind the `cellStyleEnabled` toggle, so setting a cell
      // background/border/radius did nothing until the user also found and
      // flipped that separate switch -- the controls read as broken. They now
      // self-enable: a set background or a >0 border width (or the explicit
      // toggle) turns cell styling on, while a pristine theme (empty bg, 0
      // border) still renders a plain grid exactly as before.
      const hasCellBorder = t.dayNumbers.innerBorderWidth > 0;
      const cellStyleOn = !!t.dayNumbers.cellStyleEnabled || !!dayCellBgResolved || hasCellBorder;
      const dayCellRadiusCss = cellStyleOn ? this._radiusCss(t.dayNumbers.radius) : '';
      const dayCellBorderCss = hasCellBorder
          ? `border:${t.dayNumbers.innerBorderWidth}px ${this._esc(t.dayNumbers.innerBorderStyle)} ${this._esc(t.dayNumbers.innerBorderColor)}; box-sizing:border-box;`
          : '';
      const dayCellBase = [dayCellBorderCss, dayCellRadiusCss].filter(Boolean).join(' ');

      // Previous/next-month "other month" cells (see CalendarTheme.dayNumbers
      // .otherMonthShow). When shown they render the real prev/next-month day
      // number styled with otherMonthColor + its own border; when hidden they
      // are blank spacers with NO styling -- so a per-day cell border isn't
      // painted on cells that aren't real days of this month.
      const otherShow = !!t.dayNumbers.otherMonthShow;
      const otherColor = t.dayNumbers.otherMonthColor || '#c0c0c0';
      const otherBorderCss = (t.dayNumbers.otherMonthBorderWidth > 0)
          ? `border:${t.dayNumbers.otherMonthBorderWidth}px ${this._esc(t.dayNumbers.otherMonthBorderStyle)} ${this._esc(t.dayNumbers.otherMonthBorderColor)}; box-sizing:border-box;`
          : '';
      const otherCellExtra = [otherBorderCss, dayCellRadiusCss].filter(Boolean).join(' ');
      const otherCell = (n: number): string =>
          `<span style="display:flex; align-items:center; justify-content:${this._justify(t.dayNumbers.align)}; box-sizing:border-box; color:${this._esc(otherColor)}; font-weight:400; ${otherCellExtra}">${n}</span>`;

      const highlight = options.highlight;
      let cells = '';
      // Leading cells: trailing days of the previous month.
      const prevMonthDays = new Date(year, month - 1, 0).getDate();
      for (let i = 0; i < leadingEmpty; i++) {
          cells += otherShow
              ? otherCell(prevMonthDays - leadingEmpty + 1 + i)
              : `<span style="display:flex;"></span>`;
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
          // ambient grid's `dayCellBase` entirely (rather than combining
          // with it) -- a highlighted day is meant to stand out as its own
          // distinct cell, not inherit the plain grid-line look every other
          // cell has.
          let cellExtra = dayCellBase;
          if (dayCellBgResolved) cellExtra = `${cellExtra} background:${this._esc(dayCellBgResolved)};`;
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
              // on top of the ambient grid border/radius rather than
              // replacing it, unlike the highlight cell above (which is
              // meant to stand out as its own distinct cell).
              cellExtra = `background:${this._esc(weekendBgResolved)}; ${dayCellBase}`;
          }

          // Vertical + horizontal centering via flex (instead of the old
          // `display:block; text-align:center; padding:1px 0`) so the day
          // number always sits centered inside its span regardless of
          // whatever height the cell ends up at (taller cells from a
          // background/border/bigger font no longer leave the number glued
          // to the top).
          cells += `<span style="display:flex; align-items:center; justify-content:${this._justify(t.dayNumbers.align)}; box-sizing:border-box; color:${this._esc(color)}; font-weight:${weight}; ${cellExtra}">${day}</span>`;
      }

      // Trailing cells: leading days of the next month, only rendered when
      // "other month" days are shown (so the last week row is completed).
      // Hidden mode adds nothing here -- matching the original look.
      if (otherShow) {
          const trailing = (7 - ((leadingEmpty + daysInMonth) % 7)) % 7;
          for (let i = 1; i <= trailing; i++) cells += otherCell(i);
      }

      const daysGridHtml = parts.days ? `
          <div class="cal-days-grid" style="display:grid; grid-template-columns:repeat(7, 1fr); font-family:'${this._esc(t.dayNumbers.font)}', sans-serif; font-size:${t.dayNumbers.fontSize}pt; line-height:1.25; flex:1; row-gap:${t.dayNumbers.rowGap || 0}px; column-gap:${t.dayNumbers.colGap || 0}px;">
              ${cells}
          </div>
      ` : '';

      const holidaysBgCss = holidaysBgResolved ? `background:${this._esc(holidaysBgResolved)};` : '';
      const holidaysHtml = (parts.holidaysBox && holidays.length)
          ? `<div class="cal-holidays" style="color:${this._esc(t.holidays.color)}; font-family:'${this._esc(t.holidays.font)}', sans-serif; font-size:${t.holidays.fontSize}pt; text-align:${this._esc(t.holidays.align || 'center')}; line-height:1.3; padding:1px 2px; box-sizing:border-box; ${holidaysBgCss} ${this._radiusCss(t.holidays.radius)}">
              ${holidays.map((h: any) => `${String(h.day).padStart(2, '0')}. ${this._esc(h.name)}`).join(' &nbsp;&nbsp; ')}
             </div>`
          : '';

      let moonHtml = '';
      if (parts.moonBox) {
          const phases = MoonPhases.getMoonPhasesForMonth(year, month);
          if (phases.length) {
              const moonBgCss = moonBgResolved ? `background:${this._esc(moonBgResolved)};` : '';
              moonHtml = `
                  <div class="cal-moons" style="display:flex; justify-content:space-around; flex-wrap:wrap; color:${this._esc(t.moonPhases.color)}; font-family:'${this._esc(t.moonPhases.font)}', sans-serif; font-size:${t.moonPhases.fontSize}pt; padding:1px 2px; box-sizing:border-box; ${moonBgCss} ${this._radiusCss(t.moonPhases.radius)}">
                      ${phases.map((p: any) => `<span style="white-space:nowrap;">${MOON_SYMBOLS[p.phase] || ''} ${String(p.day).padStart(2, '0')} <span style="font-size:0.8em;">${MOON_LABELS_PT[p.phase] || ''}</span></span>`).join('')}
                  </div>
              `;
          }
      }

      const titleBarInner = t.titleBar.splitMonthYear
          ? `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"><span>${MONTH_NAMES_PT[month - 1]}</span><span>${year}</span></div>`
          : `${MONTH_NAMES_PT[month - 1]} ${year}`;

      const titleBarHtml = parts.header ? `
              <div class="cal-title-bar" style="background:${this._esc(titleBarBg)}; color:${this._esc(t.titleBar.color)}; font-family:'${this._esc(t.titleBar.font)}', sans-serif; font-weight:${t.titleBar.fontWeight}; font-size:${t.titleBar.fontSize}pt; text-align:${this._esc(t.titleBar.align || 'center')}; padding:2px 6px; letter-spacing:0.3px; box-sizing:border-box; ${this._radiusCss(t.titleBar.radius)}">
                  ${titleBarInner}
              </div>` : '';

      // Rotate the Sunday-first letters array left by 1 for a Monday-first
      // grid (S T Q Q S S D instead of D S T Q Q S S), matching the same
      // shift applied to `leadingEmpty` above.
      const weekHeaderLetters = weekStartsMonday
          ? [...WEEKDAY_LETTERS_PT.slice(1), WEEKDAY_LETTERS_PT[0]]
          : WEEKDAY_LETTERS_PT;

      const letterSize = t.weekHeader.letterSize || 18;
      const letterShapeCss = t.weekHeader.letterShape
          ? `display:inline-flex; align-items:center; justify-content:center; width:${letterSize}px; height:${letterSize}px; background:${this._esc(letterBgResolved)}; box-sizing:border-box; ${this._radiusCss(t.weekHeader.letterRadius)}`
          : '';

      const weekHeaderHtml = parts.week ? `
              <div class="cal-week-header" style="display:flex; background:${this._esc(weekHeaderBgResolved)}; color:${this._esc(t.weekHeader.color)}; font-family:'${this._esc(t.weekHeader.font)}', sans-serif; font-size:${t.weekHeader.fontSize}pt; box-sizing:border-box; ${this._radiusCss(t.weekHeader.radius)}">
                  ${weekHeaderLetters.map((l, i) => {
                      const isLast = i === weekHeaderLetters.length - 1;
                      const border = (t.weekHeader.innerBorderWidth > 0 && !isLast)
                          ? `border-right:${t.weekHeader.innerBorderWidth}px ${this._esc(t.weekHeader.innerBorderStyle)} ${this._esc(t.weekHeader.innerBorderColor)}; box-sizing:border-box;`
                          : '';
                      const inner = t.weekHeader.letterShape ? `<span style="${letterShapeCss}">${l}</span>` : l;
                      return `<span style="flex:1; display:flex; align-items:center; justify-content:${this._justify(t.weekHeader.align)}; padding:1px 0; box-sizing:border-box; ${border}">${inner}</span>`;
                  }).join('')}
              </div>` : '';

      return `
          <div class="cal-month-card" style="width:100%; height:100%; display:flex; flex-direction:column; overflow:hidden; box-sizing:border-box; background:${this._esc(cellBgResolved)}; border:${t.cellBorder.width}px ${this._esc(t.cellBorder.style)} ${this._esc(t.cellBorder.color)}; gap:${t.sectionGap || 0}px; padding:${t.cardPadding || 0}px; ${this._radiusCss(t.cardRadius)}">
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

  /**
   * Grid column count per supported multi-month count -- single source of
   * truth shared by every "show N months at once" surface in the app
   * (MiniCalendarTool.ts's own element, and Variable Content's miniCalendar
   * binding via `buildMultiMonthHtml()` below), so their layouts can never
   * drift out of sync. Row count is always `count / cols` (every entry here
   * was chosen to divide evenly). 12/16/20 mirror CalendarTool.ts's (the
   * full-page Calendar generator) own GRID_PRESETS shapes (`grid12`:
   * 3x4, `grid20`: 4x5) for a consistent "yearly poster" look across tools.
   */
  static readonly MULTI_MONTH_COLS: Record<string, number> = {
      '1': 1, '2': 2, '3': 3, '6': 3, '12': 3, '16': 4, '20': 4,
  };

  /**
   * Lays `count` months out as an HTML string, in a CSS grid filling its
   * container (`width:100%; height:100%`) -- the shared building block
   * behind both MiniCalendarTool.ts's `_buildMultiCard()` (which wraps this
   * in a real DOM element via `buildMultiMonthElement()` below) and
   * VariableEngine.ts's `_formatMiniCalendar()` (which uses the HTML string
   * directly, same as every other format function in that file).
   *
   * Explicit `grid-template-rows: repeat(rows, 1fr)` (rather than leaving
   * rows `auto`) matters here: each card's own root is styled
   * `width:100%; height:100%` (buildCardHtml() above), and a percentage
   * height on a grid item only resolves against a track with a DEFINITE
   * size -- an `auto` row sized off its own 100%-height content is circular
   * and collapses unpredictably. `1fr` against the wrap's own (definite,
   * from its container) height avoids that.
   *
   * `singleMonthMode` freezes every card on `startYear`/`startMonth`
   * instead of advancing -- mirrors CalendarTool.ts's 'repetido1' fill mode
   * for the full-page Calendar generator. `count <= 1` just returns a
   * single plain `buildCardHtml()` call (no grid wrapper needed).
   */
  static buildMultiMonthHtml(startYear: number, startMonth: number, count: number, options: CalendarOptions = {}, singleMonthMode = false): string {
      if (count <= 1) return this.buildCardHtml(startYear, startMonth, options);

      const cols = this.MULTI_MONTH_COLS[String(count)] ?? count;
      const rows = Math.max(1, Math.ceil(count / cols));

      let y = startYear;
      let m = startMonth;
      const cards: string[] = [];
      for (let i = 0; i < count; i++) {
          cards.push(`<div style="min-width:0; min-height:0;">${this.buildCardHtml(y, m, options)}</div>`);
          if (!singleMonthMode) {
              m++;
              if (m > 12) { m = 1; y++; }
          }
      }

      return `<div class="mini-cal-multi-grid mini-cal-root" style="display:grid; grid-template-columns:repeat(${cols}, 1fr); grid-template-rows:repeat(${rows}, 1fr); gap:6px; width:100%; height:100%; box-sizing:border-box; user-select:none;">${cards.join('')}</div>`;
  }

  /** Element-returning twin of `buildMultiMonthHtml()` -- same relationship `buildCardElement()` has to `buildCardHtml()`. */
  static buildMultiMonthElement(startYear: number, startMonth: number, count: number, options: CalendarOptions = {}, singleMonthMode = false): HTMLElement {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = this.buildMultiMonthHtml(startYear, startMonth, count, options, singleMonthMode);
      return wrapper.firstElementChild as HTMLElement;
  }

  /**
   * CSS `border-radius` shorthand order is TL TR BR BL -- see
   * RadiusCorners's own doc comment for why that ordering matters here.
   * Returns '' (no declaration) when every corner is 0/unset, so callers
   * can splice this straight into a style string unconditionally.
   */
  static _radiusCss(r?: RadiusCorners): string {
      if (!r) return '';
      const tl = r.tl || 0, tr = r.tr || 0, br = r.br || 0, bl = r.bl || 0;
      if (!tl && !tr && !br && !bl) return '';
      return `border-radius:${tl}px ${tr}px ${br}px ${bl}px;`;
  }

  /** Maps a titleBar/weekHeader/dayNumbers/holidays `align` value to the
   * flex `justify-content` keyword used inside their own centered cells. */
  static _justify(align?: string): string {
      return align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  }

  static _esc(val: any): string {
      return String(val == null ? '' : val).replace(/"/g, '&quot;');
  }
}
