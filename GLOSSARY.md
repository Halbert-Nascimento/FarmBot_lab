# FarmBot Lab

Jogo de navegador, aberto e bilíngue, em que a pessoa aprende JavaScript automatizando uma fazenda com um drone. O código do jogador custa tempo de jogo, então o código mais enxuto vence.

## Mundo

**Fazenda**:
O mundo de simulação inteiro: o campo, as plantas, os drones, o estoque e o reservatório de água.
_Avoid_: mapa, mundo, cenário

**Campo**:
A grade de casas de uma fazenda. Só a grade, sem plantas nem drones.
_Avoid_: tabuleiro, terreno (terreno é o tipo de uma casa)

**Casa**:
Cada célula do campo. Guarda terreno, planta, água e o efeito de adubo.
_Avoid_: célula, quadrado, tile

**Terreno**:
O tipo de solo de uma casa: Gramado ou Terra arada.
_Avoid_: solo, superfície

**Planta**:
Uma espécie cultivável, com regra própria, uso econômico e conceito de programação associado.
_Avoid_: cultura, cultivo

**Drone**:
O agente que executa o script do jogador na fazenda.
_Avoid_: robô, bot

**Tick**:
A unidade de tempo da simulação. Toda ação do drone e toda operação do script consome ticks.
_Avoid_: turno, passo, quadro

## Código do jogador

**Script**:
O programa em JavaScript escrito pelo jogador para comandar o drone.
_Avoid_: código (quando se fala de um programa específico), macro

**Execução**:
Uma rodada de um script na fazenda, do início ao fim ou à interrupção.
_Avoid_: run, partida

**Comando**:
Uma função do jogo que o script chama para agir (mover, plantar, colher) ou para ler a fazenda (sensores).
_Avoid_: instrução, função nativa, API (como nome do conceito)

**Ação**:
Uma operação do drone que consome ticks e muda a fazenda.
_Avoid_: tarefa, passo

**Medidor de execução**:
O resumo do custo de uma execução, em ticks com uma casa decimal.
_Avoid_: contador, cronômetro

**Evento da fazenda**:
O registro de uma mudança de estado da fazenda, emitido pelo motor de simulação e consumido pela visualização.
_Avoid_: notificação, mensagem

**Camada**:
Cada um dos dez degraus de ensino de JavaScript (1 a 10). Uma camada libera comandos e sintaxe.
_Avoid_: nível, fase, módulo

## Progressão

**Ato**:
Um agrupamento temático de camadas e missões (I a VI), com um chefe no fim.
_Avoid_: capítulo, mundo

**Missão**:
Um objetivo do catálogo único, concluído somente por resultado verificado da execução. Lição é um tipo de missão.
_Avoid_: tarefa, quest, fase

**Pesquisa**:
Um item da árvore única de progressão, que libera plantas, mecânicas ou melhorias do drone.
_Avoid_: upgrade, melhoria

**Evento de progressão**:
Um acontecimento do grafo de conteúdo, como o fim de um ato. Nunca é efeito colateral escondido de uma missão.
_Avoid_: marco de progressão

**NÚCLEO**:
O narrador do jogo. Sempre em maiúsculas.
_Avoid_: narrador genérico, assistente, IA

## Contextos de jogo

**Fazenda principal**:
A fazenda da campanha. É a única que afeta o progresso.

**Sandbox**:
Uma fazenda de teste independente, com recursos infinitos, que não afeta o progresso.

**Modo livre**:
Contexto sem missões, com todas as camadas liberadas, voltado a otimização. Guarda só placares próprios.

## Projeto

**Marco**:
Marco de lançamento: M1 (MVP), M2 (versão 1.0) ou M3 (pós-lançamento).
_Avoid_: milestone (no sentido de progressão no jogo)

**Base**:
O escopo enxuto de conteúdo do jogo (2 terrenos, 9 plantas). Não confundir com o NÚCLEO.
_Avoid_: núcleo (minúsculo)

**Motor de simulação**:
A parte que implementa as regras do jogo e roda sem interface.
_Avoid_: engine, backend

**Visualização**:
A parte que desenha o estado da fazenda. Só lê o estado, nunca o altera.
_Avoid_: renderizador (reservado ao componente técnico de desenho 3D), front-end
