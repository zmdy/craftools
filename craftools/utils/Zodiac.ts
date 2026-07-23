// @ts-nocheck
import {
    faAries, faTaurus, faGemini, faCancer, faLeo, faVirgo,
    faLibra, faScorpio, faSagittarius, faCapricorn, faAquarius, faPisces,
} from '@fortawesome/free-solid-svg-icons';
import { faIconHtml } from './FontAwesomeIcon.js';

/**
 * Zodiac.ts
 *
 * Cálculo do signo do zodíaco (astrologia ocidental/tropical) correspondente
 * a uma data, para o formato de data "Signo do Zodíaco" do Conteúdo
 * Variável (ver VariableEngine.ts's _formatZodiac()). Cálculo 100% local --
 * sem rede, sem API -- mesma filosofia de Seasons.ts/MoonPhases.ts (pura
 * função de mês/dia, sem tabela curada porque não há conteúdo editorial
 * envolvido, ao contrário do formato "Feriado / Data comemorativa").
 *
 * Usa as datas de início/fim mais comumente adotadas pela astrologia
 * tropical ocidental (as mesmas datas "de calendário impresso" que
 * qualquer horóscopo popular usa) -- não a astronomia sideral (que
 * consideraria uma 13ª constelação/datas diferentes), mesma filosofia de
 * aproximação de calendário impresso já documentada em MoonPhases.ts.
 */
export class Zodiac {

    /**
     * pt-BR label + emoji (símbolo Unicode oficial do signo) + ícone (Font
     * Awesome Free Solid -- todos os 12 signos têm um ícone dedicado nesse
     * pacote, ao contrário da Lua que só tem um ícone genérico -- ver
     * MoonPhases.ts). `start`/`end` são [mês, dia] (1-12 / 1-31);
     * Capricórnio é o único que atravessa a virada do ano (22/12 a 19/01).
     */
    static _SIGNS = [
        { sign: 'aries',       label: 'Áries',        emoji: '♈', iconHtml: faIconHtml(faAries),       start: [3, 21],  end: [4, 19] },
        { sign: 'taurus',      label: 'Touro',        emoji: '♉', iconHtml: faIconHtml(faTaurus),      start: [4, 20],  end: [5, 20] },
        { sign: 'gemini',      label: 'Gêmeos',       emoji: '♊', iconHtml: faIconHtml(faGemini),      start: [5, 21],  end: [6, 20] },
        { sign: 'cancer',      label: 'Câncer',       emoji: '♋', iconHtml: faIconHtml(faCancer),      start: [6, 21],  end: [7, 22] },
        { sign: 'leo',         label: 'Leão',         emoji: '♌', iconHtml: faIconHtml(faLeo),         start: [7, 23],  end: [8, 22] },
        { sign: 'virgo',       label: 'Virgem',       emoji: '♍', iconHtml: faIconHtml(faVirgo),       start: [8, 23],  end: [9, 22] },
        { sign: 'libra',       label: 'Libra',        emoji: '♎', iconHtml: faIconHtml(faLibra),       start: [9, 23],  end: [10, 22] },
        { sign: 'scorpio',     label: 'Escorpião',    emoji: '♏', iconHtml: faIconHtml(faScorpio),     start: [10, 23], end: [11, 21] },
        { sign: 'sagittarius', label: 'Sagitário',    emoji: '♐', iconHtml: faIconHtml(faSagittarius), start: [11, 22], end: [12, 21] },
        { sign: 'capricorn',   label: 'Capricórnio',  emoji: '♑', iconHtml: faIconHtml(faCapricorn),   start: [12, 22], end: [1, 19] },
        { sign: 'aquarius',    label: 'Aquário',      emoji: '♒', iconHtml: faIconHtml(faAquarius),    start: [1, 20],  end: [2, 18] },
        { sign: 'pisces',      label: 'Peixes',       emoji: '♓', iconHtml: faIconHtml(faPisces),      start: [2, 19],  end: [3, 20] },
    ];

    /**
     * Signo (uma das 12 entradas de _SIGNS) do mês/dia informado.
     * @param {number} month 1-12
     * @param {number} day 1-31
     */
    static _signForMonthDay(month, day) {
        return this._SIGNS.find(s => {
            const [startMonth, startDay] = s.start;
            const [endMonth, endDay] = s.end;
            if (startMonth === endMonth) {
                return month === startMonth && day >= startDay && day <= endDay;
            }
            if (startMonth < endMonth) {
                // Faixa normal, dentro do mesmo ano (ex: Áries 21/03-19/04).
                if (month === startMonth) return day >= startDay;
                if (month === endMonth) return day <= endDay;
                return month > startMonth && month < endMonth;
            }
            // Atravessa a virada do ano (só Capricórnio: 22/12-19/01).
            if (month === startMonth) return day >= startDay;
            if (month === endMonth) return day <= endDay;
            return month > startMonth || month < endMonth;
        }) ?? this._SIGNS[0];
    }

    /**
     * Signo de uma data qualquer, com label/emoji/ícone prontos. Cálculo
     * 100% local (mesma aproximação de datas fixas desta classe) -- sem
     * rede, sem API.
     * @param {Date} date
     * @returns {{sign:string, label:string, emoji:string, iconHtml:string}}
     */
    static getSignInfo(date) {
        const info = this._signForMonthDay(date.getMonth() + 1, date.getDate());
        return { sign: info.sign, label: info.label, emoji: info.emoji, iconHtml: info.iconHtml };
    }
}
