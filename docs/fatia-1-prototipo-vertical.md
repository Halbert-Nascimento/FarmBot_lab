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


