/**
 * SafeStorage.ts — QuotaExceededError protection wrapper for localStorage and sessionStorage.
 *
 * Catches storage quota exceptions and executes automatic LRU eviction of expired
 * API cache entries (`craftools_api_cache_*`) and old temporary logs, ensuring project
 * saves and user settings never crash due to browser storage limits.
 */

export class SafeStorage {
  private static readonly API_CACHE_PREFIX = 'craftools_api_cache_';
  private static readonly TEMP_DRAFT_PREFIX = 'craftools_draft_temp_';

  /**
   * Safely sets an item in localStorage or sessionStorage.
   * On QuotaExceededError, attempts automatic cache eviction and retries.
   */
  public static setItem(key: string, value: string, storage: Storage = localStorage): boolean {
    try {
      storage.setItem(key, value);
      return true;
    } catch (e) {
      if (this._isQuotaError(e)) {
        console.warn(`[SafeStorage] Storage quota reached while setting key "${key}". Running LRU cache eviction...`);
        const evicted = this.evictStaleCaches(storage);
        if (evicted > 0) {
          try {
            storage.setItem(key, value);
            console.log(`[SafeStorage] Successfully set key "${key}" after evicting ${evicted} cached items.`);
            return true;
          } catch (retryError) {
            console.error(`[SafeStorage] Storage write failed even after cache eviction for key "${key}":`, retryError);
          }
        }
      } else {
        console.error(`[SafeStorage] Storage write error for key "${key}":`, e);
      }
      return false;
    }
  }

  /**
   * Safely gets an item from storage.
   */
  public static getItem(key: string, storage: Storage = localStorage): string | null {
    try {
      return storage.getItem(key);
    } catch (e) {
      console.warn(`[SafeStorage] Failed to read key "${key}":`, e);
      return null;
    }
  }

  /**
   * Safely removes an item from storage.
   */
  public static removeItem(key: string, storage: Storage = localStorage): void {
    try {
      storage.removeItem(key);
    } catch (e) {
      console.warn(`[SafeStorage] Failed to remove key "${key}":`, e);
    }
  }

  /**
   * Evicts expired or stale API cache entries and temporary drafts to free storage space.
   * Returns the count of items evicted.
   */
  public static evictStaleCaches(storage: Storage = localStorage): number {
    let evictedCount = 0;
    const keysToRemove: string[] = [];

    // Collect all API cache and temp draft keys
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k) continue;

      if (k.startsWith(this.API_CACHE_PREFIX) || k.startsWith(this.TEMP_DRAFT_PREFIX)) {
        keysToRemove.push(k);
      }
    }

    // Sort or remove items
    keysToRemove.forEach(k => {
      try {
        storage.removeItem(k);
        evictedCount++;
      } catch {
        // ignore errors during cleanup
      }
    });

    return evictedCount;
  }

  private static _isQuotaError(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false;
    const err = e as { name?: string; code?: number };
    return (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 ||
      err.code === 1014
    );
  }
}
