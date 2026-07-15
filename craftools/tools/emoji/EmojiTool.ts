import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import type { PropertySchema } from '../../types/PropertySchema';

/** EmojiTool stores emoji char in inner.dataset.emojiChar and size in inner.style.fontSize */
const getInner = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-emoji-char], .ct-emoji-inner');

export class EmojiTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const inner = getInner(element);
    if (!inner) return;
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    if (!('emoji'    in existing)) patch.emoji    = inner.dataset.emojiChar ?? inner.textContent?.trim() ?? '';
    if (!('fontSize' in existing)) patch.fontSize = parseFloat(inner.style.fontSize) || 64;
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Emoji',
        defaultOpen: true,
        fields: [
          { type: 'text',   key: 'emoji',    label: 'Emoji character' },
          { type: 'slider', key: 'fontSize', label: 'Size', min: 16, max: 256, step: 4 },
        ],
      },
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const inner = getInner(element);
    if (!inner) return;
    if (key === 'emoji') { inner.dataset.emojiChar = String(value); inner.textContent = String(value); }
    if (key === 'fontSize') inner.style.fontSize = `${value}px`;
    if (key === 'zIndex') element.style.zIndex = String(value);
  }
}

EmojiTool.registeredKeys = ['emoji'];
ToolRegistry.register({ key: 'emoji', label: 'editor.emoji', icon: 'emoji_emotions', tool: EmojiTool, draggable: true, showInFooterNav: false, category: 'elements' });
