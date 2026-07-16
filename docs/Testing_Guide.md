# Plano de Testes Manual — CrafTools PWA

Este documento descreve a bateria completa de testes manuais para validação do sistema CrafTools PWA. Execute este checklist de cima a baixo em uma sessão limpa de navegador (sem dados de `localStorage`) e também após a restauração de uma sessão.

---

## 1. Inicialização e PWA

| Etapa | Ação de Teste | Resultado Esperado | Status |
|---|---|---|---|
| 1.1 | Abrir o aplicativo a frio (sem sessão anterior salva no localStorage) | O editor carrega perfeitamente, exibindo um canvas vazio com uma página inicial. | [ ] |
| 1.2 | Abrir no Chrome e instalar como PWA | O prompt de instalação aparece; após instalar, o app abre como janela standalone corretamente. | [ ] |
| 1.3 | Testar funcionalidade offline | Com o service worker em cache, desabilitar a rede e recarregar. O app deve carregar do cache sem tela de erro (dinossauro). | [ ] |
| 1.4 | Acessar via dispositivo móvel (iOS Safari / Android Chrome) | O layout alterna para a visualização mobile; a barra de ferramentas superior encolhe e o menu hambúrguer é ativado. | [ ] |
| 1.5 | Parâmetro URL `?mediaKey=album` | Acessar com a URL do álbum deve ativar o modo Álbum, carregando as configurações e medidas apropriadas de imediato. | [ ] |

---

## 2. Sessão e Auto-salvamento

| Etapa | Ação de Teste | Resultado Esperado | Status |
|---|---|---|---|
| 2.1 | Testar intervalo de auto-salvamento | Adicionar um elemento e aguardar 30 segundos. O sistema deve salvar no `localStorage` silenciosamente (sem flickering visual). | [ ] |
| 2.2 | Restauração de Sessão (Crash/Fechamento) | Adicionar elementos, fechar a aba abruptamente e reabrir. O diálogo de recuperação deve aparecer ou a sessão deve ser restaurada automaticamente. | [ ] |
| 2.3 | Testar alerta de fechamento inseguro | Adicionar um elemento e tentar fechar a aba sem esperar o auto-save. O navegador deve exibir o aviso de `beforeunload` ("mudanças não salvas"). | [ ] |
| 2.4 | Iniciar nova sessão após limpar dados | Limpar a chave `craftools-session` no DevTools e atualizar. O canvas deve carregar totalmente vazio, sem prompts de recuperação. | [ ] |
| 2.5 | Testar abas simultâneas | Abrir duas abas do CrafTools ao mesmo tempo. Cada aba deve manter seu estado sem contaminação cruzada imediata de ações. | [ ] |

---

## 3. Canvas e Navegação (Zoom)

| Etapa | Ação de Teste | Resultado Esperado | Status |
|---|---|---|---|
| 3.1 | Zoom In (+) | Clicar no botão '+' várias vezes; o canvas deve aumentar proporcionalmente, e o rótulo de % atualizará de acordo. | [ ] |
| 3.2 | Zoom Out (−) | Clicar no botão '−'; o canvas deve diminuir (até um limite razoável de 10%). | [ ] |
| 3.3 | Encaixar na Tela (Fit) | Clicar no botão de fit reseta o canvas para 100% ou ajusta de acordo com o viewport atual. | [ ] |
| 3.4 | Gesto de Pinça (Mobile) | Tentar dar zoom com gesto de pinça num dispositivo móvel ou trackpad. O canvas deve seguir o zoom fluidamente. | [ ] |
| 3.5 | Pan (Arrastar Tela) | Clicar no fundo (sem elementos selecionados) e arrastar. O canvas deve se mover com os elementos mantendo suas posições relativas. | [ ] |

---

## 4. Gestão de Histórico (Undo / Redo)

| Etapa | Ação de Teste | Resultado Esperado | Status |
|---|---|---|---|
| 4.1 | Desfazer Ação Simples | Adicionar um elemento e clicar em Undo. O elemento some e o contador volta uma etapa. | [ ] |
| 4.2 | Saturação da Pilha de Histórico | Fazer 15 adições e edições; a pilha deve acomodar apenas os últimos X estados (padrão 10) e os antigos devem ser limpos silenciosamente. | [ ] |
| 4.3 | Ramificação de Histórico | Dar Undo 2 vezes, depois criar um novo elemento. O "futuro" antigo do Redo deve ser apagado e o contador assume a nova ramificação. | [ ] |
| 4.4 | Refazer (Redo) | Clicar no botão Redo restaura a ação apagada anteriormente; contador atualiza adequadamente. | [ ] |
| 4.5 | Atalhos de Teclado | Usar Ctrl+Z e Ctrl+Y (ou Cmd) produz o mesmo efeito dos botões de Undo/Redo. | [ ] |

---

## 5. Ferramentas Básicas de Página

| Etapa | Ação de Teste | Resultado Esperado | Status |
|---|---|---|---|
| 5.1 | Adicionar Nova Página | Clicar no botão correspondente anexa uma nova página ao fim do editor e a tela rola até ela. | [ ] |
| 5.2 | Reordenar Páginas | Arrastar a miniatura da página para reordenar deve mover a página fisicamente na tela. | [ ] |
| 5.3 | Clonar Página | Clicar no botão de duplicar gera uma cópia exata de todo o conteúdo e propriedades da página alvo. | [ ] |
| 5.4 | Deletar Página | A página é removida do fluxo. Se for a única página, a exclusão é bloqueada ou uma folha em branco substitui a anterior. | [ ] |
| 5.5 | Grid e Snapping | Ativar as réguas/grid e arrastar um objeto. Ele deve "grudar" nos eixos ou pontilhados da grade configurada. | [ ] |

---

## 6. Ferramentas de Conteúdo: Texto

| Etapa | Ação de Teste | Resultado Esperado | Status |
|---|---|---|---|
| 6.1 | Entrar em Edição de Texto | Duplo clique sobre um texto entra no estado `contenteditable`. A barra flutuante reflete o modo texto. | [ ] |
| 6.2 | Configurações de Tipografia | Mudar fonte (Google Fonts/Upload Local), tamanho e peso. As mudanças refletem em tempo real no canvas. | [ ] |
| 6.3 | Cores e Gradientes | Aplicar cor sólida, mudar para cor degradê (gradient). O efeito deve colorir os glifos corretamente (background-clip). | [ ] |
| 6.4 | Auto-fit (Ajuste Automático) | Habilitar Auto-fit e digitar um texto comprido. A fonte deve encolher para nunca extrapolar a caixa de contorno original. | [ ] |
| 6.5 | Alinhamento e Espaçamento | Testar alinhamento (Esq, Centro, Dir) e ajuste de Line-height; o espaçamento flui de acordo sem quebrar a caixa. | [ ] |

---

## 7. Ferramentas de Conteúdo: Imagem e Filtros

| Etapa | Ação de Teste | Resultado Esperado | Status |
|---|---|---|---|
| 7.1 | Adição e Fonte | Adicionar uma imagem usando Upload Local e via Colar URL. A imagem preenche a caixa respectiva. | [ ] |
| 7.2 | Máscaras de Recorte (Clipping) | Aplicar máscara circular ou SVG dinâmico. A imagem é cortada mantendo a proporção. | [ ] |
| 7.3 | Transformações Matriciais | Alterar os inputs X, Y ou zoom da imagem dentro de uma máscara. A imagem desloca seu enquadramento interno sem mover a div pai. | [ ] |
| 7.4 | Filtros de CSS | Mudar Brilho, Contraste, Saturação e Desfoque. As predefinições ou sliders alteram os visuais (via variáveis CSS ou filtros). | [ ] |
| 7.5 | Remoção de Fundo (Background Removal) | (Se configurado na API), disparar o removedor; aguardar loading e verificar o recorte Alpha renderizado no canvas. | [ ] |

---

## 8. Ferramentas de Conteúdo: QR Code e Código de Barras

| Etapa | Ação de Teste | Resultado Esperado | Status |
|---|---|---|---|
| 8.1 | Geração de QR Code | Inserir texto ou URL. O QR code é recarregado usando a cor primária e de fundo escolhidas. O grau de correção EC é respeitado. | [ ] |
| 8.2 | Leitura Padrão do QR Code | Testar a renderização final escaneando a tela com uma câmera de celular genérico (ex: Câmera do iOS) para confirmar legibilidade. | [ ] |
| 8.3 | Inserir Código de Barras (EAN-13) | Inserir 13 dígitos numéricos. A sintaxe de barras é traçada corretamente; testar escaneamento por aplicativo. | [ ] |
| 8.4 | Cores do Código de Barras | Alterar cor das linhas e cor de fundo. A paleta é refletida usando a API de desenho. | [ ] |
| 8.5 | Vinculação com Variável (Conteúdo Dinâmico) | Vincular o valor numérico ou URL a um campo do Banco de Dados/Variável. O placeholder deve acusar o vínculo corretamente na tela de edição. | [ ] |

---

## 9. Renderização Híbrida de Variáveis (Variable Engine)

| Etapa | Ação de Teste | Resultado Esperado | Status |
|---|---|---|---|
| 9.1 | Inserção de Texto Variável | Adicionar um elemento Conteúdo Variável; escolher o tipo "Frase API" ou "Número Sequencial". O bloco exibe o placeholder. | [ ] |
| 9.2 | Preview Dinâmico | Alterar o index no Painel de Testes (ex: Item 1 de 10). O texto de placeholder em todos os elementos da página se transforma no valor simulado do banco/API. | [ ] |
| 9.3 | Ligação entre Elementos | Criar uma imagem e vinculá-la a uma coluna de "Logo" do modo variável; mudar o Index da amostragem fará a imagem atualizar seu Src. | [ ] |

---

## 10. Exportação (PDF e Imagens)

| Etapa | Ação de Teste | Resultado Esperado | Status |
|---|---|---|---|
| 10.1 | Exportar para PNG (Página Única) | O arquivo PNG baixado reflete estritamente os limites da página, respeitando camadas (z-index) e não possui serrilhamento severo (bom dpi). | [ ] |
| 10.2 | Exportar para PDF (Sem Variáveis) | O PDF renderiza todas as páginas com margens exatas e tamanho de folha correspondente ao configurado. | [ ] |
| 10.3 | Exportar para PDF (Com Geração Variável) | Se a página possui numeração sequencial (1 a 10), o PDF gerado deve iterar 10 páginas com o número atualizado sequencialmente em cada laço de exportação, mantendo as dimensões coerentes. | [ ] |

---

## Observações de Regressão:
- Sempre cheque se a aba do Console de Desenvolvedor está limpa (sem erros vermelhos) após a navegação intensa entre painéis de ferramentas.
- Durante os testes de manipulação (arrastar, soltar, dar zoom), o uso da memória deve se manter estável; lentidão excessiva após 30+ clones de elementos caracteriza memory leak de listeners.
