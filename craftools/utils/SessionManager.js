/**
 * SessionManager — Singleton para gerenciar:
 *   - Auto-save da sessão no localStorage
 *   - Dirty flag + beforeunload lock
 *   - Recovery de sessão ao reabrir o app
 *
 * Chave localStorage: 'craftools-session'
 * Formato: { html, timestamp, mediaKey, sizeConfig }
 */

const SESSION_KEY = 'craftools-session';
const AUTOSAVE_INTERVAL_MS = 30_000; // 30 segundos

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
     * Inicializa a sessão ao entrar no editor.
     * @param {string} mediaKey - chave do tipo de mídia (ex: 'standard', 'album')
     * @param {object} sizeConfig - configuração de tamanho selecionada
     */
    startSession(mediaKey, sizeConfig) {
        this._mediaKey = mediaKey;
        this._sizeConfig = sizeConfig;
        this._dirty = false;

        // Inicia autosave
        this._startAutosave();

        // Registra beforeunload
        this._registerBeforeunload();
    }

    /**
     * Marca sessão como "suja" (há mudanças não confirmadas).
     * Ativa o lock de saída e agenda um auto-save.
     */
    markDirty() {
        this._dirty = true;
        // Auto-save imediato após cada mudança (debounced 2s)
        this._debouncedSave();
    }

    /**
     * Salva o estado atual das páginas no localStorage.
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
            console.error('[SessionManager] Erro ao salvar sessão:', e);
        }
    }

    /**
     * Limpa a sessão salva (ex: ao exportar PDF ou iniciar projeto limpo).
     */
    clearSaved() {
        localStorage.removeItem(SESSION_KEY);
        this._dirty = false;
    }

    /**
     * Verifica se existe uma sessão salva e retorna seus metadados.
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
     * Restaura a sessão salva no editor.
     * @param {object} session - objeto de sessão do localStorage
     */
    restoreSession(session, pagesWrapper) {
        if (!pagesWrapper) pagesWrapper = document.querySelector('#pages-wrapper');
        if (!pagesWrapper || !session?.html) return;

        pagesWrapper.innerHTML = session.html;

        // Configura o estado global de tamanho
        if (session.sizeConfig) {
            window.craftoolsSize = session.sizeConfig;
        }

        // Reattach page events para todas as páginas restauradas
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
            if (!this._dirty) return;
            // Salva a sessão antes de fechar (para o caso de fechamento brusco)
            this.saveNow();
            // Exibe alerta nativo do navegador
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
    }
}

export const SessionManager = new _SessionManager();
