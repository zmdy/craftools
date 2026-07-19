/**
 * AgendaExportTool.ts
 *
 * "Export Agenda" panel — takes over the entire side panel (like
 * GeradorTool), with 3 accordion tabs:
 *   1. Pages — pick which pages repeat and how many times (stored as a
 *      `data-agenda-repeat="N"` attribute on the `.craftools-page` itself,
 *      persisting for as long as the editor session lasts).
 *   2. Preview — sample of how variables will vary between repetitions
 *      (1st, 2nd and last), without actually generating every page.
 *   3. Actions — summary + "Export Agenda" button, which delegates the
 *      real generation to AgendaExport.ts (dynamic import, only when
 *      actually exporting).
 */
import { I18n } from '../../settings/Translations.js';
import { PanelUI } from '../../utils/PanelUI';
import { Notify } from '../../utils/Notify';
import { VariableEngine, type VariableBinding, type ApiCache } from '../../utils/VariableEngine';
import { PdfExport } from '../../utils/PdfExport';
import { ToolRegistry } from '../../utils/ToolRegistry';
import './AgendaExportTool_Translations.js';

const a = (key: string): string => I18n.t('agendaExportTool.' + key);

type PageEl = HTMLElement & { dataset: DOMStringMap };

interface PageBinding {
  el:       HTMLElement;
  toolType: string;
  binding:  VariableBinding;
}

export class AgendaExportTool {

  public static setup(editor: HTMLElement): void {
    const panelTitle = document.getElementById('panel-title');
    const panelBody  = document.getElementById('panel-body');
    if (panelTitle) panelTitle.textContent = a('panelTitle');
    if (!panelBody) return;

    const pagesSnapshot = (): PageEl[] => [...editor.querySelectorAll<PageEl>('.craftools-page')];

    const renderPanel = (): void => {
      const pages = pagesSnapshot();

      const sectionPages   = AgendaExportTool._renderPagesSection(pages);
      const sectionPreview = AgendaExportTool._renderPreviewSection();
      const sectionExport  = AgendaExportTool._renderExportSection(pages);

      panelBody.innerHTML = `
        <div id="agenda-root">
          ${PanelUI.accordion('agenda-paginas', 'auto_awesome_motion', a('tabPages'), sectionPages, { open: true })}
          ${PanelUI.accordion('agenda-preview', 'visibility', a('tabPreview'), sectionPreview, { open: false })}
          ${PanelUI.accordion('agenda-exportar', 'print', a('tabExport'), sectionExport, { open: false })}
        </div>
      `;

      PanelUI.bindAccordions(panelBody);
      bindEvents();
    };

    const bindEvents = (): void => {
      const root = panelBody.querySelector<HTMLElement>('#agenda-root');
      if (!root) return;

      // ── Tab 1: Pages ──────────────────────────────────────────────────
      root.querySelectorAll<HTMLInputElement>('.agenda-page-repeat-check').forEach(chk => {
        chk.addEventListener('change', () => {
          const pageId = chk.dataset.pageId as string;
          const page   = document.getElementById(pageId);
          const wrap   = root.querySelector<HTMLElement>(`.agenda-page-repeat-count-wrap[data-page-id="${pageId}"]`);
          const input  = root.querySelector<HTMLInputElement>(`.agenda-page-repeat-input[data-page-id="${pageId}"]`);
          if (chk.checked) {
            if (wrap) wrap.style.display = '';
            const count = Math.max(2, parseInt(input?.value ?? '', 10) || 2);
            if (input) input.value = String(count);
            if (page) page.setAttribute('data-agenda-repeat', String(count));
          } else {
            if (wrap) wrap.style.display = 'none';
            if (page) page.removeAttribute('data-agenda-repeat');
          }
          AgendaExportTool._refreshExportSummary(root, pagesSnapshot());
        });
      });

      root.querySelectorAll<HTMLInputElement>('.agenda-page-repeat-input').forEach(inp => {
        inp.addEventListener('input', () => {
          const pageId = inp.dataset.pageId as string;
          const page   = document.getElementById(pageId);
          const count  = Math.max(1, parseInt(inp.value, 10) || 1);
          if (page) page.setAttribute('data-agenda-repeat', String(count));
          AgendaExportTool._refreshExportSummary(root, pagesSnapshot());
        });
      });

      // ── Tab 2: Preview (reloads when the accordion opens) ────────────
      const previewHeader = root.querySelector<HTMLElement>('[data-toggle-accordion="agenda-preview"]');
      if (previewHeader) {
        previewHeader.addEventListener('click', () => {
          const body = root.querySelector<HTMLElement>('#agenda-preview-body');
          if (body) AgendaExportTool._populatePreview(body, pagesSnapshot());
        });
      }

      // ── Tab 3: Actions / Export ────────────────────────────────────────
      const exportBtn = root.querySelector<HTMLButtonElement>('#agenda-export-btn');
      if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
          const currentPages = pagesSnapshot();
          if (!currentPages.length) {
            Notify.toast(a('noPagesFound'), 'error');
            return;
          }
          exportBtn.disabled = true;
          const originalHtml = exportBtn.innerHTML;
          exportBtn.innerHTML = `<span class="material-symbols-outlined spin" style="font-size:16px;">progress_activity</span> ${a('generating')}`;
          try {
            const { AgendaExport } = await import('../../utils/AgendaExport.js');
            await AgendaExport.print(editor);
          } catch (err) {
            console.error('[AgendaExportTool] Failed to export Agenda:', err);
            Notify.toast(a('exportError'), 'error', 6000);
          } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalHtml;
          }
        });
      }
    };

    renderPanel();
  }

  // ── Tab 1: Pages ──────────────────────────────────────────────────────────

  private static _renderPagesSection(pages: PageEl[]): string {
    if (!pages.length) {
      return `<p style="font-size:12px; color:var(--text-secondary);">${a('noPagesFound')}</p>`;
    }

    const cards = pages.map((page, idx) => {
      const size = PdfExport._parsePageSize(page);
      const repeatCount = parseInt(page.dataset.agendaRepeat ?? '', 10) || 1;
      const checked = repeatCount > 1;
      const boundCount = AgendaExportTool._collectPageBindings(page).length;

      return `
        <div class="ct-field" style="border:1px solid var(--border, #e4e4e7); border-radius:8px; padding:10px; margin-bottom:8px;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin:0;">
            <input type="checkbox" class="agenda-page-repeat-check" data-page-id="${page.id}" ${checked ? 'checked' : ''}>
            <span style="font-weight:600; font-size:12px;">${a('pageLabel')} ${idx + 1}</span>
            <span style="font-size:10px; color:var(--text-muted); margin-left:auto; white-space:nowrap;">${size.width} × ${size.height}</span>
          </label>
          <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px; margin-left:24px;">${boundCount} ${a('variablesFoundSuffix')}</span>
          <div class="agenda-page-repeat-count-wrap" data-page-id="${page.id}" style="margin-top:8px; margin-left:24px; ${checked ? '' : 'display:none;'}">
            <span class="craftools-label">${a('repeatCountLabel')}</span>
            <input type="number" class="craftools-input agenda-page-repeat-input" data-page-id="${page.id}" min="1" max="2000" value="${checked ? repeatCount : 30}" style="width:100%;">
            ${boundCount === 0 ? `
              <div style="display:flex; gap:6px; align-items:flex-start; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:8px; font-size:11px; color:#ef4444; margin-top:8px;">
                <span class="material-symbols-outlined" style="font-size:14px;">warning</span>
                <span>${a('noVariablesWarning')}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <p style="font-size:11px; color:var(--text-secondary); margin-bottom:10px;">${a('pagesIntro')}</p>
      ${cards}
    `;
  }

  // ── Tab 2: Preview ────────────────────────────────────────────────────────

  private static _renderPreviewSection(): string {
    return `<div id="agenda-preview-body">
      <p style="font-size:11px; color:var(--text-secondary);">${a('previewIntro')}</p>
    </div>`;
  }

  private static async _populatePreview(container: HTMLElement, pages: PageEl[]): Promise<void> {
    const repeatedPages = pages.filter(p => (parseInt(p.dataset.agendaRepeat ?? '', 10) || 1) > 1);

    if (!repeatedPages.length) {
      container.innerHTML = `<p style="font-size:12px; color:var(--text-secondary);">${a('previewNoRepeats')}</p>`;
      return;
    }

    container.innerHTML = `<p style="font-size:11px; color:var(--text-secondary);">${a('previewIntro')}</p><p style="font-size:11px; color:var(--text-muted);">${I18n.t('variablePanel.previewLoading')}</p>`;

    // Collects every binding from every repeated page for a single API
    // prefetch (avoids one fetch per element/repetition), along with the
    // exact repetition indices this preview will actually sample below
    // ([0, 1, repeatCount - 1] per page, same formula) -- passed through so
    // an Emoji Kitchen "variable" binding (no fixed right emoji) only
    // prefetches the combo(s) these specific samples need instead of every
    // partner combo in the pool (see prefetchApiResources()'s own comment).
    const allBindings: VariableBinding[] = [];
    const repetitionIndicesSet = new Set<number>();
    repeatedPages.forEach(page => {
      AgendaExportTool._collectPageBindings(page).forEach(({ binding }) => allBindings.push(binding));
      const repeatCount = parseInt(page.dataset.agendaRepeat ?? '', 10) || 1;
      [0, 1, repeatCount - 1].forEach(i => { if (i >= 0 && i < repeatCount) repetitionIndicesSet.add(i); });
    });
    const apiCache: ApiCache = await VariableEngine.prefetchApiResources(allBindings, {
      repetitionIndices: [...repetitionIndicesSet],
    });

    const blocks = pages.map((page, idx) => {
      const repeatCount = parseInt(page.dataset.agendaRepeat ?? '', 10) || 1;
      const bindings = AgendaExportTool._collectPageBindings(page);

      if (repeatCount <= 1) {
        return `
          <div class="ct-field" style="border:1px solid var(--border, #e4e4e7); border-radius:8px; padding:10px; margin-bottom:8px;">
            <div style="font-weight:600; font-size:12px;">${a('pageLabel')} ${idx + 1} — <span style="font-weight:400; color:var(--text-secondary);">${a('previewCommonPage')}</span></div>
          </div>
        `;
      }

      const sampleIndexes = [...new Set([0, 1, repeatCount - 1])].filter(i => i >= 0 && i < repeatCount);

      const rows = bindings.length ? bindings.map(({ toolType, binding }) => {
        const samples = sampleIndexes.map(repetitionIndex => {
          const context = { repetitionIndex, pageNumber: repetitionIndex + 1, totalPages: repeatCount, now: new Date() };
          const value = VariableEngine.resolve(binding, context, apiCache);
          return `<div style="display:flex; justify-content:space-between; gap:8px; font-size:11px; padding:3px 0;"><span style="color:var(--text-muted);">${a('previewRepetitionLabel')} ${repetitionIndex + 1}</span><span style="font-weight:500; word-break:break-word; text-align:right;">${AgendaExportTool._esc(value) || '—'}</span></div>`;
        }).join('');
        return `
          <div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border, #e4e4e7);">
            <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.4px; color:var(--text-muted); margin-bottom:2px;">${AgendaExportTool._toolTypeLabel(toolType)} — ${AgendaExportTool._variableTypeLabel(binding.type)}</div>
            ${samples}
          </div>
        `;
      }).join('') : `<p style="font-size:11px; color:var(--text-muted); margin-top:6px;">${a('previewNoBindings')}</p>`;

      return `
        <div class="ct-field" style="border:1px solid var(--border, #e4e4e7); border-radius:8px; padding:10px; margin-bottom:8px;">
          <div style="font-weight:600; font-size:12px;">${a('pageLabel')} ${idx + 1} — <span style="font-weight:400; color:var(--text-secondary);">${a('previewRepeatedPage').replace('{n}', String(repeatCount))}</span></div>
          ${rows}
        </div>
      `;
    }).join('');

    container.innerHTML = `<p style="font-size:11px; color:var(--text-secondary); margin-bottom:8px;">${a('previewIntro')}</p>${blocks}`;
  }

  // ── Tab 3: Actions / Export ──────────────────────────────────────────────

  private static _renderExportSection(pages: PageEl[]): string {
    const total = AgendaExportTool._totalOutputPages(pages);
    return `
      <p style="font-size:11px; color:var(--text-secondary); margin-bottom:10px;">${a('exportIntro')}</p>
      <div class="ct-field" style="display:flex; justify-content:space-between; align-items:center; background:rgba(99,102,241,0.08); border-radius:6px; padding:8px 10px; margin-bottom:12px;">
        <span style="font-size:12px;">${a('exportSummaryLabel')}</span>
        <span id="agenda-total-pages" style="font-size:14px; font-weight:700;">${total}</span>
      </div>
      <button type="button" id="agenda-export-btn" class="craftools-topbtn" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px;">
        <span class="material-symbols-outlined" style="font-size:18px;">print</span>
        ${a('exportButton')}
      </button>
    `;
  }

  private static _refreshExportSummary(root: HTMLElement, pages: PageEl[]): void {
    const el = root.querySelector('#agenda-total-pages');
    if (el) el.textContent = String(AgendaExportTool._totalOutputPages(pages));
  }

  private static _totalOutputPages(pages: PageEl[]): number {
    return pages.reduce((sum, p) => sum + Math.max(1, parseInt(p.dataset.agendaRepeat ?? '', 10) || 1), 0);
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  /** Reads variable bindings from a page's live child elements (not clones). */
  private static _collectPageBindings(page: HTMLElement): PageBinding[] {
    const results: PageBinding[] = [];
    page.querySelectorAll<HTMLElement>('craftools-element').forEach(el => {
      const toolType = el.getAttribute('data-craftool') ?? '';
      let binding: VariableBinding | null = null;
      if (toolType === 'conteudovariavel') {
        binding = (el as HTMLElement & { _craftoolsVariable?: VariableBinding | null })._craftoolsVariable ?? null;
      } else if (toolType === 'qrcode' || toolType === 'barcode') {
        binding = (el as HTMLElement & { _craftoolsMeta?: { variableBinding?: VariableBinding | null } })._craftoolsMeta?.variableBinding ?? null;
      }
      if (binding && binding.type) results.push({ el, toolType, binding });
    });
    return results;
  }

  private static _toolTypeLabel(toolType: string): string {
    const map: Record<string, string> = {
      conteudovariavel: I18n.t('editor.variableContent'),
      qrcode: I18n.t('editor.qrcode'),
      barcode: I18n.t('editor.barcode'),
    };
    return map[toolType] || toolType;
  }

  private static _variableTypeLabel(type: string): string {
    const map: Record<string, string> = {
      date: I18n.t('variablePanel.typeDate'),
      sequenceNumber: I18n.t('variablePanel.typeSequenceNumber'),
      sequenceText: I18n.t('variablePanel.typeSequenceText'),
      pageNumber: I18n.t('variablePanel.typePageNumber'),
      link: I18n.t('variablePanel.typeLink'),
      apiPhrase: I18n.t('variablePanel.typeApiPhrase'),
    };
    return map[type] || type;
  }

  private static _esc(val: unknown): string {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

// icon matches the desktop sidebar (index.html #pwa-sidebar-agenda).
ToolRegistry.register({
  key: 'agenda',
  label: 'editor.agendaExport',
  icon: 'event_note',
  panelOnly: true,
  showInFooterNav: false,
  category: 'export',
});
