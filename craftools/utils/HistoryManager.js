/**
 * HistoryManager — Singleton para gerenciar undo/redo no CrafTools.
 * Armazena até MAX_STATES snapshots do HTML das páginas.
 * Escuta eventos do sistema e expõe métodos undo/redo.
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
     * Captura o estado atual das páginas e empilha no histórico.
     * Descarta qualquer estado "futuro" (redo branch) ao fazer nova ação.
     */
    snapshot(pagesWrapper) {
        if (this._locked) return;
        if (!pagesWrapper) {
            pagesWrapper = document.querySelector('#pages-wrapper');
        }
        if (!pagesWrapper) return;

        const html = pagesWrapper.innerHTML;

        // Se o estado atual é idêntico ao último, não empilha (evita duplicatas)
        if (this._stack[this._index] === html) return;

        // Descarta estados à frente do cursor (após undo)
        if (this._index < this._stack.length - 1) {
            this._stack = this._stack.slice(0, this._index + 1);
        }

        this._stack.push(html);

        // Limita ao máximo
        if (this._stack.length > MAX_STATES) {
            this._stack.shift();
        }

        this._index = this._stack.length - 1;
        this._emit();
    }

    /** Desfaz a última ação. Retorna true se bem-sucedido. */
    undo(pagesWrapper) {
        if (!this.canUndo) return false;
        if (!pagesWrapper) pagesWrapper = document.querySelector('#pages-wrapper');
        if (!pagesWrapper) return false;

        // Se ainda não temos um snapshot do estado atual, salva antes de desfazer
        const currentHtml = pagesWrapper.innerHTML;
        if (this._stack[this._index] !== currentHtml) {
            this.snapshot(pagesWrapper);
        }

        if (this._index <= 0) return false;

        this._index--;
        this._restore(pagesWrapper);
        return true;
    }

    /** Refaz a última ação desfeita. Retorna true se bem-sucedido. */
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

    /** Limpa todo o histórico (ex: ao abrir novo projeto) */
    clear() {
        this._stack = [];
        this._index = -1;
        this._emit();
    }

    // ─── Private ─────────────────────────────────────────────────────────

    _restore(pagesWrapper) {
        this._locked = true;
        pagesWrapper.innerHTML = this._stack[this._index];

        // Re-attach page events for any new pages
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

        // Notify session manager about the change
        const evt = new CustomEvent('craftools-history-restored', { bubbles: true });
        document.dispatchEvent(evt);
    }

    _emit() {
        const evt = new CustomEvent('craftools-history-change', {
            bubbles: true,
            detail: { canUndo: this.canUndo, canRedo: this.canRedo }
        });
        document.dispatchEvent(evt);
    }
}

export const HistoryManager = new _HistoryManager();
