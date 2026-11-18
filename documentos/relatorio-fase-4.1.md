# Relatório da Fase 4.1 — Plugins mais poderosos

**Data:** 2026-11-18 · **Plano:** `instruções/fase-4.1-plugins-mais-poderosos.md`

## Resumo

Os plugins ganharam quatro capacidades que faltavam para matérias como química, física e
línguas: criar **vários cards de uma vez**, **ver, corrigir e excluir os próprios cards** (com o
desempenho neles), **destacar palavras nas notas** sem alterar o texto (inclusive fórmulas como
H₂SO₄) e **guardar arquivos** que não são imagem. Tudo segue as regras do projeto: o usuário
confirma o que muda os estudos dele, e cada plugin só enxerga o que é seu.

## Decisões tomadas com o usuário (2026-11-18)

- O plugin pode excluir os próprios cards, **desde que o usuário confirme**.
- Estilo `formula` nos destaques: sim.
- Limites: 200 cards por lote, 10 MB por arquivo, 100 MB por plugin.
- A Fase 4.1 vem antes das medições do Esqueleto no celular e da Fase 5.

## Entregue

| Item              | Resultado                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Cards em lote  | `cards.proposeBatch`: até 200 cards (frente/verso, lacunas ou visual) numa tela só. O usuário escolhe o baralho ou cria um novo com o nome sugerido, marca, edita qualquer card e confirma. `key` faz o app reconhecer cards já criados ("já existe", desmarcados); sem `key`, compara a frente no baralho                                                                       |
| 2. Próprios cards | O app registra o plugin que criou cada card (também em `propose` e `proposeVisual`). Permissão nova `cards:own`: `listOwn` (com chave, baralho e páginas), `statsOwn` (estado, acertos, esquecimentos), `updateContent` (dado interno de card visual, sem pedir), `proposeUpdate` (antes/depois; cards que o usuário editou vêm desmarcados) e `proposeDelete` (com confirmação) |
| 4. Destaques      | Plano da Fase 3.1, etapa 1, mais o estilo `formula`. Motor em `packages/core` (palavra inteira, acentos opcionais, termos com números e sinais, o mais longo vence). Pintura por decorações do editor, sem mudar o texto; legenda; "Esconder/Mostrar destaques" no menu da nota; tocar numa palavra com `command` abre o painel do plugin; somem ao desativar                    |
| 5. Arquivos       | `storage.saveFile`, `readFile`, `listFiles`, `deleteFile`, `exportFile`, `pickFile`. Tipos sem HTML nem scripts; cota por plugin; no backup; espaço usado na tela de Plugins; ao remover, pergunta se apaga os arquivos. O seletor de arquivos só abre com um toque do usuário numa tela do app                                                                                  |
| Kit e guia        | Todos os métodos no `@estudarella/plugin-sdk` com tipos (`OwnCard`, `CardStats`, `StoredFile`); seções novas no guia de plugins                                                                                                                                                                                                                                                  |

## Mudanças em relação ao plano

- Nomes de campo dos destaques em inglês (`term`, `color`, `style`, `label`), como o resto do
  contrato; o plano da 3.1 usava português. Cores: `purple`, `pink`, `green`, `orange`, `blue`,
  `cyan`, `brown`, `gray`.
- `cards.propose` e `cards.proposeVisual` continuam com a tela própria (um card); só passaram a
  registrar o plugin de origem. O Dicionário não ganhou `key` porque `propose` não tem esse campo
  (o lote tem).
- O exemplo no modelo de plugin (`plugins/_template`) ficou para depois; o guia traz exemplos de
  todos os métodos.

## Banco

- Migração `0006`: `cards.origin_plugin_id`, `cards.origin_key`, `cards.edited_at` e
  `assets.name`; índice por plugin e chave.
- Migração `0007`: cards visuais antigos ganham o dono pelo plugin que os desenha. Cards de texto
  antigos vindos de plugins ficam sem dono (não há como saber a origem).

## Achados durante a fase

| Achado                                                                                                                            | Correção                                                         |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Uma imagem de card deixava de ser registrada se um arquivo de plugin tivesse o mesmo conteúdo; apagar o arquivo apagaria a imagem | Imagens só se comparam com imagens (achado pelo teste do banco)  |
| `updated_at` muda a cada revisão, então não servia para saber se o usuário editou o card                                          | Coluna própria `edited_at`, marcada só pelas edições no app      |
| Abrir o seletor de arquivos a pedido do plugin seria bloqueado pelo navegador (precisa de um gesto do usuário)                    | Tela "Abrir um arquivo" com botão; também deixa claro quem pediu |
| A chave interna das regras de destaque ficava ao alcance do plugin por `storage.*`                                                | Chaves com `__` reservadas ao app                                |

## Verificação

- Lint e tipos sem erros
- Testes de unidade novos: motor de destaques (palavra inteira, acentos, maiúsculas, sobreposição,
  fórmulas, posições com emoji, 20 mil palavras com 2.000 regras em menos de 0,5 s), consultas de
  cards de plugins e de arquivos, `mascot.say` e regras de permissão
- Testes de navegador novos (computador e celular), com um plugin de teste:
  - lote de 30: baralho novo, desmarcar 2, editar 1 → 28 criados; repetir → 28 "já existem";
    item inválido → `invalid_params`
  - só os próprios cards; estatísticas; conteúdo de card visual trocado sem pedir; correção com
    antes/depois (card editado pelo usuário desmarcado); exclusão confirmada; busca acompanha;
    plugin sem `cards:own` → `forbidden`
  - destaques: cor da paleta, fórmula com subscrito, legenda, texto salvo intacto, comando abre o
    painel com a palavra, esconder e mostrar, sumir ao desativar; cor fora da paleta e chave
    reservada recusadas
  - arquivos: guardar e ler, tipo HTML recusado, abrir pelo seletor, espaço na tela de Plugins,
    pergunta ao remover, apagar

## Pendências

- No Galaxy A52: lote de 200 cards confirmável sem travar (critério da fase) e destaques em nota
  longa enquanto se digita. Junto com as medições pendentes do Esqueleto 3D (relatório da Fase 4).
- Exemplos curtos no modelo de plugin.
