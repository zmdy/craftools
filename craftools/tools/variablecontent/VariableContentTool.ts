/**
 * VariableContentTool.ts — Variable content element (text driven by data variables).
 * State stored in CSS styles (same pattern as TextTool).
 */
import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { borderSection, radiusSection, zIndexSection, variableBindingSection, backgroundSection, contentAlignSection } from '../../utils/CommonSchema';
import { parseVariableBinding, stringifyVariableBinding } from '../../utils/fields/variable-binding.field';
import { AutoFitText } from '../../utils/AutoFitText.js';
import { withEmojiFallback, EMOJI_FONT_STACK } from '../../utils/EmojiFont.js';
import { I18n } from '../../settings/Translations.js';
import type { VariableBinding } from '../../utils/VariableEngine';
import type { PropertySchema } from '../../types/PropertySchema';
// Registers the 'variableContentTool.*' i18n keys used by I18n.t() calls
// below (placeholder text) -- without this side-effect import the keys are
// never registered and I18n.t() falls back to returning the raw key string.
import './VariableContentTool_Translations.js';

/**
 * Returns the resolved-content child div of a variablecontent element.
 *
 * NOTE: Must exclude UI-layer divs (.ct-bg-layer, .craftools-ctrlbar, etc.)
 * because `_getOrCreateBgLayer()` inserts a div as the very first child of
 * the element once any background property is set -- after that,
 * `div:first-child` would match the bg-layer instead of the content div,
 * silently breaking every typography property (color, font, size ...) by
 * writing styles onto the invisible background element instead of the text.
 */
const getContent = (el: HTMLElement): HTMLElement | null =>
  el.querySelector<HTMLElement>('[contenteditable]') ??
  ([...el.children].find(c =>
    !c.classList.contains('ct-bg-layer') &&
    !c.classList.contains('craftools-element-blur-bg') &&
    !c.classList.contains('craftools-ctrlbar') &&
    !c.classList.contains('craftools-sidebar-overlay')
  ) as HTMLElement | undefined) ?? null;

/**
 * Typography keys that can change the resolved content's own natural
 * rendered size -- re-run AutoFitText.applyAutoSize() after any of these
 * so the box keeps tracking the content while auto-fit is on. Matches
 * TextTool.ts's own AUTOFIT_RELEVANT_KEYS (see its header comment); this
 * tool's schema has no lineHeight/underline/margin fields, so the set is
 * smaller. textAlign/color are intentionally excluded -- neither changes
 * the text's measured size.
 */
const AUTOFIT_RELEVANT_KEYS = new Set(['font', 'fontSize', 'bold', 'italic']);

const rgbToHex = (rgb: string) => {
  const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  return m ? '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('') : rgb;
};

export class VariableContentTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const content = getContent(element);
    if (!content) return;

    // Backfills `overflow: hidden` onto elements created before this was
    // part of createElement()'s baseline style -- see TextTool.ts's
    // _syncFromDOM() for the full explanation (same fix, same reasoning,
    // applies identically here). Not part of dataset.ctState -- always
    // enforced, not a user toggle.
    content.style.overflow = 'hidden';

    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    if (!('font'     in existing)) patch.font     = (content.style.fontFamily || 'DM Sans').replace(/['"]/g,'').split(',')[0].trim();
    if (!('fontSize' in existing)) patch.fontSize = parseFloat(content.style.fontSize) || 16;
    if (!('color'    in existing)) {
      const hexColor = rgbToHex(content.style.color || '#1a1a1a');
      // Must be stored as a ColorPickerValue JSON string — the same format the
      // color-picker field emits — so PropertyRenderer's equality check can
      // correctly detect changes and the panel field re-renders on every pick.
      // A bare hex string would be parsed correctly by _paintTextColor() but
      // would fail the string-equality diff in PropertyRenderer (new picker
      // value is always a JSON object stringified, old stored value would be a
      // plain "#rrggbb"), silently locking the colour after the first change.
      patch.color = JSON.stringify({ mode: 'solid', solid: hexColor, gradient: { type: 'linear', angle: 90, stops: ['#f97316', '#facc15'] } });
    }
    if (!('textAlign' in existing)) patch.textAlign = content.style.textAlign || 'left';
    if (!('textTransform' in existing)) patch.textTransform = content.style.textTransform || 'none';
    if (!('contentAlign' in existing)) {
      // Same reverse-mapping as TextTool.ts's _syncFromDOM() -- see its
      // comment for why only V is read back.
      const justify = content.style.justifyContent;
      const v = justify === 'flex-start' ? 'top' : justify === 'flex-end' ? 'bottom' : 'center';
      patch.contentAlign = `center-${v}`;
    }
    if (!('bold'     in existing)) patch.bold     = content.style.fontWeight === 'bold' || content.style.fontWeight === '700';
    if (!('italic'   in existing)) patch.italic   = content.style.fontStyle  === 'italic';
    // The binding lives on the element itself (element._craftoolsVariable),
    // not in a _craftoolsMeta object like Barcode/QRCode -- same convention
    // VariablePanel.ts's _getElementBinding() already relies on for
    // cross-element "Vincular a" lookups. Stored here as a JSON *string* in
    // ctState (see variable-binding.field.ts for why).
    const memoryBinding = (element as HTMLElement & { _craftoolsVariable?: VariableBinding | null })._craftoolsVariable;
    if ('variableBinding' in existing) {
      if (!memoryBinding) {
        // Re-hydrate the JS memory object from the HTML dataset if memory is lost
        // (which happens after a preview innerHTML restore)
        (element as HTMLElement & { _craftoolsVariable?: VariableBinding | null })._craftoolsVariable = parseVariableBinding(existing.variableBinding);
      }
    } else {
      patch.variableBinding = stringifyVariableBinding(memoryBinding);
    }
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });

    // Background fill + border (CommonSchema.ts's backgroundSection()/
    // borderSection(), applied via BaseTool.ts's shared helpers). Seeds
    // border from whatever's already inline on `content` -- this tool's
    // border fields existed in the schema before but were never actually
    // painted anywhere (see _applyProperty() below), so this is effectively
    // priming from blank/default the first time an old element is opened.
    this._syncBackgroundState(element);
    this._syncBorderState(element, {
      width: parseFloat(content.style.borderWidth) || 0,
      color: content.style.borderColor || '#000000',
      style: content.style.borderStyle || 'none',
    });
  }

  /** Escapes a value for safe use inside an HTML attribute (emojiKitchen <img src>). */
  private static _escAttr(val: unknown): string {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─── Adapters for MobileToolbar ──────────────────────────────────────────────
  /**
   * Resolves and shows the configured variable's value -- an <img> for
   * emojiKitchen/miniCalendar (real markup, via innerHTML), plain text for
   * everything else. With no binding, shows a placeholder inviting the user
   * to configure one. Recovered from the pre-migration VariableContentTool.js
   * (deleted by the "Purge legacy JS" commit) -- the schema-driven file kept
   * only a bare-bones stub that always used innerText, so emojiKitchen combos
   * and mini-calendar cards never actually rendered their real content.
   */
  public static _applyVariablePreview(element: HTMLElement, textEl: HTMLElement | null, binding: VariableBinding | null): void {
    if (!textEl) return;
    // Editor-only "this box is Vinculado a another element" cue -- pure CSS
    // class (see craftools.css's `.ct-var-linked` rule for why it's a class
    // and never an inline style), toggled in real time as the user links/
    // unlinks it in the panel (this method runs again on every binding
    // save, via _applyProperty()'s 'variableBinding' case).
    textEl.classList.toggle('ct-var-linked', !!binding?.linkedTo);
    if (binding && binding.type) {
      // A bound "emoji" value is ALWAYS a single emoji character, never
      // mixed with regular text -- putting the panel's chosen text font
      // first (withEmojiFallback()'s normal order, used below for every
      // OTHER binding type) risks that font having *partial* coverage of
      // the Unicode emoji range: many ordinary text fonts include a
      // handful of monochrome symbol/dingbat glyphs even though they are
      // not "emoji fonts", and the browser renders whichever font in the
      // stack has ANY glyph for a codepoint, not the first font tagged
      // "emoji" -- so some emoji rendered fine (fell through to Noto Color
      // Emoji) while others silently used the text font's own plain glyph.
      // Forcing the pure emoji stack (no text font first) for this type
      // matches EmojiTool.ts's own dedicated element, which never puts a
      // text font first for the same reason. Every other binding type
      // keeps the user's actually-chosen "font" field (dataset.ctState,
      // the same source getPropertySchema()'s font-select field reads).
      textEl.style.fontFamily = binding.type === 'emoji'
        ? `${EMOJI_FONT_STACK}, sans-serif`
        : withEmojiFallback(String(PropertyRenderer._readState(element).font ?? 'DM Sans'));

      textEl.style.whiteSpace = 'pre-wrap';
      textEl.textContent = I18n.t('variablePanel.previewLoading');
      import('../../utils/VariableEngine.js').then(({ VariableEngine }) => {
        const applyResolved = (val: string): void => {
          if (binding.type === 'emojiKitchen') {
            // Real markup (not typed text) -- see the miniCalendar note below
            // about why whiteSpace goes back to 'normal' for HTML content.
            textEl.style.whiteSpace = 'normal';
            textEl.innerHTML = val
              ? `<img src="${VariableContentTool._escAttr(val)}" style="max-width:100%; max-height:100%; display:block; margin:0 auto; object-fit:contain;">`
              : '—';
          } else if (binding.type === 'miniCalendar' || (binding.type === 'date' && VariableEngine.isHtmlDateFormat(binding.format))) {
            // The value here is already full HTML. 'white-space: pre-wrap'
            // (needed to preserve line breaks for typed text) would make the
            // browser render all that internal whitespace as visible space,
            // inflating/decentering the card -- so real HTML goes back to
            // normal whitespace collapsing here.
            textEl.style.whiteSpace = 'normal';
            textEl.innerHTML = val || '—';
          } else {
            textEl.style.whiteSpace = 'pre-wrap';
            textEl.textContent = (val && String(val).length) ? val : '—';
          }
          AutoFitText.applyAutoSize(element, textEl);
        };

        // Linked ("Vincular a") follower: resolve through the SAME pick the
        // leader itself would produce (shared `picks` registry, exactly the
        // pattern VariablePanel.ts's own small preview box already uses for
        // the panel that's currently open) instead of resolving
        // independently. Previously this branch didn't exist at all --
        // `resolvePreview()` never received a `linkCtx`, so a follower's
        // CANVAS content (as opposed to that one open panel's own preview
        // box) never actually tracked its leader; it just happened to
        // resolve to its own, unrelated value. See `_refreshLinkedFollowers()`
        // below for the other half: telling followers to re-run this
        // whenever the LEADER's own binding changes.
        if (binding.linkedTo) {
          const leaderEl      = VariableContentTool._findVarElementById(element, binding.linkedTo);
          const leaderBinding = leaderEl ? VariableContentTool._readAnyVariableBinding(leaderEl) : null;
          if (leaderBinding && leaderBinding.type === binding.type) {
            VariableEngine.prefetchApiResources([leaderBinding, binding]).then(apiCache => {
              const picks = VariableEngine.newLinkRegistry();
              VariableEngine.resolve(leaderBinding, {}, apiCache, { id: '__leader__', picks });
              const val = VariableEngine.resolve({ ...binding, linkedTo: '__leader__' }, {}, apiCache, { id: '__me__', picks });
              applyResolved(val);
            });
            return;
          }
        }

        // miniCalendar's "highlight day" link is a SEPARATE, narrower link
        // from the generic `binding.linkedTo` above -- it targets a
        // different-typed ('date') element via `miniCalendarHighlightLinkedTo`
        // (see VariablePanel.ts's own toggle for it). `VariableEngine`'s
        // `_pickMiniCalendar()`/`_resolveHighlightDay()` read the leader's
        // Date back out of the SAME `picks` registry to drive BOTH the
        // highlighted day-of-month AND (so the two always agree) the whole
        // card's displayed month/year -- but keyed by the leader's own real
        // element id (not a synthetic placeholder), so the leader has to be
        // resolved first under that exact id for the lookup to find it.
        // This was missing entirely, which is why linking a mini calendar
        // to a date variable never reflected the date changing, live on
        // the canvas.
        if (binding.type === 'miniCalendar' && binding.miniCalendarHighlightDaySource === 'linked' && binding.miniCalendarHighlightLinkedTo) {
          const dateLeaderId = binding.miniCalendarHighlightLinkedTo;
          const leaderEl      = VariableContentTool._findVarElementById(element, dateLeaderId);
          const leaderBinding = leaderEl ? VariableContentTool._readAnyVariableBinding(leaderEl) : null;
          if (leaderBinding && leaderBinding.type === 'date') {
            VariableEngine.prefetchApiResources([leaderBinding, binding]).then(apiCache => {
              const picks = VariableEngine.newLinkRegistry();
              VariableEngine.resolve(leaderBinding, {}, apiCache, { id: dateLeaderId, picks });
              const val = VariableEngine.resolve(binding, {}, apiCache, { id: '__me__', picks });
              applyResolved(val);
            });
            return;
          }
        }

        VariableEngine.resolvePreview(binding).then(applyResolved);
      });
    } else {
      textEl.style.whiteSpace = 'pre-wrap';
      textEl.textContent = I18n.t('variableContentTool.placeholder') || 'Configure uma variável...';
    }
  }

  /**
   * Scoped lookup of another `craftools-element` on the SAME page by its
   * stable `_craftoolsVarId` (assigned lazily by VariablePanel.ts's
   * `_ensureVarId()` the first time any element is listed as a "Vincular a"
   * candidate). Deliberately duplicated here rather than imported from
   * VariablePanel.ts/AgendaExport.ts (which already have their own near-
   * identical copies) -- pulling in either would risk a circular import
   * (both transitively touch tool modules that import THIS file back).
   */
  private static _findVarElementById(from: HTMLElement, id: string): HTMLElement | null {
    const page  = from.closest<HTMLElement>('.craftools-page');
    const scope = page ?? document;
    let found: HTMLElement | null = null;
    scope.querySelectorAll<HTMLElement & { _craftoolsVarId?: string }>('craftools-element').forEach(el => {
      if (!found && el._craftoolsVarId === id) found = el;
    });
    return found;
  }

  /**
   * Same in-memory-first, `dataset.ctState`-fallback binding read as
   * VariablePanel.ts's `_getElementBinding()`/AgendaExport.ts's
   * `_getBinding()` -- a leader can be a Variable Content, QR Code, or
   * Barcode element, so this isn't narrowed to `_craftoolsVariable` alone.
   */
  private static _readAnyVariableBinding(el: HTMLElement): VariableBinding | null {
    const toolType = el.getAttribute('data-craftool');
    if (toolType === 'variablecontent') {
      const memory = (el as HTMLElement & { _craftoolsVariable?: VariableBinding | null })._craftoolsVariable;
      if (memory) return memory;
      const state = PropertyRenderer._readState(el);
      return 'variableBinding' in state ? parseVariableBinding(state.variableBinding) : null;
    }
    if (toolType === 'qrcode' || toolType === 'barcode') {
      const meta = (el as HTMLElement & { _craftoolsMeta?: { variableBinding?: VariableBinding | null } })._craftoolsMeta;
      if (meta?.variableBinding) return meta.variableBinding;
      const state = PropertyRenderer._readState(el);
      return 'variableBinding' in state ? parseVariableBinding(state.variableBinding) : null;
    }
    return null;
  }

  /**
   * The other half of the "Vincular a" live-canvas fix (see the
   * `binding.linkedTo` branch in `_applyVariablePreview()` above): called
   * right after THIS element's own binding is saved, so any sibling
   * Variable Content element on the same page whose binding points back at
   * this one (`linkedTo === this element's _craftoolsVarId`) re-resolves
   * and re-renders immediately too, instead of only catching up the next
   * time someone happens to select/reopen it. Also matches followers
   * pointing back via `miniCalendarHighlightLinkedTo` -- the separate,
   * narrower "highlight day" link a miniCalendar can have to a 'date'
   * element (see the matching branch in `_applyVariablePreview()`) -- so a
   * mini calendar's highlighted day live-updates when the date variable it
   * points at changes, exactly like a same-type `linkedTo` follower does.
   * Scoped to `variablecontent` followers only (QR/Barcode followers have
   * their own separate regeneration path -- `QRCodeTool._regenerate()`/its
   * Barcode equivalent -- not wired to this yet).
   */
  private static _refreshLinkedFollowers(element: HTMLElement): void {
    const myId = (element as HTMLElement & { _craftoolsVarId?: string })._craftoolsVarId;
    if (!myId) return; // Never listed as a link candidate yet -- nothing could be pointing at it.
    const page = element.closest<HTMLElement>('.craftools-page');
    if (!page) return;
    page.querySelectorAll<HTMLElement>('craftools-element[data-craftool="variablecontent"]').forEach(el => {
      if (el === element) return;
      const binding = VariableContentTool._readAnyVariableBinding(el);
      if (!binding) return;
      const isGenericFollower       = binding.linkedTo === myId;
      const isHighlightDayFollower  = binding.type === 'miniCalendar'
        && binding.miniCalendarHighlightDaySource === 'linked'
        && binding.miniCalendarHighlightLinkedTo === myId;
      if (!isGenericFollower && !isHighlightDayFollower) return;
      const content = getContent(el);
      if (content) VariableContentTool._applyVariablePreview(el, content, binding);
    });
  }
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Toggles bold/italic/underline on the whole element (there's no manual
   * text selection to format -- content is always the resolved variable
   * value, never typed by hand).
   */
  private static _toggleCtxStyle(
    element: HTMLElement,
    cssProp: 'fontWeight' | 'fontStyle' | 'textDecoration',
    onValue: string,
    offValue: string,
  ): void {
    const text = getContent(element);
    if (!text) return;
    text.style[cssProp] = (text.style[cssProp] === onValue) ? offValue : onValue;
    AutoFitText.applyAutoSize(element, text);
    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }

  // Border styling lives on the resolved-content child, not the outer
  // craftools-element (matches TextTool.ts's same override) -- so the
  // Copy/Paste style bar and the new gradient-capable border helpers read/
  // write the right node.
  protected static _getStyleTarget(element: HTMLElement): HTMLElement {
    return getContent(element) ?? element;
  }

  static getCtxOptions(element?: HTMLElement): Array<{ icon: string; label: string; command: (element: HTMLElement) => void; isActive?: (element: HTMLElement) => boolean }> {
    if (!element) return [];
    const isAutoFitOn = (el: HTMLElement) => (el as unknown as { _craftoolsAutoResize?: boolean })._craftoolsAutoResize === true;
    return [
      // Same shared quick-action as TextTool.ts's own "Auto-fit to text" --
      // the underlying mechanism (AutoFitText.applyAutoSize(), gated on
      // `_craftoolsAutoResize`) was already wired up here (called from
      // _applyVariablePreview() whenever the resolved value changes, and
      // from _toggleCtxStyle()'s bold/italic/underline toggles), but
      // nothing anywhere in this tool's panel or ctx-bar ever exposed a way
      // to turn it ON in the first place.
      this._autoFitCtxOption({
        isActive: isAutoFitOn,
        toggle:   (el: HTMLElement) => VariableContentTool._applyProperty(el, 'autoFit', !isAutoFitOn(el)),
        label:    'Auto-fit to content',
      }),
      {
        icon: 'format_bold',
        label: I18n.t('textTool.bold'),
        command: (el: HTMLElement) => VariableContentTool._toggleCtxStyle(el, 'fontWeight', 'bold', 'normal'),
      },
      {
        icon: 'format_italic',
        label: I18n.t('textTool.italic'),
        command: (el: HTMLElement) => VariableContentTool._toggleCtxStyle(el, 'fontStyle', 'italic', 'normal'),
      },
      {
        icon: 'format_underlined',
        label: I18n.t('textTool.underline'),
        command: (el: HTMLElement) => VariableContentTool._toggleCtxStyle(el, 'textDecoration', 'underline', 'none'),
      },
    ];
  }

  /**
   * Builds a fresh `<craftools-element data-craftool="variablecontent">`
   * showing a placeholder until a variable is configured via the panel.
   * Recovered from the pre-migration VariableContentTool.js (deleted by the
   * "Purge legacy JS" commit without this logic being ported) -- the
   * previous file had no createElement() at all, throwing
   * "createElement is not a function" for every variable-content element
   * creation (this is the exact crash named in the original bug report:
   * "mod.VariableContentTool.createElement is not a function").
   */
  static createElement(_type: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsAutoResize?: boolean };
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', '220');
    el.setAttribute('h', '50');
    el.setAttribute('data-craftool', 'variablecontent');
    // Auto-fit starts OFF (see AutoFitText.ts / CommonSchema.ts's
    // sizePositionSection({ autoFit: true })) -- only `true` turns it on.
    el._craftoolsAutoResize = false;

    const content = document.createElement('div');
    content.setAttribute('contenteditable', 'false');
    content.setAttribute('spellcheck', 'false');
    content.style.cssText = `
      font-size: 16px;
      font-weight: 400;
      color: #1a1a1a;
      font-family: ${withEmojiFallback('DM Sans')};
      display: flex;
      flex-direction: column;
      justify-content: center;
      width: 100%;
      height: 100%;
      overflow: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      cursor: default;
      line-height: 1.3;
      margin: 0;
      outline: 1px dashed var(--accent, #6366f1);
      outline-offset: 2px;
    `;
    content.textContent = I18n.t('variableContentTool.placeholder') || 'Configure uma variável...';

    el.appendChild(content);

    return el;
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      // First and open by default: unlike Barcode/QRCode (where the variable
      // binding is a secondary option alongside their own content config),
      // this tool's entire purpose IS the bound variable -- matches
      // MobileToolbar.ts's _getVariableContentItems(), which also lists it first.
      variableBindingSection({ defaultOpen: true }),
      {
        section: 'Typography',
        i18nKey: 'textTool.typography',
        icon: 'text_fields',
        fields: [
          { type: 'font-select', key: 'font',     label: 'Font',   i18nKey: 'textTool.font' },
          { type: 'slider',      key: 'fontSize', label: 'Size',   i18nKey: 'textTool.size', min: 8, max: 200, step: 1 },
          { type: 'align',       key: 'textAlign' },
          { type: 'toggle',      key: 'bold',     label: 'Bold',   i18nKey: 'textTool.bold' },
          { type: 'toggle',      key: 'italic',   label: 'Italic', i18nKey: 'textTool.italic' },
          // Same field as TextTool.ts's Title/Paragraph -- see its schema
          // for why (only the value is applied to `content`, not resolved
          // per-repetition, so it composes fine with variable bindings).
          {
            type: 'select', key: 'textTransform', label: 'Text transform', i18nKey: 'textTool.textTransform',
            options: [
              { value: 'none',       label: 'None',       i18nKey: 'textTool.textTransformNone' },
              { value: 'uppercase',  label: 'UPPERCASE',  i18nKey: 'textTool.textTransformUppercase' },
              { value: 'lowercase',  label: 'lowercase',  i18nKey: 'textTool.textTransformLowercase' },
              { value: 'capitalize', label: 'Capitalize', i18nKey: 'textTool.textTransformCapitalize' },
            ],
          },
          // Gradient-capable (BaseTool._paintTextColor(), the same
          // background-clip:text technique TextTool.ts uses). No explicit
          // defaultSolid needed: ColorPickerUI.ts's shared default is
          // already near-black (#18181b).
          { type: 'color-picker', key: 'color', label: 'Color', i18nKey: 'textTool.color' },
        ],
      },
      backgroundSection(),
      borderSection(),
      radiusSection(),
      contentAlignSection(),
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    // Background fill (backgroundSection()) -- whole-element concept.
    if (this._applyBackground(element, key, value)) return;
    // Border (borderSection(), now gradient-capable) -- _getStyleTarget()
    // points at the resolved-content child; this replaces the previous gap
    // where borderWidth/borderStyle/borderColor were stored but never
    // actually painted (only borderRadius below was applied).
    if (this._applyBorder(element, key, value)) return;
    // Internal alignment (contentAlignSection()) -- shared with
    // TextTool.ts, see BaseTool.ts's doc comment.
    if (this._applyTextContentAlign(element, key, value)) return;

    PropertyRenderer.applyChange(element, key, value);

    if (key === 'variableBinding') {
      const binding = parseVariableBinding(value);
      (element as HTMLElement & { _craftoolsVariable?: VariableBinding | null })._craftoolsVariable = binding;
      const content = getContent(element);
      if (content) VariableContentTool._applyVariablePreview(element, content, binding);
      // This element just became (or stayed) a leader for whoever else is
      // "Vinculado a" it -- refresh those followers' own canvas content
      // right now instead of leaving them showing a stale/independent
      // value until someone happens to reselect them. See
      // _refreshLinkedFollowers()'s doc comment for the full picture.
      VariableContentTool._refreshLinkedFollowers(element);
      return;
    }

    const content = getContent(element);
    if (!content) return;
    switch (key) {
      // Turned on from the ctx-bar's auto-fit quick action (see
      // getCtxOptions()) -- mirrors TextTool.ts's own 'autoFit' case:
      // persists the flag AND resizes immediately rather than waiting for
      // the next resolved-value change to pick it up.
      case 'autoFit': {
        (element as unknown as { _craftoolsAutoResize?: boolean })._craftoolsAutoResize = !!value;
        if (value) AutoFitText.applyAutoSize(element, content);
        break;
      }
      // withEmojiFallback (not a bare `'${value}', sans-serif`) so emoji in
      // a bound variable's resolved text still render in color -- see
      // TextTool.ts's matching 'font' case for the regression this avoids.
      case 'font':      content.style.fontFamily = withEmojiFallback(String(value)); break;
      case 'fontSize':  content.style.fontSize   = `${value}px`; break;
      case 'color':     BaseTool._paintTextColor(content, value); break;
      case 'textAlign': 
        content.style.textAlign   = String(value); 
        if (value === 'left') content.style.alignItems = 'flex-start';
        else if (value === 'right') content.style.alignItems = 'flex-end';
        else if (value === 'center') content.style.alignItems = 'center';
        else content.style.alignItems = 'stretch';
        break;
      case 'bold':      content.style.fontWeight  = value ? 'bold' : 'normal'; break;
      case 'italic':    content.style.fontStyle   = value ? 'italic' : 'normal'; break;
      case 'textTransform': content.style.textTransform = String(value); break;
      case 'borderRadius': content.style.borderRadius = `${value}px`; break;
      case 'zIndex':    element.style.zIndex       = String(value); break;
    }

    // Keep the box in sync with the resolved content while auto-fit is on
    // -- mirrors TextTool.ts's own AUTOFIT_RELEVANT_KEYS tail (see its
    // header comment). AutoFitText.applyAutoSize() previously only ran
    // from the 'autoFit' case above (the moment the toggle itself was
    // switched on) and from _applyVariablePreview() (whenever the
    // *resolved value* changed) -- every Typography panel edit that
    // changes the text's own natural size (font, size, bold, italic) left
    // the box exactly where it was, so with auto-fit on, resizing the font
    // silently stopped the box from tracking it. applyAutoSize() no-ops
    // immediately if auto-fit isn't on, so this is always safe to call.
    if (AUTOFIT_RELEVANT_KEYS.has(key)) {
      AutoFitText.applyAutoSize(element, content);
    }
  }
}

VariableContentTool.registeredKeys = ['variablecontent'];
ToolRegistry.register({ key: 'variablecontent', label: 'editor.variableContent', icon: 'data_object', tool: VariableContentTool, draggable: true, showInFooterNav: false, category: 'data' });
