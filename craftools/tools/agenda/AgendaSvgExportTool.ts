/**
 * AgendaSvgExportTool.ts
 *
 * "Exportar para SVG" panel — EXPERIMENTAL. Currently offers a single
 * sub-option ("Exportar Agenda"), rendering the Agenda's first few output
 * pages to individually downloaded .svg files via AgendaSvgExport.ts
 * (@tooooools/html-to-svg), instead of the browser's print-to-PDF pipeline
 * AgendaExportTool.ts uses. This exists purely so real page content can be
 * tested against that library's actual fidelity -- see AgendaSvgExport.ts's
 * header comment for what it does and doesn't support yet.
 *
 * Deliberately minimal compared to AgendaExportTool.ts (no Pages/Preview
 * tabs) -- it reuses whatever repeat/alternate config was already set up
 * there (stored directly on each `.craftools-page` as data attributes, so
 * it persists regardless of which panel is open), and only adds a small
 * "how many pages to test" field on top.
 */
import { I18n }    from '../../settings/Translations.js';
import { Notify }  from '../../utils/Notify';
import { ToolRegistry } from '../../utils/ToolRegistry';
import './AgendaSvgExportTool_Translations.js';

const a = (key: string): string => I18n.t('agendaSvgExportTool.' + key);

export class AgendaSvgExportTool {

  public static setup(editor: HTMLElement): void {
    const panelTitle = document.getElementById('panel-title');
    const panelBody  = document.getElementById('panel-body');
    if (panelTitle) panelTitle.textContent = a('panelTitle');
    if (!panelBody) return;

    const pageCount = editor.querySelectorAll('.craftools-page').length;

    panelBody.innerHTML = `
      <div id="agenda-svg-root">
        <div style="display:flex; gap:8px; align-items:flex-start; background:rgba(249,115,22,0.1); border:1px solid rgba(249,115,22,0.3); border-radius:8px; padding:10px; margin-bottom:14px;">
          <span class="material-symbols-outlined" style="font-size:16px; color:#f97316;">science</span>
          <span style="font-size:11.5px; color:var(--text-secondary);">${a('experimentalNotice')}</span>
        </div>

        <p style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">${a('agendaIntro')}</p>

        ${!pageCount ? `<p style="font-size:12px; color:var(--text-secondary);">${a('noPagesFound')}</p>` : `
          <div class="ct-field" style="margin-bottom:14px;">
            <span class="craftools-label">${a('pageCountLabel')}</span>
            <input type="number" class="craftools-input" id="agenda-svg-page-count" min="1" max="20" value="1" style="width:100%;">
            <div class="help-text" style="font-size:10.5px; color:var(--text-muted); margin-top:4px;">${a('pageCountHint')}</div>
          </div>

          <button type="button" id="agenda-svg-export-btn" class="craftools-topbtn" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px;">
            <span class="material-symbols-outlined" style="font-size:18px;">data_object</span>
            ${a('exportButton')}
          </button>
        `}
      </div>
    `;

    const exportBtn  = panelBody.querySelector<HTMLButtonElement>('#agenda-svg-export-btn');
    const countInput = panelBody.querySelector<HTMLInputElement>('#agenda-svg-page-count');

    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        if (!editor.querySelectorAll('.craftools-page').length) {
          Notify.toast(a('noPagesFound'), 'error');
          return;
        }
        const maxOutputPages = Math.max(1, Math.min(20, parseInt(countInput?.value ?? '1', 10) || 1));

        exportBtn.disabled = true;
        const originalHtml = exportBtn.innerHTML;
        exportBtn.innerHTML = `<span class="material-symbols-outlined spin" style="font-size:16px;">progress_activity</span> ${a('generating')}`;
        try {
          const { AgendaSvgExport } = await import('../../utils/AgendaSvgExport.js');
          await AgendaSvgExport.print(editor, { maxOutputPages });
        } catch (err) {
          console.error('[AgendaSvgExportTool] Failed to export Agenda as SVG:', err);
          Notify.toast(a('exportError'), 'error', 6000);
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = originalHtml;
        }
      });
    }
  }
}

// icon matches the sidebar entry (index.html #pwa-sidebar-svg).
ToolRegistry.register({
  key: 'agendasvg',
  label: 'editor.exportSvg',
  icon: 'data_object',
  panelOnly: true,
  showInFooterNav: false,
  category: 'export',
});
