/**
 * EmojiPickerUI.ts — the standardized category-tab + search + grid emoji
 * picker, used everywhere an emoji needs to be chosen: EmojiTool.ts's
 * sidebar "insert emoji" panel, its own element's properties panel (via
 * utils/fields/emoji-picker.field.ts), and EmojiKitchenTool.ts's left-emoji
 * picker (via utils/fields/emoji-kitchen-pair.field.ts, filtered to only
 * emojis that actually have Emoji Kitchen combos) -- one picker, reused,
 * not several similar-looking implementations that drift apart over time
 * (same rationale as ColorPickerUI.ts).
 *
 * Design:
 *  - Bind-once, repaint-many: renderEmojiPicker() stashes the current
 *    options on the container and only attaches its delegated listener set
 *    the FIRST time it's called for a given container; every later call
 *    just repaints from the stash (same contract as ColorPickerUI.ts's
 *    renderColorPicker()).
 *  - The tab bar + search input are only rebuilt when the whole picker is
 *    (re)painted from scratch (first render, or the `selected`/`filter`
 *    options changing). Switching category or typing a search query only
 *    ever replaces the single `[data-part="results"]` wrapper's innerHTML
 *    -- never the search `<input>` itself, so it never loses focus/cursor
 *    position mid-keystroke. This targeted, single-container swap is also
 *    what fixes the original category-filter bug: the previous ad-hoc
 *    implementation replaced only the `.ct-emoji-cat-label` sibling via
 *    `Node.replaceWith()`, silently leaving the OLD `.ct-emoji-grid` behind
 *    as an orphaned sibling on every switch -- each tab click piled another
 *    stale grid into the DOM instead of removing the previous one, which is
 *    why filtering looked like it was "still showing everything".
 */

export interface EmojiCategory {
  id:     string;
  label:  string;
  icon:   string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
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
    .ct-emoji-tab-row {
      display: flex; align-items: stretch;
      border-bottom: 1px solid var(--border);
    }
    .ct-emoji-tab-bar {
      display: flex; gap: 2px; overflow-x: auto; padding: 8px 6px 0;
      scrollbar-width: none; flex: 1; min-width: 0;
    }
    .ct-emoji-tab-bar::-webkit-scrollbar { display: none; }
    .ct-emoji-tab-scroll {
      flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      width: 20px; background: none; border: none; cursor: pointer; padding: 0;
      color: var(--text-secondary, #71717a);
    }
    .ct-emoji-tab-scroll .material-symbols-outlined { font-size: 16px; }
    .ct-emoji-tab-scroll:hover:not(:disabled) {
      color: var(--text-primary, #18181b);
      background: var(--bg-hover, rgba(0,0,0,.06));
    }
    .ct-emoji-tab-scroll:disabled { opacity: .25; cursor: default; }
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
    .ct-emoji-btn.selected {
      background: var(--accent-soft, rgba(249,115,22,0.12));
      box-shadow: inset 0 0 0 2px var(--accent, #f97316);
    }
    .ct-emoji-empty {
      grid-column: 1/-1; text-align: center;
      font-size: 12px; color: var(--text-secondary, #71717a);
      padding: 20px 0;
    }
    .ct-emoji-loading {
      text-align: center; font-size: 12px;
      color: var(--text-secondary, #71717a);
      padding: 24px 10px;
    }
  `;
  document.head.appendChild(s);
}

export interface EmojiPickerOptions {
  /** Called with the picked emoji whenever the user clicks (or drops) one. */
  onSelect: (emoji: string) => void;
  /**
   * Restricts every category's grid AND search results to emojis for which
   * this returns true -- e.g. EmojiKitchenTool.ts's left-emoji picker only
   * shows emojis that actually have Emoji Kitchen combos available.
   */
  filter?: (emoji: string) => boolean;
  /** Highlights this emoji's button as the current selection. */
  selected?: string;
  /**
   * Enables HTML5 drag-and-drop (drag-to-canvas) on each button -- only
   * meaningful for the sidebar "insert new element" picker. A properties-
   * panel field has nothing to drop an emoji "onto" (the element it belongs
   * to already exists), so it passes `false`.
   */
  draggable?: boolean;
  /** Shows a loading placeholder instead of the picker (e.g. `filter`'s backing data hasn't resolved yet). */
  loading?: boolean;
  /** Text shown while `loading` is true. */
  loadingLabel?: string;
}

interface BoundContainer extends HTMLElement {
  _ctEmojiOpts?: EmojiPickerOptions;
  _ctEmojiActiveCat?: number;
  _ctEmojiSearch?: string;
  _ctEmojiBound?: boolean;
}

function matchingEmojis(cat: EmojiCategory, filter?: (e: string) => boolean): string[] {
  return filter ? cat.emojis.filter(filter) : cat.emojis;
}

function buildResultsHtml(opts: EmojiPickerOptions, activeCat: number, search: string): string {
  const selected = opts.selected;
  const btnHtml = (e: string): string => `
    <button class="ct-emoji-btn${e === selected ? ' selected' : ''}" data-emoji="${e}"
      ${opts.draggable ? 'draggable="true"' : ''} title="${e}">${e}</button>`;

  if (search) {
    // No per-emoji keywords exist yet, so search can't really match on
    // `search` itself -- same simplified behavior as before this file was
    // extracted (lists every emoji passing `filter`, across all
    // categories). `search` is still tracked/shown in the input so a query
    // can be cleared, and a real keyword match can slot in here later
    // without changing the picker's public API.
    const all = EMOJI_CATEGORIES.flatMap(c => matchingEmojis(c, opts.filter));
    const unique = [...new Set(all)];
    return `
      <div class="ct-emoji-cat-label">Resultados</div>
      <div class="ct-emoji-grid">
        ${unique.length ? unique.map(btnHtml).join('') : '<div class="ct-emoji-empty">Nenhum emoji encontrado</div>'}
      </div>`;
  }

  const cat = EMOJI_CATEGORIES[activeCat] ?? EMOJI_CATEGORIES[0];
  const emojis = matchingEmojis(cat, opts.filter);
  return `
    <div class="ct-emoji-cat-label">${cat.label}</div>
    <div class="ct-emoji-grid">
      ${emojis.length ? emojis.map(btnHtml).join('') : '<div class="ct-emoji-empty">Nenhum emoji encontrado</div>'}
    </div>`;
}

/**
 * Enables/disables the tab-bar's scroll arrows based on the bar's actual
 * scroll position -- greyed out (and un-clickable, via the native `disabled`
 * attribute) once there's nothing left to scroll toward on that side, same
 * as a typical carousel's prev/next controls. Called right after every
 * (re)paint and on every `scroll` event the bar fires (trackpad/shift-wheel
 * scrolling should keep the arrows in sync too, not just arrow clicks).
 */
function updateTabArrows(container: BoundContainer): void {
  const tabBar = container.querySelector<HTMLElement>('[data-part="tabs"]');
  if (!tabBar) return;
  const leftBtn  = container.querySelector<HTMLButtonElement>('[data-action="emoji-tab-left"]');
  const rightBtn = container.querySelector<HTMLButtonElement>('[data-action="emoji-tab-right"]');
  const hasOverflow = tabBar.scrollWidth > tabBar.clientWidth + 1;
  if (leftBtn)  leftBtn.disabled  = !hasOverflow || tabBar.scrollLeft <= 0;
  if (rightBtn) rightBtn.disabled = !hasOverflow || tabBar.scrollLeft >= tabBar.scrollWidth - tabBar.clientWidth - 1;
}

function paintResults(container: BoundContainer): void {
  const results = container.querySelector<HTMLElement>('[data-part="results"]');
  if (!results) return;
  const opts = container._ctEmojiOpts!;
  results.innerHTML = buildResultsHtml(opts, container._ctEmojiActiveCat ?? 0, container._ctEmojiSearch ?? '');
}

function paint(container: BoundContainer): void {
  const opts = container._ctEmojiOpts!;

  if (opts.loading) {
    container.innerHTML = `<div class="ct-emoji-loading">${opts.loadingLabel ?? 'Carregando...'}</div>`;
    return;
  }

  // When `filter` is set (e.g. EmojiKitchenTool.ts's left-emoji picker,
  // restricted to emojis with at least one real combo), a category whose
  // every emoji gets filtered out used to still show its own tab -- picking
  // it just landed on an empty "Nenhum emoji encontrado" grid, which reads
  // as the picker "not really filtering" even though the emojis shown
  // elsewhere were correct. Categories with zero matches after filtering
  // are now dropped from the tab bar entirely, same as they're already
  // dropped from the grid.
  const visibleCats = opts.filter
    ? EMOJI_CATEGORIES.filter(c => matchingEmojis(c, opts.filter).length > 0)
    : EMOJI_CATEGORIES;

  let activeCat = container._ctEmojiActiveCat ?? 0;
  if (opts.filter && !visibleCats.includes(EMOJI_CATEGORIES[activeCat])) {
    // The previously active category (or the default index 0) has no
    // matches under the current filter -- fall back to the first category
    // that does, so the grid never opens on a guaranteed-empty tab.
    const fallbackCat = visibleCats[0];
    activeCat = fallbackCat ? EMOJI_CATEGORIES.indexOf(fallbackCat) : 0;
    container._ctEmojiActiveCat = activeCat;
  }

  const search = container._ctEmojiSearch ?? '';

  container.innerHTML = `
    <div class="ct-emoji-tab-row">
      <button type="button" class="ct-emoji-tab-scroll" data-action="emoji-tab-left" aria-label="Categorias anteriores">
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
      <div class="ct-emoji-tab-bar" data-part="tabs">
        ${visibleCats.map(c => {
          const i = EMOJI_CATEGORIES.indexOf(c);
          return `
          <button type="button" class="ct-emoji-tab ${!search && i === activeCat ? 'active' : ''}"
            data-cat="${i}" title="${c.label}">${c.icon}</button>`;
        }).join('')}
      </div>
      <button type="button" class="ct-emoji-tab-scroll" data-action="emoji-tab-right" aria-label="Próximas categorias">
        <span class="material-symbols-outlined">chevron_right</span>
      </button>
    </div>
    <div class="ct-emoji-search">
      <input type="search" placeholder="🔍 Pesquisar emoji..." data-action="emoji-search" value="${search}">
    </div>
    <div data-part="results">${buildResultsHtml(opts, activeCat, search)}</div>
  `;

  // Tab bar's own `scroll` events don't bubble, so this listener has to be
  // (re)attached to the fresh element every repaint -- the old bar (and its
  // listener) is discarded along with the innerHTML it lived in.
  const tabBar = container.querySelector<HTMLElement>('[data-part="tabs"]');
  tabBar?.addEventListener('scroll', () => updateTabArrows(container));
  updateTabArrows(container);
}

function bindDelegatedEvents(container: BoundContainer): void {
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Category tab-bar horizontal-scroll arrows -- the only way to reach
    // categories past whatever fits the picker's fixed width (previously
    // only a hidden-scrollbar trackpad/shift-wheel gesture, no visible cue
    // that more categories existed at all). Scrolls by ~2-3 tabs at a time;
    // `updateTabArrows()` (called on the bar's own `scroll` event) handles
    // disabling an arrow once there's nothing left to scroll toward.
    const scrollDir = target.closest<HTMLElement>('[data-action="emoji-tab-left"], [data-action="emoji-tab-right"]');
    if (scrollDir) {
      const tabBar = container.querySelector<HTMLElement>('[data-part="tabs"]');
      if (tabBar) {
        const dir = scrollDir.dataset.action === 'emoji-tab-left' ? -1 : 1;
        tabBar.scrollBy({ left: dir * Math.max(80, tabBar.clientWidth * 0.6), behavior: 'smooth' });
      }
      return;
    }

    const tab = target.closest<HTMLElement>('[data-cat]');
    if (tab) {
      container._ctEmojiActiveCat = Number(tab.dataset.cat);
      container._ctEmojiSearch = '';
      const search = container.querySelector<HTMLInputElement>('[data-action="emoji-search"]');
      if (search) search.value = '';
      container.querySelectorAll('.ct-emoji-tab').forEach((t, i) => {
        t.classList.toggle('active', i === container._ctEmojiActiveCat);
      });
      paintResults(container);
      return;
    }

    const btn = target.closest<HTMLElement>('[data-emoji]');
    if (btn) {
      e.preventDefault();
      container._ctEmojiOpts?.onSelect(btn.dataset.emoji!);
    }
  });

  container.addEventListener('input', (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.action !== 'emoji-search') return;
    container._ctEmojiSearch = (target as HTMLInputElement).value.trim();
    paintResults(container);
  });

  container.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest<HTMLElement>('[data-emoji]');
    if (!btn || !container._ctEmojiOpts?.draggable) return;
    const dt = (e as DragEvent).dataTransfer;
    const emoji = btn.dataset.emoji!;
    dt?.setData('ToolType', 'emoji');
    dt?.setData('EmojiChar', emoji);
    if (dt) dt.effectAllowed = 'copy';
    dt?.setDragImage(btn, 12, 12);
  });
}

/**
 * Renders (or repaints, if this container has already been bound once) the
 * standardized category-tab + search + grid emoji picker into `container`.
 */
export function renderEmojiPicker(container: HTMLElement, opts: EmojiPickerOptions): void {
  ensurePickerStyles();
  const c = container as BoundContainer;
  c._ctEmojiOpts = opts;
  if (c._ctEmojiActiveCat === undefined) c._ctEmojiActiveCat = 0;
  if (c._ctEmojiSearch === undefined) c._ctEmojiSearch = '';

  paint(c);

  if (!c._ctEmojiBound) {
    c._ctEmojiBound = true;
    bindDelegatedEvents(c);
  }
}

export interface EmojiGridOptions {
  /** Called with the picked emoji whenever the user clicks (or drops) one. */
  onSelect: (emoji: string) => void;
  /** Highlights this emoji's button as the current selection. */
  selected?: string;
  /** Enables HTML5 drag-and-drop (drag-to-canvas) on each button. */
  draggable?: boolean;
  /** Shows a loading placeholder instead of the grid. */
  loading?: boolean;
  /** Text shown while `loading` is true. */
  loadingLabel?: string;
  /** Text shown when `emojis` is empty and not loading. */
  emptyLabel?: string;
}

interface BoundGridContainer extends HTMLElement {
  _ctEmojiGridOpts?: EmojiGridOptions;
  _ctEmojiGridBound?: boolean;
}

/**
 * Renders a FLAT grid of emoji buttons -- no category tabs, no search bar --
 * for pickers that already have their own externally-computed, usually
 * short, list of valid choices instead of "any emoji from any category".
 * EmojiKitchenTool.ts's / Variable Content's "2nd emoji" field is the
 * motivating case: only whichever combo partners are actually valid for the
 * currently-picked 1st emoji make sense to show, and a category picker
 * would be actively misleading there (nearly every category would appear
 * empty except for the handful of valid partners scattered inside it).
 *
 * Reuses the exact same `.ct-emoji-grid`/`.ct-emoji-btn` markup and CSS as
 * renderEmojiPicker()'s own grid for visual consistency -- this is
 * deliberately just that picker's results pane, without the tab bar/search
 * chrome around it. Same bind-once/repaint-many contract as
 * renderEmojiPicker(): the click/dragstart listeners are attached to
 * `container` only on the first call, every later call just repaints.
 */
export function renderEmojiGrid(container: HTMLElement, emojis: string[], opts: EmojiGridOptions): void {
  ensurePickerStyles();
  const c = container as BoundGridContainer;
  c._ctEmojiGridOpts = opts;

  if (opts.loading) {
    c.innerHTML = `<div class="ct-emoji-loading">${opts.loadingLabel ?? 'Carregando...'}</div>`;
  } else {
    const selected = opts.selected;
    const btnHtml = (e: string): string => `
      <button class="ct-emoji-btn${e === selected ? ' selected' : ''}" data-emoji="${e}"
        ${opts.draggable ? 'draggable="true"' : ''} title="${e}">${e}</button>`;
    c.innerHTML = `
      <div class="ct-emoji-grid">
        ${emojis.length ? emojis.map(btnHtml).join('') : `<div class="ct-emoji-empty">${opts.emptyLabel ?? 'Nenhum emoji disponível'}</div>`}
      </div>`;
  }

  if (!c._ctEmojiGridBound) {
    c._ctEmojiGridBound = true;
    c.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-emoji]');
      if (!btn) return;
      e.preventDefault();
      c._ctEmojiGridOpts?.onSelect(btn.dataset.emoji!);
    });
    c.addEventListener('dragstart', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-emoji]');
      if (!btn || !c._ctEmojiGridOpts?.draggable) return;
      const dt = (e as DragEvent).dataTransfer;
      const emoji = btn.dataset.emoji!;
      dt?.setData('ToolType', 'emoji');
      dt?.setData('EmojiChar', emoji);
      if (dt) dt.effectAllowed = 'copy';
      dt?.setDragImage(btn, 12, 12);
    });
  }
}
