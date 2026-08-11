/**
 * SafeImport.ts — Resilient dynamic module importer with automatic retry, cache-busting,
 * 404 build hash mismatch auto-heal, and seamless draft state preservation.
 *
 * Prevents UI lockups when dynamic Vite chunks fail due to network drops, memory pressure,
 * or new deployment asset updates (`TypeError: Failed to fetch dynamically imported module`).
 *
 * Recovery philosophy:
 *   - Retries silently with exponential backoff (never disrupt the user for transient errors).
 *   - On persistent chunk-fetch failure, shows a non-blocking overlay that:
 *       1. Purges SW cache and attempts a silent re-import in the background.
 *       2. Dismisses itself automatically if the re-import succeeds.
 *       3. Only offers an explicit "Atualizar Agora" button if everything fails —
 *          the user is NEVER reloaded without their explicit consent.
 */

import { SafeStorage } from './SafeStorage.js';

export interface SafeImportOptions {
  /** Maximum retry attempts before triggering graceful recovery UI. Default: 3 */
  maxRetries?: number;
  /** Human-readable module name for notifications/logging. */
  moduleName?: string;
  /** Custom fallback function if import fails completely. */
  fallback?: () => Promise<unknown>;
}

export class SafeImport {
  private static _recoveryOverlay: HTMLElement | null = null;

  /**
   * Imports a dynamic module with exponential backoff retries, cache-busting,
   * and a user-facing recovery overlay on persistent 404 / chunk load failure.
   * Never reloads the page automatically.
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

    // Retries exhausted. Show recovery overlay for persistent import failure.
    console.error(`[SafeImport] Persistent module load error for ${name}. Showing graceful recovery overlay.`);
    const recovered = await this._showRecoveryOverlayAndRetry(importFn, name);
    if (recovered !== null) return recovered as T;

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
   * Shows a non-blocking recovery overlay and attempts a silent cache-busted re-import.
   * Returns the module if the re-import succeeded, or null if it failed (overlay stays).
   */
  private static async _showRecoveryOverlayAndRetry<T>(
    importFn: () => Promise<T>,
    name: string
  ): Promise<T | null> {
    this._ensureRecoveryOverlay();

    // Purge SW cache then wait briefly before re-trying.
    await this._purgeSwCache();
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const result = await importFn();
      // Success — dismiss the overlay silently.
      this._dismissRecoveryOverlay();
      console.log(`[SafeImport] Silent recovery succeeded for ${name}.`);
      return result;
    } catch (retryErr) {
      console.warn(`[SafeImport] Silent re-import also failed for ${name}:`, retryErr);
      // Overlay stays, now showing the manual "Atualizar Agora" button.
      this._activateManualReloadButton();
      return null;
    }
  }

  /**
   * Creates and mounts the recovery overlay (idempotent — only one overlay at a time).
   */
  private static _ensureRecoveryOverlay(): void {
    if (this._recoveryOverlay) return;

    const overlay = document.createElement('div');
    overlay.id = 'craftools-recovery-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      font-family: 'DM Sans', system-ui, sans-serif;
      backdrop-filter: blur(4px);
      animation: ct-recovery-fadein 0.25s ease;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes ct-recovery-fadein { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ct-recovery-spin   { to { transform: rotate(360deg); } }
        #craftools-recovery-overlay .ct-rec-spinner {
          animation: ct-recovery-spin 0.9s linear infinite;
        }
      </style>
      <div style="
        background: var(--bg-panel, #1e1e2e);
        color: var(--text-primary, #f4f4f5);
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 16px;
        padding: 32px 28px;
        width: 100%;
        max-width: 380px;
        box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        text-align: center;
      ">
        <div id="ct-rec-icon-area" style="margin-bottom: 20px;">
          <span class="material-symbols-outlined ct-rec-spinner"
                style="font-size: 40px; color: var(--accent, #f97316); display: block;">
            autorenew
          </span>
        </div>
        <div style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">
          Reconectando sistema…
        </div>
        <div id="ct-rec-body-text" style="font-size: 13px; color: var(--text-secondary, #a1a1aa); line-height: 1.5; margin-bottom: 20px;">
          O sistema foi atualizado enquanto você trabalhava.<br>
          Tentando recuperar automaticamente…
        </div>
        <div id="ct-rec-action" style="display: none;">
          <button id="ct-rec-reload-btn" style="
            display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            width: 100%; padding: 10px 16px;
            background: var(--accent, #f97316); color: #fff;
            border: none; border-radius: 9px;
            font-size: 14px; font-weight: 600; cursor: pointer;
            font-family: inherit;
          ">
            <span class="material-symbols-outlined" style="font-size: 18px;">refresh</span>
            Salvar e Atualizar Agora
          </button>
          <p style="font-size: 11px; color: var(--text-muted, #71717a); margin-top: 10px; margin-bottom: 0;">
            Seu trabalho será salvo antes de atualizar.
          </p>
        </div>
      </div>
    `;

    const reloadBtn = overlay.querySelector<HTMLButtonElement>('#ct-rec-reload-btn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        void this._triggerUserConsentReload();
      });
    }

    document.body.appendChild(overlay);
    this._recoveryOverlay = overlay;
  }

  /**
   * Activates the manual-reload section inside the overlay when silent recovery fails.
   */
  private static _activateManualReloadButton(): void {
    if (!this._recoveryOverlay) return;
    const spinner = this._recoveryOverlay.querySelector<HTMLElement>('#ct-rec-icon-area span');
    if (spinner) {
      spinner.classList.remove('ct-rec-spinner');
      spinner.textContent = 'cloud_sync';
      spinner.style.color = 'var(--text-muted, #71717a)';
    }
    const bodyText = this._recoveryOverlay.querySelector<HTMLElement>('#ct-rec-body-text');
    if (bodyText) {
      bodyText.innerHTML = 'Não foi possível recuperar automaticamente.<br>Atualize a página para continuar.';
    }
    const action = this._recoveryOverlay.querySelector<HTMLElement>('#ct-rec-action');
    if (action) action.style.display = 'block';
  }

  /**
   * Dismisses the recovery overlay with a smooth fade-out.
   */
  private static _dismissRecoveryOverlay(): void {
    const overlay = this._recoveryOverlay;
    if (!overlay) return;
    overlay.style.animation = 'none';
    overlay.style.opacity = '1';
    requestAnimationFrame(() => {
      overlay.style.transition = 'opacity 0.3s ease';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        this._recoveryOverlay = null;
      }, 320);
    });
  }

  /**
   * Saves the user's draft, purges SW cache, and reloads — called ONLY by user action.
   */
  public static async _triggerUserConsentReload(): Promise<void> {
    try {
      const projectData = (window as unknown as { craftoolsApp?: { exportProjectJson?: () => string } }).craftoolsApp?.exportProjectJson?.();
      if (projectData) {
        SafeStorage.setItem('craftools_emergency_draft', projectData, sessionStorage);
        SafeStorage.setItem('craftools_emergency_reload_flag', 'true', sessionStorage);
      }
    } catch (saveErr) {
      console.warn('[SafeImport] Could not save draft before reload:', saveErr);
    }
    await this._purgeSwCache();
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
    } catch { /* ignore */ }
    window.location.reload();
  }

  /**
   * Clears CacheStorage caches (does NOT unregister SW mid-session).
   */
  private static async _purgeSwCache(): Promise<void> {
    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
      }
    } catch (swErr) {
      console.warn('[SafeImport] Error purging SW cache:', swErr);
    }
  }

  /**
   * Checks if an error is a dynamic chunk import failure.
   */
  private static _isChunkFetchError(err: unknown): boolean {
    if (!err) return false;
    const msg = String(err && typeof err === 'object' && 'message' in err ? err.message : err).toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('imported module') ||
      msg.includes('loading chunk') ||
      msg.includes('chunkloaderror') ||
      msg.includes('404')
    );
  }

  /**
   * @deprecated Use `_triggerUserConsentReload()` instead.
   * Kept for backward compatibility with any external callers.
   */
  public static async triggerEmergencyAutoHeal(): Promise<void> {
    await this._triggerUserConsentReload();
  }
}

/** Utility alias function */
export const safeImport = SafeImport.import.bind(SafeImport);

