/**
 * UIErrorBoundary.ts — Panel error boundary and graceful UI recovery wrapper.
 *
 * Catches unhandled runtime exceptions during tool panel mounting/setup and renders
 * a clean recovery UI inside the sidebar panel instead of locking up the editor.
 */

import { Notify } from './Notify.js';
import { PanelManager } from './PanelManager.js';

export class UIErrorBoundary {
  /**
   * Wraps a panel setup function with error boundary protection.
   */
  public static wrap(
    toolName: string,
    setupFn: (editor: HTMLElement, ...args: unknown[]) => void | Promise<void>
  ): (editor: HTMLElement, ...args: unknown[]) => Promise<void> {
    return async (editor: HTMLElement, ...args: unknown[]) => {
      const reqId = PanelManager.currentRequestId;
      try {
        await setupFn(editor, ...args);
      } catch (err) {
        if (!PanelManager.isValid(reqId)) return;
        console.error(`[UIErrorBoundary] Error mounting panel for tool "${toolName}":`, err);
        this.renderFallbackUI(toolName, editor, () => this.wrap(toolName, setupFn)(editor, ...args));
      }
    };
  }

  /**
   * Renders a clean recovery UI in panelBody when a tool panel setup fails.
   */
  public static renderFallbackUI(
    toolName: string,
    _editor: HTMLElement,
    retryCallback: () => void
  ): void {
    const panelTitle = document.getElementById('panel-title');
    const panelBody  = document.getElementById('panel-body');

    if (panelTitle) panelTitle.textContent = toolName || 'Erro de Carregamento';
    if (!panelBody) return;

    panelBody.innerHTML = `
      <div style="padding: 24px 16px; text-align: center; color: var(--text-secondary, #9ca3af);">
        <span class="material-symbols-outlined" style="font-size: 42px; color: var(--accent, #f97316); margin-bottom: 12px; display: block;">
          healing
        </span>
        <div style="font-size: 14px; font-weight: 700; color: var(--text-primary, #ffffff); margin-bottom: 6px;">
          Não foi possível carregar o painel
        </div>
        <div style="font-size: 11px; margin-bottom: 18px; line-height: 1.4;">
          Ocorreu uma oscilação ao carregar os módulos da ferramenta <strong>${toolName}</strong>.
        </div>
        <button id="ui-boundary-retry-btn" class="craftools-topbtn" style="width: 100%; justify-content: center; background: var(--accent, #f97316); color: #ffffff; border: none; margin-bottom: 14px;">
          <span class="material-symbols-outlined" style="font-size: 16px;">refresh</span>
          Tentar Novamente
        </button>
        <p style="font-size: 11px; color: var(--text-muted, #71717a); margin: 0;">
          Se o problema persistir,
          <a id="ui-boundary-reload-link" href="#" style="color: var(--text-muted, #71717a); text-decoration: underline; cursor: pointer;">recarregue a página</a>.
        </p>
      </div>
    `;

    const retryBtn = panelBody.querySelector<HTMLButtonElement>('#ui-boundary-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        panelBody.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">Reconectando ferramenta...</div>';
        retryCallback();
      });
    }

    const reloadLink = panelBody.querySelector<HTMLAnchorElement>('#ui-boundary-reload-link');
    if (reloadLink) {
      reloadLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.reload();
      });
    }

    Notify.toast('Ocorreu uma oscilação temporária ao abrir a ferramenta.', 'warning');
  }
}
