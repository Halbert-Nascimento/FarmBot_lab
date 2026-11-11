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
