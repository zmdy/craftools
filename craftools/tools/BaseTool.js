import { CommonProperties } from "../utils/CommonProperties.js";

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
}
