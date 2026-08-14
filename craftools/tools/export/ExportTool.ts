import { BaseTool } from '../BaseTool.js';
import { ToolRegistry } from '../../utils/ToolRegistry.js';
import { I18n } from '../../settings/Translations.js';
import { Notify } from '../../utils/Notify.js';
import type { PropertySchema } from '../../types/PropertySchema.js';
import './ExportTool_Translations.js';

export class ExportTool extends BaseTool {
  static override getPropertySchema(_element?: HTMLElement): PropertySchema {
    return [];
  }

  static renderPickerPanel(container: HTMLElement, editor: HTMLElement): void {
    const t = (key: string) => I18n.t(`exportTool.${key}`);

    container.innerHTML = `
      <div id="export-hub-root" style="padding:12px; display:flex; flex-direction:column; gap:12px;">
        <div style="margin-bottom:4px;">
          <h3 style="margin:0 0 4px 0; font-size:14px; font-weight:700; color:var(--text-primary);">${t('title')}</h3>
          <p style="margin:0; font-size:11px; color:var(--text-secondary);">${t('subtitle')}</p>
        </div>

        <!-- 1. PDF Rápido (Impressão Nativa) -->
        <div class="export-card" data-mode="pdf-quick" style="
          background:var(--bg-input, #1e1e2e); border:1px solid var(--border, #374151); border-radius:10px; padding:12px;
          display:flex; flex-direction:column; gap:8px; cursor:pointer; transition:all 0.15s ease;
        ">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-outlined" style="font-size:22px; color:#f97316;">print</span>
            <div style="flex:1;">
              <div style="font-size:12px; font-weight:700; color:var(--text-primary);">${t('pdfQuickTitle')}</div>
              <div style="font-size:10px; color:var(--text-muted);">${t('pdfQuickDesc')}</div>
            </div>
          </div>
          <button type="button" class="craftools-pill export-action-btn" data-action="pdf-quick" style="
            width:100%; justify-content:center; gap:6px; padding:6px 12px; background:rgba(249,115,22,0.15); color:#f97316; border-color:rgba(249,115,22,0.3); font-weight:600;
          ">
            <span class="material-symbols-outlined" style="font-size:14px;">print</span>
            ${t('btnExport')}
          </button>
        </div>

        <!-- 2. PDF Vetorial (Gráfica / CMYK) -->
        <div class="export-card" data-mode="pdf-vector" style="
          background:var(--bg-input, #1e1e2e); border:1px solid var(--border, #374151); border-radius:10px; padding:12px;
          display:flex; flex-direction:column; gap:8px; cursor:pointer; transition:all 0.15s ease;
        ">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-outlined" style="font-size:22px; color:#3b82f6;">picture_as_pdf</span>
            <div style="flex:1;">
              <div style="font-size:12px; font-weight:700; color:var(--text-primary);">${t('pdfVectorTitle')}</div>
              <div style="font-size:10px; color:var(--text-muted);">${t('pdfVectorDesc')}</div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; margin-top:2px; font-size:11px; color:var(--text-secondary);" onclick="event.stopPropagation()">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="checkbox" id="pdf-vector-cmyk" checked style="accent-color:var(--accent);">
              <span>Perfil CMYK (Coated FOGRA39)</span>
            </label>
            <p style="margin:2px 0 0 0; font-size:10px; color:var(--text-muted); line-height:1.4;">${t('pdfVectorCropMarksHint')}</p>
          </div>
          <button type="button" class="craftools-pill export-action-btn" data-action="pdf-vector" style="
            width:100%; justify-content:center; gap:6px; padding:6px 12px; background:rgba(59,130,246,0.15); color:#60a5fa; border-color:rgba(59,130,246,0.3); font-weight:600;
          ">
            <span class="material-symbols-outlined" style="font-size:14px;">download</span>
            ${t('btnExport')}
          </button>
        </div>

        <!-- 3. Imagem (PNG / JPG / WebP) -->
        <div class="export-card" data-mode="image" style="
          background:var(--bg-input, #1e1e2e); border:1px solid var(--border, #374151); border-radius:10px; padding:12px;
          display:flex; flex-direction:column; gap:8px; cursor:pointer; transition:all 0.15s ease;
        ">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-outlined" style="font-size:22px; color:#10b981;">image</span>
            <div style="flex:1;">
              <div style="font-size:12px; font-weight:700; color:var(--text-primary);">${t('imageTitle')}</div>
              <div style="font-size:10px; color:var(--text-muted);">${t('imageDesc')}</div>
            </div>
          </div>
          <button type="button" class="craftools-pill export-action-btn" data-action="image" style="
            width:100%; justify-content:center; gap:6px; padding:6px 12px; background:rgba(16,185,129,0.15); color:#34d399; border-color:rgba(16,185,129,0.3); font-weight:600;
          ">
            <span class="material-symbols-outlined" style="font-size:14px;">photo_library</span>
            ${t('btnExport')}
          </button>
        </div>

        <!-- 4. Projeto (.craftools) -->
        <div class="export-card" data-mode="project" style="
          background:var(--bg-input, #1e1e2e); border:1px solid var(--border, #374151); border-radius:10px; padding:12px;
          display:flex; flex-direction:column; gap:8px; cursor:pointer; transition:all 0.15s ease;
        ">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-outlined" style="font-size:22px; color:#a855f7;">folder_zip</span>
            <div style="flex:1;">
              <div style="font-size:12px; font-weight:700; color:var(--text-primary);">${t('projectTitle')}</div>
              <div style="font-size:10px; color:var(--text-muted);">${t('projectDesc')}</div>
            </div>
          </div>
          <button type="button" class="craftools-pill export-action-btn" data-action="project" style="
            width:100%; justify-content:center; gap:6px; padding:6px 12px; background:rgba(168,85,247,0.15); color:#c084fc; border-color:rgba(168,85,247,0.3); font-weight:600;
          ">
            <span class="material-symbols-outlined" style="font-size:14px;">save</span>
            ${t('btnSave')}
          </button>
        </div>

        <!-- 5. Exportação de Agenda -->
        <div class="export-card" data-mode="agenda" style="
          background:var(--bg-input, #1e1e2e); border:1px solid var(--border, #374151); border-radius:10px; padding:12px;
          display:flex; flex-direction:column; gap:8px; cursor:pointer; transition:all 0.15s ease;
        ">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-outlined" style="font-size:22px; color:#ec4899;">auto_stories</span>
            <div style="flex:1;">
              <div style="font-size:12px; font-weight:700; color:var(--text-primary);">${t('agendaTitle')}</div>
              <div style="font-size:10px; color:var(--text-muted);">${t('agendaDesc')}</div>
            </div>
          </div>
          <button type="button" class="craftools-pill export-action-btn" data-action="agenda" style="
            width:100%; justify-content:center; gap:6px; padding:6px 12px; background:rgba(236,72,153,0.15); color:#f472b6; border-color:rgba(236,72,153,0.3); font-weight:600;
          ">
            <span class="material-symbols-outlined" style="font-size:14px;">tune</span>
            ${t('btnConfigure')}
          </button>
        </div>
      </div>
    `;

    // Add hover styles
    container.querySelectorAll<HTMLElement>('.export-card').forEach(card => {
      card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--accent)'; });
      card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--border, #374151)'; });
    });

    // Wire click actions
    container.querySelectorAll<HTMLElement>('.export-action-btn, .export-card').forEach(target => {
      target.addEventListener('click', async (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-mode]');
        if (!btn) return;
        e.stopPropagation();

        const action = btn.dataset.action || btn.dataset.mode;
        if (!action) return;

        switch (action) {
          case 'pdf-quick': {
            const { PdfExport } = await import('../../utils/PdfExport.js');
            PdfExport.print(editor);
            break;
          }
          case 'pdf-vector': {
            // Crop marks/bleed are no longer a per-export toggle here --
            // they're configured per PAGE, in Page Settings' "Marcas de
            // Corte" tab (CropMarks.ts), and PdfVectorExport.ts now reads
            // that config straight off each page's own dataset.
            const cmykOutputIntent = container.querySelector<HTMLInputElement>('#pdf-vector-cmyk')?.checked ?? true;

            const { PdfVectorExport } = await import('../../utils/PdfVectorExport.js');
            await PdfVectorExport.exportAndDownload(editor, { cmykOutputIntent });
            break;
          }
          case 'image': {
            const { ImageExport } = await import('../../utils/ImageExport.js');
            ImageExport.export(editor);
            break;
          }
          case 'project': {
            const defaultTitle = 'Projeto CrafTools';
            const title = window.prompt(t('projectTitlePrompt'), defaultTitle);
            if (title === null) return;

            const finalTitle = title.trim() || defaultTitle;
            const pagesWrapper = editor.querySelector<HTMLElement>('#pages-wrapper')!;
            const dismiss = Notify.toast(I18n.t('editor.generating') || 'Gerando...', 'info', 60_000);

            try {
              const { ProjectSerializer } = await import('../../utils/ProjectSerializer.js');
              const blob = await ProjectSerializer.exportProject(pagesWrapper, finalTitle);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${finalTitle}.craftools`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch (err) {
              console.error('[ExportTool]', err);
              Notify.toast(I18n.t('editor.exportError') || 'Erro ao exportar projeto', 'error');
            } finally {
              dismiss();
            }
            break;
          }
          case 'agenda': {
            const { AgendaExportTool } = await import('../agenda/AgendaExportTool.js');
            AgendaExportTool.setup(editor);
            break;
          }
        }
      });
    });
  }

  static setup(editor: HTMLElement): void {
    const panelTitle = document.getElementById('panel-title');
    const panelBody  = document.getElementById('panel-body');
    if (panelTitle) panelTitle.textContent = I18n.t('exportTool.title') || 'Exportar & Salvar';
    if (panelBody) ExportTool.renderPickerPanel(panelBody, editor);
  }
}

ToolRegistry.register({
  key: 'export',
  label: 'editor.export',
  icon: 'download',
  tool: ExportTool,
  draggable: false,
  showInFooterNav: false,
  category: 'export',
});
