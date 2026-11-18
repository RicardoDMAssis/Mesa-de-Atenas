# Fase 4.1 — Plugins mais poderosos

**Objetivo:** tirar as limitações que mais atrapalham plugins de matéria (química, física,
línguas…), sem abrir mão das regras de segurança do projeto: o app nunca confia no plugin, o
usuário confirma o que muda os estudos dele, e cada plugin só enxerga o que é seu.

**Pedido do usuário (2026-11-18):** itens 1, 2, 4 e 5 da análise de limitações:

1. Criar **vários cards de uma vez**, com uma confirmação só
2. **Ver e atualizar os cards** que o próprio plugin criou
3. **Destaques** no texto da nota sem alterar o texto (a Fase 3.1, que estava adiada)
4. **Guardar arquivos** que não são imagem (ex.: `.mol`, `.csv`, `.json`)

**Ponto de partida (Fase 4):** `cards.propose` e `cards.proposeVisual` criam **um** card por
confirmação; o plugin não sabe quais cards criou; destaques não existem; `assets.save` aceita só
imagens e o armazenamento chave-valor (`storage.*`) tem limite de 256 KB por chave.

**Exemplo que guia as decisões:** um plugin de Química que gera 30 cards "nome ↔ fórmula" de uma
vez, corrige depois uma fórmula errada nesses cards, pinta os nomes de elementos e fórmulas nas
notas e guarda as moléculas desenhadas pelo usuário em arquivos `.mol`.

## Princípios

1. **O usuário confirma o que muda os estudos dele.** Criar cards e mudar o texto que ele vê na
   revisão sempre passa por uma tela do app. Dados internos do plugin podem mudar sem pedir.
2. **Cada plugin só enxerga o que é seu.** Cards que ele criou e arquivos que ele salvou. Nada de
   ler os cards de outros plugins ou do usuário.
3. **Acréscimo compatível.** `apiVersion` continua "1"; plugins existentes não mudam.
4. **Tudo entra no backup** e é apagado (ou desligado) de forma previsível ao remover o plugin.

---

## Item 1 — Vários cards de uma vez

| Tema        | Decisão                                                                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Método      | `cards.proposeBatch({ cards, sugestaoBaralho? })` — permissão `cards:write`                                                                                                                              |
| Itens       | Até **200** por lote. Cada item: `{ front, back }` (frente e verso), `{ cloze }` (texto com lacunas) ou `{ content, fallback }` (card visual, exige `cardRenderer`). Opcional: `chave` (ver duplicados)  |
| Confirmação | Uma tela só: escolher o baralho (ou criar um novo com o nome sugerido pelo plugin), lista com caixa de marcar em cada card, "Marcar todos / nenhum", **editar** qualquer card antes de criar (como hoje) |
| Duplicados  | Se o plugin já criou um card com a mesma `chave` (ou, sem chave, a mesma frente no mesmo baralho), ele aparece desmarcado com "já existe"                                                                |
| Resposta    | `{ created: number, ids: string[] }`: só os ids dos cards que o usuário aceitou                                                                                                                          |
| Celular     | Lista rolável com a frente de cada card; tocar abre o editor do card; botão fixo "Criar N cards"                                                                                                         |
| Limites     | Um lote pendente por vez (como hoje); itens validados um a um (um item inválido recusa o lote com o índice do erro)                                                                                      |

`cards.propose` e `cards.proposeVisual` continuam iguais (são um lote de um).

## Item 2 — Ver e atualizar os próprios cards

### Saber de quem é cada card

Hoje só cards visuais guardam o plugin (`plugin_id`), e só porque o plugin os desenha. Um card de
texto criado pelo Dicionário não tem dono registrado.

| Tema    | Decisão                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Banco   | Coluna nova `origin_plugin_id` em `cards` (migração nova). Preenchida em toda criação vinda de plugin. `plugin_id` continua sendo "quem desenha" |
| Chave   | Coluna `origin_key`: a `chave` opcional do item 1, única por plugin (permite ao plugin achar "o card do etanol" sem guardar ids)                 |
| Antigos | Cards de plugin criados antes da 4.1: os visuais ganham o dono pelo `plugin_id`; os de texto ficam sem dono (não há como saber)                  |

### Métodos

| Método                                                    | Permissão nova `cards:own` | O que faz                                                                                                                                                         |
| --------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cards.listOwn({ deckId?, chave?, depois?, limite? })`    | sim                        | Cards **deste plugin**, em páginas de até 200: id, chave, baralho (id e nome), tipo, frente/verso (ou reserva), `content` dos visuais, criado/editado             |
| `cards.statsOwn(ids)`                                     | sim                        | Desempenho dos próprios cards: estado (novo, aprendendo, revisão), acertos, esquecimentos, última revisão e próxima. Serve para "as moléculas que você mais erra" |
| `cards.updateContent(id, content)`                        | sim                        | Troca só o `content` de um card **visual** (dado interno do plugin, ex.: corrigir a posição da câmera). Sem confirmação                                           |
| `cards.proposeUpdate([{ id, front?, back?, fallback? }])` | sim                        | Mudar o **texto que o usuário vê**: o app mostra antes/depois de cada card e o usuário aceita todos, alguns ou nenhum. Até 200 por vez                            |

| Tema                       | Decisão                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Texto que o usuário editou | O antes/depois deixa claro quando o usuário já tinha personalizado o card ("você editou este card em 12/11"); nesse caso ele vem desmarcado |
| Excluir                    | `cards.proposeDelete(ids)`: o app lista os cards e o usuário confirma (decisão do usuário). Sem confirmação, nada é excluído                |
| Agendamento                | O plugin nunca muda quando um card volta. `statsOwn` é só leitura                                                                           |
| Plugin removido            | Os cards ficam; perdem o dono só para fins de acesso (o registro `origin_plugin_id` continua, e reinstalar o mesmo plugin devolve o acesso) |
| Descrição da permissão     | `cards:own` — "Ver os cards que este plugin criou e o seu desempenho neles, e sugerir correções (você confirma)"                            |

## Item 4 — Destaques no texto da nota

O plano já existe e **continua valendo como está**: `instruções/fase-3.1-destaques.md`, etapa 1
(regras fixas: o plugin define termos, cores da paleta e rótulos; o app pinta com decorações do
editor; o texto salvo nunca muda; permissão `notes:highlight`).

Acréscimo para matérias como química, a decidir com o usuário:

| Tema              | Proposta                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estilo `formula`  | Novo estilo de destaque: o app mostra os números de uma fórmula como subscrito ("H2SO4" aparece "H₂SO₄"), só na exibição. Cargas (`Fe3+`, `SO4 2-`) como sobrescrito |
| Termos com número | O motor de correspondência aceita termos com dígitos e sinais (`H2O`, `CO2`, `NaCl`) como palavra inteira                                                            |

O plugin oficial de marca-texto continua fora (o usuário vai criar o dele).

## Item 5 — Arquivos que não são imagem

| Tema               | Decisão                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Métodos            | `storage.saveFile({ nome, mime, data })` → `{ fileId }`; `storage.readFile(fileId)` → `ArrayBuffer`; `storage.listFiles()`; `storage.deleteFile(fileId)` — permissão `storage` (já existe)                                                                                                             |
| Tipos              | Lista permitida: texto (`text/plain`, `text/csv`, `text/markdown`), dados (`application/json`, `application/xml`), química (`chemical/x-mdl-molfile`, `chemical/x-pdb`), 3D (`model/gltf-binary`), áudio (`audio/mpeg`, `audio/ogg`, `audio/wav`) e `application/octet-stream`. Nunca HTML nem scripts |
| Tamanho            | Até **10 MB** por arquivo; até **100 MB** por plugin (o app recusa com mensagem clara)                                                                                                                                                                                                                 |
| Onde fica          | O mesmo armazenamento por hash das imagens (`AssetStore`), registrado em `assets` com o plugin e o nome. Isolado: um plugin só lê os próprios arquivos                                                                                                                                                 |
| Backup             | Entra no backup, como as imagens. Na tela de backup, mostrar quanto os arquivos de plugins ocupam                                                                                                                                                                                                      |
| Ao remover         | Remover o plugin pergunta: "Apagar também os arquivos guardados por ele (N MB)?"                                                                                                                                                                                                                       |
| Exportar           | `storage.exportFile(fileId)`: o app entrega o arquivo ao usuário (download no computador, compartilhar no Android). Assim o `.mol` pode ir para outro programa                                                                                                                                         |
| Importar           | `storage.pickFile({ aceitar })`: o app abre o seletor de arquivos e entrega ao plugin só o arquivo escolhido pelo usuário                                                                                                                                                                              |
| Na tela de Plugins | Espaço usado por plugin e "Apagar dados do plugin"                                                                                                                                                                                                                                                     |

`assets.save` continua para imagens (que podem aparecer em cards e blocos). `files.read` continua
para os arquivos do próprio pacote do plugin.

---

## Passos

1. **Contrato e kit**: métodos, permissão `cards:own`, tipos e limites, descrições em português;
   `apiVersion` continua "1"; testes do contrato
2. **Arquivos (item 5)**: métodos no host, cota por plugin, exportar e importar, espaço usado na
   tela de Plugins, backup, pergunta ao remover
3. **Banco**: migração com `origin_plugin_id` e `origin_key` (índice único por plugin), consultas
   para listar, estatísticas e atualização; preencher o dono dos cards visuais antigos
4. **Lote de cards (item 1)**: tela de confirmação com lista, edição por card, duplicados, criar
   baralho novo; `propose` e `proposeVisual` passam a usar o mesmo caminho
5. **Próprios cards (item 2)**: `listOwn`, `statsOwn`, `updateContent`, `proposeUpdate` com a tela
   de antes/depois
6. **Destaques (item 4)**: etapas 1 a 7 do plano da Fase 3.1, mais o estilo `formula` se aprovado
7. **Exemplos**: o modelo de plugin ganha exemplos curtos de lote, próprios cards, destaques e
   arquivos; o Dicionário passa a usar `chave` (não duplica a mesma palavra)
8. **Guia de plugins**, testes no navegador e no Galaxy A52, relatório

A ordem vai do mais simples e independente (arquivos) ao maior (destaques), para cada parte
poder ser usada assim que ficar pronta.

## Critério de pronto

- Testes de navegador (computador e celular), com um plugin de teste:
  - lote de 30 cards: desmarcar 2, editar 1, criar → 28 cards no baralho escolhido; `ids` corretos;
    repetir o lote → os 28 aparecem como "já existe"
  - lote com item inválido → `invalid_params` com o índice; nada criado
  - `listOwn` devolve só os cards do plugin (não os do usuário nem os de outro plugin);
    sem `cards:own` → `forbidden`
  - `proposeUpdate`: antes/depois aparece; card editado pelo usuário vem desmarcado; aceitar
    muda o texto e a busca acompanha; recusar não muda nada
  - `updateContent` muda o card visual sem pedir e sem mexer no agendamento
  - destaques: todos os critérios do plano da Fase 3.1 (e "H2O" aparecendo "H₂O", se aprovado)
  - arquivos: salvar, ler, listar, apagar; tipo proibido e arquivo grande demais recusados; um
    plugin não lê o arquivo de outro; exportar; entra no backup e volta na restauração; remover o
    plugin perguntando sobre os arquivos
- Lote de 200 cards confirmável sem travar no Galaxy A52
- Lint, tipos e todos os testes passando; relatório em `documentos/relatorio-fase-4.1.md`

## Fora do escopo

- Plugin de Química (sugerido como próximo caso de referência, depois desta fase)
- Ler notas além da aberta e cards que não são do plugin (item 3 da análise)
- Câmera, microfone e sensores (item 7); blocos vivos na nota (item 6); IA (Fase 5)
- Plugin mudar o agendamento

## Riscos

| Risco                                               | Mitigação                                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Lote enorme poluir os baralhos                      | Confirmação com lista, duplicados desmarcados, limite de 200, editar antes de criar                |
| Plugin sobrescrever o que o usuário personalizou    | Texto visível só muda com antes/depois confirmado; card editado pelo usuário vem desmarcado        |
| Plugin espionar o desempenho do usuário             | `statsOwn` só dos próprios cards e com permissão própria, mostrada ao ativar                       |
| Arquivos grandes deixarem o backup pesado           | Limites por arquivo e por plugin; espaço mostrado na tela de backup e de Plugins                   |
| Arquivo malicioso salvo e aberto por outro programa | Lista de tipos sem HTML nem scripts; exportar só por ação do usuário                               |
| Destaques deixarem a digitação lenta                | Mitigações do plano da Fase 3.1 (recalcular só o parágrafo alterado, limite de destaques, medição) |

## Decisões tomadas com o usuário (2026-11-18)

1. O plugin **pode excluir** os próprios cards, **desde que o usuário confirme** (`cards.proposeDelete`).
2. O estilo `formula` entra nos destaques.
3. Limites aprovados: 200 cards por lote, 10 MB por arquivo, 100 MB por plugin.
4. A Fase 4.1 vem **antes** de fechar as medições do Esqueleto no celular e da Fase 5.
