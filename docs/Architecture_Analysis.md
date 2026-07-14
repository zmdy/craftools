# CrafTools — Architecture Analysis & Modernisation Plan

> **Scope:** honest assessment of the current all-JS / Vanilla + PHP approach, freeze/crash risk, and a concrete migration recommendation.

---

## 1. What the system is today

| Layer | Technology | Notes |
|-------|-----------|-------|
| Editor UI | Vanilla JS ES Modules + Custom Elements (Web Components) | No framework; rendered via `innerHTML` strings in each component |
| Styling | Plain CSS (`craftools.css`) + inline `style` strings | No CSS-in-JS, no utility framework |
| Build | Vite | Module bundling + dev server |
| State | In-memory JS objects + `el.dataset.ctState` (DOM as source of truth) + `localStorage` for session | No global store |
| History | Custom `HistoryManager` — stores raw `innerHTML` snapshots (up to 10) | Coarse-grained snapshot, not diff-based |
| i18n | Custom `I18n` singleton with `addTranslations()` / `I18n.t()` | PT-BR, EN, ES |
| Export | `html2canvas` (image) + custom PDF renderer | Rasterisation-based |
| Backend API | PHP 8 + SQLite (PDO) | Zero-config DB; file-based API logs (JSONL) |
| Auth (admin) | PHP sessions | Cookie-based |
| Auth (API) | Bearer tokens stored in SQLite | Tier system: free / plus / premium |

---

## 2. Is "all JS with no framework" a good approach?

### What works well

**Low dependency surface.** No React, no Vue, no Angular to upgrade. The codebase won't break because a framework released a major version. For a tool maintained by a small team this is a real advantage.

**Web Components are a stable standard.** `customElements`, `connectedCallback`, shadow-DOM (even if you're using light DOM) — these are native browser APIs. They won't be deprecated.

**Vite is excellent.** Fast HMR, native ESM, tree-shaking. The build toolchain is modern and well-maintained.

**Performance ceiling is high.** Vanilla JS can be faster than any framework because there is no virtual DOM diffing overhead. A canvas with 50 elements moving in real time will generally be smoother than the equivalent in a framework-heavy app.

### What creates risk

**`innerHTML` as the primary rendering primitive.** Almost every component rebuilds its HTML by assigning to `innerHTML`. This works but has two compounding problems:

1. It destroys and recreates DOM nodes on every re-render, breaking event listeners and triggering layout reflow unnecessarily.
2. The HistoryManager stores full `innerHTML` snapshots. With a complex 10-page document that can be 500 KB–2 MB of HTML per snapshot × 10 states = up to 20 MB in memory just for history.

**DOM as source of truth.** State is persisted in `el.dataset.ctState`. This makes it easy to read the current state of any element but also means serialisation/deserialisation happens constantly (JSON.stringify / JSON.parse on every property change). It also makes it harder to write unit tests because tests need a DOM environment.

**No reactive data layer.** Property changes in the panel don't automatically propagate to the canvas element. Each tool manually reads inputs, calls update functions, and re-renders. This works at current scale but becomes error-prone as tools grow — it's easy to miss a sync path and end up with stale UI.

**No component lifecycle management.** Because components self-render via `innerHTML`, there is no diffing. Adding a small property (e.g. one color value) re-renders the full panel HTML, destroying focus state and scroll position.

---

## 3. Probability of the system freezing

### Risk rating: **Medium — and very predictable**

The system will not freeze randomly. When it freezes, it will freeze in one of four known scenarios:

**Scenario A — Large HistoryManager snapshots.** If a user works on a heavy document (many images embedded as base64 data URIs) and hits 10 undo steps, the browser heap fills with large strings. Chrome's GC will pause the main thread. This becomes visible as 200–500 ms freezes when snapshotting or restoring.

*Mitigation: implement structural diffing in HistoryManager instead of full innerHTML snapshots. Store only the changed element's serialised state, not the whole page.*

**Scenario B — `html2canvas` on export.** `html2canvas` works by re-drawing the DOM to a canvas pixel by pixel. On a high-res multi-page document this can block the main thread for 3–8 seconds. The UI is frozen during this time.

*Mitigation: move export to a Web Worker + OffscreenCanvas, or use the browser's native `Page.printToPDF` via headless Chrome on the backend.*

**Scenario C — Icon picker with MaterialSymbolsPack.** The full Material Symbols set is thousands of SVG strings registered in one `registerPack()` call. If this is done eagerly at startup it adds 1–2 seconds to load time and occupies significant memory.

*Mitigation: lazy-load icon packs on first picker open; virtualise the picker grid so only visible icons are rendered.*

**Scenario D — PHP + SQLite under concurrent write load.** SQLite with WAL mode handles concurrent reads well, but concurrent writes still serialize. Under high API traffic (hundreds of req/s writing logs) the `BUSY_TIMEOUT = 5000 ms` kicks in and responses queue. The file-based JSONL logging already avoids the most frequent write path, which is good.

*Mitigation: already partially done (moved logs to JSONL files). Consider moving to MySQL/Postgres when traffic exceeds ~100 concurrent users.*

---

## 4. Should we migrate to a modern stack?

### Honest answer: partially yes, not a full rewrite

A full rewrite carries enormous risk for a working product. The right move is a **targeted modernisation** of the highest-risk layer: the state and rendering model. The PHP + SQLite backend is fine for the current scale and does not need to change.

---

## 5. Recommended modernisation plan

### Phase 1 — Fix the biggest freeze risks (no stack change)

These are pure refactors within the existing Vanilla JS codebase, low risk, high impact.

**1a. HistoryManager: diff-based snapshots**
Instead of `pagesWrapper.innerHTML`, snapshot only the changed element's `dataset.ctState`. Store an array of `{elementId, before, after}` diffs. Memory usage drops from ~2 MB per snapshot to <1 KB. Undo/redo becomes instantaneous.

**1b. Export: move to a Worker**
Move the `html2canvas` call to a `SharedWorker` with `OffscreenCanvas`. The main thread stays responsive during export. Show a real progress bar instead of a frozen UI.

**1c. Icon picker: virtualise**
Use a simple virtual scroll implementation (or the lightweight `lit-virtualizer` if you want a dependency) so only the ~20 visible icons render at a time, not the full 3,000+.

**1d. SessionManager: compress localStorage**
Use `CompressionStream` (available in all modern browsers) to compress the session HTML before writing to `localStorage`. A 500 KB session becomes ~80 KB. This reduces the risk of hitting the 5–10 MB `localStorage` quota on heavy documents.

---

### Phase 2 — Adopt a reactive layer for panels only (optional, 3–6 months)

The biggest ergonomic pain is the panel rendering pattern. Migrate tool property panels to **Lit** (Google's thin Web Components wrapper — 5 KB gzipped) or **Preact Signals** (2 KB). Keep the canvas elements as vanilla Custom Elements; only the sidebar panels get reactive rendering.

**Why Lit specifically:**

- It is literally a thin wrapper over Web Components, so it has zero conceptual overhead for a team already using Custom Elements.
- It adds declarative templating with `html`` ` template literals — familiar syntax, no JSX.
- It does fine-grained DOM patching instead of full `innerHTML` replacement, which eliminates the focus/scroll-reset problems.
- Bundle size impact is minimal (~5 KB).
- Adoption is incremental — one panel at a time, no big-bang migration.

**Why not React or Vue:**

- React requires JSX, a different mental model, and its synthetic event system conflicts with Custom Elements (React 19 fixes some of this, but the friction is still real).
- Vue is excellent but adds ~30 KB and the Options/Composition API split is unfamiliar to a Vanilla JS team.
- Both frameworks assume they own the DOM. Your canvas Custom Elements own their own DOM. That creates constant integration friction.

---

### Phase 3 — Backend: PostgreSQL when traffic demands it

Keep PHP. Swap SQLite for PostgreSQL via the same PDO interface. The `db.php` abstraction already isolates the DSN change to one line. Only do this when you have real concurrency evidence (>50 concurrent writers, or BUSY_TIMEOUT errors in logs).

---

## 6. Summary table

| Area | Current risk | Recommended action | Stack change? |
|------|-------------|-------------------|---------------|
| HistoryManager | High (memory, freeze) | Diff-based snapshots | No |
| Export (html2canvas) | High (UI freeze) | OffscreenCanvas + Worker | No |
| Icon picker | Medium (slow first open) | Virtual scroll + lazy load | No |
| Session storage | Medium (quota overflow) | CompressionStream | No |
| Panel rendering | Low (ergonomic debt) | Migrate to Lit (incremental) | Minimal (Lit) |
| Canvas elements | Low | Keep as Vanilla Custom Elements | No |
| PHP + SQLite | Low (current scale) | Keep; add Postgres migration path | No |
| Build toolchain (Vite) | None | Keep | No |

---

## 7. What not to do

**Do not rewrite the canvas engine in React/Vue.** The drag, resize, snap, and export interactions are deeply tied to direct DOM manipulation and `dataset` state. Wrapping that in a virtual DOM would add complexity without benefit.

**Do not add TypeScript to the whole codebase at once.** If you want types, adopt JSDoc `@param` type annotations first — Vite and VSCode understand them natively. Then gradually add `.d.ts` files for the public API of each module. This gives 80 % of the TypeScript benefit with none of the build pipeline disruption.

**Do not switch ORMs.** The current `repo.php` generic helpers (`repoList`, `repoFind`, `repoInsert`, etc.) are cleaner and more explicit than most PHP ORMs. Adding Doctrine or Eloquent here would be over-engineering.

---

## 8. Verdict

The current stack is **sound for its purpose**. It is not about to collapse. The real risk is not "wrong technology" but two specific implementation patterns: innerHTML-based full snapshots in HistoryManager, and synchronous main-thread export. Fix those two and the system is stable for the foreseeable future.

If the team wants to modernise the developer experience, adopt Lit for the panel layer incrementally. It is the smallest possible change that gives the largest ergonomic gain. Everything else can wait until traffic or feature complexity justifies it.

---

_Last updated: 2026-07-14_
