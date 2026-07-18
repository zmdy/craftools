/**
 * emoji-kitchen-pair field — EmojiKitchenTool.ts's combined left-emoji-
 * picker + right-emoji-select control.
 *
 * The left emoji reuses the standardized category-tab + search + grid
 * picker (utils/EmojiPickerUI.ts), filtered down to only emojis that
 * actually have at least one Emoji Kitchen combo -- picking a random
 * unsupported emoji would just render a broken/empty combo image. The
 * right emoji is a plain `<select>` populated from whichever combo
 * partners are actually available for the CURRENTLY picked left emoji
 * (mirrors utils/VariablePanel.ts's existing 'emojiKitchen' variable-
 * binding UI, which solves this identical left-drives-right-options
 * problem for the "Conteúdo Variável" tool's own Emoji Kitchen mode).
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
import { renderEmojiPicker } from '../EmojiPickerUI';
import { loadEmojiKitchenSupported, loadEmojiKitchenPartners } from '../ApiDataLoader.js';

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
          <span class="craftools-label">Left emoji</span>
          <div class="ct-ek-left-wrap"></div>
        </div>
        <div class="ct-field" style="margin-top:10px;">
          <span class="craftools-label">Right emoji</span>
          <select class="craftools-select ct-ek-right-select" style="font-family:'Noto Color Emoji', sans-serif; font-size:20px;"></select>
        </div>`;
    }

    const leftWrap    = c.querySelector<HTMLElement>('.ct-ek-left-wrap')!;
    const rightSelect = c.querySelector<HTMLSelectElement>('.ct-ek-right-select')!;

    const commit = (): void => {
      c._ctFieldOnChange?.(stringifyEmojiKitchenPair(c._ctKitchenValue!));
    };

    const refreshRightOptions = async (): Promise<void> => {
      const left = c._ctKitchenValue!.leftEmoji;
      if (!left) {
        rightSelect.innerHTML = '<option value="">—</option>';
        rightSelect.disabled  = true;
        return;
      }
      rightSelect.disabled  = true;
      rightSelect.innerHTML = '<option>...</option>';
      const partners = ((await loadEmojiKitchenPartners(left)) as string[]).filter(p => p !== left);
      // The user may have picked a different left emoji again while this
      // request was in flight -- drop the now-stale response instead of
      // clobbering the select with partners for the wrong emoji.
      if (c._ctKitchenValue!.leftEmoji !== left) return;
      const current = c._ctKitchenValue!.rightEmoji;
      rightSelect.innerHTML = ['<option value="">Combinar com ele mesmo</option>']
        .concat(partners.map(p => `<option value="${p}"${current === p ? ' selected' : ''}>${p}</option>`))
        .join('');
      rightSelect.disabled = false;
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

    rightSelect.onchange = () => {
      c._ctKitchenValue = { ...c._ctKitchenValue!, rightEmoji: rightSelect.value };
      commit();
    };

    paintLeft(null); // shows a loading placeholder synchronously first
    loadSupportedSet().then(set => paintLeft(set));
    refreshRightOptions();
  },

  bind(container, _field, onChange) {
    (container as BoundContainer)._ctFieldOnChange = onChange;
  },
});
