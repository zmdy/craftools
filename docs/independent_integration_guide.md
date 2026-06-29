# Guia de Integração Independente do Motor CrafTools

Este documento é um guia técnico e de referência completo para desenvolvedores que desejam integrar, reutilizar ou estender as bibliotecas e o ecossistema do **CrafTools** em sistemas independentes, ou implementar novas ferramentas ("tools") no editor.

---

## 1. Visão Geral da Arquitetura do Motor

O CrafTools foi desenvolvido seguindo o **Princípio da Responsabilidade Única (SRP)** utilizando JavaScript Vanilla moderno (ES6+) e **Web Components** nativos (Custom Elements), sem dependências de frameworks pesados (como React, Vue ou Angular). 

O fluxo principal do motor do editor baseia-se em três pilares:
1. **O Canvas/Páginas (`PageTool` & `.craftools-page`)**: Onde os elementos são organizados.
2. **O Wrapper de Física (`Craftools_Element`)**: Um componente Web personalizado `<craftools-element>` que encapsula as interações físicas de arrastar, redimensionar, rotacionar e gerenciar z-index de qualquer objeto colocado na página.
3. **O Orquestrador do Editor (`Craftools_Editor`)**: O Hub Central que captura eventos globais, gerencia a seleção de elementos ativos e renderiza dinamicamente os painéis de propriedades laterais delegando a execução para a ferramenta correspondente.

---

## 2. Referência Detalhada das Classes e Utilitários

### 2.1. Wrapper Físico: `Craftools_Element` (`components/Element.js`)
O elemento customizado `<craftools-element>` é o invólucro para qualquer conteúdo interativo na página. 

#### Funcionamento:
- Cria uma camada de controle (`.craftools-ctrlbar`) com 8 alças de redimensionamento e uma de rotação, além de um botão de exclusão rápida.
- Mantém uma camada de overlay protetora (`_overlay`) para capturar cliques e arrastos. Ao entrar em modo de edição (ex: cliques rápidos ou duplo clique), o overlay é desativado permitindo a interação com o elemento interno (ex: caixa de texto ou pan/zoom de imagens).
- Dispara eventos customizados para notificar o sistema sobre alterações ou seleção de foco.

#### Parâmetros e Atributos HTML Esperados:
- `x`: Posição X inicial na página (pode incluir unidades, ex: `50px`, `10mm`).
- `y`: Posição Y inicial na página.
- `w`: Largura inicial do elemento.
- `h`: Altura inicial do elemento.
- `r`: Rotação inicial em graus (ex: `0`, `45`).
- `data-craftool`: String contendo o tipo da ferramenta associada (ex: `"titulo"`, `"imagem"`, `"papeis"`, `"qrcode"`).
- `data-locked`: Se definido como `"true"`, as alças de redimensionamento, rotação e exclusão são ocultadas, travando a física do elemento.

#### Getters e Métodos Principais:
- `select()`: Ativa o foco do elemento, exibe as alças de controle físicas, aumenta seu `z-index` temporariamente para `100` e dispara o evento global `'craftools-element-select'`.
- `deselect()`: Remove a classe de seleção, oculta as alças, redefine seu `z-index` padrão para `2` e dispara o evento `'craftools-element-deselect'`.
- `contentArea`: Getter que retorna a div interna onde o conteúdo da ferramenta (SVG, Imagem, Texto) está montado.

#### Saída (Eventos Customizados Disparados):
- `'craftools-element-select'`: Emitido com `{ detail: { element: this } }` ao ganhar foco.
- `'craftools-element-deselect'`: Emitido com `{ detail: { element: this } }` ao perder o foco.
- `'craftools-element-change'`: Emitido após o término de qualquer redimensionamento, movimentação ou rotação física. Utilizado pelo sistema de histórico (Undo/Redo) para capturar o snapshot.
- `'craftools-element-delete'`: Emitido quando o botão de exclusão do elemento é clicado.

---

### 2.2. Motor de Grids e Álbuns: `Craftools_LayoutGrid` (`utils/LayoutGrid.js`)
Responsável por calcular e gerar grades físicas de impressão e álbuns de fotos, aplicando paginação automática caso o volume de itens exceda a capacidade de uma folha.

#### Funcionamento:
Suporta três estruturas de renderização com base nas propriedades do template:
1. **Grade Uniforme**: Distribui células idênticas baseando-se no espaço disponível (largura/altura da página subtraída das margens).
2. **Promo Kit** (`type: 'promo_kit'`): Usa um algoritmo de **Shelf Packing** (empacotamento em prateleiras) para organizar blocos de fotos de diferentes proporções na mesma página.
3. **Photostrips**: Monta tirinhas verticais/horizontais contendo subgrades internas cujas fotos podem ser reordenadas individualmente.

#### Parâmetros do Construtor:
```javascript
const layout = new Craftools_LayoutGrid(editor, startPage, pageSize, template);
```
1. `editor` *(HTMLElement)*: O nó do editor principal (utilizado para obter o wrapper de páginas e parâmetros de renderização).
2. `startPage` *(HTMLElement)*: A página `.craftools-page` onde a renderização do grid deve começar.
3. `pageSize` *(Object)*: Objeto contendo o tamanho do papel (ex: `{ size: "297,210", sizeUnit: "mm" }`).
4. `template` *(Object)*: Definição estrutural da grade, contendo margens, gaps e dimensões das células.

#### O Método `render()`:
```javascript
await layout.render(itemsArray, renderCallback);
```
- **`itemsArray`** *(Array)*: Lista de dados brutos (URLs de imagens, base64 ou textos) a serem populados nas células.
- **`renderCallback`** *(Function)*: Função chamada para cada célula criada. Ela recebe os seguintes parâmetros:
  - `contentLayer` *(HTMLElement)*: O container DOM interno da célula onde você deve anexar seus elementos.
  - `itemData` *(*) : O dado correspondente a este índice extraído do `itemsArray`.
  - `globalIndex` *(Number)*: O índice global sequencial do item.
  - `activeTemplateOrSlot` *(Object)*: O template do slot específico que descreve o tamanho e padding daquela célula.

#### Saída:
Gera dinamicamente elementos DOM de células (`.craftools-grid-cell`) acoplados a listeners de drag-and-drop (usando Sortable.js ou drag/drop nativo do HTML5, dependendo do modo) para troca de conteúdo físico. Se necessário, adiciona novas páginas ao documento chamando o `PageTool.addNewPage()`.

---

### 2.3. Propriedades de Estilização: `CommonProperties` (`utils/CommonProperties.js`)
Fornece campos de edição de estilo padronizados para os painéis de propriedades de todas as ferramentas.

#### Métodos Estáticos Principais:
- `renderBorder(container, element, options)`: Adiciona controles de largura da borda, estilo (sólida, tracejada, etc.) e cor.
- `renderBorderRadius(container, element, options)`: Adiciona controles de arredondamento de cantos.
- `renderPadding(container, element, options)`: Adiciona controles de espaçamento interno.
- `renderZIndex(container, element)`: Adiciona botões para avançar, recuar, trazer para a frente ou enviar para o fundo.

#### Parâmetros:
- `container` *(HTMLElement)*: A div do painel lateral onde os controles HTML do acordeão serão injetados.
- `element` *(HTMLElement)*: O `<craftools-element>` que sofrerá as alterações de estilo.
- `options` *(Object)*: Configurações extras (ex: `{ borderType: 'svg' }` para aplicar estilos a um elemento filho SVG em vez de aplicar estilos direto no wrapper do elemento).

---

### 2.4. Gerenciador de Histórico: `HistoryManager` (`utils/HistoryManager.js`)
Um singleton que gerencia os estados de Undo e Redo (desfazer e refazer) da área de trabalho.

#### Funcionamento:
Captura o estado do canvas salvando uma cópia compactada do HTML contido dentro do nó `#pages-wrapper`.

#### Métodos Principais:
- `saveState()`: Registra o estado HTML atual no topo da pilha de histórico, limpando a fila de "Redo" futura caso uma nova ação seja tomada após um Undo.
- `undo()`: Retorna para o estado anterior do documento, reinjetando o HTML salvo no `#pages-wrapper`, reanexando os listeners de evento de página e disparando o evento `'craftools-history-restored'`.
- `redo()`: Avança para o estado posterior previamente desfeito.
- `clear()`: Limpa toda a pilha de histórico.

---

### 2.5. Tradutor Modular: `I18n` (`settings/Translations.js`)
Centraliza as traduções do editor, permitindo que cada ferramenta declare dinamicamente suas traduções sem inchar o arquivo de configurações central.

#### Métodos Principais:
- `I18n.addTranslations(namespace, translationsObject)`: Adiciona chaves de tradução em múltiplos idiomas.
  ```javascript
  I18n.addTranslations('myTool', {
      "pt-br": { title: "Meu Título" },
      "en": { title: "My Title" }
  });
  ```
- `I18n.t('namespace.key')`: Retorna o texto traduzido de acordo com o idioma ativo configurado no editor (ex: `I18n.t('myTool.title')` retornarará `"Meu Título"` se o idioma ativo for `pt-br`).

---

## 3. Como Implementar Novas Ferramentas (Tools)

Para estender o motor e criar uma nova ferramenta interativa, siga o padrão de desenvolvimento modular em 4 passos:

### Passo 1: Criar a Estrutura de Arquivos da Ferramenta
Sob o diretório `craftools/tools/`, crie uma pasta para a sua ferramenta contendo os arquivos JS correspondentes (ex: ferramenta de Desenhos/Formas `shape/`):
- `craftools/tools/shape/ShapeTool.js` (Lógica principal da ferramenta e UI)
- `craftools/tools/shape/ShapeTool_Translations.js` (Traduções de suporte)

#### Exemplo de Tradução (`ShapeTool_Translations.js`):
```javascript
import { I18n } from "../../settings/Translations.js";

I18n.addTranslations('shapeTool', {
    "pt-br": {
        title: "Propriedades da Forma",
        shapeType: "Tipo de Forma",
        square: "Quadrado",
        circle: "Círculo"
    },
    "en": {
        title: "Shape Properties",
        shapeType: "Shape Type",
        square: "Square",
        circle: "Circle"
    }
});
```

#### Exemplo da Classe de Ferramenta (`ShapeTool.js`):
```javascript
import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { PanelUI } from "../../utils/PanelUI.js";
import "./ShapeTool_Translations.js";

export class ShapeTool extends BaseTool {
    
    // Rótulos contextuais exibidos na barra rápida (CtxBar) ao selecionar o elemento
    static getCtxOptions(element) {
        return [
            {
                icon: 'category',
                title: 'Mudar Forma',
                action: () => {
                    alert('Alteração rápida de forma!');
                }
            }
        ];
    }

    // Estrutura de metadados padrão persistida no elemento
    static getDefaultMeta() {
        return {
            shapeType: 'square',
            fillColor: '#3b82f6',
            opacity: 1
        };
    }

    // Criação física do elemento que será anexado à página
    static createElement(type, editorApp) {
        const el = document.createElement('craftools-element');
        el.setAttribute('data-craftool', 'shape');
        el.setAttribute('w', '100');
        el.setAttribute('h', '100');

        const meta = this.getDefaultMeta();
        el._craftoolsMeta = meta;

        const inner = document.createElement('div');
        inner.className = 'shape-content-area';
        inner.style.cssText = 'width:100%; height:100%; position:relative;';
        
        el.appendChild(inner);
        this.updateShapeHTML(el);

        return el;
    }

    // Renderiza o visual interno com base no estado de metadados
    static updateShapeHTML(element) {
        const meta = element._craftoolsMeta;
        const container = element.querySelector('.shape-content-area');
        if (!container || !meta) return;

        const w = element.pw || 100;
        const h = element.ph || 100;

        if (meta.shapeType === 'circle') {
            container.innerHTML = `<svg viewBox="0 0 100 100" width="100%" height="100%">
                <circle cx="50" cy="50" r="50" fill="${meta.fillColor}" fill-opacity="${meta.opacity}"/>
            </svg>`;
        } else {
            container.innerHTML = `<svg viewBox="0 0 100 100" width="100%" height="100%">
                <rect width="100%" height="100%" fill="${meta.fillColor}" fill-opacity="${meta.opacity}"/>
            </svg>`;
        }

        // Importante: notifica o motor sobre a mudança para registrar o histórico
        element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
    }

    // Injeta os acordeões de propriedades no painel lateral do editor
    static renderPropertiesPanel(editorPanel, element) {
        const meta = element._craftoolsMeta || this.getDefaultMeta();
        if (!element._craftoolsMeta) element._craftoolsMeta = meta;

        const htmlConfig = `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('shapeTool.shapeType')}</span>
                <select id="shape-select-type" class="craftools-select" style="width:100%;">
                    <option value="square" ${meta.shapeType === 'square' ? 'selected' : ''}>${I18n.t('shapeTool.square')}</option>
                    <option value="circle" ${meta.shapeType === 'circle' ? 'selected' : ''}>${I18n.t('shapeTool.circle')}</option>
                </select>
            </div>
            <div class="ct-field">
                <span class="craftools-label">Cor de Preenchimento</span>
                <input type="color" id="shape-fill-color" class="craftools-color-swatch" value="${meta.fillColor}" style="width:100%;">
            </div>
        `;

        editorPanel.innerHTML = PanelUI.accordion('shape-props', 'category', I18n.t('shapeTool.title'), htmlConfig, { open: true });

        // Adiciona as propriedades comuns no rodapé do painel (Borda, Arredondamento, Z-Index)
        this.renderCommonProperties(editorPanel, element, {
            border: 'svg',
            radius: 'svg',
            zindex: true,
            onChange: () => this.updateShapeHTML(element)
        });

        // Vinculação de eventos do painel
        editorPanel.querySelector('#shape-select-type').addEventListener('change', (e) => {
            meta.shapeType = e.target.value;
            this.updateShapeHTML(element);
        });

        editorPanel.querySelector('#shape-fill-color').addEventListener('input', (e) => {
            meta.fillColor = e.target.value;
            this.updateShapeHTML(element);
        });
    }
}
```

### Passo 2: Registrar a Ferramenta Arrastável no Sidebar HTML
No seu arquivo `index.html`, adicione o link da ferramenta na lista lateral `#panel-default-menu`, fornecendo o atributo `draggable="true"` e a chave `data-tool`:
```html
<li>
    <a href="#" id="pwa-sidebar-shape" draggable="true" data-tool="shape">
        <span class="material-symbols-outlined">category</span> 
        <span>Formas Vetoriais</span>
    </a>
</li>
```

### Passo 3: Adicionar Suporte de Drop em `PageTool.js`
Abra `craftools/tools/page/PageTool.js`. No tratador do evento `drop`, adicione a rota para carregar e instanciar o elemento da nova ferramenta:
```javascript
                } else if (toolType === 'shape') {
                    const { ShapeTool } = await import('../shape/ShapeTool.js');
                    el = ShapeTool.createElement(toolType, editor);
```

### Passo 4: Tratar Eventos de Seleção no Hub `Editor.js`
Abra `craftools/components/Editor.js`. 
1. Na escuta de seleção de elementos (`craftools-element-select`), direcione a montagem das propriedades e controle rápido:
   ```javascript
               } else if (toolType === 'shape') {
                   import('../tools/shape/ShapeTool.js').then(({ ShapeTool }) => {
                       this.ctxBar.show(el, ShapeTool.getCtxOptions(el));
                       if (panelTitle) panelTitle.textContent = I18n.t('shapeTool.title') || 'Propriedades da Forma';
                       if (panelBody) ShapeTool.renderPropertiesPanel(panelBody, el);
                       openPanelMenu();
                       this.activePage = null;
                   });
   ```
2. Caso queira que a ferramenta seja adicionada através de um clique rápido em dispositivos móveis, inclua o identificador na lista do mobile toolbar do `Editor.js`:
   ```javascript
   if (!['titulo', 'paragrafo', 'imagem', 'album', 'qrcode', 'papeis', 'shape'].includes(tool)) return;
   ```
   E implemente a criação equivalente sob a verificação correspondente.

---

## 4. Como Usar o Motor do CrafTools de Forma Desacoplada (Integração Independente)

É possível carregar o motor gráfico do CrafTools de forma isolada em outro projeto web sem carregar a barra superior, a barra lateral ou os painéis de estilo padrão. A física, o gerenciador de histórico e a renderização de elementos continuarão funcionando de forma nativa.

### Script de Inicialização Mínima de Canvas Independente:

```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Integração Motor CrafTools</title>
    <!-- Carregue os estilos do CrafTools contendo a física do .craftools-element -->
    <link rel="stylesheet" href="./craftools/craftools.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">
</head>
<body style="margin: 0; background: #f3f4f6; display: flex; height: 100vh;">

    <!-- Canvas Central Autônomo -->
    <div style="flex:1; display:flex; align-items:center; justify-content:center; overflow:auto;">
        <div id="pages-wrapper">
            <!-- Página Física Inicial -->
            <div class="craftools-page" id="page-1" style="width: 210mm; min-height: 297mm; background: white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); position: relative; overflow: hidden;">
                <!-- Conteúdo inicial vazio -->
            </div>
        </div>
    </div>

    <!-- Botões de Controle Externos do Seu Sistema -->
    <div style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000;">
        <button id="add-text-btn" style="padding: 8px 12px; cursor: pointer;">+ Adicionar Texto</button>
        <button id="undo-btn" style="padding: 8px 12px; cursor: pointer;">Desfazer (Undo)</button>
    </div>

    <!-- Importe o módulo CrafTools -->
    <script type="module">
        import { Craftools_Element } from "./craftools/components/Element.js";
        import { HistoryManager } from "./craftools/utils/HistoryManager.js";
        import { TextTool } from "./craftools/tools/text/TextTool.js";

        // 1. Inicializa o Elemento customizado no navegador
        Craftools_Element.init();

        const canvasPage = document.getElementById('page-1');
        const undoBtn = document.getElementById('undo-btn');

        // Cria uma referência fictícia do editor para escuta dos managers
        const dummyEditor = document.body;

        // 2. Registra o primeiro estado do documento no histórico
        HistoryManager.saveState();

        // 3. Adicionar Elemento Manualmente via Botão Externo do Sistema
        document.getElementById('add-text-btn').addEventListener('click', async () => {
            // Cria um elemento do TextTool encapsulado no wrapper do CrafTools
            const el = TextTool.createElement('paragrafo', dummyEditor);
            el.setAttribute('x', '20mm');
            el.setAttribute('y', '30mm');
            el.setAttribute('w', '120mm');
            el.setAttribute('h', '24mm');

            // Adiciona no canvas
            canvasPage.appendChild(el);

            // Grava alteração no histórico
            HistoryManager.saveState();
            updateHistoryUI();
        });

        // 4. Captura alterações de física no canvas para registrar novos estados
        document.addEventListener('craftools-element-change', () => {
            HistoryManager.saveState();
            updateHistoryUI();
        });

        // 5. Acoplamento de Desfazer (Undo)
        undoBtn.addEventListener('click', () => {
            HistoryManager.undo();
            updateHistoryUI();
        });

        function updateHistoryUI() {
            undoBtn.disabled = !HistoryManager.hasUndo();
        }
    </script>
</body>
</html>
```

Através deste método de integração, você pode construir suas próprias barras de ferramentas, usar layouts de renderização customizados no front-end, e aproveitar toda a infraestrutura otimizada de física de drag/resize/rotate e controle de histórico robusta desenvolvida no motor CrafTools.
