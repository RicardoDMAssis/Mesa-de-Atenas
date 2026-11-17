# Fase 2 — Grafo, Foco e Progresso

**Objetivo:** fechar o marco **v1 utilizável pelos 2 usuários**: ver as conexões entre os
assuntos, estudar com o timer de foco e acompanhar a constância (sequência de dias e progresso).

**Ponto de partida:** Fase 1 concluída na web (`documentos/relatorio-fase-1.md`). A tabela
`links` já guarda as conexões entre notas, e `study_sessions` já existe no banco, ainda sem uso.

## Decisões desta fase

| Tema                | Decisão                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Biblioteca do grafo | Sigma.js 4 + graphology (WebGL, aguenta milhares de nós). A posição dos nós é calculada por ForceAtlas2 em um Web Worker, para não travar a tela                                                                   |
| Nós                 | Notas e matérias/tópicos. Tamanho proporcional ao número de conexões; cor pela matéria de nível mais alto                                                                                                          |
| Arestas             | Links `[[...]]` entre notas (contínuas) e nota → matéria (tracejadas, mais fracas)                                                                                                                                 |
| Interação           | Tocar no nó destaca os vizinhos; tocar de novo (ou "Abrir") abre a nota. Arrastar move, pinça/roda dá zoom                                                                                                         |
| Filtros             | Por matéria (inclui a subárvore), mostrar/ocultar matérias, ocultar notas sem conexão                                                                                                                              |
| Grafo local         | Na tela da nota, um grafo pequeno só com a nota e os vizinhos de 1º grau                                                                                                                                           |
| Posições            | Recalculadas a cada abertura (sem gravar no banco). Reavaliar se o grafo ficar lento com muitas notas                                                                                                              |
| Timer               | Pomodoro 25/5 com pausa longa de 15 a cada 4 ciclos; durações ajustáveis. O tempo é calculado pelo horário de término, não por contagem, para sobreviver a aba em segundo plano e celular bloqueado                |
| Estado do timer     | Guardado no aparelho (preferência local): recarregar a página não perde o ciclo em andamento                                                                                                                       |
| Notificação         | Na web, a API de notificações do navegador (pedindo permissão na primeira vez) + som curto. No Android, `@capacitor/local-notifications` agendada para o horário de término (entra quando o Android for compilado) |
| Sessões             | Cada bloco de foco concluído grava uma linha em `study_sessions` (`kind = focus`), com matéria opcional. Cada sessão de revisão grava `kind = review` com início e fim                                             |
| Dia estudado        | Um dia de estudo conta para a sequência se tiver ao menos 1 card respondido **ou** 1 bloco de foco concluído. Usa a mesma virada do dia já configurável                                                            |
| Sequência (streak)  | Dias estudados consecutivos até hoje. Se hoje ainda não teve estudo, a sequência de ontem continua valendo até a virada (não "quebra" de manhã)                                                                    |
| Progresso           | Últimos 30 dias: cards respondidos e minutos de foco por dia; taxa de acerto (respostas diferentes de "Errei"); previsão de cards a vencer nos próximos 7 dias                                                     |
| Gráficos            | Componentes próprios em SVG (barras simples), sem biblioteca de gráficos                                                                                                                                           |

## Correções incluídas

- **Perda da última edição ao recarregar**: guardar o rascunho da nota no armazenamento local a
  cada alteração e, ao abrir a nota, recuperar um rascunho mais novo que o salvo no banco.
- **Relatório da Fase 1**: limitação removida quando esta correção estiver testada.

## Fora do escopo

- Metas diárias configuráveis e conquistas
- Estatísticas por card (curva de esquecimento) e otimização dos parâmetros do FSRS
- Grafo 3D, agrupamento automático por comunidades
- Sons personalizados no timer
- Android (continua dependendo do Android SDK; a notificação nativa fica pronta, mas sem teste em aparelho)

## Passos

1. **Consultas e regras** (`packages/db`, `packages/core`), com testes de unidade:
   - dados do grafo (nós, arestas, contagem de conexões, filtro por matéria)
   - gravação de sessões de foco e de revisão
   - dias estudados, sequência atual e maior sequência, respeitando a virada do dia
   - séries dos últimos 30 dias e previsão de vencimentos
2. **Grafo**: tela `/grafo` com filtros, legenda de cores e painel do nó selecionado
3. **Grafo local** na tela da nota
4. **Timer**: tela `/foco` com ciclo foco/pausa, escolha de matéria, pausar/retomar/pular,
   notificação ao terminar; indicador do timer em andamento na navegação
5. **Sessões de revisão**: registrar início e fim na tela de estudo
6. **Progresso**: sequência e resumo na tela inicial; tela de progresso com os gráficos
7. **Rascunho local das notas** (correção da perda ao recarregar)
8. **Ajustes**: durações do timer e notificações

## Critério de pronto

- Fluxos cobertos por testes de navegador (computador e celular): abrir nota pelo grafo, filtrar o
  grafo, completar um bloco de foco (com relógio simulado), sequência aumentando após estudar,
  recuperar edição após recarregar
- Regras de sequência e virada do dia cobertas por testes de unidade, incluindo virada de mês e
  dias sem estudo
- Grafo com 1.000 notas abrindo sem travar a tela (teste com dados gerados)
- Lint, tipos e todos os testes passando
- Relatório em `documentos/relatorio-fase-2.md` e marco "v1 utilizável" registrado no plano

## Riscos

| Risco                                        | Mitigação                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| WebGL do grafo pesado em celulares simples   | Limitar rótulos visíveis por zoom; testar com 1.000 notas; cair para lista de conexões se WebGL não estiver disponível |
| Navegador suspender o timer em segundo plano | Tempo calculado pelo horário de término; ao voltar, a tela se corrige sozinha                                          |
| Notificação negada pelo usuário              | Timer funciona igual; aviso visual e sonoro quando a aba estiver aberta                                                |
