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
import type { CraftoolsSnapTarget } from '../utils/SnapEngine';
import { Notify } from '../utils/Notify.js';
import { tr } from '../utils/i18nLabel';
import { normalizeValue, cssFromValue, cssFromGradient, DEFAULT_VALUE } from '../utils/ColorPickerUI.js';

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
  static getCtxOptions(_element?: HTMLElement): any[] {
    return [];
  }

  /**
   * Builds a standardized "auto-fit" ctx-bar quick-action button: the
   * `arrow_range` icon, tinted accent-orange while `opts.isActive` is true
   * (see CtxBar.ts's CtxOption.isActive). Centralizes the "flip some
   * property via _applyProperty so state/panel/ctx-bar all stay in sync"
   * pattern shared by every tool with an auto-fit-like quick action --
   * started with TextTool's "auto-fit to text" toggle (element resizes to
   * its content), generalized here so e.g. ImageTool's "fit mode" cycle
   * (cover/contain/fill) reuses the exact same button/sync plumbing
   * instead of a second hand-rolled implementation.
   *
   * `opts.toggle` should mutate state via THIS tool's own `_applyProperty`
   * (same call the field itself would make) -- not touch the DOM/meta
   * directly -- so the change is indistinguishable from one made through
   * the panel. After it runs, the properties panel is re-rendered *if it's
   * currently showing this same element*, so a select/toggle field driven
   * by the same key reflects the new value immediately even while the
   * panel stays open -- normally only the field the user directly
   * interacted with refreshes itself; this covers changes made from
   * outside the panel (the ctx-bar).
   *
   * @param opts.isActive  Whether the feature is currently "on".
   * @param opts.toggle    Applies the next state for one click.
   * @param opts.label     Tooltip text (defaults to "Auto-fit").
   */
  protected static _autoFitCtxOption(opts: {
    isActive: (element: HTMLElement) => boolean;
    toggle: (element: HTMLElement) => void;
    label?: string;
  }): { icon: string; label: string; command: (element: HTMLElement) => void; isActive: (element: HTMLElement) => boolean } {
    return {
      icon: 'arrow_range',
      label: opts.label ?? 'Auto-fit',
      isActive: opts.isActive,
      command: (element: HTMLElement) => {
        opts.toggle(element);
        const panelBody = document.getElementById('panel-body') as (HTMLElement & { _ctRenderedElement?: HTMLElement }) | null;
        if (panelBody && panelBody._ctRenderedElement === element) {
          this.renderPropertiesPanel(panelBody, element);
        }
      },
    };
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    // Subclasses must override this.
    return [];
  }

  // ── Background fill (CommonSchema.ts's backgroundSection()) ────────────────

  /**
   * Finds (or creates) the dedicated background-fill layer for `element` --
   * a plain div painted BEHIND everything else in the element (inserted as
   * the very first child, `position:absolute;inset:0`), so a solid/gradient
   * fill + its own opacity can be applied without touching -- or fading --
   * the tool's real content (text, image, SVG, ...) painted on top of it.
   *
   * Always attached to `element` itself (the `<craftools-element>` host,
   * which Element.ts always keeps `position:absolute`), not to
   * `_getStyleTarget()` -- background is a whole-element concept, and the
   * host is guaranteed to be a stable positioned ancestor regardless of
   * which inner node a given tool uses as its border/radius style target.
   */
  private static _getOrCreateBgLayer(element: HTMLElement): HTMLElement {
    let layer = element.querySelector<HTMLElement>(':scope > .ct-bg-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'ct-bg-layer';
      layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;';
      element.insertBefore(layer, element.firstChild);
    }
    return layer;
  }

  /**
   * Paints the background-fill layer from already-resolved values -- no
   * reading or writing of `dataset.ctState`. Storage-agnostic on purpose:
   * most tools keep their properties in `dataset.ctState` (see
   * `_applyBackground()` below, the convenience wrapper for those), but a
   * few (ImageTool.ts, QRCodeTool.ts, BarcodeTool.ts) keep their own
   * `_craftoolsMeta` object as the source of truth instead -- those call
   * this directly with values read from their own meta, so background
   * painting stays identical either way without forcing a second,
   * conflicting state store on tools that already have one.
   *
   * @param fillRaw  Whatever's stored for the fill: a ColorPickerValue
   *   object, a JSON string of one, a bare hex string, or nothing --
   *   anything `normalizeValue()` (utils/ColorPickerUI.ts) accepts.
   * @param opacity  0-1. Non-numeric/missing defaults to fully opaque.
   */
  protected static _paintBackground(element: HTMLElement, fillRaw: unknown, opacity: unknown): void {
    const layer = this._getOrCreateBgLayer(element);
    layer.style.background = cssFromValue(normalizeValue(fillRaw));
    const n = Number(opacity);
    layer.style.opacity = String(Number.isFinite(n) ? n : 1);
  }

  /**
   * Applies the 'background'/'backgroundOpacity' keys from
   * CommonSchema.ts's backgroundSection() for tools using the default
   * `dataset.ctState` store. Call from a tool's own `_applyProperty()`
   * override for those two keys -- returns `true` when it handled the key
   * (so the caller can early-return) and `false` for anything else, so it
   * composes with a tool's existing switch:
   *
   *   protected static _applyProperty(element, key, value) {
   *     if (this._applyBackground(element, key, value)) return;
   *     ...tool-specific keys...
   *   }
   *
   * Persists the raw value via PropertyRenderer.applyChange() itself (same
   * as every other field), then repaints via `_paintBackground()` from the
   * combined state -- so changing either the fill or the opacity alone
   * still reads the other's current value correctly. Tools with their own
   * meta store should call `_paintBackground()` directly instead (see its
   * own doc comment).
   */
  protected static _applyBackground(element: HTMLElement, key: string, value: unknown): boolean {
    if (key !== 'background' && key !== 'backgroundOpacity') return false;

    PropertyRenderer.applyChange(element, key, value);
    const state = this._readState(element);
    this._paintBackground(element, state.background, state.backgroundOpacity);
    return true;
  }

  /**
   * Primes the 'background'/'backgroundOpacity' keys in `dataset.ctState`
   * with a transparent, fully-opaque default -- call once from a tool's
   * `_syncFromDOM()` override (only fills in keys that aren't already
   * present, same "safe to call repeatedly" contract as the rest of
   * `_syncFromDOM`). Elements created before this feature existed simply
   * have no background layer painted until the user picks one.
   */
  protected static _syncBackgroundState(element: HTMLElement): void {
    const existing = this._readState(element);
    const patch: Record<string, unknown> = {};
    if (!('background' in existing)) {
      patch.background = JSON.stringify({ mode: 'solid', solid: 'transparent', gradient: { ...DEFAULT_VALUE.gradient, stops: DEFAULT_VALUE.gradient.stops.slice() } });
    }
    if (!('backgroundOpacity' in existing)) {
      patch.backgroundOpacity = 1;
    }
    if (Object.keys(patch).length) {
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
    }
  }

  // ── Border (CommonSchema.ts's borderSection(), gradient-capable) ───────────

  /**
   * Paints border width/style/color from already-resolved values -- no
   * reading or writing of `dataset.ctState` (same storage-agnostic split as
   * `_paintBackground()`; see its doc comment for why). ImageTool.ts/
   * QRCodeTool.ts/BarcodeTool.ts, which keep border state in their own
   * `_craftoolsMeta`, call this directly with values read from that meta
   * instead of going through `_applyBorder()`/`dataset.ctState`.
   *
   * `colorRaw` is stored the same way a `background` fill is (a JSON
   * ColorPickerValue string, a bare hex string, or a ColorPickerValue
   * object -- anything `normalizeValue()` accepts) so a gradient border is
   * possible: CSS has no gradient `border-color`, so gradient mode renders
   * via `border-image` instead (`border-image-source` +
   * `border-image-slice:1`), which requires `border-style` to not be `none`
   * and `border-width` > 0 to be visible, same as a normal solid border.
   * Solid mode clears any leftover `border-image` so it doesn't mask a
   * later plain-color change.
   */
  protected static _paintBorder(target: HTMLElement, widthRaw: unknown, styleRaw: unknown, colorRaw: unknown): void {
    target.style.borderWidth = `${Number(widthRaw) || 0}px`;
    target.style.borderStyle = String(styleRaw || 'none');

    const colorValue = normalizeValue(colorRaw);
    if (colorValue.mode === 'gradient') {
      target.style.borderColor       = 'transparent';
      target.style.borderImageSlice  = '1';
      target.style.borderImageSource = cssFromGradient(colorValue.gradient);
    } else {
      target.style.borderImageSource = 'none';
      target.style.borderColor       = colorValue.solid;
    }
  }

  /**
   * Applies the 'borderWidth'/'borderColor'/'borderStyle' keys from
   * CommonSchema.ts's borderSection() to `_getStyleTarget(element)`, for
   * tools using the default `dataset.ctState` store. Call from a tool's own
   * `_applyProperty()` override the same way as `_applyBackground()`
   * (returns `true` when it handled the key):
   *
   *   protected static _applyProperty(element, key, value) {
   *     if (this._applyBorder(element, key, value)) return;
   *     ...tool-specific keys...
   *   }
   *
   * Tools with their own meta store should call `_paintBorder()` directly
   * instead (see its own doc comment).
   */
  protected static _applyBorder(element: HTMLElement, key: string, value: unknown): boolean {
    if (key !== 'borderWidth' && key !== 'borderColor' && key !== 'borderStyle') return false;

    PropertyRenderer.applyChange(element, key, value);
    const state = this._readState(element);
    this._paintBorder(this._getStyleTarget(element), state.borderWidth, state.borderStyle, state.borderColor);
    return true;
  }

  /**
   * Primes the 'borderWidth'/'borderColor'/'borderStyle' keys in
   * `dataset.ctState` -- call once from a tool's `_syncFromDOM()` override.
   * `opts` lets a tool seed from its own pre-existing meta (e.g. ImageTool's
   * `_craftoolsMeta.borderColor`, a plain hex string) instead of always
   * defaulting to black/none; omit for a tool with no prior border state.
   */
  protected static _syncBorderState(
    element: HTMLElement,
    opts: { width?: number; color?: string; style?: string } = {},
  ): void {
    const existing = this._readState(element);
    const patch: Record<string, unknown> = {};
    if (!('borderWidth' in existing)) patch.borderWidth = opts.width ?? 0;
    if (!('borderStyle' in existing)) patch.borderStyle = opts.style ?? 'none';
    if (!('borderColor' in existing)) {
      patch.borderColor = JSON.stringify({ mode: 'solid', solid: opts.color ?? '#000000', gradient: { ...DEFAULT_VALUE.gradient, stops: DEFAULT_VALUE.gradient.stops.slice() } });
    }
    if (Object.keys(patch).length) {
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
    }
  }

  // ── Text color (solid-or-gradient, CommonSchema-free -- see each tool's own 'color' field) ──

  /**
   * Paints solid-or-gradient text color onto `target` from an
   * already-resolved value -- no reading or writing of `dataset.ctState`,
   * same storage-agnostic shape as `_paintBackground()`/`_paintBorder()`.
   * CSS has no native gradient `color`, so gradient mode fakes it with the
   * standard `background-clip: text` trick (paint the gradient as a
   * background, clip it to the glyph shapes, and make the real text color
   * transparent so the clipped background shows through instead).
   *
   * Originated in TextTool.ts (typed text always needed this); extracted
   * here so VariableContentTool.ts and any other plain-text tool get
   * identical gradient-text rendering for free instead of re-implementing
   * the same four-property dance.
   *
   * @param colorRaw  A ColorPickerValue object, a JSON string of one, a
   *   bare hex string, or nothing -- anything `normalizeValue()` accepts.
   */
  protected static _paintTextColor(target: HTMLElement, colorRaw: unknown): void {
    const value = normalizeValue(colorRaw);
    if (value.mode === 'gradient') {
      target.style.background           = cssFromValue(value);
      target.style.webkitBackgroundClip = 'text';
      target.style.webkitTextFillColor  = 'transparent';
      target.style.backgroundClip       = 'text';
    } else {
      target.style.background           = '';
      target.style.webkitBackgroundClip = '';
      target.style.webkitTextFillColor  = '';
      target.style.backgroundClip       = '';
      target.style.color                = value.solid;
    }
  }

  // ── Internal (content) alignment (CommonSchema.ts's contentAlignSection()) ──

  /**
   * Applies the 'contentAlign' key from CommonSchema.ts's
   * contentAlignSection() -- call from a tool's own `_applyProperty()`
   * override the same way as `_applyBackground()`/`_applyBorder()` (returns
   * `true` when it handled the key):
   *
   *   protected static _applyProperty(element, key, value) {
   *     if (this._applyTextContentAlign(element, key, value)) return;
   *     ...tool-specific keys...
   *   }
   *
   * Shared by TextTool.ts (title/paragraph) and VariableContentTool.ts,
   * whose text-holding node is found the same generic way here --
   * `[contenteditable]` (VariableContentTool sets `contenteditable="false"`
   * on its resolved-content div, but the ATTRIBUTE is still present, which
   * is all this selector checks) -- so neither tool needs its own copy of
   * this logic.
   *
   * Only the V (vertical) half of the "h-v" value is actually painted, as
   * `justify-content` on a `display:flex; flex-direction:column` text node
   * (top/center/bottom → flex-start/center/flex-end): the browser already
   * wraps a contenteditable's own line/paragraph children into an implicit
   * per-line flex item, so this positions the whole stack of lines within
   * the box's fixed height exactly like "vertical align" in any design
   * tool, without touching the node's existing width/height/overflow
   * (still 100%/100%/hidden, per TextTool.ts's/VariableContentTool.ts's own
   * `_syncFromDOM()` comments). The H (horizontal) half is intentionally
   * NOT applied here -- text always spans the node's full width, so
   * horizontal position within that width is already governed by the
   * separate, more granular `textAlign`/'align' field (per-line, not
   * per-box); wiring H here too would either be redundant or fight with it.
   */
  protected static _applyTextContentAlign(element: HTMLElement, key: string, value: unknown): boolean {
    if (key !== 'contentAlign') return false;

    PropertyRenderer.applyChange(element, key, value);

    const textNode = element.querySelector<HTMLElement>('[contenteditable]');
    if (textNode) {
      const v = String(value ?? 'center-center').split('-')[1] || 'center';
      const justify = v === 'top' ? 'flex-start' : v === 'bottom' ? 'flex-end' : 'center';
      textNode.style.display        = 'flex';
      textNode.style.flexDirection  = 'column';
      textNode.style.justifyContent = justify;
    }
    return true;
  }

  // ── Rendering (do NOT override) ─────────────────────────────────────────────

  /**
   * Renders (or updates) the property panel.
   *
   * This is the final implementation — tools should not override it.
   * Override `getPropertySchema()` to change what appears in the panel.
   */
  static renderPropertiesPanel(container: HTMLElement, element: HTMLElement): void {
    // PropertyRenderer.render() is intentionally non-destructive across
    // re-renders of the SAME element (see its own header comment) -- it
    // only updates sections whose data-ct-section slug already matches and
    // appends ones that don't exist yet; it never removes stale sections.
    // That's correct for re-rendering the same element's schema repeatedly
    // (typing in a field shouldn't blow away focus/scroll), but breaks the
    // moment `container` (#panel-body) is reused for a DIFFERENT element or
    // tool: the previous selection's sections have different slugs, so
    // they're never matched or replaced -- they just sit there while the
    // new tool's sections get appended after them. This includes coming
    // from PageTool.ts's page panel, which writes raw (non-schema) HTML
    // into the same container: e.g. clicking the page and then selecting a
    // Text element left the page's "Size & Position / Background / Actions"
    // accordions permanently stuck above every element's own panel from
    // then on, for every tool, since nothing ever cleared them. Track which
    // element `container` currently shows and wipe it on change.
    const tracked = container as unknown as { _ctRenderedElement?: HTMLElement };
    if (tracked._ctRenderedElement !== element) {
      container.innerHTML = '';
      tracked._ctRenderedElement = element;
    }

    // Sticky Copy/Paste/Lock bar, always rendered above the accordions --
    // matches the legacy CommonProperties.renderEstiloBar() bar every
    // .js tool got automatically via renderCommonProperties().
    this._renderStyleBar(container, element);

    // Prime dataset.ctState from existing DOM/meta state (first render only).
    this._syncFromDOM(element);
    const schema = this.getPropertySchema(element);
    PropertyRenderer.render(container, schema, element, (key, value) => {
      // Tags every 'craftools-state-change' this triggers as panel-
      // originated (see PropertyRenderer.runFromPanel()'s doc comment) --
      // Editor.ts's _panelSyncHandler uses that to skip redundantly
      // re-rendering this very panel in response to its own field's
      // change, which used to destroy/rebuild non-idempotent field DOM
      // (e.g. the color picker's native <input type="color">) while the
      // user still had its native popup open.
      PropertyRenderer.runFromPanel(() => {
        this._applyProperty(element, key, value);
        this._syncLinkedClones(element, key, value);
      });
    });
  }

  /**
   * Propagates a property-panel change to every OTHER element sharing this
   * one's `data-linked-id` (Business Card mode's clone group -- see
   * PageTool.ts's drop handler, "--- Business Card Cloning Logic ---").
   *
   * Element.ts already keeps POSITION (drag/resize) and typed TEXT content
   * (the `contenteditable` input listener) in sync across these clones, but
   * neither of those paths touches anything routed through the properties
   * panel -- so changing a font, color, border, background, alignment, etc.
   * on one card visibly drifted apart from its siblings the moment you
   * touched it, even though the cards are supposed to stay identical
   * copies. Runs every OTHER clone through THIS SAME TOOL's
   * `_applyProperty()` (not a raw style/DOM copy) so tool-specific side
   * effects -- auto-fit resize, background-layer creation, border painting
   * on an inner node, etc. -- stay correct on every clone, not just the one
   * the user actually edited.
   *
   * `_shouldSyncLinkedProperty()` lets a tool opt a specific key out of this
   * broadcast entirely, without needing to override this whole method.
   */
  protected static _syncLinkedClones(element: HTMLElement, key: string, value: unknown): void {
    const lid = element.getAttribute('data-linked-id');
    if (!lid) return;
    if (!this._shouldSyncLinkedProperty(element, key, value)) return;
    document.querySelectorAll<HTMLElement>(`craftools-element[data-linked-id="${lid}"]`).forEach(clone => {
      if (clone === element) return;
      this._applyProperty(clone, key, value);
    });
  }

  /**
   * Hook for `_syncLinkedClones()` -- return `false` to skip propagating a
   * given key to the rest of the Business Card group. Default: always sync.
   */
  protected static _shouldSyncLinkedProperty(_element: HTMLElement, _key: string, _value: unknown): boolean {
    return true;
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
    // 'pageAlign' (from CommonSchema.ts's pageAlignSection()) re-runs
    // SnapEngine's page-alignment math against the element's current size
    // AND persists which direction was last clicked, purely so
    // page-align.field.ts's button grid can show it as the active/selected
    // one (matching content-align's grid) -- it's still not a property that
    // constrains the element going forward: dragging/resizing afterward
    // doesn't get reconciled against it or clear it, the stored value is
    // only ever read back for this cosmetic "last alignment you picked"
    // highlight.
    if (key === 'pageAlign') {
      SnapEngine.align(element as unknown as CraftoolsSnapTarget, value as string);
      PropertyRenderer.applyChange(element, key, value);
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

    // Album grid-cell images (AlbumWizard.ts's business-card/grid layouts)
    // are deliberately created with data-locked="true" -- locking is what
    // keeps the photo pinned inside its cell; ImageTransform.ts's own
    // pan/zoom/rotate "adjust" mode (double-click) works independently of
    // it. Unlocking one from this generic style bar lets it be dragged/
    // resized/deleted out of the grid like a normal element, breaking the
    // album layout -- so the button simply isn't offered for these images
    // at all, rather than relying on the user to never press it.
    const isAlbumCellImage = element.getAttribute('data-craftool') === 'image'
      && !!element.closest('.craftools-grid-cell');
    btnLock.style.display = isAlbumCellImage ? 'none' : '';
    if (!isAlbumCellImage) {
      this._updateLockButton(btnLock, element.getAttribute('data-locked') === 'true');
    }

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

    if (!isAlbumCellImage) {
      btnLock.addEventListener('click', () => {
        const nowLocked = element.getAttribute('data-locked') !== 'true';
        element.setAttribute('data-locked', nowLocked ? 'true' : 'false');
        (element as unknown as { _syncLockUI?: () => void })._syncLockUI?.();
        this._updateLockButton(btnLock, nowLocked);
        element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
      });
    }
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
   * The canvas element keys this tool handles (e.g. ['title', 'paragraph']).
   *
   * Set by the tool's ToolRegistry.register() calls at the end of its file.
   * Used by CraftoolsConfig to resolve which registry entries to activate
   * when `tools: [TextTool]` is passed to the constructor.
   */
  static registeredKeys: string[] = [];
}
