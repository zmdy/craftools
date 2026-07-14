import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { IconLibrary } from "../../utils/IconLibrary.js";
import { PanelUI } from "../../utils/PanelUI.js";
import "./IconTool_Translations.js";
import "../../utils/icons/MaterialSymbolsPack.js";

/**
 * IconTool
 * Ferramenta de ícones vetoriais (SVG) para o editor CrafTools.
 *
 * Os ícones em si vêm de "packs" registrados em IconLibrary.js (ver
 * utils/IconLibrary.js) -- por padrão, utils/icons/MaterialSymbolsPack.js.
 * Este arquivo só monta o seletor (picker, com abas de pack/categoria e
 * busca por palavra-chave), o painel de propriedades (cor de preenchimento/
 * contorno) e o elemento do editor, no mesmo padrão de ShapeTool.js.
 *
 * Novos packs (ex: outro conjunto de ícones) não exigem nenhuma mudança
 * aqui -- basta o novo arquivo do pack chamar IconLibrary.registerPack(...)
 * e importá-lo (como a linha acima faz com MaterialSymbolsPack.js); o
 * picker já lista qualquer pack registrado automaticamente.
 */

const PICKER_STYLE_ID = 'ct-icon-picker-styles';

function ensurePickerStyles() {
    if (document.getElementById(PICKER_STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = PICKER_STYLE_ID;
    s.textContent = `
        .ct-icon-pack-tab-bar {
            display: flex; gap: 4px; padding: 10px 12px 0; flex-wrap: wrap;
        }
        .ct-icon-pack-tab {
            background: var(--bg-input, #f4f4f5); border: 1px solid var(--border, #e4e4e7);
            border-radius: 20px; padding: 5px 12px; font-size: 11px; font-weight: 600;
            cursor: pointer; color: var(--text-secondary, #71717a);
        }
        .ct-icon-pack-tab.active { background: var(--accent, #f97316); border-color: var(--accent, #f97316); color: #fff; }
        .ct-icon-cat-bar {
            display: flex; gap: 4px; padding: 8px 12px 0; overflow-x: auto;
        }
        .ct-icon-cat-tab {
            background: transparent; border: 1px solid var(--border, #e4e4e7);
            border-radius: 20px; padding: 4px 10px; font-size: 10.5px; white-space: nowrap;
            cursor: pointer; color: var(--text-secondary, #71717a); flex-shrink: 0;
        }
        .ct-icon-cat-tab.active { background: var(--bg-hover, rgba(0,0,0,.06)); border-color: var(--accent, #f97316); color: var(--text, #1a1a1a); }
        .ct-icon-search {
            margin: 8px 12px; padding: 7px 10px; border-radius: 8px;
            border: 1px solid var(--border, #e4e4e7); background: var(--bg-input, #f4f4f5);
            font-size: 12px; width: calc(100% - 24px);
        }
        .ct-icon-grid {
            display: grid; grid-template-columns: repeat(5, 1fr);
            gap: 8px; padding: 6px 12px 14px; max-height: 320px; overflow-y: auto;
        }
        .ct-icon-btn {
            background: var(--bg-input, #f4f4f5); border: 1px solid var(--border, #e4e4e7);
            cursor: grab; border-radius: 8px; padding: 8px;
            display: flex; align-items: center; justify-content: center;
            aspect-ratio: 1; transition: background 0.12s, transform 0.12s, border-color 0.12s;
        }
        .ct-icon-btn:hover { background: var(--bg-hover, rgba(0,0,0,.06)); border-color: var(--accent, #f97316); transform: scale(1.05); }
        .ct-icon-btn:active { cursor: grabbing; transform: scale(0.94); }
        .ct-icon-btn svg { width: 100%; height: 100%; pointer-events: none; }
        .ct-icon-empty { padding: 20px 12px; text-align: center; font-size: 12px; color: var(--text-secondary, #71717a); }
        .ct-icon-preview {
            display: flex; align-items: center; justify-content: center;
            padding: 14px 0 6px;
        }
        .ct-icon-preview svg { width: 72px; height: 72px; }
        .ct-icon-change-picker { max-height: 300px; overflow-y: auto; }
    `;
    document.head.appendChild(s);
}

export class IconTool extends BaseTool {

    // ── Cria um craftools-element contendo um ícone SVG ──────────────────────
    static createElement(packId, iconId, editorApp) {
        const el = document.createElement('craftools-element');
        el.setAttribute('w', '100');
        el.setAttribute('h', '100');
        el.setAttribute('data-craftool', 'icone');

        el._craftoolsMeta = IconLibrary.defaultMeta(packId, iconId);

        const svg = IconLibrary.buildSvgElement(packId, iconId, el._craftoolsMeta);
        if (svg) {
            svg.style.userSelect = 'none';
            svg.style.pointerEvents = 'none';
            el.appendChild(svg);
        }

        return el;
    }

    // ── Renderiza o picker de ícones (abas de pack/categoria + busca) ────────
    // Se `targetElement` for informado, clicar num ícone troca o ícone desse
    // elemento em vez de criar um novo (usado pelo botão "Trocar ícone").
    // `onApplied` é chamado após a troca em um elemento existente.
    static renderPickerPanel(panelBody, editor, targetElement = null, onApplied = null) {
        ensurePickerStyles();

        const packs = IconLibrary.getPacks();
        if (!packs.length) {
            panelBody.innerHTML = `<div class="ct-icon-empty">${I18n.t('iconTool.noResults')}</div>`;
            return;
        }

        let activePackId = packs[0].id;
        let activeCategoryId = null; // null = "todas"
        let searchQuery = '';

        const applyIcon = (packId, iconId) => {
            if (targetElement) {
                targetElement._craftoolsMeta = IconLibrary.defaultMeta(packId, iconId);
                this._regenerate(targetElement);
                if (onApplied) onApplied();
            } else {
                const page = editor.querySelector('.craftools-page');
                if (!page) return;
                const rect = page.getBoundingClientRect();
                const scale = window.craftoolsZoomLevel || 1;
                const el = IconTool.createElement(packId, iconId, editor);
                el.setAttribute('x', Math.round(rect.width / scale / 2 - 50));
                el.setAttribute('y', Math.round(rect.height / scale / 2 - 50));
                page.appendChild(el);
                requestAnimationFrame(() => { setTimeout(() => el.select?.(), 20); });
                const ph = page.querySelector('div[style*="font-size: 14px"]');
                if (ph) ph.remove();
            }
        };

        const buildGrid = () => {
            const pack = IconLibrary.getPack(activePackId);
            if (!pack) return `<div class="ct-icon-empty">${I18n.t('iconTool.noResults')}</div>`;

            let icons;
            if (searchQuery.trim()) {
                icons = IconLibrary.search(searchQuery, activePackId).map(r => r.icon);
            } else if (activeCategoryId) {
                icons = IconLibrary.byCategory(activePackId, activeCategoryId);
            } else {
                icons = pack.icons;
            }

            if (!icons.length) return `<div class="ct-icon-empty">${I18n.t('iconTool.noResults')}</div>`;

            return icons.map(icon => `
                <button class="ct-icon-btn" data-icon="${icon.id}" draggable="true" title="${icon.label}">
                    ${IconLibrary.buildSvgString(activePackId, icon.id, { fillColor: '#71717a' })}
                </button>
            `).join('');
        };

        const bindGridEvents = (grid) => {
            grid.querySelectorAll('.ct-icon-btn').forEach(btn => {
                const iconId = btn.dataset.icon;
                btn.addEventListener('click', (e) => { e.preventDefault(); applyIcon(activePackId, iconId); });
                btn.addEventListener('dragstart', (ev) => {
                    ev.dataTransfer.setData('ToolType', 'icone');
                    ev.dataTransfer.setData('IconPackId', activePackId);
                    ev.dataTransfer.setData('IconId', iconId);
                    ev.dataTransfer.effectAllowed = 'copy';
                });
            });
        };

        const rebuildGrid = () => {
            const grid = panelBody.querySelector('#ct-icon-grid');
            if (!grid) return;
            grid.innerHTML = buildGrid();
            bindGridEvents(grid);
        };

        const renderAll = () => {
            const pack = IconLibrary.getPack(activePackId);
            const cats = pack ? pack.categories : [];

            panelBody.innerHTML = `
                ${packs.length > 1 ? `
                    <div class="ct-icon-pack-tab-bar" id="ct-icon-pack-bar">
                        ${packs.map(p => `<button class="ct-icon-pack-tab ${p.id === activePackId ? 'active' : ''}" data-pack="${p.id}">${p.label}</button>`).join('')}
                    </div>
                ` : ''}
                <div class="ct-icon-cat-bar" id="ct-icon-cat-bar">
                    <button class="ct-icon-cat-tab ${!activeCategoryId ? 'active' : ''}" data-cat="">${I18n.t('common.all') || 'Todos'}</button>
                    ${cats.map(c => `<button class="ct-icon-cat-tab ${c.id === activeCategoryId ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>`).join('')}
                </div>
                <input type="text" class="ct-icon-search" id="ct-icon-search" placeholder="${I18n.t('iconTool.searchPlaceholder')}" value="${searchQuery}">
                <div class="ct-icon-grid" id="ct-icon-grid">${buildGrid()}</div>
            `;

            panelBody.querySelectorAll('.ct-icon-pack-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    activePackId = tab.dataset.pack;
                    activeCategoryId = null;
                    searchQuery = '';
                    renderAll();
                });
            });

            panelBody.querySelectorAll('.ct-icon-cat-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    activeCategoryId = tab.dataset.cat || null;
                    searchQuery = '';
                    panelBody.querySelectorAll('.ct-icon-cat-tab').forEach(t => t.classList.toggle('active', t === tab));
                    const search = panelBody.querySelector('#ct-icon-search');
                    if (search) search.value = '';
                    rebuildGrid();
                });
            });

            const searchInput = panelBody.querySelector('#ct-icon-search');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    searchQuery = searchInput.value;
                    rebuildGrid();
                });
            }

            bindGridEvents(panelBody.querySelector('#ct-icon-grid'));
        };

        renderAll();
    }

    // ── Painel de propriedades (quando um ícone está selecionado) ────────────
    static renderPropertiesPanel(editorPanel, element, editor) {
        const meta = element._craftoolsMeta || IconLibrary.defaultMeta('material-symbols', 'star');
        if (!element._craftoolsMeta) element._craftoolsMeta = meta;

        ensurePickerStyles();

        if (element.contentArea) {
            element.contentArea.style.pointerEvents = 'auto';
            element.contentArea.style.cursor = 'move';
        }

        let showingPicker = false;

        const htmlIcone = `
            <div class="ct-icon-preview">${IconLibrary.buildSvgString(meta.packId, meta.iconId, meta)}</div>
            <button class="craftools-pill" id="ct-icon-change-btn"
                style="width:100%;justify-content:center;gap:6px;margin-bottom:6px;">
                <span class="material-symbols-outlined" style="font-size:15px;">category</span>
                ${I18n.t('iconTool.changeIcon')}
            </button>
            <div id="ct-icon-picker-slot"></div>
        `;

        const htmlCor = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('iconTool.fillColor')}</span>
                    <input type="color" id="icon-fill-color" class="craftools-color-swatch" value="${meta.fillColor}" style="width:100%;">
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('iconTool.strokeColor')}</span>
                    <input type="color" id="icon-stroke-color" class="craftools-color-swatch" value="${meta.strokeColor}" style="width:100%;">
                </div>
            </div>
            <div class="ct-field" style="margin-top:8px;">
                <span class="craftools-label">${I18n.t('iconTool.strokeWidth')}</span>
                ${PanelUI.slider('icon-stroke-width', 0, 10, 0.5, parseFloat(meta.strokeWidth) || 0, 'px')}
            </div>
        `;

        editorPanel.innerHTML =
            PanelUI.accordion('icon-icone', 'category', I18n.t('iconTool.sectionIcon'), htmlIcone, { open: true }) +
            PanelUI.accordion('icon-cor', 'palette', I18n.t('iconTool.sectionColor'), htmlCor);

        this.renderCommonProperties(editorPanel, element, {
            border: 'svg',
            radius: 'svg',
            padding: 'svg',
            margin: 'svg',
            zindex: true,
        });

        // --- Trocar ícone ---
        editorPanel.querySelector('#ct-icon-change-btn').addEventListener('click', () => {
            showingPicker = !showingPicker;
            const slot = editorPanel.querySelector('#ct-icon-picker-slot');
            if (!slot) return;
            if (showingPicker) {
                slot.innerHTML = '<div class="ct-icon-change-picker" id="ct-icon-change-picker-body"></div>';
                const pickerBody = slot.querySelector('#ct-icon-change-picker-body');
                IconTool.renderPickerPanel(pickerBody, editor, element, () => {
                    this.renderPropertiesPanel(editorPanel, element, editor);
                });
            } else {
                slot.innerHTML = '';
            }
        });

        // --- Cor / contorno ---
        editorPanel.querySelector('#icon-fill-color').oninput = (e) => {
            meta.fillColor = e.target.value;
            this._regenerate(element);
        };
        editorPanel.querySelector('#icon-stroke-color').oninput = (e) => {
            meta.strokeColor = e.target.value;
            this._regenerate(element);
        };
        PanelUI.bindSlider(editorPanel, 'icon-stroke-width', 'px', (val) => {
            meta.strokeWidth = val;
            this._regenerate(element);
        });
    }

    /** Reconstrói o SVG a partir do estado atual de `_craftoolsMeta`. */
    static _regenerate(element) {
        const meta = element._craftoolsMeta;
        if (!meta || !element.contentArea) return;

        const svgString = IconLibrary.buildSvgString(meta.packId, meta.iconId, meta);
        if (!svgString) return;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = svgString;
        const fresh = wrapper.firstElementChild;

        let svg = element.contentArea.querySelector('svg');
        if (svg) {
            // Mantém o mesmo nó <svg> (preserva borda/raio aplicados via CommonProperties)
            svg.setAttribute('viewBox', fresh.getAttribute('viewBox'));
            svg.innerHTML = fresh.innerHTML;
        } else {
            fresh.style.userSelect = 'none';
            fresh.style.pointerEvents = 'none';
            element.contentArea.appendChild(fresh);
        }

        this._triggerChange(element);
    }

    static _triggerChange(element) {
        const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
        element.dispatchEvent(event);
    }

    static getCtxOptions() {
        return [];
    }
}
