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
 * anymore (the old `data-agenda-continue-sequence` flag): the whole point
 * of chaining two pages is that their repetitions are meant to form one
 * continuous run (e.g. a weekday layout's dates flowing straight into a
 * weekend layout's dates for the same week), so `repetitionIndex` simply
 * counts up continuously across every instance in a chain/loop -- across
 * every cycle too, not reset per cycle, so a full-year loop keeps dates
 * flowing forward the same way a human filling in a physical agenda would.
 * A page that ISN'T part of any chain (the overwhelmingly common case: a
 * single repeating page with nothing pointing to/from it) keeps starting
 * fresh at index 0 for its own batch, exactly like before.
 */

export interface AgendaPlanInstance {
  page: HTMLElement;
  /** Continuous 0-based index within this page's own chain/loop -- what
   *  ResolveContext.repetitionIndex should be for this instance. */
  repetitionIndex: number;
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
}

/** One top-level group in AgendaPlan.describe()'s output -- either a
 *  standalone page (repeating or not) or a chain (open or closed-loop). */
export type AgendaPlanSummaryGroup =
  | { kind: 'single'; page: HTMLElement; count: number }
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

    pages.forEach(page => {
      if (!AgendaPlan.repeatEnabled(page)) {
        plan.push({ page, repetitionIndex: 0, cycleIndex: 0 });
        return;
      }
      if (!heads.has(page.id)) return; // reached via some other head's chain instead

      const { chain, loopStart } = AgendaPlan._walkChain(page, byId);

      let runningIndex = 0;
      const emit = (pg: HTMLElement, cycleIndex: number): void => {
        const count = AgendaPlan.repeatCount(pg);
        for (let i = 0; i < count; i++) {
          plan.push({ page: pg, repetitionIndex: runningIndex, cycleIndex });
          runningIndex++;
        }
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

    pages.forEach(page => {
      if (!AgendaPlan.repeatEnabled(page)) {
        groups.push({ kind: 'single', page, count: 1 });
        return;
      }
      if (!heads.has(page.id)) return;

      const { chain, loopStart } = AgendaPlan._walkChain(page, byId);

      if (loopStart === -1) {
        if (chain.length === 1) {
          groups.push({ kind: 'single', page, count: AgendaPlan.repeatCount(page) });
        } else {
          groups.push({
            kind: 'chain',
            prelude: chain.map(pg => ({ page: pg, count: AgendaPlan.repeatCount(pg) })),
            loop: [],
            cycles: 1,
          });
        }
        return;
      }

      const closer = chain[chain.length - 1];
      groups.push({
        kind: 'chain',
        prelude: chain.slice(0, loopStart).map(pg => ({ page: pg, count: AgendaPlan.repeatCount(pg) })),
        loop: chain.slice(loopStart).map(pg => ({ page: pg, count: AgendaPlan.repeatCount(pg) })),
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
