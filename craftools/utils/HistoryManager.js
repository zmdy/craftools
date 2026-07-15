/**
 * HistoryManager — Singleton for managing undo/redo in CrafTools.
 * Stores up to MAX_STATES full innerHTML snapshots of the pages wrapper.
 * Exposes undo/redo methods and fires 'craftools-history-change' events.
 */

const MAX_STATES = 10;

class _HistoryManager {
    constructor() {
        this._stack = [];   // array of HTML strings
        this._index = -1;   // current position in stack
        this._locked = false; // prevent recursive snapshots during restore
    }

    // ─── Public API ──────────────────────────────────────────────────────

    /**
     * Captures the current page state and pushes it onto the history stack.
     * Any "future" states (redo branch) are discarded on each new action.
     */
    snapshot(pagesWrapper) {
        if (this._locked) return;
        if (!pagesWrapper) {
            pagesWrapper = document.querySelector('#pages-wrapper');
        }
        if (!pagesWrapper) return;

        const html = pagesWrapper.innerHTML;

        // Skip if the current state is identical to the last snapshot (avoids duplicates)
        if (this._stack[this._index] === html) return;

        // Discard states ahead of the cursor (cleared after an undo)
        if (this._index < this._stack.length - 1) {
            this._stack = this._stack.slice(0, this._index + 1);
        }

        this._stack.push(html);

        // Enforce the maximum stack size
        if (this._stack.length > MAX_STATES) {
            this._stack.shift();
        }

        this._index = this._stack.length - 1;
        this._emit();
    }

    /** Undoes the last action. Returns true on success. */
    undo(pagesWrapper) {
        if (!this.canUndo) return false;
        if (!pagesWrapper) pagesWrapper = document.querySelector('#pages-wrapper');
        if (!pagesWrapper) return false;

        // If the current state has not been snapshotted yet, save it before undoing
        const currentHtml = pagesWrapper.innerHTML;
        if (this._stack[this._index] !== currentHtml) {
            this.snapshot(pagesWrapper);
        }

        if (this._index <= 0) return false;

        this._index--;
        this._restore(pagesWrapper);
        return true;
    }

    /** Redoes the last undone action. Returns true on success. */
    redo(pagesWrapper) {
        if (!this.canRedo) return false;
        if (!pagesWrapper) pagesWrapper = document.querySelector('#pages-wrapper');
        if (!pagesWrapper) return false;

        this._index++;
        this._restore(pagesWrapper);
        return true;
    }

    get canUndo() { return this._index > 0; }
    get canRedo() { return this._index < this._stack.length - 1; }

    /**
     * Number of states currently stored (0 to maxStates).
     * Used by the UI to display a visible indicator of how close the user
     * is to the history limit (e.g. "7/10").
     */
    get historyCount() { return this._stack.length; }

    /** Maximum number of stored states (MAX_STATES). */
    get maxStates() { return MAX_STATES; }

    /** Clears the full history stack (e.g. when opening a new project). */
    clear() {
        this._stack = [];
        this._index = -1;
        this._emit();
    }

    // ─── Private ─────────────────────────────────────────────────────────

    _restore(pagesWrapper) {
        this._locked = true;
        pagesWrapper.innerHTML = this._stack[this._index];

        // Re-attach page events for any restored pages
        const editor = document.querySelector('craftools-editor');
        if (editor) {
            const { PageTool } = window._craftoolsPageTool || {};
            pagesWrapper.querySelectorAll('.craftools-page').forEach(page => {
                // Fire a custom event so Editor can re-attach if needed
                const evt = new CustomEvent('craftools-page-restored', { bubbles: true, detail: { page } });
                pagesWrapper.dispatchEvent(evt);
            });
        }

        this._locked = false;
        this._emit();

        // Notify SessionManager about the change
        const evt = new CustomEvent('craftools-history-restored', { bubbles: true });
        document.dispatchEvent(evt);
    }

    _emit() {
        const evt = new CustomEvent('craftools-history-change', {
            bubbles: true,
            detail: {
                canUndo: this.canUndo,
                canRedo: this.canRedo,
                count: this.historyCount,
                max: this.maxStates,
            }
        });
        document.dispatchEvent(evt);
    }
}

export const HistoryManager = new _HistoryManager();
