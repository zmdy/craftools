// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { loadPhrases, loadPhraseCollections, loadEmojiKitchenCombo, loadEmojiKitchenPartners, loadCalendarDate } from './ApiDataLoader.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { CalendarRenderer, type CalendarTheme } from './CalendarRenderer.js';
import { MoonPhases } from './MoonPhases.js';
import { Seasons } from './Seasons.js';
import { Zodiac } from './Zodiac.js';
import { EMOJI_FONT_STACK } from './EmojiFont.js';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Shared shape for the miniCalendar format's pick → format handoff.
 * Used as both _pickMiniCalendar()'s return type and _formatMiniCalendar()'s
 * parameter type, and as the cast in _format()'s 'miniCalendar' case below --
 * having one alias instead of three independently-typed literals is what
 * keeps them from drifting out of sync (weekStart was added to the pick/
 * format signatures but the _format() cast was missed, silently breaking
 * `tsc --noEmit` -- and therefore the whole `npm run build`, since
 * package.json's build script is `tsc --noEmit && vite build`).
 */
type MiniCalendarPick = {
    year: number; month: number; displayMode: string; weekStart: 'sunday' | 'monday';
    highlight?: { enabled: boolean; day?: number; bg?: string; textColor?: string; borderColor?: string; borderWidth?: number; borderRadius?: number; borderStyle?: string };
    /**
     * Theme colors (header/day background+text), same concept/shape as
     * MiniCalendarTool.ts's own Theme schema section -- both ultimately
     * build a CalendarRenderer.ts `CalendarTheme` object. Undefined leaves
     * CalendarRenderer.mergeTheme() to fall back to its own defaults, same
     * as passing no theme at all (previous behavior, before Variable
     * Content had any theme controls of its own).
     */
    theme?: CalendarTheme;
};

export type VariableType =
    | 'date' | 'sequenceNumber' | 'sequenceText' | 'pageNumber'
    | 'link' | 'emoji' | 'apiPhrase' | 'emojiKitchen' | 'miniCalendar';

/** Flat binding structure — all fields are optional since they depend on `type`. */
export interface VariableBinding {
    type:          VariableType | string;
    linkedTo?:     string;
    // date
    startDate?:    string;
    interval?:     string;
    step?:         number | string;
    format?:       string;
    daysBoxHighlightColor?: string;
    daysBoxBorderRadius?:   number | string;
    daysBoxStartSunday?:    boolean;
    daysBoxPadding?:        number | string;
    /** Explicit box height (px) -- lets the box be shaped into a perfect circle/oval independent of its content-driven width. */
    daysBoxHeight?:         number | string;
    daysBoxBorderColor?:    string;
    daysBoxBorderStyle?:    string;
    daysBoxBorderWidth?:    number | string;
    /** Token pattern used only when format === 'CUSTOM' (e.g. "dd/mm/yyyy"). See _formatCustomDate(). */
    customFormat?: string;
    /**
     * Only read when format === 'SPECIAL_DATE' -- which craftools_api
     * calendar_entries categories to include (subset of 'holiday'/
     * 'commemoration_main'/'commemoration_misc'/'saint'/'event'). Defaults
     * to all five in defaultBinding(). See _formatDate()'s 'SPECIAL_DATE'
     * case. 'commemoration_main' is the small curated list of major
     * commercial/cultural dates; 'commemoration_misc' is the much broader,
     * less curated list -- kept as separate categories specifically so this
     * filter can mean "just the important dates" (main only) instead of
     * both kinds being merged and unfilterable.
     */
    specialDateCategories?: string[];
    /**
     * Only meaningful when 'holiday' is included in specialDateCategories
     * -- which scope(s) of holiday to include, matching craftools_api's
     * calendar_entries.holiday_scope enum ('national'|'state'|'municipal').
     * Non-holiday categories (commemoration_main/misc, saint, event) have
     * no scope concept and are never filtered by this. Defaults to all
     * three (defaultBinding() below) so a binding saved before this field
     * existed keeps showing every holiday regardless of scope -- see
     * _holidayScopeMatches().
     */
    specialDateHolidayScopes?: ('national' | 'state' | 'municipal')[];
    /**
     * Only read when specialDateHolidayScopes includes 'state' --
     * restricts state holidays to a single UF (2-letter abbreviation,
     * e.g. 'SP'). Empty/undefined = every state's holidays pass through
     * (each one's own UF is still appended to its title, see
     * _formatSpecialDateItem(), so multiple states showing at once stay
     * distinguishable).
     */
    specialDateUf?: string;
    /** Joiner between multiple matched titles on the same day. Default ', '. */
    specialDateSeparator?: string;
    /** Shown when the resolved day has no matching entries. Default ''. */
    specialDateEmptyText?: string;
    /** Caps how many matched titles are shown. Empty/undefined = show all. Applied AFTER specialDateRandomize's shuffle. */
    specialDateLimit?: number | string;
    /** Shuffles the matched titles (deterministically -- see _seededShuffle()) before specialDateLimit is applied, instead of always showing them in category/sort_order. */
    specialDateRandomize?: boolean;
    /**
     * When true, each matched item appends its `description` (a free-text
     * "Detalhe" the API/admin already stores per row but which was
     * otherwise never surfaced here) and, for 'event' items, its `year` --
     * e.g. "Independência do Brasil (1822) — Assinada por Dom Pedro I".
     * Default false (existing bindings keep showing bare titles).
     */
    specialDateIncludeDescription?: boolean;
    /**
     * Which hemisphere's season names/dates to use -- only read when
     * format === 'SEASON'. 'south' (Brazil's own) is the app-wide default
     * (defaultBinding() below) since every other calendrical default here
     * (BrazilianHolidays.ts, pt-BR month/weekday names) is already
     * Brazil-first. See _formatSeason()/Seasons.ts.
     */
    hemisphere?: 'south' | 'north';
    /**
     * Shared by 'SEASON', 'MOON_PHASE' and 'ZODIAC' (see Seasons.ts/
     * MoonPhases.ts/Zodiac.ts's own getXInfo(), all three return the same
     * `{label, emoji, iconHtml}` shape) -- which SINGLE one of
     * text/icon/emoji to show, replacing the older calendarShowIcon/
     * Emoji/Text independent multi-checkbox (which allowed combining
     * several at once). 'icon' renders via Font Awesome (FontAwesomeIcon.ts),
     * not Material Symbols -- see each of those 3 files' own iconHtml.
     * Defaults to 'text' (defaultBinding() below).
     */
    calendarDisplay?: 'text' | 'icon' | 'emoji';
    /**
     * Which language the resolved date TEXT renders in (month/weekday
     * names, the "Semana N de T" week-number phrase, and the
     * season/moon-phase/zodiac-sign labels) -- completely independent of
     * the app's own UI language (I18n/`window.craftoolsLang`), so a
     * pt-BR-interface user can still print an agenda with English date
     * labels, or vice versa. Same 3-value set as the app's own supported
     * locales (see Editor.ts's `#lang-select`). Defaults to 'pt-br'
     * (defaultBinding() below) since this whole engine was pt-BR-only
     * hardcoded before this field existed -- an unset value on an older
     * saved binding must keep resolving exactly as before, see
     * _dateLocale().
     */
    dateLanguage?: 'pt-br' | 'en' | 'es';
    // sequenceNumber
    start?:        number | string;
    padding?:      number | string;
    prefix?:       string;
    suffix?:       string;
    // pageNumber / link / sequenceNumber
    startAt?:      number | string;
    // link
    url?:          string;
    appendIndex?:  boolean;
    // emoji / sequenceText
    values?:       string;
    mode?:         string;
    loop?:         boolean;
    // apiPhrase
    field?:        string;
    collection?:   string;
    filterField?:  string;
    filterValue?:  string;
    // emojiKitchen
    leftEmoji?:    string;
    rightEmoji?:   string;
    // miniCalendar
    year?:         number;
    month?:        number;
    displayMode?:  string;
    /** true (default) = week starts Sunday; false = Monday. Same concept as MiniCalendarTool.ts's weekStartSunday meta field / DAYS_BOX's daysBoxStartSunday. */
    weekStartSunday?: boolean;
    /**
     * Highlight a single day-of-month in the miniCalendar format's days
     * grid -- same concept/shape as MiniCalendarTool.ts's own "Highlight"
     * schema section (both ultimately feed CalendarRenderer.ts's
     * `CalendarOptions['highlight']`). Kept as its own prefixed set of
     * fields here (rather than reusing the tool's meta keys directly)
     * since Variable Content's miniCalendar format has its own independent
     * binding config, resolved fresh per repetition in _formatMiniCalendar().
     */
    miniCalendarHighlightEnabled?:      boolean;
    /**
     * 'today' (default) = highlight day is recomputed as the current
     * day-of-month on every resolve, so the highlighted cell always tracks
     * the real "today" instead of a value frozen at whichever day it was
     * when the toggle was first turned on. 'fixed' = use
     * miniCalendarHighlightDay as a permanent manual value (e.g. a
     * birthday). 'linked' = read the day-of-month from another element's
     * `date`-type variable, picked via miniCalendarHighlightLinkedTo (same
     * cross-element link registry `linkedTo` already uses, just scoped to
     * 'date'-type candidates instead of same-type ones).
     */
    miniCalendarHighlightDaySource?:    'today' | 'fixed' | 'linked';
    /** Target element id (VariablePanel._ensureVarId()) when miniCalendarHighlightDaySource === 'linked'. */
    miniCalendarHighlightLinkedTo?:     string;
    miniCalendarHighlightDay?:          number | string;
    miniCalendarHighlightBg?:           string;
    miniCalendarHighlightTextColor?:    string;
    miniCalendarHighlightBorderColor?:  string;
    miniCalendarHighlightBorderWidth?:  number | string;
    miniCalendarHighlightBorderRadius?: number | string;
    miniCalendarHighlightBorderStyle?:  string;
    /**
     * Theme colors -- same concept/shape/keys as MiniCalendarTool.ts's own
     * "Theme" schema section, both ultimately feed a CalendarRenderer.ts
     * `CalendarTheme`. Kept as its own prefixed set of fields here (rather
     * than reusing the tool's meta keys directly) since Variable Content's
     * miniCalendar format has its own independent binding config, resolved
     * fresh per repetition in `_pickMiniCalendar()`. Undefined/empty falls
     * back to CalendarRenderer's own defaults (same as before these fields
     * existed). `miniCalendarThemeTitleBarBg`/`CellBg`/`WeekendBg` accept
     * anything ColorPickerUI.ts's `normalizeValue()` understands (bare hex
     * or a JSON ColorPickerValue string), so gradients are possible for
     * those three -- see CalendarTheme's own doc comment in
     * CalendarRenderer.ts. The text-color fields stay plain solid hex.
     */
    miniCalendarThemeTitleBarBg?:   string;
    miniCalendarThemeTitleBarText?: string;
    miniCalendarThemeCellBg?:       string;
    miniCalendarThemeDayText?:      string;
    miniCalendarThemeWeekendBg?:    string;
    /**
     * Per-day-cell border (width/style/color/radius) -- radius is the knob
     * that produces a "rounded calendar" look, one rounded box per day.
     * Same concept as MiniCalendarTool.ts's own themeDayBorder* schema
     * fields (CalendarTheme.dayNumbers.innerBorder*).
     */
    miniCalendarThemeDayBorderWidth?:  number | string;
    miniCalendarThemeDayBorderStyle?:  string;
    miniCalendarThemeDayBorderColor?:  string;
    miniCalendarThemeDayBorderRadius?: number | string;
    /** Vertical gap (px) between the card's stacked sections (CalendarTheme.sectionGap). */
    miniCalendarThemeSectionGap?: number | string;
}

export interface ResolveContext {
    repetitionIndex?: number;
    pageNumber?:      number;
    totalPages?:      number;
    now?:             Date;
}

export interface CalendarDateApiEntry {
    id:          string;
    title:       string;
    description?: string;
    /** 'event' entries only. */
    year?:       number;
    /** 'saint' entries only. */
    link?:       string;
    /** 'holiday' entries only. */
    scope?:      string;
    uf?:         string;
    city?:       string;
}

/**
 * craftools_api's `calendar-dates` resource response `data` shape (repo.php's
 * calendarEntryForDate()). `commemorationsMain` is the small, hand-curated
 * list of major commercial/cultural dates (Dia das Mães, Carnaval, Páscoa
 * etc -- feriados-brasil/joaopbini GitHub import); `commemorationsMisc` is
 * the much broader, less curated list the biduinfo API import produces
 * (often several per day). They used to be a single merged `commemorations`
 * array, which made "show only the important dates" effectively impossible
 * since both kinds of rows were indistinguishable once merged.
 */
export interface CalendarDateApiResult {
    month:               number;
    day:                 number;
    holidays:            CalendarDateApiEntry[];
    commemorationsMain:  CalendarDateApiEntry[];
    commemorationsMisc:  CalendarDateApiEntry[];
    saints:              CalendarDateApiEntry[];
    events:              CalendarDateApiEntry[];
}

export interface ApiCache {
    phrasesByCollection?:    Record<string, unknown[]>;
    emojiKitchenCombos?:     Record<string, string>;
    emojiKitchenPartnersList?: Record<string, string[]>;
    /** Keyed by "month-day" (e.g. "12-25"). Populated by prefetchApiResources() for 'date' bindings with format === 'SPECIAL_DATE'. */
    calendarDateByKey?:      Record<string, CalendarDateApiResult | null>;
}

interface LinkPick {
    type: string;
    pick: unknown;
}

export interface LinkCtx {
    id:    string;
    picks: Map<string, LinkPick>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MINI_CALENDAR_PARTS: Record<string, { header: boolean; week: boolean; days: boolean; holidaysBox: boolean; moonBox: boolean }> = {
    weekdays:  { header: false, week: true,  days: true,  holidaysBox: false, moonBox: false },
    calendar:  { header: true,  week: true,  days: true,  holidaysBox: false, moonBox: false },
    header:      { header: true,  week: false, days: false, holidaysBox: false, moonBox: false },
    holidaysBox: { header: false, week: false, days: false, holidaysBox: true,  moonBox: false },
    moonBox:     { header: false, week: false, days: false, holidaysBox: false, moonBox: true  },
    complete1:   { header: true,  week: true,  days: true,  holidaysBox: true,  moonBox: false },
    complete2:   { header: true,  week: true,  days: true,  holidaysBox: true,  moonBox: true  },
};

const DEFAULT_EMOJI_POOL = [
    '😀','😁','😂','😃','😄','😅','😆','🥰','😍','😘',
    '😋','😜','🤩','🥳','😎','🤠','😇','🙂','😉','😊',
    '🤣','😺','😻','🥹','🤗','🙌','👍','👏','✨','🎉',
    '❤️','💛','💚','💙','💜','🔥','🌟','⭐','🌈','🍀',
];

// ── Engine ────────────────────────────────────────────────────────────────────

export class VariableEngine {

    static readonly TYPES: string[] = [
        'date','sequenceNumber','sequenceText','pageNumber',
        'link','emoji','apiPhrase','emojiKitchen','miniCalendar',
    ];

    /**
     * Every `format === '...'` value (type 'date' only) whose resolved
     * value is real HTML rather than a plain string -- every caller that
     * applies a resolved 'date' value to the DOM (VariableContentTool.ts's
     * _applyVariablePreview(), AgendaExport.ts's _applyResolvedValue(),
     * VariablePanel.ts's own live preview) needs to innerHTML these
     * instead of textContent-ing them, exactly like they already do for
     * binding.type === 'miniCalendar'. Centralized here (instead of each
     * of those three call sites hardcoding its own format list) so adding
     * a future HTML-returning date format only means adding it here once.
     */
    /**
     * 'CUSTOM' joined this list once its token vocabulary grew icon/emoji-
     * capable tokens (see _formatCustomDate()'s {season}/{moon}/{zodiac}
     * handling) -- every 'CUSTOM' resolution now goes through
     * _formatCustomDate()'s HTML-escaping path even when it ends up being
     * plain text underneath (see that method's own comment), so treating
     * it as HTML unconditionally is always correct, not just when those
     * tokens happen to be present.
     */
    static readonly HTML_DATE_FORMATS: string[] = ['DAYS_BOX', 'MOON_PHASE', 'SEASON', 'ZODIAC', 'CUSTOM'];

    static isHtmlDateFormat(format: string | undefined): boolean {
        return !!format && this.HTML_DATE_FORMATS.includes(format);
    }

    // ── Default bindings ─────────────────────────────────────────────────────

    static defaultBinding(type: string): VariableBinding | null {
        const today = new Date();
        const pad   = (v: number) => String(v).padStart(2, '0');
        const isoToday = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

        switch (type) {
            case 'date':           return {
                type, startDate: isoToday, interval: 'daily', step: 1, format: 'CUSTOM', customFormat: 'dd/mm/yyyy', linkedTo: '',
                specialDateCategories: ['holiday', 'commemoration_main', 'commemoration_misc', 'saint', 'event'],
                specialDateHolidayScopes: ['national', 'state', 'municipal'],
                specialDateUf: '',
                specialDateSeparator: ', ',
                specialDateEmptyText: '',
                specialDateIncludeDescription: false,
                specialDateLimit: '',
                specialDateRandomize: false,
                hemisphere: 'south',
                calendarDisplay: 'text',
                dateLanguage: 'pt-br',
            };
            case 'sequenceNumber': return { type, start: 1, step: 1, padding: 0, prefix: '', suffix: '', linkedTo: '' };
            case 'sequenceText':   return { type, values: '', loop: true, linkedTo: '' };
            case 'pageNumber':     return { type, startAt: 1, format: 'n', linkedTo: '' };
            case 'link':           return { type, url: '', appendIndex: false, startAt: 1, linkedTo: '' };
            case 'emoji':          return { type, values: '', mode: 'sequential', linkedTo: '' };
            case 'apiPhrase':      return { type, field: '', collection: '', filterField: '', filterValue: '', mode: 'sequential', linkedTo: '' };
            case 'emojiKitchen':   return { type, leftEmoji: '', rightEmoji: '', mode: 'sequential', linkedTo: '' };
            case 'miniCalendar':   return { type, mode: 'fixed', year: today.getFullYear(), month: today.getMonth() + 1, displayMode: 'complete1', linkedTo: '' };
            default:               return null;
        }
    }

    // ── Synchronous resolution ────────────────────────────────────────────────

    static resolve(
        binding:  VariableBinding | null,
        context:  ResolveContext,
        apiCache: ApiCache = {},
        linkCtx:  LinkCtx | null = null,
    ): string {
        if (!binding || !binding.type) return '';
        const ctx = {
            repetitionIndex: context?.repetitionIndex ?? 0,
            pageNumber:      context?.pageNumber      ?? 1,
            totalPages:      context?.totalPages      ?? 1,
            now:             context?.now             ?? new Date(),
        };

        const picks = linkCtx?.picks ?? null;
        const myId  = linkCtx?.id   ?? null;

        let pick:       unknown = null;
        let usedLeader  = false;

        if (binding.linkedTo && picks?.has(binding.linkedTo)) {
            const leader = picks.get(binding.linkedTo)!;
            if (leader.type === binding.type) { pick = leader.pick; usedLeader = true; }
        }

        if (!usedLeader) {
            pick = this._pick(binding, ctx, apiCache, picks);
            if (picks && myId) picks.set(myId, { type: binding.type, pick });
        }

        return this._format(binding, pick, ctx, apiCache);
    }

    static newLinkRegistry(): Map<string, LinkPick> {
        return new Map<string, LinkPick>();
    }

    static async resolvePreview(
        binding:       VariableBinding,
        sampleContext: ResolveContext = {},
    ): Promise<string> {
        const context = {
            repetitionIndex: sampleContext.repetitionIndex ?? 0,
            pageNumber:      sampleContext.pageNumber      ?? 1,
            totalPages:      sampleContext.totalPages      ?? 1,
            now:             new Date(),
        };
        if (binding.type === 'apiPhrase' || binding.type === 'emojiKitchen' || (binding.type === 'date' && this._usesSpecialDateToken(binding))) {
            const apiCache = await this.prefetchApiResources([binding]);
            return this.resolve(binding, context, apiCache);
        }
        return this.resolve(binding, context, {});
    }

    /**
     * Whether a 'date' binding needs craftools_api's calendar-dates
     * resource prefetched -- either the whole format IS 'SPECIAL_DATE', or
     * it's 'CUSTOM' and the pattern embeds the {holiday} token (see
     * _formatCustomDate()). Shared by prefetchApiResources()'s bulk filter
     * and resolvePreview()'s single-binding check so both stay in sync.
     */
    private static _usesSpecialDateToken(b: VariableBinding): boolean {
        return b.format === 'SPECIAL_DATE' || (b.format === 'CUSTOM' && (b.customFormat ?? '').toLowerCase().includes('{holiday}'));
    }

    /**
     * @param opts.repetitionIndices  Which repetition indices will actually be
     *   resolved from the returned cache -- matters only for an "emojiKitchen"
     *   binding with no fixed right emoji (mode sequential/random over every
     *   available partner, see _pickEmojiKitchen()). Defaults to `[0]`, the
     *   single-preview case (one canvas element render, or the panel's own
     *   live preview box) -- previously this method always fetched the combo
     *   image for EVERY partner in the pool regardless of how many would
     *   ever actually be used, which is exactly why resolving an Emoji
     *   Kitchen "variable" binding was so much slower than the standalone
     *   Emoji Kitchen tool (which only ever fetches the one combo it needs).
     *   Bulk callers that render many repetitions (AgendaExportTool.ts's
     *   preview tab, AgendaExport.ts's real PDF generation) pass every
     *   repetition index they'll actually render, so the cache still has
     *   everything those repetitions need -- just nothing beyond that.
     */
    static async prefetchApiResources(
        bindings: (VariableBinding | null)[],
        opts: { repetitionIndices?: number[] } = {},
    ): Promise<ApiCache> {
        const list = bindings ?? [];
        const repetitionIndices = opts.repetitionIndices?.length ? opts.repetitionIndices : [0];
        const apiPhraseBindings = list.filter((b): b is VariableBinding => !!b && b.type === 'apiPhrase');

        const kitchenPairs         = new Set<string>();
        const kitchenVariableLefts = new Set<string>();
        list.forEach(b => {
            if (b?.type === 'emojiKitchen' && (b.leftEmoji ?? '').trim()) {
                const left  = b.leftEmoji!.trim();
                const right = (b.rightEmoji ?? '').trim();
                if (right) kitchenPairs.add(`${left}|${right}`);
                else       kitchenVariableLefts.add(left);
            }
        });

        const cache: ApiCache = {};

        if (apiPhraseBindings.length) {
            const collections = new Set(apiPhraseBindings.map(b => (b.collection ?? '').trim()));
            cache.phrasesByCollection = {};
            await Promise.all([...collections].map(async col => {
                try   { cache.phrasesByCollection![col] = await loadPhrases('phrases', col); }
                catch { cache.phrasesByCollection![col] = []; }
            }));
        }

        if (kitchenVariableLefts.size) {
            cache.emojiKitchenPartnersList = {};
            await Promise.all([...kitchenVariableLefts].map(async left => {
                let partners: string[] = [];
                try   { partners = ((await loadEmojiKitchenPartners(left)) as string[]).filter((p: string) => p !== left); }
                catch { partners = []; }
                cache.emojiKitchenPartnersList![left] = partners;

                // Only queue the combo(s) actually reachable by the
                // requested repetition indices -- mirrors _pickEmojiKitchen()'s
                // own pool/index math exactly, so whatever it looks up later
                // is always already in `kitchenPairs` below. Computed per
                // BINDING (not per `left`) since two bindings can share the
                // same left emoji with different modes (sequential vs
                // random), which pick different rights for the same index.
                const pool = [left, ...partners];
                list.forEach(b => {
                    if (b?.type !== 'emojiKitchen' || (b.leftEmoji ?? '').trim() !== left || (b.rightEmoji ?? '').trim()) return;
                    repetitionIndices.forEach(idx => {
                        const right = b.mode === 'random'
                            ? pool[this._pseudoRandomIndex(idx, pool.length)]
                            : pool[idx % pool.length];
                        kitchenPairs.add(`${left}|${right}`);
                    });
                });
            }));
        }

        if (kitchenPairs.size) {
            cache.emojiKitchenCombos = {};
            await Promise.all([...kitchenPairs].map(async key => {
                const [left, right] = key.split('|');
                try   { const combo = await loadEmojiKitchenCombo(left, right); cache.emojiKitchenCombos![key] = (combo?.imageUrl) ?? ''; }
                catch { cache.emojiKitchenCombos![key] = ''; }
            }));
        }

        // 'date' bindings with format === 'SPECIAL_DATE' need craftools_api's
        // calendar-dates resource for the specific month/day each repetition
        // actually lands on -- computed the same way _pick()/_pickDate()
        // will compute it later (same `now`, so a binding with no explicit
        // startDate resolves to the identical "today" both times). Multiple
        // bindings/repetitions landing on the same month/day share one
        // fetch (deduped via the Set below); loadCalendarDate() also caches
        // per month/day across separate prefetchApiResources() calls (e.g.
        // one per live-preview keystroke).
        const specialDateBindings = list.filter((b): b is VariableBinding => !!b && b.type === 'date' && this._usesSpecialDateToken(b));
        if (specialDateBindings.length) {
            const now = new Date();
            const pairs = new Set<string>();
            specialDateBindings.forEach(b => {
                repetitionIndices.forEach(idx => {
                    const d = this._pickDate(b, { repetitionIndex: idx, now });
                    if (d) pairs.add(`${d.getMonth() + 1}-${d.getDate()}`);
                });
            });

            cache.calendarDateByKey = {};
            await Promise.all([...pairs].map(async key => {
                const [month, day] = key.split('-').map(Number);
                try   { cache.calendarDateByKey![key] = await loadCalendarDate(month, day); }
                catch { cache.calendarDateByKey![key] = null; }
            }));
        }

        return cache;
    }

    static async loadFilterOptions(field: string, collection = ''): Promise<string[]> {
        if (!field) return [];
        try {
            const list = (await loadPhrases('phrases', collection)) as unknown[];
            const values = new Set<string>();
            list.forEach((item: unknown) => {
                if (item == null || typeof item !== 'object') return;
                const val = (item as Record<string, unknown>)[field];
                if (val == null) return;
                if (Array.isArray(val)) val.forEach(v => { if (v != null && String(v).trim()) values.add(String(v)); });
                else if (String(val).trim()) values.add(String(val));
            });
            return [...values].sort((a, b) => a.localeCompare(b));
        } catch { return []; }
    }

    static async loadPhraseCollectionOptions(): Promise<string[]> {
        try   { return await loadPhraseCollections() as string[]; }
        catch { return []; }
    }

    // ── Pick dispatch ─────────────────────────────────────────────────────────

    private static _pick(binding: VariableBinding, ctx: Required<ResolveContext> & { now: Date }, apiCache: ApiCache, picks: Map<string, LinkPick> | null = null): unknown {
        switch (binding.type) {
            case 'date':           return this._pickDate(binding, ctx);
            case 'sequenceNumber': return this._pickSequenceNumber(binding, ctx);
            case 'sequenceText':   return this._pickSequenceText(binding, ctx);
            case 'pageNumber':     return this._pickPageNumber(binding, ctx);
            case 'link':           return this._pickLink(binding, ctx);
            case 'emoji':          return this._pickEmoji(binding, ctx);
            case 'apiPhrase':      return this._pickApiPhrase(binding, ctx, apiCache);
            case 'emojiKitchen':   return this._pickEmojiKitchen(binding, ctx, apiCache);
            case 'miniCalendar':   return this._pickMiniCalendar(binding, ctx, picks);
            default:               return null;
        }
    }

    // ── Format dispatch ───────────────────────────────────────────────────────

    private static _format(binding: VariableBinding, pick: unknown, ctx: Required<ResolveContext> & { now: Date }, apiCache: ApiCache = {}): string {
        switch (binding.type) {
            case 'date':           return pick ? this._formatDate(pick as Date, binding, ctx, apiCache) : '';
            case 'sequenceNumber': return this._formatSequenceNumber(pick as number, binding);
            case 'sequenceText':   return pick == null ? '' : String(pick);
            case 'pageNumber':     return this._formatPageNumber(pick as number, binding, ctx);
            case 'link':           return this._formatLink(pick as number | null, binding);
            case 'emoji':          return pick == null ? '' : String(pick);
            case 'apiPhrase':      return this._formatApiPhrase(pick, binding);
            case 'emojiKitchen':   return (pick && (pick as { url: string }).url) ? (pick as { url: string }).url : '';
            case 'miniCalendar':   return pick ? this._formatMiniCalendar(pick as MiniCalendarPick) : '';
            default:               return '';
        }
    }

    // ── date ──────────────────────────────────────────────────────────────────

    private static _pickDate(b: VariableBinding, ctx: { repetitionIndex: number; now: Date }): Date | null {
        const base = b.startDate ? new Date(`${b.startDate}T00:00:00`) : new Date(ctx.now);
        if (isNaN(base.getTime())) return null;
        return this._addInterval(base, b.interval ?? 'daily', (parseInt(String(b.step), 10) || 1) * ctx.repetitionIndex);
    }

    private static _addInterval(date: Date, interval: string, amount: number): Date {
        const d = new Date(date.getTime());
        switch (interval) {
            case 'daily':   d.setDate(d.getDate() + amount);         break;
            case 'weekly':  d.setDate(d.getDate() + amount * 7);     break;
            case 'monthly': d.setMonth(d.getMonth() + amount);       break;
            case 'yearly':  d.setFullYear(d.getFullYear() + amount); break;
        }
        return d;
    }

    /**
     * Per-language month/weekday vocabulary + "day de month[, year]"/"Week
     * N of T" phrasing, keyed by the same 3-locale set as the app's own UI
     * language (I18n) but resolved INDEPENDENTLY of it -- see
     * VariableBinding.dateLanguage's doc comment. This whole
     * date-formatting engine hardcoded pt-BR literals unconditionally
     * before this table existed; `_dateLocale()` defaults to 'pt-br' so a
     * binding saved before this feature existed keeps resolving exactly as
     * before. Word order/connector genuinely differs per language (English
     * doesn't say "10 of April", it's "April 10") -- that's why
     * DAY_MONTH_LONG/DAY_MONTH_YEAR_LONG call this table's `dayMonth()`/
     * `dayMonthYear()` functions instead of a single shared template.
     */
    private static readonly DATE_LOCALES: Record<'pt-br' | 'en' | 'es', {
        months: string[]; monthsAbbrev: string[];
        weekdays: string[]; weekdaysAbbrev: string[]; weekdaysFirst: string[];
        dayMonth: (day: number, month: string) => string;
        dayMonthYear: (day: number, month: string, year: number) => string;
        week: string; of: string;
    }> = {
        'pt-br': {
            months: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
            monthsAbbrev: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
            weekdays: ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'],
            weekdaysAbbrev: ['DOM','SEG','TER','QUA','QUI','SEX','SAB'],
            weekdaysFirst: ['D','S','T','Q','Q','S','S'],
            dayMonth: (day, month) => `${day} de ${month}`,
            dayMonthYear: (day, month, year) => `${day} de ${month} de ${year}`,
            week: 'Semana', of: 'de',
        },
        en: {
            months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
            monthsAbbrev: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            weekdays: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
            weekdaysAbbrev: ['SUN','MON','TUE','WED','THU','FRI','SAT'],
            weekdaysFirst: ['S','M','T','W','T','F','S'],
            dayMonth: (day, month) => `${month} ${day}`,
            dayMonthYear: (day, month, year) => `${month} ${day}, ${year}`,
            week: 'Week', of: 'of',
        },
        es: {
            months: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
            monthsAbbrev: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
            weekdays: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
            weekdaysAbbrev: ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'],
            weekdaysFirst: ['D','L','M','M','J','V','S'],
            dayMonth: (day, month) => `${day} de ${month}`,
            dayMonthYear: (day, month, year) => `${day} de ${month} de ${year}`,
            week: 'Semana', of: 'de',
        },
    };

    private static _dateLocale(lang?: string): typeof VariableEngine.DATE_LOCALES['pt-br'] {
        return this.DATE_LOCALES[(lang as 'pt-br' | 'en' | 'es')] ?? this.DATE_LOCALES['pt-br'];
    }

    private static _formatDate(d: Date, b: VariableBinding, ctx: { repetitionIndex: number }, apiCache: ApiCache = {}): string {
        const format = b.format ?? 'DD/MM/YYYY';
        const pad = (v: number) => String(v).padStart(2, '0');
        const dd   = pad(d.getDate()), mm = pad(d.getMonth() + 1), yyyy = d.getFullYear(), yy = String(yyyy).slice(-2);
        const loc  = this._dateLocale(b.dateLanguage);

        switch (format) {
            case 'DD/MM/YYYY':         return `${dd}/${mm}/${yyyy}`;
            case 'DD/MM/YY':           return `${dd}/${mm}/${yy}`;
            case 'DD/MM':              return `${dd}/${mm}`;
            case 'MM/YYYY':            return `${mm}/${yyyy}`;
            case 'YYYY-MM-DD':         return `${yyyy}-${mm}-${dd}`;
            case 'DAY_MONTH_LONG':     return loc.dayMonth(d.getDate(), loc.months[d.getMonth()]);
            case 'DAY_MONTH_YEAR_LONG':return loc.dayMonthYear(d.getDate(), loc.months[d.getMonth()], yyyy);
            case 'WEEKDAY':         return loc.weekdays[d.getDay()];
            case 'WEEKDAY_SHORT':   return loc.weekdaysAbbrev[d.getDay()];
            case 'WEEKDAY_DATE':    return `${loc.weekdays[d.getDay()]}, ${dd}/${mm}`;
            case 'DAY_ONLY':         return `${d.getDate()}`;
            case 'MONTH_ONLY':         return loc.months[d.getMonth()];
            case 'DAY_OF_YEAR':  return String(this._dayOfYear(d));
            case 'WEEK_NUMBER':  return this._formatWeekNumber(d, b);
            case 'CUSTOM':      return this._formatCustomDate(d, b, ctx, apiCache);
            case 'SPECIAL_DATE': return this._formatSpecialDate(d, b, ctx, apiCache);
            case 'MOON_PHASE':  return this._formatMoonPhase(d, b);
            case 'SEASON':      return this._formatSeason(d, b);
            case 'ZODIAC':      return this._formatZodiac(d, b);
            case 'DAYS_BOX': {
                const hlColor  = b.daysBoxHighlightColor || 'var(--accent, #f97316)';
                const radius   = b.daysBoxBorderRadius !== undefined ? String(b.daysBoxBorderRadius) : '50';
                const padding  = b.daysBoxPadding !== undefined ? String(b.daysBoxPadding) : '4';
                const startSun = !!b.daysBoxStartSunday;

                // Explicit height (px) still shapes each box independently
                // from its width (e.g. a perfect circle/oval) and, in that
                // case, the row keeps its own natural size, vertically
                // centered in the element -- same as before. With NO
                // explicit height (the common case), the row instead
                // stretches to fill the element's actual box (height:100%
                // top to bottom, flex:1 left to right on every letter) --
                // previously it was always a fixed-size `min-height:1.5em` /
                // `min-width:1.5em` cluster centered in the middle, so
                // dragging the element's resize handles (with auto-fit ON
                // OR OFF -- this has nothing to do with auto-fit, which only
                // resizes the *box* to match content, never the reverse)
                // never redistributed the letters across the new size.
                const hasExplicitHeight = b.daysBoxHeight !== undefined && String(b.daysBoxHeight).trim() !== '';
                const rowHeightCss  = hasExplicitHeight ? 'height: auto;' : 'height: 100%;';
                const cellHeightCss = hasExplicitHeight ? `height: ${b.daysBoxHeight}px;` : 'height: 100%;';

                // Border style/width/color, independently controllable --
                // previously hardcoded to "1px solid currentColor" (always
                // matching the surrounding text color, never configurable).
                // 'none' collapses to a real 0 border so the padding/height
                // above aren't thrown off by a residual 1px browser default.
                const borderStyle = b.daysBoxBorderStyle || 'solid';
                const borderWidth = b.daysBoxBorderWidth !== undefined ? String(b.daysBoxBorderWidth) : '1';
                const borderColor = b.daysBoxBorderColor || 'currentColor';
                const borderCss   = borderStyle === 'none' ? 'none' : `${borderWidth}px ${borderStyle} ${borderColor}`;

                // Construct the sequence of letters
                const letters = startSun
                    ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
                    : ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

                // Indices map to Date.getDay() (0 = Sunday, 1 = Monday, etc)
                // If starting on Monday, index 0 is Monday (d.getDay() === 1), index 6 is Sunday (d.getDay() === 0).
                let todayIdx = -1;
                if (startSun) {
                    todayIdx = d.getDay(); // 0 is Sunday, which matches index 0
                } else {
                    todayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0 (Sunday) becomes index 6
                }

                const html = letters.map((letter, idx) => {
                    const isActive = idx === todayIdx;
                    const bg = isActive ? hlColor : 'transparent';
                    const color = isActive ? '#ffffff' : 'inherit';
                    // flex:1 (not a plain min-width) makes the 7 cells
                    // always split the row's actual width evenly -- the
                    // width side of the redistribution fix, independent of
                    // whether the height is explicit or container-filled.
                    return `<div style="display:flex; align-items:center; justify-content:center; border: ${borderCss}; border-radius: ${radius}px; padding: ${padding}px; background-color: ${bg}; color: ${color}; flex: 1 1 0; min-width: 1.5em; ${cellHeightCss}">${letter}</div>`;
                }).join('');

                // font-weight/font-style now INHERIT from the surrounding
                // text node instead of a hardcoded "font-weight:bold" --
                // that hardcoded value silently overrode the Bold/Italic
                // toggles in the Typography panel (VariableContentTool.ts's
                // _applyProperty() sets bold/italic on the *parent* content
                // node, which this box's own inline style was shadowing no
                // matter what the toggles said).
                return `<div style="display:flex; align-items:${hasExplicitHeight ? 'center' : 'stretch'}; justify-content:space-between; gap:6px; width:100%; ${rowHeightCss} font-weight:inherit; font-style:inherit;">${html}</div>`;
            }
            default:                   return `${dd}/${mm}/${yyyy}`;
        }
    }

    /**
     * Token-based custom date format (format === 'CUSTOM'). A token
     * is a MAXIMAL run of the same letter among d/m/y/w (matched via
     * /d+|m+|y+|w+/gi, case-insensitive) -- e.g. "yy" is one 2-letter run,
     * never two separate single-'y' matches (an earlier version matched
     * each letter independently, so "yy" silently produced the 2-digit
     * year TWICE concatenated, e.g. "2626" instead of "26"). A run whose
     * length doesn't match a known token (e.g. "ddd") is left untouched.
     *
     * Also recognizes six curly-brace tokens -- {season}, {moon} (moon
     * phase), {zodiac} (zodiac sign), {holiday} (holiday/commemorative
     * date), {dayofyear} (ordinal day within the year, e.g. Apr 10 -> 100,
     * see _dayOfYear()), {weeknumber} (ISO-8601 week, e.g. "Semana 32 de
     * 52", see _formatWeekNumber()) -- so the multi-select buttons in
     * VariablePanel.ts's date config (Dia/Mês/Ano/Dia da semana/Estação/
     * Fase da Lua/Signo/Feriado/Dia do ano/Semana do ano) can all compose
     * into the SAME custom string
     * instead of needing separate mutually exclusive whole formats. Token
     * NAMES are English (this file's own vocabulary) even though their
     * pt-BR/en/es display labels stay translated -- see VariablePanel.ts's
     * _dateFormatButtons()/i18n keys.
     * {season}/{moon}/{zodiac} render via `b.calendarDisplay`
     * (text/icon/emoji, see _renderCalendarInfo()) exactly like their
     * standalone whole-format counterparts do -- 'icon' mode embeds real
     * markup (a Font Awesome `<svg>`), which is why this method's output is
     * now UNCONDITIONALLY HTML (see this class's HTML_DATE_FORMATS
     * including 'CUSTOM'): every literal (non-token) character is
     * HTML-escaped first via `_escHtml()` -- safe to do BEFORE token
     * matching since escaping only ever touches `&`/`<`/`>`, none of which
     * appear in the d/m/y/w or {...} token patterns themselves -- then
     * token runs are substituted with their (already HTML-safe) resolved
     * value. A plain pattern with no calendar tokens (e.g. "dd/mm/yyyy")
     * renders identically either way, since escaping plain digits/slashes
     * is a no-op. Curly braces can't collide with the d/m/y/w letter-run
     * tokens above, so both kinds are matched in one pass.
     *
     * Any other character (including regular letters like 'e', 'a', 's'
     * that show up in ordinary words) passes through unchanged -- EXCEPT
     * that a bare single letter from {d,m,y,w} inside a literal word (e.g.
     * the 'd' in "de") is indistinguishable from the token itself and WILL
     * be replaced. Text wrapped in [square brackets] is passed through
     * literally (brackets stripped, still HTML-escaped) so patterns like
     * "dd [de] mmmm" can safely include such words -- documented in the
     * legend shown above the format input (VariablePanel.ts's
     * _dateConfig()), which must stay in sync with this exact token list.
     */
    private static _formatCustomDate(d: Date, b: VariableBinding, ctx: { repetitionIndex: number }, apiCache: ApiCache): string {
        const pattern = b.customFormat ?? '';
        if (!pattern) return '';
        const pad = (v: number) => String(v).padStart(2, '0');
        const loc = this._dateLocale(b.dateLanguage);

        const tokens: Record<string, () => string> = {
            yyyy: () => String(d.getFullYear()),
            yy:   () => String(d.getFullYear()).slice(-2),
            mmmm: () => loc.months[d.getMonth()],
            mmm:  () => loc.monthsAbbrev[d.getMonth()],
            mm:   () => pad(d.getMonth() + 1),
            m:    () => String(d.getMonth() + 1),
            dd:   () => pad(d.getDate()),
            d:    () => String(d.getDate()),
            wwww: () => loc.weekdays[d.getDay()],
            ww:   () => loc.weekdaysAbbrev[d.getDay()],
            w:    () => loc.weekdaysFirst[d.getDay()],
            '{season}':    () => this._renderCalendarInfo(b, Seasons.getSeasonInfo(d, b.hemisphere ?? 'south', b.dateLanguage)),
            '{moon}':      () => this._renderCalendarInfo(b, MoonPhases.getPhaseInfo(d, b.dateLanguage)),
            '{zodiac}':    () => this._renderCalendarInfo(b, Zodiac.getSignInfo(d, b.dateLanguage)),
            '{holiday}':   () => this._escHtml(this._formatSpecialDate(d, b, ctx, apiCache)),
            '{dayofyear}': () => String(this._dayOfYear(d)),
            '{weeknumber}': () => this._escHtml(this._formatWeekNumber(d, b)),
        };

        const applyTokens = (text: string): string =>
            this._escHtml(text).replace(/\{season\}|\{moon\}|\{zodiac\}|\{holiday\}|\{dayofyear\}|\{weeknumber\}|d+|m+|y+|w+/gi, run => {
                const fn = tokens[run.toLowerCase()];
                return fn ? fn() : run;
            });

        // Split out [bracketed] literal segments (kept as-is, brackets
        // stripped, still escaped) from everything else (token-replaced).
        return pattern
            .split(/(\[[^\]]*\])/g)
            .map(part => (part.startsWith('[') && part.endsWith(']')) ? this._escHtml(part.slice(1, -1)) : applyTokens(part))
            .join('');
    }

    /**
     * Renders EXACTLY ONE of icon/emoji/text for a `{label, emoji,
     * iconHtml}` descriptor -- Seasons.ts/MoonPhases.ts/Zodiac.ts's own
     * getXInfo() all return this same shape -- per `b.calendarDisplay`
     * ('text'|'icon'|'emoji', default 'text'; see VariableBinding's doc
     * comment). Shared by _formatMoonPhase()/_formatSeason()/
     * _formatZodiac() (whole-format results) AND _formatCustomDate()'s
     * {season}/{moon}/{zodiac} tokens (embedded mid-string), so a token
     * inside a custom pattern renders identically to its whole-format
     * counterpart. Replaces the older _composeCalendarParts(), which
     * combined all three via independent calendarShowIcon/Emoji/Text
     * checkboxes -- the panel UI (VariablePanel.ts) now offers a
     * single-select instead.
     *
     * ALWAYS returns real HTML, even for the text case (HTML-escaped) --
     * unlike most other _formatDate() branches (which return plain
     * strings), this format needs to conditionally include markup (the
     * icon's <svg>, the emoji's own font-family span), so every consumer
     * applying this value to the DOM must use innerHTML for it, same as it
     * already does for 'DAYS_BOX'/'miniCalendar' (see
     * VariableContentTool.ts's _applyVariablePreview(), AgendaExport.ts's
     * _applyResolvedValue(), VariablePanel.ts's own live preview -- all
     * three keep a per-format innerHTML-vs-textContent check, see
     * HTML_DATE_FORMATS). The emoji gets its own `font-family:
     * EMOJI_FONT_STACK` span: the surrounding text almost certainly uses
     * the box's own chosen font (DM Sans, etc.), which doesn't reliably
     * have color emoji glyphs, so without this the emoji can render as a
     * black-and-white fallback glyph or tofu box instead of the intended
     * colorful pictograph (see EmojiFont.ts).
     */
    private static _renderCalendarInfo(b: VariableBinding, info: { label: string; emoji: string; iconHtml: string }): string {
        const mode = b.calendarDisplay ?? 'text';
        if (mode === 'icon')  return info.iconHtml;
        if (mode === 'emoji') return `<span style="font-family: ${EMOJI_FONT_STACK};">${info.emoji}</span>`;
        return this._escHtml(info.label);
    }

    /** Minimal HTML-escape for the plain-text part of a composed icon/emoji/text value (see _renderCalendarInfo()). */
    private static _escHtml(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * format === 'MOON_PHASE' -- 100% client-computed (MoonPhases.ts, same
     * synodic-month approximation already used for the calendar grid's
     * moon legend), no API/database involved -- unlike 'SPECIAL_DATE'
     * above, there's no curated data to look up, just a date-driven
     * astronomical approximation, so this can run directly here instead
     * of needing an apiCache/prefetch step.
     */
    private static _formatMoonPhase(d: Date, b: VariableBinding): string {
        return this._renderCalendarInfo(b, MoonPhases.getPhaseInfo(d, b.dateLanguage));
    }

    /**
     * format === 'SEASON' -- same "100% client-computed, no API" reasoning
     * as 'MOON_PHASE' above: a season is a pure function of month +
     * hemisphere (Seasons.ts), not curated content. `b.hemisphere`
     * defaults to 'south' (see defaultBinding()) when unset, matching a
     * binding saved before this field existed.
     */
    private static _formatSeason(d: Date, b: VariableBinding): string {
        return this._renderCalendarInfo(b, Seasons.getSeasonInfo(d, b.hemisphere ?? 'south', b.dateLanguage));
    }

    /**
     * format === 'ZODIAC' -- same "100% client-computed, no API" reasoning
     * as 'MOON_PHASE'/'SEASON' above: a zodiac sign is a pure function of
     * month/day (Zodiac.ts), not curated content.
     */
    private static _formatZodiac(d: Date, b: VariableBinding): string {
        return this._renderCalendarInfo(b, Zodiac.getSignInfo(d, b.dateLanguage));
    }

    /**
     * Ordinal day of `d` within its own year (Jan 1 -> 1, Dec 31 -> 365 or
     * 366 on a leap year) -- format === 'DAY_OF_YEAR' / the {dayofyear}
     * custom token. Both ends computed via `Date.UTC()` (not the local-time
     * constructor) with the same y/m/d components `d` itself carries, so a
     * DST transition between Jan 1 and `d` can never shift the millisecond
     * difference by the stray hour that comparing two local-time
     * `Date`s directly is prone to -- the calendar-day count this method
     * returns is a pure function of the (year, month, day) triple, with no
     * timezone/DST involvement of its own.
     */
    private static _dayOfYear(d: Date): number {
        const utc  = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
        const jan1 = Date.UTC(d.getFullYear(), 0, 1);
        return Math.round((utc - jan1) / 86400000) + 1;
    }

    /**
     * "Semana N de T" / "Week N of T" (per `b.dateLanguage`, see
     * _dateLocale() -- previously hardcoded pt-BR before that field
     * existed) -- format === 'WEEK_NUMBER' / the {weeknumber} custom
     * token. `T` is the ISO-8601 week COUNT of the ISO week-year `d` falls
     * into (52 or 53, see _isoWeeksInYear()) -- not a hardcoded 52 --
     * since roughly 1 year in 5-6 has a 53rd ISO week.
     */
    private static _formatWeekNumber(d: Date, b?: VariableBinding): string {
        const { week, isoYear } = this._isoWeek(d);
        const loc = this._dateLocale(b?.dateLanguage);
        return `${loc.week} ${week} ${loc.of} ${this._isoWeeksInYear(isoYear)}`;
    }

    /**
     * ISO-8601 week-of-year for `d`, plus the ISO week-year it belongs to
     * (NOT always d.getFullYear() -- e.g. Jan 1st 2027 is a Friday, which
     * ISO 8601 assigns to week 53 of 2026 rather than week 1 of 2027, and
     * symmetrically late-December dates can fall in week 1 of the
     * FOLLOWING year). Standard algorithm: shift `d` to the Thursday of
     * its own Mon-Sun week (ISO weeks run Monday-Sunday, and a week
     * "belongs" to whichever year contains its Thursday), then count
     * whole weeks between that Thursday and the first Thursday of its
     * year. All-UTC arithmetic for the same DST-safety reason as
     * _dayOfYear() above.
     */
    private static _isoWeek(d: Date): { week: number; isoYear: number } {
        const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const isoWeekday = t.getUTCDay() || 7; // Date.getUTCDay(): 0(Sun)..6(Sat) -> ISO 1(Mon)..7(Sun)
        t.setUTCDate(t.getUTCDate() + 4 - isoWeekday); // move to this ISO week's Thursday
        const isoYear = t.getUTCFullYear();
        const jan1    = Date.UTC(isoYear, 0, 1);
        const week    = Math.ceil((((t.getTime() - jan1) / 86400000) + 1) / 7);
        return { week, isoYear };
    }

    /**
     * Number of ISO-8601 weeks (52 or 53) in `isoYear`. A year has 53 iff
     * its Jan 1st is a Thursday, or it's a leap year and Jan 1st is a
     * Wednesday (the standard ISO-8601 rule -- equivalent to checking
     * whether Dec 31st falls in week 53 rather than week 1 of next year).
     */
    private static _isoWeeksInYear(isoYear: number): number {
        const jan1Weekday = (y: number) => new Date(Date.UTC(y, 0, 1)).getUTCDay() || 7;
        const isLeap      = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
        const wd = jan1Weekday(isoYear);
        return (wd === 4 || (wd === 3 && isLeap(isoYear))) ? 53 : 52;
    }

    /**
     * format === 'SPECIAL_DATE' -- joins the titles of every craftools_api
     * calendar_entries hit for `d`'s month/day, restricted to
     * `b.specialDateCategories` (national holidays / commemorative dates /
     * saint days / historical events). Reads from the pre-populated
     * `apiCache.calendarDateByKey` (built by prefetchApiResources()) rather
     * than fetching here -- `_formatDate()` is called from the synchronous
     * `resolve()`/`_format()` path, same constraint 'apiPhrase'/
     * 'emojiKitchen' already work under (see the file-header comment on
     * prefetchApiResources()).
     */
    private static readonly SPECIAL_DATE_GROUP_KEYS: Record<string, keyof CalendarDateApiResult> = {
        holiday:            'holidays',
        commemoration_main: 'commemorationsMain',
        commemoration_misc: 'commemorationsMisc',
        saint:              'saints',
        event:              'events',
    };

    /**
     * Builds the display string for one matched calendar_entries item --
     * bare title by default, or title + state/city (state/municipal
     * holidays) + year (events) + description ("Detalhe") when
     * `specialDateIncludeDescription` is on. The API/admin already store
     * `description` per row (a free-text field, e.g. what happened on a
     * historical event, or extra context for a commemorative date) but
     * nothing on the frontend ever read it before this.
     */
    private static _formatSpecialDateItem(item: CalendarDateApiEntry, includeDescription: boolean): string {
        let text = item.title;
        // Only 'holiday' category items carry scope/uf/city (see
        // calendarEntryToApiShape() in repo.php) -- appended regardless of
        // which scopes the binding filters to, since even a binding
        // showing every scope at once (the default) needs a way to tell a
        // state holiday apart from a national one in the resolved text.
        if (item.scope === 'state' && item.uf) {
            text += ` (${item.uf})`;
        } else if (item.scope === 'municipal') {
            const place = [item.city, item.uf].filter(Boolean).join('/');
            if (place) text += ` (${place})`;
        }
        if (item.year !== undefined) text += ` (${item.year})`;
        if (includeDescription && item.description) text += ` — ${item.description}`;
        return text;
    }

    /**
     * Whether a 'holiday' category item passes specialDateHolidayScopes/
     * specialDateUf -- only ever called for category === 'holiday' items
     * (see _formatSpecialDate() below); commemoration/saint/event items
     * have no scope concept and always pass through unfiltered.
     * `item.scope` defaults to 'national' when absent (matches
     * calendarEntryToApiShape()'s own DB-side default), so an older API
     * response/offline-fallback entry with no scope field at all is still
     * treated correctly rather than silently excluded.
     */
    private static _holidayScopeMatches(item: CalendarDateApiEntry, b: VariableBinding): boolean {
        const scopes = b.specialDateHolidayScopes ?? ['national', 'state', 'municipal'];
        const scope  = (item.scope as 'national' | 'state' | 'municipal' | undefined) ?? 'national';
        if (!scopes.includes(scope)) return false;
        if (scope === 'state' && b.specialDateUf) {
            return (item.uf ?? '').toUpperCase() === b.specialDateUf.toUpperCase();
        }
        return true;
    }

    private static _formatSpecialDate(d: Date, b: VariableBinding, ctx: { repetitionIndex: number }, apiCache: ApiCache): string {
        const key   = `${d.getMonth() + 1}-${d.getDate()}`;
        const entry = apiCache.calendarDateByKey?.[key];
        const emptyText = b.specialDateEmptyText ?? '';
        if (!entry) return emptyText;

        // Distinguishes "never configured" (undefined -- defensive; every
        // real binding gets all five from defaultBinding()) from "user
        // unchecked every category in the panel" (a real empty array,
        // meaning show nothing/only the empty text) -- an `?.length` check
        // here would treat both the same and silently ignore the user
        // having cleared every checkbox.
        const categories = b.specialDateCategories ?? ['holiday', 'commemoration_main', 'commemoration_misc', 'saint', 'event'];
        const includeDescription = !!b.specialDateIncludeDescription;
        let titles: string[] = [];
        categories.forEach(cat => {
            const groupKey = this.SPECIAL_DATE_GROUP_KEYS[cat];
            if (!groupKey) return;
            const items = entry[groupKey] as CalendarDateApiEntry[] | undefined;
            (items ?? []).forEach(item => {
                if (!item?.title) return;
                if (cat === 'holiday' && !this._holidayScopeMatches(item, b)) return;
                titles.push(this._formatSpecialDateItem(item, includeDescription));
            });
        });

        if (b.specialDateRandomize) {
            // Seeded by the resolved month/day + repetition index, NOT
            // Math.random() -- a live preview re-render or a repeated PDF
            // export must keep showing the exact same "random" order for
            // the exact same date/repetition (same reasoning as every other
            // 'random' mode in this file, e.g. _pseudoRandomIndex()), while
            // still varying across different dates and across repetitions
            // that happen to land on the same fixed date (interval: 'none').
            const seed = (ctx.repetitionIndex + 1) * 1000003 + d.getMonth() * 31 + d.getDate();
            titles = this._seededShuffle(titles, seed);
        }

        const limit = parseInt(String(b.specialDateLimit ?? ''), 10);
        if (!isNaN(limit) && limit > 0) titles = titles.slice(0, limit);

        if (!titles.length) return emptyText;
        return titles.join(b.specialDateSeparator ?? ', ');
    }

    /** Deterministic Fisher-Yates shuffle (mulberry32 PRNG) -- same seed always produces the same order. */
    private static _seededShuffle<T>(arr: T[], seed: number): T[] {
        const out = arr.slice();
        let s = seed >>> 0;
        const next = (): number => {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(next() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    // ── sequenceNumber ────────────────────────────────────────────────────────

    private static _pickSequenceNumber(b: VariableBinding, ctx: { repetitionIndex: number }): number {
        const start = parseFloat(String(b.start));
        const step  = parseFloat(String(b.step));
        return (isNaN(start) ? 1 : start) + (isNaN(step) ? 1 : step) * ctx.repetitionIndex;
    }

    private static _formatSequenceNumber(n: number, b: VariableBinding): string {
        if (n == null || isNaN(n)) return '';
        const padding = parseInt(String(b.padding), 10) || 0;
        const rounded = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
        const sign    = rounded < 0 ? '-' : '';
        let numStr    = String(Math.abs(rounded));
        if (padding > 0) numStr = numStr.padStart(padding, '0');
        return `${b.prefix ?? ''}${sign}${numStr}${b.suffix ?? ''}`;
    }

    // ── sequenceText ──────────────────────────────────────────────────────────

    private static _parseValuesList(raw: unknown): string[] {
        return String(raw ?? '').split(/\r?\n|,/).map(s => s.trim()).filter(s => s.length > 0);
    }

    private static _pickSequenceText(b: VariableBinding, ctx: { repetitionIndex: number }): string | null {
        const values = this._parseValuesList(b.values);
        if (!values.length) return null;
        const idx = ctx.repetitionIndex;
        if (b.loop === false) return values[Math.min(idx, values.length - 1)];
        return values[idx % values.length];
    }

    // ── pageNumber ────────────────────────────────────────────────────────────

    private static _pickPageNumber(b: VariableBinding, ctx: { repetitionIndex: number }): number {
        return (parseInt(String(b.startAt), 10) || 1) + ctx.repetitionIndex;
    }

    private static _formatPageNumber(n: number, b: VariableBinding, ctx: { totalPages: number }): string {
        if (n == null) return '';
        if (b.format === 'n_of_total') return `${n}/${ctx.totalPages || n}`;
        return String(n);
    }

    // ── link ──────────────────────────────────────────────────────────────────

    private static _pickLink(b: VariableBinding, ctx: { repetitionIndex: number }): number | null {
        if (!b.appendIndex) return null;
        return (parseInt(String(b.startAt), 10) || 1) + ctx.repetitionIndex;
    }

    private static _formatLink(pick: number | null, b: VariableBinding): string {
        let url = b.url ?? '';
        if (b.appendIndex) {
            const n = pick ?? (parseInt(String(b.startAt), 10) || 1);
            url += (url.includes('?') ? '&' : (url ? '?' : '')) + 'p=' + n;
        }
        return url;
    }

    // ── emoji ─────────────────────────────────────────────────────────────────

    private static _pickEmoji(b: VariableBinding, ctx: { repetitionIndex: number }): string {
        const values = this._parseEmojiList(b.values);
        if (!values.length) return DEFAULT_EMOJI_POOL[Math.floor(Math.random() * DEFAULT_EMOJI_POOL.length)];
        if (b.mode === 'random') return values[this._pseudoRandomIndex(ctx.repetitionIndex, values.length)];
        return values[ctx.repetitionIndex % values.length];
    }

    private static _parseEmojiList(raw: unknown): string[] {
        const str = String(raw ?? '').trim();
        if (!str) return [];
        const pieces = str.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
        const out: string[] = [];
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            for (const piece of pieces) {
                for (const { segment } of seg.segment(piece)) {
                    if (segment?.trim()) out.push(segment);
                }
            }
        } else {
            const re = /\p{Extended_Pictographic}(?:\u{FE0F})?(?:\u{200D}\p{Extended_Pictographic}(?:\u{FE0F})?)*|\S/gu;
            for (const piece of pieces) out.push(...(piece.match(re) ?? []));
        }
        return out;
    }

    // ── apiPhrase ─────────────────────────────────────────────────────────────

    private static _pickApiPhrase(b: VariableBinding, ctx: { repetitionIndex: number }, apiCache: ApiCache): unknown {
        const col  = (b.collection ?? '').trim();
        let list   = apiCache.phrasesByCollection?.[col] ?? [];
        if (!list.length) return null;

        if (b.filterField && b.filterValue) {
            list = list.filter(item => {
                if (item == null || typeof item !== 'object') return false;
                const val = (item as Record<string, unknown>)[b.filterField!];
                if (Array.isArray(val)) return val.map(String).includes(b.filterValue!);
                return val != null && String(val) === b.filterValue;
            });
            if (!list.length) return null;
        }

        const idx = ctx.repetitionIndex;
        return b.mode === 'random'
            ? list[this._pseudoRandomIndex(idx, list.length)]
            : list[idx % list.length];
    }

    private static _formatApiPhrase(item: unknown, b: VariableBinding): string {
        if (item == null)          return '';
        if (typeof item === 'string') return item;
        if (typeof item === 'number') return String(item);

        const obj   = item as Record<string, unknown>;
        const field = (b.field ?? '').trim();
        if (field && obj[field] != null) {
            const val = obj[field];
            return Array.isArray(val) ? val.join(', ') : String(val);
        }

        const guessKeys = ['phrase','text','frase','texto','title','name','value'];
        for (const key of guessKeys) if (obj[key] != null) return String(obj[key]);
        const firstStr = Object.keys(obj).find(k => typeof obj[k] === 'string');
        return firstStr ? String(obj[firstStr]) : '';
    }

    // ── emojiKitchen ──────────────────────────────────────────────────────────

    private static _pickEmojiKitchen(b: VariableBinding, ctx: { repetitionIndex: number }, apiCache: ApiCache): { leftEmoji: string; rightEmoji: string; url: string } | null {
        const left = (b.leftEmoji ?? '').trim();
        if (!left) return null;
        const rightFixed = (b.rightEmoji ?? '').trim();

        let right: string;
        if (rightFixed) {
            right = rightFixed;
        } else {
            const partners = apiCache.emojiKitchenPartnersList?.[left] ?? [];
            const pool     = [left, ...partners];
            const idx      = ctx.repetitionIndex;
            right = b.mode === 'random' ? pool[this._pseudoRandomIndex(idx, pool.length)] : pool[idx % pool.length];
        }

        const key = `${left}|${right}`;
        const url = apiCache.emojiKitchenCombos?.[key] ?? '';
        return { leftEmoji: left, rightEmoji: right, url };
    }

    // ── miniCalendar ──────────────────────────────────────────────────────────

    /**
     * Resolves the highlight day-of-month per miniCalendarHighlightDaySource:
     *  - 'fixed'  -- the manually-entered miniCalendarHighlightDay, same as
     *                before this field existed.
     *  - 'linked' -- day-of-month of another element's already-resolved
     *                `date`-type pick (looked up in the shared `picks`
     *                registry via miniCalendarHighlightLinkedTo). When
     *                linked, `_pickMiniCalendar()` below ALSO switches the
     *                whole card's month/year to the leader date's own
     *                month/year (see `_resolveLinkedDate()`) -- so the
     *                highlighted day always lands on the month actually
     *                being shown, instead of a day-of-month number
     *                highlighted on an unrelated, separately-configured
     *                month. Falls back to 'today' if the target hasn't
     *                resolved yet (e.g. it appears later in the page than
     *                this element, or wasn't resolved as a leader first --
     *                see the leader-before-follower ordering callers of
     *                `resolve()` are responsible for) or isn't actually a
     *                'date' binding.
     *  - 'today' (default) -- always the real current day, recomputed fresh
     *                on every resolve instead of ever freezing.
     */
    /**
     * The actual leader Date when this binding is linked to a 'date'-type
     * element AND that leader has already been resolved into the SAME
     * `picks` registry under its own real element id (see
     * VariableContentTool.ts's/VariablePanel.ts's/AgendaExport.ts's own
     * leader-before-follower ordering for how that's guaranteed). Returns
     * null for every other case (not linked, leader not resolved yet, or
     * the target isn't actually a 'date' binding) so callers can fall back
     * to their own non-linked behavior.
     */
    private static _resolveLinkedDate(b: VariableBinding, picks: Map<string, LinkPick> | null): Date | null {
        if (b.miniCalendarHighlightDaySource !== 'linked' || !b.miniCalendarHighlightLinkedTo) return null;
        const leader = picks?.get(b.miniCalendarHighlightLinkedTo);
        if (leader && leader.type === 'date' && leader.pick instanceof Date) return leader.pick;
        return null;
    }

    private static _resolveHighlightDay(b: VariableBinding, picks: Map<string, LinkPick> | null): number {
        const source = b.miniCalendarHighlightDaySource ?? 'today';
        if (source === 'fixed') {
            return parseInt(String(b.miniCalendarHighlightDay), 10) || new Date().getDate();
        }
        const linked = this._resolveLinkedDate(b, picks);
        if (linked) return linked.getDate();
        return new Date().getDate();
    }

    private static _pickMiniCalendar(b: VariableBinding, ctx: { repetitionIndex: number }, picks: Map<string, LinkPick> | null = null): MiniCalendarPick {
        const linkedDate = this._resolveLinkedDate(b, picks);
        let year: number;
        let month: number;
        if (linkedDate) {
            // Linked mode mirrors the leader date's own month/year outright
            // -- 'sequentialMonthly's +N-per-repetition advance would be
            // meaningless here since the LEADER (often itself advancing
            // per page/day, e.g. a daily agenda's Start Date) is what
            // should decide which month is shown. Previously month/year
            // stayed purely manual/sequential even when linked, so the
            // highlighted day (now correctly the leader's day-of-month)
            // could land on a completely different month than the one the
            // calendar was actually displaying.
            year  = linkedDate.getFullYear();
            month = linkedDate.getMonth() + 1;
        } else {
            year  = parseInt(String(b.year), 10)  || new Date().getFullYear();
            month = parseInt(String(b.month), 10) || (new Date().getMonth() + 1);
            if (b.mode === 'sequentialMonthly') {
                month += ctx.repetitionIndex;
                while (month > 12) { month -= 12; year += 1; }
                while (month < 1)  { month += 12; year -= 1; }
            }
        }
        const displayMode = MINI_CALENDAR_PARTS[b.displayMode ?? ''] ? b.displayMode! : 'complete1';
        const highlight = b.miniCalendarHighlightEnabled ? {
            enabled:      true,
            day:          this._resolveHighlightDay(b, picks),
            bg:           b.miniCalendarHighlightBg,
            textColor:    b.miniCalendarHighlightTextColor,
            borderColor:  b.miniCalendarHighlightBorderColor,
            borderWidth:  b.miniCalendarHighlightBorderWidth  !== undefined ? parseInt(String(b.miniCalendarHighlightBorderWidth), 10)  : undefined,
            borderRadius: b.miniCalendarHighlightBorderRadius !== undefined ? parseInt(String(b.miniCalendarHighlightBorderRadius), 10) : undefined,
            borderStyle:  b.miniCalendarHighlightBorderStyle,
        } : undefined;
        const weekStart: 'sunday' | 'monday' = b.weekStartSunday === false ? 'monday' : 'sunday';
        // Only set keys the user actually touched -- CalendarRenderer.mergeTheme()
        // falls back to its own defaults for anything left undefined, so an
        // untouched field keeps looking exactly like it did before these
        // theme controls existed instead of resolving to an empty string.
        const theme: CalendarTheme = {};
        if (b.miniCalendarThemeTitleBarBg)   theme.titleBar   = { ...theme.titleBar,   bg: b.miniCalendarThemeTitleBarBg };
        if (b.miniCalendarThemeTitleBarText) theme.titleBar   = { ...theme.titleBar,   color: b.miniCalendarThemeTitleBarText };
        if (b.miniCalendarThemeCellBg)       theme.cellBg     = b.miniCalendarThemeCellBg;
        if (b.miniCalendarThemeDayText)      theme.dayNumbers = { ...theme.dayNumbers, color: b.miniCalendarThemeDayText };
        if (b.miniCalendarThemeWeekendBg)    theme.weekendBg  = b.miniCalendarThemeWeekendBg;
        if (b.miniCalendarThemeDayBorderWidth  !== undefined) theme.dayNumbers = { ...theme.dayNumbers, innerBorderWidth:  parseFloat(String(b.miniCalendarThemeDayBorderWidth))  || 0 };
        if (b.miniCalendarThemeDayBorderStyle)                theme.dayNumbers = { ...theme.dayNumbers, innerBorderStyle:  b.miniCalendarThemeDayBorderStyle };
        if (b.miniCalendarThemeDayBorderColor)                theme.dayNumbers = { ...theme.dayNumbers, innerBorderColor:  b.miniCalendarThemeDayBorderColor };
        if (b.miniCalendarThemeDayBorderRadius !== undefined) theme.dayNumbers = { ...theme.dayNumbers, innerBorderRadius: parseFloat(String(b.miniCalendarThemeDayBorderRadius)) || 0 };
        if (b.miniCalendarThemeSectionGap      !== undefined) theme.sectionGap = parseFloat(String(b.miniCalendarThemeSectionGap)) || 0;
        return { year, month, displayMode, weekStart, highlight, theme: Object.keys(theme).length ? theme : undefined };
    }

    private static _formatMiniCalendar(pick: MiniCalendarPick): string {
        const parts = MINI_CALENDAR_PARTS[pick.displayMode] ?? MINI_CALENDAR_PARTS.complete1;
        // CalendarRenderer stays JS — any type here is acceptable
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return CalendarRenderer.buildCardHtml(pick.year, pick.month, { parts, theme: pick.theme, highlight: pick.highlight, weekStart: pick.weekStart }) as string;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static _pseudoRandomIndex(seed: number, length: number): number {
        if (!length || length <= 0) return 0;
        let h = (seed + 0x9e3779b9) | 0;
        h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        h = (h ^ (h >>> 16)) >>> 0;
        return h % length;
    }
}
