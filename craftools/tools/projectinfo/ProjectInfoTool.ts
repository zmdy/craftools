/**
 * ProjectInfoTool — panel-only tool backing the "Informações do projeto"
 * sidebar entry (Configurações section, index.html). Lets the user edit
 * the current project's title, per-language description, author,
 * thumbnail, and free-form notes -- all persisted into the .craftools file
 * on export via ExportTool.ts's 'project' case reading ProjectMetaStore.
 *
 * State lives in ProjectMetaStore.ts (a small in-memory singleton, new
 * alongside this tool -- nothing like it existed before). This panel is a
 * thin, hand-rolled view over that store: every input writes straight
 * through on 'input'/'change' (no separate "save" step), same as every
 * other hand-rolled panel in this app (SettingsTool.ts's enhance section,
 * AlbumWizard.ts's snap controls).
 *
 * Registered in Editor.ts's PANEL_SETUP_MAP under the 'projectinfo' key,
 * following the SettingsTool.setup(editor) reference pattern: reads/writes
 * #panel-title and #panel-body directly, no own DOM root beyond that.
 */

import { I18n } from '../../settings/Translations.js';
import { ProjectMetaStore } from '../../utils/ProjectMetaStore.js';
import { VERSION } from '../../utils/Version.js';

const t = (key: string): string => I18n.t('projectInfoTool.' + key);

/** Locales offered for the per-language description fields, matching I18n's three supported locales. */
const DESCRIPTION_LOCALES: Array<{ code: string; label: string }> = [
  { code: 'pt-br', label: 'PT-BR' },
  { code: 'en',    label: 'EN-US' },
  { code: 'es',    label: 'ES-ES' },
];

export class ProjectInfoTool {

  public static setup(_editor: unknown): void {
    const panelTitle = document.getElementById('panel-title');
    const panelBody  = document.getElementById('panel-body');

    if (panelTitle) panelTitle.textContent = t('panelTitle');
    if (!panelBody) return;

    ProjectInfoTool._render(panelBody);
  }

  private static _fieldLabelStyle = 'display:block; font-size:12px; font-weight:600; color:var(--text-primary); margin-bottom:6px;';
  private static _inputStyle = 'width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:var(--bg-input); color:var(--text-primary); font-family:"DM Sans", sans-serif; font-size:13px;';
  private static _hintStyle = 'font-size:11px; color:var(--text-muted); margin-top:4px;';

  private static _render(panelBody: HTMLElement): void {
    const state = ProjectMetaStore.get();

    panelBody.innerHTML = `
      <div style="padding:14px; display:flex; flex-direction:column; gap:18px;">

        <div>
          <label style="${ProjectInfoTool._fieldLabelStyle}">${t('fieldTitle')}</label>
          <input type="text" id="pi-title" style="${ProjectInfoTool._inputStyle}" value="${ProjectInfoTool._escapeAttr(state.title)}" placeholder="${t('fieldTitlePlaceholder')}">
        </div>

        <div>
          <label style="${ProjectInfoTool._fieldLabelStyle}">${t('fieldThumbnail')}</label>
          <div style="display:flex; align-items:center; gap:12px;">
            <div id="pi-thumb-preview" style="width:72px; height:54px; border-radius:8px; overflow:hidden; background:var(--bg-input); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              ${state.thumbnail
                ? `<img src="${state.thumbnail}" alt="" style="width:100%; height:100%; object-fit:cover; display:block;">`
                : `<span class="material-symbols-outlined" style="font-size:22px; color:var(--text-muted);">image</span>`}
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <button type="button" id="pi-thumb-upload-btn" class="craftools-topbtn" style="padding:6px 12px; font-size:12px; border-radius:6px; cursor:pointer; background:transparent; border:1px solid var(--border); color:var(--text-secondary);">${t('fieldThumbnailUpload')}</button>
              ${state.thumbnail ? `<button type="button" id="pi-thumb-clear-btn" style="padding:0; border:none; background:none; color:var(--text-muted); font-size:11px; text-align:left; cursor:pointer; text-decoration:underline;">${t('fieldThumbnailClear')}</button>` : ''}
            </div>
            <input type="file" id="pi-thumb-file" accept="image/*" style="display:none;">
          </div>
          <p style="${ProjectInfoTool._hintStyle}">${t('fieldThumbnailHint')}</p>
        </div>

        <div>
          <label style="${ProjectInfoTool._fieldLabelStyle}">${t('fieldDescription')}</label>
          <p style="${ProjectInfoTool._hintStyle}; margin-top:-2px; margin-bottom:8px;">${t('fieldDescriptionHint')}</p>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${DESCRIPTION_LOCALES.map(loc => `
              <div>
                <span style="font-size:10px; font-weight:700; color:var(--text-muted); letter-spacing:0.5px;">${loc.label}</span>
                <textarea id="pi-desc-${loc.code}" data-lang="${loc.code}" rows="2" style="${ProjectInfoTool._inputStyle}; resize:vertical; margin-top:3px;" placeholder="${t('fieldDescriptionPlaceholder')}">${ProjectInfoTool._escapeHtml(state.description[loc.code] ?? '')}</textarea>
              </div>
            `).join('')}
          </div>
        </div>

        <div>
          <label style="${ProjectInfoTool._fieldLabelStyle}">${t('fieldAuthor')}</label>
          <input type="text" id="pi-author" style="${ProjectInfoTool._inputStyle}" value="${ProjectInfoTool._escapeAttr(state.author)}" placeholder="${t('fieldAuthorPlaceholder')}">
        </div>

        <div>
          <label style="${ProjectInfoTool._fieldLabelStyle}">${t('fieldVersion')}</label>
          <input type="text" id="pi-version" style="${ProjectInfoTool._inputStyle}; opacity:0.7; cursor:not-allowed;" value="${ProjectInfoTool._escapeAttr(VERSION)}" readonly disabled>
          <p style="${ProjectInfoTool._hintStyle}">${t('fieldVersionHint')}</p>
        </div>

        <div>
          <label style="${ProjectInfoTool._fieldLabelStyle}">${t('fieldNotes')}</label>
          <textarea id="pi-notes" rows="4" style="${ProjectInfoTool._inputStyle}; resize:vertical;" placeholder="${t('fieldNotesPlaceholder')}">${ProjectInfoTool._escapeHtml(state.notes)}</textarea>
        </div>

      </div>
    `;

    ProjectInfoTool._bindEvents(panelBody);
  }

  private static _bindEvents(panelBody: HTMLElement): void {
    panelBody.querySelector<HTMLInputElement>('#pi-title')
      ?.addEventListener('input', (e) => {
        ProjectMetaStore.update({ title: (e.target as HTMLInputElement).value });
      });

    panelBody.querySelector<HTMLInputElement>('#pi-author')
      ?.addEventListener('input', (e) => {
        ProjectMetaStore.update({ author: (e.target as HTMLInputElement).value });
      });

    panelBody.querySelector<HTMLTextAreaElement>('#pi-notes')
      ?.addEventListener('input', (e) => {
        ProjectMetaStore.update({ notes: (e.target as HTMLTextAreaElement).value });
      });

    panelBody.querySelectorAll<HTMLTextAreaElement>('textarea[id^="pi-desc-"]').forEach(textarea => {
      textarea.addEventListener('input', () => {
        const lang = textarea.dataset.lang!;
        ProjectMetaStore.setDescriptionForLang(lang, textarea.value);
      });
    });

    const thumbInput = panelBody.querySelector<HTMLInputElement>('#pi-thumb-file');
    panelBody.querySelector<HTMLButtonElement>('#pi-thumb-upload-btn')
      ?.addEventListener('click', () => thumbInput?.click());

    thumbInput?.addEventListener('change', () => {
      const file = thumbInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUri = reader.result as string;
        ProjectMetaStore.update({ thumbnail: dataUri });
        ProjectInfoTool._render(panelBody); // re-render to show the new preview + "clear" link
      };
      reader.readAsDataURL(file);
    });

    panelBody.querySelector<HTMLButtonElement>('#pi-thumb-clear-btn')
      ?.addEventListener('click', () => {
        ProjectMetaStore.update({ thumbnail: '' });
        ProjectInfoTool._render(panelBody);
      });
  }

  private static _escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  private static _escapeAttr(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
