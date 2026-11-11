# Documento de Requisitos do Novo Jogo (GDD Reformulado)

> **Finalidade:** especificar, como requisitos verificáveis, uma versão **totalmente remodelada** do jogo: ensinar JavaScript de forma gradual (herança do FarmBot Lab) com a profundidade sistêmica de *The Farmer Was Replaced* (TFWR), corrigindo os defeitos, lacunas e inconsistências do projeto atual.
> **Fontes:** `GAME_DESIGN_DOCUMENT.md` (jogo atual, com status por mecânica) e `VISAO_DO_NOVO_JOGO.md` (diagnóstico e ideias). Este documento **decide** o que aquelas propostas deixaram em aberto.
> **Decisões já tomadas com o responsável:** produto **bilíngue (pt-BR e inglês) desde o início**; **núcleo enxuto estilo TFWR** (2 terrenos, 9 plantas); **navegador, código aberto, licença MIT**; **foco em escolas como fase 2** (o MVP não depende dele).
> **Ressalva sobre TFWR:** o que digo do jogo de referência vem do meu conhecimento geral, não de uma consulta à versão atual. Confirme antes de citar em material público. **Nenhum nome, arte, texto ou código de TFWR pode ser reutilizado** (ver REQ-LEG-01).
> **Revisão 2:** integra o planejamento técnico-visual da conversa posterior (direção de arte, câmera, separação entre simulação e visual, desempenho gráfico, protótipo vertical e distinção entre sandbox, modo livre e fazenda principal). As novidades estão nas seções 5.6, 11.6, 15.2, 16.3 e 18.2.
> **Valores numéricos** (ticks, custos, tempos) são **pontos de partida para balanceamento** e devem ser ajustados por teste de jogo e simulação automática.

---

## Como ler

**Identificadores:** `REQ-<ÁREA>-<nº>`. Cada requisito tem prioridade e marco.

| Prioridade | Significado |
|---|---|
| **O** (Obrigatório) | Sem ele o produto não cumpre a proposta. |
| **D** (Desejável) | Aumenta muito o valor, mas o produto funciona sem ele. |
| **F** (Futuro) | Direção planejada, fora do escopo atual. |

| Marco | Significado |
|---|---|
| **M1** | MVP jogável e publicável (Atos I a III). |
| **M2** | Versão 1.0 (jogo completo, com drones e minijogos). |
| **M3** | Pós-lançamento (escolas, comunidade, expansões). |

**Áreas:** `VIS` visão · `FND` fundação · `MUN` mundo · `PLA` plantas · `MEC` mecânicas · `API` comandos · `FER` ferramentas · `ENS` ensino · `MIS` missões · `PRO` progressão · `CON` conquistas · `UX` interface · `COM` comunidade · `ESC` escolas · `NFR` não funcionais · `LEG` legal · `ARQ` arquitetura · `ART` arte e renderização.

---

# 1. Visão e objetivos do produto

## 1.1 Declaração de visão

> **Um jogo de navegador, aberto e bilíngue, em que o jogador aprende JavaScript de verdade automatizando uma fazenda. Cada planta é um problema de programação, e o código mais enxuto vence.**

## 1.2 Público e promessa

| Perfil | O que busca | Promessa |
|---|---|---|
| **Iniciante absoluto** (estudante, autodidata) | Aprender sem medo | "Do primeiro comando a funções e listas, sem sair do jogo." |
| **Programador júnior** | Praticar lógica e estruturas | "Problemas reais de ordenação, busca e concorrência, medidos por custo." |
| **Programador experiente** | Desafio de otimização | "Placar de ticks, sem tutorial obrigatório, modo livre desde o início." |
| **Professor** (fase 2) | Ferramenta de sala | "Progresso exportável, sem cadastro, sem coleta de dados." |

## 1.3 Metas de produto (mensuráveis)

| Meta | Alvo |
|---|---|
| Tempo do clique à primeira execução | ≤ 30 s, sem cadastro |
| Iniciante chega ao primeiro `if` | ≤ 20 min (≥ 80% em teste com 10 pessoas) |
| Fim do jogo principal | 15 a 20 h |
| Conteúdo opcional | +20 h |
| Carregamento inicial | ≤ 5 s em conexão comum |
| Retenção de aprendizado | Após o Ato III, ≥ 70% escrevem uma função com parâmetro sem ajuda |

> **Sobre estrelas no GitHub:** nenhum documento garante esse resultado. Os requisitos da seção 16 criam as condições (jogar sem instalar, compartilhar scripts, conteúdo da comunidade, documentação, internacionalização), mas o alcance depende de lançamento, divulgação e manutenção contínua.

---

# 2. Comparação com TFWR e decisão de herança

Legenda: **Adotar** (trazer a ideia), **Adaptar** (trazer com mudança), **Rejeitar** (não trazer), **Manter** (já é do FarmBot Lab).

| Característica | TFWR | FarmBot Lab atual | Decisão | Requisitos |
|---|---|---|---|---|
| **Tempo por operação do código** | Cada operação gasta tempo de jogo, então código enxuto roda mais rápido | Ausente | **Adotar** (o maior ganho) | REQ-FND-01 a 05 |
| **Linguagem** | Própria, parecida com Python, liberada por etapas | JavaScript ES5, bloqueado por busca de texto | **Adaptar**: JS moderno bloqueado por estrutura | REQ-FND-10 a 16 |
| **Mundo** | Grade que cresce, com borda que dá a volta | Grade que cresce, com borda que bloqueia | **Adaptar**: borda bloqueia no início, dá a volta por pesquisa | REQ-MUN-04 |
| **Drones múltiplos** | Núcleo do jogo avançado | Ausente (upgrade vazio) | **Adotar** | REQ-MEC-20 a 26 |
| **Plantas com regra própria** | Cada planta é um puzzle | Plantas quase iguais | **Adotar** | REQ-PLA-01 a 12 |
| **Plantar custa insumo** | Culturas avançadas consomem produtos | Plantar é grátis | **Adotar** | REQ-PLA-03 |
| **Água e fertilizante** | Aceleram o crescimento e custam recursos | Campos de solo sem efeito | **Adotar** | REQ-MEC-01 a 08 |
| **Plantas companheiras** | Bônus por vizinhança | Ausente | **Adotar** | REQ-MEC-10 a 12 |
| **Jogos dentro do jogo** | Labirinto, ordenação, fusão, serpente | Ausente | **Adotar** (labirinto em M2; demais em M2/M3) | REQ-MEC-30 a 34 |
| **Árvore de pesquisa única, paga em produtos** | Sim | Duas árvores e três moedas | **Adotar** | REQ-PRO-01 a 10 |
| **Placar de velocidade / desafios** | Sim | Contadores acumulados | **Adotar** | REQ-MIS-20 a 25 |
| **Ensino implícito** | Sim | Ensino explícito, com lições e dicas | **Manter e ampliar** o explícito | REQ-ENS-* |
| **Dica da dor** (detectar repetição) | Ausente | Presente | **Manter** | REQ-ENS-20 |
| **Narrador** | Mínimo | NÚCLEO | **Manter e ampliar** | REQ-UX-10 |
| **Idioma** | Inglês | Português | **Adaptar**: bilíngue | REQ-FND-40 a 44 |
| **Fazenda viva offline** | Não | Sim (plantas crescem) | **Manter com teto** | REQ-FND-06 |
| **Terrenos variados sem função** | Poucos | 6 solos e 2 superfícies, quase sem efeito | **Rejeitar** | REQ-MUN-01 a 03 |
| **Moeda sem destino (Cristais)** | — | Presente | **Rejeitar** | REQ-PRO-05 |
| **Linguagem "assíncrona" falsa** | — | L9 sem execução | **Rejeitar** | REQ-FND-17 |

---

# 3. Pilares do produto

## 3.1 Pilares mantidos do jogo atual

| Pilar | Requisito derivado |
|---|---|
| **Ensino explícito e gradual** | REQ-ENS-01 a 30 |
| **Linguagem real (JavaScript)** | REQ-FND-10 a 16 |
| **A dor antes da ferramenta** | REQ-ENS-20 a 22 |
| **Bloqueio que explica como destravar** | REQ-ENS-12 |
| **Erro tem custo e ensina** (colheita imatura) | REQ-PLA-02 |
| **Narrador com personalidade** | REQ-UX-10 |
| **Português e personalização** | REQ-FND-40, REQ-UX-30 |
| **Feedback visual rico** | REQ-UX-01 |

## 3.2 Pilares herdados de TFWR (só o que agrega valor real)

| Pilar | Requisito derivado |
|---|---|
| **O código custa tempo** | REQ-FND-01 a 05 |
| **Cada planta é um problema** | REQ-PLA-* |
| **Escala cria automação** | REQ-MUN-05 |
| **Paralelismo como ápice** | REQ-MEC-20 a 26 |
| **Placar de eficiência** | REQ-MIS-20 a 25 |

## 3.3 Pilares novos

| Pilar | Requisito derivado |
|---|---|
| **Nada de beco sem saída** (todo custo é alcançável, todo recurso tem origem) | REQ-PRO-10 a 12 |
| **Medir o como, não só o quê** | REQ-FER-01 a 08 |
| **Aberto e compartilhável** | REQ-COM-* |
| **Respeito ao tempo de quem já programa** | REQ-ENS-40 |

---

# 4. Do diagnóstico aos requisitos (rastreabilidade)

## 4.1 Problemas de design central

| # | Problema do atual | Correção | Requisitos |
|---|---|---|---|
| 1 | O custo do código não importa | Tempo de jogo gasto por operação e por ação | REQ-FND-01 a 05 |
| 2 | Crescimento em tempo de relógio | Crescimento em ticks, determinístico | REQ-FND-01, REQ-FND-06 |
| 3 | Culturas iguais | Cada planta tem regra e conceito próprios | REQ-PLA-01 a 12 |
| 4 | Solo trivial e grátis | Remover os 6 solos; terreno e água viram decisão com custo | REQ-MUN-01 a 03, REQ-MEC-01 a 08 |
| 5 | Um só drone | Drones múltiplos em M2 | REQ-MEC-20 a 26 |
| 6 | Metas por contador acumulado | Validação por execução do script em fazendas de teste | REQ-MIS-01 a 08 |
| 7 | Sem fracasso significativo | Perdas reais e recuperáveis (planta morta, abóbora podre, água esgotada) | REQ-PLA-05, REQ-MEC-03 |
| 8 | Bordas só bloqueiam | Pesquisa "Horizonte contínuo" faz o mundo dar a volta | REQ-MUN-04 |
| 9 | Cristais e conquistas sem destino | Remover cristais; Selos de Maestria com gasto definido | REQ-PRO-05, REQ-CON-* |

## 4.2 Problemas de consistência

| # | Problema | Correção | Requisitos |
|---|---|---|---|
| 10 | Culturas sem desbloqueio, mas exigidas como custo | Verificador automático de grafo de conteúdo | REQ-PRO-10 a 12 |
| 11 | Marcos concedidos só por uma missão antiga | Marcos pertencem ao grafo único, com origem declarada | REQ-PRO-10 |
| 12 | `var` bloqueado depois de `for` | Camada de variáveis vem antes e cobre `let`/`const` | REQ-ENS-02 |
| 13 | Duas trilhas de missões | Um único catálogo de missões | REQ-MIS-01 |
| 14 | Desbloqueio de API ligado à trilha antiga | API desbloqueada pela camada de ensino correspondente | REQ-API-02 |
| 15 | Duas árvores e três moedas | Uma árvore, produtos como custo, Selos para cosméticos | REQ-PRO-01 a 06 |
| 16 | Upgrades sem efeito | Todo upgrade do catálogo exige efeito testável | REQ-PRO-13 |
| 17 | Contador de turno que nunca avança | Substituído por `ticks()` real | REQ-API-30 |
| 18 | Bioma não restaurado ao carregar | Todo estado visual vem do estado salvo | REQ-FND-30 |

## 4.3 Problemas técnicos de produto

| Problema | Correção | Requisitos |
|---|---|---|
| Bloqueio por busca de texto | Análise estrutural do código | REQ-FND-12 |
| JS antigo (ES5) | JS moderno por camadas | REQ-FND-10 |
| Sem depurador | Passo a passo, pontos de parada, variáveis | REQ-FER-02 a 04 |
| Sem replay nem comparação | Replay e comparar | REQ-FER-06, 07 |
| Sem feedback de custo | Medidor de ticks | REQ-FER-01 |
| Execução presa à animação | Velocidades de visualização desacopladas | REQ-FND-03 |
| Sem áudio | Áudio básico em M2 | REQ-UX-20 |
| Clicar em Executar conta como progresso | Progresso só por resultado validado | REQ-MIS-02 |

---

# 5. Requisitos de fundação

## 5.1 Simulação por ticks e custo por operação

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-FND-01 | A simulação avança em **ticks discretos**. Plantas, água, clima futuro e eventos usam ticks, nunca relógio real. | O | M1 |
| REQ-FND-02 | Toda **ação** do drone e toda **operação do script** consome ticks, conforme a tabela 5.2. | O | M1 |
| REQ-FND-03 | A velocidade de **visualização** (1×, 4×, 16×, instantâneo) não altera o resultado. O mesmo script e a mesma semente produzem o mesmo estado em qualquer velocidade. | O | M1 |
| REQ-FND-04 | O motor é **determinístico**: geradores aleatórios usam semente, e a semente fica no salvamento. | O | M1 |
| REQ-FND-05 | Pesquisas de **velocidade** reduzem o custo de ticks (limite mínimo de 40% do valor base). | O | M2 |
| REQ-FND-06 | **Crescimento offline** limitado a um teto (proposta: 8 h) e sem gerar mais produto que um script ocioso geraria. | D | M2 |

## 5.2 Tabela de custos em ticks (proposta inicial)

| Operação | Ticks |
|---|---|
| `move` / `mover` | 8 |
| `plant` / `plantar` | 6 |
| `harvest` / `colher` | 6 |
| `till` / `arar` | 4 |
| `water` / `regar` | 4 |
| `fertilize` / `adubar` | 4 |
| `swap` / `trocar` | 6 |
| `craft` / `fabricar` | 10 |
| `wait` / `esperar(n)` | n |
| Sensor (`lerX`, `getX`) | 1 |
| Conta, comparação, atribuição | 0,1 |
| Chamada de função | 0,5 |

> **Intenção de design:** um varrimento 6×6 manual e um bem escrito diferem em dezenas de ticks. O jogador **sente** a diferença no medidor.

## 5.3 Execução e linguagem

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-FND-10 | A linguagem do jogador é um **subconjunto moderno de JavaScript** (`let`/`const`, funções de seta, *template strings*, `for...of`, desestruturação simples, `map`/`filter`/`reduce`, objetos). | O | M1 |
| REQ-FND-11 | Os recursos são liberados por **camadas de ensino** (seção 11). Nenhum recurso é liberado sem a camada correspondente. | O | M1 |
| REQ-FND-12 | O bloqueio de sintaxe analisa a **estrutura** do código (árvore sintática), nunca o texto. Colchetes em *strings*, nomes com `for` dentro etc. não geram bloqueio falso. | O | M1 |
| REQ-FND-13 | O editor **sublinha em tempo de digitação** o recurso ainda bloqueado e explica em qual camada ele chega, **sem precisar executar**. | O | M1 |
| REQ-FND-14 | O script roda em **ambiente isolado** (sem acesso a rede, armazenamento, página ou objetos do navegador), com limite de operações e de memória por execução. | O | M1 |
| REQ-FND-15 | **Laço infinito** é interrompido por limite configurável de ticks sem progresso, com mensagem que aponta a linha. | O | M1 |
| REQ-FND-16 | Erros de execução e de sintaxe aparecem **no idioma do jogador**, com linha, causa provável e sugestão. | O | M1 |
| REQ-FND-17 | **Não há `async`/`await` nem *promises*** na linguagem do jogador na versão 1.0. As ações são síncronas do ponto de vista do script. | O | M1 |
| REQ-FND-18 | Funções de utilidade (`percorrer` e semelhantes) só são oferecidas **depois** de o jogador ter escrito o laço equivalente à mão. | D | M2 |

## 5.4 Persistência e consistência de estado

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-FND-30 | O salvamento guarda **todo** estado necessário para reconstruir a cena (mundo, plantas, bioma, drones, pesquisa, scripts, conquistas, semente). Nada visual depende de evento que só ocorre uma vez. | O | M1 |
| REQ-FND-31 | O formato do salvamento é **versionado** e migra saves antigos. | O | M1 |
| REQ-FND-32 | **Biblioteca de scripts**: vários scripts nomeados e salvos, não um único editor. | O | M1 |
| REQ-FND-33 | **Exportar e importar** save e scripts por arquivo e por link compartilhável. | D | M2 |
| REQ-FND-34 | O jogo funciona **offline** depois da primeira carga (aplicativo instalável de navegador). | D | M2 |

## 5.5 Idioma

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-FND-40 | Toda a interface, lições, missões, narrador e erros existem em **pt-BR e en**. | O | M1 |
| REQ-FND-41 | Cada comando existe com **nome em inglês e em português**, sempre ambos aceitos, independentemente do idioma da interface. A interface mostra a preferência do jogador. | O | M1 |
| REQ-FND-42 | Textos ficam **fora do código** em arquivos de tradução, para a comunidade contribuir com outros idiomas. | O | M1 |
| REQ-FND-43 | Um teste automático garante **paridade** entre apelidos (todo comando tem o par nos dois idiomas, com o mesmo comportamento e custo). | O | M1 |
| REQ-FND-44 | A detecção do idioma é automática, com troca manual a qualquer momento. | D | M1 |

## 5.6 Arquitetura: simulação separada da visualização

A fazenda é uma **grade de simulação**. Cada casa guarda terreno, planta, estágio, água e adubo. O 3D **apenas representa** esse estado.

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-ARQ-01 | O **motor de simulação** (mundo, plantas, drones, custo em ticks, execução do script) é um módulo **independente** do renderizador e **roda sem interface** (testes automáticos, validação de missões e simulação de referência). | O | M1 |
| REQ-ARQ-02 | O **renderizador** só **lê** o estado da simulação e **nunca** o altera. Nenhuma regra de jogo vive na camada visual. | O | M1 |
| REQ-ARQ-03 | A visualização reage a **mudanças de estado** emitidas pela simulação (planta mudou de estágio, drone se moveu), em vez de reavaliar a fazenda inteira a cada quadro. | O | M1 |
| REQ-ARQ-04 | Acelerar a simulação (16× ou instantâneo) **não acelera animações individuais**: o renderizador mostra o estado atual e pula ou resume as animações que ficarem para trás. | O | M1 |
| REQ-ARQ-05 | Trocar a aparência (modelos, cores, tema) **não exige alterar nenhuma regra** nem invalida saves ou replays. | O | M1 |
| REQ-ARQ-06 | A comunicação simulação ⇄ visual passa por uma **interface pequena e documentada** (eventos e leitura de estado), para que a comunidade possa criar *skins* sem tocar nas regras. | D | M2 |

> **Por que importa:** é o que torna possíveis o determinismo (REQ-FND-03/04), a validação de missões no navegador e em CI (REQ-MIS-07, REQ-NFR-09) e a simulação de referência que testa o grafo de progressão (REQ-PRO-12).

---

# 6. Mundo, terrenos e recursos

## 6.1 Decisão

O núcleo passa a ter **apenas 2 terrenos**. Os 6 solos e as 2 superfícies atuais são **removidos**: não alteravam o jogo de forma legível e a troca era gratuita. A variedade de terreno vira **água e fertilizante**, que têm efeito real e custo.

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-MUN-01 | Existem **2 terrenos**: **Gramado** e **Terra arada**. Toda casa começa como Gramado. | O | M1 |
| REQ-MUN-02 | `till()` alterna a casa entre Gramado e Terra arada. Terra arada é exigida por plantas avançadas. | O | M1 |
| REQ-MUN-03 | **Removidos:** barro, argila, arenoso, turfa, silte, lama, superfícies "pura" e "arada" e os atributos de solo sem efeito (pH, salinidade, temperatura, matéria orgânica). | O | M1 |
| REQ-MUN-04 | **Pesquisa "Horizonte contínuo"** (Ato II): o mundo passa a dar a volta nas bordas. Antes disso, bater na borda bloqueia, com aviso visual. | O | M2 |
| REQ-MUN-05 | O campo cresce por pesquisa na escala: **1×3, 3×3, 4×4, 6×6, 8×8, 10×10, 12×12, 16×16, 20×20, 24×24, 32×32**. | O | M1 |
| REQ-MUN-06 | Ao crescer o campo, as casas novas nascem Gramado e vazias. | O | M1 |
| REQ-MUN-07 | Cada casa guarda: terreno, planta, **água** (0 a 100) e, para fertilizante, o tempo restante do efeito. | O | M1 |

## 6.2 Biomas e terrenos extras (adiados)

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-MUN-20 | **Biomas visuais** por ato (cor e ambiente) existem apenas como apresentação, sem alterar regras, até que haja regra a justificar. | D | M2 |
| REQ-MUN-21 | **Terrenos especiais** (pedregoso, salino, estufa, alagadiço, terra roxa) são ideias de **expansão**. Só entram se cada um tiver regra testável, comando de interação e uso no currículo. | F | M3 |

---

# 7. Plantas

## 7.1 Regras gerais

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-PLA-01 | O jogo tem **9 plantas** no núcleo. Cada uma tem **uma regra própria**, um **uso econômico** e um **conceito de programação** associado. | O | M1/M2 |
| REQ-PLA-02 | **Colher antes de amadurecer** destrói a planta sem render nada, mantendo a lição de "esperar e verificar". | O | M1 |
| REQ-PLA-03 | **Plantar consome insumo** nas plantas avançadas (ver coluna "Custo de plantio"). Plantar em casa sem insumo falha com aviso claro. | O | M1 |
| REQ-PLA-04 | **Colher fora do ponto** reduz o produto: colher cedo (pronta) rende 100%; deixar passar 50% do tempo de maturação rende 70% ("passada do ponto"). | D | M2 |
| REQ-PLA-05 | Plantas podem **morrer** por regra própria (abóbora podre, morango sem água), exigindo replantio. | O | M2 |
| REQ-PLA-06 | O desbloqueio de cada planta tem **origem única** declarada no grafo de pesquisa. | O | M1 |
| REQ-PLA-07 | Toda planta tem **modelo visual** em 3 estágios legíveis (broto, crescendo, pronta) e estado de problema (sem água, podre). | O | M1 |

## 7.2 Catálogo do núcleo

Tempos em ticks (proposta). Rendimento base em itens.

| # | Planta | Terreno | Custo de plantio | Tempo | Regra única | Uso econômico | Conceito |
|---|---|---|---|---|---|---|---|
| 1 | **Capim** | Qualquer | 0 | 120 | Cresce em qualquer casa; rendimento baixo e certo | Gera **feno**, base de quase tudo | Sequência, laço simples |
| 2 | **Arbusto** | Qualquer | 0 | 150 | Rende madeira; vira **sebe** (parede) em casos de minijogo | Gera **madeira** | Estado, obstáculos |
| 3 | **Árvore** | Qualquer | 2 feno | 420 | Cada árvore vizinha (4 direções) aumenta em 50% o tempo de crescimento. Rende 5 madeiras | Madeira em volume | Vizinhança, padrão xadrez |
| 4 | **Trigo** | Terra arada | 2 feno | 160 | Exige terra arada; rende 1 trigo | **Trigo**, insumo de várias pesquisas | `if` em terreno, preparar antes |
| 5 | **Milho** | Terra arada | 2 feno | 220 | Rende +25% por milho vizinho (máx. +100%) | **Milho** | Contagem de vizinhos |
| 6 | **Girassol** | Terra arada | 3 feno | 180 | Tem **pétalas** (7 a 15). Colher o girassol de **mais pétalas** do campo (com pelo menos 10 plantados) multiplica a **energia** produzida por 5 | **Energia**: o drone gasta 50% menos ticks enquanto houver energia | Máximo, ordenação |
| 7 | **Morango** | Terra arada | 3 feno | 200 | Exige **água** durante todo o crescimento. Após colher, **rebrota** até 3 vezes (pronta em 50% do tempo) | **Morango** | Estado, regra de recurso |
| 8 | **Abóbora** | Terra arada | 4 feno | 260 | Ao amadurecer tem 15% de chance de **apodrecer**. Quadrado m×m de abóboras maduras vizinhas **funde** em uma gigante que rende m³ itens | **Abóbora** | Laços aninhados, regiões, verificação |
| 9 | **Cacto** | Terra arada | 3 madeira | 200 | Tem **tamanho** (0 a 9). Colher um cacto cuja fila está em ordem colhe **todos os contíguos ordenados**: rende n² | **Cacto**, insumo avançado | Ordenação, troca |

### Plantas e entidades especiais (não contam entre as 9)

| Entidade | Regra | Marco |
|---|---|---|
| **Sebe / tesouro (labirinto)** | Adubo especial sobre arbusto gera labirinto. O tesouro rende **ouro** proporcional ao tamanho | M2 |
| **Maçã dourada (serpente)** | Aparece e muda de lugar a cada colheita; o drone cresce | M3 |

## 7.3 O que cada planta existente passa a ter

| Planta atual | Situação | Decisão |
|---|---|---|
| Capim | Funcional | Mantida, vira planta-base |
| Trigo | Funcional | Mantida, ganha regra de terreno e custo de plantio |
| Milho | Sem desbloqueio e sem regra | **Mantida com regra de vizinhança** |
| Árvore | Sem desbloqueio e sem regra | **Mantida com regra de espaçamento** |
| Girassol | Sem desbloqueio e sem regra | **Mantida com regra de pétalas e energia** |
| Morango | Sem desbloqueio e sem regra | **Mantida com regra de água e rebrota** |
| Arbusto, Abóbora, Cacto | Não existiam | **Novas** |

## 7.4 Itens e uso

| Item | Origem | Usos |
|---|---|---|
| **Feno** | Capim | Plantio, fabricação, pesquisa |
| **Madeira** | Arbusto, Árvore | Plantio de cacto, fabricação, pesquisa |
| **Trigo** | Trigo | Pesquisa, fabricação de adubo |
| **Milho** | Milho | Pesquisa, contratos |
| **Morango** | Morango | Pesquisa, contratos |
| **Abóbora** | Abóbora | Pesquisa |
| **Cacto** | Cacto | Pesquisa avançada |
| **Ouro** | Labirinto | Pesquisa final, selos |
| **Adubo** | Fabricado (`craft`): 2 feno + 1 madeira | Aplicar em casa para acelerar |
| **Energia** | Girassol | Reduz ticks do drone, consumida por ação |

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-PLA-10 | Todo item tem **ao menos um uso** no jogo. Item sem uso é erro de conteúdo. | O | M1 |
| REQ-PLA-11 | O inventário mostra **origem e uso** de cada item ao passar o mouse. | D | M1 |
| REQ-PLA-12 | Plantas M2 (abóbora, cacto, labirinto) só aparecem no jogo a partir das camadas de ensino que os resolvem (funções, listas). | O | M2 |

---

# 8. Mecânicas

## 8.1 Água e fertilizante

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-MEC-01 | Cada casa tem **água** de 0 a 100. A água diminui com o tempo (proposta: 1 a cada 10 ticks). | O | M1 |
| REQ-MEC-02 | **Água acelera o crescimento**: com água ≥ 30, o tempo de maturação cai 25%. | O | M1 |
| REQ-MEC-03 | A água vem de um **reservatório global**, que recarrega devagar e cresce por pesquisa. `water(n)` retira do reservatório. Reservatório vazio impede regar e exige **planejamento**. | O | M1 |
| REQ-MEC-04 | O **adubo** reduz em 40% o tempo restante da planta da casa. Uma planta só recebe um adubo por ciclo. | O | M1 |
| REQ-MEC-05 | O adubo é **fabricado** pelo jogador (`craft("fertilizer")`) e consumido ao aplicar. | O | M1 |
| REQ-MEC-06 | Água e adubo **nunca** são obrigatórios para progredir no Ato I. Tornam-se exigência crescente (morango, ouro) apenas a partir do Ato II. | O | M1 |
| REQ-MEC-07 | Os efeitos de água e adubo aparecem **visualmente** na casa (cor úmida, brilho). | O | M1 |
| REQ-MEC-08 | O sensor `getWater()` devolve o nível da casa e `getReservoir()` o do reservatório. | O | M1 |

## 8.2 Plantas companheiras

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-MEC-10 | Ao plantar, cada planta recebe uma **companheira desejada** (espécie e casa vizinha), determinística pela semente do mundo. | O | M2 |
| REQ-MEC-11 | Se a espécie pedida for plantada na casa indicada, ambas rendem **o dobro**. | O | M2 |
| REQ-MEC-12 | `getCompanion()` devolve `{species, x, y}`. É a base da **policultura**, uma das metas finais do currículo (estruturas de dados e planejamento). | O | M2 |

## 8.3 Energia

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-MEC-15 | Existe um contador de **energia**. Cada ação gasta 1 de energia e, enquanto há energia, **custa 50% menos ticks**. | O | M2 |
| REQ-MEC-16 | A energia vem de girassóis (REQ-PLA, regra do máximo). O HUD mostra a energia atual. | O | M2 |

## 8.4 Vários drones

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-MEC-20 | `spawnDrone(fn)` cria um drone que executa a função indicada, de forma independente. | O | M2 |
| REQ-MEC-21 | O número máximo de drones sobe por pesquisa (1, 2, 4, 8, 16, 32). | O | M2 |
| REQ-MEC-22 | Drones **compartilham** mundo e inventário, mas **não** variáveis. | O | M2 |
| REQ-MEC-23 | Dois drones na mesma casa são permitidos, mas ações simultâneas na mesma casa seguem uma **ordem determinística** (por identificador). | O | M2 |
| REQ-MEC-24 | `waitFor(drone)` aguarda a conclusão de um drone. `droneCount()` e `myId()` identificam. | O | M2 |
| REQ-MEC-25 | Mensagens entre drones (`send`/`receive`) são **pesquisa avançada**. | D | M3 |
| REQ-MEC-26 | A interface mostra **cada drone** com cor e ID, e o passo a passo permite escolher qual acompanhar. | O | M2 |

## 8.5 Minijogos de currículo

| ID | Minijogo | Conceito | Prior. | Marco |
|---|---|---|---|---|
| REQ-MEC-30 | **Labirinto** (arbusto + adubo especial) | Busca, recursão, pilha | O | M2 |
| REQ-MEC-31 | **Cactos ordenados** | Ordenação, troca | O | M2 |
| REQ-MEC-32 | **Abóbora gigante** | Regiões, laços aninhados | O | M2 |
| REQ-MEC-33 | **Girassóis por pétalas** | Máximo, filas de prioridade | D | M2 |
| REQ-MEC-34 | **Serpente** (maçã dourada) | Fila, estado | F | M3 |

## 8.6 Memória do drone

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-MEC-40 | `memory.set(chave, valor)` e `memory.get(chave)` guardam valores **entre execuções**, com limite que cresce por pesquisa. | D | M2 |

## 8.7 Fora do núcleo (adiados)

| ID | Ideia | Decisão | Marco |
|---|---|---|---|
| REQ-MEC-50 | Pragas | Só entram com sensor, comando de defesa e currículo claro | F / M3 |
| REQ-MEC-51 | Clima | Idem | F / M3 |
| REQ-MEC-52 | Mercado de preços | Adiado: contratos já cobrem o objetivo de decisão | F / M3 |
| REQ-MEC-53 | Estufas, terrenos especiais | Ver REQ-MUN-21 | F / M3 |

---

# 9. API de comandos (linguagem do jogador)

Convenção: **nome em inglês / nome em português**, sempre ambos aceitos (REQ-FND-41). Camada: ver seção 11.

## 9.1 Ações

| Comando | Faz | Camada | Marco |
|---|---|---|---|
| `move(dir)` / `mover(dir)` | Move 1 casa. `dir` em `Dir.NORTH/EAST/SOUTH/WEST` (`Dir.NORTE/LESTE/SUL/OESTE`) | 1 | M1 |
| `plant(species)` / `plantar(especie)` | Planta na casa atual. Usa `Plant.GRASS` (`Planta.CAPIM`) | 1 | M1 |
| `harvest()` / `colher()` | Colhe. Devolve `{item, qty}` ou `null` | 1 | M1 |
| `till()` / `arar()` | Alterna Gramado e Terra arada | 2 | M1 |
| `water(n)` / `regar(n)` | Gasta água do reservatório na casa | 3 | M1 |
| `fertilize()` / `adubar()` | Aplica 1 adubo na casa | 3 | M1 |
| `craft(item, qty)` / `fabricar(item, qtd)` | Fabrica item | 3 | M1 |
| `wait(ticks)` / `esperar(ticks)` | Aguarda sem gastar operações | 3 | M1 |
| `swap(dir)` / `trocar(dir)` | Troca a planta com a vizinha (cactos) | 8 | M2 |
| `goTo(x, y)` / `ir(x, y)` | Vai à casa (custa o caminho percorrido) | 8 | M2 |
| `spawnDrone(fn)` / `criarDrone(fn)` | Cria drone | 9 | M2 |
| `waitFor(drone)` / `aguardar(drone)` | Aguarda drone | 9 | M2 |
| `send` / `receive` (`enviar` / `receber`) | Mensagens entre drones | 10 | M3 |
| `spin()` / `girar()` | Gesto sem efeito (conquista) | 1 | M1 |

## 9.2 Sensores

| Comando | Devolve | Camada | Marco |
|---|---|---|---|
| `getPlant()` / `lerPlanta()` | Espécie ou `null` | 1 | M1 |
| `isReady()` / `lerPronta()` | `true` se pode colher | 1 | M1 |
| `getProgress()` / `lerProgresso()` | 0 a 100 | 3 | M1 |
| `getTerrain()` / `lerTerreno()` | `"grass"` ou `"tilled"` | 2 | M1 |
| `getWater()` / `lerAgua()` | Água da casa | 3 | M1 |
| `getReservoir()` / `lerReservatorio()` | Água do reservatório | 3 | M1 |
| `getNeighbor(dir)` / `lerVizinha(dir)` | Planta da vizinha | 4 | M1 |
| `measure()` / `medir()` | Valor próprio da planta (pétalas, tamanho do cacto, estágio da abóbora) | 4 | M2 |
| `getCompanion()` / `lerCompanheira()` | Companheira desejada | 6 | M2 |
| `getPos()` / `posicao()` | `{x, y}` | 1 | M1 |
| `getSize()` / `tamanho()` | `{width, height}` | 1 | M1 |
| `getStock(item)` / `estoque(item)` | Quantidade | 1 | M1 |
| `getEnergy()` / `lerEnergia()` | Energia | 7 | M2 |
| `getTicks()` / `ticks()` | Relógio da simulação | 3 | M1 |
| `droneCount()` / `qtdDrones()` | Número de drones | 9 | M2 |
| `myId()` / `meuId()` | Identificador | 9 | M2 |

## 9.3 Utilidades

| Comando | Faz | Camada |
|---|---|---|
| `log(...)` / `registrar(...)` | Escreve no log com tempo | 1 |
| `assert(cond, msg)` / `verificar(cond, msg)` | Interrompe se a condição falhar | 4 |
| `random()` / `aleatorio()` | Número de 0 a 1 (usa a semente) | 5 |
| `profile(label)` / `cronometrar(rotulo)` | Mede um trecho em ticks | 5 |
| `Pos(x, y)` | Tipo de posição com soma e distância | 7 |

## 9.4 Requisitos da API

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-API-01 | Todo comando tem **documentação** acessível no editor (passar o mouse, painel de referência, busca). | O | M1 |
| REQ-API-02 | Comandos e sintaxe são liberados **pela camada** correspondente, e a referência marca "disponível na camada N". | O | M1 |
| REQ-API-03 | Constantes (`Dir`, `Plant`, `Terrain`) evitam erros de digitação e alimentam o autocompletar. | O | M1 |
| REQ-API-04 | Comandos desconhecidos geram erro com **sugestão de nome parecido** ("Você quis dizer `harvest`?"). | O | M1 |
| REQ-API-05 | Comandos **bloqueados** não se comportam como "não fazem nada": param a execução com mensagem de desbloqueio. | O | M1 |
| REQ-API-06 | A API tem **versão**. Mudanças futuras mantêm compatibilidade ou migram scripts salvos. | D | M2 |
| REQ-API-30 | `getTicks()` substitui o antigo contador de turno, que nunca avançava. | O | M1 |

---

# 10. Ferramentas do jogador

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-FER-01 | **Medidor de execução**: ticks gastos, ações, desperdício (colheitas imaturas, replantios), linhas e custo por trecho. Visível após cada execução. | O | M1 |
| REQ-FER-02 | **Passo a passo**: executa uma linha por vez, destacando-a. | O | M1 |
| REQ-FER-03 | **Painel de variáveis** durante a pausa. | O | M1 |
| REQ-FER-04 | **Pontos de parada** clicando na margem do editor. | D | M1 |
| REQ-FER-05 | **Linha do tempo** da fazenda: quando cada planta fica pronta. | D | M2 |
| REQ-FER-06 | **Replay**: rever a última execução e as melhores por missão. | D | M2 |
| REQ-FER-07 | **Comparar** duas versões do script, lado a lado, com seus medidores. | D | M2 |
| REQ-FER-08 | **Modo sandbox**: fazenda de teste, com plantas instantâneas e recursos infinitos, sem afetar o progresso. | O | M1 |
| REQ-FER-09 | **Velocidade** de visualização (1×, 4×, 16×, instantâneo) e botões **Executar**, **Pausar**, **Parar**, **Reiniciar fazenda**. | O | M1 |
| REQ-FER-10 | Editor com **realce, autocompletar, documentação ao passar o mouse e formatação automática**. | O | M1 |
| REQ-FER-11 | **Console do jogo** (`log`) com níveis e filtro. | O | M1 |
| REQ-FER-12 | **Desfazer a última compra de pesquisa** dentro de uma janela de segurança, para não punir cliques errados. | D | M2 |
| REQ-FER-13 | **Modo blocos** opcional nas camadas 1 a 5, que **mostra o JavaScript gerado ao lado**. | D | M3 |
| REQ-FER-14 | **Trechos** (snippets) oficiais e da comunidade, importáveis. | D | M3 |

---

# 11. Ensino gradual de JavaScript

## 11.1 Princípios (requisitos de conteúdo)

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-ENS-01 | **Um conceito principal por camada**. | O | M1 |
| REQ-ENS-02 | **Variáveis (`let`/`const`) vêm antes de qualquer laço.** Isso corrige o conflito atual de `for` sem `var`. | O | M1 |
| REQ-ENS-03 | **Dor antes da ferramenta**: a camada seguinte é oferecida depois de o jogador encontrar o problema que ela resolve. | O | M1 |
| REQ-ENS-04 | **Escrever à mão antes do atalho**: laços antes de `percorrer`, funções antes de utilidades prontas. | O | M1 |
| REQ-ENS-05 | **Exemplo, adaptação, criação**: em cada camada o jogador lê, altera e escreve. | O | M1 |
| REQ-ENS-06 | **O erro informa**: toda mensagem diz linha, causa e sugestão. | O | M1 |

## 11.2 As 10 camadas

| Camada | Conceito | Dor que motiva | Mecânica que o exige | Prova de domínio | Marco |
|---|---|---|---|---|---|
| **1. Sequência** | Comandos em ordem, argumentos | — | Fazenda 1×3 | Plantar uma linha | M1 |
| **2. Valores e terreno** | Texto, números, constantes | "Como digo qual planta?" | Terra arada para trigo | Plantar trigo em terra arada | M1 |
| **3. Variáveis** | `let`, `const`, expressões | "Repeti o mesmo valor 6 vezes" | Campo 3×3 com uma espécie escolhida em um lugar | Trocar a espécie mudando uma linha | M1 |
| **4. Decisão** | `if`, `else`, comparações, `&&`, `||` | "Colhi antes de amadurecer" | Colheita imatura destrói a planta | Colher só o que está pronto | M1 |
| **5. Repetição contada** | `for` | "Escrevi `move` oito vezes" | Campo 8×1 | Varrer uma fileira | M1 |
| **6. Repetição condicional** | `while`, `break` | "Não sei quantas vezes" | Esperar amadurecer | Esperar e colher | M1 |
| **7. Laços aninhados** | `for` dentro de `for` | "Preciso do campo todo" | Campo 6×6 | Varrer e cuidar do campo | M1 |
| **8. Funções** | `function`, parâmetros, retorno, setas | "Copiei o bloco de novo" | Mesma rotina em 3 lugares | Extrair `tendRow(species)` | M1 |
| **9. Listas** | Arrays, `for...of`, `map`/`filter` | "`especie1`, `especie2`…" | Rotação de culturas | Guardar e percorrer uma rotação | M2 |
| **10. Objetos e estado** | Objetos, `memory`, registros | "Esqueci o que fiz" | Contratos e relatórios | Mapa de casas | M2 |

**Depois da camada 10 (trilha avançada, M2):** recursão (labirinto), ordenação (cactos), regiões (abóbora), complexidade (custo em ticks), concorrência (vários drones).

## 11.3 Ensino no momento certo

| ID | Gatilho detectado | Resposta do narrador | Prior. | Marco |
|---|---|---|---|---|
| REQ-ENS-20 | 6 ou mais `move` seguidos sem laço | Oferece "repetição" (camada 5) | O | M1 |
| REQ-ENS-21 | Bloco de ≥ 3 linhas repetido 2 vezes | Oferece "funções" (camada 8) | O | M1 |
| REQ-ENS-22 | Variáveis numeradas (`a1`, `a2`, …) | Oferece "listas" (camada 9) | O | M1 |
| REQ-ENS-23 | Laço infinito | Explica o limite de ticks e aponta a linha | O | M1 |
| REQ-ENS-24 | Colheita imatura repetida | Pergunta qual sensor indica maturidade | O | M1 |
| REQ-ENS-25 | Script correto, mas caro | "Funcionou em 900 ticks. Há uma versão em 600." | D | M2 |
| REQ-ENS-26 | Cada gatilho dispara **uma vez** por camada e pode ser desligado. | O | M1 |

## 11.4 Ajuda em 4 níveis

| ID | Nível | Efeito na recompensa |
|---|---|---|
| REQ-ENS-27 | 1. Dica de direção | Nenhum |
| REQ-ENS-28 | 2. Lição curta com exemplo diferente do problema | Nenhum |
| REQ-ENS-29 | 3. Esqueleto com lacunas | Perde a medalha de ouro |
| REQ-ENS-30 | 4. Solução comentada | Perde ouro e prata daquela missão |

## 11.5 Tipos de exercício

| ID | Tipo | Marco |
|---|---|---|
| REQ-ENS-31 | **Completar** código com lacunas | M1 |
| REQ-ENS-32 | **Consertar** script com defeito | M1 |
| REQ-ENS-33 | **Prever** o resultado antes de rodar | M1 |
| REQ-ENS-34 | **Refatorar** script correto e longo | M2 |
| REQ-ENS-35 | **Escrever do zero** | M1 |
| REQ-ENS-36 | **Otimizar** em ticks | M1 |
| REQ-ENS-37 | **Ler e estender** script do narrador | M2 |

## 11.6 Quem já programa

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-ENS-40 | **Teste de nível**: ao iniciar, quem quiser faz um desafio curto e **pula camadas** já dominadas. | O | M1 |
| REQ-ENS-41 | **Modo livre**: todas as camadas e comandos liberados, sem missões, para otimização. | O | M1 |
| REQ-ENS-42 | Voltar a uma camada anterior nunca apaga progresso. | O | M1 |

## 11.7 Fazenda principal, sandbox e modo livre

Três contextos de jogo diferentes, que não devem ser confundidos:

| Contexto | Para quê | Recursos | Afeta o progresso? |
|---|---|---|---|
| **Fazenda principal** | Jogar a campanha | Os que o jogador desbloqueou; economia real | **Sim** |
| **Sandbox** | Testar ideias | Recursos infinitos, plantas instantâneas; fazenda independente | **Não** |
| **Modo livre** | Quem já programa e quer otimizar | Todas as camadas e comandos liberados, sem missões | Só placares próprios |

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-ENS-43 | Os três contextos têm **saves e estados separados**. Nada feito na sandbox ou no modo livre altera a fazenda principal. | O | M1 |
| REQ-ENS-44 | **Liberdade de recursos não é liberdade de acesso**: mesmo no modo livre e na sandbox, o código roda no **ambiente isolado** (REQ-FND-14), com os mesmos limites de operações e de memória. | O | M1 |
| REQ-ENS-45 | O jogador pode **levar um script** da sandbox para a fazenda principal, e o jogo avisa quais comandos ainda não estão desbloqueados nela. | D | M1 |

---

# 12. Sistema de missões

## 12.1 Catálogo único e estrutura

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-MIS-01 | **Um único catálogo** de missões. Não há trilhas paralelas nem títulos duplicados. | O | M1 |
| REQ-MIS-02 | Missão só conclui por **resultado verificado** da execução do script, nunca por contadores acumulados nem por clicar em Executar. | O | M1 |
| REQ-MIS-03 | Cada missão tem **título, texto do narrador, objetivo, cenário de teste, regras, medalhas, dicas em 4 níveis, recompensas e fecho**. | O | M1 |
| REQ-MIS-04 | Cada missão define 1 a 3 **fazendas de teste** (mesmo objetivo, estados iniciais diferentes) para impedir resposta decorada. | O | M1 |
| REQ-MIS-05 | **Restrições** possíveis: comandos proibidos, máximo de linhas, máximo de ticks, estrutura exigida (ex.: "usar `for`"). | O | M1 |
| REQ-MIS-06 | **Medalhas**: bronze (cumpriu), prata (limite de ticks), ouro (limite de ticks e de linhas). | O | M1 |
| REQ-MIS-07 | A validação roda **no navegador, de forma determinística**, com a mesma semente. | O | M1 |
| REQ-MIS-08 | Ao concluir, o narrador **comenta o script do jogador** com base nas métricas (ex.: "usou 3 laços, dá para reduzir"). | D | M2 |

## 12.2 Tipos de missão

| ID | Tipo | Descrição | Marco |
|---|---|---|---|
| REQ-MIS-10 | **Lição** | Conceito novo, curta, com exemplo | M1 |
| REQ-MIS-11 | **Objetivo de campo** | Resultado na fazenda | M1 |
| REQ-MIS-12 | **Prova de código** | O script precisa atender a uma regra estrutural | M1 |
| REQ-MIS-13 | **Desafio de eficiência** | Menos ticks, com medalhas | M1 |
| REQ-MIS-14 | **Enigma** | Problema fechado (ordenar, labirinto) | M2 |
| REQ-MIS-15 | **Reparo** | Consertar script com defeito | M1 |
| REQ-MIS-16 | **Contrato** | Entrega com prazo em ticks | M2 |
| REQ-MIS-17 | **Chefe de ato** | Minijogo ou enigma de fim de ato | M2 |

## 12.3 Desafios e placar

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-MIS-20 | **Desafio semanal**: fazenda fixa (mesma semente) para todos, placar local e opcionalmente online. | D | M3 |
| REQ-MIS-21 | **Placar local** por missão (melhores ticks e linhas). | O | M1 |
| REQ-MIS-22 | **Fazendas desafio** (regras estranhas: "sem laços", "10 linhas", "1 só drone"). | D | M2 |
| REQ-MIS-23 | **Fazenda infinita** para pontuação no pós-jogo. | D | M3 |
| REQ-MIS-24 | **Ranking online** nunca expõe o código do jogador, a menos que ele escolha compartilhar. | D | M3 |
| REQ-MIS-25 | **Níveis criados pela comunidade** em formato aberto (JSON), importáveis por link e arquivo. | D | M3 |

## 12.4 Estrutura de capítulo

1. Abertura do narrador. 2. Lição. 3. Dois a três objetivos de campo. 4. Prova de código. 5. Desafio de eficiência opcional. 6. Chefe (quando houver). 7. Fecho com recompensa.

## 12.5 Exemplos de missões

| Ato | Missão | Tipo | Meta |
|---|---|---|---|
| I | Acordar o drone | Lição | Rodar um script de 3 comandos |
| I | Primeira fileira | Objetivo | Plantar capim em 3 casas |
| I | A colheita que falhou | Reparo | Corrigir script que colhe cedo demais |
| I | Só o que está pronto | Prova | Usar `if` + `isReady()` |
| II | Oito passos, uma linha | Prova | Varrer 8×1 com `for` |
| II | Espere o trigo | Objetivo | Usar `while` até estar pronto |
| II | Menos é mais | Eficiência | Varrer 6×6 em ≤ 450 ticks |
| III | Rotina da casa | Prova | Extrair função `tendRow` |
| III | Rotação de safra | Prova | Usar lista de espécies |
| III | Contrato do vizinho | Contrato | 40 trigos em 4.000 ticks |
| IV | A sebe | Enigma | Resolver o labirinto |
| IV | Cactos em fila | Enigma | Ordenar 10 cactos |
| V | Dois drones | Prova | Dividir a varredura em 2 drones |

---

# 13. Progressão e economia

## 13.1 Estrutura única

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-PRO-01 | Existe **uma só árvore de pesquisa**, com 3 ramos: **Linguagem**, **Fazenda** e **Drones**. | O | M1 |
| REQ-PRO-02 | O ramo **Linguagem** não tem custo em moeda: cada camada se destrava por **prova de domínio** (missão) ou **teste de nível**. | O | M1 |
| REQ-PRO-03 | Os ramos **Fazenda** e **Drones** custam **produtos colhidos** (modelo de TFWR). Não há moeda abstrata de pesquisa. | O | M1 |
| REQ-PRO-04 | **Selos de Maestria** são ganhos por medalhas de ouro e conquistas. | O | M1 |
| REQ-PRO-05 | Selos compram **cosméticos** (cores de drone, modelos, molduras de título) e **modos de desafio**. **Não compram poder.** Os antigos "Cristais" deixam de existir. | O | M1 |
| REQ-PRO-06 | Cada pesquisa mostra: custo, requisitos, efeito, e o que falta para liberar. | O | M1 |

## 13.2 Catálogo de pesquisa (esqueleto)

| Ramo | Pesquisa | Efeito | Custo inicial (proposta) | Marco |
|---|---|---|---|---|
| Fazenda | Campo 3×3 | Tamanho do campo | 20 feno | M1 |
| Fazenda | Campo 4×4 | Idem | 40 feno | M1 |
| Fazenda | Terra arada | `till()` | 15 feno | M1 |
| Fazenda | Trigo | Planta | 30 feno | M1 |
| Fazenda | Água | `water()`, reservatório | 25 feno | M1 |
| Fazenda | Adubo | `craft`, `fertilize` | 30 feno + 10 madeira | M1 |
| Fazenda | Campo 6×6 | Idem | 80 feno + 20 trigo | M1 |
| Fazenda | Arbusto e Árvore | Plantas | 40 feno + 10 madeira | M1 |
| Fazenda | Milho, Girassol, Morango | Plantas | 60 trigo cada (proposta) | M2 |
| Fazenda | Horizonte contínuo | O mundo dá a volta | 150 trigo | M2 |
| Fazenda | Abóbora, Cacto | Plantas | 100 trigo + 50 madeira | M2 |
| Fazenda | Companheiras | Mecânica | 200 trigo + 100 milho | M2 |
| Drones | Velocidade I a V | −8% de ticks por nível (mín. 40%) | Escala | M1/M2 |
| Drones | Reservatório I a V | Mais água | Escala | M1/M2 |
| Drones | Memória I a III | Capacidade de `memory` | Escala | M2 |
| Drones | Drones 2, 4, 8, 16, 32 | Limite de drones | Escala | M2 |

> **Regra de escala (proposta):** o custo de cada nível de uma mesma trilha cresce entre 1,5× e 2×, e sempre exige **uma planta nova** da época, para empurrar o jogador a diversificar e automatizar.

## 13.3 Consistência do grafo (requisitos que impedem os defeitos atuais)

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-PRO-10 | Todo **recurso** (planta, comando, camada, mecânica, item) tem **exatamente uma origem declarada** no grafo de conteúdo. | O | M1 |
| REQ-PRO-11 | Um **verificador automático** percorre o grafo na compilação do conteúdo e **falha** se houver custo inalcançável, recurso sem origem, ciclo ou item sem uso. | O | M1 |
| REQ-PRO-12 | Uma **simulação de referência** (script de jogador virtual) deve conseguir terminar o jogo principal usando só o que o grafo libera, em tempo dentro da meta (15 a 20 h simuladas). | O | M1 |
| REQ-PRO-13 | Todo upgrade tem **efeito testável** (teste automático que confirma a mudança). Upgrade sem efeito não é publicado. | O | M1 |
| REQ-PRO-14 | Marcos de progressão (fim de ato, novo bioma) são **eventos do grafo**, nunca missões com efeito colateral escondido. | O | M1 |
| REQ-PRO-15 | O progresso **nunca trava**: se o jogador ficar sem recursos para a próxima pesquisa, sempre há como produzi-los (capim em Gramado sempre rende feno). | O | M1 |

## 13.4 Atos e ritmo-alvo

| Ato | Tema | Camadas | Chefe | Marco |
|---|---|---|---|---|
| I | Fundamentos | 1 a 4 | — | M1 |
| II | Repetição e espera | 5 a 7 | Varrer 6×6 com medalha | M1 |
| III | Abstração | 8 | Rotina própria | M1 |
| IV | Dados e planejamento | 9 e 10 | Labirinto | M2 |
| V | Paralelismo | Trilha avançada | Dois drones | M2 |
| VI | Maestria | Todas | Fazenda 32×32 | M2 |

| Marco de jogo | Tempo estimado (proposta) |
|---|---|
| Primeiro script rodando | 1 min |
| Primeira colheita | 5 min |
| Primeiro `if` | 15 min |
| Primeiro `for` | 25 min |
| Fim do Ato I | 1 h |
| Primeira função própria | 2 h |
| Labirinto resolvido | 6 h |
| Segundo drone | 8 h |
| Fim do jogo principal | 15 a 20 h |

---

# 14. Conquistas

## 14.1 Regras

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-CON-01 | Conquistas **celebram aprendizado ou eficiência**; nenhuma exige tarefa repetitiva. | O | M1 |
| REQ-CON-02 | Dão **Selos de Maestria, títulos, molduras e cores**. **Nunca** dão vantagem de poder. | O | M1 |
| REQ-CON-03 | São medidas por **eventos de jogo e análise do código**, não só por contadores. | O | M1 |
| REQ-CON-04 | Cada conquista tem **nome, descrição e dica**. As secretas só mostram a dica. | O | M1 |
| REQ-CON-05 | Há **faixas** (bronze 10, prata 25, ouro 40, diamante todas) com recompensas cosméticas. | D | M2 |

## 14.2 Lista inicial

| Categoria | Conquista | Condição |
|---|---|---|
| Primeiros passos | Olá, fazenda | Primeiro script |
| | Semente | Primeiro plantio |
| | Frutos do trabalho | Primeira colheita |
| | Bateu na parede | Colidir com a borda |
| Código | Decido eu | Primeiro `if` que evita uma perda |
| | Volta e meia | Primeiro `for` |
| | Nome próprio | Primeira função |
| | Reaproveitado | Chamar a mesma função 10 vezes |
| | Lista de compras | Primeira lista |
| | Sem repetir | Reduzir um script em 50% das linhas |
| | Mãos limpas | 10 execuções seguidas sem erro |
| | Debug mestre | 5 missões de reparo |
| Eficiência | Enxuto | Ouro em qualquer missão |
| | Zero desperdício | Um ato inteiro sem colheita imatura |
| | Rota perfeita | Varrer o campo no mínimo de passos |
| | Um tick a menos | Bater o próprio recorde |
| Fazenda | Jardim variado | Todas as espécies do ato plantadas ao mesmo tempo |
| | Casal perfeito | 10 companheiras ativas |
| | Safra de ouro | Colher 100 itens em ponto ótimo |
| | Árvores em xadrez | Plantar 10 árvores sem nenhuma vizinha |
| Minijogos | Saída da sebe | Resolver o labirinto |
| | Cactos em ordem | Ordenar 10 cactos |
| | Abóbora monstro | Fundir abóbora 6×6 |
| Drones | Companhia | Criar o segundo drone |
| | Enxame | 8 drones juntos |
| | Sem trombadas | 10 min sem conflito de ação |
| Secretas | Dança do drone | `spin()` 10 vezes seguidas |
| | Laço eterno | Provocar e conter um laço infinito |
| | Madrugador | Voltar após 8 h fechado |
| | Poeta | Comentário que rima |

---

# 15. Interface, narrador e acessibilidade

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-UX-01 | **Feedback visual** de cada ação (semente cai, item voa ao drone, colisão com borda piscando). | O | M1 |
| REQ-UX-02 | **Layout principal em duas áreas lado a lado**: **editor de código** e **mundo 3D**, com divisor redimensionável. Sob elas, um **painel inferior** com console, erros e ticks, e os controles **Executar, Pausar, Parar e Reiniciar**. O **HUD** (inventário, energia, água, missão ativa e camada de linguagem) fica sobre ou junto da cena. Árvore de pesquisa e mapa de missões são **telas adicionais**, não ocupam a tela principal. | O | M1 |
| REQ-UX-03 | O HUD mostra: ticks, inventário, energia, reservatório, missão ativa e camada de linguagem. | O | M1 |
| REQ-UX-04 | **Árvore de pesquisa** em tela cheia, com requisitos, custos e "por que está bloqueado". | O | M1 |
| REQ-UX-05 | **Mapa de missões** com lições, dicas em 4 níveis, medalhas. | O | M1 |
| REQ-UX-10 | **NÚCLEO** (narrador) com falas em todos os marcos, comentários sobre o código e tom acolhedor. Falas aparecem **uma vez** e podem ser relidas em um diário. | O | M1 |
| REQ-UX-11 | O narrador **nunca humilha** o jogador. Erros são tratados como informação. | O | M1 |
| REQ-UX-20 | **Áudio** (efeitos e música) com controles e opção de silêncio. | D | M2 |
| REQ-UX-30 | **Temas** (claro, floresta, noite), paletas e cores de destaque. | D | M1 |
| REQ-UX-31 | **Veículos** (drone, trator, robô) e cores como cosméticos. | D | M2 |
| REQ-UX-40 | **Acessibilidade**: contraste alto, fontes ajustáveis, navegação por teclado, leitor de tela no editor e nas mensagens, redução de movimento, **não depender só de cor** para estado. | O | M1 |
| REQ-UX-41 | **Glossário**: clicar em um termo abre a explicação. | D | M2 |
| REQ-UX-42 | **Desempenho gráfico** configurável (leve, balanceado, qualidade). | D | M2 |

## 15.2 Direção de arte, câmera e desempenho gráfico

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-ART-01 | **Estilo:** 3D estilizado de **formas geométricas simples** (cubos, cones, cilindros, esferas), com aparência de blocos, **sem voxel puro** e sem low-poly genérico. Cada planta, terreno e máquina deve ser **reconhecível pela silhueta** e pela cor. | O | M1 |
| REQ-ART-02 | **Legibilidade antes de beleza**: o jogador distingue espécie e estágio em um relance, em campo 32×32, e sem depender só de cor (REQ-UX-40). | O | M1 |
| REQ-ART-03 | **Estágios visuais por planta**: broto, crescendo, pronta e **com problema** (sem água, podre, passada do ponto). O renderizador escolhe o modelo a partir do estágio informado pela simulação. | O | M1 |
| REQ-ART-04 | **Câmera** que mostra o campo inteiro como um tabuleiro 3D, com zoom e rotação limitada. Isométrica ortográfica ou perspectiva controlada (decisão em aberto, seção 19.2). | O | M1 |
| REQ-ART-05 | **Produção de modelos:** terreno e grade gerados por código; plantas, drones, árvores e máquinas como **modelos 3D leves** (formato aberto de cena), criados em ferramenta de modelagem, ou gerados por código quando forem formas simples. A escolha é feita **objeto a objeto**. | O | M1 |
| REQ-ART-06 | **Orçamento gráfico:** geometrias e materiais **compartilhados**, **instanciamento** para plantas repetidas, sombras limitadas (sem sombra individual desnecessária), **carregamento sob demanda** de modelos de atos futuros. | O | M1 |
| REQ-ART-07 | **Arte aberta:** os arquivos-fonte dos modelos (não só os exportados) ficam no repositório ou em armazenamento declarado, com licença, para a comunidade poder editar e contribuir. | D | M1 |
| REQ-ART-08 | **Veículos** (drone, trator, robô) seguem o mesmo estilo e a mesma interface visual, trocáveis sem afetar regras. | D | M2 |
| REQ-ART-09 | **Efeitos visuais** (semente caindo, item voando, colisão, água, adubo) são feitos por código e ficam desligáveis em "reduzir movimento" (REQ-UX-40). | O | M1 |

---

# 16. Comunidade, código aberto e escolas

## 16.1 Código aberto e crescimento

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-COM-01 | Licença **MIT** para o código. Conteúdo e arte com licença declarada. | O | M1 |
| REQ-COM-02 | **Jogar sem instalar nem cadastro**, em uma URL, com a primeira execução em ≤ 30 s. | O | M1 |
| REQ-COM-03 | **README** com GIF curto, link para jogar, objetivo em 3 linhas e capturas. | O | M1 |
| REQ-COM-04 | **CONTRIBUTING**, código de conduta, modelos de issue e de PR, e etiquetas de "bom primeiro issue". | O | M1 |
| REQ-COM-05 | **Site de documentação** com referência da API, guia de conteúdo e guia de tradução. | D | M2 |
| REQ-COM-06 | **Compartilhar** script e fazenda por link (REQ-FND-33). | D | M2 |
| REQ-COM-07 | **Níveis da comunidade** (REQ-MIS-25) e galeria. | D | M3 |
| REQ-COM-08 | **Mods de conteúdo** (novas plantas e missões) por pacotes declarativos, sem alterar o motor. | F | M3 |
| REQ-COM-09 | **Integração contínua** com testes do motor, do verificador de grafo e de paridade de idiomas. | O | M1 |
| REQ-COM-10 | **Telemetria** desativada por padrão. Se existir, é opt-in, anônima e documentada. | O | M1 |
| REQ-COM-11 | **Versionamento e registro de mudanças** públicos. | O | M1 |

## 16.2 Escolas (fase 2, não bloqueia o MVP)

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-ESC-01 | **Relatório de progresso exportável** (arquivo) com camadas concluídas, medalhas e tempo, sem servidor. | D | M2 |
| REQ-ESC-02 | **Modo sala**: código de turma por link, sem cadastro individual obrigatório. | F | M3 |
| REQ-ESC-03 | **Painel do professor** (turmas, progresso, dificuldades comuns) com conta opcional. | F | M3 |
| REQ-ESC-04 | **Privacidade por padrão**: nenhum dado pessoal de estudantes é coletado sem consentimento e base legal. Considerar LGPD, e GDPR/COPPA para uso fora do Brasil. | O | M3 |
| REQ-ESC-05 | **Plano de aula** e guia do professor por camada. | D | M3 |
| REQ-ESC-06 | **Alinhamento curricular** (por exemplo, computação na BNCC) documentado. | F | M3 |
| REQ-ESC-07 | Funcionar em **computadores escolares simples** (navegador comum, sem aceleração obrigatória). | O | M2 |

> **Aviso de escopo:** os itens ESC de M3 criam servidores, contas e responsabilidade legal. Só devem entrar depois que o jogo tiver base de usuários. O MVP já serve a escolas pelo relatório exportável.

## 16.3 Originalidade e licenciamento

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| REQ-LEG-01 | Nenhum **nome de entidade, texto, arte, som ou código** de TFWR é reutilizado. As **ideias** de mecânica podem inspirar, mas devem ter identidade própria (nomes, regras detalhadas, narrativa). | O | M1 |
| REQ-LEG-02 | O README declara a inspiração com respeito e link, sem sugerir afiliação. | O | M1 |
| REQ-LEG-03 | Bibliotecas e arte de terceiros têm licença compatível e créditos. | O | M1 |
| REQ-LEG-04 | Antes do M1, é feita uma **revisão de semelhança** com jogos do mesmo gênero (TFWR e outros, como os citados no planejamento: *Autonomica*, *Autonauts*, *Robo Farm*), registrada em documento: o que é inspiração de gênero, o que é nosso, e o que foi evitado. Imagens de outros jogos usadas em planejamento **não entram** no repositório. | O | M1 |

---

# 17. Requisitos não funcionais e critérios de aceitação

| ID | Requisito | Alvo | Prior. | Marco |
|---|---|---|---|---|
| REQ-NFR-01 | **Desempenho**: 60 quadros por segundo em campo 16×16 em computador comum. Campo 32×32 com perda gradual aceitável. | 60 FPS / 30 FPS | O | M1 |
| REQ-NFR-02 | **Simulação**: 100.000 ticks em ≤ 2 s no modo instantâneo (fazenda 16×16). | 2 s | O | M1 |
| REQ-NFR-03 | **Peso da primeira carga**: o **núcleo jogável** (motor, editor, cena do Ato I) em ≤ 3 MB comprimido. Modelos e assets dos demais atos carregam **sob demanda**, em segundo plano. | 3 MB (núcleo) | D | M1 |
| REQ-NFR-04 | **Navegadores**: versões atuais de Chrome, Firefox, Edge, Safari. | — | O | M1 |
| REQ-NFR-05 | **Dispositivos**: desktop completo; tablet usável; celular apenas leitura de lições e revisão. | — | D | M2 |
| REQ-NFR-06 | **Segurança**: nenhum script do jogador acessa o navegador ou a rede. | — | O | M1 |
| REQ-NFR-07 | **Testabilidade**: 100% dos comandos têm teste automático de efeito, custo em ticks e paridade bilíngue. | 100% | O | M1 |
| REQ-NFR-08 | **Perda de dados**: salvamento automático a cada ação importante e ao fechar, com backup do penúltimo save. | — | O | M1 |
| REQ-NFR-09 | **Regressão**: cada missão tem script de referência que passa em CI. | — | O | M1 |

## 17.1 Critérios de aceitação do MVP (M1)

1. Uma pessoa **sem experiência** chega ao primeiro `if` em até 20 min (≥ 8 de 10 em teste).
2. O verificador de grafo **passa** e a simulação de referência termina o conteúdo do MVP.
3. Dois scripts equivalentes, um curto e outro longo, **diferem de forma visível** no medidor de ticks.
4. O mesmo script, com a mesma semente, produz **o mesmo resultado** em qualquer velocidade e em duas máquinas.
5. Não há **nenhum recurso sem origem**, nem custo inalcançável, nem upgrade sem efeito.
6. Todo texto do MVP existe em **pt-BR e en**.
7. É possível **jogar e reiniciar** o dia seguinte com o save intacto e a fazenda coerente.
8. A **simulação roda sem interface** em CI e reproduz o resultado visto na tela (REQ-ARQ-01).
9. Em campo 16×16, o jogo mantém **60 FPS** com instanciamento e modelos compartilhados, e o núcleo carrega dentro do orçamento de peso (REQ-NFR-01 e 03).

---

# 18. Escopo e roteiro

## 18.1 O que entra em cada marco

| M1 (MVP) | M2 (1.0) | M3 (pós) |
|---|---|---|
| Ticks, medidor, determinismo | Companheiras, energia | Pragas, clima, mercado |
| Camadas 1 a 8 | Camadas 9 e 10, trilha avançada | Modo blocos, trechos |
| Gramado, Terra arada, água, adubo | Horizonte contínuo | Terrenos especiais |
| Capim, arbusto, árvore, trigo (+ milho, girassol e morango já definidos) | Abóbora, cacto | Maçã dourada |
| Um drone | Vários drones | Mensagens entre drones |
| Passo a passo, variáveis, sandbox | Replay, comparar, linha do tempo | Níveis da comunidade |
| Missões dos Atos I a III | Atos IV a VI, labirinto | Desafio semanal, ranking |
| Bilíngue, MIT, README, CI | Docs, áudio, PWA | Escolas (sala e painel) |

## 18.2 Ordem recomendada de construção

| Etapa | Entrega | Pronto quando |
|---|---|---|
| 0 | **Protótipo vertical** (ver abaixo) | O protótipo prova que simulação, script e 3D funcionam juntos |
| 1 | **Motor determinístico** (ticks, custo, velocidades, semente), já **separado do renderizador** (REQ-ARQ-01) | Mesmo resultado em qualquer velocidade, e rodando sem interface |
| 2 | **Linguagem e execução** (JS moderno, isolado, análise estrutural, erros bilíngues) | Bloqueio sem falsos positivos |
| 3 | **Fazenda mínima** (grade, drone, capim, trigo, colheita) | Script de 5 linhas planta e colhe |
| 4 | **Ferramentas** (medidor, passo a passo, variáveis, sandbox) | O custo de cada execução é visível |
| 5 | **Grafo de conteúdo e verificador** | Compilação falha em beco sem saída |
| 6 | **Validador de missões** (fazendas de teste, medalhas) | Resposta decorada não passa |
| 7 | **Ensino** (camadas 1 a 5, gatilhos, ajuda em 4 níveis, narrador) | Iniciante chega ao `for` sem ajuda externa |
| 8 | **Água, adubo, reservatório, terra arada, plantas do M1** | Água e adubo mudam o resultado |
| 9 | **Camadas 6 a 8, Atos II e III, desafios de eficiência** | Fim do Ato III |
| 10 | **Bilíngue, acessibilidade, README, CI, licença** | Critérios 6 e 7 da seção 17.1 |
| 11 | **Polimento e teste com iniciantes** | Critério 1 da seção 17.1 |
| 12 | **M2**: companheiras, energia, drones, minijogos, camadas 9 e 10 | Fim do jogo principal |

## 18.2.1 Etapa 0: protótipo vertical

Um recorte pequeno, mas **completo de ponta a ponta**, antes de qualquer conteúdo em volume. **Não se constrói editor de modelos nem biblioteca grande de arte nessa etapa.**

| Item do protótipo | Detalhe |
|---|---|
| Campo | 3×2, com Gramado e Terra arada |
| Personagem | Um drone, com animação de movimento e de trabalho |
| Plantas | Capim e trigo, em broto, crescendo e pronta |
| Câmera | Candidata(s) da decisão de câmera (seção 19.2) |
| Interface | Editor ao lado da cena, console embaixo, Executar, Pausar e Reiniciar |
| Execução | Um script real move o drone, planta e colhe, e o medidor mostra os ticks |
| Motor | Simulação **sem interface**, rodando os mesmos scripts em teste automático |

**Critérios de aceitação do protótipo:**

1. O mesmo script, com a mesma semente, dá **o mesmo estado final** com a interface e sem ela.
2. Em 1×, 16× e instantâneo, o estado final é **idêntico**.
3. Dois scripts equivalentes (curto e longo) mostram **ticks diferentes**.
4. Trocar o modelo do trigo **não exige mudar nenhuma regra**.
5. O protótipo ajuda a **escolher o motor de execução** (decisão 19.2) com medições de custo por operação, isolamento e desempenho.
6. Uma pessoa de fora consegue **rodar o primeiro script** sem explicação.

## 18.3 Riscos

| Risco | Redução |
|---|---|
| Curva íngreme demais | Teste de nível, 4 níveis de ajuda, modo blocos (M3), teste com iniciantes |
| Economia quebrada por ociosidade | Teto offline, simulação de referência |
| Resposta decorada em missões | Várias fazendas de teste e geração parcial aleatória com semente |
| Excesso de sistemas | Núcleo enxuto, expansões só com regra, comando e currículo |
| Execução insegura | Isolamento total, limites de operação e memória |
| Conteúdo em desacordo (como hoje) | Verificador de grafo, upgrades com teste, CI |
| Cópia de TFWR | REQ-LEG-01, revisão de originalidade em cada conteúdo |
| Escopo de escolas inflar o MVP | Relatório exportável em M2, painel só em M3 |
| Manutenção da comunidade | CONTRIBUTING, bons primeiros issues, documentação |
| Produção de arte maior que a equipe | Estilo de formas simples, geração por código quando possível, arte aberta para contribuições, protótipo antes de volume |
| Regras vazando para a camada visual | REQ-ARQ-01 e 02, testes que rodam a simulação sem interface |
| Primeira carga pesada por causa dos modelos | Núcleo leve e assets sob demanda (REQ-NFR-03, REQ-ART-06) |
| Semelhança excessiva com outros jogos do gênero | REQ-LEG-01 e 04 |

---

# 19. Decisões

## 19.1 Decisões tomadas

| Tema | Decisão | Efeito nos requisitos |
|---|---|---|
| Idiomas | Bilíngue (pt-BR e en) desde o início | REQ-FND-40 a 44 |
| Conteúdo | Núcleo enxuto: 2 terrenos e 9 plantas | Seções 6 e 7 |
| Plataforma e licença | Navegador, código aberto, MIT | REQ-COM-01 |
| Escolas | Fase 2: relatório exportável em M2, painel só em M3 | Seção 16.2 |
| Identidade | **Manter "FarmBot Lab" e o narrador "NÚCLEO"** (e o drone DR-0). Antes de divulgar, verificar se o nome "FarmBot" conflita com marcas existentes. | REQ-LEG-01, REQ-UX-10 |
| Ranking | **Só placar local no lançamento.** Ranking online e desafio semanal ficam em M3. | REQ-MIS-21 (O, M1); REQ-MIS-20 e 24 (D, M3) |
| Sustento | **Projeto aberto e gratuito, com doações.** Sem anúncios e sem versão paga. | REQ-COM-12 |
| Dispositivos móveis | **Desktop completo; tablet usável; celular só leitura.** | REQ-NFR-05 |

| ID | Requisito decorrente | Prior. | Marco |
|---|---|---|---|
| REQ-COM-12 | O projeto **não tem anúncios, compras no jogo nem coleta de dados** para monetização. O repositório oferece meios de apoio voluntário (por exemplo, página de patrocínio). | O | M1 |
| REQ-COM-13 | A **verificação de nome e marca** de "FarmBot Lab" é feita antes do lançamento público. | O | M1 |

## 19.2 Decisões ainda em aberto

1. **Nomes finais** de plantas, itens e comandos que possam lembrar demais o jogo de referência (REQ-LEG-01). Revisar cada um antes do M1.
2. **Valores de balanceamento** (ticks, custos, tempos): definir por simulação e teste de jogo.
3. **Motor de execução:** interpretador próprio ou existente. A escolha deve atender ao isolamento, ao determinismo e ao custo por operação (REQ-FND-02, 04 e 14). Vale um protótipo comparativo antes do M1.
4. **Escopo de escolas em M3:** depende de parcerias e do tratamento de dados de estudantes.
5. **Modo blocos:** manter em M3 ou antecipar, caso os testes com iniciantes mostrem barreira na sintaxe.
6. **Câmera:** isométrica ortográfica (como o jogo atual, mais legível e barata) ou perspectiva controlada (mais imersiva). Decidir no protótipo, comparando legibilidade em 32×32.
7. **Produção de arte:** quem cria os modelos, em que ferramenta e com que licença. Define o ritmo do M1 (REQ-ART-05 e 07).
8. **Biblioteca gráfica:** a conversa de planejamento aponta Three.js com modelos em formato aberto de cena. Confirmar no protótipo, junto com o motor de execução.

---

# 20. Anexo: o que sai do jogo atual

| Item do jogo atual | Destino |
|---|---|
| Solos barro, argila, arenoso, turfa, silte, lama | **Removidos** |
| Superfícies "pura" e "arada" | **Removidas** (substituídas por Gramado e Terra arada) |
| Atributos de solo sem efeito (pH, salinidade, temperatura, matéria orgânica) | **Removidos** |
| Upgrades de velocidade de plantio e colheita sem efeito | **Substituídos** por velocidade geral de ticks |
| Contador de turno | **Substituído** por `getTicks()` |
| Cristais | **Removidos**; entram Selos de Maestria |
| Pesquisa como moeda abstrata | **Removida**; custos em produtos e linguagem por prova |
| Árvore "Código" paga em pesquisa | **Substituída** por camadas por prova de domínio |
| `async` e "Maestria" de código sem execução | **Removidos** |
| Trilhas duplicadas de missões | **Unificadas** |
| Mensagens do NÚCLEO presas a identificadores antigos | **Reescritas** no catálogo único |
| Clique em Executar como progresso | **Removido** |
| Regras de plantas sem desbloqueio (milho, árvore, girassol, morango) | **Mantidas com regra e origem** |

---

*Fim do documento.*
