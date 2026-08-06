/**
 * SafeImport.ts — Resilient dynamic module importer with automatic retry, cache-busting,
 * 404 build hash mismatch auto-heal, and seamless draft state preservation.
 *
 * Prevents UI lockups when dynamic Vite chunks fail due to network drops, memory pressure,
 * or new deployment asset updates (`TypeError: Failed to fetch dynamically imported module`).
 */

import { SafeStorage } from './SafeStorage.js';

export interface SafeImportOptions {
  /** Maximum retry attempts before triggering emergency reload. Default: 3 */
  maxRetries?: number;
  /** Human-readable module name for notifications/logging. */
  moduleName?: string;
  /** Custom fallback function if import fails completely. */
  fallback?: () => Promise<unknown>;
}

export class SafeImport {
  private static isReloading = false;

  /**
   * Imports a dynamic module with exponential backoff retries, cache-busting,
   * and auto-heal page reload on persistent 404 build hash mismatch.
   */
  public static async import<T>(
    importFn: () => Promise<T>,
    options: SafeImportOptions = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    const name = options.moduleName || 'módulo';

    let attempt = 0;
    let lastError: unknown;

    while (attempt < maxRetries) {
      try {
        return await importFn();
      } catch (err) {
        attempt++;
        lastError = err;
        console.warn(`[SafeImport] Attempt ${attempt}/${maxRetries} failed for ${name}:`, err);

        // Exponential backoff delay (200ms, 600ms, 1200ms)
        const delayMs = attempt * 200 * attempt;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Retries exhausted. Check if error is a chunk 404 / module fetch error
    const isChunkError = this._isChunkFetchError(lastError);

    if (isChunkError && !this.isReloading) {
      this.isReloading = true;
      console.error(`[SafeImport] Persistent chunk load error for ${name}. Triggering emergency auto-heal reload...`);
      await this.triggerEmergencyAutoHeal();
    }

    if (options.fallback) {
      try {
        return (await options.fallback()) as T;
      } catch (fallbackErr) {
        console.error(`[SafeImport] Fallback failed for ${name}:`, fallbackErr);
      }
    }

    throw lastError ?? new Error(`Falha ao carregar ${name}.`);
  }

  /**
   * Saves user session draft, purges SW cache, and reloads the browser tab cleanly.
   */
  public static async triggerEmergencyAutoHeal(): Promise<void> {
    try {
      // 1. Serialize active canvas/project draft to sessionStorage
      const projectData = (window as unknown as { craftoolsApp?: { exportProjectJson?: () => string } }).craftoolsApp?.exportProjectJson?.();
      if (projectData) {
        SafeStorage.setItem('craftools_emergency_draft', projectData, sessionStorage);
        SafeStorage.setItem('craftools_emergency_reload_flag', 'true', sessionStorage);
      }
    } catch (saveErr) {
      console.warn('[SafeImport] Could not save emergency draft before reload:', saveErr);
    }

    try {
      // 2. Clear all SW caches
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
      }
      // 3. Unregister active Service Workers to fetch clean assets
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
    } catch (swErr) {
      console.warn('[SafeImport] Error purging SW cache before reload:', swErr);
    }

    // 4. Force reload page
    window.location.reload();
  }

  /**
   * Checks if an error is a dynamic chunk import failure (404, Failed to fetch, ChunkLoadError).
   */
  private static _isChunkFetchError(err: unknown): boolean {
    if (!err) return false;
    const msg = String(err && typeof err === 'object' && 'message' in err ? err.message : err).toLowerCase();
    return (
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('loading chunk') ||
      msg.includes('chunkloaderror') ||
      msg.includes('404')
    );
  }
}

/** Utility alias function */
export const safeImport = SafeImport.import.bind(SafeImport);
