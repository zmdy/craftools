/**
 * Notify.ts — Substituto leve para alert()/confirm() nativos.
 * API:
 *   Notify.toast(message, type?, duration?) → () => void
 *   Notify.confirm(message, opts?)          → Promise<boolean>
 */

import { I18n } from '../settings/Translations.js';

type ToastType = 'info' | 'success' | 'error';

interface ConfirmOpts {
    confirmLabel?: string;
    cancelLabel?:  string;
    danger?:       boolean;
}

const TYPE_ICON: Record<ToastType, string> = {
    info:    'info',
    success: 'check_circle',
    error:   'error',
};

const TYPE_COLOR_VAR: Record<ToastType, string> = {
    info:    '--accent',
    success: '--success',
    error:   '--danger',
};

function ensureToastContainer(): HTMLElement {
    let container = document.getElementById('craftools-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'craftools-toast-container';
        container.style.cssText = `
            position: fixed; top: 16px; right: 16px; z-index: 99999;
            display: flex; flex-direction: column; gap: 8px;
            max-width: min(360px, calc(100vw - 32px));
            font-family: 'DM Sans', sans-serif;
        `;
        document.body.appendChild(container);
    }
    return container;
}

export const Notify = {
    toast(message: string, type: ToastType = 'info', duration = 4000): () => void {
        const container = ensureToastContainer();
        const colorVar  = TYPE_COLOR_VAR[type] ?? TYPE_COLOR_VAR.info;
        const icon      = TYPE_ICON[type]       ?? TYPE_ICON.info;

        const el = document.createElement('div');
        el.setAttribute('role', 'alert');
        el.style.cssText = `
            display: flex; align-items: flex-start; gap: 8px;
            background: var(--bg-panel, #fff); color: var(--text-primary, #18181b);
            border: 1px solid var(--border, #e4e4e7); border-left: 3px solid var(${colorVar}, #f97316);
            border-radius: 8px; padding: 10px 12px; box-shadow: var(--shadow-lg, 0 4px 24px rgba(0,0,0,.12));
            font-size: 13px; line-height: 1.4; opacity: 0; transform: translateY(-6px);
            transition: opacity .18s ease, transform .18s ease; cursor: pointer;
        `;
        el.innerHTML = `
            <span class="material-symbols-outlined" style="font-size:18px; color: var(${colorVar}, #f97316); flex-shrink:0;">${icon}</span>
            <span style="flex:1;">${message}</span>
        `;

        const dismiss = (): void => {
            el.style.opacity   = '0';
            el.style.transform = 'translateY(-6px)';
            setTimeout(() => el.remove(), 200);
        };
        el.addEventListener('click', dismiss);

        container.appendChild(el);
        requestAnimationFrame(() => {
            el.style.opacity   = '1';
            el.style.transform = 'translateY(0)';
        });

        if (duration > 0) setTimeout(dismiss, duration);
        return dismiss;
    },

    confirm(message: string, opts: ConfirmOpts = {}): Promise<boolean> {
        const {
            confirmLabel = I18n.t('common.confirm'),
            cancelLabel  = I18n.t('common.cancel'),
            danger       = false,
        } = opts;

        return new Promise<boolean>(resolve => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 99999;
                background: rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center;
                padding: 16px; font-family: 'DM Sans', sans-serif;
            `;

            const box = document.createElement('div');
            box.style.cssText = `
                background: var(--bg-panel, #fff); color: var(--text-primary, #18181b);
                border: 1px solid var(--border, #e4e4e7); border-radius: 12px;
                padding: 20px; width: 100%; max-width: 360px;
                box-shadow: var(--shadow-xl, 0 8px 48px rgba(0,0,0,.16));
            `;
            box.innerHTML = `
                <p style="margin:0 0 16px; font-size:14px; line-height:1.5;">${message}</p>
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button type="button" data-action="cancel" style="
                        padding:7px 14px; border-radius:7px; border:1px solid var(--border, #e4e4e7);
                        background: var(--bg-input, #f4f4f5); color: var(--text-primary, #18181b);
                        font-size:13px; cursor:pointer; font-family:inherit;">${cancelLabel}</button>
                    <button type="button" data-action="confirm" style="
                        padding:7px 14px; border-radius:7px; border:none;
                        background: ${danger ? 'var(--danger, #dc2626)' : 'var(--accent, #f97316)'}; color:#fff;
                        font-size:13px; cursor:pointer; font-family:inherit;">${confirmLabel}</button>
                </div>
            `;

            const close = (result: boolean): void => {
                document.removeEventListener('keydown', onKeydown);
                overlay.remove();
                resolve(result);
            };
            const onKeydown = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(false); };

            overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
            box.querySelector<HTMLElement>('[data-action="cancel"]')!.addEventListener('click',  () => close(false));
            box.querySelector<HTMLElement>('[data-action="confirm"]')!.addEventListener('click', () => close(true));
            document.addEventListener('keydown', onKeydown);

            overlay.appendChild(box);
            document.body.appendChild(overlay);
            box.querySelector<HTMLElement>('[data-action="confirm"]')!.focus();
        });
    },
};
