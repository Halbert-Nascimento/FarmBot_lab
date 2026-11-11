---
status: accepted
---

# Interpretador próprio sobre a árvore sintática do Acorn

O script do jogador roda em um interpretador próprio, que percorre a árvore sintática gerada pelo Acorn, em vez de usar uma biblioteca pronta. O jogo exige, ao mesmo tempo, custo em ticks por tipo de operação, pausa linha a linha (passo a passo e vários drones), execução determinística, JS moderno e bloqueio de recursos por estrutura.

A decisão nasceu provisória: a fatia 1 mediria o desempenho, e o critério era simular 100.000 ticks em até 2 s (REQ-NFR-02). A medição foi feita (issue #10) e o critério foi cumprido com folga; a decisão passa a **aceita**.

## Medição (REQ-NFR-02)

**O que entra:** `farm.run(script)` (inclui a análise do código), o avanço da simulação até o medidor da execução marcar 100.000 ticks e a retirada dos eventos. **O que não entra:** a criação da fazenda, qualquer tela, qualquer worker e qualquer navegador.

**Cenário:** campo 16×16; um script representativo que varre o campo inteiro para sempre (lavra, planta, lê sensores, colhe, usa função, lista, objeto, `log` com template string e laços aninhados). Gera cerca de 12.700 eventos. O script está em `src/engine/performance.test.ts`.

**Resultado** (mediana de 7 execuções após 1 de aquecimento; três rodadas independentes do comando):

| Fatiamento do `step` | Mediana | Faixa observada (min–max) |
|---|---|---|
| 1 passo por 1.000 ticks (avanço rápido) | 91–95 ms | 77–110 ms |
| 1 passo por 10 ticks | 75–79 ms | 73–80 ms |
| 1 passo por tick | 80–85 ms | 79–101 ms |

Isso é cerca de **20 vezes menor** que o limite de 2 s. O fatiamento fino quase não custa nada a mais.

**Ambiente:** AMD Ryzen 5 5600 (6 núcleos), 24 GB de RAM, Windows 11, Node 25.5.0 (V8 14.1), Vitest 5.1.0. É o V8, o motor do Chrome e do Edge, mas **não são os navegadores**: Firefox (SpiderMonkey) e Safari (JavaScriptCore) não foram medidos, nem máquinas mais fracas. Com uma folga de 20 vezes, o risco é baixo, mas a medição por navegador continua pendente para a integração com a tela.

**Reprodução:** `pnpm bench` imprime as linhas `[perf]` e `[stack]`. O teste também falha se a mediana passar de 2 s, e roda no CI.

As medições informais anteriores (100.000 rodadas de cálculo em ~156 ms; 500.000 leituras de lista em ~1,2 s) eram verificações locais, com outro cenário, e **não** fazem parte deste resultado.

## Pilha e profundidade de chamadas

A profundidade padrão é **200** e o teto fixo é **400** (`MAX_CALL_DEPTH`). Na máquina acima, uma recursão simples chegou a 399 níveis em 2 de 3 rodadas e a 374 na outra: o ponto em que a pilha da máquina estoura varia com o estado de otimização do V8, então o teto de 400 está **na beira** do que a máquina aguenta, e não é uma garantia. A garantia vem de outra camada: qualquer estouro da pilha vira o erro do script "The script went too deep", nunca um erro cru. Isso foi testado com recursão até 399 níveis e com 0, 20, 60 e 150 expressões aninhadas por nível. O padrão de 200 tem margem de ao menos 1,25 vez sobre o menor ponto medido (teste automático).

Conclusão: o limite atual é seguro **nesta máquina e no V8**; os valores ficam como estão. A medição da pilha em cada navegador e dentro de um worker (cuja pilha pode ser menor) é requisito antes de qualquer fatia que dependa de recursão profunda (o labirinto).

## Considered Options

Os motivos abaixo foram revisados contra a documentação publicada de cada projeto. Onde a fonte não bastou, está dito.

- **`js-interpreter`** (usado no jogo antigo; JS-Interpreter de Neil Fraser): a documentação o descreve como um interpretador de JavaScript **ES5**, que executa o código passo a passo e depende do Acorn. O passo a passo existe, então a pausa não é o problema; o motivo é a **linguagem** (ES5 não tem `let`/`const`, setas nem template strings, que são o tipo de JS moderno que o jogo ensina) e o **custo por operação**: cobrar valores diferentes por tipo de nó exigiria alterar a biblioteca. A parte do ES5 está confirmada na documentação; a de "exigiria alterar" é uma inferência de projeto, não uma citação. Fontes: [documentação do JS-Interpreter](https://code4fukui.github.io/JS-Interpreter/docs.html) (espelho); a conferência no repositório oficial `NeilFraser/JS-Interpreter` não foi possível nesta sessão.
- **QuickJS compilado para WebAssembly** (por exemplo `quickjs-emscripten`): aceita o JS completo e isola bem. O mecanismo de interrupção documentado é uma função chamada "regularmente" pelo motor, usada para implementar um tempo limite (`setInterruptHandler`). Isso confirma que a interrupção é **periódica**, não por operação. A parte "sem cobrar custo por operação" decorre disso, mas a documentação lida não detalha a granularidade. Fonte: [README do quickjs-emscripten](https://cdn.jsdelivr.net/npm/quickjs-emscripten@0.32.0/README.md) (espelho).

## Consequences

O custo de manter o interpretador é nosso. O desempenho deixou de ser um risco para a fatia 1: o motor tem uma margem de cerca de 20 vezes sobre o requisito. Os riscos que sobram são a pilha em cada navegador e no worker, e a medição por navegador; ambos viram verificação obrigatória na integração com a tela. Se uma futura fatia (vários drones, campos maiores) tornar o motor lento, esta decisão é reaberta com novos dados.
