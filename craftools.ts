/**
 * craftools.ts — TypeScript entry-point class for CrafTools.
 *
 * Full TypeScript implementation of the Craftools runtime (the legacy
 * craftools.js this once wrapped via strangler-fig delegation is gone --
 * the whole class body below is the real, only implementation now).
 *
 * Phase 2 contract:
 *   - `tools` — array of BaseTool subclasses. Each class's registeredKeys are
 *     used to filter ToolRegistry.subset(). Omit to use all registered tools.
 *   - `ui`    — BaseUI subclass constructor. Defaults to StandardSidebarUI.
 */

import { Craftools_Setup }   from './craftools/components/Setup.js';
// Editor.js (the legacy pre-migration file this ".ts" extension used to
// guard against) no longer exists -- craftools/components/Editor.ts is the
// only implementation on disk. The explicit ".ts" extension is kept only
// because it already works and touching it isn't worth the risk; new code
// should use the standard ".js"-suffixed convention (see every other import
// in this file), which Vite/tsc resolve to the real ".ts" source.
import { Craftools_Editor }  from './craftools/components/Editor.ts';
import { Craftools_Element } from './craftools/components/Element.js';
// Registers every built-in field handler (text, number, color, slider, etc.)
// into FieldRegistry -- required before PropertyRenderer can render ANY
// panel. Per its own header comment, fields/index.ts was meant to be
// imported "once, e.g. in main.ts or craftools.ts" -- that import was never
// actually added, so FieldRegistry stayed empty and every field type logged
// "No handler for field type" instead of rendering.
import './craftools/utils/fields';
import { I18n }              from './craftools/settings/Translations.js';
import { SessionManager }    from './craftools/utils/SessionManager.js';
import { HistoryManager }    from './craftools/utils/HistoryManager.js';
import { ToolRegistry }      from './craftools/utils/ToolRegistry';
import { StandardSidebarUI } from './craftools/ui/StandardSidebarUI';
import type { BaseTool }     from './craftools/tools/BaseTool';
import type { BaseUI }       from './craftools/ui/BaseUI';

export const VERSION = '0.1.0';

// ── Config ────────────────────────────────────────────────────────────────────

export interface CraftoolsConfig {
  /**
   * Tool classes to activate. If omitted, all registered tools are used.
   * Each class must have called ToolRegistry.register() (done at import time
   * via the self-registration pattern).
   *
   * Example:
   *   import { TextTool } from './craftools/tools/text/TextTool';
   *   new Craftools('#embed', { tools: [TextTool] });
   */
  tools?: (typeof BaseTool)[];

  /**
   * UI driver class. Defaults to StandardSidebarUI.
   * Provide any BaseUI subclass to swap the entire panel layout.
   */
  ui?: new (wrapper: HTMLElement) => BaseUI;
}

// ── Craftools ─────────────────────────────────────────────────────────────────

export class Craftools {
  wrapper!: HTMLElement;
  screen!: typeof Craftools_Setup | typeof Craftools_Editor;
  components!: (typeof Craftools_Setup | typeof Craftools_Editor | typeof Craftools_Element)[];
  // Set from the 'craftools-start' CustomEvent's `detail.media` (Setup.ts) --
  // this is the WHOLE media-type config object (`{ sizes: [...], icon }`),
  // not the media type's string key. Shape must match the `CraftoolsApp`
  // global augmentation in PageTool.ts (window.craftoolsApp.activeMedia),
  // since this class instance is assigned directly to window.craftoolsApp
  // below. Was mistyped as `string` here while this file was under
  // `@ts-nocheck` -- PageTool.ts/AlbumWizard.ts always read `.sizes` off it
  // correctly at runtime, only the type annotation was wrong.
  activeMedia?: { sizes: Array<{ name: string; size: string; sizeUnit: string }> };
  activeSize?: unknown;

  /** Active tool definitions (filtered by config.tools if provided). */
  private _activeTools!: ReturnType<typeof ToolRegistry.all>;
  /** UI driver instance. */
  private _ui!: BaseUI;

  constructor(wrapper: string | HTMLElement, config: CraftoolsConfig = {}) {
    // Resolve wrapper
    if (!this._setWrapper(wrapper)) return;

    I18n.init();

    // ── Tool filtering ───────────────────────────────────────────────────────
    if (config.tools && config.tools.length > 0) {
      const keys = config.tools.flatMap(t => (t as typeof BaseTool & { registeredKeys?: string[] }).registeredKeys ?? []);
      this._activeTools = ToolRegistry.subset(keys);
    } else {
      this._activeTools = ToolRegistry.all();
    }

    // ── UI driver ────────────────────────────────────────────────────────────
    const UIClass  = config.ui ?? StandardSidebarUI;
    this._ui       = new UIClass(this.wrapper);

    // ── Component system ───────────────────────────────────────────────────
    (window as Window & { craftoolsApp?: Craftools }).craftoolsApp = this;

    this.components = [Craftools_Setup, Craftools_Editor, Craftools_Element];
    this.screen     = Craftools_Setup;

    this._initComponents();
    this._renderComponent();

    // Navigation events
    //
    // Two distinct shapes share this one event (both dispatched by
    // Setup.ts): the size-wizard's `{ media, size }` (renderSizes()'s
    // "media-btn" click) and the sample-projects gallery's `{ sampleBlob }`
    // (renderHome()'s _loadSample()) -- a sample has no media/size
    // selection of its own (every page's real size lives inside its own
    // .craftools content, restored by ProjectSerializer.importProject()
    // below), so `sampleBlob` and `media`/`size` are mutually exclusive in
    // practice, but the handler doesn't assume that: it always does the
    // common screen-swap first, then layers the sample import on top if
    // present.
    this.wrapper.addEventListener('craftools-start', (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        media?: { sizes: Array<{ name: string; size: string; sizeUnit: string }> };
        size?: unknown;
        sampleBlob?: Blob;
      };
      this.activeMedia = detail.media;
      this.activeSize  = detail.size as any;
      (window as Window & { craftoolsSize?: unknown }).craftoolsSize = detail.sampleBlob
        // Same fallback _checkSessionRecovery() below uses for a restored
        // session with no media/size context of its own -- Editor.render()
        // only reads `.size`/`.sizeUnit` to size the transient placeholder
        // page it creates before ProjectSerializer.importProject() below
        // reconciles the real, sample-provided page sizes over it.
        ? ({ size: '*', sizeUnit: 'px', key: 'sample' } as any)
        : (detail.size as any);
      this.screen = Craftools_Editor;
      HistoryManager.clear();
      this._renderComponent();

      if (detail.sampleBlob) {
        this._loadSampleProject(detail.sampleBlob);
      }
    });

    this._checkSessionRecovery();
    this._loadCustomFonts();
  }

  // ── Accessors ────────────────────────────────────────────────────────────────

  get activeTools() { return this._activeTools; }
  get ui()          { return this._ui; }

  // ── Private — component system ───────────────────────────────────────────────

  private _setWrapper(wrapper: string | HTMLElement): boolean {
    try {
      const el = wrapper instanceof HTMLElement
        ? wrapper
        : document.querySelector<HTMLElement>(wrapper as string);
      if (el) {
        this.wrapper = el;
        return true;
      }
    } catch (err) {
      console.error(`[Craftools] Invalid wrapper: "${wrapper}"`, err);
    }
    return false;
  }

  private _setWrapperContent(content: HTMLElement | string): void {
    this.wrapper.innerHTML = '';
    if (content instanceof HTMLElement) {
      this.wrapper.appendChild(content);
    } else {
      this.wrapper.innerHTML = content;
    }
  }

  private _initComponents(): void {
    this.components.forEach(c => c.init());
  }

  private _renderComponent(): void {
    // NOTE: this used to derive the tag name from this.screen.name (the
    // runtime class name, e.g. "Craftools_Setup" -> "craftools-setup").
    // That silently breaks in a minified production build, where the
    // minifier mangles class names (e.g. down to "a") -- document.createElement()
    // then creates a bogus, unregistered element instead of the real
    // <craftools-setup>/<craftools-editor>, leaving the app blank with no
    // console error. Both classes now expose an explicit TAG_NAME constant
    // instead, which minification does not touch (see Setup.ts/Editor.ts).
    const el = document.createElement(this.screen.TAG_NAME);
    this._setWrapperContent(el);
  }

  // ── Private — sample-project loading ─────────────────────────────────────────

  /**
   * Hydrates a freshly-mounted Craftools_Editor with a sample project
   * (Setup.ts's renderHome() gallery). Mirrors _checkSessionRecovery()'s own
   * "restore" branch below and Editor.ts's `#project-import-file` handler
   * (its own manual "Importar Projeto" flow) -- same
   * ProjectSerializer.importProject() call, same _reattachAllPageEvents()
   * + HistoryManager.snapshot() follow-up, just triggered from the setup
   * screen instead of an in-editor file picker.
   *
   * Blocks interaction (see _showSampleLoadingOverlay()) for the whole
   * import instead of just rendering the editor and letting
   * ProjectSerializer.importProject() run in the background: the Editor
   * mounts with a transient 100%-sized placeholder page (the same '*'
   * fallback _checkSessionRecovery()'s "restore" button uses) until the
   * real, sample-provided page is reconciled in -- a user who clicked
   * "Nova Página" (PageTool.addNewPage(), which clones whatever the CURRENT
   * last page is) during that window got a clone of the still-placeholder
   * page instead of the real one, which -- being percentage-sized inside a
   * flex column with no fixed height of its own -- visually collapses to
   * no defined size, and (being effectively 0×0) also swallows clicks
   * meant to open Page Settings/the page-nav footer strip.
   */
  private _loadSampleProject(blob: Blob): void {
    const overlay = this._showSampleLoadingOverlay();

    // _renderComponent() above synchronously appends <craftools-editor> to
    // the DOM, and its connectedCallback()/render() build #pages-wrapper
    // synchronously too -- but the same defensive setTimeout()
    // _checkSessionRecovery()'s "restore" button uses is kept here rather
    // than assumed, so a future change to that render path (e.g. an async
    // step) can't silently turn this into a no-op.
    setTimeout(async () => {
      const pagesWrapper = document.querySelector<HTMLElement>('#pages-wrapper');
      if (!pagesWrapper) { overlay.remove(); return; }

      try {
        const { ProjectSerializer } = await import('./craftools/utils/ProjectSerializer.js');
        await ProjectSerializer.importProject(pagesWrapper, blob);

        const editor = document.querySelector('craftools-editor') as HTMLElement & {
          _reattachAllPageEvents?: (w: HTMLElement) => void;
        };
        editor?._reattachAllPageEvents?.(pagesWrapper);

        // Sync window.craftoolsSize to the sample's REAL first-page size,
        // read straight off the just-reconciled DOM the same way
        // PageTool.openPageSettings() itself parses "current size"
        // (`pageEl.style.width` / `.minHeight`) -- SessionManager.
        // restoreSession() does the equivalent for a restored autosave via
        // its own persisted `sizeConfig`. Without this, craftoolsSize would
        // stay pinned at the '*' placeholder forever even after real,
        // correctly-sized content replaced the placeholder page, leaving
        // anything that reads it later (e.g. a future page-add/size-preset
        // path) looking at stale data.
        const firstPage = pagesWrapper.querySelector<HTMLElement>('.craftools-page');
        if (firstPage) {
          const widthRaw  = firstPage.style.width || '';
          const heightRaw = firstPage.style.minHeight || '';
          const unitMatch = widthRaw.match(/[a-z%]+$/i);
          const unit = unitMatch ? unitMatch[0] : 'px';
          const w = parseFloat(widthRaw);
          const h = parseFloat(heightRaw);
          if (!Number.isNaN(w) && !Number.isNaN(h)) {
            (window as Window & { craftoolsSize?: unknown }).craftoolsSize =
              { size: `${w},${h}`, sizeUnit: unit, key: 'sample' } as any;
          }
        }

        HistoryManager.snapshot(pagesWrapper);
        SessionManager.markDirty();
      } catch (err) {
        console.error('[Craftools] Failed to load sample project:', err);
        const { Notify } = await import('./craftools/utils/Notify.js');
        Notify.toast(I18n.t('setup.sampleLoadError'), 'error');
      } finally {
        overlay.remove();
      }
    }, 150);
  }

  /**
   * Full-viewport, non-dismissable overlay shown for the duration of
   * _loadSampleProject()'s import -- see that method's header comment for
   * why blocking interaction (not just showing a spinner alongside a
   * clickable editor) matters here. Appended to `document.body` (like
   * _checkSessionRecovery()'s overlay below) rather than `this.wrapper`, so
   * it survives `_setWrapperContent()` clearing/replacing the wrapper's
   * contents on the screen swap that already happened just before this is
   * called.
   */
  private _showSampleLoadingOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'craftools-sample-loading-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 14px;
      font-family: 'DM Sans', sans-serif;
    `;
    overlay.innerHTML = `
      <style>
        @keyframes ct-sample-spin { to { transform: rotate(360deg); } }
        #craftools-sample-loading-overlay .ct-spinner {
          width: 40px; height: 40px; border-radius: 50%;
          border: 3px solid rgba(255,255,255,0.25);
          border-top-color: #f97316;
          animation: ct-sample-spin 0.7s linear infinite;
        }
      </style>
      <div class="ct-spinner"></div>
      <p style="color:#fff; font-size:13px; margin:0;">${I18n.t('setup.loadingSample')}</p>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  // ── Private — session recovery ───────────────────────────────────────────────

  private _checkSessionRecovery(): void {
    const session = SessionManager.getSavedSession();
    // SessionManager.saveNow() has written the lightweight `state` format
    // (StateSerializer) for a while now and no longer populates `html` --
    // this check was never updated after that migration, so `session.html`
    // is always undefined and the recovery prompt never fired again, even
    // though autosave itself was writing valid sessions to localStorage the
    // whole time. `restoreSession()` below already accepts either shape.
    if (!session?.html && !session?.state) return;

    const ts        = new Date(session.timestamp);
    const localeMap: Record<string, string> = { 'pt-br': 'pt-BR', 'es': 'es-ES', 'en': 'en-US' };
    const dateStr   = ts.toLocaleDateString(localeMap[I18n.currentLang] ?? 'en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const overlay = document.createElement('div');
    overlay.id = 'craftools-recovery-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.65); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      animation: ct-fadein 0.25s ease;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes ct-fadein   { from { opacity:0; transform: scale(0.96); } to { opacity:1; transform: scale(1); } }
        @keyframes ct-modal-in { from { opacity:0; transform: translateY(20px) scale(0.97); } to { opacity:1; transform: translateY(0) scale(1); } }
        #ct-recovery-modal { animation: ct-modal-in 0.3s cubic-bezier(.22,1,.36,1); }
      </style>
      <div id="ct-recovery-modal" style="
        background: var(--bg-panel, #1e1e2e);
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 20px; padding: 36px 40px; max-width: 440px; width: 90%;
        box-shadow: 0 32px 80px rgba(0,0,0,0.5); text-align: center;
        font-family: 'DM Sans', sans-serif;
      ">
        <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#f97316,#fb923c);
          display:flex;align-items:center;justify-content:center;margin:0 auto 20px;
          box-shadow:0 8px 24px rgba(249,115,22,0.3);">
          <span class="material-symbols-outlined" style="font-size:28px;color:#fff;">history</span>
        </div>
        <h2 style="font-family:'DM Serif Display',serif;font-size:22px;font-weight:700;
          color:var(--text-primary,#fff);margin:0 0 8px;">${I18n.t('sessionRecovery.title')}</h2>
        <p style="font-size:13px;color:var(--text-secondary,rgba(255,255,255,0.6));margin:0 0 6px;line-height:1.6;">
          ${I18n.t('sessionRecovery.message')}
        </p>
        <p style="font-size:12px;color:var(--text-muted,rgba(255,255,255,0.4));margin:0 0 28px;">
          ${I18n.t('sessionRecovery.savedAt')}
          <strong style="color:var(--accent,#f97316);">${dateStr}</strong>
        </p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button id="ct-recovery-new" style="
            padding:10px 22px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,0.1));
            background:transparent;color:var(--text-secondary,rgba(255,255,255,0.6));
            font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all 0.2s;"
            onmouseover="this.style.background='rgba(255,255,255,0.06)'"
            onmouseout="this.style.background='transparent'">
            ${I18n.t('sessionRecovery.newProject')}
          </button>
          <button id="ct-recovery-restore" style="
            padding:10px 24px;border-radius:10px;border:none;
            background:linear-gradient(135deg,#f97316,#fb923c);
            color:#fff;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;
            cursor:pointer;box-shadow:0 4px 16px rgba(249,115,22,0.35);transition:all 0.2s;"
            onmouseover="this.style.transform='translateY(-1px)'"
            onmouseout="this.style.transform='translateY(0)'">
            <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px;">restore</span>
            ${I18n.t('sessionRecovery.restoreSession')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const dismiss = () => overlay.remove();

    overlay.querySelector('#ct-recovery-new')!.addEventListener('click', () => {
      SessionManager.clearSaved();
      dismiss();
    });

    overlay.querySelector('#ct-recovery-restore')!.addEventListener('click', () => {
      dismiss();
      const win = window as Window & { craftoolsSize?: unknown };
      win.craftoolsSize = (session as { sizeConfig?: unknown }).sizeConfig
        ?? ({ size: '*', sizeUnit: 'px', key: 'recovered' } as any);
      this.screen = Craftools_Editor;
      this._renderComponent();
      setTimeout(() => {
        const pagesWrapper = document.querySelector<HTMLElement>('#pages-wrapper');
        if (pagesWrapper && (session.html || session.state)) {
          SessionManager.restoreSession(session, pagesWrapper);
          const editor = document.querySelector('craftools-editor') as HTMLElement & {
            _reattachAllPageEvents?: (w: HTMLElement) => void;
          };
          if (editor?._reattachAllPageEvents) {
            editor._reattachAllPageEvents(pagesWrapper);
          }
          setTimeout(() => HistoryManager.snapshot(pagesWrapper), 200);
        }
      }, 150);
    });
  }

  // ── Private — font loading ───────────────────────────────────────────────────

  private _loadCustomFonts(): void {
    const req = indexedDB.open('CraftoolsFonts', 1);

    req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('fonts')) {
        db.createObjectStore('fonts');
      }
    };

    req.onsuccess = (e: Event) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('fonts')) return;

      const tx      = db.transaction('fonts', 'readonly');
      const store   = tx.objectStore('fonts');
      const getAll  = store.getAll();
      const getKeys = store.getAllKeys();

      getAll.onsuccess = () => {
        getKeys.onsuccess = async () => {
          const win = window as Window & { __craftoolsCustomFonts?: Record<string, boolean> };
          win.__craftoolsCustomFonts = win.__craftoolsCustomFonts ?? {};

          const keys    = getKeys.result as string[];
          const buffers = getAll.result  as ArrayBuffer[];

          for (let i = 0; i < keys.length; i++) {
            const fontName = keys[i];
            const buffer   = buffers[i];
            try {
              const fontFace   = new FontFace(fontName, buffer);
              const loadedFace = await fontFace.load();
              document.fonts.add(loadedFace);
              win.__craftoolsCustomFonts[fontName] = true;
            } catch (err) {
              console.error('[Craftools] Failed to load custom font from DB:', fontName, err);
            }
          }
        };
      };
    };
  }
}
