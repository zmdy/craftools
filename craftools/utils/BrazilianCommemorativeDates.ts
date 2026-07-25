/**
 * BrazilianCommemorativeDates.ts
 *
 * Local computed backup for craftools_api's `calendar-dates` resource --
 * the same role GridSizes.ts plays for `loadGridSizes()` (ApiDataLoader.ts),
 * just triggered ONLY when the API call fails/returns nothing usable
 * instead of always being concatenated alongside it: a duplicated GridSizes
 * entry is harmless, but a duplicated holiday the API DID return correctly
 * would show twice, so this is wired in as a fallback, not a merge.
 *
 * Covers exactly the two categories worth computing locally: national
 * holidays ('holiday') and the small set of major commercial/cultural
 * commemorative dates ('commemoration_main'). Saints-of-the-day and misc
 * commemorative dates come from a large, externally curated dataset with no
 * reasonable algorithmic substitute, so those two groups are always empty
 * here -- see ApiDataLoader.ts's loadCalendarDate() for how this plugs in.
 *
 * Movable dates reuse BrazilianHolidays.ts's own Easter/Computus
 * calculation for consistency, but this file does NOT reuse
 * BrazilianHolidays.getHolidaysForYear() itself: that list (used only by
 * MiniCalendarTool's separate "holidaysBox" display) treats Carnaval and
 * Domingo de Páscoa as holidays, while the real calendar_entries API
 * (mirroring the feriados-brasil/joaopbini source) explicitly does NOT --
 * both are 'commemoration_main' there, not 'holiday'. Keeping a small,
 * independent holiday list here matches what the live API actually returns
 * instead of inheriting that older file's different convention.
 */
import { BrazilianHolidays } from './BrazilianHolidays.js';

interface FallbackEntry {
    id:    string;
    title: string;
}

interface FallbackResult {
    month:              number;
    day:                number;
    holidays:           FallbackEntry[];
    commemorationsMain: FallbackEntry[];
    commemorationsMisc: FallbackEntry[];
    saints:             FallbackEntry[];
    events:             FallbackEntry[];
}

function entry(title: string): FallbackEntry {
    // Deterministic id (not a real uuid) -- fine here since these never
    // get persisted or compared against real API rows, only ever rendered.
    return { id: 'local:' + title, title };
}

/** N-th occurrence of `weekday` (0=Sunday..6=Saturday) in a given month, e.g. the 2nd Sunday of May. */
function nthWeekdayOfMonth(year: number, month0: number, weekday: number, n: number): Date {
    const first = new Date(year, month0, 1);
    const firstWeekday = first.getDay();
    const offset = (weekday - firstWeekday + 7) % 7;
    const day = 1 + offset + (n - 1) * 7;
    return new Date(year, month0, day);
}

export class BrazilianCommemorativeDates {

    /**
     * National holidays this fallback recognizes for a given year --
     * intentionally excludes Carnaval/Domingo de Páscoa (see file header),
     * unlike BrazilianHolidays.getHolidaysForYear().
     */
    private static _holidaysForYear(year: number): Array<{ month: number; day: number; title: string }> {
        const easter = BrazilianHolidays.easterSunday(year);
        const addDays = (d: Date, days: number) => BrazilianHolidays._addDays(d, days);
        const toEntry = (date: Date, title: string) => ({ month: date.getMonth() + 1, day: date.getDate(), title });

        const list = [
            toEntry(new Date(year, 0, 1), 'Confraternização Universal'),
            toEntry(addDays(easter, -2), 'Paixão de Cristo (Sexta-Feira Santa)'),
            toEntry(new Date(year, 3, 21), 'Tiradentes'),
            toEntry(new Date(year, 4, 1), 'Dia do Trabalho'),
            toEntry(addDays(easter, 60), 'Corpus Christi'),
            toEntry(new Date(year, 8, 7), 'Independência do Brasil'),
            toEntry(new Date(year, 9, 12), 'Nossa Sr.ª Aparecida - Padroeira do Brasil'),
            toEntry(new Date(year, 10, 2), 'Finados'),
            toEntry(new Date(year, 10, 15), 'Proclamação da República'),
            toEntry(new Date(year, 11, 25), 'Natal'),
        ];
        if (year >= 2024) {
            list.push(toEntry(new Date(year, 10, 20), 'Dia Nacional de Zumbi e da Consciência Negra'));
        }
        return list;
    }

    /** Main commercial/cultural commemorative dates this fallback recognizes for a given year. */
    private static _mainCommemorationsForYear(year: number): Array<{ month: number; day: number; title: string }> {
        const easter = BrazilianHolidays.easterSunday(year);
        const addDays = (d: Date, days: number) => BrazilianHolidays._addDays(d, days);
        const toEntry = (date: Date, title: string) => ({ month: date.getMonth() + 1, day: date.getDate(), title });

        return [
            toEntry(addDays(easter, -48), 'Carnaval (segunda-feira)'),
            toEntry(addDays(easter, -47), 'Carnaval (terça-feira)'),
            toEntry(easter, 'Páscoa'),
            toEntry(new Date(year, 2, 15), 'Dia do Consumidor'),
            toEntry(nthWeekdayOfMonth(year, 4, 0, 2), 'Dia das Mães'),
            toEntry(new Date(year, 5, 12), 'Dia dos Namorados'),
            toEntry(new Date(year, 9, 12), 'Dia das Crianças'),
            toEntry(new Date(year, 9, 15), 'Dia do Professor'),
            toEntry(nthWeekdayOfMonth(year, 7, 0, 2), 'Dia dos Pais'),
            toEntry(new Date(year, 9, 31), 'Halloween (Dia das Bruxas)'),
            toEntry(nthWeekdayOfMonth(year, 10, 5, 4), 'Black Friday'),
        ];
    }

    /**
     * Same shape as the real `calendar-dates` API response for one
     * month/day (see repo.php's calendarEntryForDate()), computed locally.
     * Used only when the real API call fails or returns nothing usable --
     * see ApiDataLoader.ts's loadCalendarDate().
     */
    static forDate(month: number, day: number): FallbackResult {
        const year = new Date().getFullYear();
        const holidays = this._holidaysForYear(year)
            .filter(h => h.month === month && h.day === day)
            .map(h => entry(h.title));
        const commemorationsMain = this._mainCommemorationsForYear(year)
            .filter(c => c.month === month && c.day === day)
            .map(c => entry(c.title));

        return {
            month,
            day,
            holidays,
            commemorationsMain,
            commemorationsMisc: [],
            saints: [],
            events: [],
        };
    }
}
