/**
 * PanelManager.ts — Centralized Panel Navigation & Async Render Session Manager.
 *
 * Prevents UI panel race conditions when the user switches rapidly between tools
 * or canvas elements. Guarantees that stale pending async module loads, panel setups,
 * or picker renders abort cleanly without corrupting or mixing DOM controls in #panel-body.
 */

export class PanelManager {
  private static _currentRequestId = 0;

  /**
   * Starts a new panel render session.
   * Increments the request ID, immediately clears #panel-body synchronously,
   * and wipes the previously tracked element reference.
   *
   * @returns The unique request ID for this render session.
   */
  public static startSession(): number {
    this._currentRequestId++;
    const requestId = this._currentRequestId;

    const panelBody = document.getElementById('panel-body');
    if (panelBody) {
      panelBody.dataset.panelRequestId = String(requestId);
      panelBody.innerHTML = '';
      delete (panelBody as unknown as { _ctRenderedElement?: HTMLElement })._ctRenderedElement;
    }

    return requestId;
  }

  /**
   * Checks if the given requestId is still the active session.
   * If the user clicked another tool or element in the meantime, returns false.
   */
  public static isValid(requestId: number): boolean {
    if (requestId !== this._currentRequestId) {
      return false;
    }
    const panelBody = document.getElementById('panel-body');
    if (panelBody && panelBody.dataset.panelRequestId) {
      return panelBody.dataset.panelRequestId === String(requestId);
    }
    return true;
  }

  /**
   * Returns the current active request ID.
   */
  public static get currentRequestId(): number {
    return this._currentRequestId;
  }
}
