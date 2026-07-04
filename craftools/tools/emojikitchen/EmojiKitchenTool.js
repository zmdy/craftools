import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { loadEmojiKitchenCombo, loadEmojiKitchenPartners } from "../../utils/ApiDataLoader.js";
import "./EmojiKitchenTool_Translations.js";

const k = (key) => I18n.t('emojiKitchenTool.' + key);

/**
 * EmojiKitchenTool
 *
 * Ferramenta que insere na página combinações de emojis do Emoji Kitchen
 * (ver https://github.com/xsalazar/emoji-kitchen) -- as imagens vêm do
 * craftools_api (?resource=emoji-kitchen), que serve o catálogo importado
 * do metadata.json do projeto original (ver painel admin do craftools_api).
 *
 * O usuário escolhe pelo menos 1 emoji de referência (o 1º); o 2º emoji é
 * opcional -- se não escolhido, combina o 1º emoji com ele mesmo. O select
 * do 2º emoji só lista combinações que de fato existem no catálogo.
 */
export class EmojiKitchenTool extends BaseTool {

    static getDefaultMeta() {
        return { leftEmoji: '😀', rightEmoji: '', rightMode: 'manual', imageUrl: '' };
    }

    static getCtxOptions() {
        return [];
    }

    static _buildImg(meta) {
        const img = document.createElement('img');
        img.alt = 'Emoji Kitchen';
        img.style.cssText = 'width:100%; height:100%; display:block; user-select:none; pointer-events:none; object-fit:contain;';
        if (meta.imageUrl) img.src = meta.imageUrl;
        return img;
    }

    static createElement(type, editorApp) {
        const el = document.createElement('craftools-element');
        el.setAttribute('x', '50');
        el.setAttribute('y', '50');
        el.setAttribute('w', '160');
        el.setAttribute('h', '160');
        el.setAttribute('data-craftool', 'emojikitchen');

        el._craftoolsMeta = this.getDefaultMeta();

        // O elemento ainda não está no DOM aqui -- contentArea só existe
        // após connectedCallback() (ver Element.js). Anexa direto em `el`;
        // _build() migra os filhos pré-existentes pro _content interno ao
        // conectar (mesmo padrão de QRCodeTool/BarcodeTool/MiniCalendarTool).
        el.appendChild(this._buildImg(el._craftoolsMeta));

        // Resolve o combo assim que possível (fire-and-forget) -- assim que
        // a imagem real chegar da API, troca o <img src> em cima do preview.
        this._resolveAndRender(el);

        return el;
    }

    static async _resolveAndRender(element) {
        const meta = element._craftoolsMeta;
        if (!meta || !(meta.leftEmoji || '').trim()) return;
        const left = meta.leftEmoji.trim();
        const right = (meta.rightEmoji || '').trim() || left;
        const combo = await loadEmojiKitchenCombo(left, right);
        meta.imageUrl = (combo && combo.imageUrl) || '';
        const scope = element.contentArea || element;
        const img = scope.querySelector('img');
        if (img) img.src = meta.imageUrl;
        element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
    }

    static renderPropertiesPanel(editorPanel, element) {
        const meta = element._craftoolsMeta || this.getDefaultMeta();
        if (!element._craftoolsMeta) element._craftoolsMeta = meta;

        if (element.contentArea) {
            element.contentArea.style.pointerEvents = 'auto';
            element.contentArea.style.cursor = 'move';
        }

        const htmlConteudo = `
            <div class="ct-field">
                <span class="craftools-label">${k('leftLabel')}</span>
                <input type="text" id="ek-left" class="craftools-input" style="width:100%; font-family:'Noto Color Emoji', sans-serif; font-size:18px;" placeholder="${this._esc(k('placeholder'))}" value="${this._esc(meta.leftEmoji)}" maxlength="8">
            </div>
            <div class="ct-field">
                <span class="craftools-label">${k('rightLabel')}</span>
                <div style="display:flex; gap:6px; align-items:center;">
                    <select id="ek-right-select" class="craftools-select" style="width:100%;">
                        <option value="">${k('rightLoading')}</option>
                    </select>
                    <button type="button" id="ek-reroll-btn" class="craftools-icon-btn" title="${this._esc(k('rerollTitle'))}" style="display:none; flex-shrink:0;">
                        <span class="material-symbols-outlined">casino</span>
                    </button>
                </div>
                <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${k('rightHelp')}</span>
            </div>
        `;

        editorPanel.innerHTML = PanelUI.accordion('ek-conteudo', 'emoji_emotions', k('content'), htmlConteudo, { open: true });

        this.renderCommonProperties(editorPanel, element, {
            border: 'img',
            radius: 'img',
            padding: 'img',
            zindex: true,
        });

        const leftInput = editorPanel.querySelector('#ek-left');
        const rightSelect = editorPanel.querySelector('#ek-right-select');
        const rerollBtn = editorPanel.querySelector('#ek-reroll-btn');

        let currentPartners = [];

        const renderRightOptions = () => {
            if (!rightSelect) return;
            const isRandom = meta.rightMode === 'random';
            const options = [
                `<option value="">${k('rightSelf')}</option>`,
                `<option value="__random__" ${isRandom ? 'selected' : ''}>${k('rightRandom')}</option>`,
            ].concat(currentPartners.map(p =>
                `<option value="${this._esc(p)}" ${(!isRandom && meta.rightEmoji === p) ? 'selected' : ''}>${this._esc(p)}</option>`
            ));
            rightSelect.innerHTML = options.join('');
            if (!isRandom && !meta.rightEmoji) {
                rightSelect.value = '';
            }
            if (rerollBtn) rerollBtn.style.display = isRandom ? 'flex' : 'none';
        };

        // Sorteia um parceiro aleatório entre TODAS as combinações reais do
        // emoji 1 (incluindo a opção "combinar com ele mesmo" no sorteio).
        const pickRandom = () => {
            const pool = [''].concat(currentPartners);
            meta.rightEmoji = pool[Math.floor(Math.random() * pool.length)];
            meta.rightMode = 'random';
            renderRightOptions();
            this._resolveAndRender(element);
        };

        const loadPartners = async () => {
            if (!rightSelect) return;
            const left = (meta.leftEmoji || '').trim();
            if (!left) {
                currentPartners = [];
                rightSelect.innerHTML = `<option value="">${k('rightNone')}</option>`;
                if (rerollBtn) rerollBtn.style.display = 'none';
                return;
            }
            rightSelect.innerHTML = `<option value="">${k('rightLoading')}</option>`;
            const partners = await loadEmojiKitchenPartners(left);
            currentPartners = partners.filter(p => p !== left);

            if (meta.rightMode === 'random') {
                // Reafirma o sorteio já feito (ou sorteia de novo se o combo
                // salvo não existir mais para este emoji 1).
                const pool = [''].concat(currentPartners);
                if (!pool.includes(meta.rightEmoji)) {
                    meta.rightEmoji = pool[Math.floor(Math.random() * pool.length)];
                }
                renderRightOptions();
                return;
            }

            if (meta.rightEmoji && !currentPartners.includes(meta.rightEmoji)) {
                meta.rightEmoji = '';
            }
            renderRightOptions();
        };

        if (leftInput) leftInput.oninput = () => {
            meta.leftEmoji = leftInput.value;
            meta.rightEmoji = '';
            meta.rightMode = 'manual';
            loadPartners().then(() => this._resolveAndRender(element));
        };

        if (rightSelect) rightSelect.onchange = () => {
            if (rightSelect.value === '__random__') {
                pickRandom();
            } else {
                meta.rightMode = 'manual';
                meta.rightEmoji = rightSelect.value;
                renderRightOptions();
                this._resolveAndRender(element);
            }
        };

        if (rerollBtn) rerollBtn.onclick = () => pickRandom();

        loadPartners();
    }

    static _esc(val) {
        return String(val == null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
