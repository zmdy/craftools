/**
 * SessionManager — Singleton responsible for:
 *   - Auto-saving the session to localStorage
 *   - Dirty flag + beforeunload lock
 *   - Session recovery when the app is reopened
 *
 * localStorage key: 'craftools-session'
 * Format: { html, timestamp, mediaKey, sizeConfig }
 */

const SESSION_KEY = 'craftools-session';
const AUTOSAVE_INTERVAL_MS = 30_000; // 30 seconds

class _SessionManager {
    constructor() {
        this._dirty = false;
        this._mediaKey = null;
        this._sizeConfig = null;
        this._autosaveTimer = null;
        this._beforeunloadHandler = null;
    }

    // ─── Public API ──────────────────────────────────────────────────────

    /**
     * Initialises the session when the editor is entered.
     * @param {string} mediaKey - media type key (e.g. 'standard', 'album')
     * @param {object} sizeConfig - selected size configuration
     */
    startSession(mediaKey, sizeConfig) {
        this._mediaKey = mediaKey;
        this._sizeConfig = sizeConfig;
        this._dirty = false;
        this._sessionActive = true;

        // Start the autosave timer
        this._startAutosave();

        // Register the beforeunload handler
        this._registerBeforeunload();
    }

    /**
     * Marks the session as dirty (unsaved changes exist).
     * Activates the exit lock and schedules an auto-save.
     */
    markDirty() {
        this._dirty = true;
        // Debounced save triggered 2 s after each change
        this._debouncedSave();
    }

    /**
     * Saves the current page state to localStorage immediately.
     */
    saveNow() {
        const pagesWrapper = document.querySelector('#pages-wrapper');
        if (!pagesWrapper) return;

        try {
            const session = {
                html: pagesWrapper.innerHTML,
                timestamp: Date.now(),
                mediaKey: this._mediaKey,
                sizeConfig: this._sizeConfig
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            this._dirty = false;
        } catch (e) {
            console.error('[SessionManager] Failed to save session:', e);
        }
    }

    /**
     * Clears the saved session (e.g. on PDF export or new project start).
     */
    clearSaved() {
        localStorage.removeItem(SESSION_KEY);
        this._dirty = false;
        this._sessionActive = false;
    }

    /**
     * Returns the saved session metadata, or null if none exists.
     * @returns {object|null}
     */
    getSavedSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    /**
     * Restores a saved session into the editor.
     * @param {object} session - session object from localStorage
     * @param {HTMLElement} pagesWrapper - the pages container element
     */
    restoreSession(session, pagesWrapper) {
        if (!pagesWrapper) pagesWrapper = document.querySelector('#pages-wrapper');
        if (!pagesWrapper || !session?.html) return;

        pagesWrapper.innerHTML = session.html;

        // Set global size state
        if (session.sizeConfig) {
            window.craftoolsSize = session.sizeConfig;
        }

        // Re-attach page events for all restored pages
        pagesWrapper.querySelectorAll('.craftools-page').forEach(page => {
            const evt = new CustomEvent('craftools-page-restored', { bubbles: true, detail: { page } });
            pagesWrapper.dispatchEvent(evt);
        });

        this._dirty = false;
    }

    // ─── Private ─────────────────────────────────────────────────────────

    _startAutosave() {
        if (this._autosaveTimer) clearInterval(this._autosaveTimer);
        this._autosaveTimer = setInterval(() => {
            if (this._dirty) this.saveNow();
        }, AUTOSAVE_INTERVAL_MS);
    }

    _debouncedSave() {
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this.saveNow();
        }, 2000);
    }

    _registerBeforeunload() {
        if (this._beforeunloadHandler) {
            window.removeEventListener('beforeunload', this._beforeunloadHandler);
        }

        this._beforeunloadHandler = (e) => {
            if (!this._sessionActive && !this._dirty) return;
            // Save the session before the tab closes (handles abrupt closures)
            this.saveNow();
            // Show the browser's native "leave page?" dialog
            e.preventDefault();
            e.returnValue = '';
        };

        window.addEventListener('beforeunload', this._beforeunloadHandler);
    }

    stop() {
        if (this._autosaveTimer) {
            clearInterval(this._autosaveTimer);
            this._autosaveTimer = null;
        }
        if (this._debounceTimer) {
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
}

export const SessionManager = new _SessionManager();
