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
import type { PropertySchema } from '../../types/PropertySchema';

/** EmojiTool stores emoji char in inner.dataset.emojiChar and size in inner.style.fontSize */
const getInner = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-emoji-char], .ct-emoji-inner');

interface EmojiCategory {
  id:     string;
  label:  string;
  icon:   string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'rostos', label: 'Rostos', icon: '😊',
    emojis: ['😀','😁','😂','🤣','😃','😄','😅','😆','😇','😉','😊','🙂','🙃','😌','😍','🥰','😘','😋','😛','😎','🤩','🥳','😏','😒','😔','😟','🙁','☹️','😣','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','😱','😨','😰','😥','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😮','😲','🥱','😴','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑']
  },
  {
    id: 'gestos', label: 'Gestos', icon: '👍',
    emojis: ['👋','🤚','✋','🖖','👌','🤌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤝','🙏','💪','💅','🤳','👀','👁️','👅','💋','👂','👃','🫀','🧠','🦷']
  },
  {
    id: 'animais', label: 'Animais', icon: '🐶',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🦆','🦉','🦇','🐝','🦋','🐌','🐞','🐜','🦅','🐢','🐍','🦎','🐙','🦑','🦐','🦀','🐟','🐬','🐳','🦈','🐊','🦓','🦒','🐘','🦛','🦏','🦬','🐕','🐈','🐇','🦔','🦝','🦦']
  },
  {
    id: 'natureza', label: 'Natureza', icon: '🌸',
    emojis: ['🌸','🌼','🌻','🌺','🌹','🥀','🌷','🌱','🪴','🌿','☘️','🍀','🍃','🍂','🍁','🌾','🍄','🌍','🌎','🌏','🌋','⛰️','🏔️','🏖️','🏜️','🏝️','🌅','🌄','🌠','🌈','❄️','⛄','☃️','💧','💦','🔥','🌊','☁️','⛅','🌤️','🌧️','⛈️','🌩️','🌬️','💨','🌀','⚡','🌿']
  },
  {
    id: 'comida', label: 'Comida', icon: '🍕',
    emojis: ['🍕','🍔','🍟','🌭','🌮','🌯','🥙','🍳','🥘','🍲','🥞','🧇','🥓','🍗','🍖','🌽','🥕','🍆','🥑','🍅','🍓','🍇','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🥝','🍯','🧀','🍞','🥐','🥖','🧁','🍰','🎂','🍭','🍬','🍫','🍩','🍪','☕','🍵','🧋','🍺','🍷','🍸','🍾','🥂']
  },
  {
    id: 'atividades', label: 'Atividades', icon: '⚽',
    emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','⛳','🎣','🥊','🥋','🎿','⛷️','🏂','🏋️','🧘','🏊','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🎷','🎺','🎸','🎻','🎲','🎯','🎮','🎰','🧩','🪁','🤿','🧗','🏄','🚣']
  },
  {
    id: 'viagem', label: 'Viagem', icon: '✈️',
    emojis: ['✈️','🛫','🛬','🚗','🚕','🚙','🛻','🚌','🏎️','🚓','🚑','🚒','🛵','🚲','🛴','🚁','🛸','🚢','🛳️','⛵','🚤','🚂','🚃','🚄','🚅','🚆','🚇','🚊','🚞','🗼','🏰','🗽','⛩️','🏯','🏕️','🌁','🌃','🏙️','🌆','🌇','🌉','⛺','🏖️','🏜️','🏝️','🗺️','🧭']
  },
  {
    id: 'objetos', label: 'Objetos', icon: '📱',
    emojis: ['📱','💻','⌨️','🖥️','🖨️','🖱️','📷','📸','📹','🎥','📞','☎️','📺','📻','⌚','🕰️','📡','🔋','🔌','💡','🔦','🕯️','🛋️','🛏️','🚿','🛁','💊','💉','🔬','🔭','📚','📖','📝','✏️','🖊️','✂️','🔑','🗝️','🔐','🔒','🔓','🗑️','💰','💳','💎','💍','👑','🎩','🪄','🧸','🎁']
  },
  {
    id: 'simbolos', label: 'Símbolos', icon: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝','✨','⭐','🌟','💫','⚡','🔥','🎵','🎶','💬','💭','🗯️','💤','🔔','🔕','🔊','🔇','📢','📣','✅','❌','⭕','🚫','💯','♻️','⚠️','🆕','🆒','🆓','🔴','🟠','🟡','🟢','🔵','🟣','⬛','⬜','🏳️','🏴','🎌','🏳️‍🌈']
  },
  {
    id: 'celebracao', label: 'Celebração', icon: '🎉',
    emojis: ['🎉','🎊','🎈','🎁','🎀','🎗️','🎟️','🎫','🏆','🥇','🥈','🥉','🎯','🎪','🎆','🎇','🧨','✨','🎃','🎄','🎋','🎍','🎑','🎎','🎏','🎐','🧧','🥳','🍾','🥂','🎂','🕯️','🎠','🎡','🎢','🎭']
  },
];

const PICKER_STYLE_ID = 'ct-emoji-picker-styles';

function ensurePickerStyles(): void {
  if (document.getElementById(PICKER_STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = PICKER_STYLE_ID;
  s.textContent = `
    .ct-emoji-tab-bar {
      display: flex; gap: 2px; overflow-x: auto; padding: 8px 10px 0;
      border-bottom: 1px solid var(--border); scrollbar-width: none;
    }
    .ct-emoji-tab-bar::-webkit-scrollbar { display: none; }
    .ct-emoji-tab {
      background: none; border: none; cursor: pointer;
      font-size: 18px; padding: 5px 7px; border-radius: 6px;
      transition: background 0.12s; flex-shrink: 0;
      font-family: 'Noto Color Emoji', sans-serif;
      line-height: 1; border-bottom: 2px solid transparent;
    }
    .ct-emoji-tab.active {
      background: var(--bg-hover, rgba(0,0,0,.06));
      border-bottom-color: var(--accent, #f97316);
    }
    .ct-emoji-tab:hover { background: var(--bg-hover, rgba(0,0,0,.06)); }
    .ct-emoji-search {
      padding: 8px 10px 4px;
    }
    .ct-emoji-search input {
      width: 100%; padding: 6px 10px; border-radius: 8px;
      border: 1px solid var(--border, #e4e4e7);
      background: var(--bg-input, #f4f4f5);
      color: var(--text-primary, #18181b);
      font-size: 12px; font-family: 'DM Sans', sans-serif;
      outline: none;
    }
    .ct-emoji-search input:focus {
      border-color: var(--accent, #f97316);
    }
    .ct-emoji-cat-label {
      font-size: 10px; font-weight: 600; color: var(--text-secondary, #71717a);
      text-transform: uppercase; letter-spacing: 0.5px;
      padding: 8px 10px 2px;
    }
    .ct-emoji-grid {
      display: grid; grid-template-columns: repeat(7, 1fr);
      gap: 1px; padding: 4px 6px 12px; min-height: 80px;
    }
    .ct-emoji-btn {
      background: none; border: none; cursor: grab;
      font-size: 22px; line-height: 1; padding: 5px 2px;
      border-radius: 6px; text-align: center;
      transition: background 0.1s, transform 0.1s;
      font-family: 'Noto Color Emoji', sans-serif;
      user-select: none; touch-action: none;
    }
    .ct-emoji-btn:hover {
      background: var(--bg-hover, rgba(0,0,0,.06));
      transform: scale(1.18);
    }
    .ct-emoji-btn:active { cursor: grabbing; transform: scale(0.9); }
    .ct-emoji-empty {
      grid-column: 1/-1; text-align: center;
      font-size: 12px; color: var(--text-secondary, #71717a);
      padding: 20px 0;
    }
    .ct-emoji-preview {
      text-align: center;
      font-size: 72px;
      line-height: 1;
      padding: 12px 0 6px;
      font-family: 'Noto Color Emoji', sans-serif;
    }
    .ct-emoji-change-picker {
      max-height: 260px; overflow-y: auto;
    }
  `;
  document.head.appendChild(s);
}

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
    ensurePickerStyles();

    let activeCat = 0;
    let searchQuery = '';

    const buildGrid = (): string => {
      if (searchQuery) {
        // Search across all categories -- simple UX for now (no per-emoji
        // keywords yet), just lists every emoji across all categories.
        const all = EMOJI_CATEGORIES.flatMap(c => c.emojis);
        const unique = [...new Set(all)];
        return `
          <div class="ct-emoji-cat-label">Resultados</div>
          <div class="ct-emoji-grid" id="ct-emoji-grid">
            ${unique.length
              ? unique.map(e => `<button class="ct-emoji-btn" data-emoji="${e}" draggable="true" title="${e}">${e}</button>`).join('')
              : '<div class="ct-emoji-empty">Nenhum emoji encontrado</div>'}
          </div>`;
      }
      const cat = EMOJI_CATEGORIES[activeCat];
      return `
        <div class="ct-emoji-cat-label">${cat.label}</div>
        <div class="ct-emoji-grid" id="ct-emoji-grid">
          ${cat.emojis.map(e => `<button class="ct-emoji-btn" data-emoji="${e}" draggable="true" title="${e}">${e}</button>`).join('')}
        </div>`;
    };

    const bindGridEvents = (): void => {
      panelBody.querySelectorAll<HTMLButtonElement>('.ct-emoji-btn').forEach(btn => {
        const emoji = btn.dataset.emoji as string;
        btn.addEventListener('click', (e) => { e.preventDefault(); applyEmoji(emoji); });
        btn.addEventListener('dragstart', (ev: Event) => {
          const dt = (ev as DragEvent).dataTransfer;
          dt?.setData('ToolType', 'emoji');
          dt?.setData('EmojiChar', emoji);
          if (dt) dt.effectAllowed = 'copy';
          dt?.setDragImage(btn, 12, 12);
        });
      });
    };

    const rebuildGrid = (): void => {
      const container = panelBody.querySelector('#ct-emoji-tabs');
      if (!container) return;
      panelBody.querySelectorAll('.ct-emoji-tab').forEach((t, i) => {
        t.classList.toggle('active', i === activeCat);
      });
      const gridWrap = panelBody.querySelector('.ct-emoji-cat-label');
      if (gridWrap) {
        const newHtml = buildGrid();
        const tmp = document.createElement('div');
        tmp.innerHTML = newHtml;
        gridWrap.replaceWith(...tmp.childNodes);
      }
      bindGridEvents();
    };

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

    const bindEvents = (): void => {
      panelBody.querySelectorAll<HTMLButtonElement>('.ct-emoji-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          activeCat = parseInt(tab.dataset.cat as string, 10);
          searchQuery = '';
          const si = panelBody.querySelector<HTMLInputElement>('#ct-emoji-search-input');
          if (si) si.value = '';
          rebuildGrid();
        });
      });

      const searchInput = panelBody.querySelector<HTMLInputElement>('#ct-emoji-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchQuery = (e.target as HTMLInputElement).value.trim();
          rebuildGrid();
        });
        requestAnimationFrame(() => searchInput.focus());
      }

      bindGridEvents();
    };

    const renderAll = (): void => {
      panelBody.innerHTML = `
        <div class="ct-emoji-tab-bar" id="ct-emoji-tabs">
          ${EMOJI_CATEGORIES.map((c, i) => `
            <button class="ct-emoji-tab ${i === activeCat ? 'active' : ''}"
              data-cat="${i}" title="${c.label}">${c.icon}</button>`).join('')}
        </div>
        <div class="ct-emoji-search">
          <input type="search" placeholder="🔍 Pesquisar emoji..." id="ct-emoji-search-input" value="${searchQuery}">
        </div>
        ${buildGrid()}
      `;
      bindEvents();
    };

    renderAll();
  }

  static getCtxOptions(): Array<{ icon: string; label: string; command: (element: HTMLElement) => void }> {
    return [];
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Emoji',
        icon: 'emoji_emotions',
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
