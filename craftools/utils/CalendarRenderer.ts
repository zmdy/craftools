/**
 * CalendarRenderer.ts
 */

import { BrazilianHolidays } from "./BrazilianHolidays.js";
import { MoonPhases } from "./MoonPhases.js";

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

export interface CalendarTheme {
  titleBar?: { bg?: string; color?: string; font?: string; fontWeight?: number; fontSize?: number };
  weekHeader?: { bg?: string; color?: string; font?: string; fontSize?: number; innerBorderWidth?: number; innerBorderStyle?: string; innerBorderColor?: string };
  dayNumbers?: { color?: string; sundayColor?: string; font?: string; fontSize?: number; rowGap?: number; innerBorderWidth?: number; innerBorderStyle?: string; innerBorderColor?: string };
  holidays?: { color?: string; font?: string; fontSize?: number };
  moonPhases?: { color?: string; font?: string; fontSize?: number };
  cellBg?: string;
  cellBorder?: { width?: number; style?: string; color?: string };
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
      } as Required<CalendarTheme>;
  }

  static buildCardHtml(year: number, month: number, options: CalendarOptions = {}): string {
      const model = options.model === 'completo' ? 'completo' : 'simples';
      const t = this.mergeTheme(options.theme) as any; 
      
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

      const holidays = BrazilianHolidays.getHolidaysForMonth(year, month);
      const holidayByDay = new Map(holidays.map((h: any) => [h.day, h.name]));

      const dayCellBorder = (t.dayNumbers.innerBorderWidth > 0)
          ? `border:${t.dayNumbers.innerBorderWidth}px ${this._esc(t.dayNumbers.innerBorderStyle)} ${this._esc(t.dayNumbers.innerBorderColor)}; box-sizing:border-box;`
          : '';
      let cells = '';
      for (let i = 0; i < startWeekday; i++) {
          cells += `<span style="display:block; ${dayCellBorder}"></span>`;
      }
      for (let day = 1; day <= daysInMonth; day++) {
          const weekday = (startWeekday + day - 1) % 7;
          const isSunday = weekday === 0;
          const isHoliday = holidayByDay.has(day);
          const color = (isSunday || isHoliday) ? t.dayNumbers.sundayColor : t.dayNumbers.color;
          const weight = (isSunday || isHoliday) ? '700' : '400';
          cells += `<span style="display:block; text-align:center; padding:1px 0; color:${this._esc(color)}; font-weight:${weight}; ${dayCellBorder}">${day}</span>`;
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
              <div class="cal-title-bar" style="background:${this._esc(t.titleBar.bg)}; color:${this._esc(t.titleBar.color)}; font-family:'${this._esc(t.titleBar.font)}', sans-serif; font-weight:${t.titleBar.fontWeight}; font-size:${t.titleBar.fontSize}pt; text-align:center; padding:2px 0; letter-spacing:0.3px;">
                  ${MONTH_NAMES_PT[month - 1]} ${year}
              </div>` : '';

      const weekHeaderHtml = parts.week ? `
              <div class="cal-week-header" style="display:flex; background:${this._esc(t.weekHeader.bg)}; color:${this._esc(t.weekHeader.color)}; font-family:'${this._esc(t.weekHeader.font)}', sans-serif; font-size:${t.weekHeader.fontSize}pt;">
                  ${WEEKDAY_LETTERS_PT.map((l, i) => {
                      const isLast = i === WEEKDAY_LETTERS_PT.length - 1;
                      const border = (t.weekHeader.innerBorderWidth > 0 && !isLast)
                          ? `border-right:${t.weekHeader.innerBorderWidth}px ${this._esc(t.weekHeader.innerBorderStyle)} ${this._esc(t.weekHeader.innerBorderColor)}; box-sizing:border-box;`
                          : '';
                      return `<span style="flex:1; text-align:center; padding:1px 0; ${border}">${l}</span>`;
                  }).join('')}
              </div>` : '';

      return `
          <div class="cal-month-card" style="width:100%; height:100%; display:flex; flex-direction:column; overflow:hidden; box-sizing:border-box; background:${this._esc(t.cellBg)}; border:${t.cellBorder.width}px ${this._esc(t.cellBorder.style)} ${this._esc(t.cellBorder.color)};">
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
