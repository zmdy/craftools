/**
 * AppSettings — Singleton store for global editor defaults, configured via
 * the "Configurações" sidebar panel (SettingsTool.ts) and read by any tool
 * that wants a sensible starting default instead of a hardcoded value.
 *
 * localStorage key: 'craftools-app-settings'
 * Pattern follows SessionManager.ts / UserTemplates.ts: try/catch-wrapped
 * JSON.parse/JSON.stringify, swallow errors and fall back to defaults, no
 * versioning field (additive-only: new fields just merge over DEFAULTS).
 *
 * This is intentionally a plain data store, not a reactive one -- tools read
 * AppSettings.get() once (at element-creation time / setup time), the same
 * way they already read window.craftoolsAutoSnap today. Changing a setting
 * does not retroactively touch existing elements, only future ones.
 */

import { DEFAULT_ENHANCE_PROFILE, type EnhanceProfile } from './ImageEnhancer.js';
import { DEFAULT_DPI_THRESHOLDS, type DpiThresholds } from './ImageQuality.js';

export type WeekStart = 'sunday' | 'monday';

export interface AppSettingsData {
  // Text/title tools
  defaultFontFamily: string;
  defaultFontSize: number;
  defaultTextAlign: 'left' | 'center' | 'right' | 'justify';

  // Calendar / MiniCalendar tools
  defaultWeekStart: WeekStart;

  // Snap & alignment (mirrors window.craftoolsAutoSnap / craftoolsAutoSnapAlign)
  defaultSnapEnabled: boolean;
  defaultSnapAlign: string;

  // Desktop auto-center-on-select (Editor.ts craftools-element-select handler)
  defaultAutoCenterOnSelect: boolean;

  // Icon tool default pack
  defaultIconPack: string;

  // Ctx bar behaviour: 'floating' = coupled to element (current default),
  // 'fixed' = pinned below the top toolbar (Canva-style, wider, up to 16 items)
  ctxBarMode: 'floating' | 'fixed';

  // What the ctx-bar's tool-specific buttons DO (orthogonal to ctxBarMode's
  // POSITION above): 'quickEdit' (default, current behavior) shows each
  // tool's own quick-adjustment buttons (BaseTool.getCtxOptions()) and the
  // properties panel renders every schema section as its own collapsible
  // accordion. 'panelShortcuts' instead shows one button per schema SECTION
  // (icon + title, single-select like the alignment/font-style button rows)
  // -- clicking one makes the properties panel show ONLY that section, fully
  // expanded, instead of the whole accordion stack. See CtxBar.ts's
  // _buildSectionClusters() and BaseTool.ts's _renderSinglePanelSection().
  ctxBarPanelMode: 'quickEdit' | 'panelShortcuts';

  // Properties-panel accordions
  allowMultipleAccordions: boolean;

  // Image Auto-Enhancer Profile & Reference Data
  autoEnhanceProfile: EnhanceProfile;
  autoEnhanceReferences: string[];

  // DPI thresholds used to classify a photo's print quality (Image tool's
  // "Qualidade de Impressão" tab, Album tool's "Qualidade" tab) -- see
  // ImageQuality.ts's classifyDpi(). Configured from the "Aprimoramento de
  // Imagens" settings section's "Definir Qualidade de Imagem" subsection.
  dpiQualityThresholds: DpiThresholds;
}

const STORAGE_KEY = 'craftools-app-settings';

const DEFAULTS: AppSettingsData = {
  defaultFontFamily: 'DM Sans',
  defaultFontSize: 16,
  defaultTextAlign: 'left',
  defaultWeekStart: 'sunday',
  defaultSnapEnabled: true,
  defaultSnapAlign: 'bottom-center',
  defaultAutoCenterOnSelect: true,
  defaultIconPack: 'material-symbols',
  ctxBarMode: 'floating',
  ctxBarPanelMode: 'quickEdit',
  allowMultipleAccordions: true,
  autoEnhanceProfile: { ...DEFAULT_ENHANCE_PROFILE },
  autoEnhanceReferences: [],
  dpiQualityThresholds: { ...DEFAULT_DPI_THRESHOLDS },
};

class _AppSettings {
  private _cache: AppSettingsData | null = null;

  /** Returns the full settings object (defaults merged with any saved overrides). */
  getAll(): AppSettingsData {
    if (this._cache) return this._cache;

    let saved: Partial<AppSettingsData> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) as Partial<AppSettingsData>;
    } catch {
      saved = {};
    }

    this._cache = { ...DEFAULTS, ...saved };
    return this._cache;
  }

  /** Reads a single setting, falling back to its default if unset/corrupted. */
  get<K extends keyof AppSettingsData>(key: K): AppSettingsData[K] {
    return this.getAll()[key];
  }

  /** Persists one or more settings and updates the in-memory cache. */
  set(patch: Partial<AppSettingsData>): void {
    const next = { ...this.getAll(), ...patch };
    this._cache = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('[AppSettings] Failed to save settings:', e);
    }
  }

  /** Resets every setting back to its default value. */
  resetAll(): void {
    this._cache = { ...DEFAULTS };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('[AppSettings] Failed to reset settings:', e);
    }
  }

  /** The static default values, exposed for UI (e.g. "reset to default" per-field). */
  get defaults(): AppSettingsData {
    return DEFAULTS;
  }

  /**
   * Applies the snap/align/auto-center defaults to their existing global
   * flags. Call once at editor startup (Editor.ts render()/connectedCallback)
   * so window.craftoolsAutoSnap etc. reflect the saved settings before any
   * element is dragged or selected.
   */
  applyRuntimeDefaults(): void {
    const s = this.getAll();
    const win = window as unknown as {
      craftoolsAutoSnap?: boolean;
      craftoolsAutoSnapAlign?: string;
    };
    win.craftoolsAutoSnap = s.defaultSnapEnabled;
    win.craftoolsAutoSnapAlign = s.defaultSnapAlign;
  }
}

export const AppSettings = new _AppSettings();
