# Relatório da Fase 1 — Notas e Flashcards

**Data:** 2026-11-17 (atualizado após os ajustes pós-entrega) · **Plano:** `instruções/fase-1.md`

## Resumo

O core está utilizável no navegador (computador e celular): organizar matérias, escrever notas
ligadas entre si, criar flashcards com imagem ou lacunas, revisar com repetição espaçada, buscar e
fazer backup. Tudo funciona offline.

## Entregue

| Área     | O que o usuário faz                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Matérias | Árvore matéria > tópico > subtópico; criar, renomear, mover, excluir (notas e baralhos ficam "sem matéria")                                                                                                                    |
| Notas    | Editor com negrito, itálico, títulos, listas, citação; salvamento automático; filtro por matéria                                                                                                                               |
| Links    | `[[` (ou o botão de citar) abre a lista de notas; digitar `[[Título]]` vira link; `[[Título]](texto)` mostra um texto próprio; título inexistente cria a nota; renomear não quebra o link; seção "notas que apontam para esta" |
| Cards    | Frente/verso com imagem opcional em cada lado; lacunas `{{c1::...}}` com botão "Marcar lacuna", cada número vira um card                                                                                                       |
| Revisão  | Fila do dia (vencidos, depois novos); botões Errei/Difícil/Bom/Fácil com o próximo intervalo; atalhos espaço e 1–4; card errado volta na mesma sessão; resumo ao final                                                         |
| Busca    | Notas e cards, por prefixo, sem diferenciar acentos, com trecho destacado; campo vazio lista tudo; a última busca é refeita ao entrar ou recarregar                                                                            |
| Backup   | Exportar um `.json` com tudo (inclusive imagens); restaurar substitui tudo, de forma atômica                                                                                                                                   |
| Início   | Para revisar, novos e respondidos hoje; notas recentes; atalhos                                                                                                                                                                |
| Ajustes  | Hora de virada do dia de estudo                                                                                                                                                                                                |

## Decisões técnicas relevantes

- **Agendamento opaco.** A `ts-fsrs` atual (v6, FSRS-7) mudou o formato do card. O estado do
  algoritmo agora é guardado como um bloco JSON (`cards.srs`), e só `packages/core/src/srs.ts`
  conhece a biblioteca. Trocar de versão ou de algoritmo fica restrito a esse arquivo. O histórico
  completo de cada resposta fica em `review_logs.data`, pronto para otimizar parâmetros no futuro.
- **Busca no banco.** Tabela FTS5 mantida por gatilhos SQL: nenhuma tela precisa lembrar de indexar.
- **Links derivados.** A tabela `links` é recalculada a partir do conteúdo a cada salvamento,
  gravando só a diferença, no mesmo lote que a nota.
- **Imagens reduzidas no aparelho** (máx. 1600 px, WebP) antes de guardar.
- Migrações novas: `0001_agendamento_opaco` (substitui as colunas FSRS fixas) e `0002_busca`.

## Ajustes após a entrega

Pedidos feitos depois da primeira versão da fase, todos implementados e com teste:

| Pedido                                           | Resultado                                                                                 | Commit    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------- |
| Refazer a busca ao entrar ou recarregar a página | Usa o termo da URL ou, sem ele, a última busca feita no aparelho                          | `45d0042` |
| Campo de busca vazio lista tudo                  | Notas (mais recentes primeiro) e depois cards, até 200 itens                              | `f7cf57f` |
| Botão de citar deixava só `[[` no texto          | Causa: a lista só abria após espaço ou no início da linha. Agora abre em qualquer posição | `c5422d1` |
| Links no estilo Markdown                         | `[[Título]]` e `[[Título]](texto exibido)` viram link ao digitar                          | `c5422d1` |
| Erro "Failed to resolve import @tiptap/core"     | Dependência extra removida; o código usa `@tiptap/react`                                  | `703bc38` |

## Verificação

- Lint e tipos sem erros
- 48 testes de unidade (core 14, contrato de plugins 5, banco 23, app 6)
- 32 testes de navegador (16 cenários × computador e celular), incluindo matérias, links entre
  notas nas três formas, criação de nota por `[[`, cards com imagem e lacunas, revisão completa,
  card errado voltando, busca (com termo, vazia e refeita ao recarregar) e backup com restauração

## Limitações conhecidas

- **Recarregar a página menos de meio segundo depois de digitar** pode perder a última edição: o
  salvamento é assíncrono e o navegador não espera por ele ao descarregar. Navegar dentro do app
  não tem esse problema.
- Restaurar um backup substitui tudo (não mescla).
- Sem limite diário de cards novos e sem lixeira.
- O Android continua sem compilar (falta o Android SDK); nada desta fase foi testado em aparelho.

## Próximos passos (Fase 2)

Grafo de notas (os links já estão na tabela `links`), timer Pomodoro e streak/progresso. Com isso
o plano atinge o marco "v1 utilizável pelos 2 usuários".

## Teste no Android (2026-11-17)

Emulador Pixel 6, Android 14, WebView Chrome 113, APK de depuração gerado pelo Capacitor.

| Verificação                                                      | Resultado                                                                         |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Compilação (`assembleDebug`)                                     | OK                                                                                |
| Banco local persiste ao fechar o app à força                     | OK — o SQLite WASM + OPFS funciona no WebView; o driver nativo não foi necessário |
| Arquivos (imagens) persistem                                     | OK                                                                                |
| Plugin de prova: 3D, vários arquivos, isolamento, rede bloqueada | OK, depois de uma correção (abaixo)                                               |
| Nota com `[[Nota]]` e `[[Nota]](texto)` pelo teclado do Android  | OK                                                                                |
| Baralho, card, revisão completa, busca                           | OK                                                                                |

**Correção encontrada no aparelho:** o Capacitor reserva a pasta `public/plugins` para os
plugins nativos dele e não a copia para o app. Os plugins embutidos passaram para
`public/builtin-plugins`. Na web isso não aparecia.

**Ainda não verificado:** celular real com teclado que usa composição de palavras (Gboard e
similares), que pode se comportar diferente nas regras de `[[...]]`; e WebViews mais antigas.
