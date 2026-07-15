/**
 * EmojiTool — Emoji picker and element tool.
 *
 * Emojis are rendered with 'Noto Color Emoji' font for consistent
 * cross-platform display. The picker shows category tabs + search
 * and supports both click-to-add and drag-to-canvas.
 */

const EMOJI_CATEGORIES = [
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

// ── CSS injected once into <head> ────────────────────────────────────────────
const PICKER_STYLE_ID = 'ct-emoji-picker-styles';

function ensurePickerStyles() {
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
        /* Properties panel */
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

export class EmojiTool {

    // ── Create a craftools-element containing a single emoji ──────────────────
    static createElement(emoji) {
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

    // ── Render emoji picker panel ─────────────────────────────────────────────
    // If `targetElement` is provided, clicking an emoji changes that element's
    // character instead of creating a new one. Used by "Trocar Emoji" button.
    static renderPickerPanel(panelBody, editor, targetElement = null) {
        ensurePickerStyles();

        let activeCat = 0;
        let searchQuery = '';

        const buildGrid = () => {
            if (searchQuery) {
                // Search across all categories
                const q = searchQuery.toLowerCase();
                // We match by index-based keyword heuristic for now — just
                // show all emojis that textually match if we ever add labels;
                // for now just show every emoji across all cats (simple search UX).
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

        const renderAll = () => {
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

        const rebuildGrid = () => {
            const container = panelBody.querySelector('#ct-emoji-tabs');
            if (!container) return;
            // Update tab active state
            panelBody.querySelectorAll('.ct-emoji-tab').forEach((t, i) => {
                t.classList.toggle('active', i === activeCat);
            });
            // Replace grid area
            const gridWrap = panelBody.querySelector('.ct-emoji-cat-label');
            if (gridWrap) {
                const newHtml = buildGrid();
                const tmp = document.createElement('div');
                tmp.innerHTML = newHtml;
                gridWrap.replaceWith(...tmp.childNodes);
            }
            bindGridEvents();
        };

        const applyEmoji = (emoji) => {
            if (targetElement) {
                // Change existing element's emoji
                const inner = targetElement.querySelector('[data-emoji-char]');
                if (inner) { inner.dataset.emojiChar = emoji; inner.textContent = emoji; }
                targetElement.dispatchEvent(new CustomEvent('craftools-element-change', {
                    bubbles: true, detail: { element: targetElement }
                }));
            } else {
                // Add new emoji element to canvas
                const page = editor.querySelector('.craftools-page');
                if (!page) return;
                const rect = page.getBoundingClientRect();
                const scale = window.craftoolsZoomLevel || 1;
                const el = EmojiTool.createElement(emoji);
                el.setAttribute('x', Math.round(rect.width / scale / 2 - 40));
                el.setAttribute('y', Math.round(rect.height / scale / 2 - 40));
                page.appendChild(el);
                // Select after paint so the element is registered
                requestAnimationFrame(() => { setTimeout(() => el.select?.(), 20); });
                // Remove placeholder text if present
                const ph = page.querySelector('div[style*="font-size: 14px"]');
                if (ph) ph.remove();
            }
        };

        const bindGridEvents = () => {
            panelBody.querySelectorAll('.ct-emoji-btn').forEach(btn => {
                const emoji = btn.dataset.emoji;
                btn.addEventListener('click', (e) => { e.preventDefault(); applyEmoji(emoji); });
                btn.addEventListener('dragstart', (ev) => {
                    ev.dataTransfer.setData('ToolType', 'emoji');
                    ev.dataTransfer.setData('EmojiChar', emoji);
                    ev.dataTransfer.effectAllowed = 'copy';
                    ev.dataTransfer.setDragImage(btn, 12, 12);
                });
            });
        };

        const bindEvents = () => {
            panelBody.querySelectorAll('.ct-emoji-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    activeCat = parseInt(tab.dataset.cat);
                    searchQuery = '';
                    const si = panelBody.querySelector('#ct-emoji-search-input');
                    if (si) si.value = '';
                    rebuildGrid();
                });
            });

            const searchInput = panelBody.querySelector('#ct-emoji-search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    searchQuery = e.target.value.trim();
                    rebuildGrid();
                });
                // Focus search on open
                requestAnimationFrame(() => searchInput.focus());
            }

            bindGridEvents();
        };

        renderAll();
    }

    // ── Render properties panel (when an emoji element is selected) ───────────
    static renderPropertiesPanel(panelBody, el, editor) {
        ensurePickerStyles();

        const inner = el.querySelector('[data-emoji-char]');
        if (!inner) return;

        const currentEmoji = inner.dataset.emojiChar || inner.textContent.trim();
        const currentSize  = parseFloat(inner.style.fontSize) || 64;

        let showingPicker = false;

        const renderProps = () => {
            panelBody.innerHTML = `
                <div class="ct-emoji-preview">${currentEmoji}</div>
                <div style="padding: 0 12px;">
                    <div class="ct-field" style="margin-bottom: 12px;">
                        <span class="craftools-label">Tamanho</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="range" id="ct-emoji-size-r" min="16" max="200" step="4"
                                style="flex:1;accent-color:var(--accent);" value="${currentSize}">
                            <input type="number" class="craftools-input" id="ct-emoji-size-n"
                                style="width:55px;text-align:center;" value="${currentSize}">
                        </div>
                    </div>
                    <button class="craftools-pill" id="ct-emoji-change-btn"
                        style="width:100%;justify-content:center;gap:6px;margin-bottom:6px;">
                        <span class="material-symbols-outlined" style="font-size:15px;">mood</span>
                        Trocar Emoji
                    </button>
                </div>
                <div id="ct-emoji-picker-slot"></div>
            `;

            const updateSize = (val) => {
                const sz = Math.max(16, Math.min(200, +val));
                inner.style.fontSize = sz + 'px';
                el.setAttribute('w', sz + 16);
                el.setAttribute('h', sz + 16);
                el.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element: el } }));
            };

            const sr = panelBody.querySelector('#ct-emoji-size-r');
            const sn = panelBody.querySelector('#ct-emoji-size-n');
            sr.addEventListener('input', (e) => { updateSize(e.target.value); sn.value = e.target.value; });
            sn.addEventListener('input', (e) => { updateSize(e.target.value); sr.value = e.target.value; });

            panelBody.querySelector('#ct-emoji-change-btn').addEventListener('click', () => {
                showingPicker = !showingPicker;
                const slot = panelBody.querySelector('#ct-emoji-picker-slot');
                if (!slot) return;
                if (showingPicker) {
                    slot.innerHTML = '<div class="ct-emoji-change-picker" id="ct-change-picker-body"></div>';
                    const pickerBody = slot.querySelector('#ct-change-picker-body');
                    EmojiTool.renderPickerPanel(pickerBody, editor, el);
                } else {
                    slot.innerHTML = '';
                }
            });
        };

        renderProps();
    }

    static getCtxOptions() {
        return [];
    }
}
