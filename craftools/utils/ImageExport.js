/**
 * ImageExport — Exporta as páginas do editor como PNG ou JPG.
 *
 * Fluxo:
 *   1. Mostra dialog de opções (formato + resolução)
 *   2. Carrega html2canvas do CDN (cached após primeira chamada)
 *   3. Para cada .craftools-page: captura o DOM → canvas → blob → download
 *
 * Resolução:
 *   Baixa  1× — rápido, arquivos menores (ideal para web/preview)
 *   Média  2× — padrão redes sociais (Instagram, WhatsApp)
 *   Alta   3× — maior qualidade (impressão, ampliação)
 *
 * Limitações conhecidas do html2canvas:
 *   • mix-blend-mode nas imagens pode não renderizar (limitação do html2canvas)
 *   • Imagens de domínios externos sem CORS podem aparecer em branco
 */

import { Notify } from './Notify.js';
import { I18n }   from '../settings/Translations.js';
import './ImageExport_Translations.js';

const H2C_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

function _resolutions() {
    return [
        { id: 'low',    scale: 1, label: I18n.t('imageExport.resLowLabel'),    hint: I18n.t('imageExport.resLowHint') },
        { id: 'medium', scale: 2, label: I18n.t('imageExport.resMediumLabel'), hint: I18n.t('imageExport.resMediumHint') },
        { id: 'high',   scale: 3, label: I18n.t('imageExport.resHighLabel'),   hint: I18n.t('imageExport.resHighHint') },
    ];
}

export class ImageExport {

    // ── Entry point ────────────────────────────────────────────────────────────
    static async export(editor) {
        const opts = await this._showDialog();
        if (!opts) return;

        const pages = [...editor.querySelectorAll('.craftools-page')];
        if (!pages.length) {
            Notify.toast(I18n.t('imageExport.noPagesFound'), 'error');
            return;
        }

        const dismissLoading = Notify.toast(
            pages.length > 1
                ? I18n.t('imageExport.exportingPages').replace('{n}', pages.length)
                : I18n.t('imageExport.exportingPage'),
            'info',
            60_000
        );

        try {
            const h2c = await this._loadHtml2Canvas();

            // Deselect elements + hide snap/UI overlays before capture
            this._hideUI(editor);

            // Small frame to let deselect repaint
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

            for (let i = 0; i < pages.length; i++) {
                const canvas = await h2c(pages[i], {
                    scale:           opts.scale,
                    useCORS:         true,
                    allowTaint:      true,
                    backgroundColor: opts.format === 'jpg' ? '#ffffff' : null,
                    logging:         false,
                    // Ignore UI elements that shouldn't appear in the export
                    ignoreElements: (el) =>
                        el.classList?.contains('craftools-ctrlbar') ||
                        el.id === 'ct-snap-overlay'                 ||
                        el.classList?.contains('album-drag-handle') ||
                        el.classList?.contains('slot-drag-handle')  ||
                        el.classList?.contains('cell-edit-btn'),
                });

                const mimeType = opts.format === 'jpg' ? 'image/jpeg' : 'image/png';
                const quality  = opts.format === 'jpg' ? 0.92 : undefined;

                const blob = await new Promise(res => canvas.toBlob(res, mimeType, quality));
                if (!blob) {
                    Notify.toast(I18n.t('imageExport.pageError').replace('{n}', i + 1), 'error');
                    continue;
                }

                const suffix  = pages.length > 1 ? `-p${i + 1}` : '';
                const resLabel = _resolutions().find(r => r.scale === opts.scale)?.id || 'export';
                const filename = `craftools${suffix}-${resLabel}.${opts.format}`;

                this._triggerDownload(blob, filename);

                // Stagger downloads to avoid browser blocking them
                if (i < pages.length - 1) await new Promise(r => setTimeout(r, 400));
            }

            Notify.toast(
                pages.length > 1
                    ? I18n.t('imageExport.successMultiple').replace('{n}', pages.length)
                    : I18n.t('imageExport.successSingle'),
                'success'
            );
        } catch (err) {
            console.error('[ImageExport]', err);
            Notify.toast(I18n.t('imageExport.genericError'), 'error');
        } finally {
            dismissLoading?.();
            this._showUI(editor);
        }
    }

    // ── Options dialog ─────────────────────────────────────────────────────────
    static _showDialog() {
        return new Promise(resolve => {
            let selectedFormat = 'png';
            let selectedScale  = 2; // Média by default

            const overlay = document.createElement('div');
            overlay.style.cssText = [
                'position:fixed', 'inset:0', 'z-index:99999',
                'background:rgba(0,0,0,.52)',
                'display:flex', 'align-items:center', 'justify-content:center',
                'padding:16px', "font-family:'DM Sans',sans-serif",
            ].join(';');

            overlay.innerHTML = `
<div id="ie-box" style="
    background:var(--bg-panel,#fff);
    color:var(--text-primary,#18181b);
    border:1px solid var(--border,#e4e4e7);
    border-radius:14px;
    padding:22px 20px 18px;
    width:100%; max-width:340px;
    box-shadow:0 8px 48px rgba(0,0,0,.2);
">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;">
        <span class="material-symbols-outlined" style="font-size:20px;color:var(--accent,#f97316);">image</span>
        <span style="font-weight:700;font-size:15px;">${I18n.t('imageExport.dialogTitle')}</span>
    </div>

    <!-- Formato -->
    <div style="margin-bottom:14px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
                    color:var(--text-muted,#71717a);margin-bottom:6px;">${I18n.t('imageExport.format')}</div>
        <div style="display:flex;gap:6px;">
            <button data-fmt="png" class="ie-fmt-btn" style="
                flex:1;padding:8px 0;border-radius:8px;border:2px solid var(--accent,#f97316);
                background:var(--accent,#f97316);color:#fff;font-size:13px;font-weight:600;
                cursor:pointer;font-family:inherit;transition:all .15s;">
                PNG
            </button>
            <button data-fmt="jpg" class="ie-fmt-btn" style="
                flex:1;padding:8px 0;border-radius:8px;border:2px solid var(--border,#e4e4e7);
                background:var(--bg-input,#f4f4f5);color:var(--text-primary,#18181b);
                font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;">
                JPG
            </button>
        </div>
        <div id="ie-fmt-hint" style="font-size:10px;color:var(--text-muted,#71717a);margin-top:5px;min-height:14px;">
            ${I18n.t('imageExport.formatHintPng')}
        </div>
    </div>

    <!-- Resolução -->
    <div style="margin-bottom:20px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
                    color:var(--text-muted,#71717a);margin-bottom:6px;">${I18n.t('imageExport.resolution')}</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
            ${_resolutions().map(r => `
            <label data-scale="${r.scale}" class="ie-res-btn" style="
                display:flex;align-items:center;gap:10px;
                padding:9px 12px;border-radius:8px;
                border:2px solid ${r.scale === 2 ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};
                background:${r.scale === 2 ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)'};
                cursor:pointer;transition:all .15s;">
                <div style="
                    width:18px;height:18px;border-radius:50%;
                    border:2px solid ${r.scale === 2 ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};
                    background:${r.scale === 2 ? 'var(--accent,#f97316)' : 'transparent'};
                    flex-shrink:0;" class="ie-radio-dot"></div>
                <div>
                    <div style="font-weight:600;font-size:13px;">${r.label}</div>
                    <div style="font-size:10px;color:var(--text-muted,#71717a);">${r.hint}</div>
                </div>
            </label>`).join('')}
        </div>
    </div>

    <!-- Botões -->
    <div style="display:flex;gap:8px;">
        <button id="ie-cancel" style="
            flex:1;padding:9px 0;border-radius:8px;
            border:1px solid var(--border,#e4e4e7);
            background:var(--bg-input,#f4f4f5);
            color:var(--text-primary,#18181b);
            font-size:13px;cursor:pointer;font-family:inherit;">${I18n.t('common.cancel')}</button>
        <button id="ie-confirm" style="
            flex:2;padding:9px 0;border-radius:8px;border:none;
            background:var(--accent,#f97316);color:#fff;
            font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">
            <span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;">download</span>
            ${I18n.t('imageExport.exportBtn')}
        </button>
    </div>
</div>`;

            document.body.appendChild(overlay);

            const box = overlay.querySelector('#ie-box');
            const fmtHint = overlay.querySelector('#ie-fmt-hint');

            const FORMAT_HINTS = {
                png: I18n.t('imageExport.formatHintPng'),
                jpg: I18n.t('imageExport.formatHintJpg'),
            };

            // Format toggle
            overlay.querySelectorAll('.ie-fmt-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedFormat = btn.dataset.fmt;
                    fmtHint.textContent = FORMAT_HINTS[selectedFormat];
                    overlay.querySelectorAll('.ie-fmt-btn').forEach(b => {
                        const active = b.dataset.fmt === selectedFormat;
                        b.style.background    = active ? 'var(--accent,#f97316)'    : 'var(--bg-input,#f4f4f5)';
                        b.style.color         = active ? '#fff'                     : 'var(--text-primary,#18181b)';
                        b.style.borderColor   = active ? 'var(--accent,#f97316)'   : 'var(--border,#e4e4e7)';
                    });
                });
            });

            // Resolution toggle
            overlay.querySelectorAll('.ie-res-btn').forEach(label => {
                label.addEventListener('click', () => {
                    selectedScale = Number(label.dataset.scale);
                    overlay.querySelectorAll('.ie-res-btn').forEach(l => {
                        const active = Number(l.dataset.scale) === selectedScale;
                        l.style.borderColor = active ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)';
                        l.style.background  = active ? 'rgba(249,115,22,.07)'  : 'var(--bg-input,#f4f4f5)';
                        const dot = l.querySelector('.ie-radio-dot');
                        dot.style.borderColor  = active ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)';
                        dot.style.background   = active ? 'var(--accent,#f97316)' : 'transparent';
                    });
                });
            });

            const close = (result) => {
                document.removeEventListener('keydown', onKey);
                overlay.remove();
                resolve(result);
            };

            const onKey = (e) => { if (e.key === 'Escape') close(null); };
            document.addEventListener('keydown', onKey);
            overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });

            overlay.querySelector('#ie-cancel').addEventListener('click',  () => close(null));
            overlay.querySelector('#ie-confirm').addEventListener('click', () => close({
                format: selectedFormat,
                scale:  selectedScale,
            }));
        });
    }

    // ── html2canvas loader (cached in window) ──────────────────────────────────
    static _loadHtml2Canvas() {
        if (window.html2canvas) return Promise.resolve(window.html2canvas);

        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${H2C_CDN}"]`);
            if (existing) {
                // Already injected but not yet loaded — wait for it
                existing.addEventListener('load',  () => resolve(window.html2canvas));
                existing.addEventListener('error', reject);
                return;
            }
            const script = document.createElement('script');
            script.src = H2C_CDN;
            script.addEventListener('load',  () => resolve(window.html2canvas));
            script.addEventListener('error', () => reject(new Error('Falha ao carregar html2canvas.')));
            document.head.appendChild(script);
        });
    }

    // ── UI hide/show ───────────────────────────────────────────────────────────
    static _hideUI(editor) {
        // Deselect all selected elements
        editor.querySelectorAll('craftools-element.craftools-selected')
              .forEach(el => el.deselect?.());
        // Hide snap guide overlays
        editor.querySelectorAll('#ct-snap-overlay')
              .forEach(el => { el._wasHidden = true; el.style.visibility = 'hidden'; });
    }

    static _showUI(editor) {
        editor.querySelectorAll('#ct-snap-overlay')
              .forEach(el => { el.style.visibility = ''; delete el._wasHidden; });
    }

    // ── Download trigger ───────────────────────────────────────────────────────
    static _triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15_000);
    }
}
