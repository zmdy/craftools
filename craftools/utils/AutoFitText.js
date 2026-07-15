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
 * persistida -- ver CommonProperties.js/_appendTamanho): só `true` liga o
 * ajuste automático; qualquer outro valor (incl. undefined, o padrão para um
 * elemento novo -- ver TextTool.js/VariableContentTool.js createElement())
 * mantém o ajuste DESATIVADO. Precisa bater exatamente com a mesma
 * comparação usada em CommonProperties.js para calcular o estado visual do
 * toggle "Ativado/Desativado" -- senão o botão mostra desligado mas o
 * ajuste continua sendo aplicado por baixo (ou vice-versa).
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
     * automaticamente" (DESATIVADO por padrão -- só age quando o usuário liga
     * explicitamente). Atualiza também os campos W/H do painel de Tamanho, se
     * estiverem visíveis, para refletir o novo tamanho.
     *
     * IMPORTANTE: além do `style.width/height` e dos atributos `w`/`h`,
     * também atualiza `element.pw`/`element.ph` -- as propriedades internas
     * que Craftools_Element (components/Element.js) usa como fonte da
     * verdade para width/height sempre que reaplica a transform (arrastar,
     * redimensionar, girar -- ver `_applyTransform()`, chamado a cada
     * pointermove). `pw`/`ph` só são lidos do atributo `w`/`h` UMA vez, no
     * connectedCallback (criação do elemento) -- se não forem atualizados
     * aqui também, o primeiro drag depois de um auto-fit reaplica o
     * tamanho antigo (o da criação) por cima do tamanho recém-calculado,
     * fazendo o elemento "voltar" ao tamanho default no meio do arraste.
     */
    static applyAutoSize(element, textElement) {
        if (element._craftoolsAutoResize !== true) return;
        if (!textElement || !textElement.isConnected) return;

        const { width, height } = this.measureNaturalSize(textElement);
        const newW = Math.max(10, width);
        const newH = Math.max(10, height);

        element.style.width = newW + 'px';
        element.style.height = newH + 'px';
        element.setAttribute('w', newW);
        element.setAttribute('h', newH);

        // Mantém o estado interno de drag/resize/rotate (Element.js) em
        // sincronia -- ver nota acima.
        if (typeof element.pw === 'number') element.pw = newW;
        if (typeof element.ph === 'number') element.ph = newH;

        const wInput = document.getElementById('ct-sz-w');
        const hInput = document.getElementById('ct-sz-h');
        if (wInput) wInput.value = newW;
        if (hInput) hInput.value = newH;
    }
}
