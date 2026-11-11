# Fatia 1: protótipo vertical (Etapa 0 do GDD)

Decisões fechadas na sessão de definição da primeira fatia. A base é o GDD §18.2.1. Em caso de divergência, vale este documento.

## Natureza

- **Motor de simulação** sem interface (`src/engine/`): código que fica, com testes automáticos.
- **Visualização e interface** (`src/view/`): protótipo descartável, só prova a integração.
- Repositório novo, do zero. O jogo antigo (`replica_TheFarmerWasReplaced`) é só referência de leitura. Qualquer reaproveitamento é decidido peça por peça.

## Stack

TypeScript, Vite, Vitest, Three.js, CodeMirror 6 e pnpm, em um único pacote. Uma regra de lint proíbe `engine/` de importar `view/`.

## Dentro da fatia

- Campo 3×2 com Gramado e Terra arada, um drone, capim e trigo (broto, crescendo, pronta).
- Estoque com feno. Plantar trigo custa 2 feno (REQ-PLA-03).
- Colher antes de amadurecer destrói a planta (REQ-PLA-02).
- Gerador aleatório com semente e comando `random()`.
- Interpretador próprio sobre o Acorn (ADR 0001) com custo em décimos de tick (ADR 0002).
- Lista de recursos de sintaxe permitidos por camada, no motor, com testes de falso positivo (`for` em string, colchetes em texto, nomes que contêm `for`).
- Comandos com nome em inglês e em português, teste de paridade, e textos da interface e erros do motor em pt-BR e en.
- Duas câmeras (ortográfica isométrica e perspectiva controlada) com alternância por tecla, e modo de estresse com campo 32×32 de plantas falsas.
- O motor avança por `step(n)` e emite eventos de mudança de estado. A visualização consome os eventos no próprio ritmo, e a velocidade nunca altera o resultado.
- Integração contínua no GitHub Actions: checagem de tipos, lint (com a fronteira `engine/` ≠ `view/`) e testes.

## Fora da fatia

Água, adubo, energia, vários drones, salvamento, missões, narrador, pesquisa, sublinhado de sintaxe bloqueada no editor.

## Definição de pronto

1. Os 6 critérios do GDD §18.2.1.
2. Medição de 100.000 ticks em até 2 s no campo 16×16 (REQ-NFR-02), registrada no ADR 0001, que passa de `proposed` para `accepted`, ou é reaberto se falhar.
3. Comparação das câmeras em 32×32, com a decisão registrada em ADR.

A equivalência entre velocidades, e entre execução com e sem visualização, é verificada por hash do estado final.

## Teste com pessoa de fora (critério 6)

A pessoa não participou do desenvolvimento, não conhece o jogo, tem familiaridade básica com computador, não precisa saber programar e recebe só as instruções do próprio protótipo. Se precisar de ajuda, registra-se onde teve dificuldade, sem orientar durante o teste. A data e a pessoa são definidas quando o protótipo estiver executável e os cinco primeiros critérios estiverem prontos. A fatia só fecha com o resultado desse teste.

## Regras provisórias decididas na implementação

Pontos pequenos que o GDD não fixava e que o motor adotou. Valem até o balanceamento ou a revisão em um ticket futuro.

- Uma ação é atômica: cobra o custo e aplica o efeito. `step(n)` aceita só inteiros não negativos e pode ultrapassar o orçamento por no máximo uma ação.
- Uma ação age sobre o mundo **como ele estava no início dela**. Por isso colher uma planta que amadurece durante os 6 ticks da própria colheita ainda a destrói.
- Bater na borda, plantar em lugar inválido e arar casa ocupada **gastam os ticks** e emitem um aviso (`bumped` ou `rejected`), sem alterar o mundo.
- O crescimento de uma planta começa quando o plantio **termina** (depois dos 6 ticks). As regras de plantio (casa ocupada, terreno, estoque) são verificadas no fim da ação, o que é equivalente com um só drone e deve ser revisto no marco dos vários drones.
- Ordem das recusas ao plantar: casa ocupada, terreno errado, estoque insuficiente.
- Estágios: broto no primeiro terço do tempo de crescimento, crescendo até completar, pronta ao completar. O progresso é um inteiro de 0 a 100.
- Rendimento de 1 item por colheita pronta (capim rende 1 feno, trigo rende 1 trigo). Capim cresce em 120 ticks e trigo em 160.
- Sensores e `random()` custam 1 tick. `log` não custa nada. `wait` aceita só número inteiro de ticks.
- Eventos são carimbados em décimos de tick (`timeDeciticks`).
- **Adiado de propósito (fora do #6):** os scripts ainda não veem o estágio de crescimento (o GDD prevê `getProgress` na camada 3), e `plant` e `harvest` não devolvem resultado ao script (o GDD prevê `harvest` devolver `{item, qty}` ou `null`). Entram quando a linguagem tiver variáveis e `if`.
- **Pendente para a visualização (ticket da cena 3D):** o motor ainda não emite evento de mudança de estágio de crescimento. A visualização hoje precisaria ler o estado para saber o estágio.

## Linguagem do jogador: o que o motor aceita hoje (ticket 3A)

- Variáveis `let` e `const` com escopo de bloco, `if`/`else`, `for`, `while`, `break`, funções (declaração, expressão e seta), `return`, closures e recursão. Operadores aritméticos, de comparação, lógicos (`&&`, `||`), unários (`!`, `-`, `+`), atribuição composta e `++`/`--`, todos com a semântica do JavaScript.
- Cada rodada de um `for` ou `while` recebe uma cópia nova das variáveis do laço, então uma closure criada numa rodada enxerga o valor daquela rodada.
- Ainda não aceitos (ficam para o 3B ou depois): template strings, objetos, listas, `continue`, `typeof`, parâmetros com valor padrão ou desestruturação, `break` com rótulo.
- Operações do script ainda **não custam tempo**. Só os comandos custam. As operações a 0,1 tick e as chamadas a 0,5 tick chegam no 3B.
- **Proteção provisória contra laço infinito:** um script é interrompido depois de 10.000 rodadas de laço seguidas sem gastar nenhum tick, apontando a linha. Isso também interrompe um laço longo que só faz contas, até o 3B dar custo às operações. O 3B troca esse limite pelo de ticks sem progresso.
- Chamadas de função aninhadas além de 200 níveis são interrompidas. Esse limite deve ser revisto antes das fatias com recursão profunda (por exemplo, o labirinto).

