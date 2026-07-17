import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import { loadEmojiKitchenCombo, loadEmojiKitchenSupported } from '../../utils/ApiDataLoader';
import type { PropertySchema } from '../../types/PropertySchema';

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
    const meta = getMeta(element) as unknown as Record<string, unknown>;
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    ['leftEmoji','rightEmoji','rightMode','imageUrl'].forEach(k => {
      if (!(k in existing) && meta[k] !== undefined) patch[k] = meta[k];
    });
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
        defaultOpen: true,
        fields: [
          { type: 'text',   key: 'leftEmoji',  label: 'Left emoji' },
          {
            type: 'select', key: 'rightMode', label: 'Right mode',
            options: [{ value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Auto' }],
          },
          { type: 'text', key: 'rightEmoji', label: 'Right emoji' },
        ],
      },
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const e = element as HTMLElement & { _craftoolsMeta?: EmojiKitchenMeta };
    if (e._craftoolsMeta) (e._craftoolsMeta as unknown as Record<string, unknown>)[key] = value;
    if (key === 'zIndex') { element.style.zIndex = String(value); return; }
    // Calls _resolveAndRender() directly (previously dispatched an
    // unlistened 'craftools-emojikitchen-regenerate' custom event, so
    // panel edits never actually re-fetched/re-rendered the combo image).
    EmojiKitchenTool._resolveAndRender(e);
  }
}

EmojiKitchenTool.registeredKeys = ['emojikitchen'];
ToolRegistry.register({ key: 'emojikitchen', label: 'editor.emojiKitchen', icon: 'blender', tool: EmojiKitchenTool, draggable: true, showInFooterNav: false, category: 'elements' });
