/**
 * BrazilianHolidays.js
 *
 * Feriados nacionais do Brasil, calculados para qualquer ano (não é uma
 * lista estática de um único ano). Lista base conferida contra a tabela
 * oficial da ANBIMA para 2026 (anbima.com.br/feriados/fer_nacionais/2026.asp).
 *
 * Datas fixas (mesma data todo ano) + datas móveis derivadas do Domingo de
 * Páscoa (algoritmo de Computus, método Anônimo Gregoriano / Meeus-Jones-Butcher).
 */
export class BrazilianHolidays {

    /**
     * Calcula a data do Domingo de Páscoa para um ano (calendário gregoriano).
     * @param {number} year
     * @returns {Date}
     */
    static easterSunday(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }

    static _addDays(date, days) {
        const d = new Date(date.getTime());
        d.setDate(d.getDate() + days);
        return d;
    }

    /**
     * Lista de feriados nacionais de um ano, ordenada por data.
     * @param {number} year
     * @returns {Array<{month:number, day:number, name:string, movable:boolean}>} month é 1-12
     */
    static getHolidaysForYear(year) {
        const easter = this.easterSunday(year);
        const toEntry = (date, name, movable) => ({
            month: date.getMonth() + 1,
            day: date.getDate(),
            name,
            movable,
        });

        const list = [
            toEntry(new Date(year, 0, 1), 'Confraternização Universal', false),
            toEntry(this._addDays(easter, -48), 'Carnaval', true),
            toEntry(this._addDays(easter, -47), 'Carnaval', true),
            toEntry(this._addDays(easter, -2), 'Paixão de Cristo', true),
            toEntry(new Date(year, 3, 21), 'Tiradentes', false),
            toEntry(new Date(year, 4, 1), 'Dia do Trabalho', false),
            toEntry(this._addDays(easter, 60), 'Corpus Christi', true),
            toEntry(new Date(year, 8, 7), 'Independência do Brasil', false),
            toEntry(new Date(year, 9, 12), 'Nossa Sr.ª Aparecida - Padroeira do Brasil', false),
            toEntry(new Date(year, 10, 2), 'Finados', false),
            toEntry(new Date(year, 10, 15), 'Proclamação da República', false),
            toEntry(new Date(year, 11, 25), 'Natal', false),
        ];

        // Feriado nacional desde a Lei 14.759/2023 -- só se aplica a partir de 2024.
        if (year >= 2024) {
            list.push(toEntry(new Date(year, 10, 20), 'Dia Nacional de Zumbi e da Consciência Negra', false));
        }

        return list.sort((x, y) => (x.month - y.month) || (x.day - y.day));
    }

    /**
     * Retorna o nome do feriado numa data específica, ou null se não houver.
     * @param {number} year
     * @param {number} month 1-12
     * @param {number} day
     * @returns {string|null}
     */
    static getHolidayForDate(year, month, day) {
        const holidays = this.getHolidaysForYear(year);
        const found = holidays.find(h => h.month === month && h.day === day);
        return found ? found.name : null;
    }

    /**
     * Retorna todos os feriados de um mês específico (formato compacto,
     * usado pelo CalendarRenderer para montar a legenda "01. Nome do feriado").
     * @param {number} year
     * @param {number} month 1-12
     * @returns {Array<{day:number, name:string}>}
     */
    static getHolidaysForMonth(year, month) {
        return this.getHolidaysForYear(year)
            .filter(h => h.month === month)
            .map(h => ({ day: h.day, name: h.name }));
    }
}
