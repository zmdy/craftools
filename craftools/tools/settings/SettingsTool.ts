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
import { ToolRegistry } from '../../utils/ToolRegistry.js';
import { PropertyRenderer } from '../../utils/PropertyRenderer.js';
import { ImageEnhancer, type EnhanceProfile } from '../../utils/ImageEnhancer.js';
import { PanelUI } from '../../utils/PanelUI.js';
import { Notify } from '../../utils/Notify.js';
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

    SettingsTool._renderEnhanceSection(panelBody);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.id = 'set-reset';
    resetBtn.className = 'craftools-topbtn';
    resetBtn.style.cssText = 'margin:14px; width:calc(100% - 28px); padding:9px 12px; font-size:12px; border-radius:6px; cursor:pointer; background:transparent; border:1px solid var(--border); color:var(--text-secondary);';
    resetBtn.textContent = s('resetButton');
    resetBtn.addEventListener('click', () => {
      AppSettings.resetAll();
      AppSettings.applyRuntimeDefaults();
      ImageEnhancer.clearCache();
      SettingsTool._render(panelBody);
    });
    panelBody.appendChild(resetBtn);
  }

  private static _renderEnhanceSection(panelBody: HTMLElement): void {
    const cur = AppSettings.getAll();
    const profile = cur.autoEnhanceProfile;
    const refs = cur.autoEnhanceReferences || [];
    const dpiThresholds = cur.dpiQualityThresholds;

    // Every block below uses the SAME classes/padding the schema-driven
    // panels get for free (`.ct-sublabel` group headers, `.ct-field`/
    // `.ct-field--block` rows, `.craftools-label`, `select.craftools-select`,
    // `.ct-field-row` + `.ct-val-badge` sliders, `.craftools-pill` buttons --
    // see PanelUI.ts's field()/slider()/pillGroup() and fields/*.field.ts for
    // the canonical versions this mirrors) -- this whole section used to be
    // built from one-off inline styles (`class="craftools-field"`, a class
    // that doesn't even exist in craftools.css) with its own bespoke
    // gaps/padding, which is why it visually stood apart from every other
    // Settings section instead of reading as one consistent panel.
    const bodyHtml = `
        <!-- Definir Qualidade de Imagem: DPI thresholds used by the Image/Album
             tools' print-quality tabs (ImageQuality.ts's classifyDpi()) -->
        <div class="ct-sublabel">
          <span class="material-symbols-outlined">tune</span>
          ${s('fieldDpiQuality')}
        </div>
        <div class="ct-field ct-field--block">
          <p style="font-size:10px; color:var(--text-secondary); margin:0; text-transform:none; letter-spacing:normal; font-weight:400;">${s('fieldDpiQualityHelp')}</p>
        </div>
        ${SettingsTool._renderDpiSelect('poor', s('dpiLevelPoor'), dpiThresholds.poor)}
        ${SettingsTool._renderDpiSelect('fair', s('dpiLevelFair'), dpiThresholds.fair)}
        ${SettingsTool._renderDpiSelect('good', s('dpiLevelGood'), dpiThresholds.good)}
        ${SettingsTool._renderDpiSelect('excellent', s('dpiLevelExcellent'), dpiThresholds.excellent)}

        <!-- Upload Reference Button & Thumbnails -->
        <div class="ct-sublabel">
          <span class="material-symbols-outlined">auto_fix_high</span>
          ${s('fieldUploadReference')}
        </div>
        <div class="ct-field ct-field--block">
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <label class="craftools-topbtn" style="padding:6px 12px; font-size:11px; gap:6px; cursor:pointer;">
              <span class="material-symbols-outlined" style="font-size:16px;">upload_file</span>
              Adicionar Refer&ecirc;ncia(s)
              <input type="file" id="set-enhance-upload" accept="image/*" multiple style="display:none;">
            </label>
            ${refs.length ? `
              <button type="button" id="set-enhance-analyze" class="craftools-topbtn" style="padding:6px 12px; font-size:11px; gap:6px; background:linear-gradient(135deg,#f97316,#ef4444); color:#fff; border:none; font-weight:700;">
                <span class="material-symbols-outlined" style="font-size:16px;">psychology</span>
                ${s('btnAnalyze')}
              </button>
            ` : ''}
          </div>
          <!-- Thumbnails gallery -->
          <div id="set-enhance-thumbs" style="display:flex; gap:8px; flex-wrap:wrap;">
            ${refs.map((url, idx) => `
              <div style="position:relative; width:48px; height:48px; border-radius:6px; overflow:hidden; border:1px solid var(--border);">
                <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
                <button type="button" class="set-enhance-del-ref" data-idx="${idx}" style="position:absolute; top:2px; right:2px; width:16px; height:16px; border-radius:50%; background:rgba(0,0,0,0.7); color:#fff; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px;">&times;</button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 4 Group Navigation Buttons -- same .ct-field-row.ct-pill-wrap
             convention pill-group.field.ts uses (e.g. the ctxBarMode/
             ctxBarPanelMode pickers above), instead of a bespoke flex row. -->
        <div class="ct-field ct-field--block">
          <div class="ct-field-row" id="set-enhance-group-nav" style="gap:4px; flex-wrap:wrap;">
            <button type="button" class="craftools-pill set-enhance-group-btn active" data-group="global"     style="flex:1; min-width:calc(50% - 4px); justify-content:center;">Ajustes Globais</button>
            <button type="button" class="craftools-pill set-enhance-group-btn"        data-group="shadows"    style="flex:1; min-width:calc(50% - 4px); justify-content:center;">Sombras</button>
            <button type="button" class="craftools-pill set-enhance-group-btn"        data-group="highlights" style="flex:1; min-width:calc(50% - 4px); justify-content:center;">Realces</button>
            <button type="button" class="craftools-pill set-enhance-group-btn"        data-group="midtones"   style="flex:1; min-width:calc(50% - 4px); justify-content:center;">Tons M&eacute;dios</button>
          </div>
        </div>

        <!-- Per-group slider panels (only one visible at a time) -->
        <div id="set-enhance-group-global" class="set-enhance-group-panel" style="display:flex; flex-direction:column; gap:6px;">
          ${SettingsTool._renderSliderField('brightness', s('fieldBrightness'), profile.brightness, -100, 100)}
          ${SettingsTool._renderSliderField('contrast', s('fieldContrast'), profile.contrast, -100, 100)}
          ${SettingsTool._renderSliderField('saturation', s('fieldSaturation'), profile.saturation, -100, 100)}
        </div>
        <div id="set-enhance-group-shadows" class="set-enhance-group-panel" style="display:none; flex-direction:column; gap:6px;">
          ${SettingsTool._renderSliderField('shadows.cyanRed',      'Ciano &ndash; Vermelho', profile.shadows.cyanRed,      -50, 50)}
          ${SettingsTool._renderSliderField('shadows.magentaGreen', 'Magenta &ndash; Verde',  profile.shadows.magentaGreen, -50, 50)}
          ${SettingsTool._renderSliderField('shadows.yellowBlue',   'Amarelo &ndash; Azul',   profile.shadows.yellowBlue,   -50, 50)}
        </div>
        <div id="set-enhance-group-highlights" class="set-enhance-group-panel" style="display:none; flex-direction:column; gap:6px;">
          ${SettingsTool._renderSliderField('highlights.cyanRed',      'Ciano &ndash; Vermelho', profile.highlights.cyanRed,      -50, 50)}
          ${SettingsTool._renderSliderField('highlights.magentaGreen', 'Magenta &ndash; Verde',  profile.highlights.magentaGreen, -50, 50)}
          ${SettingsTool._renderSliderField('highlights.yellowBlue',   'Amarelo &ndash; Azul',   profile.highlights.yellowBlue,   -50, 50)}
        </div>
        <div id="set-enhance-group-midtones" class="set-enhance-group-panel" style="display:none; flex-direction:column; gap:6px;">
          ${SettingsTool._renderSliderField('midtones.cyanRed',      'Ciano &ndash; Vermelho', profile.midtones.cyanRed,      -50, 50)}
          ${SettingsTool._renderSliderField('midtones.magentaGreen', 'Magenta &ndash; Verde',  profile.midtones.magentaGreen, -50, 50)}
          ${SettingsTool._renderSliderField('midtones.yellowBlue',   'Amarelo &ndash; Azul',   profile.midtones.yellowBlue,   -50, 50)}
        </div>

        <!-- Reset button -->
        <div class="ct-field ct-field--block">
          <button type="button" id="set-enhance-reset" class="craftools-pill" style="width:100%; justify-content:center;">Restaurar padr&otilde;es</button>
        </div>
    `;

    const sectionWrap = document.createElement('div');
    sectionWrap.innerHTML = PanelUI.accordion('set-image-enhance', 'auto_fix_high', s('sectionImageEnhance'), bodyHtml, { open: true });
    const sectionEl = (sectionWrap.firstElementChild || sectionWrap) as HTMLElement;
    panelBody.appendChild(sectionEl);

    PanelUI.bindAccordions(panelBody);
    SettingsTool._bindEnhanceSectionEvents(sectionEl, panelBody);
  }

  /** DPI options a user can assign to each of the 4 quality tiers -- matches
   *  the values requested for the "Definir Qualidade de Imagem" selects. */
  private static readonly DPI_OPTIONS = [96, 150, 200, 300, 600];

  /** Same row shape as fields/select.field.ts: `.ct-field` > label + `select.craftools-select`. */
  private static _renderDpiSelect(level: 'poor' | 'fair' | 'good' | 'excellent', label: string, value: number): string {
    const options = SettingsTool.DPI_OPTIONS.map(dpi =>
      `<option value="${dpi}" ${dpi === value ? 'selected' : ''}>${dpi} DPI</option>`
    ).join('');
    return `
      <div class="ct-field">
        <span class="craftools-label">${label}</span>
        <select class="craftools-select set-dpi-threshold-select" data-level="${level}">
          ${options}
        </select>
      </div>
    `;
  }

  /** Same row shape as fields/slider.field.ts / ImageTool.ts's enhance-panel
   *  sliders: `.ct-field` > label + `.ct-field-row` (range input + `.ct-val-badge`). */
  private static _renderSliderField(key: string, label: string, value: number, min = -100, max = 100): string {
    return `
      <div class="ct-field">
        <span class="craftools-label">${label}</span>
        <div class="ct-field-row">
          <input type="range" class="set-enhance-slider" data-key="${key}" min="${min}" max="${max}" value="${value}" style="flex:1;">
          <span class="ct-val-badge">${value}</span>
        </div>
      </div>
    `;
  }

  private static _bindEnhanceSectionEvents(sectionEl: HTMLElement, panelBody: HTMLElement): void {
    // ── DPI quality thresholds ──────────────────────────────────────────────
    sectionEl.querySelectorAll<HTMLSelectElement>('.set-dpi-threshold-select').forEach(select => {
      select.addEventListener('change', () => {
        const level = select.dataset.level as 'poor' | 'fair' | 'good' | 'excellent';
        const value = parseInt(select.value, 10);
        const cur = AppSettings.getAll();
        AppSettings.set({ dpiQualityThresholds: { ...cur.dpiQualityThresholds, [level]: value } });
      });
    });

    // ── Group navigation buttons ──────────────────────────────────────────────
    const groupNav = sectionEl.querySelector<HTMLElement>('#set-enhance-group-nav');
    if (groupNav) {
      const groupBtns  = sectionEl.querySelectorAll<HTMLButtonElement>('.set-enhance-group-btn');
      const groupPanels = sectionEl.querySelectorAll<HTMLElement>('.set-enhance-group-panel');
      groupBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          groupBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const target = btn.dataset.group;
          groupPanels.forEach(p => {
            p.style.display = p.id === `set-enhance-group-${target}` ? 'flex' : 'none';
          });
        });
      });
    }

    // Reset button
    const resetBtn = sectionEl.querySelector<HTMLButtonElement>('#set-enhance-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        AppSettings.set({ autoEnhanceProfile: ImageEnhancer.defaultProfile() });
        ImageEnhancer.clearCache();
        document.dispatchEvent(new CustomEvent('craftools-auto-enhance-update'));
        SettingsTool._render(panelBody);
        Notify.toast('Perfil de melhoria de imagem restaurado para o padrão.', 'info');
      });
    }

    // File upload
    const uploadInput = sectionEl.querySelector<HTMLInputElement>('#set-enhance-upload');
    if (uploadInput) {
      uploadInput.addEventListener('change', async () => {
        const files = Array.from(uploadInput.files || []);
        if (!files.length) return;

        const cur = AppSettings.getAll();
        const existingRefs = cur.autoEnhanceReferences || [];
        const newUrls: string[] = [];

        for (const file of files) {
          const url = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
          newUrls.push(url);
        }

        const updatedRefs = [...existingRefs, ...newUrls];
        AppSettings.set({ autoEnhanceReferences: updatedRefs });

        // Auto analyze new references
        const profile = await ImageEnhancer.analyzeReferences(updatedRefs);
        AppSettings.set({ autoEnhanceProfile: profile });
        ImageEnhancer.clearCache();
        document.dispatchEvent(new CustomEvent('craftools-auto-enhance-update'));

        Notify.toast('Referência(s) adicionada(s) e analisada(s) com sucesso!', 'success');
        SettingsTool._render(panelBody);
      });
    }

    // Analyze button
    const analyzeBtn = sectionEl.querySelector<HTMLButtonElement>('#set-enhance-analyze');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', async () => {
        const cur = AppSettings.getAll();
        const refs = cur.autoEnhanceReferences || [];
        if (!refs.length) {
          Notify.toast('Adicione pelo menos uma imagem de referência para analisar.', 'error');
          return;
        }

        const origHtml = analyzeBtn.innerHTML;
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">sync</span> Analisando...';

        try {
          const profile = await ImageEnhancer.analyzeReferences(refs);
          AppSettings.set({ autoEnhanceProfile: profile });
          ImageEnhancer.clearCache();
          document.dispatchEvent(new CustomEvent('craftools-auto-enhance-update'));

          // Update UI sliders in place
          SettingsTool._updateSlidersUI(sectionEl, profile);
          Notify.toast('Análise de referências concluída! Brilho, contraste e balanço de cores atualizados.', 'success');
        } catch (err) {
          console.error('[SettingsTool] Analysis failed:', err);
          Notify.toast('Ocorreu um erro ao analisar as referências.', 'error');
        } finally {
          analyzeBtn.disabled = false;
          analyzeBtn.innerHTML = origHtml;
        }
      });
    }

    // Delete ref buttons
    sectionEl.querySelectorAll<HTMLElement>('.set-enhance-del-ref').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx!, 10);
        const cur = AppSettings.getAll();
        const refs = [...(cur.autoEnhanceReferences || [])];
        refs.splice(idx, 1);
        AppSettings.set({ autoEnhanceReferences: refs });
        ImageEnhancer.clearCache();
        SettingsTool._render(panelBody);
      });
    });

    // Sliders input
    sectionEl.querySelectorAll<HTMLInputElement>('.set-enhance-slider').forEach(slider => {
      slider.addEventListener('input', () => {
        const keyPath = slider.dataset.key!;
        const val = parseInt(slider.value, 10);
        const cur = AppSettings.getAll();
        const profile = JSON.parse(JSON.stringify(cur.autoEnhanceProfile)) as typeof cur.autoEnhanceProfile;

        if (keyPath.includes('.')) {
          const [zone, field] = keyPath.split('.') as ['shadows' | 'midtones' | 'highlights', 'cyanRed' | 'magentaGreen' | 'yellowBlue'];
          profile[zone][field] = val;
        } else {
          (profile as unknown as Record<string, number>)[keyPath] = val;
        }

        AppSettings.set({ autoEnhanceProfile: profile });
        ImageEnhancer.clearCache();

        // Update value badge label -- the badge is the slider's own next
        // sibling inside their shared `.ct-field-row` (see _renderSliderField()).
        const labelVal = slider.nextElementSibling as HTMLElement | null;
        if (labelVal) labelVal.textContent = String(val);

        // Notify active elements to re-run autoEnhance if active
        document.dispatchEvent(new CustomEvent('craftools-auto-enhance-update'));
      });
    });
  }

  private static _updateSlidersUI(container: HTMLElement, profile: EnhanceProfile): void {
    const updateVal = (key: string, val: number) => {
      const input = container.querySelector<HTMLInputElement>(`.set-enhance-slider[data-key="${key}"]`);
      if (input) {
        input.value = String(val);
        const labelVal = input.nextElementSibling as HTMLElement | null;
        if (labelVal) labelVal.textContent = String(val);
      }
    };

    updateVal('brightness', profile.brightness);
    updateVal('contrast', profile.contrast);
    updateVal('saturation', profile.saturation);

    updateVal('shadows.cyanRed', profile.shadows.cyanRed);
    updateVal('shadows.magentaGreen', profile.shadows.magentaGreen);
    updateVal('shadows.yellowBlue', profile.shadows.yellowBlue);

    updateVal('midtones.cyanRed', profile.midtones.cyanRed);
    updateVal('midtones.magentaGreen', profile.midtones.magentaGreen);
    updateVal('midtones.yellowBlue', profile.midtones.yellowBlue);

    updateVal('highlights.cyanRed', profile.highlights.cyanRed);
    updateVal('highlights.magentaGreen', profile.highlights.magentaGreen);
    updateVal('highlights.yellowBlue', profile.highlights.yellowBlue);
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
      ctxBarPanelMode: cur.ctxBarPanelMode,
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
      case 'ctxBarPanelMode': {
        const mode = value as 'quickEdit' | 'panelShortcuts';
        AppSettings.set({ ctxBarPanelMode: mode });
        // Same immediate-effect event CtxBar.ts already listens for (see
        // ctxBarMode above) -- rebuilds the ctx-bar's own buttons right away.
        document.dispatchEvent(new CustomEvent('craftools-ctxbar-mode-change'));
        // This setting also changes how the PROPERTIES PANEL itself renders
        // (every section as its own accordion vs. one section fully open),
        // not just the ctx-bar's buttons -- so the currently-open panel (if
        // any element is selected) needs a fresh renderPropertiesPanel() too.
        const panelBody = document.getElementById('panel-body');
        const selected  = document.querySelector<HTMLElement>('craftools-element.craftools-selected');
        const toolType  = selected?.getAttribute('data-craftool') ?? '';
        const tool      = toolType ? ToolRegistry.get(toolType)?.tool : undefined;
        if (panelBody && selected && tool) tool.renderPropertiesPanel(panelBody, selected);
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
          // No leading `divider` here (unlike e.g. snap-align-divider above) --
          // pill-group.field.ts already renders its own `label` as a
          // `.craftools-label` above its buttons (see that field's render()),
          // so a same-labeled divider right before it just repeated the same
          // text twice (once with the divider's icon+.ct-sublabel styling,
          // once as the field's own plain label) instead of adding anything.
          {
            type: 'pill-group', key: 'ctxBarMode', label: s('fieldCtxBarMode'), i18nKey: 'settingsTool.fieldCtxBarMode',
            direction: 'vertical',
            options: [
              { value: 'floating', label: s('ctxBarModeFloating'), i18nKey: 'settingsTool.ctxBarModeFloating', icon: 'push_pin' },
              { value: 'fixed',    label: s('ctxBarModeFixed'),    i18nKey: 'settingsTool.ctxBarModeFixed',    icon: 'dock_to_bottom' },
            ],
          },
          {
            type: 'pill-group', key: 'ctxBarPanelMode', label: s('fieldCtxBarPanelMode'), i18nKey: 'settingsTool.fieldCtxBarPanelMode',
            direction: 'vertical',
            options: [
              { value: 'quickEdit',      label: s('ctxBarPanelModeQuickEdit'),      i18nKey: 'settingsTool.ctxBarPanelModeQuickEdit',      icon: 'tune' },
              { value: 'panelShortcuts', label: s('ctxBarPanelModePanelShortcuts'), i18nKey: 'settingsTool.ctxBarPanelModePanelShortcuts', icon: 'view_agenda' },
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
