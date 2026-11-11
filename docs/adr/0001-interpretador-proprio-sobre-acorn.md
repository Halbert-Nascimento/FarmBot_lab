---
status: proposed
---

# Interpretador próprio sobre a árvore sintática do Acorn

O script do jogador roda em um interpretador próprio, que percorre a árvore sintática gerada pelo Acorn, em vez de usar uma biblioteca pronta. O jogo exige, ao mesmo tempo, custo em ticks por tipo de operação, pausa linha a linha (passo a passo e vários drones), execução determinística, JS moderno e bloqueio de recursos por estrutura.

A decisão é provisória: a fatia 1 mede o desempenho, e o critério é simular 100.000 ticks em até 2 s (REQ-NFR-02). Se o interpretador próprio falhar nessa medição, reabrimos a decisão.

## Considered Options

- **`js-interpreter`** (usado no jogo antigo): permite pausar, mas o jogo antigo a descreve como ES5, e cobrar custos diferentes por nó exigiria alterar a biblioteca. Motivo ainda a confirmar.
- **QuickJS compilado para WebAssembly**: aceita o JS completo e isola bem, mas só permite interromper de tempos em tempos, sem cobrar custo por operação. Motivo ainda a confirmar.

## Consequences

O custo de manter o interpretador é nosso, e o desempenho é um risco assumido e medido desde a fatia 1.
