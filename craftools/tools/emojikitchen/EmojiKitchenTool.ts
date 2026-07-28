import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import { loadEmojiKitchenCombo, loadEmojiKitchenSupported } from '../../utils/ApiDataLoader';
import { stringifyEmojiKitchenPair, parseEmojiKitchenPair } from '../../utils/fields/emoji-kitchen-pair.field';
import type { PropertySchema } from '../../types/PropertySchema';
// Registers 'emojiKitchenTool.*' i18n keys used in getPropertySchema() below.
import './EmojiKitchenTool_Translations.js';

interface EmojiKitchenMeta {
  leftEmoji:  string;
  rightEmoji: string;
  rightMode:  string;
  imageUrl:   string;
}

const getMeta = (el: HTMLElement): EmojiKitchenMeta =>
  (el as HTMLElement & { _craftoolsMeta?: EmojiKitchenMeta })._craftoolsMeta ?? {
    leftEmoji: '', rightEmoji: '', rightMode: 'manual', imageUrl: '',
  };

export class EmojiKitchenTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    // leftEmoji/rightEmoji are now driven together by the single
    // 'emoji-kitchen-pair' field (see getPropertySchema()) -- primed as one
    // JSON-stringified pair, same convention as variable-binding.field.ts.
    // 'rightMode' (manual/auto) is no longer surfaced in the panel: it was
    // stored but never actually read anywhere in _resolveAndRender() below,
    // so it never had any effect -- the new right-emoji select (defaulting
    // to "combine with itself" when empty) already covers both cases it was
    // meant to distinguish.
    if (!('emojiPair' in existing)) {
      patch.emojiPair = stringifyEmojiKitchenPair({ leftEmoji: meta.leftEmoji, rightEmoji: meta.rightEmoji });
    }
    if (!('imageUrl' in existing) && meta.imageUrl !== undefined) patch.imageUrl = meta.imageUrl;
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
  }

  /**
   * Default meta for a freshly-created Emoji Kitchen element. Recovered
   * from the pre-migration EmojiKitchenTool.js (deleted by the "Purge
   * legacy JS" commit).
   */
  public static getDefaultMeta(): EmojiKitchenMeta {
    return { leftEmoji: '', rightEmoji: '', rightMode: 'manual', imageUrl: '' };
  }

  static getCtxOptions(): Array<{ icon: string; label: string; command: (element: HTMLElement) => void }> {
    return [];
  }

  private static _buildImg(meta: EmojiKitchenMeta): HTMLImageElement {
    const img = document.createElement('img');
    img.alt = 'Emoji Kitchen';
    img.style.cssText = 'width:100%; height:100%; display:block; user-select:none; pointer-events:none; object-fit:contain;';
    if (meta.imageUrl) img.src = meta.imageUrl;
    return img;
  }

  /**
   * Builds a `<craftools-element>` with a placeholder image, then resolves
   * the real combo image asynchronously (fire-and-forget). Recovered from
   * the pre-migration EmojiKitchenTool.js (deleted by the "Purge legacy
   * JS" commit without this logic being ported) -- the previous file had
   * no createElement() at all, throwing "createElement is not a function"
   * for every Emoji Kitchen element creation (this is the exact crash
   * named in the original bug report: "mod.VariableContentTool..." was the
   * other one, but Emoji Kitchen had the identical gap).
   */
  public static createElement(_type: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsMeta?: EmojiKitchenMeta };
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', '160');
    el.setAttribute('h', '160');
    el.setAttribute('data-craftool', 'emojikitchen');

    el._craftoolsMeta = EmojiKitchenTool.getDefaultMeta();

    // The element isn't in the DOM yet here -- contentArea only exists
    // after connectedCallback() (see Element.ts). Append directly to `el`;
    // same pattern as QRCodeTool/BarcodeTool/MiniCalendarTool.
    el.appendChild(EmojiKitchenTool._buildImg(el._craftoolsMeta));

    // Resolves the real combo as soon as possible (fire-and-forget) -- once
    // the real image arrives from the API, swaps the <img src> over the
    // placeholder.
    EmojiKitchenTool._resolveAndRender(el);

    return el;
  }

  /**
   * Resolves the combo image from the Emoji Kitchen API and updates the
   * rendered <img>. Called on creation and after every property edit.
   */
  public static async _resolveAndRender(element: HTMLElement & { _craftoolsMeta?: EmojiKitchenMeta }): Promise<void> {
    const meta = element._craftoolsMeta;
    if (!meta) return;

    // If there's no main emoji yet, pick a random supported one.
    if (!(meta.leftEmoji || '').trim()) {
      const supported = await loadEmojiKitchenSupported();
      if (supported && supported.length > 0) {
        meta.leftEmoji = supported[Math.floor(Math.random() * supported.length)];
      } else {
        meta.leftEmoji = '😀'; // fallback
      }
    }

    const left = meta.leftEmoji.trim();
    const right = (meta.rightEmoji || '').trim() || left;
    const combo = await loadEmojiKitchenCombo(left, right);
    meta.imageUrl = (combo && combo.imageUrl) || '';
    const img = element.querySelector('img');
    if (img) img.src = meta.imageUrl;
    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Emoji Kitchen',
        i18nKey: 'emojiKitchenTool.section',
        icon: 'sentiment_very_satisfied',
        defaultOpen: true,
        fields: [
          // Left emoji: the same category-tab + search + grid picker as
          // EmojiTool.ts, filtered to only emojis that actually have Emoji
          // Kitchen combos. Right emoji: a <select> of the combo partners
          // actually available for whichever left emoji is picked. Both
          // values change together, so they're one field -- see
          // utils/fields/emoji-kitchen-pair.field.ts.
          { type: 'emoji-kitchen-pair', key: 'emojiPair' },
        ],
      },
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const e = element as HTMLElement & { _craftoolsMeta?: EmojiKitchenMeta };
    if (key === 'zIndex') { element.style.zIndex = String(value); return; }
    if (key === 'emojiPair') {
      const pair = parseEmojiKitchenPair(value);
      if (e._craftoolsMeta) {
        e._craftoolsMeta.leftEmoji  = pair.leftEmoji;
        e._craftoolsMeta.rightEmoji = pair.rightEmoji;
      }
    } else if (e._craftoolsMeta) {
      (e._craftoolsMeta as unknown as Record<string, unknown>)[key] = value;
    }
    // Calls _resolveAndRender() directly (previously dispatched an
    // unlistened 'craftools-emojikitchen-regenerate' custom event, so
    // panel edits never actually re-fetched/re-rendered the combo image).
    EmojiKitchenTool._resolveAndRender(e);
  }
}

EmojiKitchenTool.registeredKeys = ['emojikitchen'];
// iconImg matches the desktop sidebar exactly (index.html
// #pwa-sidebar-emojikitchen uses a live combo thumbnail <img>, not a
// Material Symbol) -- see ToolDefinition.iconImg. `icon` stays as a
// Material Symbol fallback for any UI that doesn't special-case iconImg.
ToolRegistry.register({
  key: 'emojikitchen',
  label: 'editor.emojiKitchen',
  icon: 'blender',
  iconImg: 'https://www.gstatic.com/android/keyboard/emojikitchen/20241023/u1f614/u1f614_u1f614.png',
  tool: EmojiKitchenTool,
  draggable: true,
  showInFooterNav: false,
  category: 'elements',
});
