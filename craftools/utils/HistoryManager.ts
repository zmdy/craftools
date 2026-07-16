/**
 * HistoryManager — Singleton for managing undo/redo in CrafTools.
 * Stores up to MAX_STATES full innerHTML snapshots of the pages wrapper.
 * Exposes undo/redo methods and fires 'craftools-history-change' events.
 */

const MAX_STATES = 10;

/** Payload of the 'craftools-history-change' CustomEvent. */
export interface HistoryChangeDetail {
  canUndo: boolean;
  canRedo: boolean;
  count: number;
  max: number;
}

class _HistoryManager {
  private _stack: string[] = [];
  private _index: number = -1;
  private _locked: boolean = false;

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Captures the current page state and pushes it onto the history stack.
   * Any "future" states (redo branch) are discarded on each new action.
   */
  snapshot(pagesWrapper?: HTMLElement | null): void {
    if (this._locked) return;
    if (!pagesWrapper) {
      pagesWrapper = document.querySelector<HTMLElement>('#pages-wrapper');
    }
    if (!pagesWrapper) return;

    const html = pagesWrapper.innerHTML;

    // Skip if identical to the last snapshot (avoids duplicates)
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
  undo(pagesWrapper?: HTMLElement | null): boolean {
    if (!this.canUndo) return false;
    if (!pagesWrapper) pagesWrapper = document.querySelector<HTMLElement>('#pages-wrapper');
    if (!pagesWrapper) return false;

    // If the current state hasn't been snapshotted yet, save it before undoing
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
  redo(pagesWrapper?: HTMLElement | null): boolean {
    if (!this.canRedo) return false;
    if (!pagesWrapper) pagesWrapper = document.querySelector<HTMLElement>('#pages-wrapper');
    if (!pagesWrapper) return false;

    this._index++;
    this._restore(pagesWrapper);
    return true;
  }

  get canUndo(): boolean { return this._index > 0; }
  get canRedo(): boolean { return this._index < this._stack.length - 1; }

  /**
   * Number of states currently stored (0 to maxStates).
   * Used by the UI to display a visible indicator ("7/10").
   */
  get historyCount(): number { return this._stack.length; }

  /** Maximum number of stored states (MAX_STATES). */
  get maxStates(): number { return MAX_STATES; }

  /** Clears the full history stack (e.g. when opening a new project). */
  clear(): void {
    this._stack = [];
    this._index = -1;
    this._emit();
  }

  // ─── Private ─────────────────────────────────────────────────────────

  private _restore(pagesWrapper: HTMLElement): void {
    this._locked = true;
    pagesWrapper.innerHTML = this._stack[this._index];

    // Fire events so Editor can re-attach page interactions for restored pages.
    // (The legacy JS version also destructured window._craftoolsPageTool here
    // but never called it — the event dispatch was always the real mechanism.)
    if (document.querySelector('craftools-editor')) {
      pagesWrapper.querySelectorAll('.craftools-page').forEach(page => {
        pagesWrapper.dispatchEvent(
          new CustomEvent('craftools-page-restored', { bubbles: true, detail: { page } }),
        );
      });
    }

    this._locked = false;
    this._emit();

    // Notify SessionManager about the change
    document.dispatchEvent(new CustomEvent('craftools-history-restored', { bubbles: true }));
  }

  private _emit(): void {
    document.dispatchEvent(
      new CustomEvent<HistoryChangeDetail>('craftools-history-change', {
        bubbles: true,
        detail: {
          canUndo: this.canUndo,
          canRedo: this.canRedo,
          count: this.historyCount,
          max: this.maxStates,
        },
      }),
    );
  }
}

export const HistoryManager = new _HistoryManager();
