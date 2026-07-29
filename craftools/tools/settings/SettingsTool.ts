/**
 * SettingsTool — panel-only tool backing the "Configurações" sidebar
 * section. Renders controls for every AppSettings.ts field and persists
 * changes immediately (no separate "save" step, mirroring how every other
 * hand-rolled panel in this app -- VariablePanel, AlbumWizard's snap
 * controls -- writes through on every input/change event).
 *
 * Registered in Editor.ts's PANEL_SETUP_MAP under the 'settings' key,
 * following the exact GeneratorTool.setup(editor)/CalendarTool.setup(editor)
 * reference pattern: reads/writes #panel-title and #panel-body directly,
 * no own DOM root beyond that.
 */

import { I18n } from '../../settings/Translations.js';
import { AppSettings, type AppSettingsData } from '../../utils/AppSettings.js';
import { FONTS } from '../../utils/FontList.js';
import { IconLibrary } from '../../utils/IconLibrary.js';
import './SettingsTool_Translations.js';

// Side-effect imports so IconLibrary.getPacks() has something to list --
// same requirement IconTool.ts documents at its own import site.
import '../../utils/icons/MaterialSymbolsPack.js';
import '../../utils/icons/FontAwesomePack.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = Record<string, any>;

const s = (key: string): string => I18n.t('settingsTool.' + key);

export class SettingsTool {

  public static setup(_editor: unknown): void {
    const panelTitle = document.getElementById('panel-title');
    const panelBody  = document.getElementById('panel-body');

    if (panelTitle) panelTitle.textContent = s('panelTitle');
    if (!panelBody) return;

    const settings = AppSettings.getAll();
    panelBody.innerHTML = SettingsTool._render(settings);
    SettingsTool._bind(panelBody);
  }

  // ── HTML ──────────────────────────────────────────────────────────────

  private static _render(cur: AppSettingsData): string {
    const packs: AnyRec[] = (IconLibrary as unknown as AnyRec).getPacks();

    const fontOptions = FONTS.map(f =>
      `<option value="${f}" ${cur.defaultFontFamily === f ? 'selected' : ''}>${f}</option>`
    ).join('');

    const iconPackOptions = packs.map(p =>
      `<option value="${p.id}" ${cur.defaultIconPack === p.id ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    const snapAlignOptions = [
      ['top-left', I18n.t('albumTool.snapTopLeft')],
      ['top-center', I18n.t('albumTool.snapTopCenter')],
      ['top-right', I18n.t('albumTool.snapTopRight')],
      ['center-left', I18n.t('albumTool.snapCenterLeft')],
      ['center-center', I18n.t('albumTool.snapCenterCenter')],
      ['center-right', I18n.t('albumTool.snapCenterRight')],
      ['bottom-left', I18n.t('albumTool.snapBottomLeft')],
      ['bottom-center', I18n.t('albumTool.snapBottomCenter')],
      ['bottom-right', I18n.t('albumTool.snapBottomRight')],
    ].map(([v, label]) => `<option value="${v}" ${cur.defaultSnapAlign === v ? 'selected' : ''}>${label}</option>`).join('');

    return `
      <div style="padding:14px; display:flex; flex-direction:column; gap:18px;">

        <div>
          <div class="ct-sec-label" style="font-size:10px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">${s('sectionText')}</div>

          <div class="ct-field" style="margin-bottom:10px;">
            <span class="craftools-label">${s('fieldFont')}</span>
            <select id="set-font" class="craftools-select" style="width:100%;">${fontOptions}</select>
          </div>

          <div class="ct-field" style="margin-bottom:10px;">
            <span class="craftools-label">${s('fieldFontSize')}</span>
            <input type="number" id="set-fontsize" class="craftools-input" style="width:100%;" min="8" max="200" value="${cur.defaultFontSize}">
          </div>

          <div class="ct-field">
            <span class="craftools-label">${s('fieldTextAlign')}</span>
            <select id="set-textalign" class="craftools-select" style="width:100%;">
              <option value="left" ${cur.defaultTextAlign === 'left' ? 'selected' : ''}>${s('alignLeft')}</option>
              <option value="center" ${cur.defaultTextAlign === 'center' ? 'selected' : ''}>${s('alignCenter')}</option>
              <option value="right" ${cur.defaultTextAlign === 'right' ? 'selected' : ''}>${s('alignRight')}</option>
              <option value="justify" ${cur.defaultTextAlign === 'justify' ? 'selected' : ''}>${s('alignJustify')}</option>
            </select>
          </div>
        </div>

        <div>
          <div class="ct-sec-label" style="font-size:10px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; border-top:1px solid var(--border); padding-top:14px;">${s('sectionCalendar')}</div>

          <label class="ct-field" style="flex-direction:row; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" id="set-weekstart" ${cur.defaultWeekStart === 'sunday' ? 'checked' : ''}>
            <span class="craftools-label" style="margin:0;">${s('fieldWeekStart')}</span>
          </label>
        </div>

        <div>
          <div class="ct-sec-label" style="font-size:10px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; border-top:1px solid var(--border); padding-top:14px;">${s('sectionSnap')}</div>

          <label class="ct-field" style="flex-direction:row; align-items:center; gap:6px; cursor:pointer; margin-bottom:10px;">
            <input type="checkbox" id="set-snap-enabled" ${cur.defaultSnapEnabled ? 'checked' : ''}>
            <span class="craftools-label" style="margin:0;">${s('fieldSnapEnabled')}</span>
          </label>

          <div class="ct-field" id="set-snap-align-wrap" style="${cur.defaultSnapEnabled ? '' : 'display:none;'}">
            <span class="craftools-label">${s('fieldSnapAlign')}</span>
            <select id="set-snap-align" class="craftools-select" style="width:100%;">${snapAlignOptions}</select>
          </div>
        </div>

        <div>
          <div class="ct-sec-label" style="font-size:10px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; border-top:1px solid var(--border); padding-top:14px;">${s('sectionCanvas')}</div>

          <label class="ct-field" style="flex-direction:row; align-items:center; gap:6px; cursor:pointer; margin-bottom:10px;">
            <input type="checkbox" id="set-autocenter" ${cur.defaultAutoCenterOnSelect ? 'checked' : ''}>
            <span class="craftools-label" style="margin:0;">${s('fieldAutoCenter')}</span>
          </label>

          <div class="ct-field">
            <span class="craftools-label">${s('fieldCtxBarMode')}</span>
            <div style="display:flex; gap:6px; margin-top:4px;">
              <label style="display:flex; align-items:center; gap:5px; cursor:pointer; flex:1; padding:7px 10px; border-radius:8px; border:1px solid var(--border); background:${cur.ctxBarMode === 'floating' ? 'var(--bg-input)' : 'transparent'}; transition:background 0.15s;" id="set-ctxmode-floating-label">
                <input type="radio" name="set-ctxbarmode" id="set-ctxmode-floating" value="floating" ${cur.ctxBarMode !== 'fixed' ? 'checked' : ''} style="accent-color:var(--accent,#f97316);">
                <span style="font-size:11px; color:var(--text-primary); line-height:1.2;">
                  <span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle; margin-right:2px;">push_pin</span>
                  ${s('ctxBarModeFloating')}
                </span>
              </label>
              <label style="display:flex; align-items:center; gap:5px; cursor:pointer; flex:1; padding:7px 10px; border-radius:8px; border:1px solid var(--border); background:${cur.ctxBarMode === 'fixed' ? 'var(--bg-input)' : 'transparent'}; transition:background 0.15s;" id="set-ctxmode-fixed-label">
                <input type="radio" name="set-ctxbarmode" id="set-ctxmode-fixed" value="fixed" ${cur.ctxBarMode === 'fixed' ? 'checked' : ''} style="accent-color:var(--accent,#f97316);">
                <span style="font-size:11px; color:var(--text-primary); line-height:1.2;">
                  <span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle; margin-right:2px;">dock_to_bottom</span>
                  ${s('ctxBarModeFixed')}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <div class="ct-sec-label" style="font-size:10px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; border-top:1px solid var(--border); padding-top:14px;">${s('sectionIcons')}</div>

          <div class="ct-field">
            <span class="craftools-label">${s('fieldIconPack')}</span>
            <select id="set-iconpack" class="craftools-select" style="width:100%;">${iconPackOptions}</select>
          </div>
        </div>

        <button type="button" id="set-reset" class="craftools-topbtn" style="margin-top:4px; width:100%; padding:9px 12px; font-size:12px; border-radius:6px; cursor:pointer; background:transparent; border:1px solid var(--border); color:var(--text-secondary);">${s('resetButton')}</button>
      </div>
    `;
  }

  // ── Bindings ──────────────────────────────────────────────────────────

  private static _bind(root: HTMLElement): void {
    const fontSel      = root.querySelector<HTMLSelectElement>('#set-font');
    const fontSizeInp  = root.querySelector<HTMLInputElement>('#set-fontsize');
    const textAlignSel = root.querySelector<HTMLSelectElement>('#set-textalign');
    const weekStartChk = root.querySelector<HTMLInputElement>('#set-weekstart');
    const snapEnabledChk = root.querySelector<HTMLInputElement>('#set-snap-enabled');
    const snapAlignWrap  = root.querySelector<HTMLElement>('#set-snap-align-wrap');
    const snapAlignSel   = root.querySelector<HTMLSelectElement>('#set-snap-align');
    const autoCenterChk      = root.querySelector<HTMLInputElement>('#set-autocenter');
    const ctxModeRadios      = root.querySelectorAll<HTMLInputElement>('input[name="set-ctxbarmode"]');
    const ctxModeFloatingLbl = root.querySelector<HTMLElement>('#set-ctxmode-floating-label');
    const ctxModeFixedLbl    = root.querySelector<HTMLElement>('#set-ctxmode-fixed-label');
    const iconPackSel        = root.querySelector<HTMLSelectElement>('#set-iconpack');
    const resetBtn           = root.querySelector<HTMLButtonElement>('#set-reset');

    fontSel?.addEventListener('change', () => AppSettings.set({ defaultFontFamily: fontSel.value }));

    fontSizeInp?.addEventListener('change', () => {
      const v = parseFloat(fontSizeInp.value);
      AppSettings.set({ defaultFontSize: Number.isFinite(v) && v > 0 ? v : AppSettings.defaults.defaultFontSize });
    });

    textAlignSel?.addEventListener('change', () => {
      AppSettings.set({ defaultTextAlign: textAlignSel.value as AppSettingsData['defaultTextAlign'] });
    });

    weekStartChk?.addEventListener('change', () => {
      AppSettings.set({ defaultWeekStart: weekStartChk.checked ? 'sunday' : 'monday' });
    });

    snapEnabledChk?.addEventListener('change', () => {
      AppSettings.set({ defaultSnapEnabled: snapEnabledChk.checked });
      AppSettings.applyRuntimeDefaults();
      if (snapAlignWrap) snapAlignWrap.style.display = snapEnabledChk.checked ? '' : 'none';
    });

    snapAlignSel?.addEventListener('change', () => {
      AppSettings.set({ defaultSnapAlign: snapAlignSel.value });
      AppSettings.applyRuntimeDefaults();
    });

    autoCenterChk?.addEventListener('change', () => {
      AppSettings.set({ defaultAutoCenterOnSelect: autoCenterChk.checked });
    });

    ctxModeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        const mode = radio.value as 'floating' | 'fixed';
        AppSettings.set({ ctxBarMode: mode });
        // Update visual highlight on the label cards
        if (ctxModeFloatingLbl) ctxModeFloatingLbl.style.background = mode === 'floating' ? 'var(--bg-input)' : 'transparent';
        if (ctxModeFixedLbl)    ctxModeFixedLbl.style.background    = mode === 'fixed'    ? 'var(--bg-input)' : 'transparent';
        // Notify the running CtxBar so it switches mode immediately without requiring a re-select
        document.dispatchEvent(new CustomEvent('craftools-ctxbar-mode-change', { detail: { mode } }));
      });
    });

    iconPackSel?.addEventListener('change', () => {
      AppSettings.set({ defaultIconPack: iconPackSel.value });
    });

    resetBtn?.addEventListener('click', () => {
      AppSettings.resetAll();
      AppSettings.applyRuntimeDefaults();
      const panelBody = document.getElementById('panel-body');
      if (panelBody) {
        panelBody.innerHTML = SettingsTool._render(AppSettings.getAll());
        SettingsTool._bind(panelBody);
      }
    });
  }
}
