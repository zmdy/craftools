# CrafTools — System Requirements & Resource Costs

> Estimated minimum requirements for running the editor and backend, plus realistic memory and CPU cost projections.

---

## 1. Browser Requirements (frontend)

The editor relies on ES Modules, Custom Elements v1, Canvas 2D API, `localStorage`, `IndexedDB`, and CSS Custom Properties. No WebGL, WebAssembly, WebRTC, ServiceWorker, Geolocation, or Camera API is used.

| Browser | Minimum version |
|---------|----------------|
| Chrome / Edge | 80+ |
| Firefox | 75+ |
| Safari | 14+ |
| iOS Safari | 14+ |
| Samsung Internet | 12+ |

Any device sold after ~2020 running a modern browser meets these requirements.

---

## 2. Network Requirements (startup)

The following external CDNs are loaded on every page load. Without internet access, typography and icons will not render correctly:

| Resource | CDN | When loaded |
|----------|-----|------------|
| Bootstrap 5.3.8 (CSS + JS) | jsdelivr | Startup |
| DM Serif Display, DM Mono, DM Sans, Noto Color Emoji | Google Fonts | Startup |
| Material Symbols Outlined | Google CDN | Startup |
| html2canvas 1.4.1 | Cloudflare CDN | **Lazy — image export only** |

All tool JS modules (~15+ tools) are dynamically imported on first use and are not loaded at startup.

---

## 3. JavaScript Payload

| Asset | Size (unminified source) | Notes |
|-------|--------------------------|-------|
| Total JS source | ~1,170 KB | Across all tool + core modules |
| craftools.css | ~24 KB | Editor stylesheet |
| MaterialSymbolsPack.js | ~67 KB | Largest single file; full SVG path registry |
| QR code library | ~52 KB | Vendored locally (`vendor/qrcode-generator/qrcode.mjs`) |
| PDF export | 0 KB external | Uses `window.print()` via blob URL — no jsPDF |

---

## 4. Estimated Memory Usage (JS heap)

| Scenario | Estimated heap |
|----------|---------------|
| Startup — empty editor, no tools opened | 15–25 MB |
| Active session — 1–3 pages, light images | 30–60 MB |
| Heavy session — 8–10 pages, large base64 images | 80–150 MB |
| During image export (html2canvas peak) | +50–150 MB additional |
| History buffer saturated (10 snapshots, heavy doc) | +20–80 MB additional |

### Primary memory risk: HistoryManager

The HistoryManager stores up to 10 complete `innerHTML` snapshots. In a document with large base64-encoded images embedded, each snapshot can reach 2–8 MB — up to 80 MB just for undo history. This is the main trigger for GC pauses and visible freezes.

**Mitigation:** switch to diff-based snapshots (store only changed element state, not full page innerHTML). See `Architecture_Analysis.md` Phase 1.

---

## 5. Estimated CPU Cost

| Operation | Main thread impact |
|-----------|-------------------|
| Idle (editor open, no interaction) | ~0% — nothing running |
| Element drag / resize | Light — CSS reflow only |
| Undo / redo | Medium — full page innerHTML replacement |
| Icon picker (first open) | Medium-high — registers full MaterialSymbolsPack |
| Auto-save (SessionManager, every 30 s) | Light — `JSON.stringify` + `localStorage.setItem` |
| Dynamic tool import (first use) | Light — lazy ES module load |
| Image export (html2canvas) | **Heavy — blocks main thread 2–8 s per page** |

The only operation that produces a noticeably frozen UI is image export. `html2canvas` runs synchronously on the main thread and re-draws the DOM pixel by pixel. On a high-resolution multi-page document this can block for several seconds.

**Mitigation:** move export to a Web Worker + OffscreenCanvas. See `Architecture_Analysis.md` Phase 1.

---

## 6. Server Requirements (craftools_api)

| Requirement | Detail |
|-------------|--------|
| PHP version | 8.0 or higher |
| PHP extensions | `pdo_sqlite` (required), standard extensions only |
| Database | SQLite — no MySQL / PostgreSQL / Redis needed |
| Writable paths | `storage/logs/api/` (JSONL log files), `database/` (SQLite file) |
| Queue / workers | None required |
| Web server | Any — Apache, Nginx, or PHP built-in server |

**Concurrency ceiling:** SQLite with WAL mode handles concurrent reads well and serialises concurrent writes. Suitable for up to ~50 simultaneous users. If `BUSY_TIMEOUT` errors appear in logs, migrate to PostgreSQL (the `db.php` abstraction isolates the DSN change to one line).

---

## 7. Recommended Minimum Hardware

| Role | RAM | CPU | Storage |
|------|-----|-----|---------|
| End user (browser) | 4 GB | Dual-core 2018+ | N/A |
| Server (PHP + SQLite) | 512 MB | Any modern VPS | ~100 MB + asset uploads |

---

_Last updated: 2026-07-14_
