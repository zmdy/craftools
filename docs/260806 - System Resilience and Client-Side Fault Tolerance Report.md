# System Resilience and Client-Side Fault Tolerance Report

**Date:** 2026-08-06  
**Status:** Architectural Specification & Implementation — Production Ready  
**System:** Craftool Studio PWA (Vite / TypeScript / Web Workers / Service Worker)

---

## Executive Summary

Craftool Studio is a 100% browser-based single-page application (PWA) that executes heavy graphics engine operations, vector PDF exports, image pre-cropping (300 DPI), and data-variable replacements directly inside the client's web browser.

Because browser environments are inherently volatile (subject to RAM pressure, network drops, rapid tab switching, Service Worker cache invalidation, and Vite asset hash updates on new deployments), client-side applications can suffer from silent crashes, locked UI panels, or chunk loading failures (`TypeError: Failed to fetch dynamically imported module`).

This report specifies a **Multi-Tier Resilience & Auto-Healing System** for Craftool Studio that guarantees:
1. **Dynamic Chunk Fault Tolerance (`SafeImport.ts`)**: Automatic retries with exponential backoff and cache-busting for lazy-loaded tool modules.
2. **Build Hash Mismatch Auto-Heal**: Automatic detection of 404 chunk errors caused by new deployments, with transparent session draft preservation before auto-reloading.
3. **Storage Quota Protection (`SafeStorage.ts`)**: Catching `QuotaExceededError` in `localStorage` and executing automatic LRU eviction of expired API caches (`craftools_api_cache_*`).
4. **Canvas 2D & Memory Context Recovery**: Auto-handling `contextlost` events on High-DPI Canvas 2D contexts and explicit memory deallocation.
5. **Network / Async Rejection Safety**: Global unhandled promise rejection fallbacks preventing frozen loading UI.
6. **Font Load Timeout & Metric Fallback**: 2.5s font loading race condition fallback to embedded local webfonts (`DMSans`, `DMSerif`).

---

## 1. Vulnerability & Failure Point Matrix

| Failure Point | Root Cause in Browser | Impact on User | Auto-Heal & Resilience Mitigation |
| :--- | :--- | :--- | :--- |
| **1. Dynamic Chunk 404 / New Build Mismatch** | Vite generates new JS hashes on deployment (e.g. `AlbumWizard-C1GisP3M.js` -> `AlbumWizard-T7s5lAOL.js`). Open tabs request non-existent old hashes. | Tool panel fails to open; silent crash or frozen loading spinner. | `safeImport()` retries with backoff + cache-bust. If 404 persists, auto-saves project draft, purges SW cache, and reloads cleanly. |
| **2. Storage Quota Exceeded (`QuotaExceededError`)** | `localStorage` limit reached (~5MB-10MB) due to large project drafts, API caches, or image strings. | `localStorage.setItem()` throws exception; project saving or settings updates break. | `SafeStorage.ts` wrapper with automatic LRU purge of stale API caches (`craftools_api_cache_*`) and temporary logs when quota limit is approached. |
| **3. Canvas 2D Context Loss & High-DPI Memory Exhaustion** | Heavy memory usage during multi-page album export (300 DPI canvas pre-crops) causes browser to revoke Canvas context or discard tab. | Blank image exports, corrupted canvas renders, or tab crash. | Automatic Canvas `contextlost` & `contextrestored` event handlers + explicit 2D context cleanup (`canvas.width=0; canvas.height=0; img.src=''`). |
| **4. Uncaught Async Promise Rejections & Offline API Drops** | Unhandled async promise rejections from API data fetching (`loadPhrases`, `loadGridSizes`) during offline or spotty connection. | UI buttons stay disabled or loading spinners freeze indefinitely. | Global `unhandledrejection` & `window.onerror` listeners + graceful fallback to local cache/mock defaults. |
| **5. Font Load Timeout & Text Metric Drift** | Slow network or ad-blockers block Google Fonts (`FontFace` API), causing fallback to default system serif/sans. | Text box dimensions shift and export layout truncates. | 2.5s `Promise.race` timeout for font loading + automatic fallback to pre-bundled local WOFF fonts (`DMSans`, `DMSerif`). |
| **6. Object URL Memory Leaks (`URL.createObjectURL`)** | `URL.createObjectURL(blob)` called during SVG/PDF exports without `URL.revokeObjectURL(url)`. | Cumulative RAM leakage over long editing sessions. | Centralized Blob URL tracker ensuring auto-revocation after export completion. |
| **7. Service Worker Deadlock / Stale Controller** | Service Worker stays stuck in `waiting` state after deployment, serving stale assets. | App stuck between old JS references and new HTML manifest. | `navigator.serviceWorker` controllerchange listener + explicit `SKIP_WAITING` message dispatch on version change. |

---

## 2. Architecture & System Design

```
+-----------------------------------------------------------------------------------+
|                               CRAFTOOL STUDIO PWA                                 |
|                                                                                   |
|  +--------------------+   Lazy Load Tool    +----------------------------------+  |
|  |     Editor.ts      | ------------------> |          SafeImport.ts           |  |
|  |   (Panel Manager)  |                     |  - Retry (Exponential Backoff)   |  |
|  +--------------------+                     |  - Cache-Bust Query (?v=timestamp)|  |
|           |                                 |  - 404 New Build Detection       |  |
|           | Wrap Setup                      +----------------------------------+  |
|           v                                                  |                    |
|  +--------------------+                                      v                    |
|  |  UIErrorBoundary   | <------------------------- [Module Imported OK?]           |
|  | (Panel Fallback)   |                                 | (No: 404 Hash Error)    |
|  +--------------------+                                 v                         |
|                                             +----------------------------------+  |
|                                             |    Emergency Auto-Restore Hook   |  |
|                                             |  1. Save Draft (sessionStorage)  |  |
|                                             |  2. Purge SW Caches              |  |
|                                             |  3. Reload Page & Restore State  |  |
|                                             +----------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Implementation Specification

### 3.1 Dynamic Importer: `SafeImport.ts`
Centralizes every `import(...)` across the application. When a dynamic chunk fails to load:
1. Retries the import up to 3 times using exponential backoff (200ms, 600ms, 1200ms).
2. Appends `?v=${Date.now()}` query strings on persistent failure to force fresh network fetch.
3. On HTTP 404 (chunk replaced by newer deployment):
   - Automatically serializes active canvas state to `sessionStorage`.
   - Clears stale Service Worker caches (`caches.delete()`).
   - Reloads the application window and restores active project state.

### 3.2 Storage Guard: `SafeStorage.ts`
Wraps `localStorage` and `sessionStorage` methods (`setItem`, `getItem`).
- Detects `QuotaExceededError` or `DOMException.QUOTA_EXCEEDED_ERR`.
- Executes LRU cleanup of expired `craftools_api_cache_*` entries and temporary session logs.
- Ensures project draft saving never crashes due to browser storage limits.

### 3.3 Error Boundary: `UIErrorBoundary.ts`
Wraps panel setup and tool execution.
- If a tool setup fails or times out, replaces frozen loading spinners with a clean error recovery UI:
  `"Não foi possível carregar a ferramenta [Nome]. [Tentar Novamente] [Restaurar Estado]"`.

### 3.4 Background Version Poller: `VersionCheckEngine.ts`
- Polls `public/version.json` generated automatically during Vite builds.
- Notifies the user when a new deployment is published on the server.

---

## 4. Verification & Testing Strategy

1. **TypeScript Type Check**: `npx tsc --noEmit`
2. **Vite Production Build**: `npx vite build`
3. **Simulated Chunk Drop**: Verifying `safeImport` retry and emergency auto-restore on missing module hashes.
4. **Storage Quota Testing**: Verifying `SafeStorage.ts` LRU purge on full storage.
