/**
 * VariableContentTool.ts — Variable content element (text driven by data variables).
 * State stored in CSS styles (same pattern as TextTool).
 */
import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { borderSection, radiusSection, zIndexSection, variableBindingSection, backgroundSection, contentAlignSection, fontStyleField } from '../../utils/CommonSchema';
import { parseVariableBinding, stringifyVariableBinding } from '../../utils/fields/variable-binding.field';
import { AutoFitText } from '../../utils/AutoFitText.js';
import { withEmojiFallback, EMOJI_FONT_STACK } from '../../utils/EmojiFont.js';
import { I18n } from '../../settings/Translations.js';
import { AppSettings } from '../../utils/AppSettings.js';
import { VariableEngine, type VariableBinding } from '../../utils/VariableEngine';
import type { PropertySchema } from '../../types/PropertySchema';
import { FONTS, loadGoogleFonts, getSavedLocalFonts } from '../../utils/FontList.js';
import '../../components/CtFontSelect.js';
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
 * tool's schema has no lineHeight/margin fields, so the set is smaller.
 * textAlign/color are intentionally excluded -- neither changes the
 * text's measured size.
 */
const AUTOFIT_RELEVANT_KEYS = new Set(['font', 'fontSize', 'bold', 'italic', 'underline']);

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
    if (!('underline' in existing)) patch.underline = content.style.textDecoration?.includes('underline') ?? false;
    // Business Card mode only (see getPropertySchema()'s `hidden` on this
    // field) -- defaults to true so a freshly-dropped card group starts out
    // showing identical content on every card, matching the position/text
    // coupling Element.ts already gives every OTHER tool in the group.
    if (!('repeatAcrossCards' in existing)) patch.repeatAcrossCards = true;
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
    // Business Card mode: which "repetition" this card resolves as (see
    // _cardRepetitionIndex()'s doc comment). 0 for every card outside a
    // linked group, or when "repeat content on all cards" is on -- so this
    // is a no-op for every element that isn't part of one.
    const repetitionIndex = VariableContentTool._cardRepetitionIndex(element);
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
          } else if (binding.type === 'miniCalendar' || binding.type === 'image' || (binding.type === 'date' && VariableEngine.isHtmlDateFormat(binding.format))) {
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
              VariableEngine.resolve(leaderBinding, { repetitionIndex }, apiCache, { id: '__leader__', picks });
              const val = VariableEngine.resolve({ ...binding, linkedTo: '__leader__' }, { repetitionIndex }, apiCache, { id: '__me__', picks });
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
              VariableEngine.resolve(leaderBinding, { repetitionIndex }, apiCache, { id: dateLeaderId, picks });
              const val = VariableEngine.resolve(binding, { repetitionIndex }, apiCache, { id: '__me__', picks });
              applyResolved(val);
            });
            return;
          }
        }

        VariableEngine.resolvePreview(binding, { repetitionIndex }).then(applyResolved);
      });
    } else {
      textEl.style.whiteSpace = 'pre-wrap';
      textEl.textContent = I18n.t('variableContentTool.placeholder') || 'Configure uma variável...';
    }
  }

  /**
   * Business Card mode's per-card variation control (see
   * getPropertySchema()'s `repeatAcrossCards` toggle, hidden unless the
   * element has `data-linked-id`).
   *
   * VariableEngine.resolve()'s `sequenceNumber`/`sequenceText`/`emoji`/
   * `apiPhrase`/`emojiKitchen`/date-interval picks all key off
   * `context.repetitionIndex` (see AgendaExport.ts's per-page loop, the
   * ONLY other caller that ever set it to anything but 0) -- reusing that
   * same mechanism here, keyed by a card's position within its linked
   * group instead of a page number, is what makes "sequencial ou
   * aleatório" per-card variation possible on the live canvas, not just at
   * Agenda export time. Every pick in the engine is a deterministic
   * function of `(binding, repetitionIndex)` -- "random" modes are a
   * pseudo-random hash of the index, never `Math.random()` -- so handing
   * out a different index per card is both necessary AND sufficient for
   * each card to land on a different value.
   *
   * Returns 0 (i.e. "resolve exactly like a standalone element") when the
   * element isn't part of a Business Card group, OR when
   * `repeatAcrossCards` is on (default) -- every card in the group then
   * resolves at the same index 0 and shows identical content, same as
   * position/text already do via Element.ts.
   */
  private static _cardRepetitionIndex(element: HTMLElement): number {
    const lid = element.getAttribute('data-linked-id');
    if (!lid) return 0;
    const repeat = PropertyRenderer._readState(element).repeatAcrossCards;
    if (repeat !== false) return 0;
    const group = Array.from(document.querySelectorAll<HTMLElement>(`craftools-element[data-linked-id="${lid}"]`));
    const idx = group.indexOf(element);
    return idx >= 0 ? idx : 0;
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

  // Border styling lives on the resolved-content child, not the outer
  // craftools-element (matches TextTool.ts's same override) -- so the
  // Copy/Paste style bar and the new gradient-capable border helpers read/
  // write the right node.
  protected static _getStyleTarget(element: HTMLElement): HTMLElement {
    return getContent(element) ?? element;
  }

  // Mirrors TextTool.ts's own getCtxOptions() exactly (same font/size
  // selector, same grouped Bold/Italic/Underline trio, same grouped
  // alignment trio) -- this tool's ctx-bar previously only exposed a lone,
  // ungrouped Bold/Italic/Underline set with no active-state highlighting
  // and no font/size/alignment controls at all, unlike every other
  // typography-driven tool's ctx-bar.
  static getCtxOptions(element?: HTMLElement): any[] {
    if (!element) return [];
    const isAutoFitOn = (el: HTMLElement) => (el as unknown as { _craftoolsAutoResize?: boolean })._craftoolsAutoResize === true;
    const isBold      = (el: HTMLElement) => PropertyRenderer._readState(el).bold === true;
    const isItalic     = (el: HTMLElement) => PropertyRenderer._readState(el).italic === true;
    const isUnderline  = (el: HTMLElement) => PropertyRenderer._readState(el).underline === true;

    return [
      {
        render: (el: HTMLElement) => {
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'display:flex; align-items:center; gap:6px; margin:0 4px;';

          // Font selector
          const currentFont = PropertyRenderer._readState(el).font || 'DM Sans';
          const fontSelect = document.createElement('ct-font-select') as any;
          fontSelect.className = 'craftools-select ct-fi';
          fontSelect.style.width = '120px';

          const allFonts = [...FONTS];
          getSavedLocalFonts().forEach(f => { if (!allFonts.includes(f)) allFonts.push(f); });
          if (currentFont && typeof currentFont === 'string' && !allFonts.includes(currentFont)) allFonts.push(currentFont);

          allFonts.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            fontSelect.appendChild(opt);
          });
          loadGoogleFonts(allFonts);
          fontSelect.value = currentFont;

          fontSelect.addEventListener('change', (e: Event) => {
            VariableContentTool._applyProperty(el, 'font', (e.target as HTMLSelectElement).value);
          });

          // Size selector
          const currentSize = PropertyRenderer._readState(el).fontSize || 16;
          const sizeInput = document.createElement('input');
          sizeInput.type = 'number';
          sizeInput.className = 'craftools-input';
          sizeInput.style.cssText = 'width: 50px; height: 30px; padding: 0 4px; text-align: center; font-size: 13px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-input); color: var(--text-primary); outline: none; margin: 0; box-sizing: border-box;';
          sizeInput.value = String(currentSize);
          sizeInput.min = '8';
          sizeInput.max = '500';

          sizeInput.addEventListener('change', (e: Event) => {
            VariableContentTool._applyProperty(el, 'fontSize', parseFloat((e.target as HTMLInputElement).value) || 16);
          });
          sizeInput.addEventListener('input', (e: Event) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            if (val > 0) VariableContentTool._applyProperty(el, 'fontSize', val);
          });

          wrapper.appendChild(fontSelect);
          wrapper.appendChild(sizeInput);
          return wrapper;
        }
      },
      {
        icon: 'format_bold',
        label: I18n.t('textTool.bold'),
        // Grouped with Italic/Underline below -- CtxBar.ts keeps same-group
        // options together as one atomic cluster, never split across the
        // ctx-bar's two lines. Matches TextTool.ts's own 'bius' group.
        group: 'bius',
        isActive: isBold,
        command: (el: HTMLElement) => VariableContentTool._applyProperty(el, 'bold', !isBold(el)),
      },
      {
        icon: 'format_italic',
        label: I18n.t('textTool.italic'),
        group: 'bius',
        isActive: isItalic,
        command: (el: HTMLElement) => VariableContentTool._applyProperty(el, 'italic', !isItalic(el)),
      },
      {
        icon: 'format_underlined',
        label: I18n.t('textTool.underline'),
        group: 'bius',
        isActive: isUnderline,
        command: (el: HTMLElement) => VariableContentTool._applyProperty(el, 'underline', !isUnderline(el)),
      },
      {
        icon: 'format_align_left',
        label: 'Align Left',
        // Grouped with Center/Right below -- see the 'bius' comment above.
        group: 'align',
        isActive: (el: HTMLElement) => PropertyRenderer._readState(el).textAlign === 'left',
        command: (el: HTMLElement) => VariableContentTool._applyProperty(el, 'textAlign', 'left'),
      },
      {
        icon: 'format_align_center',
        label: 'Align Center',
        group: 'align',
        isActive: (el: HTMLElement) => {
          const state = PropertyRenderer._readState(el);
          return state.textAlign === 'center' || !state.textAlign;
        },
        command: (el: HTMLElement) => VariableContentTool._applyProperty(el, 'textAlign', 'center'),
      },
      {
        icon: 'format_align_right',
        label: 'Align Right',
        group: 'align',
        isActive: (el: HTMLElement) => PropertyRenderer._readState(el).textAlign === 'right',
        command: (el: HTMLElement) => VariableContentTool._applyProperty(el, 'textAlign', 'right'),
      },
      // Same shared quick-action as TextTool.ts's own "Auto-fit to text" --
      // the underlying mechanism (AutoFitText.applyAutoSize(), gated on
      // `_craftoolsAutoResize`) was already wired up here (called from
      // _applyVariablePreview() whenever the resolved value changes, and
      // from every AUTOFIT_RELEVANT_KEYS property change), but nothing
      // anywhere in this tool's panel or ctx-bar ever exposed a way to turn
      // it ON in the first place.
      this._autoFitCtxOption({
        isActive: isAutoFitOn,
        toggle:   (el: HTMLElement) => VariableContentTool._applyProperty(el, 'autoFit', !isAutoFitOn(el)),
        label:    'Auto-fit to content',
      }),
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
    const el = document.createElement('craftools-element') as HTMLElement & {
      _craftoolsAutoResize?: boolean;
      _craftoolsVariable?:   VariableBinding | null;
    };
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', '220');
    el.setAttribute('h', '50');
    el.setAttribute('data-craftool', 'variablecontent');

    // Defaults to a fresh 'date' binding instead of leaving the variable
    // unset -- this tool's entire purpose IS the bound variable (see the
    // Typography section's comment below and hideNoneOption above), so an
    // empty/"Nenhuma" starting state no longer exists to fall into.
    el._craftoolsVariable = VariableEngine.defaultBinding('date');
    // Auto-fit starts OFF (see AutoFitText.ts / CommonSchema.ts's
    // sizePositionSection({ autoFit: true })) -- only `true` turns it on.
    el._craftoolsAutoResize = false;

    // Follows the Settings panel's global default text alignment the same
    // way TextTool.ts's createElement() does -- this used to be missing
    // entirely (no `text-align` in the baseline style below), so a fresh
    // Variable Content element always rendered browser-default left-aligned
    // no matter what "Alinhamento padrão do texto" was set to in
    // Configurações, while Text (title/paragraph) elements correctly picked
    // it up. _syncFromDOM()'s own textAlign backfill reads
    // `content.style.textAlign` too, so setting it here fixes both the
    // initial render and that backfill in one place.
    const defaultAlign = AppSettings.get('defaultTextAlign');

    const content = document.createElement('div');
    content.setAttribute('contenteditable', 'false');
    content.setAttribute('spellcheck', 'false');
    content.style.cssText = `
      font-size: 16px;
      font-weight: 400;
      color: #1a1a1a;
      font-family: ${withEmojiFallback('DM Sans')};
      text-align: ${defaultAlign};
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
    el.appendChild(content);

    // Resolves the default 'date' binding set above into its real preview
    // text (e.g. today's date) instead of leaving the placeholder
    // ("Configure uma variável...") showing until the user happens to open
    // the properties panel -- that placeholder is only actually correct for
    // a binding-less state, which this tool no longer has (createElement()
    // always seeds a real 'date' binding, see the comment above). Same
    // resolve path _applyProperty()'s 'variableBinding' case already uses,
    // so a freshly dropped element looks identical to one whose date
    // binding was just re-saved from the panel.
    VariableContentTool._applyVariablePreview(el, content, el._craftoolsVariable ?? null);

    return el;
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    // First and open by default: unlike Barcode/QRCode (where the variable
    // binding is a secondary option alongside their own content config),
    // this tool's entire purpose IS the bound variable -- matches
    // MobileToolbar.ts's _getVariableContentItems(), which also lists it first.
    const varSection = variableBindingSection({ defaultOpen: true, hideNoneOption: true });
    // Business Card mode only (hidden otherwise -- see _cardRepetitionIndex()'s
    // doc comment for the resolution mechanics this drives). The binding
    // itself (type/format/mode/etc, above) always stays identical across the
    // whole card group via BaseTool._syncLinkedClones() -- this toggle only
    // controls whether every card resolves it at the SAME repetition (on,
    // default -- identical content everywhere, matching the position/text
    // coupling every other tool already gets in this mode) or each card
    // resolves it at ITS OWN repetition (off -- sequencial/random variation
    // per card, same mechanism Agenda Export's multi-page loop uses).
    varSection.fields.push({
      type: 'toggle', key: 'repeatAcrossCards',
      label: 'Repeat content on all cards', i18nKey: 'variableContentTool.repeatAcrossCards',
      hidden: (el: HTMLElement) => !el.hasAttribute('data-linked-id'),
    });
    return [
      varSection,
      {
        section: 'Typography',
        i18nKey: 'textTool.typography',
        icon: 'text_fields',
        fields: [
          { type: 'font-select', key: 'font',     label: 'Font',   i18nKey: 'textTool.font' },
          { type: 'slider',      key: 'fontSize', label: 'Size',   i18nKey: 'textTool.size', min: 8, max: 200, step: 1 },
          { type: 'align',       key: 'textAlign' },
          fontStyleField([
            { key: 'bold',      style: 'bold',      i18nKey: 'textTool.bold' },
            { key: 'italic',    style: 'italic',    i18nKey: 'textTool.italic' },
            { key: 'underline', style: 'underline', i18nKey: 'textTool.underline' },
          ]),
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

    // "Repeat content on all cards" flip -- doesn't change the binding
    // itself, only which repetition THIS card resolves it at (see
    // _cardRepetitionIndex()), so re-run the preview to pick that up
    // immediately instead of waiting for the next unrelated binding edit.
    if (key === 'repeatAcrossCards') {
      const binding = (element as HTMLElement & { _craftoolsVariable?: VariableBinding | null })._craftoolsVariable ?? null;
      const content = getContent(element);
      if (content) VariableContentTool._applyVariablePreview(element, content, binding);
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
      case 'underline': content.style.textDecoration = value ? 'underline' : 'none'; break;
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
