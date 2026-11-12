---
status: accepted
---

# Câmera isométrica de 50° como padrão, com a perspectiva como alternativa

O jogo abre com a câmera **isométrica de 50°** (ortográfica, olhando o campo pelo sul). A câmera **perspectiva** continua disponível como alternativa, alternada pela tecla **C** ou pelo botão. A configuração isométrica de **35,26°** (giro de 45°) é **removida do código**.

A decisão é humana (ticket #14) e foi tomada com a comparação de `docs/validacao-visual/comparacao-de-cameras.md` à vista. Este ADR registra o que foi decidido, o que se viu e o que ficou sem ser avaliado. Ele **não** se apoia nos quadros por segundo.

## Decisão

1. **Isométrica 50° é a câmera padrão.** Giro 0° (olha pelo sul), elevação 50°, ortográfica, só zoom pela roda.
2. **Perspectiva é a alternativa**, alternada com **C** (ou pelo botão), sem reiniciar nem avançar a simulação. Mantém giro (botão esquerdo), mover (botão direito) e zoom.
3. **Seguir o drone fica desligado por padrão**, ligado e desligado com **F** (ou pelo botão).
4. **A perspectiva ganha um botão para restaurar a orientação inicial** (a limitação registrada na comparação: girar pode deixar parte do campo fora da tela e não havia retorno rápido).
5. **A isométrica de 35,26° sai do código por completo:** os parâmetros `?isoyaw` e `?isopitch` e todos os caminhos de configuração do ângulo. As capturas `marco-5-*-iso35-26.png` e a comparação histórica ficam preservadas.

## Contexto

O ticket #14 pede para escolher entre as duas câmeras do #13 e registrar a escolha. O critério do ticket falava em "legibilidade e quadros por segundo". Os quadros por segundo **não entram** na decisão: foi uma só medição por câmera, em renderização por software (SwiftShader), com o campo parado, e os dois valores ficaram próximos (20,9 e 20,1). A comparação já avisa que isso não permite declarar vantagem de desempenho.

O jogo ensina a programar um drone numa grade: o que importa ao jogador é entender onde o drone está, para onde andou e o que cada comando fez. A decisão pesa a **referência espacial estável** acima da sensação de profundidade.

## Alternativas consideradas

- **Isométrica 50° como padrão, perspectiva como alternativa (escolhida).**
- **Perspectiva como padrão.** Dá mais sensação de profundidade e permite explorar o cenário, mas depende de controle de câmera. Na comparação, as plantas do fundo do 32×32 ficam pequenas, e girar pode tirar parte do campo da tela, sem retorno rápido. Hoje é o padrão do código; a decisão o inverte.
- **Isométrica 35,26° (giro 45°) como padrão ou como opção.** A diagonal clássica. Nas capturas, o giro de 45° tira o norte do fundo e o leste da direita (perde a referência espacial das outras câmeras), o painel de botões cobriu o drone e as espigas no 3×2 em zoom 3, e apareceu céu além da borda no 32×32 em zoom 5. Foi descartada e removida, não mantida como opção. A avaliação foi só visual, em quatro cenários, sem teste de uso.
- **Manter uma só câmera.** Descartada: a perspectiva dá ao jogador uma forma de olhar o campo por outros ângulos, e custa pouco manter.

## Evidências

Todas em `docs/validacao-visual/comparacao-de-cameras.md`. Os números vêm de logs locais não versionados (`console-marco-5.log`), reproduzíveis com `pnpm capture 5 docs/validacao-visual`.

- **Referência espacial (leitura das imagens):** isométrica 50° e perspectiva mostram norte ao fundo e leste à direita; a isométrica 35,26° não.
- **Legibilidade das plantas no 32×32 inteiro (leitura das imagens):** na isométrica todas têm o mesmo tamanho; na perspectiva as do fundo ficam menores. Em zoom 5 os três estágios se reconhecem nas duas.
- **Largura do campo 32×32 inteiro (medida nas capturas):** cerca de 470 px na isométrica 50°, igual em toda a altura, e cerca de 550 px na borda de baixo da perspectiva.
- **Drone sobre a planta:** o drone translúcido deixa ver a planta nas duas câmeras; só a perspectiva permite mudar o ângulo.
- **Controles testados no Edge (log):** roda dá zoom nas duas; o arrasto gira e move só a perspectiva; C e F não valem com o foco no editor; trocar de câmera não altera o hash nem os ticks.

## Limitações (o que esta decisão não sabe)

- **Seguir o drone com movimento rápido** (16× e instantâneo) **não foi avaliado**: as capturas foram feitas com a simulação pausada. Por isso fica desligado por padrão.
- **Perspectiva girada** pode deixar parte do campo fora da tela, porque o enquadramento é calculado só para o ângulo inicial. O botão de restaurar a orientação mitiga, mas não corrige o enquadramento.
- **Desempenho:** só renderização por software, um navegador (Edge), uma medição por câmera, campo parado. Sem GPU real nem outros navegadores.
- **Nenhuma avaliação de uso por uma pessoa de fora.** O teste do #15 pode confirmar ou contestar esta decisão; se contestar, este ADR é reaberto.
- **Campo pequeno:** no 3×2 o zoom máximo deixa as plantas enormes e mostra menos de uma casa. Não foi tratado aqui.
- A isométrica 35,26° foi vista em apenas quatro cenários (3×2 em zoom 1 e 3; 32×32 em zoom 1 e 5). Não se generaliza para outros tamanhos.

## Consequências

- **O jogo passa a abrir na isométrica.** Hoje abre na perspectiva (`CameraController.kind` começa em `'perspective'`). Testes e o script de captura que assumem o início na perspectiva precisam ser ajustados.
- **Código a remover:** os parâmetros `isoyaw` e `isopitch` de `src/view/main.ts`; as opções `isometricYaw` e `isometricPitch` de `CameraController` e de `createApp`; o teste da isométrica clássica e o do limite de elevação, que só existem por causa dessas opções. O ângulo da isométrica vira constante interna (giro 0°, elevação 50°).
- **Código a acrescentar:** o botão e o método de restaurar a orientação inicial da perspectiva (giro, elevação e deslocamento), com testes. A restauração não mexe na simulação.
- **Script de captura:** o marco 6 (`pnpm capture 6`) só funciona com `?isoyaw`/`?isopitch` e deixa de ter como rodar. Sai do script; as capturas `iso35-26` que já existem ficam.
- **Documentos:** `docs/fatia-1-prototipo-vertical.md` (linha sobre `?isoyaw=45&isopitch=35.26`), `GLOSSARY.md` e `docs/agents/vocabulario-codigo.md` são ajustados. A comparação histórica **não é reescrita**; ela cita parâmetros e um comando que deixam de existir, e fica como registro da época.
- **O custo de manter duas câmeras continua:** `CameraController` guarda as duas, e a dívida de dividi-lo em uma peça por projeção segue em aberto.

## Pontos em aberto para você aprovar antes de implementar

1. **O que o botão de restaurar desfaz:** só giro e elevação, ou também o deslocamento (mover com o botão direito) e o zoom? Proposta: giro, elevação e deslocamento; o zoom fica como está.
2. **Onde o botão aparece:** só quando a câmera ativa é a perspectiva (a isométrica não gira), na mesma faixa de botões da câmera. E se ele ganha uma tecla; proposta: sem tecla, só botão.
3. **A comparação histórica:** deixar intacta, ou acrescentar no topo uma linha dizendo que a isométrica 35,26° e o marco 6 foram removidos pelo ADR 0003? Proposta: acrescentar a linha, sem mexer no resto.
4. **Aceite do ticket:** o critério pede "ambas avaliadas no modo de estresse 32×32". Isso foi feito nas capturas do #13 (`marco-5-estresse-*`). Posso citá-las como cumprimento, ou você prefere repetir a avaliação?
