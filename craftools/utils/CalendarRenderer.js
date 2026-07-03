import { BrazilianHolidays } from "./BrazilianHolidays.js";
import { MoonPhases } from "./MoonPhases.js";

const MONTH_NAMES_PT = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];
const WEEKDAY_LETTERS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// Símbolos usados na linha de fases da lua (modelo "completo").
const MOON_SYMBOLS = {
    nova: '●',       // ● lua nova (não visível)
    crescente: '◑',  // ◑ quarto crescente
    cheia: '○',      // ○ lua cheia
    minguante: '◐',  // ◐ quarto minguante
};
const MOON_LABELS_PT = { nova: 'NOVA', crescente: 'CRESC.', cheia: 'CHEIA', minguante: 'MING.' };

/**
 * CalendarRenderer
 *
 * Gerador puro (sem estado) de um "cartão" de mini-calendário mensal --
 * título do mês, cabeçalho dos dias da semana, grade de dias (domingos e
 * feriados destacados), legenda dos feriados do mês e, no modelo "completo",
 * uma linha com as fases da lua. Usado tanto para a prévia ao vivo no editor
 * quanto (de forma idêntica) na geração final das páginas -- não há
 * "regeneração" dinâmica como em QRCode/Barcode, o card é montado uma vez.
 *
 * IMPORTANTE: todo o CSS de layout é aplicado via estilo inline (não em
 * classes de craftools.css), porque a Exportação de PDF (PdfExport.js)
 * serializa cada página num documento HTML autocontido que NÃO carrega o
 * CSS principal do app -- só o que estiver inline (ou no <style> que o
 * próprio PdfExport gera) sobrevive à impressão/exportação.
 */
export class CalendarRenderer {

    static defaultTheme() {
        return {
            titleBar: { bg: '#e11d2e', color: '#ffffff', font: 'DM Sans', fontWeight: 700, fontSize: 7 },
            weekHeader: { bg: '#1a1a1a', color: '#ffffff', font: 'DM Sans', fontSize: 5 },
            dayNumbers: { color: '#1a1a1a', sundayColor: '#e11d2e', font: 'DM Sans', fontSize: 5.5 },
            holidays: { color: '#e11d2e', font: 'DM Sans', fontSize: 3.2 },
            moonPhases: { color: '#1a1a1a', font: 'DM Sans', fontSize: 3.2 },
            cellBg: '#ffffff',
            cellBorder: { width: 1, style: 'dashed', color: '#cccccc' },
        };
    }

    static mergeTheme(theme) {
        const base = this.defaultTheme();
        if (!theme) return base;
        return {
            titleBar: { ...base.titleBar, ...(theme.titleBar || {}) },
            weekHeader: { ...base.weekHeader, ...(theme.weekHeader || {}) },
            dayNumbers: { ...base.dayNumbers, ...(theme.dayNumbers || {}) },
            holidays: { ...base.holidays, ...(theme.holidays || {}) },
            moonPhases: { ...base.moonPhases, ...(theme.moonPhases || {}) },
            cellBg: theme.cellBg || base.cellBg,
            cellBorder: { ...base.cellBorder, ...(theme.cellBorder || {}) },
        };
    }

    /**
     * Monta o HTML do card de um mês. Todo o layout crítico usa estilo
     * inline (ver nota da classe) -- as classes `cal-*` existem só como
     * "hooks" opcionais, não carregam nenhum CSS necessário.
     * @param {number} year
     * @param {number} month 1-12
     * @param {object} [options]
     * @param {'simples'|'completo'} [options.model]
     * @param {object} [options.theme]
     * @returns {string}
     */
    static buildCardHtml(year, month, options = {}) {
        const model = options.model === 'completo' ? 'completo' : 'simples';
        const t = this.mergeTheme(options.theme);

        const firstDay = new Date(year, month - 1, 1);
        const daysInMonth = new Date(year, month, 0).getDate();
        const startWeekday = firstDay.getDay(); // 0 = domingo

        const holidays = BrazilianHolidays.getHolidaysForMonth(year, month);
        const holidayByDay = new Map(holidays.map(h => [h.day, h.name]));

        // ── Grade de dias (grid 7 colunas) ───────────────────────────────
        let cells = '';
        for (let i = 0; i < startWeekday; i++) {
            cells += `<span style="display:block;"></span>`;
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const weekday = (startWeekday + day - 1) % 7;
            const isSunday = weekday === 0;
            const isHoliday = holidayByDay.has(day);
            const color = (isSunday || isHoliday) ? t.dayNumbers.sundayColor : t.dayNumbers.color;
            const weight = (isSunday || isHoliday) ? '700' : '400';
            cells += `<span style="display:block; text-align:center; padding:1px 0; color:${this._esc(color)}; font-weight:${weight};">${day}</span>`;
        }

        const daysGridHtml = `
            <div class="cal-days-grid" style="display:grid; grid-template-columns:repeat(7, 1fr); font-family:'${this._esc(t.dayNumbers.font)}', sans-serif; font-size:${t.dayNumbers.fontSize}pt; line-height:1.25; flex:1;">
                ${cells}
            </div>
        `;

        // ── Legenda de feriados ──────────────────────────────────────────
        const holidaysHtml = holidays.length
            ? `<div class="cal-holidays" style="color:${this._esc(t.holidays.color)}; font-family:'${this._esc(t.holidays.font)}', sans-serif; font-size:${t.holidays.fontSize}pt; text-align:center; line-height:1.3; padding:1px 2px;">
                ${holidays.map(h => `${String(h.day).padStart(2, '0')}. ${this._esc(h.name)}`).join(' &nbsp;&nbsp; ')}
               </div>`
            : '';

        // ── Fases da lua (modelo completo) ───────────────────────────────
        let moonHtml = '';
        if (model === 'completo') {
            const phases = MoonPhases.getMoonPhasesForMonth(year, month);
            if (phases.length) {
                moonHtml = `
                    <div class="cal-moons" style="display:flex; justify-content:space-around; flex-wrap:wrap; color:${this._esc(t.moonPhases.color)}; font-family:'${this._esc(t.moonPhases.font)}', sans-serif; font-size:${t.moonPhases.fontSize}pt; padding:1px 2px;">
                        ${phases.map(p => `<span style="white-space:nowrap;">${MOON_SYMBOLS[p.phase] || ''} ${String(p.day).padStart(2, '0')} <span style="font-size:0.8em;">${MOON_LABELS_PT[p.phase] || ''}</span></span>`).join('')}
                    </div>
                `;
            }
        }

        return `
            <div class="cal-month-card" style="width:100%; height:100%; display:flex; flex-direction:column; overflow:hidden; box-sizing:border-box; background:${this._esc(t.cellBg)}; border:${t.cellBorder.width}px ${this._esc(t.cellBorder.style)} ${this._esc(t.cellBorder.color)};">
                <div class="cal-title-bar" style="background:${this._esc(t.titleBar.bg)}; color:${this._esc(t.titleBar.color)}; font-family:'${this._esc(t.titleBar.font)}', sans-serif; font-weight:${t.titleBar.fontWeight}; font-size:${t.titleBar.fontSize}pt; text-align:center; padding:2px 0; letter-spacing:0.3px;">
                    ${MONTH_NAMES_PT[month - 1]} ${year}
                </div>
                <div class="cal-week-header" style="display:flex; background:${this._esc(t.weekHeader.bg)}; color:${this._esc(t.weekHeader.color)}; font-family:'${this._esc(t.weekHeader.font)}', sans-serif; font-size:${t.weekHeader.fontSize}pt;">
                    ${WEEKDAY_LETTERS_PT.map(l => `<span style="flex:1; text-align:center; padding:1px 0;">${l}</span>`).join('')}
                </div>
                ${daysGridHtml}
                ${holidaysHtml}
                ${moonHtml}
            </div>
        `;
    }

    /** @returns {HTMLElement} */
    static buildCardElement(year, month, options = {}) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = this.buildCardHtml(year, month, options);
        return wrapper.firstElementChild;
    }

    static _esc(val) {
        return String(val == null ? '' : val).replace(/"/g, '&quot;');
    }
}
