// @ts-nocheck
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
