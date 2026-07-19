/**
 * AutoFitText.ts
 *
 * Ajuste automático do tamanho (w/h) de um craftools-element para caber
 * exatamente o conteúdo do seu nó de texto interno — usado por TextTool.ts
 * (Título/Parágrafo, ao digitar/mudar fonte/tamanho/estilo) e por
 * VariableContentTool.ts (Conteúdo Variável, sempre que o valor da variável
 * é resolvido). Extraído para cá (em vez de duplicado nos dois tools) porque
 * a lógica de medição é idêntica nos dois casos.
 *
 * Respeita `element._craftoolsAutoResize` (bandeira em memória, nunca
 * persistida): só `true` liga o ajuste automático; qualquer outro valor
 * (incl. undefined, o padrão para um elemento novo) mantém o ajuste
 * DESATIVADO.
 */

import { SnapEngine } from './SnapEngine.js';

/** Extended HTMLElement carrying the internal drag/resize state. */
interface CraftoolsElement extends HTMLElement {
  _craftoolsAutoResize?: boolean;
  pw?: number;
  ph?: number;
}

export class AutoFitText {

  /**
   * Mede o tamanho "natural" (intrínseco) de um nó de texto — a largura/
   * altura que ele ocuparia sem estar restrito a 100% do elemento pai —
   * trocando temporariamente width/height para max-content e lendo
   * getBoundingClientRect(). Inclui a margem computada.
   */
  static measureNaturalSize(textElement: HTMLElement): { width: number; height: number } {
    const prevWidth     = textElement.style.width;
    const prevHeight    = textElement.style.height;
    const prevMaxWidth  = textElement.style.maxWidth;
    const prevMaxHeight = textElement.style.maxHeight;

    textElement.style.maxWidth  = 'none';
    textElement.style.maxHeight = 'none';
    textElement.style.width     = 'max-content';
    textElement.style.height    = 'max-content';

    const rect = textElement.getBoundingClientRect();
    const cs   = getComputedStyle(textElement);
    const marginW = (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight)  || 0);
    const marginH = (parseFloat(cs.marginTop)  || 0) + (parseFloat(cs.marginBottom) || 0);

    textElement.style.width     = prevWidth;
    textElement.style.height    = prevHeight;
    textElement.style.maxWidth  = prevMaxWidth;
    textElement.style.maxHeight = prevMaxHeight;

    return {
      width:  Math.ceil(rect.width  + marginW),
      height: Math.ceil(rect.height + marginH),
    };
  }

  /**
   * Redimensiona o craftools-element (`element`) para caber exatamente o
   * conteúdo atual de `textElement`, respeitando o toggle "Ajustar tamanho
   * automaticamente" (DESATIVADO por padrão — só age quando o usuário liga
   * explicitamente). Atualiza também os campos W/H do painel de Tamanho, se
   * estiverem visíveis, para refletir o novo tamanho.
   */
  static applyAutoSize(element: CraftoolsElement, textElement: HTMLElement): void {
    if (element._craftoolsAutoResize !== true) return;
    if (!textElement || !textElement.isConnected)  return;

    const { width, height } = this.measureNaturalSize(textElement);
    // Growing to fit typed/pasted content is the most common way an
    // element ends up wider/taller than the page itself -- clamp to the
    // page's own size the same way Element.ts's manual resize-handle drag
    // does (SnapEngine.getMaxSize()), so auto-fit can't grow a text box
    // past its page's edge just because the user kept typing.
    const { maxW, maxH } = SnapEngine.getMaxSize(element, 'px', 'px');
    const newW = Math.min(maxW, Math.max(10, width));
    const newH = Math.min(maxH, Math.max(10, height));

    element.style.width  = newW + 'px';
    element.style.height = newH + 'px';
    element.setAttribute('w', String(newW));
    element.setAttribute('h', String(newH));

    // Mantém o estado interno de drag/resize/rotate (Element.ts) em sincronia.
    if (typeof element.pw === 'number') element.pw = newW;
    if (typeof element.ph === 'number') element.ph = newH;

    const wInput = document.getElementById('ct-sz-w') as HTMLInputElement | null;
    const hInput = document.getElementById('ct-sz-h') as HTMLInputElement | null;
    if (wInput) wInput.value = String(newW);
    if (hInput) hInput.value = String(newH);

    // Tell everything that tracks the element's box (chiefly CtxBar, which
    // only repositions itself in response to this event) that it just
    // changed size. Without this, the resize handles/rotate handle -- being
    // simple CSS-positioned children of the element -- moved for free, but
    // the ctx-bar (a fixed-position sibling elsewhere in the DOM) stayed
    // exactly where the box used to be every time auto-fit resized it.
    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }
}
