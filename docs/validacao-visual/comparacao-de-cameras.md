# Comparação das duas câmeras (issue #13)

Material para a decisão do ticket #14 e para o teste do #15. **Este documento não escolhe uma câmera.** Ele reúne o que cada uma mostrou, com as capturas e as medidas, e diz o que não foi medido.

As capturas são `marco-5-*.png` nesta pasta (`pnpm capture 5 docs/validacao-visual`, com `pnpm dev` rodando). O log, com todas as medidas citadas aqui, é `console-marco-5.log`. O que não vem do log nem de uma captura citada está marcado como **leitura das imagens** e pode ser contestado.

## Como a comparação foi montada

- **Mesmo mundo, mesma referência:** as duas câmeras abrem olhando o campo **pelo sul, com a mesma elevação (50°)**. O norte fica ao fundo da tela e o leste à direita nas duas, e o drone aparece na mesma casa em ambas. O que muda é só a **projeção** e os **controles**.
- **Ângulo da isométrica:** para ver a diagonal clássica (45° e 35,3°), abra a página com `?isoyaw=45&isopitch=35.26`. Ela não foi o padrão para não mudar a referência espacial entre as câmeras, e não tem captura. O ângulo da isométrica é uma decisão do #14 se ela for mantida.
- **Controles:** perspectiva: botão esquerdo gira, botão direito move, roda dá zoom. Isométrica: só a roda (zoom). **C** alterna a câmera e **F** liga e desliga o seguir o drone, só quando o foco não está no editor, e não com a tecla segurada.
- **Zoom 1** mostra o campo inteiro; **zoom 5** mostra cerca de um quinto da largura. A câmera nunca vai tão perto da borda que a imagem mostre o que está fora do campo, até onde a projeção permite (na perspectiva, a parte próxima da imagem é mais larga e ainda deixa ver uma nesga de céu: `marco-5-32x32-zoom5-segue-persp.png`).
- **Seguir o drone:** a câmera aproxima-se do drone aos poucos, sem saltar. Com o campo inteiro na tela (zoom 1) não tem efeito.
- **Drone sobre a planta:** fica semitransparente enquanto está sobre uma planta, e o anel azul no chão continua opaco.
- **Modo de estresse (`?stress=1`):** campo 32×32 com plantas falsas, **só desenhadas pela cena**: capim e trigo em xadrez, e os três estágios em fileiras. Elas **não fazem parte da fazenda simulada**: o motor nunca as vê, e Executar, Reiniciar ou `autorun` as removem. O contador de quadros por segundo aparece só nesse modo, com a média e o pior quadro dos últimos 4 segundos.

## Evidências lado a lado

| O que olhar | Perspectiva | Isométrica |
| --- | --- | --- |
| 32×32 inteiro | `marco-5-32x32-zoom1-persp.png` | `marco-5-32x32-zoom1-iso.png` |
| 32×32 em zoom 5, sem seguir | `marco-5-32x32-zoom5-sem-seguir-persp.png` | `marco-5-32x32-zoom5-sem-seguir-iso.png` |
| 32×32 em zoom 5, seguindo o drone | `marco-5-32x32-zoom5-segue-persp.png` | `marco-5-32x32-zoom5-segue-iso.png` |
| 16×16 inteiro | `marco-5-16x16-zoom1-persp.png` | `marco-5-16x16-zoom1-iso.png` |
| 16×16 em zoom 4, seguindo | `marco-5-16x16-zoom4-segue-persp.png` | `marco-5-16x16-zoom4-segue-iso.png` |
| 3×2 inteiro, trigo pronto | `marco-5-3x2-zoom1-persp.png` | `marco-5-3x2-zoom1-iso.png` |
| 3×2 em zoom 3: drone sobre o trigo | `marco-5-3x2-zoom3-segue-persp.png` | `marco-5-3x2-zoom3-segue-iso.png` |
| Estresse 32×32 inteiro (2 espécies × 3 estágios) | `marco-5-estresse-zoom1-persp.png` | `marco-5-estresse-zoom1-iso.png` |
| Estresse em zoom 5 | `marco-5-estresse-zoom5-persp.png` | `marco-5-estresse-zoom5-iso.png` |
| Perspectiva girada e movida com o mouse | `marco-5-mouse-persp-girada-e-movida.png` | (a isométrica não gira nem move) |

## Medidas do modo de estresse

Renderização **por software** (SwiftShader), sem placa de vídeo, no Edge sem interface, com o campo inteiro na tela (zoom 1). Os números são pessimistas em relação a um computador com GPU. Fonte: `console-marco-5.log`, linhas `[fps estresse]`.

| Câmera | Quadros por segundo (média de 4 s) | Pior quadro | Chamadas de desenho | Triângulos |
| --- | --- | --- | --- | --- |
| Perspectiva | 20,9 | 66,7 ms | 1037 | 219.532 |
| Isométrica | 20,1 | 59,9 ms | 1037 | 219.532 |

As duas câmeras desenham as mesmas 1024 plantas, com as mesmas chamadas e triângulos, e ficaram com valores próximos. Como a medida foi uma só por câmera, a diferença de cerca de 0,8 quadro por segundo **não deve ser lida como diferença de desempenho**. Para comparar com o jogo real em 32×32 (varredor com cerca de 951 plantas), veja `console-marco-3.log`, linha `[quadros a 16x]`: o estresse tem o dobro de triângulos, porque todas as casas estão plantadas.

## Observações por aspecto

Cada linha diz o que se viu, sem somar pontos. A coluna de fonte diz onde olhar.

| Aspecto | Perspectiva | Isométrica | Fonte |
| --- | --- | --- | --- |
| Legibilidade das plantas, campo 32×32 inteiro | As plantas das fileiras da frente são maiores que as do fundo. As do fundo ficam pequenas | Todas as plantas têm o mesmo tamanho, na frente e no fundo | leitura das imagens: `32x32-zoom1` |
| Legibilidade dos três estágios em zoom 5 | Capim e trigo e os três estágios se reconhecem | Também se reconhecem | leitura das imagens: `estresse-zoom5` |
| Largura do campo 32×32 inteiro na tela | cerca de 550 px na borda de baixo | cerca de 470 px, igual em toda a altura | medido nas capturas `32x32-zoom1` |
| Visibilidade do drone e da casa com o campo inteiro | O drone fica pequeno nas duas câmeras; o anel azul é o que o localiza | o mesmo | leitura das imagens: `32x32-zoom1` |
| Drone sobre a planta (3×2, zoom 3) | O drone translúcido deixa ver o trigo; dá para olhar por outro ângulo girando | O drone translúcido deixa ver o trigo; o ângulo é fixo | leitura das imagens: `3x2-zoom3-segue` |
| Orientação | Norte ao fundo e leste à direita; depois de girar, a orientação muda | Fixa: norte ao fundo e leste à direita | `[camera]` e `[mouse]` no log |
| O que se controla | Zoom, girar e mover | Zoom | `[mouse perspectiva]` e `[mouse isometrica]` no log |
| Seguir o drone, zoom 5 | O alvo parou em (12,8; −3,5), no limite de 16×(1−1/5); sobra uma nesga de céu à direita | O alvo é o mesmo; a borda do campo fica no limite da imagem | `[camera]` no log e `32x32-zoom5-segue` |

## O que não foi medido

- Desempenho com placa de vídeo real, e em outros navegadores.
- O estresse **em movimento**: o estresse é um campo parado com plantas falsas. O desempenho com o varredor real em 32×32 está no marco 3.
- Se seguir o drone ajuda ou atrapalha **quando ele se move rápido** (16× e instantâneo): as capturas de seguir foram feitas com a simulação pausada.
- Girar a perspectiva pode deixar parte do campo fora da tela: o enquadramento é calculado só para o ângulo inicial. Não há botão para voltar à orientação inicial, e não há captura disso.
- Uma pessoa de fora usando cada câmera: é o teste do #15.
- A isométrica clássica de 45°: só disponível pelo endereço.
- Em campo pequeno (3×2), o zoom máximo deixa as plantas enormes e mostra menos de uma casa (`3x2-zoom3-segue`).

## Decisões que ficam para o #14

1. Qual câmera é a padrão, e se a outra continua como opção ou sai.
2. O ângulo da isométrica (a mesma referência da perspectiva, ou o 45° clássico).
3. Se a perspectiva precisa de um botão para voltar à orientação inicial.
4. Se o seguir o drone deve começar ligado, e como se comporta com o drone rápido.
5. O limite de zoom em campos pequenos.
