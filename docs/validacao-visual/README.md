# Validação visual da cena 3D (issue #11)

Capturas e logs de console gerados por `scripts/capture.mjs` (`pnpm capture <marco> docs/validacao-visual`, com `pnpm dev` rodando). São o registro do que foi visto no navegador em cada marco. Para refazer, rode o script de novo.

**Ambiente:** Microsoft Edge 157 (Chromium) sem interface, Windows 11, Ryzen 5 5600. O Edge desenhou com **renderização por software (SwiftShader)**, sem placa de vídeo, então os tempos de quadro abaixo são pessimistas em relação a um computador com GPU. Firefox e Safari não foram testados.

## Marco 1: estrutura

| Captura | O que mostra |
| --- | --- |
| `marco-1-campo-3x2.png` | Campo 3×2: seis casas em duas tonalidades (tabuleiro) e o drone na casa (0,0) |
| `marco-1-campo-16x16-vazio.png` | Campo 16×16 inteiro na tela |
| `marco-1-campo-16x16-1500-ticks.png` | 16×16 com 89 plantas, solo arado (marrom) alternado com gramado |

## Marco 2: integração (script de exemplo no 3×2)

Sequência em `marco-2-tick-*.png`: o drone planta uma fileira de capim (broto), o capim cresce (crescendo, pronto), o drone colhe de volta pela fileira, ara o solo, planta trigo e capim, espera o trigo amadurecer e o colhe. O capim aparece como cones verdes e o trigo como hastes douradas com espigas, distintos em cada estágio. O anel azul no chão marca a casa do drone.

- O hash do estado final é idêntico nos três ritmos, medido **no navegador**: 1×, 16× e instantâneo (`[hash por velocidade]` em `console-marco-2.log`).
- Não houve nenhum erro, aviso ou falha de rede no console.

## Marco 3: escala (32×32)

| Medida | Resultado |
| --- | --- |
| Plantas na tela | 951 |
| Chamadas de desenho por quadro | 964 |
| Triângulos por quadro | cerca de 111 mil |
| Custo de ler o estado do motor e sincronizar a cena inteira | cerca de 1,2 ms |
| Quadros a 16× em tempo real (renderização por software) | média 19,9 ms (50 fps), 95% abaixo de 26,7 ms, pior 26,8 ms |

Legibilidade: as casas, o solo arado e as plantas seguem distinguíveis. O drone sozinho virava um pontinho, então ele cresce com o tamanho do campo e tem um anel azul no chão.

## Problemas achados durante a validação, e o que foi feito

1. **O crescimento das plantas não aparecia.** Um `wait(500)` fazia o relógio do motor pular 500 ticks de uma vez, e as plantas surgiam já prontas. Corrigido no motor: `step` cobra o custo de uma ação aos poucos e só aplica o efeito no fim, então o motor anda exatamente o que a tela pede.
2. **Enquadramento:** no 16×16, a borda de baixo do campo saía da tela. A câmera provisória agora projeta os cantos do campo para enquadrá-lo inteiro.
3. **Trigo fino demais e escondido pelo drone** enquanto ele esperava em cima. Hastes mais grossas e drone menor.
4. **Drone invisível no 32×32.** Escala com o campo e anel no chão.
5. **Erro 404 no console** (ícone da página). Resolvido com um ícone vazio. Na primeira carga depois de mudar arquivos, o Vite pode recarregar a página e abortar uma requisição; não é erro do jogo.

## Fora do que foi validado

A câmera é provisória (decisão nos tickets #13 e #14). Não há editor nem controles de velocidade (ticket #12): a página recebe tudo pelo endereço. Não foi medido em GPU real, nem em outros navegadores. A poeira da colheita e o tremor do drone ao bater são curtos e só estão cobertos por testes, não por captura.
