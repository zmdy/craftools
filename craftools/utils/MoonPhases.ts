// @ts-nocheck
import { faMoon } from '@fortawesome/free-solid-svg-icons';
import { faIconHtml } from './FontAwesomeIcon.js';

/**
 * MoonPhases.js
 *
 * Cálculo aproximado das fases da Lua para exibição no modelo "completo" do
 * calendário. Usa a aproximação clássica de "mês sinódico constante"
 * (referência de lua nova conhecida + período sinódico médio de
 * ~29.53058885 dias) -- é uma aproximação de calendário impresso, com
 * precisão tipicamente dentro de ~1 dia em relação às efemérides reais
 * (não é adequada para uso astronômico/científico).
 */
export class MoonPhases {

    static SYNODIC_MONTH = 29.530588853;

    // Lua nova de referência conhecida: 06/01/2000, 18:14 UTC.
    static REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

    /**
     * Fração do ciclo lunar (0..1) numa data: 0 = nova, 0.25 = crescente,
     * 0.5 = cheia, 0.75 = minguante.
     * @param {Date} date
     * @returns {number}
     */
    static _phaseFraction(date) {
        const diffDays = (date.getTime() - this.REFERENCE_NEW_MOON_MS) / 86400000;
        let phase = (diffDays % this.SYNODIC_MONTH) / this.SYNODIC_MONTH;
        if (phase < 0) phase += 1;
        return phase;
    }

    static _crosses(p1, p2, target) {
        if (p2 >= p1) return target >= p1 && target < p2;
        return target >= p1 || target < p2; // wraparound (virada do ciclo 1.0 -> 0.0)
    }

    static _circularDist(a, b) {
        const d = Math.abs(a - b);
        return Math.min(d, 1 - d);
    }

    /**
     * Nome (pt-BR) da fase principal mais próxima da fração de ciclo `frac`
     * (0..1), usada tanto pela legenda do calendário (indiretamente, via
     * getMoonPhasesForMonth()) quanto pelo formato de data "Fase da Lua" do
     * Conteúdo Variável (getPhaseForDate() abaixo). As 4 fases dividem o
     * ciclo em janelas de 0.25 centradas em 0/0.25/0.5/0.75 -- por isso o
     * "nova" é a única que "embrulha" (envolve tanto frações perto de 1.0
     * quanto perto de 0.0).
     */
    static _nameForFraction(frac) {
        if (frac >= 0.875 || frac < 0.125) return 'nova';
        if (frac < 0.375) return 'crescente';
        if (frac < 0.625) return 'cheia';
        return 'minguante';
    }

    /**
     * pt-BR label + emoji + icon for each of the 4 named phases. Kept as
     * data alongside the calculation itself (not left for a caller to
     * maintain a separate lookup table) so every consumer of "what phase is
     * date X in" -- today just the "Fase da Lua" Conteúdo Variável date
     * format, see VariableEngine.ts's _formatMoonPhase() -- gets the full
     * descriptor from one call.
     *
     * `iconHtml` uses Font Awesome's Free Solid `moon` glyph (via
     * FontAwesomeIcon.ts's faIconHtml()) -- the SAME icon for all 4 phases,
     * since Font Awesome's Free tier only ships one generic moon icon (the
     * per-phase variants -- first-quarter/last-quarter/etc -- are Pro-only,
     * not available in the @fortawesome/free-solid-svg-icons package this
     * app depends on). Previously drew 4 distinct hand-drawn SVGs (one per
     * phase) before Font Awesome was wired up as an option; the emoji
     * (already phase-distinct: 🌑🌓🌕🌗) and label remain the
     * phase-accurate choices when icon mode can't be.
     */
    static _PHASE_INFO = {
        nova: {
            label: 'Lua Nova', emoji: '🌑',
            iconHtml: faIconHtml(faMoon),
        },
        crescente: {
            label: 'Lua Crescente', emoji: '🌓',
            iconHtml: faIconHtml(faMoon),
        },
        cheia: {
            label: 'Lua Cheia', emoji: '🌕',
            iconHtml: faIconHtml(faMoon),
        },
        minguante: {
            label: 'Lua Minguante', emoji: '🌗',
            iconHtml: faIconHtml(faMoon),
        },
    };

    /**
     * Per-language labels for the same 4 phases -- keyed by `lang` (the
     * Variable Content date binding's independent `dateLanguage` field, see
     * VariableEngine.ts's VariableBinding doc comment; NOT the app's own UI
     * language). `_PHASE_INFO.label` above stays as the pt-BR default/
     * fallback so any call site that doesn't pass `lang` keeps behaving
     * exactly as before this table existed.
     */
    static _LABELS = {
        'pt-br': { nova: 'Lua Nova',   crescente: 'Lua Crescente',  cheia: 'Lua Cheia',  minguante: 'Lua Minguante' },
        en:      { nova: 'New Moon',   crescente: 'Waxing Moon',    cheia: 'Full Moon',  minguante: 'Waning Moon' },
        es:      { nova: 'Luna Nueva', crescente: 'Luna Creciente', cheia: 'Luna Llena', minguante: 'Luna Menguante' },
    };

    /**
     * Fase principal (uma das 4: nova/crescente/cheia/minguante) numa data
     * qualquer, com label/emoji/ícone prontos -- diferente de
     * getMoonPhasesForMonth() (que só lista os DIAS DE TRANSIÇÃO de fase
     * dentro de um mês, para a legenda do calendário), esta responde "em
     * que fase a Lua está HOJE" para qualquer data. Cálculo 100% local
     * (mesma aproximação de mês sinódico constante desta classe) -- sem
     * rede, sem API.
     * @param {Date} date
     * @param {'pt-br'|'en'|'es'} [lang='pt-br'] Idioma do `label` retornado
     *   -- ver _LABELS acima.
     * @returns {{phase:'nova'|'crescente'|'cheia'|'minguante', label:string, emoji:string, iconHtml:string}}
     */
    static getPhaseInfo(date, lang = 'pt-br') {
        const phase = this._nameForFraction(this._phaseFraction(date));
        const info  = this._PHASE_INFO[phase];
        const label = (this._LABELS[lang] ?? this._LABELS['pt-br'])[phase];
        return { phase, label, emoji: info.emoji, iconHtml: info.iconHtml };
    }

    /**
     * Lista os dias do mês em que cada uma das 4 fases principais ocorre.
     * @param {number} year
     * @param {number} month 1-12
     * @returns {Array<{day:number, phase:'nova'|'crescente'|'cheia'|'minguante'}>}
     */
    static getMoonPhasesForMonth(year, month) {
        const daysInMonth = new Date(year, month, 0).getDate();
        const targets = [
            { frac: 0, phase: 'nova' },
            { frac: 0.25, phase: 'crescente' },
            { frac: 0.5, phase: 'cheia' },
            { frac: 0.75, phase: 'minguante' },
        ];

        const phaseAtDay = (d) => this._phaseFraction(new Date(Date.UTC(year, month - 1, d, 12, 0, 0)));

        const results = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const pToday = phaseAtDay(day);
            const pTomorrow = day < daysInMonth
                ? phaseAtDay(day + 1)
                : this._phaseFraction(new Date(Date.UTC(year, month, 1, 12, 0, 0)));

            targets.forEach(t => {
                if (!this._crosses(pToday, pTomorrow, t.frac)) return;
                const distToday = this._circularDist(pToday, t.frac);
                const distTomorrow = this._circularDist(pTomorrow, t.frac);
                const chosenDay = distToday <= distTomorrow ? day : Math.min(day + 1, daysInMonth);
                const alreadyMarked = results.some(r => r.phase === t.phase && Math.abs(r.day - chosenDay) <= 1);
                if (!alreadyMarked) results.push({ day: chosenDay, phase: t.phase });
            });
        }

        return results.sort((a, b) => a.day - b.day);
    }
}
