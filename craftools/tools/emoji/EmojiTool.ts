/**
 * EmojiTool — Emoji picker and element tool.
 *
 * Emojis are rendered with 'Noto Color Emoji' font for consistent
 * cross-platform display. The picker shows category tabs + search
 * and supports both click-to-add and drag-to-canvas.
 */

import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import { renderEmojiPicker } from '../../utils/EmojiPickerUI';
import type { PropertySchema } from '../../types/PropertySchema';
import './EmojiTool_Translations.js';

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

  /**
   * Builds a `<craftools-element>` containing a single emoji. Recovered
   * from the pre-migration EmojiTool.js (deleted by the "Purge legacy JS"
   * commit without this logic being ported) -- the previous file had no
   * createElement() at all, throwing "createElement is not a function"
   * for every emoji element creation.
   */
  public static createElement(emoji: string): HTMLElement {
    const el = document.createElement('craftools-element');
    el.setAttribute('w', '80');
    el.setAttribute('h', '80');
    el.setAttribute('data-craftool', 'emoji');

    const inner = document.createElement('div');
    inner.dataset.emojiChar = emoji;
    inner.style.cssText = `
      font-size: 64px;
      font-family: 'Noto Color Emoji', sans-serif;
      line-height: 1;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      user-select: none;
      pointer-events: none;
    `;
    inner.textContent = emoji;
    el.appendChild(inner);
    return el;
  }

  /**
   * Renders the emoji picker (category tabs + search + grid) into
   * `panelBody`. Recovered from the pre-migration EmojiTool.js -- this
   * method didn't exist anywhere post-migration, so opening the "Emoji"
   * sidebar/footer-nav entry rendered an empty panel.
   *
   * If `targetElement` is given, clicking an emoji swaps that element's
   * character instead of creating a new one (used by the "Change emoji"
   * context-bar action).
   */
  public static renderPickerPanel(
    panelBody: HTMLElement,
    editor: HTMLElement,
    targetElement: (HTMLElement & { select?: () => void }) | null = null,
  ): void {
    const applyEmoji = (emoji: string): void => {
      if (targetElement) {
        const inner = targetElement.querySelector<HTMLElement>('[data-emoji-char]');
        if (inner) { inner.dataset.emojiChar = emoji; inner.textContent = emoji; }
        targetElement.dispatchEvent(new CustomEvent('craftools-element-change', {
          bubbles: true, detail: { element: targetElement },
        }));
      } else {
        const page = editor.querySelector('.craftools-page') as HTMLElement | null;
        if (!page) return;
        const rect = page.getBoundingClientRect();
        const scale = window.craftoolsZoomLevel || 1;
        const el = EmojiTool.createElement(emoji) as HTMLElement & { select?: () => void };
        el.setAttribute('x', String(Math.round(rect.width / scale / 2 - 40)));
        el.setAttribute('y', String(Math.round(rect.height / scale / 2 - 40)));
        page.appendChild(el);
        requestAnimationFrame(() => { setTimeout(() => el.select?.(), 20); });
        const ph = page.querySelector('div[style*="font-size: 14px"]');
        if (ph) ph.remove();
      }
    };

    // Renders into a dedicated child wrapper rather than `panelBody` itself.
    // renderEmojiPicker() stashes its options and binds its delegated click
    // listener directly on whatever container it's given (see
    // EmojiPickerUI.ts's bind-once contract) -- and while
    // BaseTool.renderPropertiesPanel() clears #panel-body's `innerHTML` when
    // switching to a different element/tool, that only destroys DESCENDANT
    // nodes (and their listeners); a listener bound to #panel-body itself
    // survives forever. Previously this called
    // `renderEmojiPicker(panelBody, ...)` directly, so opening this sidebar
    // picker even once left a permanent listener on #panel-body whose
    // closure still pointed at this `applyEmoji` (create a brand-new plain
    // emoji element on the page). Any LATER click on an emoji button
    // anywhere else inside the panel -- e.g. EmojiKitchenTool's own
    // "emoji-kitchen-pair" field's left-emoji picker -- bubbled up past its
    // own (correct) listener and also hit this stale one, silently dropping
    // an extra "pure emoji" element onto the page every time.
    if (!panelBody.querySelector('.ct-emoji-sidebar-wrap')) {
      panelBody.innerHTML = '<div class="ct-emoji-sidebar-wrap"></div>';
    }
    const wrap = panelBody.querySelector<HTMLElement>('.ct-emoji-sidebar-wrap')!;
    renderEmojiPicker(wrap, { onSelect: applyEmoji, draggable: true });
  }

  static getCtxOptions(): Array<{ icon: string; label: string; command: (element: HTMLElement) => void }> {
    return [];
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Emoji',
        i18nKey: 'emojiTool.section',
        icon: 'emoji_emotions',
        defaultOpen: true,
        fields: [
          // Same category-tab + search + grid picker as the sidebar
          // "insert emoji" panel (utils/EmojiPickerUI.ts), embedded inline
          // instead of a bare text input for the raw character.
          { type: 'emoji-picker', key: 'emoji' },
          { type: 'slider', key: 'fontSize', label: 'Size', i18nKey: 'emojiTool.fontSize', min: 16, max: 256, step: 4 },
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
ToolRegistry.register({ key: 'emoji', label: 'editor.emoji', icon: 'emoji_emotions', emojiIcon: '😊', tool: EmojiTool, draggable: true, showInFooterNav: false, category: 'elements' });
