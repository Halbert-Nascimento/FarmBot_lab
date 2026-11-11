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

Os motivos abaixo foram conferidos nas páginas oficiais de cada projeto. Cada item separa o que a fonte afirma do que é inferência nossa.

- **`js-interpreter`** (usado no jogo antigo; JS-Interpreter de Neil Fraser).
  - *Documentado:* executa **ES5** "linha a linha"; "por padrão, um passo é uma única operação"; depende do Acorn; na seção de limitações, diz que acréscimos recentes do JavaScript, "como `let` ou `Set`", não são implementados. Dois exemplos, não uma lista completa: `const`, funções de seta e template strings não são citados, e, sendo ES5, devem ser tratados como ausentes.
  - *Não documentado:* qualquer custo diferente por operação ou orçamento configurável. Os laços infinitos são tratados limitando o número de chamadas a `step`.
  - *Inferência nossa:* cobrar valores diferentes por tipo de nó exigiria alterar a biblioteca. Não é fato citado em fonte.
  - Fontes: [documentação](https://neil.fraser.name/software/JS-Interpreter/docs.html) e [repositório oficial](https://github.com/NeilFraser/JS-Interpreter) (a leitura do repositório cobriu só o início do README; o código e as demonstrações não foram examinados).
- **QuickJS compilado para WebAssembly** (por exemplo `quickjs-emscripten`).
  - *Documentado:* o motor aceita "a maior parte do ES2025"; `JS_SetInterruptHandler()` define uma função "chamada regularmente" durante a execução, que pode implementar um tempo limite; existem limites de memória (`JS_SetMemoryLimit`) e de pilha (`JS_SetMaxStackSize`).
  - *Não documentado:* a frequência da interrupção (a fonte diz apenas "regularmente", sem intervalo nem contagem de instruções) e a semântica do valor devolvido pela função.
  - *Inferência nossa:* como a interrupção é periódica e não por operação, não daria o custo por tipo de operação que o jogo exige. A granularidade exata não foi confirmada.
  - Fonte: [documentação técnica do QuickJS](https://github.com/bellard/quickjs/blob/master/doc/quickjs.texi) (leitura parcial: o texto depois da seção de números não foi lido; a assinatura em C do callback está em `quickjs.h`, não lido).

## Consequences

O custo de manter o interpretador é nosso. O desempenho deixou de ser um risco para a fatia 1: o motor tem uma margem de cerca de 20 vezes sobre o requisito. Os riscos que sobram são a pilha em cada navegador e no worker, e a medição por navegador; ambos viram verificação obrigatória na integração com a tela. Se uma futura fatia (vários drones, campos maiores) tornar o motor lento, esta decisão é reaberta com novos dados.
