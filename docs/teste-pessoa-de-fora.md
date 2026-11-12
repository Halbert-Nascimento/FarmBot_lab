# Fatia 1: levantamento dos critérios e roteiro do teste com a pessoa de fora (issue #15)

Este documento prepara o fechamento da fatia 1. Ele **não define a pessoa nem a data**, e o resultado do teste só entra depois que ele acontecer. A base é o GDD §18.2.1 de `GAME_DESIGN_DOCUMENT.md` (o arquivo que está no repositório). Em caso de divergência, vale `docs/fatia-1-prototipo-vertical.md`.

## Parte 1. Levantamento dos 6 critérios (GDD §18.2.1)

Situação em `main`, no commit `0679c43`, com 751 testes passando e o CI verde. "Atendido" quer dizer: há teste automático ou evidência registrada que cobre o critério como o GDD o escreve. O que o critério não cobre fica na coluna de limites.

| # | Critério | Situação | Evidência | Limites |
|---|---|---|---|---|
| 1 | O mesmo script, com a mesma semente, dá o mesmo estado final **com a interface e sem ela** | Atendido | `src/view/player.test.ts` ("ends the same as the engine on its own, with nobody watching"); `src/view/farm-scene.test.ts` ("leaves the engine in the very same state as a run nobody watched"); `src/view/session.test.ts` ("gives the same result as the engine on its own"); `src/engine/determinism.test.ts` (hash do estado) | A prova é por hash do estado final, em testes sem navegador, e nas capturas do Edge (hash igual antes e depois de trocar a câmera). Não foi verificada em duas máquinas diferentes |
| 2 | Em 1×, 16× e instantâneo, o estado final é **idêntico** | Atendido | `src/engine/speeds.test.ts` (mesmo estado, tempo e eventos em cada ritmo, em fatias de 2 a 999 ticks, lendo eventos no fim ou nunca); `src/view/player.test.ts` ("ends the same at speed %s", incluindo 16×16) | A interface também oferece 4×, coberto pelos mesmos testes de fatiamento |
| 3 | Dois scripts equivalentes (curto e longo) mostram **ticks diferentes** | Atendido | `src/engine/speeds.test.ts` ("leave the farm the same, but show different times on the meter"); `src/engine/costs.test.ts` (custo por operação) | A tela mostra o medidor com uma casa decimal; a comparação foi feita nos testes, não por uma pessoa olhando |
| 4 | Trocar o modelo do trigo **não exige mudar nenhuma regra** | Atendido | `src/view/farm-scene.test.ts` ("changes the look and nothing the engine does: the final hash is the same"): troca o modelo por um cubo e confere o hash e o que a cena mostra | Os modelos são gerados por código (`src/view/models.ts`); não há modelo importado de arquivo |
| 5 | O protótipo ajuda a **escolher o motor de execução** com medições de custo por operação, isolamento e desempenho | Atendido, com ressalva | `docs/adr/0001-interpretador-proprio-sobre-acorn.md` (aceito): custo por operação, isolamento por construção, 100.000 ticks no 16×16 em cerca de 80 a 95 ms contra o limite de 2 s | Medido só no Node 25 (V8) em uma máquina; Firefox, Safari e máquinas mais fracas não foram medidos. A pilha de chamadas não foi medida por navegador nem em worker |
| 6 | Uma pessoa de fora consegue **rodar o primeiro script** sem explicação | **Ainda não verificável** | Depende do teste da Parte 2. Evidência **complementar, que não comprova o critério:** um agente autônomo sem contexto executou o primeiro script, sem nenhuma dica, no navegador que usou (`docs/validacao-visual/validacao-exploratoria-agente.md`) | A pessoa e a data não foram definidas por falta de participante. O agente não é uma pessoa de fora, e o relatório dele tem limites declarados (página reportada como oculta, capturas e FPS não confiáveis) |

Também fazem parte da definição de pronto da fatia (`docs/fatia-1-prototipo-vertical.md`):

- **Medição de 100.000 ticks em até 2 s (REQ-NFR-02):** registrada no ADR 0001, que está `accepted`.
- **Decisão da câmera:** registrada no ADR 0003, `accepted`. As limitações dela estão listadas no próprio ADR (enquadramento da perspectiva girada, seguir o drone em movimento rápido, GPU e outros navegadores).

O critério 6 é o único que falta. A fatia só fecha com o resultado dele.

## Parte 2. Roteiro do teste

### Quem

Uma pessoa que **não participou do desenvolvimento**, não conhece o jogo, tem familiaridade básica com computador e **não precisa saber programar**. Quem ela é e quando acontece ficam por sua conta; só se registra o que for necessário para entender o contexto (por exemplo, "adulto, usa computador no trabalho, nunca programou"), sem nome nem dado pessoal no repositório.

### Preparação (antes da pessoa chegar)

1. Atualize a `main` e rode `pnpm install` e `pnpm dev`.
2. Abra `http://localhost:5173/` **sem parâmetros** no navegador que a pessoa vai usar. Sem `demo`, `autorun` ou `lang`: a página abre com o primeiro script, no idioma do navegador. Confira se o idioma é o que a pessoa lê.
3. Feche outras abas, deixe a janela grande o bastante para ver o editor, a fazenda e o console, e deixe o painel "Como jogar" aberto como a página o entrega.
4. Quem observa fica ao lado, com este roteiro e o modelo de registro, sem tocar no teclado nem no mouse.

### O que se diz à pessoa (só isto)

> "Esta é a página de um jogo em que você escreve comandos para um drone cuidar de uma fazenda. Quero ver como ela se sai usando só o que está na tela. Tente fazer o drone executar o primeiro código. Pense em voz alta, se puder. Eu não vou explicar nada nem dar dicas durante o teste, e se você travar, tudo bem: isso também é um resultado."

### Durante o teste

- Quem observa **não explica, não aponta, não corrige e não responde a perguntas sobre o jogo.** Se a pessoa perguntar algo, responde só: "O que você faria se eu não estivesse aqui?".
- Registra o que acontece, na ordem, no modelo abaixo.
- **Fim do teste:** quando a pessoa tiver visto o drone seguir os comandos, ou quando passarem **10 minutos** sem ela conseguir (esse limite é uma proposta minha, para você aprovar ou trocar). Travar é um resultado válido.
- Ao terminar, e só então, a pessoa pode ser perguntada: "O que você achou que o drone ia fazer? O que foi mais difícil de entender?".

### O que conta como "rodou o primeiro script sem explicação"

Proposta, para você aprovar: **a pessoa clicou em Executar (ou usou Ctrl+Enter) e viu o drone cumprir os comandos do script que já estava no editor, sem nenhuma ajuda de quem observa.** Pedir ajuda, ou receber uma dica, deixa o resultado como "com ajuda", e o ponto da dificuldade é registrado. Entender o que cada comando faz não é exigido para o critério, mas é observado.

### Modelo de registro

Preencher durante a sessão, com o tempo em minutos e segundos desde o início.

**Contexto**

| Campo | Registro |
|---|---|
| Data e hora | |
| Descrição da pessoa (sem nome) | |
| Navegador e idioma da página | |
| Versão testada (hash do commit) | |
| Quem observou | |

**Linha do tempo**

| Tempo | O que a pessoa fez ou disse | Hesitou, errou ou pediu ajuda? |
|---|---|---|
| | | |

**Marcos** (anotar o tempo, ou "não chegou")

| Marco | Tempo |
|---|---|
| Leu as instruções (olhou o painel "Como jogar") | |
| Achou o botão Executar | |
| Clicou em Executar pela primeira vez | |
| Viu o drone se mexer | |
| Olhou o console | |
| Entendeu o medidor de ticks (disse com as próprias palavras) | |
| Mexeu no código por conta própria | |
| Usou os botões de câmera, de velocidade ou de pausa | |

**Dificuldades** (uma linha por ponto)

| # | Onde travou ou errou | O que a pessoa disse | O que ela tentou |
|---|---|---|---|
| | | | |

**Resultado**

| Pergunta | Resposta |
|---|---|
| Rodou o primeiro script sem nenhuma ajuda? | sim / não / com ajuda |
| Se com ajuda, qual ajuda e quando? | |
| Houve erro de script mostrado no console? Qual? | |
| O que ela disse que o drone ia fazer? | |
| O que foi mais difícil de entender? | |

### O que não se mede nesta etapa

- O tempo até o primeiro `if`: ele é do critério 1 do MVP (GDD §17.1), não da fatia 1. O protótipo não tem a progressão por camadas (o bloqueio de comandos é o #16), então não há trilha de ensino até o `if`. Se a pessoa mexer no código, o que ela tentar fica anotado como observação, sem tempo.
- Preferência de câmera: o teste verifica se a pessoa consegue rodar o primeiro script, não qual câmera ela prefere. Se ela comentar espontaneamente, anota-se, sem perguntar, para o ADR 0003 poder ser confirmado ou contestado.
- Desempenho: não é avaliado com a pessoa.

## Parte 3. Depois do teste

1. Consolidar o registro em `docs/validacao-visual/` ou numa pasta de evidência do teste (a definir), sem dados pessoais.
2. Atualizar a linha do critério 6 da tabela acima com o resultado.
3. Preparar o comentário para a issue pai #1 com o resultado dos 6 critérios, da medição de desempenho (ADR 0001) e da decisão da câmera (ADR 0003). **O comentário não fecha a #1.**
4. Só então, com a sua autorização, atualizar e fechar a #15.
