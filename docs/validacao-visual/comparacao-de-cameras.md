# Comparação das duas câmeras (issue #13)

> **Registro histórico.** A isométrica de 35,26°, os parâmetros `?isoyaw` e `?isopitch` e o marco 6 (`pnpm capture 6`) citados abaixo foram removidos pelo ADR 0003 (`docs/adr/0003-camera-isometrica-50-como-padrao.md`), que adota a isométrica de 50° como padrão. O restante do documento e as capturas ficam como estavam.

Material para a decisão do ticket #14 e para o teste do #15. **Este documento não escolhe uma câmera.** Ele reúne o que cada uma mostrou, com as capturas e as medidas, e diz o que não foi medido.

### Fontes: o que está no repositório e o que é local

- **Versionado (está no repositório):** as capturas `marco-5-*.png` nesta pasta (as de 50° e as `iso35-26`), o código, os testes, o script `scripts/capture.mjs` e este documento.
- **Arquivo local, não versionado:** `console-marco-5.log` e `console-marco-6.log`. Ficam ignorados pelo `.gitignore` (`*.log`) e só existem na máquina onde a captura rodou.
- **Atribuição das medidas:** os quadros por segundo, as chamadas de desenho, os triângulos, o alvo da câmera, os ângulos do mouse, os hashes e os ticks citados abaixo vêm desses logs locais. Quem lê só o repositório **não consegue conferi-los**: precisa reproduzi-los com `pnpm dev` rodando e, em outro terminal, `pnpm capture 5 docs/validacao-visual` (câmeras, estresse, mouse) e `pnpm capture 6 docs/validacao-visual` (isométrica 35,26°). Os números podem variar um pouco entre execuções.
- O que não vem de um log nem de uma captura citada está marcado como **leitura das imagens** e pode ser contestado.

## Como a comparação foi montada

- **Mesmo mundo, mesma referência:** as duas câmeras abrem olhando o campo **pelo sul, com a mesma elevação (50°)**. O norte fica ao fundo da tela e o leste à direita nas duas, e o drone aparece na mesma casa em ambas. O que muda é só a **projeção** e os **controles**.
- **Dois ângulos da isométrica, identificados em todo o documento:**
  - **Isométrica 50° (padrão atual):** giro 0° (olha pelo sul) e elevação 50°, igual à perspectiva. Todas as capturas `marco-5-*-iso.png` e todas as colunas "Isométrica 50°" são dela.
  - **Isométrica 35,26° (configuração alternativa de teste, não é o padrão):** giro 45° e elevação 35,26°, a diagonal clássica, aberta com `?isoyaw=45&isopitch=35.26`. Tem quatro capturas, `marco-5-*-iso35-26.png`, geradas com `pnpm capture 6 docs/validacao-visual`. Como o giro é de 45°, o norte deixa de ficar ao fundo da tela: a referência espacial **não** é a das outras câmeras.
  - O ângulo da isométrica é uma decisão do #14 se ela for mantida.
- **Controles:** perspectiva: botão esquerdo gira, botão direito move, roda dá zoom. Isométrica: só a roda (zoom). **C** alterna a câmera e **F** liga e desliga o seguir o drone, só quando o foco não está no editor, e não com a tecla segurada.
- **Zoom 1** mostra o campo inteiro; **zoom 5** mostra cerca de um quinto da largura. A câmera nunca vai tão perto da borda que a imagem mostre o que está fora do campo, até onde a projeção permite (na perspectiva, a parte próxima da imagem é mais larga e ainda deixa ver uma nesga de céu: `marco-5-32x32-zoom5-segue-persp.png`).
- **Seguir o drone:** a câmera aproxima-se do drone aos poucos, sem saltar. Com o campo inteiro na tela (zoom 1) não tem efeito.
- **Drone sobre a planta:** fica semitransparente enquanto está sobre uma planta, e o anel azul no chão continua opaco.
- **Modo de estresse (`?stress=1`):** campo 32×32 com plantas falsas, **só desenhadas pela cena**: capim e trigo em xadrez, e os três estágios em fileiras. Elas **não fazem parte da fazenda simulada**: o motor nunca as vê, e Executar, Reiniciar ou `autorun` as removem. O contador de quadros por segundo aparece só nesse modo, com a média e o pior quadro dos últimos 4 segundos.

## Evidências lado a lado

| O que olhar | Perspectiva (50°) | Isométrica 50° (padrão) | Isométrica 35,26° (alternativa de teste) |
| --- | --- | --- | --- |
| 32×32 inteiro | `marco-5-32x32-zoom1-persp.png` | `marco-5-32x32-zoom1-iso.png` | `marco-5-32x32-zoom1-iso35-26.png` |
| 32×32 em zoom 5, sem seguir | `marco-5-32x32-zoom5-sem-seguir-persp.png` | `marco-5-32x32-zoom5-sem-seguir-iso.png` | (sem captura) |
| 32×32 em zoom 5, seguindo o drone | `marco-5-32x32-zoom5-segue-persp.png` | `marco-5-32x32-zoom5-segue-iso.png` | `marco-5-32x32-zoom5-segue-iso35-26.png` |
| 16×16 inteiro | `marco-5-16x16-zoom1-persp.png` | `marco-5-16x16-zoom1-iso.png` | (sem captura) |
| 16×16 em zoom 4, seguindo | `marco-5-16x16-zoom4-segue-persp.png` | `marco-5-16x16-zoom4-segue-iso.png` | (sem captura) |
| 3×2 inteiro, trigo pronto | `marco-5-3x2-zoom1-persp.png` | `marco-5-3x2-zoom1-iso.png` | `marco-5-3x2-zoom1-iso35-26.png` |
| 3×2 em zoom 3: drone sobre o trigo | `marco-5-3x2-zoom3-segue-persp.png` | `marco-5-3x2-zoom3-segue-iso.png` | `marco-5-3x2-zoom3-segue-iso35-26.png` |
| Estresse 32×32 inteiro (2 espécies × 3 estágios) | `marco-5-estresse-zoom1-persp.png` | `marco-5-estresse-zoom1-iso.png` | (sem captura) |
| Estresse em zoom 5 | `marco-5-estresse-zoom5-persp.png` | `marco-5-estresse-zoom5-iso.png` | (sem captura) |
| Perspectiva girada e movida com o mouse | `marco-5-mouse-persp-girada-e-movida.png` | (a isométrica não gira nem move) | (idem) |

As capturas em 35,26° são do mesmo conteúdo (mesmos ticks, mesmo drone) e o log delas é `console-marco-6.log` (arquivo local, não versionado). Elas **permitem ver a aparência** nesse ângulo; **não substituem** uma avaliação de uso.

## Medidas do modo de estresse

Renderização **por software** (SwiftShader), sem placa de vídeo, no Edge sem interface, com o campo inteiro na tela (zoom 1). Os números são pessimistas em relação a um computador com GPU. Fonte: `console-marco-5.log`, linhas `[fps estresse]`.

| Câmera | Quadros por segundo (média de 4 s) | Pior quadro | Chamadas de desenho | Triângulos |
| --- | --- | --- | --- | --- |
| Perspectiva | 20,9 | 66,7 ms | 1037 | 219.532 |
| Isométrica | 20,1 | 59,9 ms | 1037 | 219.532 |

As duas câmeras desenham as mesmas 1024 plantas, com as mesmas chamadas e triângulos, e ficaram com valores próximos. Como a medida foi uma só por câmera, a diferença de cerca de 0,8 quadro por segundo **não deve ser lida como diferença de desempenho**. Para comparar com o jogo real em 32×32 (varredor com cerca de 951 plantas), veja `console-marco-3.log`, linha `[quadros a 16x]`: o estresse tem o dobro de triângulos, porque todas as casas estão plantadas.

## Observações por aspecto

Cada linha diz o que se viu, sem somar pontos. A coluna de fonte diz onde olhar.

A coluna "Isométrica" desta tabela é a **de 50° (padrão)**. O 35,26° não entrou aqui: ele tem a seção "Aparência da isométrica 35,26°", abaixo.

| Aspecto | Perspectiva | Isométrica 50° | Fonte |
| --- | --- | --- | --- |
| Legibilidade das plantas, campo 32×32 inteiro | As plantas das fileiras da frente são maiores que as do fundo. As do fundo ficam pequenas | Todas as plantas têm o mesmo tamanho, na frente e no fundo | leitura das imagens: `32x32-zoom1` |
| Legibilidade dos três estágios em zoom 5 | Capim e trigo e os três estágios se reconhecem | Também se reconhecem | leitura das imagens: `estresse-zoom5` |
| Largura do campo 32×32 inteiro na tela | cerca de 550 px na borda de baixo | cerca de 470 px, igual em toda a altura | medido nas capturas `32x32-zoom1` |
| Visibilidade do drone e da casa com o campo inteiro | O drone fica pequeno nas duas câmeras; o anel azul é o que o localiza | o mesmo | leitura das imagens: `32x32-zoom1` |
| Drone sobre a planta (3×2, zoom 3) | O drone translúcido deixa ver o trigo; dá para olhar por outro ângulo girando | O drone translúcido deixa ver o trigo; o ângulo é fixo | leitura das imagens: `3x2-zoom3-segue` |
| Orientação | Norte ao fundo e leste à direita; depois de girar, a orientação muda | Fixa: norte ao fundo e leste à direita | `[camera]` e `[mouse]` no log |
| O que se controla | Zoom, girar e mover | Zoom | `[mouse perspectiva]` e `[mouse isometrica]` no log |
| Seguir o drone, zoom 5 | O alvo parou em (12,8; −3,5), no limite de 16×(1−1/5); sobra uma nesga de céu à direita | O alvo é o mesmo; a borda do campo fica no limite da imagem | `[camera]` no log e `32x32-zoom5-segue` |

## Aparência da isométrica 35,26° (configuração alternativa de teste)

Tudo aqui é **leitura das imagens** `marco-5-*-iso35-26.png`, e pode ser contestado. O ângulo foi aplicado: o campo aparece em diagonal, com o losango de ponta a ponta.

**Cobertura:** estas observações valem **só para os quatro cenários capturados** (3×2 em zoom 1 e zoom 3 seguindo; 32×32 em zoom 1 e zoom 5 seguindo). Não se estendem ao 16×16, ao modo de estresse, ao zoom 5 sem seguir nem a outros tamanhos de campo.

**Referência espacial:** o giro de 45° muda a posição visual do norte e do leste. As outras configurações comparadas (perspectiva e isométrica 50°) preservam a referência combinada, com o norte ao fundo e o leste à direita. A isométrica 35,26° não preserva.

- **32×32 inteiro:** o campo vira um losango que ocupa cerca de 570 px de largura, com a mesma escala em toda a altura. Os cantos do campo ficam nos quatro pontos do losango. As fileiras de solo arado correm na diagonal.
- **32×32 em zoom 5, seguindo:** o alvo parou em (12,8; −3,5), o mesmo da isométrica 50°. Na captura, o drone (translúcido, com o anel azul) fica perto do canto inferior direito e aparece uma faixa de céu além da borda do campo; as fileiras de plantas se leem na diagonal.
- **3×2 em zoom 3:** o trigo aparece de lado e o drone translúcido deixa vê-lo; o painel de botões da câmera cobre parte do canto superior esquerdo da cena, onde estão a nuvem do drone e as espigas mais altas.
- **Orientação:** com giro de 45°, norte e leste ficam nas diagonais da tela, não mais ao fundo e à direita. As outras duas câmeras e o texto da ajuda não foram feitos para esse referencial.
- **Problemas visuais reais, ambos nas capturas acima:** o painel de botões da câmera cobre o drone e as espigas no 3×2 em zoom 3, e há uma faixa de céu além da borda do campo no 32×32 em zoom 5.

## Ressalvas

**Medições (têm fonte no log):**
- Os 20,9 e 20,1 quadros por segundo são **uma só medição por câmera**, em renderização por software (SwiftShader), com o campo parado e o campo inteiro na tela. Não permitem declarar vantagem de desempenho, nem servem de previsão para uma placa de vídeo real.
- Chamadas de desenho e triângulos são iguais nas duas câmeras (1037 e 219.532).
- O estresse **não** foi medido com a câmera nos 35,26°.

**Observações visuais (leitura das imagens, contestáveis):**
- Tamanho das plantas, visibilidade do drone, largura do campo e o aspecto dos três estágios nas capturas listadas.
- A aparência da isométrica 35,26° (seção acima): configuração alternativa de teste, **não é o padrão atual**. As capturas permitem avaliar como ela se vê, mas **não substituem uma avaliação de uso**.

**Limitações ainda não avaliadas:**
- Seguir o drone **com movimento rápido** (16× e instantâneo): as capturas foram feitas com a simulação pausada. É um ponto a considerar antes de decidir a câmera.
- Perspectiva **girada**: pode deixar parte do campo fora da tela (o enquadramento é calculado só para o ângulo inicial) e não há retorno rápido à orientação inicial. É uma limitação relevante da câmera, não só um detalhe de implementação.
- Uso por uma pessoa de fora (o teste do #15), GPU real e outros navegadores.

## O que não foi medido

- Desempenho com placa de vídeo real, e em outros navegadores.
- O estresse **em movimento**: o estresse é um campo parado com plantas falsas. O desempenho com o varredor real em 32×32 está no marco 3.
- Se seguir o drone ajuda ou atrapalha **quando ele se move rápido** (16× e instantâneo): as capturas de seguir foram feitas com a simulação pausada.
- Girar a perspectiva pode deixar parte do campo fora da tela: o enquadramento é calculado só para o ângulo inicial. Não há botão para voltar à orientação inicial, e não há captura disso.
- Uma pessoa de fora usando cada câmera: é o teste do #15.
- Disponibilidade na interface: a isométrica clássica (giro de 45° e elevação de 35,26°) não tem controle na interface; só pode ser ativada pelo endereço. Sua aparência foi registrada nos quatro cenários listados acima, mas não houve teste de uso por uma pessoa.
- Em campo pequeno (3×2), o zoom máximo deixa as plantas enormes e mostra menos de uma casa (`3x2-zoom3-segue`).

## Decisões que ficam para o #14

1. Qual câmera é a padrão, e se a outra continua como opção ou sai.
2. O ângulo da isométrica (a mesma referência da perspectiva, ou o 45° clássico).
3. Se a perspectiva precisa de um botão para voltar à orientação inicial.
4. Se o seguir o drone deve começar ligado, e como se comporta com o drone rápido.
5. O limite de zoom em campos pequenos.
