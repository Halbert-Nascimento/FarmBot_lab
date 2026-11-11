# Vocabulário: glossário em português → identificadores em inglês

Identificadores e comentários do código ficam em **inglês**. Documentação, glossário, ADRs e commits ficam em **português**. Esta tabela liga os termos de `GLOSSARY.md` aos nomes usados no código. Use sempre o identificador da tabela, sem sinônimos.

| Termo (GLOSSARY.md) | Identificador |
| --- | --- |
| Fazenda | `Farm` |
| Campo | `Field` |
| Casa | `Cell` |
| Terreno (Gramado, Terra arada) | `Terrain` (`grass`, `tilled`) |
| Planta | `PlantSpecies` (tipo) e `Plant` (constante do script, ex.: `Plant.GRASS`) |
| Drone | `Drone` |
| Tick | `tick` |
| Décimo de tick (unidade interna, ADR 0002) | `decitick` |
| Script | `Script` |
| Execução | `Run` |
| Comando | `Command` |
| Sensor (comando que só lê) | `sensor` |
| Item | `Item` (`hay`, `wheat`) |
| Estoque | `Stock` |
| Planta plantada | `PlantState` (visto de fora) e `PlantedPlant` (guardado no mundo) |
| Recusa | evento `rejected`, com `RejectReason` |
| Apelido de comando | `COMMAND_NAMES` (inglês → português) e `CONSTANT_PAIRS` |
| Idioma das mensagens | `Language` (`FarmConfig.language`) |
| Erro do script | `ScriptError` (com `code`, `line`, `reason`, `hint`, `didYouMean`) |
| Limites de segurança do script | `Limits` (`FarmConfig.limits`) |
| Estágio de crescimento | `GrowthStage` (`sprout`, `growing`, `ready`) |
| Ação | `Action` |
| Medidor de execução | `Meter` |
| Evento da fazenda | `FarmEvent` |
| Posição de uma casa | `Position` |
| Camada (de ensino) | `Layer` (`FarmConfig.layer`, `LAYER_COUNT`) |
| Recurso de sintaxe | `SyntaxFeature`, com a camada de cada um em `SYNTAX_LAYERS` |
| Ato | `Act` |
| Missão | `Mission` |
| Pesquisa | `Research` |
| Evento de progressão | `ProgressionEvent` |
| NÚCLEO (narrador) | `Nucleo` |
| Fazenda principal | `MainFarm` |
| Sandbox | `Sandbox` |
| Modo livre | `FreeMode` |
| Motor de simulação | pasta `src/engine/` |
| Visualização | pasta `src/view/` |

Comandos do jogador têm nome em inglês e em português (REQ-FND-41), definidos pelo GDD §9. Os nomes em inglês são os identificadores internos, e os nomes em português são apelidos.

Se um conceito novo não estiver aqui, o termo entra primeiro no `GLOSSARY.md` e depois nesta tabela.
