# Relatório da Fase 2 — Grafo, Foco e Progresso

**Data:** 2026-11-17 · **Plano:** `instruções/fase-2.md`

## Resumo

Implementada e testada na web (computador e celular) e compilada para Android. Com ela, o app
atinge o marco **v1 utilizável pelos 2 usuários**, faltando só confirmar a notificação do timer
em um celular real.

## Entregue

| Área          | O que o usuário faz                                                                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grafo         | Mapa de notas e matérias, cor por matéria de nível mais alto, tamanho pelo número de conexões. Tocar destaca vizinhos; tocar de novo ou "Abrir" leva à nota. Filtro por matéria, mostrar/ocultar matérias, ocultar notas sem conexão, legenda |
| Grafo local   | Na tela da nota, seção "Conexões" com a nota e as notas ligadas a ela                                                                                                                                                                         |
| Timer de foco | 25/5 com pausa longa de 15 a cada 4 (ajustável); pausar, continuar, reiniciar, encerrar; matéria opcional; sobrevive a recarregar e ao app fechado; indicador flutuante nas outras telas                                                      |
| Aviso         | Web: notificação do navegador + som. Android: notificação nativa agendada para o fim da fase                                                                                                                                                  |
| Sessões       | Blocos de foco concluídos e sessões de revisão gravados em `study_sessions`                                                                                                                                                                   |
| Sequência     | Dias seguidos com estudo (card respondido ou foco concluído); não quebra de manhã; maior sequência                                                                                                                                            |
| Progresso     | Respostas, minutos de foco e taxa de acerto em 30 dias; gráficos diários; previsão de cards para 7 dias                                                                                                                                       |
| Início        | Sequência, card do timer de foco                                                                                                                                                                                                              |
| Ajustes       | Durações do timer e aviso ligado/desligado                                                                                                                                                                                                    |

## Correções incluídas

- **Perda da última edição ao recarregar** (limitação da Fase 1): cada alteração da nota é gravada
  na hora em um rascunho local; ao abrir, um rascunho mais novo que o banco é recuperado e salvo.
- **Colar links**: colar `[[Nota]]` ou `[[Nota]](texto)` cria os links (e as notas que faltarem).

## Bugs encontrados durante a fase

| Bug                                                        | Causa                                                                                   | Correção                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Bloco de foco concluído não era registrado                 | Uma instrução do Drizzle só executa quando é aguardada; o timer a disparava sem `await` | Toda função de gravação passou a ser `async` e executar na hora |
| **Hora de virada do dia nunca era salva** (desde a Fase 1) | Mesma causa, na tela de Ajustes                                                         | Mesma correção; teste de navegador adicionado                   |
| Pontos do grafo gigantes                                   | Sigma 4 mede tamanho em unidades do grafo por padrão                                    | `itemSizesReference: "screen"`                                  |

A regra ficou documentada no README e coberta por teste de unidade (gravações sem `await` executam).

## Verificação

- Lint e tipos sem erros
- 70 testes de unidade (core 22, contrato de plugins 5, banco 26, app 17)
- 54 testes de navegador (27 cenários × computador e celular), incluindo timer com relógio
  simulado (pausar, recarregar, concluir), sequência após foco e após revisão, rascunho
  recuperado ao recarregar, colar links, grafo e grafo local
- **Desempenho**: grafo com 1.000 notas e ~1.500 links abre com bloqueio máximo da tela de
  221 ms (computador) e 239 ms (celular emulado); critério era abaixo de 1 s
- Android: APK compila com o plugin de notificações (permissões `POST_NOTIFICATIONS` e
  `SCHEDULE_EXACT_ALARM` incluídas)

## Pendências

- **Notificação do timer em celular real**: não testada (o celular estava desconectado).
  Testar: começar um foco curto, bloquear a tela e esperar o aviso.
- No celular, Foco e Progresso não estão na barra inferior; são acessados pelos cards da tela
  inicial. A Busca saiu da barra inferior para dar lugar ao Grafo (continua no Início).

## Próximos passos

Período de uso real pelos 2 usuários antes da Fase 3 (plugins), como recomendado no plano.
