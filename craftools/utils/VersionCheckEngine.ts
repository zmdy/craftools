/**
 * VersionCheckEngine.ts — Background deployment version poller and cache auto-cleaner.
 *
 * Monitors `version.json` on the server to detect new builds/deployments.
 * When a new version is detected, warms up SW cache and notifies the user with
 * a smooth update prompt.
 */

import { Notify } from './Notify.js';

export interface VersionInfo {
  version: string;
  buildTime: number;
}

export class VersionCheckEngine {
  private static currentVersion: string | null = null;
  private static checkInterval: number | null = null;
  private static isUpdateNotified = false;

  /**
   * Starts background monitoring for new deployments.
   */
  public static startMonitoring(intervalMs = 300000): void { // Default: check every 5 minutes
    if (this.checkInterval) return;

    // Check version immediately on init
    this.checkVersion();

    // Check when user returns to tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkVersion();
      }
    });

    // Check when network reconnects
    window.addEventListener('online', () => {
      this.checkVersion();
    });

    this.checkInterval = window.setInterval(() => {
      this.checkVersion();
    }, intervalMs);
  }

  /**
   * Checks `/version.json` on the server.
   */
  public static async checkVersion(): Promise<void> {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;

      const data: VersionInfo = await res.json();
      if (!data || !data.version) return;

      if (this.currentVersion === null) {
        this.currentVersion = data.version;
      } else if (this.currentVersion !== data.version && !this.isUpdateNotified) {
        this.isUpdateNotified = true;
        console.log(`[VersionCheckEngine] New version detected on server: ${data.version} (current: ${this.currentVersion})`);
        this._promptUserForUpdate(data.version);
      }
    } catch (e) {
      // Offline or network error -- ignore silently
    }
  }

  /**
   * Purges old SW caches.
   */
  public static async autoCleanCache(): Promise<void> {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    } catch (e) {
      console.warn('[VersionCheckEngine] Cache auto-clean failed:', e);
    }
  }

  private static _promptUserForUpdate(_newVersion: string): void {
    Notify.show('Nova atualização do Craftool Studio disponível! As alterações serão aplicadas na próxima inicialização.', 'info');
  }
}
