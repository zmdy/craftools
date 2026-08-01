/**
 * emoji-kitchen-pair field — EmojiKitchenTool.ts's combined 1st-emoji /
 * 2nd-emoji picker control.
 *
 * The 1st emoji uses the full standardized category-tab + search + grid
 * picker (utils/EmojiPickerUI.ts's renderEmojiPicker()), filtered to only
 * emojis with at least one Emoji Kitchen combo at all. The 2nd emoji uses
 * the same picker's flat-grid-only mode (renderEmojiGrid(), no category
 * tabs/search) restricted to the combo partners actually available for the
 * CURRENTLY picked 1st emoji -- a category picker over the 2nd emoji would
 * be actively misleading (nearly every category would look empty except a
 * handful of scattered valid partners), and mirrors
 * utils/VariablePanel.ts's identical 'emojiKitchen' variable-binding UI,
 * which solves this same first-drives-second-options problem for the
 * "Conteúdo Variável" tool's own Emoji Kitchen mode. A dedicated pill
 * button above the 2nd emoji's grid covers "combine with itself" -- there's
 * no natural "none" choice inside a grid of emoji buttons the way a
 * `<select>` has an empty `<option>`, which is what this used to be.
 *
 * Both values only ever change together (picking a new left emoji always
 * resets the right one, since the old partner may not even be valid for
 * the new left emoji), so they're stored as ONE JSON-stringified
 * `{ leftEmoji, rightEmoji }` object -- same "PropertyRenderer diffs
 * String(value), so a stored value needs a real string" reasoning as
 * variable-binding.field.ts.
 *
 * Unlike most fields, this one manages its own full reactivity internally
 * (selecting a left emoji immediately reloads/repaints the right select)
 * rather than relying on PropertyRenderer calling render() again --
 * ordinary field-driven onChange calls don't trigger a full panel
 * re-render (see BaseTool.renderPropertiesPanel()'s doc comment), so a
 * field whose own UI depends on its own in-progress edits has to keep
 * itself in sync rather than wait to be re-rendered from outside.
 */

import { FieldRegistry } from '../FieldRegistry';
import { renderEmojiPicker, renderEmojiGrid } from '../EmojiPickerUI';
import { loadEmojiKitchenSupported, loadEmojiKitchenPartners } from '../ApiDataLoader.js';
import { I18n } from '../../settings/Translations.js';

export interface EmojiKitchenPairValue {
  leftEmoji:  string;
  rightEmoji: string;
}

/** Safely parses a stored emoji-kitchen-pair value (JSON string or object) back into `{leftEmoji, rightEmoji}`. */
export function parseEmojiKitchenPair(raw: unknown): EmojiKitchenPairValue {
  if (raw && typeof raw === 'object') {
    const o = raw as Partial<EmojiKitchenPairValue>;
    return { leftEmoji: o.leftEmoji ?? '', rightEmoji: o.rightEmoji ?? '' };
  }
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Partial<EmojiKitchenPairValue>;
      return { leftEmoji: parsed.leftEmoji ?? '', rightEmoji: parsed.rightEmoji ?? '' };
    } catch { /* fall through to empty default below */ }
  }
  return { leftEmoji: '', rightEmoji: '' };
}

/** Serializes a `{leftEmoji, rightEmoji}` pair back to the field's stored string form. */
export function stringifyEmojiKitchenPair(value: EmojiKitchenPairValue): string {
  return JSON.stringify(value);
}

// Resolved once and reused by every instance of this field on the page
// (ApiDataLoader.ts's own loadEmojiKitchenSupported() is itself cached, but
// wrapping it in a Set here avoids re-scanning the array on every keystroke
// of a search or every category switch).
let _supportedSetPromise: Promise<Set<string>> | null = null;
function loadSupportedSet(): Promise<Set<string>> {
  if (!_supportedSetPromise) {
    _supportedSetPromise = loadEmojiKitchenSupported().then(list => new Set(list as string[]));
  }
  return _supportedSetPromise;
}

interface BoundContainer extends HTMLElement {
  _ctFieldOnChange?: (value: unknown) => void;
  _ctKitchenValue?: EmojiKitchenPairValue;
}

FieldRegistry.register('emoji-kitchen-pair', {
  render(container, _field, rawValue) {
    const c = container as BoundContainer;
    c._ctKitchenValue = parseEmojiKitchenPair(rawValue);

    if (!c.querySelector('.ct-ek-left-wrap')) {
      c.innerHTML = `
        <div class="ct-field">
          <span class="craftools-label">${I18n.t('emojiKitchenTool.leftLabel')}</span>
          <div class="ct-ek-left-wrap"></div>
        </div>
        <div class="ct-field" style="margin-top:10px;">
          <span class="craftools-label">${I18n.t('emojiKitchenTool.rightLabel')}</span>
          <button type="button" class="craftools-pill ct-ek-right-self-btn" style="margin:4px 0 6px; display:block; width:100%; text-align:center;">${I18n.t('emojiKitchenTool.rightSelf')}</button>
          <div class="ct-ek-right-wrap"></div>
        </div>`;
    }

    const leftWrap    = c.querySelector<HTMLElement>('.ct-ek-left-wrap')!;
    const rightWrap    = c.querySelector<HTMLElement>('.ct-ek-right-wrap')!;
    const rightSelfBtn = c.querySelector<HTMLButtonElement>('.ct-ek-right-self-btn')!;

    const commit = (): void => {
      c._ctFieldOnChange?.(stringifyEmojiKitchenPair(c._ctKitchenValue!));
    };

    // Right emoji used to be a plain <select> of combo partners, then a
    // full category-tab + grid picker (same chrome as the left emoji) --
    // still awkward, since a category picker over a small, already-filtered
    // partner list mostly showed empty categories. Rebuilt as
    // renderEmojiGrid() (utils/EmojiPickerUI.ts): a flat grid of ONLY the
    // partners actually available for the currently-picked left emoji, no
    // tabs/search, plus the dedicated "combine with itself" toggle button
    // above it (there's no natural "none" choice inside a grid of emoji
    // buttons the way a <select> has an empty <option>).
    let rightPartners: string[] | null = null; // null = still loading
    const paintRight = (): void => {
      const isSelf = !c._ctKitchenValue!.rightEmoji;
      rightSelfBtn.classList.toggle('active', isSelf);
      renderEmojiGrid(rightWrap, rightPartners ?? [], {
        selected:  c._ctKitchenValue!.rightEmoji,
        draggable: false,
        loading:   rightPartners === null,
        onSelect:  (emoji) => {
          c._ctKitchenValue = { ...c._ctKitchenValue!, rightEmoji: emoji };
          commit();
          paintRight();
        },
      });
    };

    const refreshRightOptions = async (): Promise<void> => {
      const left = c._ctKitchenValue!.leftEmoji;
      rightPartners = null;
      rightSelfBtn.disabled = true;
      if (!left) {
        paintRight();
        return;
      }
      paintRight(); // shows the grid's own loading state
      const partners = ((await loadEmojiKitchenPartners(left)) as string[]).filter(p => p !== left);
      // The user may have picked a different left emoji again while this
      // request was in flight -- drop the now-stale response instead of
      // clobbering the grid with partners for the wrong emoji.
      if (c._ctKitchenValue!.leftEmoji !== left) return;
      rightPartners = partners;
      rightSelfBtn.disabled = false;
      paintRight();
    };

    const paintLeft = (supported: Set<string> | null): void => {
      renderEmojiPicker(leftWrap, {
        selected:  c._ctKitchenValue!.leftEmoji,
        draggable: false,
        loading:   supported === null,
        filter:    supported ? (e) => supported.has(e) : undefined,
        onSelect:  (emoji) => {
          c._ctKitchenValue = { leftEmoji: emoji, rightEmoji: '' };
          commit();
          refreshRightOptions();
          // Re-paint immediately so the newly-picked emoji's "selected"
          // highlight shows without waiting on the supported-set promise
          // again (it's already resolved by this point).
          paintLeft(supported);
        },
      });
    };

    rightSelfBtn.onclick = () => {
      if (rightSelfBtn.disabled) return;
      c._ctKitchenValue = { ...c._ctKitchenValue!, rightEmoji: '' };
      commit();
      paintRight();
    };

    paintLeft(null); // shows a loading placeholder synchronously first
    loadSupportedSet().then(set => paintLeft(set));
    refreshRightOptions();
  },

  bind(container, _field, onChange) {
    (container as BoundContainer)._ctFieldOnChange = onChange;
  },
});
