/**
 * ImageExport.ts — Exporta as páginas do editor como PNG ou JPG via html2canvas.
 */

import { Notify } from './Notify.js';
import { I18n }   from '../settings/Translations.js';
import './ImageExport_Translations.js';
import { ExportNormalizer } from './ExportNormalizer.js';
import { CropMarks } from './CropMarks.js';
// Vendored via npm (previously loaded on first use from a cdnjs CDN <script>
// injected at runtime, see _loadHtml2Canvas() below pre-migration) -- Vite
// bundles it into dist/assets/*.js on build, so PNG/JPG export no longer
// depends on a third-party network request the first time it's used.
import html2canvas from 'html2canvas';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExportOptions {
    format: string;
    scale:  number;
}

interface Resolution {
    id:    string;
    scale: number;
    label: string;
    hint:  string;
}

function _resolutions(): Resolution[] {
    return [
        { id: 'low',    scale: 1, label: I18n.t('imageExport.resLowLabel'),    hint: I18n.t('imageExport.resLowHint') },
        { id: 'medium', scale: 2, label: I18n.t('imageExport.resMediumLabel'), hint: I18n.t('imageExport.resMediumHint') },
        { id: 'high',   scale: 3, label: I18n.t('imageExport.resHighLabel'),   hint: I18n.t('imageExport.resHighHint') },
    ];
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class ImageExport {

    static async export(editor: HTMLElement): Promise<void> {
        const opts = await this._showDialog();
        if (!opts) return;

        const pages = [...editor.querySelectorAll<HTMLElement>('.craftools-page')];
        if (!pages.length) { Notify.toast(I18n.t('imageExport.noPagesFound'), 'error'); return; }

        const dismissLoading = Notify.toast(
            pages.length > 1
                ? I18n.t('imageExport.exportingPages').replace('{n}', String(pages.length))
                : I18n.t('imageExport.exportingPage'),
            'info',
            60_000
        );

        try {
            this._hideUI(editor);
            await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

            // Create off-screen stage attached to body for rendering
            const stage = document.createElement('div');
            stage.style.cssText = 'position:fixed; left:-99999px; top:0; z-index:-1; pointer-events:none;';
            document.body.appendChild(stage);

            try {
              for (let i = 0; i < pages.length; i++) {
                  const origPage = pages[i];
                  const pageClone = origPage.cloneNode(true) as HTMLElement;
                  
                  // Match dimensions of original page
                  pageClone.style.width = origPage.style.width || getComputedStyle(origPage).width;
                  pageClone.style.height = origPage.style.height || getComputedStyle(origPage).height;

                  stage.appendChild(pageClone);

                  // Normalize images, object-fit, auto-enhancement and text styles
                  await ExportNormalizer.normalizePage(pageClone);

                  // Album grid-aligned crop marks (independent of the
                  // page-level ones below) -- appends an overlay <svg>
                  // directly onto `pageClone`, so it must run before
                  // `pageClone.outerHTML` is captured just below. No-op if
                  // this page has no `.craftools-grid-container` or the
                  // feature is off.
                  CropMarks.applyGridMarksToClone(origPage, pageClone, pageClone.style.width, pageClone.style.height);

                  // Crop marks / bleed -- see CropMarks.ts's doc comment.
                  // Re-wraps the (already normalized) page markup in a
                  // larger bled canvas with an overlay <svg> of marks, then
                  // re-injects it into `stage` so html2canvas captures the
                  // enlarged canvas instead of just the trim-sized page.
                  // No-op (captureTarget stays `pageClone`) when this page
                  // has neither crop marks nor bleed configured.
                  const trimWidthCss  = pageClone.style.width;
                  const trimHeightCss = pageClone.style.height;
                  const bgColor = origPage.style.background || origPage.style.backgroundColor || '#ffffff';
                  const bleedWrap = CropMarks.wrapHtmlWithBleed(pageClone.outerHTML, trimWidthCss, trimHeightCss, bgColor, origPage);

                  let captureTarget: HTMLElement = pageClone;
                  if (bleedWrap.marginPx > 0) {
                      stage.innerHTML = bleedWrap.html;
                      captureTarget = stage.firstElementChild as HTMLElement;
                  }

                  const canvas = await html2canvas(captureTarget, {
                      scale:           opts.scale,
                      useCORS:         true,
                      allowTaint:      true,
                      backgroundColor: opts.format === 'jpg' ? '#ffffff' : null,
                      logging:         false,
                      ignoreElements:  (el: Element) =>
                          el.classList?.contains('craftools-ctrlbar')  ||
                          el.id === 'ct-snap-overlay'                  ||
                          el.classList?.contains('album-drag-handle')  ||
                          el.classList?.contains('slot-drag-handle')   ||
                          el.classList?.contains('cell-edit-btn'),
                  });

                  stage.innerHTML = '';

                  const mimeType = opts.format === 'jpg' ? 'image/jpeg' : 'image/png';
                  const quality  = opts.format === 'jpg' ? 0.92 : undefined;

                  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, mimeType, quality));
                  if (!blob) {
                      Notify.toast(I18n.t('imageExport.pageError').replace('{n}', String(i + 1)), 'error');
                      continue;
                  }

                  const suffix   = pages.length > 1 ? `-p${i + 1}` : '';
                  const resLabel = _resolutions().find(r => r.scale === opts.scale)?.id ?? 'export';
                  this._triggerDownload(blob, `craftools${suffix}-${resLabel}.${opts.format}`);

                  if (i < pages.length - 1) await new Promise<void>(r => setTimeout(r, 400));
              }
            } finally {
              stage.remove();
            }

            Notify.toast(
                pages.length > 1
                    ? I18n.t('imageExport.successMultiple').replace('{n}', String(pages.length))
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

    // ── Dialog ────────────────────────────────────────────────────────────────

    private static _showDialog(): Promise<ExportOptions | null> {
        return new Promise<ExportOptions | null>(resolve => {
            let selectedFormat = 'png';
            let selectedScale  = 2;

            const overlay = document.createElement('div');
            overlay.style.cssText = [
                'position:fixed','inset:0','z-index:99999',
                'background:rgba(0,0,0,.52)',
                'display:flex','align-items:center','justify-content:center',
                'padding:16px',"font-family:'DM Sans',sans-serif",
            ].join(';');

            overlay.innerHTML = `
<div id="ie-box" style="
    background:var(--bg-panel,#fff);color:var(--text-primary,#18181b);
    border:1px solid var(--border,#e4e4e7);border-radius:14px;
    padding:22px 20px 18px;width:100%;max-width:340px;
    box-shadow:0 8px 48px rgba(0,0,0,.2);">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;">
        <span class="material-symbols-outlined" style="font-size:20px;color:var(--accent,#f97316);">image</span>
        <span style="font-weight:700;font-size:15px;">${I18n.t('imageExport.dialogTitle')}</span>
    </div>
    <div style="margin-bottom:14px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted,#71717a);margin-bottom:6px;">${I18n.t('imageExport.format')}</div>
        <div style="display:flex;gap:6px;">
            <button data-fmt="png" class="ie-fmt-btn" style="flex:1;padding:8px 0;border-radius:8px;border:2px solid var(--accent,#f97316);background:var(--accent,#f97316);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">PNG</button>
            <button data-fmt="jpg" class="ie-fmt-btn" style="flex:1;padding:8px 0;border-radius:8px;border:2px solid var(--border,#e4e4e7);background:var(--bg-input,#f4f4f5);color:var(--text-primary,#18181b);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">JPG</button>
        </div>
        <div id="ie-fmt-hint" style="font-size:10px;color:var(--text-muted,#71717a);margin-top:5px;min-height:14px;">${I18n.t('imageExport.formatHintPng')}</div>
    </div>
    <div style="margin-bottom:20px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted,#71717a);margin-bottom:6px;">${I18n.t('imageExport.resolution')}</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
            ${_resolutions().map(r => `
            <label data-scale="${r.scale}" class="ie-res-btn" style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;border:2px solid ${r.scale === 2 ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};background:${r.scale === 2 ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)'};cursor:pointer;">
                <div style="width:18px;height:18px;border-radius:50%;border:2px solid ${r.scale === 2 ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};background:${r.scale === 2 ? 'var(--accent,#f97316)' : 'transparent'};flex-shrink:0;" class="ie-radio-dot"></div>
                <div><div style="font-weight:600;font-size:13px;">${r.label}</div><div style="font-size:10px;color:var(--text-muted,#71717a);">${r.hint}</div></div>
            </label>`).join('')}
        </div>
    </div>
    <div style="display:flex;gap:8px;">
        <button id="ie-cancel" style="flex:1;padding:9px 0;border-radius:8px;border:1px solid var(--border,#e4e4e7);background:var(--bg-input,#f4f4f5);color:var(--text-primary,#18181b);font-size:13px;cursor:pointer;font-family:inherit;">${I18n.t('common.cancel')}</button>
        <button id="ie-confirm" style="flex:2;padding:9px 0;border-radius:8px;border:none;background:var(--accent,#f97316);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">
            <span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;">download</span>
            ${I18n.t('imageExport.exportBtn')}
        </button>
    </div>
</div>`;

            document.body.appendChild(overlay);
            const fmtHint = overlay.querySelector<HTMLElement>('#ie-fmt-hint')!;
            const FORMAT_HINTS: Record<string, string> = { png: I18n.t('imageExport.formatHintPng'), jpg: I18n.t('imageExport.formatHintJpg') };

            overlay.querySelectorAll<HTMLButtonElement>('.ie-fmt-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedFormat = btn.dataset.fmt ?? 'png';
                    fmtHint.textContent = FORMAT_HINTS[selectedFormat];
                    overlay.querySelectorAll<HTMLButtonElement>('.ie-fmt-btn').forEach(b => {
                        const active = b.dataset.fmt === selectedFormat;
                        b.style.background  = active ? 'var(--accent,#f97316)'  : 'var(--bg-input,#f4f4f5)';
                        b.style.color       = active ? '#fff'                    : 'var(--text-primary,#18181b)';
                        b.style.borderColor = active ? 'var(--accent,#f97316)'  : 'var(--border,#e4e4e7)';
                    });
                });
            });

            overlay.querySelectorAll<HTMLLabelElement>('.ie-res-btn').forEach(label => {
                label.addEventListener('click', () => {
                    selectedScale = Number(label.dataset.scale);
                    overlay.querySelectorAll<HTMLLabelElement>('.ie-res-btn').forEach(l => {
                        const active = Number(l.dataset.scale) === selectedScale;
                        l.style.borderColor = active ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)';
                        l.style.background  = active ? 'rgba(249,115,22,.07)'  : 'var(--bg-input,#f4f4f5)';
                        const dot = l.querySelector<HTMLElement>('.ie-radio-dot');
                        if (dot) { dot.style.borderColor = active ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'; dot.style.background = active ? 'var(--accent,#f97316)' : 'transparent'; }
                    });
                });
            });

            const close = (result: ExportOptions | null): void => {
                document.removeEventListener('keydown', onKey);
                overlay.remove();
                resolve(result);
            };
            const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(null); };
            document.addEventListener('keydown', onKey);
            overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
            overlay.querySelector<HTMLElement>('#ie-cancel')!.addEventListener('click',  () => close(null));
            overlay.querySelector<HTMLElement>('#ie-confirm')!.addEventListener('click', () => close({ format: selectedFormat, scale: selectedScale }));
        });
    }

    // ── UI helpers ────────────────────────────────────────────────────────────

    private static _hideUI(editor: HTMLElement): void {
        editor.querySelectorAll<HTMLElement & { deselect?(): void }>('craftools-element.craftools-selected')
              .forEach(el => el.deselect?.());
        editor.querySelectorAll<HTMLElement & { _wasHidden?: boolean }>('#ct-snap-overlay')
              .forEach(el => { el._wasHidden = true; el.style.visibility = 'hidden'; });
    }

    private static _showUI(editor: HTMLElement): void {
        editor.querySelectorAll<HTMLElement & { _wasHidden?: boolean }>('#ct-snap-overlay')
              .forEach(el => { el.style.visibility = ''; delete el._wasHidden; });
    }

    private static _triggerDownload(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15_000);
    }
}
