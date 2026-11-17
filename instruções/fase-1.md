# Fase 1 — Notas e Flashcards

**Objetivo:** deixar o core utilizável no dia a dia: organizar matérias, escrever notas ligadas
entre si, criar flashcards (com imagem) e revisá-los com repetição espaçada, buscar e fazer backup.

**Ponto de partida:** Fase 0 concluída na web (`documentos/relatorio-fase-0.md`).

## Decisões desta fase

| Tema                     | Decisão                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Componentes de interface | Primitivos Radix (diálogo, menu) com estilo próprio sobre os tokens do tema, no modelo do shadcn/ui. A CLI do shadcn não é usada porque reescreveria os tokens de tema já existentes |
| Formato da nota          | Documento TipTap (JSON) + texto plano para busca                                                                                                                                     |
| Link entre notas         | Nó próprio (`noteLink`) inserido ao digitar `[[`; guarda o id da nota, então renomear não quebra o link                                                                              |
| Tabela `links`           | Derivada do conteúdo: a cada salvamento, só a diferença é gravada                                                                                                                    |
| Cards                    | `basic` (frente/verso, com imagem opcional em cada lado) e `cloze`                                                                                                                   |
| Cloze                    | Sintaxe `{{c1::texto}}`; cada número vira um card independente                                                                                                                       |
| Imagens                  | Reduzidas no aparelho (máx. 1600 px), guardadas no `AssetStore` e referenciadas pelo hash                                                                                            |
| Agendamento              | `ts-fsrs`, parâmetros padrão; estado e histórico (`review_logs`) gravados em lote                                                                                                    |
| Virada do dia            | 4h por padrão (ajustável); um card "vence hoje" se vencer até a próxima virada                                                                                                       |
| Fila de revisão          | Vencidos até o fim do dia de estudo; card que volta a vencer no mesmo dia retorna ao fim da fila                                                                                     |
| Busca                    | FTS5 com gatilhos no banco, sem diferenciar acentos, com busca por prefixo                                                                                                           |
| Backup                   | Um arquivo `.json` com todas as tabelas e as imagens; importar substitui tudo                                                                                                        |

## Fora do escopo

- Limite diário de cards novos, lixeira com restauração, exportação de notas em Markdown
- Imagens dentro das notas (o armazenamento serve; falta o bloco no editor)
- Otimização dos parâmetros do FSRS a partir do histórico
- Android (continua dependendo do Android SDK)

## Passos

1. Base de interface (botão, campo, diálogo, menu) e consultas do banco com testes
2. Matérias: árvore com criar, renomear, mover e excluir
3. Notas: lista por matéria, editor com salvamento automático, links `[[...]]`, "notas que apontam para esta"
4. Baralhos e cards: criar, editar, excluir; básico, cloze e imagens
5. Revisão: sessão com intervalos previstos, atalhos de teclado e resumo ao final
6. Busca em notas e cards
7. Backup: exportar e importar
8. Início: o que vence hoje, notas recentes e busca rápida

## Critério de pronto

- Fluxos principais cobertos por testes de navegador (computador e celular)
- Regras de agendamento, cloze e consultas cobertas por testes de unidade
- Lint, tipos e todos os testes passando
- Relatório em `documentos/relatorio-fase-1.md`
