# Comparação das duas câmeras (issue #13)

Material para a decisão do ticket #14 e para o teste do #15. **Este documento não escolhe uma câmera.** Ele reúne o que cada uma faz, com as capturas e as medidas, e diz o que ainda não foi medido.

As capturas são `marco-5-*.png` nesta pasta (`pnpm capture 5 docs/validacao-visual`, com `pnpm dev` rodando). O log completo, com as medidas, é `console-marco-5.log`.

## Como a comparação foi montada

- **Mesmo mundo, mesma referência:** as duas câmeras abrem olhando o campo **pelo sul, com a mesma elevação (50°)**. O norte fica ao fundo da tela e o leste à direita nas duas, e o drone aparece na mesma casa em ambas. O que muda é só a **projeção** e os **controles**.
- **Isométrica clássica:** para ver a visão em diagonal (45° e 35,3°), abra a página com `?isoyaw=45&isopitch=35.26`. Foi deixada de fora do padrão para não mudar a referência espacial entre as câmeras. Se a isométrica for a escolhida, esse ângulo é uma decisão a tomar no #14.
- **Controles:** perspectiva: botão esquerdo gira, botão direito move, roda dá zoom. Isométrica: só a roda (zoom). **C** alterna a câmera e **F** liga e desliga o seguir o drone, só quando o foco não está no editor.
- **Zoom 1** mostra o campo inteiro; **zoom 5** mostra uma fatia. A câmera nunca se afasta do meio mais do que o necessário para a vista ficar dentro do campo.
- **Seguir o drone:** a câmera acompanha o drone de forma suave (aproxima-se aos poucos, nunca salta). Com o campo inteiro na tela (zoom 1) não tem efeito, para o campo não sair da tela.
- **Drone sobre a planta:** o drone fica semitransparente quando está sobre uma planta, e o anel azul no chão continua opaco.
- **Modo de estresse (`?stress=1`):** campo 32×32 com plantas falsas, **só desenhadas pela cena**: capim e trigo em xadrez, e os três estágios em fileiras. Elas **não fazem parte da fazenda**: o motor nunca as vê, e executar um script as remove. O contador de quadros por segundo aparece só nesse modo, com a média e o pior quadro dos últimos 4 segundos.

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

## O que cada câmera mostrou

Observações das capturas e do log. Onde há medida, ela vem do log; o resto é leitura das imagens e pode ser contestado.

### Perspectiva

**Vantagens observadas**
- Dá noção de profundidade: o campo parece um chão, as plantas em primeiro plano são maiores e se distinguem melhor (no 32×32 em zoom 5, grama e trigo e os três estágios se reconhecem bem).
- Gira e se desloca, então dá para olhar a casa do drone por outro lado, e o drone que encobre a planta pode ser contornado.
- A visão próxima do trigo e do capim ficou a mais "natural" nas capturas de 3×2 e 32×32 em zoom.

**Limitações observadas**
- Com o campo 32×32 inteiro, as plantas do fundo ficam bem menores que as da frente: as fileiras mais distantes são as mais difíceis de ler.
- A escala varia pela tela, então comparar duas casas distantes "a olho" é menos confiável.
- Mais controles para aprender (girar, mover, zoom), e girar muda a referência de orientação (norte deixa de ficar ao fundo).

### Isométrica (ortográfica)

**Vantagens observadas**
- A escala é a mesma em toda a tela: cada casa tem o mesmo tamanho, no fundo e na frente. No 32×32 inteiro as plantas das fileiras de trás se leem tão bem quanto as da frente.
- A orientação fica fixa e simples: só a roda de zoom, nada a aprender.
- Quadriculado regular, bom para contar casas e para ver o padrão do campo.

**Limitações observadas**
- Sem perspectiva a imagem é mais "achatada": o campo inteiro ocupa uma área menor da tela do que na perspectiva (nas capturas de 32×32 inteiro, cerca de 470 px de largura contra 550 px).
- Sem girar nem mover, não se contorna uma planta escondida (só o seguir o drone e o zoom ajudam).
- A isométrica de 45° (clássica) muda a referência do norte e não foi o padrão desta comparação.

## Medidas do modo de estresse

Renderização **por software** (SwiftShader), sem placa de vídeo, no Edge sem interface. Os números são pessimistas em relação a um computador com GPU.

| Câmera | Quadros por segundo (média de 4 s) | Pior quadro | Chamadas de desenho | Triângulos |
| --- | --- | --- | --- | --- |
| Perspectiva | 21,6 | 66,7 ms | 1037 | 219.532 |
| Isométrica | 20,2 | 66,7 ms | 1037 | 219.532 |

A diferença de desempenho entre as câmeras é pequena, e as duas rodam no limite do que o desenho por software aguenta: o custo está no desenho das 1024 plantas (cerca de 220 mil triângulos), igual nas duas. Com zoom 5 o desempenho sobe (cerca de 33 quadros por segundo na perspectiva numa execução anterior), porque muitas plantas saem da tela. Um campo com todas as 1024 casas plantadas em estágio pronto tem o dobro de triângulos do varredor real de 32×32, que a 16× rodou a cerca de 50 quadros por segundo.

## Respostas às perguntas do responsável

- **Legibilidade das plantas nos três estágios:** nas duas câmeras os três estágios se distinguem em zoom 5 e na visão próxima. Com o 32×32 inteiro, nenhuma das duas deixa ver o formato de cada planta; a isométrica mantém todas do mesmo tamanho, e a perspectiva deixa as do fundo bem menores.
- **Visibilidade do drone e da casa ocupada:** o anel azul marca a casa nas duas câmeras e o drone semitransparente deixa a planta aparecer. Com o campo inteiro no 32×32 o drone é pequeno nas duas; o anel é o que ajuda a achá-lo.
- **Orientação do campo:** nas duas, norte ao fundo e leste à direita. Na perspectiva, depois de girar, a orientação muda, e não há botão para voltar ao padrão ainda.
- **Quanto do campo cabe:** o zoom 1 mostra o campo todo nas duas; a isométrica o mostra menor na tela. Em zoom 5 aparece cerca de um quinto da largura do campo.
- **Seguir o drone:** ajuda a ver o que o drone faz de perto sem mexer na câmera, e não atrapalha no zoom 1. Perto da borda a câmera para antes de mostrar o que está fora do campo (na isométrica a borda fica no limite da imagem; na perspectiva, por causa da perspectiva, ainda sobra uma nesga de céu). Em zoom alto o acompanhamento é suave; o que não foi avaliado é como ele se comporta com o drone se movendo rápido em 16× ou instantâneo.

## O que não foi medido

- Desempenho com placa de vídeo real, e em outros navegadores.
- O estresse em movimento (o drone andando pelo campo cheio): o estresse é uma foto parada com plantas falsas; o desempenho com o varredor real em 32×32 está no marco 3.
- Uma pessoa de fora usando cada câmera: é o teste do #15.
- A isométrica clássica de 45°: só disponível pelo endereço, sem captura.

## Decisões que ficam para o #14

1. Qual câmera é a padrão, e se a outra continua como opção ou sai.
2. O ângulo da isométrica (a mesma referência da perspectiva, ou o 45° clássico).
3. Se a perspectiva precisa de um botão para voltar à orientação inicial.
4. Se o seguir o drone deve começar ligado.
