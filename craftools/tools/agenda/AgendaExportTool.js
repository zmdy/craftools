import { I18n } from "../../settings/Translations.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { Notify } from "../../utils/Notify.js";
import { VariableEngine } from "../../utils/VariableEngine.js";
import { PdfExport } from "../../utils/PdfExport.js";
import "./AgendaExportTool_Translations.js";

const a = (key) => I18n.t('agendaExportTool.' + key);

/**
 * AgendaExportTool
 *
 * Painel "Exportar Agenda" — assume o painel lateral inteiro (como o
 * GeradorTool), com 3 abas/acordeões:
 *   1. Páginas — escolhe quais páginas se repetem e quantas vezes
 *      (guardado como atributo `data-agenda-repeat="N"` na própria
 *      `.craftools-page`, para persistir enquanto a sessão do editor durar).
 *   2. Pré-visualização — amostra de como as variáveis vão variar entre
 *      repetições (1ª, 2ª e última), sem gerar todas as páginas de fato.
 *   3. Ações — resumo + botão "Exportar Agenda", que delega a geração real
 *      para AgendaExport.js (import dinâmico, só quando exportar de fato).
 */
export class AgendaExportTool {

    static setup(editor) {
        const panelTitle = document.getElementById('panel-title');
        const panelBody = document.getElementById('panel-body');
        if (panelTitle) panelTitle.textContent = a('panelTitle');
        if (!panelBody) return;

        const renderPanel = () => {
            const pages = [...editor.querySelectorAll('.craftools-page')];

            const sectionPages = this._renderPagesSection(pages);
            const sectionPreview = this._renderPreviewSection(pages);
            const sectionExport = this._renderExportSection(pages);

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

        const bindEvents = () => {
            const root = panelBody.querySelector('#agenda-root');
            if (!root) return;

            // ── Aba 1: Páginas ───────────────────────────────────────────────
            root.querySelectorAll('.agenda-page-repeat-check').forEach(chk => {
                chk.addEventListener('change', () => {
                    const pageId = chk.dataset.pageId;
                    const page = document.getElementById(pageId);
                    const wrap = root.querySelector(`.agenda-page-repeat-count-wrap[data-page-id="${pageId}"]`);
                    const input = root.querySelector(`.agenda-page-repeat-input[data-page-id="${pageId}"]`);
                    if (chk.checked) {
                        if (wrap) wrap.style.display = '';
                        const count = Math.max(2, parseInt(input?.value, 10) || 2);
                        if (input) input.value = count;
                        if (page) page.setAttribute('data-agenda-repeat', String(count));
                    } else {
                        if (wrap) wrap.style.display = 'none';
                        if (page) page.removeAttribute('data-agenda-repeat');
                    }
                    this._refreshExportSummary(root, pages_snapshot());
                });
            });

            root.querySelectorAll('.agenda-page-repeat-input').forEach(inp => {
                inp.addEventListener('input', () => {
                    const pageId = inp.dataset.pageId;
                    const page = document.getElementById(pageId);
                    const count = Math.max(1, parseInt(inp.value, 10) || 1);
                    if (page) page.setAttribute('data-agenda-repeat', String(count));
                    this._refreshExportSummary(root, pages_snapshot());
                });
            });

            const pages_snapshot = () => [...editor.querySelectorAll('.craftools-page')];

            // ── Aba 2: Pré-visualização (recarrega ao abrir o acordeão) ──────
            const previewHeader = root.querySelector('[data-toggle-accordion="agenda-preview"]');
            if (previewHeader) {
                previewHeader.addEventListener('click', () => {
                    const body = root.querySelector('#agenda-preview-body');
                    if (body) this._populatePreview(body, pages_snapshot());
                });
            }

            // ── Aba 3: Ações / Exportar ───────────────────────────────────────
            const exportBtn = root.querySelector('#agenda-export-btn');
            if (exportBtn) {
                exportBtn.addEventListener('click', async () => {
                    const currentPages = pages_snapshot();
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
                        console.error('[AgendaExportTool] Falha ao exportar Agenda:', err);
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

    // ── Aba 1: Páginas ────────────────────────────────────────────────────────

    static _renderPagesSection(pages) {
        if (!pages.length) {
            return `<p style="font-size:12px; color:var(--text-secondary);">${a('noPagesFound')}</p>`;
        }

        const cards = pages.map((page, idx) => {
            const size = PdfExport._parsePageSize(page);
            const repeatCount = parseInt(page.dataset.agendaRepeat, 10) || 1;
            const checked = repeatCount > 1;
            const boundCount = this._collectPageBindings(page).length;

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

    // ── Aba 2: Pré-visualização ──────────────────────────────────────────────

    static _renderPreviewSection() {
        return `<div id="agenda-preview-body">
            <p style="font-size:11px; color:var(--text-secondary);">${a('previewIntro')}</p>
        </div>`;
    }

    static async _populatePreview(container, pages) {
        const repeatedPages = pages.filter(p => (parseInt(p.dataset.agendaRepeat, 10) || 1) > 1);

        if (!repeatedPages.length) {
            container.innerHTML = `<p style="font-size:12px; color:var(--text-secondary);">${a('previewNoRepeats')}</p>`;
            return;
        }

        container.innerHTML = `<p style="font-size:11px; color:var(--text-secondary);">${a('previewIntro')}</p><p style="font-size:11px; color:var(--text-muted);">${I18n.t('variablePanel.previewLoading')}</p>`;

        // Coleta todos os bindings de todas as páginas repetidas para um único
        // prefetch de API (evita 1 fetch por elemento/repetição).
        const allBindings = [];
        repeatedPages.forEach(page => {
            this._collectPageBindings(page).forEach(({ binding }) => allBindings.push(binding));
        });
        const apiCache = await VariableEngine.prefetchApiResources(allBindings);

        const blocks = pages.map((page, idx) => {
            const repeatCount = parseInt(page.dataset.agendaRepeat, 10) || 1;
            const bindings = this._collectPageBindings(page);

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
                    return `<div style="display:flex; justify-content:space-between; gap:8px; font-size:11px; padding:3px 0;"><span style="color:var(--text-muted);">${a('previewRepetitionLabel')} ${repetitionIndex + 1}</span><span style="font-weight:500; word-break:break-word; text-align:right;">${this._esc(value) || '—'}</span></div>`;
                }).join('');
                return `
                    <div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border, #e4e4e7);">
                        <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.4px; color:var(--text-muted); margin-bottom:2px;">${this._toolTypeLabel(toolType)} — ${this._variableTypeLabel(binding.type)}</div>
                        ${samples}
                    </div>
                `;
            }).join('') : `<p style="font-size:11px; color:var(--text-muted); margin-top:6px;">${a('previewNoBindings')}</p>`;

            return `
                <div class="ct-field" style="border:1px solid var(--border, #e4e4e7); border-radius:8px; padding:10px; margin-bottom:8px;">
                    <div style="font-weight:600; font-size:12px;">${a('pageLabel')} ${idx + 1} — <span style="font-weight:400; color:var(--text-secondary);">${a('previewRepeatedPage').replace('{n}', repeatCount)}</span></div>
                    ${rows}
                </div>
            `;
        }).join('');

        container.innerHTML = `<p style="font-size:11px; color:var(--text-secondary); margin-bottom:8px;">${a('previewIntro')}</p>${blocks}`;
    }

    // ── Aba 3: Ações / Exportar ──────────────────────────────────────────────

    static _renderExportSection(pages) {
        const total = this._totalOutputPages(pages);
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

    static _refreshExportSummary(root, pages) {
        const el = root.querySelector('#agenda-total-pages');
        if (el) el.textContent = this._totalOutputPages(pages);
    }

    static _totalOutputPages(pages) {
        return pages.reduce((sum, p) => sum + Math.max(1, parseInt(p.dataset.agendaRepeat, 10) || 1), 0);
    }

    // ── Helpers compartilhados ────────────────────────────────────────────────

    /** Lê os bindings de variável dos elementos filhos de uma página (ao vivo, não em clones). */
    static _collectPageBindings(page) {
        const results = [];
        page.querySelectorAll('craftools-element').forEach(el => {
            const toolType = el.getAttribute('data-craftool');
            let binding = null;
            if (toolType === 'conteudovariavel') {
                binding = el._craftoolsVariable || null;
            } else if (toolType === 'qrcode' || toolType === 'barcode') {
                binding = el._craftoolsMeta?.variableBinding || null;
            }
            if (binding && binding.type) results.push({ el, toolType, binding });
        });
        return results;
    }

    static _toolTypeLabel(toolType) {
        const map = {
            conteudovariavel: I18n.t('editor.variableContent'),
            qrcode: I18n.t('editor.qrcode'),
            barcode: I18n.t('editor.barcode'),
        };
        return map[toolType] || toolType;
    }

    static _variableTypeLabel(type) {
        const map = {
            date: I18n.t('variablePanel.typeDate'),
            sequenceNumber: I18n.t('variablePanel.typeSequenceNumber'),
            sequenceText: I18n.t('variablePanel.typeSequenceText'),
            pageNumber: I18n.t('variablePanel.typePageNumber'),
            link: I18n.t('variablePanel.typeLink'),
            apiPhrase: I18n.t('variablePanel.typeApiPhrase'),
        };
        return map[type] || type;
    }

    static _esc(val) {
        return String(val == null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}
                                                 