// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { loadPhrases, loadPhraseCollections, loadEmojiKitchenCombo, loadEmojiKitchenPartners, loadCalendarDate } from './ApiDataLoader.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { CalendarRenderer } from './CalendarRenderer.js';

// ── Types ─────────────────────────────────────────────────────────────────────

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
     * 'commemoration'/'saint'/'event'). Defaults to all four in
     * defaultBinding(). See _formatDate()'s 'SPECIAL_DATE' case.
     */
    specialDateCategories?: string[];
    /** Joiner between multiple matched titles on the same day. Default ', '. */
    specialDateSeparator?: string;
    /** Shown when the resolved day has no matching entries. Default ''. */
    specialDateEmptyText?: string;
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

/** craftools_api's `calendar-dates` resource response `data` shape (repo.php's calendarEntryForDate()). */
export interface CalendarDateApiResult {
    month:        number;
    day:          number;
    feriados:     CalendarDateApiEntry[];
    comemoracoes: CalendarDateApiEntry[];
    santos:       CalendarDateApiEntry[];
    eventos:      CalendarDateApiEntry[];
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

    // ── Default bindings ─────────────────────────────────────────────────────

    static defaultBinding(type: string): VariableBinding | null {
        const today = new Date();
        const pad   = (v: number) => String(v).padStart(2, '0');
        const isoToday = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

        switch (type) {
            case 'date':           return {
                type, startDate: isoToday, interval: 'daily', step: 1, format: 'DD/MM/YYYY', linkedTo: '',
                specialDateCategories: ['holiday', 'commemoration', 'saint', 'event'],
                specialDateSeparator: ', ',
                specialDateEmptyText: '',
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
            pick = this._pick(binding, ctx, apiCache);
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
        if (binding.type === 'apiPhrase' || binding.type === 'emojiKitchen' || (binding.type === 'date' && binding.format === 'SPECIAL_DATE')) {
            const apiCache = await this.prefetchApiResources([binding]);
            return this.resolve(binding, context, apiCache);
        }
        return this.resolve(binding, context, {});
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
        const specialDateBindings = list.filter((b): b is VariableBinding => !!b && b.type === 'date' && b.format === 'SPECIAL_DATE');
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

    private static _pick(binding: VariableBinding, ctx: Required<ResolveContext> & { now: Date }, apiCache: ApiCache): unknown {
        switch (binding.type) {
            case 'date':           return this._pickDate(binding, ctx);
            case 'sequenceNumber': return this._pickSequenceNumber(binding, ctx);
            case 'sequenceText':   return this._pickSequenceText(binding, ctx);
            case 'pageNumber':     return this._pickPageNumber(binding, ctx);
            case 'link':           return this._pickLink(binding, ctx);
            case 'emoji':          return this._pickEmoji(binding, ctx);
            case 'apiPhrase':      return this._pickApiPhrase(binding, ctx, apiCache);
            case 'emojiKitchen':   return this._pickEmojiKitchen(binding, ctx, apiCache);
            case 'miniCalendar':   return this._pickMiniCalendar(binding, ctx);
            default:               return null;
        }
    }

    // ── Format dispatch ───────────────────────────────────────────────────────

    private static _format(binding: VariableBinding, pick: unknown, ctx: Required<ResolveContext> & { now: Date }, apiCache: ApiCache = {}): string {
        switch (binding.type) {
            case 'date':           return pick ? this._formatDate(pick as Date, binding, apiCache) : '';
            case 'sequenceNumber': return this._formatSequenceNumber(pick as number, binding);
            case 'sequenceText':   return pick == null ? '' : String(pick);
            case 'pageNumber':     return this._formatPageNumber(pick as number, binding, ctx);
            case 'link':           return this._formatLink(pick as number | null, binding);
            case 'emoji':          return pick == null ? '' : String(pick);
            case 'apiPhrase':      return this._formatApiPhrase(pick, binding);
            case 'emojiKitchen':   return (pick && (pick as { url: string }).url) ? (pick as { url: string }).url : '';
            case 'miniCalendar':   return pick ? this._formatMiniCalendar(pick as { year: number; month: number; displayMode: string }) : '';
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

    private static _formatDate(d: Date, b: VariableBinding, apiCache: ApiCache = {}): string {
        const format = b.format ?? 'DD/MM/YYYY';
        const pad = (v: number) => String(v).padStart(2, '0');
        const dd   = pad(d.getDate()), mm = pad(d.getMonth() + 1), yyyy = d.getFullYear(), yy = String(yyyy).slice(-2);
        const mPt  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const wPt  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
        const wPtAbrev = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
        
        switch (format) {
            case 'DD/MM/YYYY':         return `${dd}/${mm}/${yyyy}`;
            case 'DD/MM/YY':           return `${dd}/${mm}/${yy}`;
            case 'DD/MM':              return `${dd}/${mm}`;
            case 'MM/YYYY':            return `${mm}/${yyyy}`;
            case 'YYYY-MM-DD':         return `${yyyy}-${mm}-${dd}`;
            case 'DAY_MONTH_LONG':    return `${d.getDate()} de ${mPt[d.getMonth()]}`;
            case 'DAY_MONTH_YEAR_LONG':return `${d.getDate()} de ${mPt[d.getMonth()]} de ${yyyy}`;
            case 'WEEKDAY':         return wPt[d.getDay()];
            case 'WEEKDAY_SHORT':   return wPtAbrev[d.getDay()];
            case 'WEEKDAY_DATE':    return `${wPt[d.getDay()]}, ${dd}/${mm}`;
            case 'DAY_ONLY':         return `${d.getDate()}`;
            case 'MONTH_ONLY':         return mPt[d.getMonth()];
            case 'CUSTOM':      return this._formatCustomDate(d, b.customFormat ?? '');
            case 'SPECIAL_DATE': return this._formatSpecialDate(d, b, apiCache);
            case 'DAYS_BOX': {
                const hlColor  = b.daysBoxHighlightColor || 'var(--accent, #f97316)';
                const radius   = b.daysBoxBorderRadius !== undefined ? String(b.daysBoxBorderRadius) : '50';
                const padding  = b.daysBoxPadding !== undefined ? String(b.daysBoxPadding) : '4';
                const startSun = !!b.daysBoxStartSunday;

                // Explicit height (px) is independent from the content-driven
                // width (min-width + padding) -- lets the box be shaped into
                // a perfect circle (height === effective width) or an oval
                // (height different from width), instead of always being a
                // roughly-square box sized purely from the letter + padding.
                // Falls back to the original min-height:1.5em when unset, so
                // existing bindings saved before this control existed render
                // exactly as before.
                const heightCss = (b.daysBoxHeight !== undefined && String(b.daysBoxHeight).trim() !== '')
                    ? `height: ${b.daysBoxHeight}px;`
                    : `min-height: 1.5em;`;

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
                    return `<div style="display:flex; align-items:center; justify-content:center; border: ${borderCss}; border-radius: ${radius}px; padding: ${padding}px; background-color: ${bg}; color: ${color}; min-width: 1.5em; ${heightCss}">${letter}</div>`;
                }).join('');
                
                return `<div style="display:flex; align-items:center; gap:6px; font-weight:bold;">${html}</div>`;
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
     * Any other character (including regular letters like 'e', 'a', 's'
     * that show up in ordinary words) passes through unchanged -- EXCEPT
     * that a bare single letter from {d,m,y,w} inside a literal word (e.g.
     * the 'd' in "de") is indistinguishable from the token itself and WILL
     * be replaced. Text wrapped in [square brackets] is passed through
     * completely literally so patterns like "dd [de] mmmm" can safely
     * include such words -- documented in the legend shown above the
     * format input (VariablePanel.ts's _dateConfig()), which must stay in
     * sync with this exact token list.
     */
    private static _formatCustomDate(d: Date, pattern: string): string {
        if (!pattern) return '';
        const pad     = (v: number) => String(v).padStart(2, '0');
        const mFull   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const mAbrev  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const wFull   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
        const wAbrev  = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
        const wFirst  = ['D','S','T','Q','Q','S','S'];

        const tokens: Record<string, () => string> = {
            yyyy: () => String(d.getFullYear()),
            yy:   () => String(d.getFullYear()).slice(-2),
            mmmm: () => mFull[d.getMonth()],
            mmm:  () => mAbrev[d.getMonth()],
            mm:   () => pad(d.getMonth() + 1),
            m:    () => String(d.getMonth() + 1),
            dd:   () => pad(d.getDate()),
            d:    () => String(d.getDate()),
            wwww: () => wFull[d.getDay()],
            ww:   () => wAbrev[d.getDay()],
            w:    () => wFirst[d.getDay()],
        };

        const applyTokens = (text: string): string =>
            text.replace(/d+|m+|y+|w+/gi, run => {
                const fn = tokens[run.toLowerCase()];
                return fn ? fn() : run;
            });

        // Split out [bracketed] literal segments (kept as-is, brackets
        // stripped) from everything else (token-replaced).
        return pattern
            .split(/(\[[^\]]*\])/g)
            .map(part => (part.startsWith('[') && part.endsWith(']')) ? part.slice(1, -1) : applyTokens(part))
            .join('');
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
        holiday:       'feriados',
        commemoration: 'comemoracoes',
        saint:         'santos',
        event:         'eventos',
    };

    private static _formatSpecialDate(d: Date, b: VariableBinding, apiCache: ApiCache): string {
        const key   = `${d.getMonth() + 1}-${d.getDate()}`;
        const entry = apiCache.calendarDateByKey?.[key];
        const emptyText = b.specialDateEmptyText ?? '';
        if (!entry) return emptyText;

        // Distinguishes "never configured" (undefined -- defensive; every
        // real binding gets all four from defaultBinding()) from "user
        // unchecked every category in the panel" (a real empty array,
        // meaning show nothing/only the empty text) -- an `?.length` check
        // here would treat both the same and silently ignore the user
        // having cleared every checkbox.
        const categories = b.specialDateCategories ?? ['holiday', 'commemoration', 'saint', 'event'];
        const titles: string[] = [];
        categories.forEach(cat => {
            const groupKey = this.SPECIAL_DATE_GROUP_KEYS[cat];
            if (!groupKey) return;
            const items = entry[groupKey] as CalendarDateApiEntry[] | undefined;
            (items ?? []).forEach(item => { if (item?.title) titles.push(item.title); });
        });

        if (!titles.length) return emptyText;
        return titles.join(b.specialDateSeparator ?? ', ');
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

    private static _pickMiniCalendar(b: VariableBinding, ctx: { repetitionIndex: number }): { year: number; month: number; displayMode: string } {
        let year  = parseInt(String(b.year), 10)  || new Date().getFullYear();
        let month = parseInt(String(b.month), 10) || (new Date().getMonth() + 1);
        if (b.mode === 'sequentialMonthly') {
            month += ctx.repetitionIndex;
            while (month > 12) { month -= 12; year += 1; }
            while (month < 1)  { month += 12; year -= 1; }
        }
        const displayMode = MINI_CALENDAR_PARTS[b.displayMode ?? ''] ? b.displayMode! : 'complete1';
        return { year, month, displayMode };
    }

    private static _formatMiniCalendar(pick: { year: number; month: number; displayMode: string }): string {
        const parts = MINI_CALENDAR_PARTS[pick.displayMode] ?? MINI_CALENDAR_PARTS.complete1;
        // CalendarRenderer stays JS — any type here is acceptable
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return CalendarRenderer.buildCardHtml(pick.year, pick.month, { parts }) as string;
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
