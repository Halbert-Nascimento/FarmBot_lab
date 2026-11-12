# Validação exploratória por um agente autônomo (fatia 1)

> **Isto não é o teste com a pessoa de fora.** Quem explorou o jogo foi **um agente autônomo, sem contexto do projeto**, controlando um navegador. Não é uma pessoa, não substitui o critério 6 do GDD §18.2.1 nem o teste do ticket #15, que continua pendente por falta de participante humano. Este documento registra o que o agente relatou, como evidência **complementar**.

## Como foi feito e o que limita o resultado

- O agente usou só o que o jogo mostra, sem explicação externa, em `http://localhost:5173/`, no estado de `main` do momento (depois do ADR 0003).
- **O navegador do agente reportava a página como oculta**, então o `requestAnimationFrame` não disparava. O agente trocou o disparo por um temporizador para o jogo andar. Por isso **os quadros por segundo que ele mediu (cerca de 59 a 4× e 16×, cerca de 32 a 1×) são do temporizador dele, não do desenho real, e não são evidência de desempenho gráfico.**
- **As capturas de tela dele às vezes mostraram um quadro atrasado**, e em dois momentos ele concluiu errado (achou que Ctrl+Enter e Executar não funcionavam) e depois corrigiu com um teste controlado. Os resultados abaixo vêm de leituras do DOM, que ele considerou mais confiáveis. **As capturas dele não são evidência.**
- O agente **não testou** o modo de estresse nem campos maiores que 3×2.
- O que o agente relatou **não foi reexecutado** por quem escreveu este documento, exceto os três pontos marcados como "conferido no código" na seção de observações.

## Medições relatadas pelo agente

| Item | Resultado relatado |
|---|---|
| Mesmo script de 171 ticks em 1×, 4×, 16× e Instantâneo | Resultado idêntico nas quatro velocidades: 171 ticks e 2 de feno |
| Tempo real em 1× | 17,3 s (cerca de 10 ticks/s) |
| Tempo real em 4× | 4,4 s (cerca de 40 ticks/s) |
| Tempo real em 16× | 1,3 s (cerca de 160 ticks/s) |
| Tempo real em Instantâneo | 0,26 s |
| Laço que espera para sempre em Instantâneo | cerca de 270 mil ticks/s, memória estável em cerca de 30 MB, interface responsiva; Pausar, Continuar e Reiniciar funcionaram durante o laço |
| Console do navegador e rede | sem erros e sem requisições falhas |
| Tarefas longas (`longtasks`) | nenhuma registrada |
| Custos em ticks (lidos pelo agente no medidor) | plantar 6, mover 8, arar 4, colher 6 (também quando falha), `esperar(n)` = n, leituras 1, `registrar` 0, iteração de laço cerca de 0,3 |
| Crescimento | capim cerca de 120 ticks; trigo cerca de 160 ticks, custa 2 feno e rende 1 |
| Zoom | de 1,0× a 8,0× |
| Tecla C, Seguir o drone (F), Restaurar câmera, Ctrl+Enter, troca de idioma | funcionam; o idioma fica salvo |

Os resultados iguais nas quatro velocidades e a taxa de ticks por segundo conferem com o que os testes do motor e do `Player` já cobrem (`src/engine/speeds.test.ts`, `src/view/player.test.ts`). Os demais números são leitura do agente.

## O que o agente achou bom

- Mensagens de erro com a linha, o motivo e uma dica (por exemplo, "Você quis dizer arar?").
- Falhas de regra (sair do campo, plantar em casa ocupada, trigo sem arar, trigo sem feno) explicadas sem travar o drone.
- Comandos aceitos em português e em inglês, com a interface acompanhando o idioma.
- O visual: o crescimento gradual das plantas, o anel do drone e as duas câmeras.
- O interpretador não trava o navegador nem em laço infinito, e a velocidade troca no meio da execução.

## Observações e problemas, com a situação de cada um

São **observações registradas, sem abrir issues.** Abrir tarefa é decisão do responsável do projeto. A coluna "Situação" separa o que foi conferido no código do que ainda não foi.

| # | Observação | Situação |
|---|---|---|
| 1 | O código do jogador se perde ao recarregar a página; só o idioma fica salvo | **Conferido no código** (só o idioma usa `localStorage`, em `src/view/main.ts`). É **limitação conhecida e fora da fatia 1**: "salvamento" consta em "Fora da fatia" de `docs/fatia-1-prototipo-vertical.md` |
| 2 | "Loop infinito sem proteção": passou de 6,8 milhões de ticks ainda executando | **Comportamento previsto, não bug.** O documento da fatia diz que um laço que espera para sempre nunca termina, e que só Pausar, Reiniciar ou outro Executar o interrompem. Um laço que só calcula, sem comando, é cortado pelo limite de 5000 ticks sem comando. O agente testou o primeiro caso |
| 3 | A quantidade de feno que o trigo exige não aparece na ajuda nem na recusa | **Lacuna confirmada no código.** O motor define 2 feno (`src/engine/plants.ts`), mas a ajuda diz só "trigo precisa de terra arada e de feno no estoque" e a recusa diz "falta feno no estoque. Colha capim para ter feno.", sem a quantidade |
| 4 | Não há objetivo, fase nem pontuação: é um sandbox | Não verificado pelo agente além da interface. Está de acordo com o escopo: missões, pesquisa e narrador constam em "Fora da fatia" |
| 5 | Ticks fracionados em laços (0,2, 0,5, 0,8, 1,1) sem explicação na ajuda | Não conferido. Os custos são em décimos de tick (ADR 0002); falta verificar o que a ajuda diz sobre isso |
| 6 | Mover para fora do campo gasta 8 ticks e só avisa, de forma discreta para um iniciante | Não conferido. A regra de que bater na borda gasta ticks e avisa consta em "Regras provisórias" do documento da fatia |
| 7 | No celular o jogo é jogável, mas apertado (campo com cerca de 205 px de altura, editor com cerca de 6 linhas, botões com cerca de 25 px contra os 44 px recomendados) | Não conferido. O marco 4 tem uma captura de janela estreita (`marco-4-11-janela-estreita.png`), mas sem medir alturas nem tamanho de botões |
| 8 | A sugestão "Você quis dizer arar?" para `voar()` é estranha | Não conferido. A sugestão vem da distância de edição entre nomes de comando |
| 9 | O painel "Como jogar" ocupa muito espaço no desktop | Observação de gosto; não conferida |
| 10 | O zoom inicial parece muito perto, e o jogo já abre muito grande; reduzir cerca de 30% | **Observação do responsável do projeto, não do agente, e ainda não verificada.** O 32×32 abre com o campo inteiro (zoom 1×); falta ver se o "muito perto" é no 3×2 e como medir |

## O que isto permite afirmar, e o que não

**Permite afirmar:**
- Um agente sem contexto, usando só a interface, conseguiu executar o primeiro script no navegador que usou, sem nenhuma dica de quem o conduzia, e o drone cumpriu os comandos.
- As quatro velocidades terminam no mesmo resultado, como os testes automáticos já mostravam.
- O console do navegador e a rede ficaram sem erros durante a exploração.

**Não permite afirmar:**
- Que uma pessoa de fora consegue rodar o primeiro script. Um agente lê a tela de outro jeito que uma pessoa, não hesita pelos mesmos motivos e não se perde no layout da mesma forma. O critério 6 do GDD §18.2.1 continua **ainda não verificável**.
- Nada sobre desempenho gráfico (ver o limite do `requestAnimationFrame` acima).
- Nada sobre os pontos 4 a 10 além do que a tabela diz.
