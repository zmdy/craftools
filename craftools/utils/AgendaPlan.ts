/**
 * AgendaPlan.ts
 *
 * Resolves the "Páginas" tab's per-page repeat/chain configuration into a
 * flat, ordered list of output instances -- shared by AgendaExport.ts (the
 * real variable-resolution pipeline) and AgendaExportTool.ts (the Pages tab
 * UI's counts, dropdown options and summary breadcrumb), so both always
 * agree on exactly what the export will produce.
 *
 * ── The model ────────────────────────────────────────────────────────────
 * Each `.craftools-page` can carry:
 *   - `data-agenda-repeat="N"`       -- repeat this page N times (its own
 *     "turn"). Absent/1 means it appears once, like a normal PDF page.
 *   - `data-agenda-alternate="true"` -- mirror every other repetition
 *     (front/back duplex layout). Unrelated to chaining, kept as-is.
 *   - `data-agenda-next="<pageId>"`  -- after this page's own repetitions
 *     finish, continue with the page whose id this points to, INSTEAD of
 *     just falling through to the next `.craftools-page` in the document.
 *     Absent means "next page in the document" (today's default/only
 *     behavior). Can point either forward (extending a chain: "página 2 ->
 *     continuar com página 3") or backward into an earlier page already in
 *     the same chain (closing it into a loop: "página 3 -> voltar para
 *     página 2"). A page pointed to this way is never processed again at
 *     its own document position -- it only appears where the chain reaches
 *     it (see `_computeHeads()`).
 *   - `data-agenda-cycle-count="K"`  -- only meaningful on the page whose
 *     own `data-agenda-next` closes a loop (points back to an earlier page
 *     already visited in the same forward walk). The pages from that
 *     earlier page through this one repeat as a whole block K times.
 *
 * Each page has at most one outgoing edge (`data-agenda-next`) and, by
 * construction (AgendaExportTool.ts's dropdown excludes any page already
 * targeted by someone else), at most one incoming edge -- so the graph of
 * repeat-enabled pages is always a disjoint union of simple paths and
 * simple cycles. `_computeHeads()` below is where a page is decided to be
 * either a top-level entry point (a "head", walked at its own document
 * position) or something reached only via another head's chain.
 *
 * Walking a chain never needs an explicit "continue sequence" opt-in
 * anymore (the old `data-agenda-continue-sequence` flag): `repetitionIndex`
 * counts up continuously across EVERY instance of EVERY page in a
 * chain/loop -- across every cycle too, not reset per cycle -- so two
 * pages that are meant to share one continuous flow (e.g. a weekday
 * layout's dates flowing straight into a weekend layout's dates for the
 * same week) can. `pageIndex` (below) instead counts only THIS SPECIFIC
 * page's own instances, ignoring any other page interleaved into the same
 * chain/loop -- what a page's OWN date binding should normally advance
 * by (see `VariableBinding.repetitionScope`'s doc comment in
 * VariableEngine.ts for why `repetitionIndex` alone is wrong for this:
 * a header page contributing even 1 instance ahead of a days page in the
 * same cycle silently shifts the days page's whole sequence by 1, e.g.
 * skipping day 1 and ending on the 1st of the NEXT month instead of the
 * last day of the current one). A page that ISN'T part of any chain (the
 * overwhelmingly common case: a single repeating page with nothing
 * pointing to/from it) has `pageIndex === repetitionIndex` always, so
 * nothing changes for it either way.
 *
 * ── Dynamic (date-triggered) repeat counts ──────────────────────────────
 * `data-agenda-repeat` is normally a plain static number the user typed
 * in. But a page can instead carry `data-agenda-repeat-trigger` (one of
 * VariableEngine's `DateRepeatTrigger` values: month/bimester/trimester/
 * semester/year) -- AgendaExportTool.ts's Pages tab UI for "repeat until
 * the month changes" etc. When set, `build()` ignores the STATIC
 * `data-agenda-repeat` number for every emission after the first and
 * instead recomputes it fresh via `VariableEngine.computeDateTriggerRepeatCount()`,
 * passing this page's own accumulated `repetitionIndex` at the point each
 * emission starts -- so a "days" page chained into a 12-cycle loop behind
 * a "month" page correctly shows 31 slots in a January cycle, 28/29 in a
 * February cycle, 30 in an April cycle, etc, instead of being frozen at
 * whatever count matched its binding's static `startDate` when the
 * trigger was first configured (the second half of the reported
 * "shows Agosto/Setembro" bug, alongside the `cycleIndex` fix above --
 * see `computeDateTriggerRepeatCount()`'s own doc comment for the exact
 * mechanics).
 */

import { VariableEngine, type VariableBinding, type DateRepeatTrigger } from './VariableEngine.js';
import { PropertyRenderer } from './PropertyRenderer.js';
import { parseVariableBinding } from './fields/variable-binding.field.js';

export interface AgendaPlanInstance {
  page: HTMLElement;
  /** Continuous 0-based index within this page's own chain/loop -- what
   *  ResolveContext.repetitionIndex should be for this instance. Shared
   *  across every DIFFERENT page emitted in the same chain/loop -- see
   *  `pageIndex` below for the per-page-only counterpart. */
  repetitionIndex: number;
  /**
   * Continuous 0-based index of how many times THIS EXACT page (by
   * element identity, not by page type/position) has been emitted so
   * far -- across the WHOLE build, never reset per cycle, but NEVER
   * incremented by any OTHER page's own emissions either, unlike
   * `repetitionIndex` above. For a page with no chain (the common case)
   * this is always identical to `repetitionIndex`. For a page chained
   * behind a DIFFERENT page (e.g. a "days" page behind a "month" header
   * in the same cycle), this is what lets the days page's own date
   * binding start each cycle at its own day 1 instead of being shifted
   * forward by however many instances the header page contributed first
   * -- see `VariableBinding.repetitionScope`'s doc comment in
   * VariableEngine.ts.
   */
  pageIndex: number;
  /**
   * 0-based index of which iteration of the ENCLOSING loop this instance
   * belongs to -- 0 for every instance outside a loop (a non-repeating
   * page, a simple repeating page with no chain, or an open chain's
   * prelude pages before any loop starts), and 0..cycles-1 for every page
   * inside a closed loop's body, the SAME value for every page emitted
   * during that one pass through the loop.
   *
   * Exists specifically for a "month header + variable day count" chain
   * (page A = a month page, repeat 1x per cycle; page B = a days page,
   * repeat ~30x per cycle; B's "continuar com" loops back to A, cycled
   * 12x): page A's date binding needs to advance by exactly 1 month per
   * CYCLE (0, 1, 2 .. 11 -> Jan, Fev, Mar .. Dez), but `repetitionIndex`
   * counts every instance of BOTH pages continuously (so page A's 2nd
   * occurrence lands at repetitionIndex ~32, not 1, once page B's ~31
   * interleaved instances from cycle 1 are counted too) -- feeding that
   * straight into a `interval: 'monthly'` binding computes "start date +
   * 32 months", which is what actually produced the reported "shows
   * Agosto/Setembro instead of Fevereiro" bug. `cycleIndex` gives a date
   * binding on a page like A a clean 0/1/2/../11 counter to advance by
   * instead, opted into per-binding via VariableBinding.repetitionScope
   * (see VariableEngine.ts) -- `repetitionIndex` keeps its existing
   * continuous meaning unchanged, still exactly what a page like B (whose
   * days need to flow continuously day-to-day across the whole export,
   * not reset every cycle) should keep using.
   */
  cycleIndex: number;
}

/** One node in a resolved chain's summary breakdown -- see AgendaPlan.describe(). */
export interface AgendaPlanSummaryPage {
  page: HTMLElement;
  count: number;
  /** True when `count` comes from a date-triggered repeat mode (see this
   *  file's header comment, "Dynamic (date-triggered) repeat counts") --
   *  meaning it's only representative of THIS page's first occurrence and
   *  the real per-cycle count can differ (e.g. 31 in a January cycle, 28
   *  in a February one). AgendaExportTool.ts's summary breadcrumb uses
   *  this to mark the number as approximate (e.g. "~31x") instead of
   *  implying every cycle repeats exactly that many times. */
  dynamic: boolean;
}

/** One top-level group in AgendaPlan.describe()'s output -- either a
 *  standalone page (repeating or not) or a chain (open or closed-loop). */
export type AgendaPlanSummaryGroup =
  | { kind: 'single'; page: HTMLElement; count: number; dynamic: boolean }
  | { kind: 'chain'; prelude: AgendaPlanSummaryPage[]; loop: AgendaPlanSummaryPage[]; cycles: number };

const MAX_CHAIN_HOPS = 200; // safety net against pathological/corrupted next-pointer data

export class AgendaPlan {

  static repeatEnabled(page: HTMLElement): boolean {
    return page.hasAttribute('data-agenda-repeat');
  }

  static repeatCount(page: HTMLElement): number {
    return Math.max(1, parseInt(page.dataset['agendaRepeat'] ?? '1', 10) || 1);
  }

  static cycleCount(page: HTMLElement): number {
    return Math.max(1, parseInt(page.dataset['agendaCycleCount'] ?? '', 10) || 2);
  }

  static nextPageId(page: HTMLElement): string | null {
    const id = page.dataset['agendaNext'];
    return id ? id : null;
  }

  /** Whether `page` uses date-triggered dynamic repeat mode instead of a
   *  plain static count -- see this file's header comment. */
  static hasRepeatTrigger(page: HTMLElement): boolean {
    return !!page.dataset['agendaRepeatTrigger'];
  }

  /**
   * The page's own "leading" date binding, if it has one -- i.e. the
   * binding a date-triggered repeat count (month/bimester/trimester/
   * semester/year) computes FROM. Deliberately excludes followers
   * (`binding.linkedTo` set): a page can have several elements bound to
   * the SAME date (a "Vincular a" follower just mirrors the leader's
   * resolved value), and the leader is the one whose own `startDate`/
   * `interval`/`step` actually drive the date math.
   *
   * A self-contained near-duplicate of AgendaExportTool.ts's own private
   * `_findLeadingDateBinding()`/`_collectPageBindings()` (same reasoning
   * as AgendaExport.ts's own independent `_collectBindings()`/
   * `_getBinding()`, see that file's doc comments) -- this one exists
   * specifically so `build()` below can recompute a dynamic repeat count
   * without depending on the UI-only tool module.
   */
  static findLeadingDateBinding(page: HTMLElement): VariableBinding | null {
    for (const el of Array.from(page.querySelectorAll<HTMLElement>('craftools-element'))) {
      const toolType = el.getAttribute('data-craftool') ?? '';
      let binding: VariableBinding | null = null;
      if (toolType === 'variablecontent') {
        binding = (el as HTMLElement & { _craftoolsVariable?: VariableBinding | null })._craftoolsVariable ?? null;
        if (!binding) {
          const state = PropertyRenderer._readState(el);
          if ('variableBinding' in state) binding = parseVariableBinding(state.variableBinding);
        }
      } else if (toolType === 'qrcode' || toolType === 'barcode') {
        binding = (el as HTMLElement & { _craftoolsMeta?: { variableBinding?: VariableBinding | null } })._craftoolsMeta?.variableBinding ?? null;
        if (!binding) {
          const state = PropertyRenderer._readState(el);
          if ('variableBinding' in state) binding = parseVariableBinding(state.variableBinding);
        }
      }
      if (binding && binding.type === 'date' && !binding.linkedTo) return binding;
    }
    return null;
  }

  /**
   * Resolves how many times `pg` should repeat for the emission starting
   * at `indices` (this page's own repetitionIndex/pageIndex/cycleIndex
   * for its first instance in this pass) -- the static `data-agenda-repeat`
   * snapshot for a plain manually-numbered page, or a freshly recomputed
   * count for a `hasRepeatTrigger()` page (see this file's header
   * comment). Falls back to the static snapshot if the page's leading
   * date binding can't be found (e.g. it was deleted after the trigger
   * was configured) -- same graceful degradation the rest of this file
   * uses for corrupted/stale state rather than throwing.
   *
   * Which of the three indices actually gets used as the count's
   * `startIndex` follows the SAME `repetitionScope` the binding's own
   * date math (`VariableEngine._pickDate()`) uses to render -- otherwise
   * the computed COUNT and the actual RENDERED dates could desync (e.g.
   * a count computed from `pageIndex` but dates rendered from
   * `repetitionIndex` would produce the wrong number of pages for
   * whichever index was NOT used to pick the reference date).
   */
  private static _resolveRepeatCount(
    pg: HTMLElement,
    indices: { repetitionIndex: number; pageIndex: number; cycleIndex: number },
  ): number {
    const trigger = pg.dataset['agendaRepeatTrigger'] as DateRepeatTrigger | undefined;
    if (!trigger) return AgendaPlan.repeatCount(pg);
    const binding = AgendaPlan.findLeadingDateBinding(pg);
    if (!binding) return AgendaPlan.repeatCount(pg);
    const startIndex = binding.repetitionScope === 'cycle' ? indices.cycleIndex
                      : binding.repetitionScope === 'chain' ? indices.repetitionIndex
                      : indices.pageIndex; // default/'instance' -- this page's OWN count, see pageIndex's doc comment
    return VariableEngine.computeDateTriggerRepeatCount(binding, trigger, new Date(), startIndex);
  }

  /**
   * Walks the forward chain starting at `head` (following each page's own
   * `data-agenda-next`, but only ever through OTHER repeat-enabled pages),
   * stopping when it either runs off the end (no more `next`, or `next`
   * points somewhere not repeat-enabled/not in `pages`) or revisits a page
   * already seen in THIS walk -- which closes a loop right there.
   *
   * Returns the ordered list of pages in the chain, plus `loopStart` (the
   * index within that list where the loop begins, or -1 for an open
   * chain). The page that closes the loop (last in the list when
   * `loopStart >= 0`) is where `cycleCount()` is read from.
   */
  private static _walkChain(head: HTMLElement, byId: Map<string, HTMLElement>): { chain: HTMLElement[]; loopStart: number } {
    const chain: HTMLElement[] = [head];
    const indexInChain = new Map<string, number>([[head.id, 0]]);
    let cursor = head;
    let loopStart = -1;

    for (let hops = 0; hops < MAX_CHAIN_HOPS; hops++) {
      const nextId = AgendaPlan.nextPageId(cursor);
      if (!nextId) break; // no custom next -- open chain ends here
      if (indexInChain.has(nextId)) { loopStart = indexInChain.get(nextId)!; break; } // revisits a page in this walk -- loop closes
      const nextPage = byId.get(nextId);
      if (!nextPage || !AgendaPlan.repeatEnabled(nextPage)) break; // dangling/non-repeating reference -- treat as an open chain end
      indexInChain.set(nextPage.id, chain.length);
      chain.push(nextPage);
      cursor = nextPage;
    }

    return { chain, loopStart };
  }

  /**
   * Decides which repeat-enabled pages are "heads" -- entry points walked
   * at their own top-level document position (see build()'s main loop).
   * A page with no incoming edge is trivially a head. A page that DOES
   * have one is only skipped if it's reachable from such a head; a page
   * with an incoming edge that ISN'T reachable from any no-incoming-edge
   * page can only mean it's part of a "pure" cycle (every member has
   * exactly one incoming edge, so nothing outside the cycle ever leads
   * into it) -- for those, the earliest page in DOCUMENT order becomes the
   * cycle's canonical head, so the loop's output lands exactly where that
   * page sits in the document instead of being pulled out of order.
   */
  private static _computeHeads(pages: HTMLElement[]): Set<string> {
    const repeatPages = pages.filter(p => AgendaPlan.repeatEnabled(p));
    const byId = new Map(pages.map(p => [p.id, p] as const));
    const order = new Map(pages.map((p, i) => [p.id, i] as const));

    // incomingFrom.get(targetId) = the one page pointing at it (undefined
    // if none). Only edges between two repeat-enabled pages count.
    const incomingFrom = new Map<string, string>();
    repeatPages.forEach(p => {
      const nextId = AgendaPlan.nextPageId(p);
      if (!nextId) return;
      const target = byId.get(nextId);
      if (target && AgendaPlan.repeatEnabled(target) && !incomingFrom.has(nextId)) {
        incomingFrom.set(nextId, p.id);
      }
    });

    const heads = new Set<string>();
    const resolved = new Set<string>();

    repeatPages.forEach(p => {
      if (resolved.has(p.id)) return;
      // Walk BACKWARD via incomingFrom from p until either a page with no
      // incoming edge is found (that page is the head of an open chain) or
      // a page already seen on THIS backward walk is revisited (a pure
      // cycle -- its earliest-by-document-order member becomes the head).
      const backChain: string[] = [];
      let cursor = p.id;
      for (let hops = 0; hops < MAX_CHAIN_HOPS; hops++) {
        const seenAt = backChain.indexOf(cursor);
        if (seenAt !== -1) {
          const cycleIds = backChain.slice(seenAt);
          let earliest = cycleIds[0];
          cycleIds.forEach(id => { if ((order.get(id) ?? 0) < (order.get(earliest) ?? 0)) earliest = id; });
          heads.add(earliest);
          break;
        }
        backChain.push(cursor);
        const prev = incomingFrom.get(cursor);
        if (!prev) { heads.add(cursor); break; }
        cursor = prev;
      }
      backChain.forEach(id => resolved.add(id));
    });

    return heads;
  }

  /**
   * Builds the full, ordered list of output instances for the whole
   * document -- one entry per physical output page, in the exact order
   * they'll be printed/previewed. `plan.length` is the real total page
   * count (what AgendaExportTool.ts's summary/export-count should show).
   */
  static build(pages: HTMLElement[]): AgendaPlanInstance[] {
    const byId  = new Map(pages.map(p => [p.id, p] as const));
    const heads = AgendaPlan._computeHeads(pages);
    const plan: AgendaPlanInstance[] = [];

    // Per-PAGE running index -- see AgendaPlanInstance.pageIndex's doc
    // comment. Declared OUTSIDE the pages.forEach below (shared across
    // every head's own chain) purely for simplicity: by construction
    // (each page has at most one incoming edge, see this file's header
    // comment) a given page element is only ever emitted from exactly one
    // head's walk anyway, so a single shared map behaves identically to
    // one map per head would, without needing to thread it through.
    const pageRunningIndex = new Map<HTMLElement, number>();

    pages.forEach(page => {
      if (!AgendaPlan.repeatEnabled(page)) {
        plan.push({ page, repetitionIndex: 0, cycleIndex: 0, pageIndex: 0 });
        return;
      }
      if (!heads.has(page.id)) return; // reached via some other head's chain instead

      const { chain, loopStart } = AgendaPlan._walkChain(page, byId);

      let runningIndex = 0;
      const emit = (pg: HTMLElement, cycleIndex: number): void => {
        const pageStartIndex = pageRunningIndex.get(pg) ?? 0;
        // _resolveRepeatCount() recomputes a date-triggered page's count
        // FRESH from wherever ITS OWN binding has advanced to by this
        // point (using whichever of the 3 indices its repetitionScope
        // picks) -- see this file's header comment ("Dynamic
        // (date-triggered) repeat counts"). For a plain manually-numbered
        // page (no trigger) this is identical to the old
        // `AgendaPlan.repeatCount(pg)` call, so nothing changes for the
        // overwhelmingly common non-trigger case.
        const count = AgendaPlan._resolveRepeatCount(pg, { repetitionIndex: runningIndex, pageIndex: pageStartIndex, cycleIndex });
        for (let i = 0; i < count; i++) {
          plan.push({ page: pg, repetitionIndex: runningIndex, cycleIndex, pageIndex: pageStartIndex + i });
          runningIndex++;
        }
        pageRunningIndex.set(pg, pageStartIndex + count);
      };

      if (loopStart === -1) {
        chain.forEach(pg => emit(pg, 0));
      } else {
        chain.slice(0, loopStart).forEach(pg => emit(pg, 0)); // prelude -- runs once, cycle 0
        const loopPages = chain.slice(loopStart);
        const closer = chain[chain.length - 1];
        const cycles = AgendaPlan.cycleCount(closer);
        for (let k = 0; k < cycles; k++) loopPages.forEach(pg => emit(pg, k));
      }
    });

    return plan;
  }

  /**
   * Same walk as build(), but grouped for display instead of flattened --
   * powers AgendaExportTool.ts's summary breadcrumb ("Página 1 -> [Página 2
   * (30x) -> Página 3 (15x)] x12 -> ...") and its "which page(s) currently
   * close a loop" detection (see closingPageIds()). Mirrors build()'s
   * traversal exactly so neither ever disagrees with the other.
   */
  static describe(pages: HTMLElement[]): AgendaPlanSummaryGroup[] {
    const byId  = new Map(pages.map(p => [p.id, p] as const));
    const heads = AgendaPlan._computeHeads(pages);
    const groups: AgendaPlanSummaryGroup[] = [];

    // Mirrors build()'s own pageRunningIndex bookkeeping -- see that
    // method's matching comment for why one shared map is safe here too.
    const pageRunningIndex = new Map<HTMLElement, number>();

    pages.forEach(page => {
      if (!AgendaPlan.repeatEnabled(page)) {
        groups.push({ kind: 'single', page, count: 1, dynamic: false });
        return;
      }
      if (!heads.has(page.id)) return;

      const { chain, loopStart } = AgendaPlan._walkChain(page, byId);

      // Mirrors build()'s own runningIndex bookkeeping (prelude, then cycle
      // 0 of the loop) so a dynamic (date-triggered) page's displayed
      // count here is the exact SAME first-cycle number build() actually
      // produces, not an independent recomputation that could drift out
      // of sync with it. `dynamic` flags whether that number is only
      // representative of this first cycle -- see AgendaPlanSummaryPage's
      // doc comment.
      let runningIndex = 0;
      const describePage = (pg: HTMLElement): AgendaPlanSummaryPage => {
        const pageStartIndex = pageRunningIndex.get(pg) ?? 0;
        const count = AgendaPlan._resolveRepeatCount(pg, { repetitionIndex: runningIndex, pageIndex: pageStartIndex, cycleIndex: 0 });
        runningIndex += count;
        pageRunningIndex.set(pg, pageStartIndex + count);
        return { page: pg, count, dynamic: AgendaPlan.hasRepeatTrigger(pg) };
      };

      if (loopStart === -1) {
        if (chain.length === 1) {
          const d = describePage(page);
          groups.push({ kind: 'single', page, count: d.count, dynamic: d.dynamic });
        } else {
          groups.push({
            kind: 'chain',
            prelude: chain.map(pg => describePage(pg)),
            loop: [],
            cycles: 1,
          });
        }
        return;
      }

      const closer = chain[chain.length - 1];
      groups.push({
        kind: 'chain',
        prelude: chain.slice(0, loopStart).map(pg => describePage(pg)),
        loop: chain.slice(loopStart).map(pg => describePage(pg)),
        cycles: AgendaPlan.cycleCount(closer),
      });
    });

    return groups;
  }

  /**
   * Ids of pages whose OWN `data-agenda-next` is the one that closes a
   * loop (i.e. the last page in some group's `loop` array from describe())
   * -- AgendaExportTool.ts shows the "repetir esse bloco quantas vezes"
   * field only on these, since picking a purely forward "continuar com"
   * (extending a chain without looping back) never needs a cycle count.
   */
  static closingPageIds(pages: HTMLElement[]): Set<string> {
    const ids = new Set<string>();
    AgendaPlan.describe(pages).forEach(g => {
      if (g.kind === 'chain' && g.loop.length) ids.add(g.loop[g.loop.length - 1].page.id);
    });
    return ids;
  }
}
