/**
 * SettingsTool — panel-only tool backing the "Configurações" sidebar
 * section. Renders controls for every AppSettings.ts field and persists
 * changes immediately (no separate "save" step, mirroring how every other
 * hand-rolled panel in this app -- VariablePanel, AlbumWizard's snap
 * controls -- writes through on every input/change event).
 *
 * Renders through PropertyRenderer/FieldRegistry -- the same schema-driven
 * engine every element tool (TextTool, ShapeTool, ...) uses for its own
 * properties panel -- instead of hand-rolled <select>/<input type="checkbox">
 * markup, so this panel looks and behaves identically to the rest of the
 * app (font-select's font picker, slider's range+badge, align's pill row,
 * content-align's H/V grid, toggle's switch, collapsible icon accordions).
 *
 * AppSettings is a plain global store, not an element with a real DOM
 * node/dataset.ctState -- PropertyRenderer.render() needs one of those to
 * read/diff state from. This uses the same synthetic/"fake" detached
 * element adapter AlbumWizard.ts's border-section binding already
 * established (see its "Bind: Borders" block): a throwaway <div> whose
 * dataset.ctState is kept in sync via PropertyRenderer.applyChange(), with
 * this file's own onChange() translating each synthetic key back into the
 * real AppSettings.set() call (and, for defaultWeekStart/defaultSnapAlign/
 * ctxBarMode, translating value shape too -- see the mapping helpers below).
 *
 * Registered in Editor.ts's PANEL_SETUP_MAP under the 'settings' key,
 * following the exact GeneratorTool.setup(editor)/CalendarTool.setup(editor)
 * reference pattern: reads/writes #panel-title and #panel-body directly,
 * no own DOM root beyond that.
 */

import { I18n } from '../../settings/Translations.js';
import { AppSettings, type AppSettingsData } from '../../utils/AppSettings.js';
import { IconLibrary } from '../../utils/IconLibrary.js';
import { PropertyRenderer } from '../../utils/PropertyRenderer.js';
import type { PropertySchema } from '../../types/PropertySchema';
import './SettingsTool_Translations.js';

// Side-effect imports so IconLibrary.getPacks() has something to list --
// same requirement IconTool.ts documents at its own import site.
import '../../utils/icons/MaterialSymbolsPack.js';
import '../../utils/icons/FontAwesomePack.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = Record<string, any>;

const s = (key: string): string => I18n.t('settingsTool.' + key);

/**
 * defaultSnapAlign is stored/consumed elsewhere (SnapEngine.ts,
 * window.craftoolsAutoSnapAlign) as a "v-h" string -- 'top-left',
 * 'center-center', 'bottom-right', etc. -- while content-align.field.ts's
 * grid stores/reports the same 9 combinations as an "h-v" string --
 * 'left-top', 'center-center', 'right-bottom'. Both axes use disjoint
 * direction vocabularies (top/center/bottom vs left/center/right) except
 * for the shared 'center', so a straight swap round-trips correctly.
 */
function vhToHv(align: string): string {
  const [v, h] = align.split('-');
  return `${h || 'center'}-${v || 'center'}`;
}
function hvToVh(align: string): string {
  const [h, v] = align.split('-');
  return `${v || 'center'}-${h || 'center'}`;
}

export class SettingsTool {

  public static setup(_editor: unknown): void {
    const panelTitle = document.getElementById('panel-title');
    const panelBody  = document.getElementById('panel-body');

    if (panelTitle) panelTitle.textContent = s('panelTitle');
    if (!panelBody) return;

    SettingsTool._render(panelBody);
  }

  // ── Rendering (schema-driven, via the synthetic-element adapter) ───────

  private static _render(panelBody: HTMLElement): void {
    const cur = AppSettings.getAll();

    panelBody.innerHTML = '';

    PropertyRenderer.renderStateObject(panelBody, SettingsTool._buildSchema(), SettingsTool._toCtState(cur), (key, value) => {
      SettingsTool._applyChange(key, value);
    });

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.id = 'set-reset';
    resetBtn.className = 'craftools-topbtn';
    resetBtn.style.cssText = 'margin:14px; width:calc(100% - 28px); padding:9px 12px; font-size:12px; border-radius:6px; cursor:pointer; background:transparent; border:1px solid var(--border); color:var(--text-secondary);';
    resetBtn.textContent = s('resetButton');
    resetBtn.addEventListener('click', () => {
      AppSettings.resetAll();
      AppSettings.applyRuntimeDefaults();
      SettingsTool._render(panelBody);
    });
    panelBody.appendChild(resetBtn);
  }

  /** Maps real AppSettings data onto the synthetic element's field keys/shapes. */
  private static _toCtState(cur: AppSettingsData): AnyRec {
    return {
      font:            cur.defaultFontFamily,
      fontSize:        cur.defaultFontSize,
      textAlign:       cur.defaultTextAlign,
      weekStartSunday: cur.defaultWeekStart === 'sunday',
      snapEnabled:     cur.defaultSnapEnabled,
      snapAlign:       vhToHv(cur.defaultSnapAlign),
      autoCenter:      cur.defaultAutoCenterOnSelect,
      ctxBarMode:      cur.ctxBarMode,
      allowMultipleAccordions: cur.allowMultipleAccordions,
      iconPack:        cur.defaultIconPack,
    };
  }

  /** Translates one synthetic field change back into a real AppSettings.set() call. */
  private static _applyChange(key: string, value: unknown): void {
    switch (key) {
      case 'font':
        AppSettings.set({ defaultFontFamily: String(value) });
        break;
      case 'fontSize': {
        const v = Number(value);
        AppSettings.set({ defaultFontSize: Number.isFinite(v) && v > 0 ? v : AppSettings.defaults.defaultFontSize });
        break;
      }
      case 'textAlign':
        AppSettings.set({ defaultTextAlign: value as AppSettingsData['defaultTextAlign'] });
        break;
      case 'weekStartSunday':
        AppSettings.set({ defaultWeekStart: value ? 'sunday' : 'monday' });
        break;
      case 'snapEnabled':
        AppSettings.set({ defaultSnapEnabled: Boolean(value) });
        AppSettings.applyRuntimeDefaults();
        break;
      case 'snapAlign':
        AppSettings.set({ defaultSnapAlign: hvToVh(String(value)) });
        AppSettings.applyRuntimeDefaults();
        break;
      case 'autoCenter':
        AppSettings.set({ defaultAutoCenterOnSelect: Boolean(value) });
        break;
      case 'ctxBarMode': {
        const mode = value as 'floating' | 'fixed';
        AppSettings.set({ ctxBarMode: mode });
        // Notify the running CtxBar so it switches mode immediately without
        // requiring a re-select (same event BaseTool/CtxBar already listen for).
        document.dispatchEvent(new CustomEvent('craftools-ctxbar-mode-change', { detail: { mode } }));
        break;
      }
      case 'allowMultipleAccordions':
        AppSettings.set({ allowMultipleAccordions: Boolean(value) });
        break;
      case 'iconPack':
        AppSettings.set({ defaultIconPack: String(value) });
        break;
    }
  }

  // ── Schema ───────────────────────────────────────────────────────────

  private static _buildSchema(): PropertySchema {
    const packs: AnyRec[] = (IconLibrary as unknown as AnyRec).getPacks();

    return [
      {
        section: s('sectionText'),
        i18nKey: 'settingsTool.sectionText',
        icon: 'text_fields',
        fields: [
          { type: 'font-select', key: 'font',     label: s('fieldFont'),     i18nKey: 'settingsTool.fieldFont' },
          { type: 'slider',      key: 'fontSize', label: s('fieldFontSize'), i18nKey: 'settingsTool.fieldFontSize', min: 8, max: 200, step: 1 },
          { type: 'align',       key: 'textAlign' },
        ],
      },
      {
        section: s('sectionCalendar'),
        i18nKey: 'settingsTool.sectionCalendar',
        icon: 'calendar_month',
        fields: [
          { type: 'toggle', key: 'weekStartSunday', label: s('fieldWeekStart'), i18nKey: 'settingsTool.fieldWeekStart' },
        ],
      },
      {
        section: s('sectionSnap'),
        i18nKey: 'settingsTool.sectionSnap',
        icon: 'grid_on',
        fields: [
          { type: 'toggle', key: 'snapEnabled', label: s('fieldSnapEnabled'), i18nKey: 'settingsTool.fieldSnapEnabled' },
          { type: 'divider', key: 'snap-align-divider', label: s('fieldSnapAlign'), i18nKey: 'settingsTool.fieldSnapAlign', icon: 'filter_center_focus' },
          { type: 'content-align', key: 'snapAlign' },
        ],
      },
      {
        section: s('sectionCanvas'),
        i18nKey: 'settingsTool.sectionCanvas',
        icon: 'crop_free',
        fields: [
          { type: 'toggle', key: 'autoCenter', label: s('fieldAutoCenter'), i18nKey: 'settingsTool.fieldAutoCenter' },
          { type: 'toggle', key: 'allowMultipleAccordions', label: s('fieldAllowMultipleAccordions'), i18nKey: 'settingsTool.fieldAllowMultipleAccordions' },
          { type: 'divider', key: 'ctxbar-mode-divider', label: s('fieldCtxBarMode'), i18nKey: 'settingsTool.fieldCtxBarMode', icon: 'dock_to_bottom' },
          {
            type: 'pill-group', key: 'ctxBarMode', label: s('fieldCtxBarMode'), i18nKey: 'settingsTool.fieldCtxBarMode',
            direction: 'vertical',
            options: [
              { value: 'floating', label: s('ctxBarModeFloating'), i18nKey: 'settingsTool.ctxBarModeFloating', icon: 'push_pin' },
              { value: 'fixed',    label: s('ctxBarModeFixed'),    i18nKey: 'settingsTool.ctxBarModeFixed',    icon: 'dock_to_bottom' },
            ],
          },
        ],
      },
      {
        section: s('sectionIcons'),
        i18nKey: 'settingsTool.sectionIcons',
        icon: 'category',
        fields: [
          {
            type: 'select', key: 'iconPack', label: s('fieldIconPack'), i18nKey: 'settingsTool.fieldIconPack',
            options: packs.map(p => ({ value: p.id, label: p.label })),
          },
        ],
      },
    ];
  }
}
