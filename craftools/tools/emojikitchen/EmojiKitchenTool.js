import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { loadEmojiKitchenCombo, loadEmojiKitchenPartners, loadEmojiKitchenSupported } from "../../utils/ApiDataLoader.js";
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
        return { leftEmoji: '', rightEmoji: '', rightMode: 'manual', imageUrl: '' };
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
        if (!meta) return;
        
        // Se ainda não tem emoji principal, sorteia um dos suportados
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
        const scope = element.contentArea || element;
        const img = scope.querySelector('img');
        if (img) img.src = meta.imageUrl;
        element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
    }

    // Legacy renderPropertiesPanel deleted.
    // Panel rendering is now schema-driven in EmojiKitchenTool.ts via PropertyRenderer.

    static _esc(val) {
        return String(val == null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
