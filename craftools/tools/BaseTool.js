import { CommonProperties } from "../utils/CommonProperties.js";
import { Notify } from "../utils/Notify.js";

/**
 * BaseTool
 * Classe base para todas as ferramentas do CrafTools.
 * Fornece métodos herdáveis para renderizar propriedades comuns.
 */
export class BaseTool {
    
    /**
     * Renderiza seções comuns de propriedades baseadas em uma configuração.
     * @param {HTMLElement} container O container do painel lateral.
     * @param {HTMLElement} element O elemento craftools-element selecionado.
     * @param {Object} config Configuração das seções a exibir.
     */
    static renderCommonProperties(container, element, config = {}) {
        // config.border: selector (ex: 'img' ou '[contenteditable]')
        // config.radius: selector
        // config.padding: selector
        // config.zindex: boolean
        // config.onChange: callback opcional

        // Render Copy/Paste Styles bar
        this.renderCopyPasteStyles(container, element, config);

        if (config.border) {
            CommonProperties.renderBorder(container, element, config.border, config.onChange);
        }
        
        if (config.radius) {
            CommonProperties.renderBorderRadius(container, element, config.radius, config.onChange);
        }

        if (config.padding) {
            CommonProperties.renderPadding(container, element, config.padding, config.onChange);
        }

        if (config.zindex) {
            CommonProperties.renderZIndex(container, element, config.onChange);
        }
    }

    /**
     * Renderiza botões para Copiar e Colar estilos do elemento atual.
     * Copia de forma genérica para garantir que futuras propriedades sejam suportadas.
     */
    static renderCopyPasteStyles(container, element, config) {
        // Encontra o alvo base baseado na primeira configuração de seletor disponível
        const targetSelector = config.border || config.radius || config.padding;
        const target = targetSelector ? element.contentArea?.querySelector(targetSelector) : element;
        if (!target) return;

        const html = `
            <div style="display: flex; gap: 6px; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
                <button id="btn-copy-styles" class="craftools-pill" style="flex: 1; justify-content: center; gap: 4px;" title="Copiar Estilos">
                    <span class="material-symbols-outlined" style="font-size: 14px;">content_copy</span>
                    Copiar
                </button>
                <button id="btn-paste-styles" class="craftools-pill" style="flex: 1; justify-content: center; gap: 4px;" title="Colar Estilos">
                    <span class="material-symbols-outlined" style="font-size: 14px;">content_paste</span>
                    Colar
                </button>
            </div>
        `;
        
        const section = document.createElement('div');
        section.innerHTML = html;
        container.insertBefore(section, container.firstChild); // Insere no topo

        const btnCopy = section.querySelector('#btn-copy-styles');
        const btnPaste = section.querySelector('#btn-paste-styles');

        btnCopy.addEventListener('click', () => {
            window.__craftoolsClipboardStyle = {
                type: element.getAttribute('data-craftool'),
                cssText: target.style.cssText,
                zIndex: element.style.zIndex,
                meta: element._craftoolsMeta ? JSON.parse(JSON.stringify(element._craftoolsMeta)) : null
            };
            
            // Feedback visual
            const originalText = btnCopy.innerHTML;
            btnCopy.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px; color: var(--accent);">check</span> Copiado`;
            setTimeout(() => btnCopy.innerHTML = originalText, 1500);
        });

        btnPaste.addEventListener('click', () => {
            const clip = window.__craftoolsClipboardStyle;
            if (!clip) return Notify.toast('Nenhum estilo copiado!', 'error');
            if (clip.type !== element.getAttribute('data-craftool')) {
                return Notify.toast('Você só pode colar estilos entre elementos do mesmo tipo (ex: Imagem para Imagem).', 'error');
            }

            // Aplica CSS Inline (garante compatibilidade com propriedades futuras)
            target.style.cssText = clip.cssText;
            
            // Aplica Z-Index
            if (clip.zIndex) element.style.zIndex = clip.zIndex;

            // Aplica Metadados (exceto o source da imagem para não trocar a foto)
            if (clip.meta && element._craftoolsMeta) {
                const newMeta = { ...clip.meta };
                if (element._craftoolsMeta.src) newMeta.src = element._craftoolsMeta.src; // Preserva a imagem atual
                Object.assign(element._craftoolsMeta, newMeta);
            }

            // Dispara atualizações
            if (config.onChange) config.onChange();
            const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
            element.dispatchEvent(event);

            // Se for ferramenta de imagem, sincroniza a UI do transform
            if (element._syncSidebar) element._syncSidebar();

            // Atualiza o painel inteiro para refletir visualmente os novos valores nas inputs
            // Disparar click no elemento selecionado força a reabertura do painel atualizado
            setTimeout(() => {
                const rect = element.getBoundingClientRect();
                element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.x + 10, clientY: rect.y + 10 }));
                element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
            }, 50);
        });
    }
}
