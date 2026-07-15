/**
 * craftools.ts — TypeScript entry-point class for CrafTools.
 *
 * Wraps the existing Craftools JS runtime with a typed constructor that accepts
 * CraftoolsConfig so callers can pass specific tool subsets and a custom UI.
 *
 * Migration strategy (strangler-fig):
 *   1. This file re-exports VERSION and the Craftools class (typed).
 *   2. All runtime logic is delegated to craftools.js via dynamic import while
 *      the JS file is still alive. When craftools.js is fully replaced, delete
 *      that delegation and move the implementation here.
 *
 * Phase 2 contract:
 *   - `tools` — array of BaseTool subclasses. Each class's registeredKeys are
 *     used to filter ToolRegistry.subset(). Omit to use all registered tools.
 *   - `ui`    — BaseUI subclass constructor. Defaults to StandardSidebarUI.
 */

import { Craftools_Setup }   from './craftools/components/Setup.js';
import { Craftools_Editor }  from './craftools/components/Editor.js';
import { Craftools_Element } from './craftools/components/Element.js';
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
  screen: typeof Craftools_Setup | typeof Craftools_Editor;
  components: (typeof Craftools_Setup | typeof Craftools_Editor | typeof Craftools_Element)[];
  activeMedia?: string;
  activeSize?: unknown;

  /** Active tool definitions (filtered by config.tools if provided). */
  private _activeTools: ReturnType<typeof ToolRegistry.all>;
  /** UI driver instance. */
  private _ui: BaseUI;

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

    // ── Component system (mirrors craftools.js) ───────────────────────────────
    (window as Window & { craftoolsApp?: Craftools }).craftoolsApp = this;

    this.components = [Craftools_Setup, Craftools_Editor, Craftools_Element];
    this.screen     = Craftools_Setup;

    this._initComponents();
    this._renderComponent();

    // Navigation events
    this.wrapper.addEventListener('craftools-start', (e: Event) => {
      const detail = (e as CustomEvent).detail as { media: string; size: unknown };
      this.activeMedia = detail.media;
      this.activeSize  = detail.size;
      (window as Window & { craftoolsSize?: unknown }).craftoolsSize = detail.size;
      this.screen = Craftools_Editor;
      HistoryManager.clear();
      this._renderComponent();
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
    const name = this.screen.name.toLowerCase().replace('_', '-');
    const el   = document.createElement(name);
    this._setWrapperContent(el);
  }

  // ── Private — session recovery ───────────────────────────────────────────────

  private _checkSessionRecovery(): void {
    // getSavedSession() is typed as `object` (JS); cast to access properties.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = SessionManager.getSavedSession() as any;
    if (!session?.html) return;

    const ts        = new Date(session.timestamp as string);
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
        ?? { size: '*', sizeUnit: 'px', key: 'recovered' };
      this.screen = Craftools_Editor;
      this._renderComponent();
      setTimeout(() => {
        const pagesWrapper = document.querySelector<HTMLElement>('#pages-wrapper');
        if (pagesWrapper && session.html) {
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
