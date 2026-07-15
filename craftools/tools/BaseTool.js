import { CommonProperties } from "../utils/CommonProperties.js";
import { PanelUI } from "../utils/PanelUI.js";

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
        // config.margin: selector
        // config.zindex: boolean
        // config.onChange: callback opcional

        // 1. Faixa de Copiar/Colar Estilos no topo
        CommonProperties.renderEstiloBar(container, element, config);

        // 2. Acordeões de Forma (Borda, Radius, Padding, Margin) e Tamanho (Size, Pos, ZIndex)
        CommonProperties.renderBaseAccordions(container, element, config);

        // 3. Bind do comportamento de abrir 1 acordeão por vez
        PanelUI.bindAccordions(container);
    }
}
