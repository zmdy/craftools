import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import type { PropertySchema } from '../../types/PropertySchema';

const getMeta = (el: HTMLElement) =>
  (el as HTMLElement & { _craftoolsMeta?: Record<string, unknown> })._craftoolsMeta ?? {};

export class EmojiKitchenTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    ['leftEmoji','rightEmoji','rightMode','imageUrl'].forEach(k => {
      if (!(k in existing) && meta[k] !== undefined) patch[k] = meta[k];
    });
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
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
    const e = element as HTMLElement & { _craftoolsMeta?: Record<string, unknown> };
    if (e._craftoolsMeta) e._craftoolsMeta[key] = value;
    element.dispatchEvent(new CustomEvent('craftools-emojikitchen-regenerate', { bubbles: false }));
  }
}

EmojiKitchenTool.registeredKeys = ['emojikitchen'];
ToolRegistry.register({ key: 'emojikitchen', label: 'editor.emojiKitchen', icon: 'blender', tool: EmojiKitchenTool, draggable: true, showInFooterNav: false, category: 'elements' });
