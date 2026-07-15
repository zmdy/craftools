/**
 * PhotoUploaderState.js
 *
 * Estado de edição do Photo Layout Studio (photo_uploader.html, e a cópia
 * adaptada em craftools_api/public/upload_uploader.html). Antes disso era um
 * conjunto de `let`/`const` soltos no escopo do módulo (focusedIndex,
 * captionEditingEl, photoBackground, adjustState, photoTransforms,
 * photoAjusteActive, bgStateObserver) -- reunidos aqui numa única instância
 * para ficar tudo num lugar só, mais fácil de inspecionar/resetar, e para não
 * duplicar essas variáveis entre os dois arquivos que hoje têm a mesma cópia
 * colada duas vezes.
 *
 * Deliberadamente NÃO move a lógica de foco/seleção/troca de foto para cá
 * (isso continua em funções normais no HTML, só lendo/escrevendo os campos
 * desta instância) -- o objetivo aqui é organizar o estado, não reescrever o
 * fluxo de edição inteiro de uma vez.
 */
export class PhotoUploaderState {
    constructor() {
        this.focusedIndex = -1;         // índice da foto atualmente focada (-1 = nenhuma)
        this.captionEditingEl = null;   // craftools-element da legenda aberta no momento na sheet
        this.photoBackground = {};      // idx → { bg:{type,value,position,size}, overlay:{...}, border:{...} } -- ver CellBackground.js
        this.adjustState = {};          // idx → { brightness, contrast, saturation }
        this.photoTransforms = {};      // idx → { posX, posY, zoom, rotation }
        this.photoAjusteActive = {};    // idx → bool (gestos de pan/zoom habilitados)
        this.bgStateObserver = null;    // MutationObserver do painel de Fundo atualmente aberto (se houver)
    }

    /** Desconecta e limpa o observer do painel de Fundo, se houver algum ativo. */
    disconnectBgObserver() {
        if (this.bgStateObserver) {
            this.bgStateObserver.disconnect();
            this.bgStateObserver = null;
        }
    }
}
