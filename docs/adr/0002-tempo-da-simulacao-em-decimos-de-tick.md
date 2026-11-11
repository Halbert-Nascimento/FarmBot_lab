---
status: accepted
---

# Tempo da simulação em décimos de tick

O custo de cada operação é somado como inteiro em décimos de tick (1 tick = 10 décimos), e o mundo só avança quando o acumulado completa 10. O resto fica acumulado para a próxima operação. O medidor mostra o total com uma casa decimal.

O GDD pede ticks discretos (REQ-FND-01), mas cobra 0,1 por conta e 0,5 por chamada de função. Somar decimais em ponto flutuante pode divergir entre máquinas e quebraria o determinismo exigido para replays, saves e validação de missões. Inteiros preservam os custos fracionários sem esse risco.

## Consequences

Saves, replays e missões guardam tempo em décimos, então trocar essa unidade depois invalidaria dados salvos.
