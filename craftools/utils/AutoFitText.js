/**
 * AutoFitText
 *
 * Ajuste automático do tamanho (w/h) de um craftools-element para caber
 * exatamente o conteúdo do seu nó de texto interno -- usado por TextTool.js
 * (Título/Parágrafo, ao digitar/mudar fonte/tamanho/estilo) e por
 * VariableContentTool.js (Conteúdo Variável, sempre que o valor da variável
 * é resolvido). Extraído para cá (em vez de duplicado nos dois tools) porque
 * a lógica de medição é idêntica nos dois casos.
 *
 * Respeita `element._craftoolsAutoResize` (bandeira em memória, nunca
 * persistida -- ver CommonProperties.js/_appendTamanho): `false` desliga o
 * ajuste automático; qualquer outro valor (incl. undefined, o padrão para um
 * elemento novo) mantém o ajuste ativo.
 */
export class AutoFitText {

    /**
     * Mede o tamanho "natural" (intrínseco) de um nó de texto -- a largura/
     * altura que ele ocuparia sem estar restrito a 100% do elemento pai --
     * trocando temporariamente width/height para max-content e lendo
     * getBoundingClientRect(). Inclui a margem computada, já que
     * getBoundingClientRect() não a contabiliza (margem fica fora da border-box).
     */
    static measureNaturalSize(textElement) {
        const prevWidth = textElement.style.width;
        const prevHeight = textElement.style.height;
        const prevMaxWidth = textElement.style.maxWidth;
        const prevMaxHeight = textElement.style.maxHeight;

        textElement.style.maxWidth = 'none';
        textElement.style.maxHeight = 'none';
        textElement.style.width = 'max-content';
        textElement.style.height = 'max-content';

        const rect = textElement.getBoundingClientRect();
        const cs = getComputedStyle(textElement);
        const marginW = (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0);
        const marginH = (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);

        textElement.style.width = prevWidth;
        textElement.style.height = prevHeight;
        textElement.style.maxWidth = prevMaxWidth;
        textElement.style.maxHeight = prevMaxHeight;

        return {
            width: Math.ceil(rect.width + marginW),
            height: Math.ceil(rect.height + marginH)
        };
    }

    /**
     * Redimensiona o craftools-element (`element`) para caber exatamente o
     * conteúdo atual de `textElement`, respeitando o toggle "Ajustar tamanho
     * automaticamente" (ativo por padrão -- só é ignorado quando o usuário
     * desliga explicitamente). Atualiza também os campos W/H do painel de
     * Tamanho, se estiverem visíveis, para refletir o novo tamanho.
     */
    static applyAutoSize(element, textElement) {
        if (element._craftoolsAutoResize === false) return;
        if (!textElement || !textElement.isConnected) return;

        const { width, height } = this.measureNaturalSize(textElement);
        const newW = Math.max(10, width);
        const newH = Math.max(10, height);

        element.style.width = newW + 'px';
        element.style.height = newH + 'px';
        element.setAttribute('w', newW);
        element.setAttribute('h', newH);

        const wInput = document.getElementById('ct-sz-w');
        const hInput = document.getElementById('ct-sz-h');
        if (wInput) wInput.value = newW;
        if (hInput) hInput.value = newH;
    }
}
