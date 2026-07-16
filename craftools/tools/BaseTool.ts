/**
 * BaseTool.ts — Abstract base class for all CrafTools tools (TypeScript version).
 *
 * Migration note:
 *   - Existing tools still import from 'BaseTool.js' (explicit extension) and
 *     are unaffected by this file.
 *   - New .ts tools import from 'BaseTool' (no extension) and get this file.
 *   - Once a tool is migrated to .ts, delete the old .js file and update its import.
 *
 * Contract:
 *   Every tool MUST implement `getPropertySchema()`.
 *   Tools MUST NOT override `renderPropertiesPanel()` — override the schema instead.
 *   Tools MAY override `_applyProperty()` for custom state-write logic.
 */

import type { PropertySchema } from '../types/PropertySchema';
import { PropertyRenderer } from '../utils/PropertyRenderer';
import { SnapEngine } from '../utils/SnapEngine.js';
import { Notify } from '../utils/Notify.js';
import { tr } from '../utils/i18nLabel';

// Shape of the clipboard payload copied by the style bar. Kept loose
// (unknown meta) since `_craftoolsMeta`'s shape varies per tool.
interface ClipboardStyle {
  type: string | null;
  cssText: string;
  zIndex: string;
  meta: unknown;
}

export abstract class BaseTool {
  // ── Schema contract ─────────────────────────────────────────────────────────

  /**
   * Returns the property panel descriptor for this tool.
   *
   * Called every time an element of this tool type is selected.
   * Must return a pure data structure — no DOM, no HTML strings.
   *
   * @param element - The selected canvas element. Use it to read current
   *                  state and conditionally show/hide fields.
   */
  /**
   * Returns context-bar action descriptors for the selected element.
   * Override in tools that provide quick-action buttons (format, crop, etc.).
   */
  static getCtxOptions(_element?: HTMLElement): unknown[] {
    return [];
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    // Subclasses must override this.
    return [];
  }

  // ── Rendering (do NOT override) ─────────────────────────────────────────────

  /**
   * Renders (or updates) the property panel.
   *
   * This is the final implementation — tools should not override it.
   * Override `getPropertySchema()` to change what appears in the panel.
   */
  static renderPropertiesPanel(container: HTMLElement, element: HTMLElement): void {
    // Sticky Copy/Paste/Lock bar, always rendered above the accordions --
    // matches the legacy CommonProperties.renderEstiloBar() bar every
    // .js tool got automatically via renderCommonProperties().
    this._renderStyleBar(container, element);

    // Prime dataset.ctState from existing DOM/meta state (first render only).
    this._syncFromDOM(element);
    const schema = this.getPropertySchema(element);
    PropertyRenderer.render(container, schema, element, (key, value) => {
      this._applyProperty(element, key, value);
    });
  }

  /**
   * Returns the DOM node whose inline styles (border/radius/padding/margin/
   * etc.) the style bar's Copy/Paste buttons read from and write to.
   *
   * Defaults to the canvas element itself. Override when a tool keeps its
   * visual styling on an inner node instead (e.g. TextTool.ts applies
   * border/radius to its `[contenteditable]` child, not the outer element).
   */
  protected static _getStyleTarget(element: HTMLElement): HTMLElement {
    return element;
  }

  /**
   * Primes `dataset.ctState` from the element's existing DOM or meta state.
   *
   * Called once before the first panel render. Tools that store state outside
   * `dataset.ctState` (CSS styles, `_craftoolsMeta`, etc.) must override this
   * to populate the JSON state store so PropertyRenderer can read initial values.
   *
   * Only writes keys that are not already present — safe to call on re-renders.
   */
  protected static _syncFromDOM(_element: HTMLElement): void {
    // Default: no-op. Subclasses override as needed.
  }

  // ── State management ────────────────────────────────────────────────────────

  /**
   * Applies a single property change to the element.
   *
   * Default implementation writes to `data-ct-state` (JSON) and dispatches
   * `craftools-state-change`. Override for tools that need imperative DOM
   * mutations (e.g. SVG tools that must call `_render()` after each change).
   *
   * @param element - The canvas element to update.
   * @param key     - The field key from the schema.
   * @param value   - The new value from the field handler.
   */
  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    // 'pageAlign' (from CommonSchema.ts's pageAlignSection()) is a
    // fire-and-forget action, not a persisted property: it just re-runs
    // SnapEngine's page-alignment math against the element's current size.
    // Nothing to write to dataset.ctState for it.
    if (key === 'pageAlign') {
      SnapEngine.align(element, value as string);
      return;
    }

    // 'autoFit' (from CommonSchema.ts's sizePositionSection({ autoFit: true }))
    // toggles the `_craftoolsAutoResize` expando that AutoFitText.js and the
    // legacy panel already key off of (see CommonProperties.js's
    // _appendTamanho()) -- kept in sync here so any tool that spreads in
    // sizePositionSection() gets working W/H-disable-while-autofit behavior
    // for free, even without overriding _applyProperty(). Tools that also
    // need to trigger an immediate resize on toggle (e.g. TextTool) should
    // override _applyProperty() and call AutoFitText.applyAutoSize() there.
    if (key === 'autoFit') {
      (element as unknown as { _craftoolsAutoResize?: boolean })._craftoolsAutoResize = !!value;
    }

    PropertyRenderer.applyChange(element, key, value);
  }

  /**
   * Reads the current state object from the element.
   * Convenience wrapper around PropertyRenderer._readState().
   */
  protected static _readState(element: HTMLElement): Record<string, unknown> {
    return PropertyRenderer._readState(element);
  }

  // ── Style bar (Copy/Paste/Lock) ──────────────────────────────────────────────

  /**
   * Renders (or updates) the sticky Copy/Paste/Lock bar at the very top of
   * the panel container -- a faithful port of CommonProperties.js's
   * renderEstiloBar(). Not an accordion section: always visible, above
   * everything getPropertySchema() returns.
   *
   * `container` is reused by Editor.ts across element selections (it's
   * never cleared), so the bar itself is only created once, but its
   * buttons' click listeners are always rebound against the CURRENTLY
   * selected `element` on every call (via cloneNode, which drops old
   * listeners) -- otherwise a stale closure from the first-ever selection
   * would keep receiving every click forever.
   */
  private static _renderStyleBar(container: HTMLElement, element: HTMLElement): void {
    let bar = container.querySelector<HTMLElement>('.ct-copypaste-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'ct-copypaste-bar';
      bar.innerHTML = `
        <button type="button" class="craftools-pill" data-ct-bar="copy">
          <span class="material-symbols-outlined" style="font-size:13px;">content_copy</span>
          <span>${tr('common.copy', 'Copiar')}</span>
        </button>
        <button type="button" class="craftools-pill" data-ct-bar="paste">
          <span class="material-symbols-outlined" style="font-size:13px;">content_paste</span>
          <span>${tr('common.paste', 'Colar')}</span>
        </button>
        <button type="button" class="craftools-pill" data-ct-bar="lock">
          <span class="material-symbols-outlined" style="font-size:13px;">lock_open</span>
          <span></span>
        </button>`;
      container.insertBefore(bar, container.firstChild);
    }

    const rawCopy  = bar.querySelector<HTMLButtonElement>('[data-ct-bar="copy"]')!;
    const rawPaste = bar.querySelector<HTMLButtonElement>('[data-ct-bar="paste"]')!;
    const rawLock  = bar.querySelector<HTMLButtonElement>('[data-ct-bar="lock"]')!;

    // Strip any listeners left over from a previous selection.
    const btnCopy  = rawCopy.cloneNode(true) as HTMLButtonElement;
    const btnPaste = rawPaste.cloneNode(true) as HTMLButtonElement;
    const btnLock  = rawLock.cloneNode(true) as HTMLButtonElement;
    rawCopy.replaceWith(btnCopy);
    rawPaste.replaceWith(btnPaste);
    rawLock.replaceWith(btnLock);

    this._updateLockButton(btnLock, element.getAttribute('data-locked') === 'true');

    const target = this._getStyleTarget(element);

    btnCopy.addEventListener('click', () => {
      const meta = (element as unknown as { _craftoolsMeta?: unknown })._craftoolsMeta;
      (window as unknown as { __craftoolsClipboardStyle?: ClipboardStyle }).__craftoolsClipboardStyle = {
        type:    element.getAttribute('data-craftool'),
        cssText: target.style.cssText,
        zIndex:  element.style.zIndex,
        meta:    meta ? JSON.parse(JSON.stringify(meta)) : null,
      };
      const orig = btnCopy.innerHTML;
      btnCopy.innerHTML = `<span class="material-symbols-outlined" style="font-size:13px;color:var(--accent);">check</span> ${tr('common.copied', 'Copiado')}`;
      setTimeout(() => { btnCopy.innerHTML = orig; }, 1500);
    });

    btnPaste.addEventListener('click', () => {
      const clip = (window as unknown as { __craftoolsClipboardStyle?: ClipboardStyle }).__craftoolsClipboardStyle;
      if (!clip) {
        Notify.toast(tr('common.noStyleCopied', 'Nenhum estilo copiado'), 'error');
        return;
      }
      if (clip.type !== element.getAttribute('data-craftool')) {
        Notify.toast(tr('common.incompatibleStyleTypes', 'Tipos de elemento incompatíveis'), 'error');
        return;
      }

      target.style.cssText = clip.cssText;
      if (clip.zIndex) element.style.zIndex = clip.zIndex;

      const meta = (element as unknown as { _craftoolsMeta?: Record<string, unknown> })._craftoolsMeta;
      if (clip.meta && meta) {
        const incoming = { ...(clip.meta as Record<string, unknown>) };
        if (meta.src) incoming.src = meta.src;
        Object.assign(meta, incoming);
      }

      // The pasted CSS bypasses every field's own onChange, so
      // dataset.ctState is now stale (it still holds the pre-paste values).
      // Drop it entirely so the next _syncFromDOM() -- triggered by the
      // re-select below -- rebuilds it fresh from the just-pasted styles,
      // instead of _syncFromDOM's "only fill in missing keys" guard
      // preserving the old cached values.
      delete element.dataset.ctState;

      element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
      (element as unknown as { _syncSidebar?: () => void })._syncSidebar?.();

      // Re-select to force a fresh renderPropertiesPanel() with the
      // now-current styles (same trick as the legacy panel).
      setTimeout(() => {
        const rect = element.getBoundingClientRect();
        element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.x + 10, clientY: rect.y + 10 }));
        element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      }, 50);
    });

    btnLock.addEventListener('click', () => {
      const nowLocked = element.getAttribute('data-locked') !== 'true';
      element.setAttribute('data-locked', nowLocked ? 'true' : 'false');
      (element as unknown as { _syncLockUI?: () => void })._syncLockUI?.();
      this._updateLockButton(btnLock, nowLocked);
      element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
    });
  }

  /** Paints the lock button's icon/label/active-state/title for the given locked state. */
  private static _updateLockButton(btn: HTMLButtonElement, isLocked: boolean): void {
    btn.classList.toggle('active', isLocked);
    const icon  = btn.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = isLocked ? 'lock' : 'lock_open';
    const label = btn.querySelector('span:last-child');
    if (label) label.textContent = isLocked ? tr('common.locked', 'Bloqueado') : tr('common.lock', 'Bloquear');
    btn.title = isLocked
      ? tr('common.unlockElement', 'Desbloquear elemento')
      : tr('common.lockElement', 'Bloquear elemento (impede mover/redimensionar)');
  }

  // ── ToolRegistry integration ────────────────────────────────────────────────

  /**
   * The canvas element keys this tool handles (e.g. ['titulo', 'paragrafo']).
   *
   * Set by the tool's ToolRegistry.register() calls at the end of its file.
   * Used by CraftoolsConfig to resolve which registry entries to activate
   * when `tools: [TextTool]` is passed to the constructor.
   */
  static registeredKeys: string[] = [];
}
