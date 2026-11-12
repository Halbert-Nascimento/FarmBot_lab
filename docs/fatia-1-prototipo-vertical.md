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

- Uma ação cobra o custo e só aplica o efeito quando o custo inteiro foi pago. `step(n)` aceita só inteiros não negativos e faz o relógio andar **exatamente** `n` ticks: uma ação que não cabe no que foi pedido continua no passo seguinte, de onde parou (por exemplo, um `wait(500)` passa aos poucos, e as plantas crescem enquanto isso).
- **A velocidade não muda o resultado.** Pedir 800 ticks de uma vez, em passos de 16 ou em 800 passos de 1 deixa a fazenda no mesmo estado, com os mesmos eventos e os mesmos carimbos de tempo. Dois defeitos foram corrigidos pelo caminho, ambos achados por testes: (1) um `step(1)` por quadro (1×) executava uma ação inteira por quadro e andava 8 vezes mais rápido que o pedido; (2) mesmo depois disso, uma ação comprida (como `wait(500)`) fazia o mundo pular à frente do que a tela mostrava, e as plantas apareciam prontas sem se ver o crescimento. O teste é `speeds.test.ts`: um consumidor imita a tela em 1×, 16× e instantâneo, lendo os eventos a cada quadro, só no fim ou nunca.
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

## Cena 3D (issue #11)

A visualização é um protótipo descartável em `src/view/`, em Three.js puro. Ela só lê a interface pública do motor (uma regra de lint proíbe importar de dentro de `src/engine/`) e o motor não conhece a visualização.

- **Partes:** `models.ts` (a forma das plantas, gerada por código, sem nenhuma regra), `farm-scene.ts` (o grafo Three.js, sem renderizador: lê o estado e reage aos eventos), `player.ts` (quanto tempo real vira ticks pedidos ao motor) e `main.ts` (a página do navegador). O que está na tela sempre vem do estado do motor (`sync`); os eventos só tocam os efeitos (a planta que brota, a poeira da colheita, o drone que treme ao bater na borda).
- **Trocar o modelo do trigo** só muda o que se vê: um teste troca o modelo por um cubo e confere que o hash do estado final e o que a cena mostra (espécie e estágio de cada casa) continuam iguais.
- **A velocidade** (`1`, `16` ou `instant`) é só quantos ticks por segundo a tela pede. Testes e a página real chegam ao mesmo hash nos três ritmos.
- **Desenho:** um campo de casas em tabuleiro (duas tonalidades), solo arado marrom, plantas em um estágio de cada vez (broto, crescendo, pronta) e um drone com um anel azul no chão sob ele. Cada planta é uma única malha, e as casas são uma malha instanciada.
- **Câmera:** provisória (perspectiva fixa que enquadra o campo todo). A decisão da câmera é dos tickets #13 e #14. Não há editor nem controles ainda (ticket #12): a página recebe tudo pelo endereço, por exemplo `?w=16&h=16&demo=sweep&speed=16`, e `paused` a deixa parada.
- **Como rodar:** `pnpm dev` abre a página. Para a validação visual, com `pnpm dev` rodando em outro terminal, `pnpm capture <marco> <pasta>` (marco 1, 2 ou 3) abre a página no Edge, tira capturas e grava o log do console. As capturas e os logs aprovados ficam em `docs/validacao-visual/`. O script usa `playwright-core` e o Edge instalado; não roda no CI.

## Editor e interface (issue #12)

A página junta três partes que não se conhecem, e uma quarta que as coordena:

- **Editor** (`editor.ts`, CodeMirror 6): só guarda texto. Não conhece a fazenda, a cena nem o motor.
- **Cena** (`farm-scene.ts` e `stage.ts`): só desenha.
- **Sessão** (`session.ts`): o que os botões fazem, sem nenhum botão. Coordena o motor, a cena e o console, e é testada sem navegador.
- **Interface** (`app.ts`): monta a página e passa os recados entre as três. É a única que conhece todas.

Regras da interface, decididas com o responsável:

- **Executar** sempre recomeça a fazenda do zero, com a mesma semente, e roda o código do editor. O mesmo código dá sempre o mesmo resultado. Se já havia uma execução, ela é descartada antes: nunca há duas ao mesmo tempo. O atalho é Ctrl+Enter.
- **Reiniciar** devolve a fazenda ao estado inicial e não roda nada.
- **Pausar** segura a fazenda; **Continuar** segue de onde parou, sem mudar o resultado.
- **Velocidades:** 1×, 4×, 16× e instantâneo. Só mudam o ritmo em que a tela pede tempo ao motor.
- **Medidor:** os ticks da execução, sempre com uma casa decimal, durante e depois dela.
- **Console:** o que `log`/`registrar` escreve (com o tick), cada colheita, os avisos (planta perdida por colher cedo, drone batendo na borda, recusas da fazenda em palavras simples), os erros do script com linha, causa, sugestão e dica, e uma linha final com os ticks gastos. Guarda no máximo 300 linhas. As linhas são guardadas como fatos, não como texto, então o console inteiro muda de idioma na hora.
- **Idioma:** abre no idioma do navegador (`pt` vira português, qualquer outro vira inglês), com um botão para trocar a qualquer momento. A troca muda a interface, as instruções, o console e o script de exemplo (se o jogador ainda não mexeu nele), e vale para os erros da execução seguinte. A escolha fica lembrada no navegador. Os comandos continuam valendo nos dois idiomas.
- **Camada:** a página não define `layer`, então toda a sintaxe está liberada. A progressão por camadas entra quando o bloqueio de comandos (#16) existir.
- **Instruções:** o painel "Como jogar" fica aberto, com cinco passos (o que é o código e o que são as linhas com `//`, Executar, o console e o número entre colchetes, velocidades e Pausar, Reiniciar), a explicação dos ticks e a lista de comandos que o drone entende, com os nomes no idioma escolhido e para que lado da tela cada direção aponta.
- **Casos de borda:** editor vazio não é executado (o console pede para escrever um comando). Quando o console descarta linhas antigas, uma nota no topo avisa. Um laço que espera para sempre (`while (true) { esperar(1); }`) nunca termina, por definição: só Pausar, Reiniciar ou outro Executar o interrompem, e a página não trava.
- **Textos fora do código:** `src/view/locales/en.json` e `pt-BR.json`, com teste de chaves e campos iguais, e um teste que exige explicação para todo comando do motor.

Para testar à mão, o endereço aceita `w`, `h`, `seed`, `speed`, `lang`, `demo` (`garden` ou `sweep`), `autorun` e `paused`.

## Câmeras e modo de estresse (issue #13)

Duas câmeras. A decisão do ticket #14 está no ADR 0003: **a isométrica de 50° é a padrão** e a perspectiva é a alternativa. A comparação que a embasou, com capturas e medidas, está em `docs/validacao-visual/comparacao-de-cameras.md` (registro histórico).

- **Isométrica** (ortográfica) e **perspectiva**, alternadas pela tecla **C** (ou pelo botão), sem reiniciar nem avançar a simulação. As duas abrem olhando o campo pelo sul, com a mesma elevação, para mostrar o mesmo mundo com a mesma orientação (norte ao fundo, leste à direita); só a projeção e os controles diferem.
- **A câmera inicial é a isométrica**, com o seguir o drone desligado. O ângulo da isométrica é fixo (giro 0°, elevação 50°); a configuração de 35,26° foi removida (ADR 0003).
- **Controles:** a roda do mouse dá zoom nas duas (de 1×, o campo inteiro, até 8×). Na perspectiva, o botão esquerdo gira e o direito move, e o botão **Restaurar câmera** (só aparece na perspectiva, sem atalho de teclado) desfaz giro, elevação e posição, mantendo o zoom. A isométrica só dá zoom.
- **Seguir o drone** (tecla **F**): a câmera acompanha o drone de forma suave. Com o campo inteiro na tela não tem efeito, e a câmera nunca chega perto da borda a ponto de mostrar o que está fora do campo.
- **As teclas C e F só valem quando o foco não está no editor** nem em outro campo de texto, e não valem com Ctrl, Alt ou Cmd.
- **Drone sobre uma planta:** fica semitransparente, para a planta aparecer; o anel azul no chão continua opaco.
- **Modo de estresse** (`?stress=1`, só pelo endereço, nunca na interface normal): campo 32×32 com plantas falsas dos dois tipos e dos três estágios, e o contador de quadros por segundo (média e pior quadro dos últimos 4 segundos). **Essas plantas não pertencem à fazenda simulada:** são só desenho da cena, o motor nunca as vê, e o hash e as regras ficam intocados. Clicar em Executar as remove e traz a fazenda real de volta.

## Sintaxe por camada (issue #8)

- **Configuração:** `FarmConfig.layer` (inteiro de 1 a 10). Sem ele, todas as camadas ficam liberadas (modo livre, REQ-ENS-41). Valor fora disso faz a criação da fazenda falhar.
- **Análise prévia da estrutura:** ao chamar `run`, o motor percorre a árvore sintática do script inteiro (nunca o texto) e, se achar algo de uma camada ainda não liberada, recusa o script **todo**, antes de executar qualquer comando. Por isso `for` dentro de um texto, colchetes em texto, comentários e nomes como `format` ou `whileTrue` nunca geram bloqueio. O erro `layerLocked` aponta a linha do primeiro recurso bloqueado (pela posição no script), o recurso e a camada que o libera, com o nome da camada, nos dois idiomas.
- **O que cada camada libera** (cada uma libera também o das anteriores; a tabela do código é `SYNTAX_LAYERS`, em `src/engine/layers.ts`):

| Camada | Libera |
| --- | --- |
| 1. Sequência | chamadas de comando em ordem, com constantes como argumento (`move(Dir.EAST)`) |
| 2. Valores e terreno | números e textos escritos no código |
| 3. Variáveis | `let`, `const`, atribuição, `+=`, `++`/`--`, aritmética, template strings |
| 4. Decisão | `if`/`else`, comparações, `&&`, `||`, `!` |
| 5. Repetição contada | `for` |
| 6. Repetição condicional | `while`, `break` |
| 7. Laços aninhados | um laço dentro de outro, de qualquer tipo |
| 8. Funções | `function`, parâmetros, `return`, setas, chamada de função própria |
| 9. Listas | `[...]`, índice, `length`, `push`, `pop` |
| 10. Objetos e estado | `{...}`, propriedades (`a.b`) |

- **Interpretação:**
  - Constantes como `Dir.EAST` valem desde a camada 1; números e textos literais só na 2. Um número negativo escrito no código (`-1`) é um número literal, não uma subtração.
  - Uma chamada a um nome que o próprio script declara conta como chamada de função própria (camada 8); qualquer outro nome é um comando. A declaração só esconde um comando ou um grupo de constantes (`Dir`) do mesmo nome **onde está em escopo**, como o interpretador resolve os nomes.
  - **Laço dentro de laço é pelo jeito que o código está escrito**, não pelo jeito que roda: um laço dentro de uma função conta como o primeiro laço da função, mesmo que a função seja chamada de dentro de outro laço. Na prática, para escrever funções o jogador já passou pela camada 8, depois da 7.
  - A análise só classifica o que o interpretador executa. O que ele não executa (operador ternário, `continue`, `for...of`, `try`, `switch`) é recusado pelo próprio interpretador em qualquer camada, e um teste fixa isso: se um deles passar a ser executado, precisa ganhar uma camada em `SYNTAX_LAYERS` antes de ser liberado.
- **Lacuna conhecida, temporária:** o **bloqueio de comandos por camada** (REQ-API-05: por exemplo `till` na camada 2 e `wait` na 3) **ainda não existe**. Hoje, com `layer: 1`, `till()` funciona e `wait(3)` só é recusado por causa do número `3`. Enquanto esse bloqueio não existir, a progressão por camadas **não está completa**. O trabalho está registrado na issue #16.

## Bilíngue e mensagens de erro (issue #7)

- **Nomes:** todo comando e toda constante existe em inglês e em português, e os dois valem sempre, qualquer que seja o idioma das mensagens. Um jogador pode escrever comandos em inglês e ler erros em português, ou o contrário. Os nomes em português não têm acento, para ficar fácil digitar. Tabela completa em `src/engine/names.ts` (`COMMAND_NAMES` e `CONSTANT_PAIRS`).
- **Constantes:** `Plant.GRASS`/`Planta.CAPIM`, `Plant.WHEAT`/`Planta.TRIGO`, `Terrain.GRASS`/`Terreno.GRAMA`, `Terrain.TILLED`/`Terreno.ARADO`, `Item.HAY`/`Item.FENO`, `Item.WHEAT`/`Item.TRIGO`, e `Dir.NORTH`/`Dir.NORTE` (e `EAST`/`LESTE`, `SOUTH`/`SUL`, `WEST`/`OESTE`). Os dois nomes dão **o mesmo valor** (por exemplo `"grass"`), então comparar com a constante funciona nos dois idiomas; o texto cru continua em inglês.
- **Idioma das mensagens:** `FarmConfig.language` (`'en'` por padrão ou `'pt-BR'`). O motor não detecta idioma; quem o escolhe é a interface. Um idioma inexistente faz a criação da fazenda falhar.
- **Textos fora do código:** `src/engine/locales/en.json` e `pt-BR.json`. Um teste exige as mesmas chaves e os mesmos campos `{...}` nos dois arquivos, e outro exige que todo erro do motor tenha um script de exemplo que o provoca.
- **Cada erro traz:** a linha, a causa (`reason`), uma dica do que tentar (`hint`) e, quando há um nome parecido, o "Você quis dizer…?" (`didYouMean`). `code` identifica o erro em qualquer idioma. Nomes parecidos têm até 2 edições de distância (1 em nomes de até 3 letras); em caso de empate vence o nome do idioma das mensagens, e maiúsculas não contam como diferença. Constantes são sugeridas pelo nome completo nos dois idiomas (`Plant.CAPIM` sugere `Planta.CAPIM`); um grupo de constantes (`Dir`) usado como valor tem erro próprio, e nunca é sugerido no lugar de um comando. As dicas não citam o nome do comando que o jogador digitou, para não misturar idiomas.
- **Erros de sintaxe:** os mais comuns (símbolo inesperado, texto ou template sem fechamento, nome já declarado, caractere inesperado) têm texto próprio nos dois idiomas. Também têm texto próprio `return` fora de função, atribuição inválida e palavra reservada. Qualquer outro mostra a mensagem do analisador (em inglês) dentro de um texto traduzido. Da mesma forma, em "sintaxe não suportada" o nome técnico do nó (por exemplo `ForOfStatement`) fica em inglês nos dois idiomas.
- **Paridade:** o teste `bilingual.test.ts` roda cada comando pelos dois nomes e exige o mesmo estado final, os mesmos eventos e o mesmo custo; e falha se um comando novo não tiver cenário.
- **Fora desta entrega:** a escolha automática do idioma e a troca manual (REQ-FND-44, prioridade D) ficam com a interface. Os comandos de camadas futuras (`water`, `swap`, `goTo`…) ganham o par português quando forem criados; os nomes já estão no GDD.

## Linguagem do jogador: o que o motor aceita hoje (3A e 3B, issues #4 e #5)

### O que existe

- Variáveis `let` e `const` com escopo de bloco e "zona morta" como no JavaScript (usar antes da linha da declaração é erro, mesmo que exista uma variável de fora com o mesmo nome), `if`/`else`, `for`, `while`, `break`, funções (declaração, expressão e seta), `return`, closures e recursão. Operadores aritméticos, de comparação, lógicos (`&&`, `||`), unários (`!`, `-`, `+`), atribuição composta e `++`/`--`, todos com a semântica do JavaScript.
- Cada rodada de um `for` ou `while` recebe uma cópia nova das variáveis do laço, então uma closure criada numa rodada enxerga o valor daquela rodada.
- Template strings, listas (`[...]`, `length`, leitura e escrita por posição, `push` e `pop`) e objetos (`{ a: 1 }`, leitura e escrita de propriedades com ponto ou colchetes). Escrever numa lista só é permitido até uma posição depois do fim, então as listas nunca têm buracos. Um texto também tem `length` e posições para leitura.
- O que um comando devolve (por exemplo, `getPos()`) é uma cópia que o script pode ler e alterar sem afetar a fazenda.
- O que o script entrega a um comando (inclusive a `log`) vira uma árvore pequena e simples: uma função aparece como o texto `[function]`, uma lista que contém a si mesma mostra `[circular]` no ponto em que repetiria, e um valor que aparece duas vezes vira duas cópias. Assim todo evento pode ser enviado como JSON. A árvore tem no máximo 10 vezes o tamanho de coleção (100.000 itens); acima disso o motor responde "The value is too big".
- Ainda não aceitos (o motor responde "Unsupported syntax" apontando a linha): `var` (pede `let` ou `const`), números `BigInt` (`1n`) e expressões regulares (`/a/`), `continue`, `for...of`, `typeof`, operador ternário `?:`, `??`, `||=` e `&&=`, encadeamento opcional `?.`, vírgula, espalhamento `...`, nomes de propriedade calculados, métodos em objeto, buracos em listas, métodos de lista além de `push` e `pop`, métodos de texto, parâmetros com valor padrão ou desestruturação, `break` com rótulo e função declarada fora do início de um bloco. O ternário e o `for...of` são candidatos naturais, por serem comuns em iniciantes.

### O que custa

| Ação | Custo |
| --- | --- |
| Conta, comparação, `!`, `-`, `&&`, `||` (cada operador avaliado) | 0,1 tick |
| Atribuição ou declaração com valor | 0,1 tick |
| Atribuição composta (`+=`) e `++`/`--` | 0,2 tick (operação e atribuição) |
| Chamada de função do jogador, de função guardada num objeto, `push` e `pop` | 0,5 tick |
| Comando | só o custo da tabela do GDD, sem acréscimo pela chamada |
| Ler variável, posição de lista, propriedade ou `length`; criar lista, objeto ou texto | grátis |

O tempo de cálculo passa no mundo: uma planta cresce enquanto o script só calcula, e um evento é carimbado depois do cálculo que o precede. O resultado final não depende de como o orçamento de `step` é fatiado.

### O que o protege

Todos os limites são configuráveis por fazenda (`FarmConfig.limits`), com os padrões abaixo.

- **Progresso é um comando que gasta ticks.** `while (true) { wait(1); }` continua válido para sempre (é o robô clássico; o jogador o interrompe), mas um laço que só calcula, ou que só chama comandos gratuitos como `log`, é interrompido depois de **5.000 ticks** (`computeTicksWithoutCommand`) sem comando que gaste tempo, apontando a linha. Cada comando que gasta ticks zera a contagem. Esse limite também pega uma função que se chama sem parar e uma recursão que se multiplica sem fim.
- **Rodadas sem tempo:** `while (true) {}` e laços só de comandos gratuitos são interrompidos depois de **10.000** rodadas seguidas sem gastar nenhum tick (`roundsWithoutTime`).
- **Profundidade de chamadas:** **200** por padrão (`callDepth`), sem aumento. Medimos que a pilha da máquina aguenta cerca de 500 chamadas aninhadas de código simples e estoura antes de 1.000; por isso nenhuma configuração passa de **400** (`MAX_CALL_DEPTH`). Como cada nível com muitas expressões aninhadas gasta mais pilha, qualquer estouro da pilha da máquina (por chamadas ou por valores aninhados fundo demais) também vira um erro do script ("The script went too deep"), apontando a última linha conhecida, e nunca um erro cru. Antes de aumentar o padrão, medir de novo em cada navegador suportado e para as fatias com recursão profunda (o labirinto).
- **Tamanho:** listas, objetos (número de propriedades) e textos (caracteres) valem no máximo **10.000** (`collectionSize`), tanto ao escrevê-los quanto ao fazê-los crescer. Um texto montado a partir de uma estrutura que se repete muitas vezes é recusado assim que passa do limite, sem percorrê-la inteira.
- **Memória:** o que o script mantém ao mesmo tempo (um por item de lista, um por propriedade de objeto e um por caractere de texto) vale no máximo **1.000.000** (`memoryUnits`). Só conta o que ainda é alcançável a partir das variáveis em uso, então lixo é grátis, e a medição acontece a cada 1.000 rodadas, chamadas ou comandos. Isso pega listas de listas pequenas que, somadas, esgotariam a memória.
- **Valores dos limites:** cada limite precisa ser um número inteiro de pelo menos 1; `NaN`, `Infinity`, zero ou negativo fazem a criação da fazenda falhar, para nenhuma proteção ser desligada sem querer.
- **Operadores:** o que o JavaScript do hospedeiro recusaria (por exemplo, comparar um objeto com um número, ou `++` num objeto) vira um erro do script ("Invalid operation") com a linha. `++` e `--` convertem o valor em número primeiro, como no JavaScript.

### Isolamento (REQ-FND-14, REQ-NFR-06)

O isolamento é **por construção**: o script nunca roda como JavaScript do navegador, é interpretado.

- Um nome só existe se o jogador o declarou, ou se é uma constante ou um comando do jogo. `fetch`, `localStorage`, `document`, `window`, `process`, `eval`, `Function`, `setTimeout`, `Math`, `Object` e `JSON` simplesmente não existem ("is not defined" ou "Unknown command"). `new`, `this` e `import()` não são aceitos.
- Só se chamam funções do jogador, comandos e os métodos `push` e `pop` de listas. Nenhuma função do hospedeiro é alcançável.
- Listas, objetos e textos do jogador só mostram o que o jogador pôs neles. Os objetos do jogador não têm protótipo, e os nomes `constructor`, `__proto__` e `prototype` são proibidos para leitura e escrita.
- Os testes (`isolation.test.ts`) substituem `fetch`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `sessionStorage`, `indexedDB`, `document`, `window` e `navigator` por funções espiãs e exigem que nenhuma seja chamada por 27 tentativas de acesso e 15 tentativas de sair pelos valores do jogo, e que o JavaScript do hospedeiro não seja alterado.
- Falta, e fica para a integração com o navegador: rodar o motor num *worker* (defesa em profundidade) e medir o desempenho e a pilha em cada navegador suportado.


