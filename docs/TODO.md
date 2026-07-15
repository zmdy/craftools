# CrafTools — Roadmap & Changelog

---

## v0.1 — Released ✅

### Phase 1 — Core Editor
- [X] Album tool with basic image editing (zoom, pan, rotate, filters, smart fill)
- [X] Album business card mode: one image synced across all cells
- [X] Drag text and images onto the canvas page
- [X] Text Tool: copy & paste style button in properties panel
- [X] Export to PDF (via blob URL + window.print — no external library)
- [X] Mobile-first interface (bottom nav + collapsible sidebar)
- [X] i18n system: PT-BR, EN-US, ES-ES (all tools and UI strings)
- [X] Properties sidebar (right panel becomes properties panel on element select)
- [X] Auto-center text in album cells
- [X] Fix footer nav showing buttons before canvas loads
- [X] Album mode: preview of photo size and per-page photo count
- [X] Comic strip / filmstrip album mode
- [X] Custom fonts loaded from PC and persisted via IndexedDB
- [X] Clear pages button in album tool
- [X] Session auto-save to localStorage (30 s interval + debounced on change)
- [X] Session recovery modal on reopen
- [X] Undo / Redo (HistoryManager, up to 10 snapshots)

### Phase 2 — Tools Expansion
- [X] Improved Properties Panel: icons, sections, accordion layout
- [X] Snap engine: element-to-element and edge snapping during drag/resize
- [X] Alignment buttons (left, center, right, top, middle, bottom)
- [X] Shape Tool: rectangles, circles, polygons, stars, lines with fill/stroke
- [X] Paper / Themes Tool: background patterns and color fills
- [X] Icon Tool: vector icons (Material Symbols), recolorable, keyword search
- [X] Emoji Tool: native emoji picker
- [X] Emoji Kitchen Tool: combined emojis via Google API, sequential/random in variables
- [X] QR Code Tool: URL, Wi-Fi, vCard, WhatsApp, Spotify URI support
- [X] Barcode Tool: Code 128, EAN-13, EAN-8, UPC-A
- [X] Calendar Tool: monthly grid with optional holiday markers and grid borders
- [X] Mini Calendar Tool: compact widget, usable as standalone or variable element
- [X] Curved Text Tool: text along a circular/arc SVG path
- [X] Stamp / Seal Tool: circular badge with text on path, center icon and fill
- [X] Image Slicer Tool: slice an image into a configurable grid, export each cell
- [X] Variable Content Tool: dynamic text/image/QR/barcode bound to API phrase collections
- [X] Agenda Export Tool: multi-page PDF export with repeating variable elements and sequential mini calendars
- [X] Generator Tool: select template sizes, canvas auto-resizes in real time
- [X] Font preview in all font selectors (custom fonts + Google Fonts)
- [X] Auto-fit text: element resizes to content on typing (toggle per element)
- [X] Gradient color support for Title and Paragraph text elements
- [X] Export to PNG / JPG (html2canvas, lazy-loaded from CDN)
- [X] Image export dialog: size multiplier (1×, 2×, 3×) and format selection
- [X] Linked element cascade: swap photo / delete across all cells sharing data-linked-id

### Phase 3 — Backend & API
- [X] craftools_api: PHP 8 + SQLite backend (zero-config, file-based)
- [X] Bearer token auth: free / plus / premium tiers
- [X] Phrase collections API (variable content source)
- [X] Album template sizes API (grid presets)
- [X] Emoji Kitchen combos table + import/admin tool
- [X] API access logs: file-based JSONL (no database write on every request)
- [X] Admin panel: login, dashboard, tokens, phrases, phrase collections, album templates, emoji kitchen, bulk import
- [X] Photo upload link system (upload_links)

### Phase 4 — Code Quality & Docs
- [X] All source comments translated from PT-BR to English
- [X] All Portuguese variable names renamed to English
- [X] All hardcoded PT-BR UI strings moved to i18n system
- [X] docs/Testing_Guide.md: ~150 test cases across all tools and browser APIs
- [X] docs/Architecture_Analysis.md: freeze risk analysis + 3-phase modernisation plan
- [X] docs/System_Requirements.md: browser, server and resource cost estimates
- [X] docs/Architecture_Overview.md: component map and data flow

---

## v0.2 — Next

### Session & Project
- [ ] Export / import project as JSON (save/load full canvas state)
- [ ] PWA manifest.json + service worker (true offline support, installable on mobile/desktop)

### Album Improvements
- [ ] Custom album sizes: user-defined presets saved to localStorage
- [ ] Auto landscape/portrait detection (remove manual toggle — system calculates best fit)
- [ ] Repeat any element type across album cells (not just images)
- [ ] Mixed photo sizes in the same album page

### Editor UX
- [ ] Duplicate page
- [ ] Reorder pages via drag-and-drop
- [ ] Multi-element selection (shift-click, marquee drag)
- [ ] Element locking (prevent accidental move/resize)

---

## v0.3 — Planned

### Performance & Architecture
- [ ] HistoryManager: diff-based snapshots (per-element state diffs instead of full innerHTML — reduces memory from ~2 MB/snapshot to <1 KB)
- [ ] Export: move html2canvas to Web Worker + OffscreenCanvas (eliminates main-thread freeze on export)
- [ ] Icon picker: virtualise grid (render only visible rows, not the full icon set)
- [ ] SessionManager: compress localStorage payload with CompressionStream (~80 % size reduction)
- [ ] Panel rendering: migrate property panels to Lit (incremental — eliminates focus/scroll-reset on every re-render)

### New Features
- [ ] Animations: fade-in, slide-in on element enter (applied at export time)
- [ ] Diaries: page-a-day and weekly planner templates
- [ ] Alternative UI skin (see docs/ui3.html overlay-native proposal)

---

## v0.4 — Future

### Platform & Infrastructure
- [ ] Photo upload link tool: external photo submission flow (polaroid, mini-polaroid, 7×5 styles with overlays and backgrounds; email integration)
- [ ] API subscription management UI (user-facing token/plan dashboard)
- [ ] PostgreSQL migration path for craftools_api (swap SQLite DSN in db.php when concurrent write load demands it)
- [ ] Replace Bootstrap CDN with vendored/bundled assets for full offline capability
- [ ] Lazy-load + virtualised icon packs (Lucide, user-uploaded SVG sets)
