/**
 * AgendaExportTool.ts
 *
 * "Export Agenda" panel — takes over the entire side panel (like
 * GeneratorTool), with 3 accordion tabs:
 *   1. Pages — pick which pages repeat and how many times (stored as a
 *      `data-agenda-repeat="N"` attribute on the `.craftools-page` itself,
 *      persisting for as long as the editor session lasts).
 *   2. Preview — real-time canvas preview of resolved variables, navigated
 *      page-by-page directly on the main canvas (same pattern as
 *      CalendarTool / GeneratorTool). Two buttons: "First 5 pages" / "All
 *      pages" control how many output pages are rendered at once. The
 *      actual canvas preview is restored automatically when the user
 *      switches away from this panel.
 *   3. Actions — summary + "Export Agenda" button, which delegates the
 *      real generation to AgendaExport.ts (dynamic import, only when
 *      actually exporting).
 */
import { I18n } from '../../settings/Translations.js';
import { PanelUI } from '../../utils/PanelUI';
import { Notify } from '../../utils/Notify';
import { VariableEngine, type VariableBinding, type ApiCache } from '../../utils/VariableEngine';
import { PdfExport, type PageSize } from '../../utils/PdfExport';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { parseVariableBinding } from '../../utils/fields/variable-binding.field';
import { AgendaPlan } from '../../utils/AgendaPlan';
import './AgendaExportTool_Translations.js';

const a = (key: string): string => I18n.t('agendaExportTool.' + key);

type PageEl = HTMLElement & { dataset: DOMStringMap };

/** Editor instance shape this tool relies on beyond plain HTMLElement. */
type EditorEl = HTMLElement & {
  _savedPageHtml?: string;
  _savedPageCssText?: string;
  restoreOriginalCanvas?: () => void;
};

interface PageBinding {
  el:       HTMLElement;
  toolType: string;
  binding:  VariableBinding;
}

// ── Live canvas preview state (module-level so navigate buttons can update it) ──
interface CanvasPreviewState {
  pages:         PageEl[];
  outputPages:   { html: string; size: PageSize }[]; // resolved HTML + source page size for each output page
  currentIndex:  number;   // 0-based index of which output page is shown
  pagesWrapper:  HTMLElement | null;
  mainPage:      HTMLElement | null;
  hiddenPages:   PageEl[]; // real .craftools-page siblings temporarily hidden while previewing (see _loadCanvasPreview())
  root:          HTMLElement;
}

let _canvasState: CanvasPreviewState | null = null;

export class AgendaExportTool {

  public static setup(editor: HTMLElement): void {
    const panelTitle = document.getElementById('panel-title');
    const panelBody  = document.getElementById('panel-body');
    if (panelTitle) panelTitle.textContent = a('panelTitle');
    if (!panelBody) return;

    const ed = editor as EditorEl;

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
      //
      // Two kinds of change here:
      //  - "Topology" changes (a page's repeat toggle, or its "Depois,
      //    continuar com" target) can change which OTHER pages are valid
      //    "voltar para" options and how the plan-summary breadcrumb reads,
      //    so they re-render the whole Pages accordion body (only that
      //    inner container -- the accordion wrapper itself, and every OTHER
      //    accordion, is left untouched, so open/closed state and scroll
      //    position elsewhere in the panel survive).
      //  - Plain count changes (repeat count, block-repeat count) only
      //    refresh the numeric summaries in place, so typing in those
      //    number inputs never loses focus/caret position.
      const refreshPagesSection = (): void => {
        const container = root.querySelector<HTMLElement>('[data-accordion-id="agenda-paginas"] .ct-accordion-content');
        if (!container) return;
        container.innerHTML = AgendaExportTool._renderPagesSection(pagesSnapshot());
        bindPagesTabEvents();
        AgendaExportTool._refreshExportSummary(root, pagesSnapshot());
      };

      const bindPagesTabEvents = (): void => {
        root.querySelectorAll<HTMLInputElement>('.agenda-page-repeat-check').forEach(chk => {
          chk.addEventListener('change', () => {
            const pageId = chk.dataset.pageId as string;
            const page   = document.getElementById(pageId);
            if (page) {
              if (chk.checked) {
                const input = root.querySelector<HTMLInputElement>(`.agenda-page-repeat-input[data-page-id="${pageId}"]`);
                const count = Math.max(2, parseInt(input?.value ?? '', 10) || 2);
                page.setAttribute('data-agenda-repeat', String(count));
              } else {
                page.removeAttribute('data-agenda-repeat');
                // A non-repeating page can't sensibly close/extend a chain
                // anymore -- clear whatever it was pointing to so it
                // doesn't linger as invisible stale state.
                delete page.dataset.agendaNext;
                delete page.dataset.agendaCycleCount;
              }
            }
            refreshPagesSection();
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

        root.querySelectorAll<HTMLInputElement>('.agenda-page-alternate-check').forEach(chk => {
          chk.addEventListener('change', () => {
            const pageId = chk.dataset.pageId as string;
            const page   = document.getElementById(pageId);
            if (page) {
              if (chk.checked) page.dataset.agendaAlternate = 'true';
              else delete page.dataset.agendaAlternate;
            }
          });
        });

        // "Depois, continuar com" -- see AgendaPlan.ts's header comment for
        // the chain/loop model. The dropdown only ever offers EARLIER,
        // repeat-enabled pages (see _renderPagesSection()'s option
        // building), so picking one always closes a block back to it;
        // picking "Próxima página do documento" clears it back to today's
        // only behaviour (this page's own repeats, then normal document
        // flow).
        root.querySelectorAll<HTMLSelectElement>('.agenda-page-next-select').forEach(sel => {
          sel.addEventListener('change', () => {
            const pageId = sel.dataset.pageId as string;
            const page   = document.getElementById(pageId);
            if (!page) return;
            if (sel.value) {
              page.dataset.agendaNext = sel.value;
              if (!page.dataset.agendaCycleCount) page.dataset.agendaCycleCount = '2';
            } else {
              delete page.dataset.agendaNext;
              delete page.dataset.agendaCycleCount;
            }
            refreshPagesSection();
          });
        });

        // "Repetir esse bloco quantas vezes" -- only shown once a page's
        // own "continuar com" closes a block (see above); stored on THAT
        // page (the one that closes the loop), per AgendaPlan.cycleCount().
        root.querySelectorAll<HTMLInputElement>('.agenda-page-cycle-input').forEach(inp => {
          inp.addEventListener('input', () => {
            const pageId = inp.dataset.pageId as string;
            const page   = document.getElementById(pageId);
            const count  = Math.max(1, parseInt(inp.value, 10) || 1);
            if (page) page.dataset.agendaCycleCount = String(count);
            AgendaExportTool._refreshExportSummary(root, pagesSnapshot());
          });
        });
      };

      bindPagesTabEvents();

      // ── Tab 2: Preview — single on/off toggle ──────────────────────────
      // Entirely decoupled from the accordion's own open/closed state now
      // (previously opening the accordion silently triggered a load) --
      // the canvas preview is only ever loaded/torn down by this switch.
      const previewToggle = root.querySelector<HTMLInputElement>('#agenda-preview-toggle');
      if (previewToggle) {
        previewToggle.addEventListener('change', () => {
          const track = previewToggle.closest('label')?.querySelector<HTMLElement>('.ct-toggle-track');
          const thumb = previewToggle.closest('label')?.querySelector<HTMLElement>('.ct-toggle-thumb');
          if (track) track.style.background = previewToggle.checked ? 'var(--accent, #f97316)' : 'var(--border, #e4e4e7)';
          if (thumb) thumb.style.transform   = previewToggle.checked ? 'translateX(14px)' : 'translateX(0)';

          if (previewToggle.checked) {
            AgendaExportTool._loadCanvasPreview(root, ed, pagesSnapshot());
          } else {
            AgendaExportTool._disableCanvasPreview(root, ed);
          }
        });
      }

      // ── Tab 2: Navigate pages ──────────────────────────────────────────
      // Buttons are only ever enabled while the toggle above is on (see
      // _loadCanvasPreview()/_showCanvasPage()), and disabled buttons never
      // dispatch 'click' -- no extra toggle-state guard needed here.
      root.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).closest<HTMLElement>('[data-agenda-nav]');
        if (!target || !_canvasState) return;
        const dir = target.dataset.agendaNav;
        if (dir === 'prev' && _canvasState.currentIndex > 0) {
          AgendaExportTool._showCanvasPage(_canvasState.currentIndex - 1, root);
        } else if (dir === 'next' && _canvasState.currentIndex < _canvasState.outputPages.length - 1) {
          AgendaExportTool._showCanvasPage(_canvasState.currentIndex + 1, root);
        }
      });

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

      // SVG export (experimental) -- same trigger pattern as the PDF button
      // above, delegating the real work to AgendaSvgExport.ts (dynamic
      // import, only loaded when actually used). See that file's header
      // comment for what it does/doesn't support yet.
      const exportSvgBtn = root.querySelector<HTMLButtonElement>('#agenda-export-svg-btn');
      const mergeInput   = root.querySelector<HTMLInputElement>('#agenda-export-svg-merge');
      if (exportSvgBtn) {
        exportSvgBtn.addEventListener('click', async () => {
          const currentPages = pagesSnapshot();
          if (!currentPages.length) {
            Notify.toast(a('noPagesFound'), 'error');
            return;
          }
          const merge = mergeInput?.checked ?? true;
          exportSvgBtn.disabled = true;
          const originalHtml = exportSvgBtn.innerHTML;
          exportSvgBtn.innerHTML = `<span class="material-symbols-outlined spin" style="font-size:16px;">progress_activity</span> ${a('generating')}`;
          try {
            const { AgendaSvgExport } = await import('../../utils/AgendaSvgExport.js');
            await AgendaSvgExport.print(editor, { merge });
          } catch (err) {
            console.error('[AgendaExportTool] Failed to export Agenda as SVG:', err);
            Notify.toast(a('exportSvgError'), 'error', 6000);
          } finally {
            exportSvgBtn.disabled = false;
            exportSvgBtn.innerHTML = originalHtml;
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

    // Pages already claimed as SOMEONE ELSE's "continuar com" target --
    // excluded from every other page's own dropdown options so a page can
    // only ever be reached through one chain (see AgendaPlan.ts's header
    // comment for the model: at most one incoming edge per page).
    const takenTargets = new Set(
      pages.filter(p => p.dataset.agendaNext).map(p => p.dataset.agendaNext as string),
    );
    // Pages whose OWN "continuar com" closes a loop -- only these show the
    // "repetir esse bloco quantas vezes" field (see closingPageIds()'s doc
    // comment: a purely forward link that never loops back doesn't need one).
    const closingIds = AgendaPlan.closingPageIds(pages);

    const cards = pages.map((page, idx) => {
      const size = PdfExport._parsePageSize(page);
      const checked = AgendaPlan.repeatEnabled(page);
      const repeatCount = AgendaPlan.repeatCount(page);
      const boundCount = AgendaExportTool._collectPageBindings(page).length;

      const alternate = page.dataset.agendaAlternate === 'true';
      const nextId = page.dataset.agendaNext ?? '';
      const cycleCount = AgendaPlan.cycleCount(page);

      // Any OTHER repeat-enabled page not already targeted by someone else
      // can be picked here -- a page AFTER this one extends the chain
      // forward ("continuar com"), a page BEFORE it closes it into a loop
      // ("voltar para", revealing the block-repeat count below).
      const targetOptions = pages
        .filter((p, i) => i !== idx && AgendaPlan.repeatEnabled(p) && (p.id === nextId || !takenTargets.has(p.id)))
        .map((p) => ({
          id: p.id,
          label: `${a('pageLabel')} ${pages.indexOf(p) + 1}`,
          backward: pages.indexOf(p) < idx,
        }));

      return `
        <div class="ct-field ct-field--block" style="border:1px solid var(--border, #e4e4e7); border-radius:8px; padding:10px; margin-bottom:8px;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin:0;">
            <input type="checkbox" class="agenda-page-repeat-check" data-page-id="${page.id}" ${checked ? 'checked' : ''}>
            <span style="font-weight:600; font-size:12px;">${a('pageLabel')} ${idx + 1}</span>
            <span style="font-size:10px; color:var(--text-muted); margin-left:auto; white-space:nowrap;">${size.width} × ${size.height}</span>
          </label>
          <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px; margin-left:24px;">${boundCount} ${a('variablesFoundSuffix')}</span>
          <div class="agenda-page-repeat-count-wrap" data-page-id="${page.id}" style="margin-top:8px; margin-left:24px; ${checked ? '' : 'display:none;'}">
            <span class="craftools-label">${a('repeatCountLabel')}</span>
            <input type="number" class="craftools-input agenda-page-repeat-input" data-page-id="${page.id}" min="1" max="2000" value="${checked ? repeatCount : 30}" style="width:100%; margin-bottom:8px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin:0;">
              <input type="checkbox" class="agenda-page-alternate-check" data-page-id="${page.id}" ${alternate ? 'checked' : ''}>
              <span style="font-size:11px;">${a('alternateToggle')}</span>
            </label>
            ${targetOptions.length ? `
              <div style="margin-top:8px;">
                <span class="craftools-label">${a('nextPageLabel')}</span>
                <select class="craftools-select agenda-page-next-select" data-page-id="${page.id}" style="width:100%;">
                  <option value="">${a('nextPageDocumentOption')}</option>
                  ${targetOptions.map(t => `<option value="${t.id}" ${t.id === nextId ? 'selected' : ''}>${(t.backward ? a('nextPageBackToOption') : a('nextPageContinueOption')).replace('{page}', t.label)}</option>`).join('')}
                </select>
              </div>
              ${closingIds.has(page.id) ? `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; background:var(--bg-accent, rgba(99,102,241,0.1)); border-radius:6px; padding:8px 10px; margin-top:8px;">
                  <span style="font-size:11px; color:var(--text-accent, #4f46e5); font-weight:500;">${a('cycleCountLabel')}</span>
                  <input type="number" class="craftools-input agenda-page-cycle-input" data-page-id="${page.id}" min="1" max="500" value="${cycleCount}" style="width:60px;">
                </div>
              ` : ''}
            ` : ''}
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
      <div id="agenda-plan-summary" style="display:flex; flex-wrap:wrap; align-items:center; gap:4px; font-size:11px; color:var(--text-secondary); background:var(--bg-shell, #f5f5f5); border-radius:6px; padding:8px 10px; margin-bottom:10px;">${AgendaExportTool._buildPlanSummaryHtml(pages)}</div>
      ${cards}
    `;
  }

  /**
   * Renders the resolved AgendaPlan as a small breadcrumb -- e.g.
   * "Página 1 → [Página 2 (30x) → Página 3 (15x)] × 12 → 541 páginas" --
   * so the user can see the outcome of the Pages tab's toggles/selects
   * without mentally simulating the chain/loop themselves. Mirrors
   * AgendaPlan.describe()'s traversal exactly (same source of truth
   * AgendaExport.ts's real resolution uses via AgendaPlan.build()), so
   * this never drifts from what the actual export/preview will produce.
   */
  private static _buildPlanSummaryHtml(pages: PageEl[]): string {
    if (!pages.length) return '';
    const pageIndex = new Map<HTMLElement, number>(pages.map((p, i) => [p, i]));
    const label = (p: HTMLElement, count: number): string => {
      const n = (pageIndex.get(p) ?? 0) + 1;
      const base = `${a('pageLabel')} ${n}`;
      return count > 1 ? `${base} (${count}x)` : base;
    };

    const groups = AgendaPlan.describe(pages);
    const parts = groups.map(g => {
      if (g.kind === 'single') return AgendaExportTool._esc(label(g.page, g.count));

      const preludeHtml = g.prelude.map(pg => AgendaExportTool._esc(label(pg.page, pg.count))).join(' &rarr; ');
      if (!g.loop.length) return preludeHtml;

      const loopHtml = g.loop.map(pg => AgendaExportTool._esc(label(pg.page, pg.count))).join(' &rarr; ');
      const chip = `<span style="background:var(--bg-accent, rgba(99,102,241,0.15)); color:var(--text-accent, #4f46e5); padding:1px 6px; border-radius:4px; font-weight:500;">${loopHtml}</span> &times;${g.cycles}`;
      return preludeHtml ? `${preludeHtml} &rarr; ${chip}` : chip;
    });

    const total = AgendaPlan.build(pages).length;
    return `${parts.join(' &rarr; ')} &rarr; <strong>${total}</strong> ${a('planSummaryTotalSuffix')}`;
  }

  // ── Tab 2: Preview ────────────────────────────────────────────────────────

  private static _renderPreviewSection(): string {
    // Single on/off toggle -- was two scope pills ("First 5 pages" / "All
    // pages") that also silently loaded the canvas preview as a side
    // effect of merely opening this accordion. Replaced with one explicit
    // switch (loads/restores the canvas on its own change event, entirely
    // decoupled from the accordion's own open/closed state) plus a nav bar
    // that's ALWAYS rendered below it -- just disabled while the toggle is
    // off -- instead of appearing/disappearing.
    return `<div id="agenda-preview-body">
      <p style="font-size:11px; color:var(--text-secondary); margin-bottom:10px;">${a('previewIntro')}</p>
      <div class="ct-field" style="margin-bottom:10px;">
        <span class="craftools-label" style="margin:0;">${a('previewToggleLabel')}</span>
        <label class="ct-toggle-label" style="display:flex; align-items:center; cursor:pointer; gap:6px; margin-left:auto;">
          <input type="checkbox" id="agenda-preview-toggle" class="ct-fi" style="display:none;">
          <span class="ct-toggle-track" style="
            width:32px; height:18px; border-radius:99px;
            background:var(--border, #e4e4e7); position:relative; transition:background .15s; flex-shrink:0;">
            <span class="ct-toggle-thumb" style="
              position:absolute; top:2px; left:2px;
              width:14px; height:14px; border-radius:50%;
              background:#fff; transition:transform .15s; box-shadow:0 1px 3px rgba(0,0,0,.2);
              transform:translateX(0);">
            </span>
          </span>
        </label>
      </div>
      <div id="agenda-preview-status" style="display:flex; align-items:center; justify-content:space-between; background:rgba(99,102,241,0.08); border-radius:8px; padding:8px 10px; min-height:38px;">
        <span id="agenda-preview-info" style="font-size:11px; color:var(--text-secondary);">${a('previewToggleOffHint')}</span>
        <div style="display:flex; gap:4px; align-items:center;">
          <button type="button" data-agenda-nav="prev" class="craftools-topbtn" style="padding:4px 8px; font-size:11px;" disabled>
            <span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle;">chevron_left</span>
          </button>
          <span id="agenda-preview-page-label" style="font-size:11px; font-weight:600; min-width:50px; text-align:center;">—</span>
          <button type="button" data-agenda-nav="next" class="craftools-topbtn" style="padding:4px 8px; font-size:11px;" disabled>
            <span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle;">chevron_right</span>
          </button>
        </div>
      </div>
    </div>`;
  }

  /**
   * Loads and renders a canvas-level real-time preview of the resolved
   * agenda pages directly on the main editor canvas -- same pattern as
   * CalendarTool._renderCanvasPreview() and GeneratorTool.ts.
   *
   * Saves the original page HTML via editor._savedPageHtml (restored
   * automatically by Editor.ts's restoreOriginalCanvas() when the user
   * switches to a different tool) and injects the resolved page into
   * main-page instead of using an iframe.
   *
   * Navigation between resolved output pages is handled by
   * _showCanvasPage(), controlled by the Prev/Next buttons in the panel.
   */
  private static async _loadCanvasPreview(
    root:    HTMLElement,
    editor:  EditorEl,
    pages:   PageEl[],
  ): Promise<void> {
    const infoEl      = root.querySelector<HTMLElement>('#agenda-preview-info');
    const pageLabel   = root.querySelector<HTMLElement>('#agenda-preview-page-label');
    const prevBtn     = root.querySelector<HTMLButtonElement>('[data-agenda-nav="prev"]');
    const nextBtn     = root.querySelector<HTMLButtonElement>('[data-agenda-nav="next"]');

    if (infoEl) infoEl.textContent = I18n.t('variablePanel.previewLoading');
    if (pageLabel) pageLabel.textContent = '—';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;

    const pagesWrapper = document.getElementById('pages-wrapper');
    const mainPage     = document.getElementById('main-page');
    if (!mainPage) return;

    // Save original canvas (only first time, like CalendarTool does)
    if (editor._savedPageHtml === undefined) {
      editor._savedPageHtml    = mainPage.innerHTML;
      editor._savedPageCssText = mainPage.style.cssText;
    }

    // Hide every OTHER real .craftools-page while the preview is active.
    // `main-page` is a fixed id hardcoded on just the FIRST physical page
    // (see Editor.ts's bootstrap markup) -- an Agenda document commonly has
    // a second (or more) real page (e.g. a non-repeating cover followed by
    // a repeatable daily page). Without this, that second page stayed
    // visible untouched below main-page the whole time the preview was
    // open: navigating through the resolved output pages only ever
    // rewrote main-page's own slot (so output pages that actually came
    // from the SECOND page's design got crammed into the first page's
    // box), while the second page's box sat there showing its own live,
    // un-navigated content -- looking exactly like "the preview ignores
    // pages without variables and only ever shows content on the first
    // page". Restored in _disableCanvasPreview().
    const hiddenPages: PageEl[] = [];
    pages.forEach(p => {
      if (p === mainPage) return;
      if (p.style.display !== 'none') {
        p.style.display = 'none';
        hiddenPages.push(p);
      }
    });

    // Show badge -- same #generator-canvas-badge element (and exact style)
    // GeneratorTool.ts/CalendarTool.ts already use for their own canvas
    // preview badge, so all three look identical. This one previously
    // used a one-off indigo (#6366f1), out of step with the app's actual
    // standard orange (#f97316, matching --accent).
    const canvasArea = document.getElementById('canvas-area');
    let badge = document.getElementById('generator-canvas-badge');
    if (!badge && canvasArea) {
      badge = document.createElement('div');
      badge.id = 'generator-canvas-badge';
      badge.style.cssText = `
        position:absolute; top:20px; left:20px;
        background:#f97316; color:#fff;
        font-size:11px; font-weight:700;
        padding:6px 14px; border-radius:30px; z-index:100;
        box-shadow:0 4px 12px rgba(249,115,22,0.3);
        display:flex; align-items:center; gap:6px;
        pointer-events:none; text-transform:uppercase; letter-spacing:0.5px;
        animation:pageIn 0.25s cubic-bezier(0.22,1,0.36,1);
      `;
      badge.innerHTML = `<span class="material-symbols-outlined" style="font-size:15px;">visibility</span> ${a('tabPreview')}`;
      canvasArea.appendChild(badge);
    }

    try {
      const { AgendaExport } = await import('../../utils/AgendaExport.js');

      // Build resolved output pages (HTML + source page size, one per
      // output page) -- the toggle has no "first N pages" limit anymore
      // (that scope choice was removed along with the pill buttons);
      // Prev/Next now navigates the full set, so the preview should
      // always match it.
      const outputPages = await AgendaExport.buildOutputPages(editor as HTMLElement, {});

      if (!outputPages || !outputPages.length) {
        if (infoEl) infoEl.textContent = a('noPagesFound');
        return;
      }

      _canvasState = {
        pages,
        outputPages,
        currentIndex:  0,
        pagesWrapper,
        mainPage,
        hiddenPages,
        root,
      };

      AgendaExportTool._showCanvasPage(0, root);

      if (infoEl) infoEl.textContent = `${outputPages.length} ${a('exportSummaryLabel').toLowerCase()}`;

    } catch (err) {
      console.error('[AgendaExportTool] Failed to build canvas preview:', err);
      if (infoEl) infoEl.textContent = a('exportError');
    }
  }

  /**
   * Turns the toggle off: restores the canvas exactly as
   * Editor.ts's restoreOriginalCanvas() already does when switching tools
   * (removes the badge, restores main-page's saved HTML, re-attaches page
   * events), clears the nav state, and resets the status bar/nav buttons
   * back to their initial disabled/placeholder look.
   */
  private static _disableCanvasPreview(root: HTMLElement, editor: EditorEl): void {
    // Undo the sibling-page hiding done in _loadCanvasPreview() BEFORE
    // clearing _canvasState below -- restoreOriginalCanvas() only ever
    // touches main-page itself, it has no idea about the other pages this
    // tool hid.
    _canvasState?.hiddenPages.forEach(p => { p.style.display = ''; });

    editor.restoreOriginalCanvas?.();
    _canvasState = null;

    const infoEl    = root.querySelector<HTMLElement>('#agenda-preview-info');
    const pageLabel = root.querySelector<HTMLElement>('#agenda-preview-page-label');
    const prevBtn   = root.querySelector<HTMLButtonElement>('[data-agenda-nav="prev"]');
    const nextBtn   = root.querySelector<HTMLButtonElement>('[data-agenda-nav="next"]');

    if (infoEl)    infoEl.textContent    = a('previewToggleOffHint');
    if (pageLabel) pageLabel.textContent = '—';
    if (prevBtn)   prevBtn.disabled  = true;
    if (nextBtn)   nextBtn.disabled  = true;
  }

  /**
   * Injects the resolved HTML of a specific output page index into the
   * main canvas page and updates the navigation buttons.
   */
  private static _showCanvasPage(index: number, root: HTMLElement): void {
    if (!_canvasState) return;
    const { outputPages, mainPage } = _canvasState;
    if (!mainPage || index < 0 || index >= outputPages.length) return;

    _canvasState.currentIndex = index;
    const { html, size } = outputPages[index];

    // Resize main-page's own box to match THIS output page's source page --
    // main-page is permanently sized for whichever physical page was
    // created first (see Editor.ts's bootstrap markup), so without this an
    // output page coming from a differently-sized second/third page would
    // render its real content inside a box still sized for the first page.
    mainPage.style.width     = size.width;
    mainPage.style.minHeight = size.height;
    mainPage.style.background = size.background;
    mainPage.innerHTML = html;

    const pageLabel = root.querySelector<HTMLElement>('#agenda-preview-page-label');
    const prevBtn   = root.querySelector<HTMLButtonElement>('[data-agenda-nav="prev"]');
    const nextBtn   = root.querySelector<HTMLButtonElement>('[data-agenda-nav="next"]');

    if (pageLabel) pageLabel.textContent = `${index + 1} / ${outputPages.length}`;
    if (prevBtn)   prevBtn.disabled  = index === 0;
    if (nextBtn)   nextBtn.disabled  = index === outputPages.length - 1;
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

      <div style="display:flex; align-items:center; gap:10px; margin:16px 0; color:var(--text-muted);">
        <div style="flex:1; height:1px; background:var(--border, #e4e4e7);"></div>
        <span style="font-size:10px; text-transform:uppercase; letter-spacing:0.5px;">${a('exportSvgDivider')}</span>
        <div style="flex:1; height:1px; background:var(--border, #e4e4e7);"></div>
      </div>

      <div style="display:flex; gap:8px; align-items:flex-start; background:rgba(249,115,22,0.1); border:1px solid rgba(249,115,22,0.3); border-radius:8px; padding:10px; margin-bottom:10px;">
        <span class="material-symbols-outlined" style="font-size:16px; color:#f97316;">science</span>
        <span style="font-size:11px; color:var(--text-secondary);">${a('exportSvgNotice')}</span>
      </div>

      <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; margin:0 0 10px;">
        <input type="checkbox" id="agenda-export-svg-merge" checked style="margin-top:2px;">
        <span style="font-size:11.5px;">${a('exportSvgMergeToggle')}</span>
      </label>

      <button type="button" id="agenda-export-svg-btn" class="craftools-topbtn" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px;">
        <span class="material-symbols-outlined" style="font-size:18px;">data_object</span>
        ${a('exportSvgButton')}
      </button>
    `;
  }

  /**
   * Refreshes every derived-count display after a Pages tab change: the
   * Actions tab's total-pages chip AND the Pages tab's own plan-summary
   * breadcrumb (see _buildPlanSummaryHtml()) -- both read straight from
   * AgendaPlan, so they always agree with each other and with the real
   * export.
   */
  private static _refreshExportSummary(root: HTMLElement, pages: PageEl[]): void {
    const el = root.querySelector('#agenda-total-pages');
    if (el) el.textContent = String(AgendaExportTool._totalOutputPages(pages));

    const summaryEl = root.querySelector<HTMLElement>('#agenda-plan-summary');
    if (summaryEl) summaryEl.innerHTML = AgendaExportTool._buildPlanSummaryHtml(pages);
  }

  private static _totalOutputPages(pages: PageEl[]): number {
    return AgendaPlan.build(pages).length;
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  /**
   * Reads variable bindings from a page's live child elements (not clones).
   *
   * Checks each tool's in-memory `_craftoolsVariable`/`_craftoolsMeta.
   * variableBinding` first (the fast path, already-hydrated for anything
   * the user selected in the current DOM instance), then falls back to
   * parsing `dataset.ctState` -- a real `data-ct-state` HTML attribute, so
   * unlike those in-memory properties it SURVIVES innerHTML-based DOM
   * replacement (HistoryManager undo/redo, SessionManager session restore)
   * -- for anything that didn't. Without this fallback, a binding
   * configured perfectly correctly could look completely unset here (and
   * in AgendaExport.ts's matching _getBinding()) the moment the element's
   * page was rebuilt via innerHTML and the user hadn't re-selected that
   * specific element since, which is exactly why "N variables bound" counts
   * and the actual Agenda PDF export could both silently miss variables
   * that were genuinely configured.
   */
  private static _collectPageBindings(page: HTMLElement): PageBinding[] {
    const results: PageBinding[] = [];
    page.querySelectorAll<HTMLElement>('craftools-element').forEach(el => {
      const toolType = el.getAttribute('data-craftool') ?? '';
      let binding: VariableBinding | null = null;
      if (toolType === 'variablecontent') {
        binding = (el as HTMLElement & { _craftoolsVariable?: VariableBinding | null })._craftoolsVariable ?? null;
        if (!binding) {
          const state = PropertyRenderer._readState(el);
          if ('variableBinding' in state) binding = parseVariableBinding(state.variableBinding);
        }
      } else if (toolType === 'qrcode' || toolType === 'barcode') {
        binding = (el as HTMLElement & { _craftoolsMeta?: { variableBinding?: VariableBinding | null } })._craftoolsMeta?.variableBinding ?? null;
        if (!binding) {
          const state = PropertyRenderer._readState(el);
          if ('variableBinding' in state) binding = parseVariableBinding(state.variableBinding);
        }
      }
      if (binding && binding.type) results.push({ el, toolType, binding });
    });
    return results;
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
