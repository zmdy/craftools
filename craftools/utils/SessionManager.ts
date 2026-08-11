/**
 * SessionManager — Singleton responsible for:
 *   - Auto-saving the session to localStorage
 *   - Dirty flag + beforeunload lock
 *   - Session recovery when the app is reopened
 *
 * localStorage key: 'craftools-session'
 * Format: { html, timestamp, mediaKey, sizeConfig }
 */

import { StateSerializer, type EditorState } from './StateSerializer';

const SESSION_KEY = 'craftools-session';
const AUTOSAVE_INTERVAL_MS = 30_000; // 30 seconds

/** Shape of the object persisted in localStorage under SESSION_KEY. */
export interface SavedSession {
  html?: string;          // Legacy string-based HTML format
  state?: EditorState;    // New lightweight JSON format
  timestamp: number;
  mediaKey: string | null;
  sizeConfig: unknown;
}

/** Shape of the size configuration passed to startSession(). */
export interface SizeConfig {
  key?: string;
  [key: string]: unknown;
}

// window.craftoolsSize is set by PageTool.js / Settings.js
declare global {
  interface Window {
    craftoolsSize?: SizeConfig;
  }
}

class _SessionManager {
  private _dirty: boolean = false;
  private _mediaKey: string | null = null;
  private _sizeConfig: SizeConfig | null = null;
  private _autosaveTimer: ReturnType<typeof setInterval> | null = null;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _beforeunloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
  private _sessionActive: boolean = false;

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Initialises the session when the editor is entered.
   * @param mediaKey  - media type key (e.g. 'standard', 'album')
   * @param sizeConfig - selected size configuration
   */
  startSession(mediaKey: string, sizeConfig?: SizeConfig | null): void {
    this._mediaKey = mediaKey;
    this._sizeConfig = sizeConfig ?? null;
    this._dirty = false;
    this._sessionActive = true;

    this._startAutosave();
    this._registerBeforeunload();
  }

  /**
   * Marks the session as dirty (unsaved changes exist).
   * Schedules a debounced auto-save 2 s after each change.
   */
  markDirty(): void {
    this._dirty = true;
    this._debouncedSave();
  }

  /** Saves the current page state to localStorage immediately. */
  saveNow(): void {
    const pagesWrapper = document.querySelector<HTMLElement>('#pages-wrapper');
    if (!pagesWrapper) return;

    try {
      const state = StateSerializer.serialize(pagesWrapper);
      const session: SavedSession = {
        state,
        timestamp: Date.now(),
        mediaKey: this._mediaKey,
        sizeConfig: this._sizeConfig,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      this._dirty = false;
    } catch (e) {
      console.error('[SessionManager] Failed to save session:', e);
    }
  }

  /** Clears the saved session (e.g. on PDF export or new project start). */
  clearSaved(): void {
    localStorage.removeItem(SESSION_KEY);
    this._dirty = false;
    this._sessionActive = false;
  }

  /** Returns the saved session, or null if none exists. */
  getSavedSession(): SavedSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SavedSession;
    } catch {
      return null;
    }
  }

  /**
   * Restores a saved session into the editor.
   * @param session      - session object from getSavedSession()
   * @param pagesWrapper - the pages container element (defaults to #pages-wrapper)
   */
  restoreSession(session: SavedSession, pagesWrapper?: HTMLElement | null): void {
    if (!pagesWrapper) pagesWrapper = document.querySelector<HTMLElement>('#pages-wrapper');
    if (!pagesWrapper || (!session?.html && !session?.state)) return;

    if (session.state) {
      StateSerializer.reconcile(pagesWrapper, session.state);
    } else if (session.html) {
      // Legacy compatibility
      pagesWrapper.innerHTML = session.html;
    }

    // Restore global size state
    if (session.sizeConfig) {
      window.craftoolsSize = session.sizeConfig as SizeConfig;
    }

    // Re-attach page events for all restored pages
    pagesWrapper.querySelectorAll('.craftools-page').forEach(page => {
      pagesWrapper!.dispatchEvent(
        new CustomEvent('craftools-page-restored', { bubbles: true, detail: { page } }),
      );
    });

    this._dirty = false;
  }

  /** Stops the autosave timer and clears the beforeunload handler. */
  stop(): void {
    if (this._autosaveTimer !== null) {
      clearInterval(this._autosaveTimer);
      this._autosaveTimer = null;
    }
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    if (this._beforeunloadHandler) {
      window.removeEventListener('beforeunload', this._beforeunloadHandler);
      this._beforeunloadHandler = null;
    }
    this._dirty = false;
    this._sessionActive = false;
  }

  // ─── Private ─────────────────────────────────────────────────────────

  private _startAutosave(): void {
    if (this._autosaveTimer !== null) clearInterval(this._autosaveTimer);
    this._autosaveTimer = setInterval(() => {
      if (this._dirty) this.saveNow();
    }, AUTOSAVE_INTERVAL_MS);
  }

  private _debouncedSave(): void {
    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this.saveNow();
    }, 2000);
  }

  private _registerBeforeunload(): void {
    if (this._beforeunloadHandler) {
      window.removeEventListener('beforeunload', this._beforeunloadHandler);
    }

    this._beforeunloadHandler = (e: BeforeUnloadEvent) => {
      // Only block navigation if there are actual unsaved changes.
      // Merely having an active session (no edits) should not trigger the browser dialog.
      if (!this._dirty) return;
      // Save before the tab closes (handles abrupt closures)
      this.saveNow();
      // Show the browser's native "leave page?" dialog
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', this._beforeunloadHandler);
  }
}

export const SessionManager = new _SessionManager();
