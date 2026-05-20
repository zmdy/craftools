# CrafTools 🎨
### Suíte Profissional de Edição e Personalização para Papelaria

O **CrafTools** é um motor de edição gráfica baseado em web, desenvolvido especificamente para atender às demandas de papelarias personalizadas, estúdios de design e produtores de álbuns. O sistema oferece uma interface rica, manipulando elementos visuais com precisão milimétrica e exportação otimizada para impressão profissional.

---

## 🚀 Funcionalidades Principais

### 📸 Manipulação Avançada de Imagens
*   **Transformações Livres**: Ajuste de zoom, posição (pan) e rotação de imagens dentro de containers dinâmicos.
*   **Filtros CSS Nativos**: Ajuste de brilho, contraste, saturação e tons de cinza em tempo real.
*   **Background Blur (Preenchimento Inteligente)**: Gera automaticamente um fundo desfocado a partir da imagem principal para preencher espaços vazios ou criar profundidade visual.
*   **Recorte e Enquadramento**: Suporte a diferentes modos de `object-fit` (Cover, Contain).

### ✍️ Ferramentas de Texto e Tipografia
*   **Edição In-Place**: Edição direta no canvas com suporte a fontes personalizadas do Google Fonts.
*   **Estilização Completa**: Controle de cores, alinhamentos, tamanhos e camadas (z-index).

### 🖼️ Gerador de Álbuns e Grades (AlbumTool)
*   **Automação de Layout**: Motor inteligente que calcula automaticamente o número de fotos por página baseado no tamanho do papel (A4, A5, etc).
*   **Modo Cartão de Visita**: Criação de grades sincronizadas onde a edição de um cartão reflete instantaneamente em todos os outros na página.
*   **Grid Interativo**: Reordenação de slots via Drag-and-Drop.

---

## 🛠️ Arquitetura Técnica

O CrafTools foi construído seguindo princípios de **Orientação a Objetos** e **Componentização Moderna**, garantindo extensibilidade e performance.

### 🏗️ Web Components Core
O coração do sistema é o `<craftools-element>`, um Custom Element que encapsula:
*   **Interatividade**: Sistemas nativos de drag, resize e rotate.
*   **Isolamento**: Estrutura interna protegida que separa o conteúdo real dos controles de UI.
*   **Precisão**: Suporte a unidades nativas do CSS (`mm`, `px`, `cm`), garantindo que o que você vê na tela é exatamente o que sairá no papel.

### 🧬 Sistema de Herança (BaseTool)
Todas as ferramentas (Imagem, Texto, Álbum) herdam de uma `BaseTool` comum. Isso permite:
*   **Interface Padronizada**: Seções de bordas, arredondamento, padding e z-index são compartilhadas e consistentes.
*   **Copy/Paste de Estilos**: Um sistema global que permite copiar propriedades complexas de um elemento e colá-las em outro de tipo compatível.

### 📐 Motor de Grid (LayoutGrid)
Uma utilidade desacoplada que utiliza **CSS Grid** para renderizar layouts complexos com precisão absoluta, respeitando margens, sangrias e espaçamentos definidos em templates.

---

## 📄 Exportação e Impressão (PdfExport)

O motor de exportação do CrafTools não é apenas um "print" da tela. Ele possui um sistema de **Flattening (Achatamento)**:
1.  **Serialização**: Converte Web Components dinâmicos em HTML/CSS estático e limpo.
2.  **Otimização de Mídia**: Garante que imagens mantenham sua resolução e filtros aplicados.
3.  **Precisão de Página**: Aplica diretivas `@page` dinâmicas para que o navegador entenda o tamanho exato do papel de cada página do projeto.

---

## 🧰 Guia de Desenvolvimento

*   **Linguagem**: JavaScript Vanila (ES6+).
*   **Estilização**: CSS Moderno (Variáveis, Grid, Flexbox).
*   **Interface**: Material Symbols para ícones e tipografia DM Sans.
*   **Interações**: PointerEvents para suporte híbrido a mouse e touch.

---

## 📜 Licença

Este programa é um software livre distribuído sob os termos da **GNU General Public License v3**. Consulte o arquivo de licença para mais detalhes.

---
*CrafTools - Tecnologia para Criatividade.*
