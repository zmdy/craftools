import { Notify } from "./Notify.js";
import { I18n } from "../settings/Translations.js";
import { PdfExport } from "./PdfExport.js";
import { VariableEngine } from "./VariableEngine.js";
import { QrCode } from "./QrCode.js";
import { BarcodeGenerator } from "./BarcodeGenerator.js";
import { QRCodeTool } from "../tools/qrcode/QRCodeTool.js";

const UI_STRIP_SELECTORS = [
    '.craftools-ctrlbar',
    '.album-drag-handle',
    '.slot-drag-handle',
    '.craftools-sidebar-overlay',
    '.cell-edit-btn',
].join(',');

/**
 * AgendaExport
 *
 * Gera o HTML de impressão de uma "Agenda": como PdfExport, mas páginas
 * marcadas com `data-agenda-repeat="N"` (definido pelo AgendaExportTool, aba
 * "Páginas") são repetidas N vezes, com o conteúdo de qualquer elemento
 * vinculado a uma variável (Texto/Título/QRCode/Barcode -- ver
 * VariableEngine.js / VariablePanel.js) resolvido de forma diferente a cada
 * repetição, ANTES de abrir a janela de impressão do navegador.
 *
 * Reaproveita a infraestrutura de PdfExport (parse de tamanho, CSS de
 * impressão, achatamento de <craftools-element> em divs, blob + window.open)
 * via chamadas estáticas cruzadas -- PdfExport.js não precisa ser alterado.
 */
export class AgendaExport {

    static async print(editor) {
        const pages = [...editor.querySelectorAll('.craftools-page')];
        if (!pages.length) {
            Notify.toast(I18n.t('agendaExportTool.noPagesFound'), 'error');
            return;
        }

        // 1. Pré-busca (uma única vez) todos os recursos de API referenciados
        // por variáveis "Frase da API" em qualquer página, para não repetir
        // a mesma requisição a cada repetição de página.
        const allBindings = [];
        pages.forEach(page => {
            this._collectBindings(page).forEach(({ binding }) => allBindings.push(binding));
        });
        const apiCache = await VariableEngine.prefetchApiResources(allBindings);

        const totalOutputPages = pages.reduce((sum, p) => sum + this._repeatCount(p), 0);

        // 2. Gera o HTML de cada página (ou repetição), com as variáveis já
        // substituídas -- tudo isso acontece ANTES de abrir a janela de
        // impressão (ver passo 3).
        const pageSizes = [];
        const pagesHtmlParts = [];
        let outputPageNumber = 0;

        for (const page of pages) {
            const size = PdfExport._parsePageSize(page);
            const repeatCount = this._repeatCount(page);
            const origEls = [...page.querySelectorAll('craftools-element')];

            for (let i = 0; i < repeatCount; i++) {
                outputPageNumber++;
                pageSizes.push(size);

                const clone = page.cloneNode(true);
                clone.querySelectorAll(UI_STRIP_SELECTORS).forEach(n => n.remove());

                // Substitui o conteúdo dos elementos vinculados a variável
                // ENQUANTO o clone ainda é <craftools-element> (svg/img/
                // contenteditable reais), antes de achatar para <div>.
                const cloneEls = [...clone.querySelectorAll('craftools-element')];
                const context = {
                    repetitionIndex: i,
                    pageNumber: outputPageNumber,
                    totalPages: totalOutputPages,
                    now: new Date(),
                };

                // "picks" é recriado a cada repetição -- guarda o item/valor
                // bruto escolhido por cada variável "líder" (sem linkedTo)
                // nesta repetição, para que variáveis "vinculadas" (Vincular
                // a -- ver VariablePanel.js/VariableEngine.js) reaproveitem
                // exatamente o mesmo item, com sua PRÓPRIA formatação/campo.
                const picks = VariableEngine.newLinkRegistry();
                const jobs = origEls.map((origEl, idx) => {
                    const cloneEl = cloneEls[idx];
                    const toolType = origEl.getAttribute('data-craftool');
                    const binding = this._getBinding(origEl, toolType);
                    return { origEl, cloneEl, toolType, binding, id: this._getVarId(origEl) };
                }).filter(j => j.cloneEl && j.binding && j.binding.type);

                // 1ª passada: líderes (sem "Vincular a") primeiro, para que
                // seus picks já estejam disponíveis quando a 2ª passada
                // resolver as variáveis vinculadas a eles.
                const leaders = jobs.filter(j => !j.binding.linkedTo);
                const followers = jobs.filter(j => j.binding.linkedTo);
                [...leaders, ...followers].forEach(j => {
                    const resolved = VariableEngine.resolve(j.binding, context, apiCache, { id: j.id, picks });
                    this._applyResolvedValue(j.cloneEl, j.toolType, j.origEl, resolved, j.binding);
                });

                // Achata todos os <craftools-element> em divs regulares
                // (mesma lógica usada pelo PdfExport para impressão/PDF).
                clone.querySelectorAll('craftools-element').forEach(el => PdfExport._flattenElement(el));

                const pageClass = `ct${PdfExport._sizeKey(size.width, size.height)}`;
                const bgStyle = size.background ? `background: ${size.background};` : '';
                pagesHtmlParts.push(`<div class="print-page print-page-${pageClass}" style="width:${size.width}; min-height:${size.height}; ${bgStyle}">${clone.innerHTML}</div>`);
            }
        }

        const css = PdfExport._buildCSS(pageSizes);
        const fullHtml = PdfExport._wrapDocument(css, pagesHtmlParts.join('\n'));

        // 3. Só agora, com TODAS as páginas repetíveis já geradas, abre o
        // blob/janela de impressão -- o próprio documento gerado dispara
        // window.print() (Ctrl+P) sozinho ao carregar (ver PdfExport._wrapDocument).
        PdfExport._openPrintWindow(fullHtml);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    static _repeatCount(page) {
        return Math.max(1, parseInt(page.dataset.agendaRepeat, 10) || 1);
    }

    static _collectBindings(page) {
        const results = [];
        page.querySelectorAll('craftools-element').forEach(el => {
            const toolType = el.getAttribute('data-craftool');
            const binding = this._getBinding(el, toolType);
            if (binding && binding.type) results.push({ el, toolType, binding });
        });
        return results;
    }

    static _getBinding(el, toolType) {
        const type = toolType || el.getAttribute('data-craftool');
        if (type === 'conteudovariavel') return el._craftoolsVariable || null;
        if (type === 'qrcode' || type === 'barcode') return (el._craftoolsMeta && el._craftoolsMeta.variableBinding) || null;
        return null;
    }

    /**
     * Id estável (em memória) usado para casar "Vincular a" entre elementos
     * -- normalmente já existe (atribuído pelo VariablePanel quando o
     * usuário configura a variável), mas é criado aqui também por segurança
     * caso o elemento nunca tenha aberto o painel de propriedades.
     */
    static _getVarId(el) {
        if (!el._craftoolsVarId) el._craftoolsVarId = 'v' + Math.random().toString(36).slice(2, 9);
        return el._craftoolsVarId;
    }

    /**
     * Aplica o valor resolvido de uma variável num clone AINDA não achatado
     * (ou seja, ainda tem <svg>/<img>/[contenteditable] reais dentro).
     * @param {HTMLElement} cloneEl  o <craftools-element> clonado
     * @param {string} toolType
     * @param {HTMLElement} origEl  o elemento original (vivo), usado para ler `_craftoolsMeta`
     * @param {string} resolved     valor já resolvido pelo VariableEngine
     * @param {object} [binding]    o binding original -- usado só para detectar o tipo "emojiKitchen"
     */
    static _applyResolvedValue(cloneEl, toolType, origEl, resolved, binding) {
        if (toolType === 'conteudovariavel') {
            const ce = cloneEl.querySelector('[contenteditable]');
            if (ce) {
                if (binding && binding.type === 'emojiKitchen') {
                    ce.innerHTML = resolved
                        ? `<img src="${this._escAttr(resolved)}" style="max-width:100%; max-height:100%; display:block; margin:0 auto; object-fit:contain;">`
                        : '';
                } else if (binding && binding.type === 'miniCalendar') {
                    // O valor resolvido já é o HTML completo do card (ver
                    // VariableEngine._formatMiniCalendar) -- insere direto.
                    ce.innerHTML = resolved || '';
                } else {
                    ce.textContent = resolved;
                }
            }
            return;
        }

        const meta = origEl._craftoolsMeta || {};

        if (toolType === 'qrcode') {
            if (meta.payloadType === 'spotify') {
                this._applyResolvedSpotify(cloneEl, meta, resolved);
                return;
            }
            const svg = cloneEl.querySelector('svg');
            if (!svg) return;
            const svgString = QrCode.buildSvgString(resolved, {
                ecLevel: meta.ecLevel,
                darkColor: meta.darkColor,
                lightColor: meta.lightColor,
            });
            this._swapSvgContent(svg, svgString);
            return;
        }

        if (toolType === 'barcode') {
            const svg = cloneEl.querySelector('svg');
            if (!svg) return;
            const svgString = BarcodeGenerator.buildSvgString(resolved, {
                format: meta.format,
                color: meta.color,
                background: meta.background,
                showText: meta.showText,
            });
            this._swapSvgContent(svg, svgString);
        }
    }

    static _escAttr(val) {
        return String(val == null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    static _swapSvgContent(svgNode, svgString) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = svgString;
        const fresh = wrapper.firstElementChild;
        if (!fresh) return;
        svgNode.setAttribute('viewBox', fresh.getAttribute('viewBox'));
        svgNode.innerHTML = fresh.innerHTML;
    }

    static _applyResolvedSpotify(cloneEl, meta, resolved) {
        const img = cloneEl.querySelector('img[data-spotify-code]');
        if (!img) return;
        const uri = QRCodeTool.buildSpotifyUri(resolved);
        const url = uri ? QRCodeTool.buildSpotifyCodeUrl(uri, { bg: meta.spotifyBg, barColor: meta.spotifyBarColor }) : '';
        if (url) img.setAttribute('src', url);
        else img.removeAttribute('src');
    }
}
