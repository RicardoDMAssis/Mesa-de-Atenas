# Fase 4 — Plugins v2 (ricos): Esqueleto 3D

**Objetivo:** permitir plugins que **vivem dentro do estudo**: um card cuja frente é desenhada pelo
plugin (ex.: modelo 3D girável), um bloco dentro da nota e imagens salvas pelo plugin. O caso de
referência é o **Esqueleto 3D**: abrir o modelo ao lado de uma nota de anatomia, tocar num osso,
criar uma questão visual e revisá-la com o modelo girável.

**Ponto de partida (Fase 3):** plugins isolados com permissões, painel, tela própria, comando,
widgets; WebGL dentro do plugin comprovado no Galaxy A52 (Fase 0); o app já entrega arquivos da
pasta do plugin sob demanda (`plugin.readFile`), mas o kit ainda não expõe isso.

## O que falta hoje (diagnóstico)

| Parte do caso                               | Hoje                        | Esta fase                                |
| ------------------------------------------- | --------------------------- | ---------------------------------------- |
| Painel 3D, girar, zoom, tocar e destacar    | Possível                    | —                                        |
| Ler o modelo (GLB) da pasta do plugin       | Só no app, não no kit       | `app.files.read()`                       |
| Abrir ao entrar numa nota de anatomia       | Não (`activation` ignorado) | Sugestão por etiqueta da matéria         |
| Card visual com o modelo girável na revisão | Não (só cards de texto)     | Cards de plugin + `cardRenderer`         |
| Miniatura clicável dentro da nota           | Não                         | Blocos de plugin (`noteEmbed`) + imagens |
| Salvar imagens (miniaturas)                 | Não para plugins            | `assets.save`                            |

## Decisões tomadas com o usuário (2026-11-17)

- Recorte: **só o esqueleto**.
- Abertura: **opção A** — sugestão discreta na nota; o painel só abre se o usuário tocar.
- Nomes dos ossos: preparados a partir da Terminologia Anatômica, com o latim ao lado para conferência; sem revisor da área por enquanto.
- Implementação **autorizada** pelo usuário em 2026-11-18 (a Fase 3.1 foi pulada).

## Andamento (2026-11-18)

- Passos 1 a 5 feitos e testados (contrato e kit, banco, cards de plugin, blocos na nota,
  etiquetas e sugestão), com testes de navegador em `apps/app/e2e/fase4.spec.ts`.
- Passo 7 feito sobre um **modelo provisório** (um bloco por osso, 33 ossos, nomes da TA2).
- Passo 6 (modelo real) **pendente**: o script `plugins/esqueleto-3d/tools/exportar_esqueleto.py`
  está escrito mas não foi executado; rodar o Blender sobre o `.blend` do Z-Anatomy precisa da
  autorização do usuário (ver `plugins/esqueleto-3d/tools/LEIA-ME.md`).

## Decisões

### Cards de plugin

| Tema                     | Decisão                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Criação                  | `app.cards.proposeVisual({ content, fallback })`, permissão `cards:write`. Como em `cards.propose`, o app mostra a **versão de reserva** (texto e imagem) e o usuário escolhe o baralho e confirma                                               |
| `content`                | JSON do plugin, até 16 KB (ex.: `{ osso: "femur-esquerdo", camera: {...} }`). Só o plugin interpreta                                                                                                                                             |
| `fallback`               | Obrigatório: `{ front, back, imageAssetId? }`. Usado na busca, quando o plugin está desativado/removido, falha ou demora mais de 10 s, e no backup legível                                                                                       |
| Revisão                  | O app mostra o plugin numa área de altura fixa (superfície nova `card`, contexto `{ card: { content, side } }`); ao "Mostrar resposta", envia `side: "back"`. **Os botões Errei/Difícil/Bom/Fácil continuam do app**; o plugin nunca agenda nada |
| Lista do baralho e busca | Mostram a versão de reserva                                                                                                                                                                                                                      |
| Editar                   | Card visual não é editável pelo app (só excluir); o plugin pode oferecer edição depois                                                                                                                                                           |
| Agendamento              | Igual aos outros cards (automático ou personalizado do baralho)                                                                                                                                                                                  |

### Blocos de plugin na nota (`noteEmbed`)

| Tema                       | Decisão                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Criação                    | `app.notes.insertEmbed({ data, label, thumbnail? })` — permissões `notes:write` (e `assets:write` se houver miniatura). Só em modo edição |
| Na nota                    | Bloco **estático**: miniatura + rótulo. Nada de iframe dentro da nota (leve, rola bem, funciona sem o plugin)                             |
| Tocar no bloco             | Abre o painel do plugin com o contexto `{ embed: { data } }`                                                                              |
| Busca / texto plano        | O rótulo                                                                                                                                  |
| Plugin desativado/removido | Mostra o rótulo e "plugin indisponível"; o bloco continua na nota e pode ser apagado                                                      |
| Limites                    | `data` até 16 KB; até 20 blocos de plugin por nota                                                                                        |

### Imagens salvas por plugins

| Tema               | Decisão                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Método             | `app.assets.save({ data: ArrayBuffer, mime })` → `{ assetId }`; permissão `assets:write` |
| Formatos e tamanho | PNG, JPEG ou WebP, até 2 MB cada; o app reduz para no máximo 1600 px                     |
| Onde fica          | O mesmo armazenamento por hash das imagens de cards (entra no backup)                    |

### Arquivos do próprio plugin

`app.files.read(path)` → `ArrayBuffer` (formaliza o `plugin.readFile` que o host já tem). Sem
permissão: o plugin só lê a própria pasta.

### Abertura conforme a matéria (`activation`)

| Tema          | Decisão                                                                                                                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Etiquetas     | Matérias ganham **etiquetas** editáveis (a coluna `tags` já existe), ex.: `anatomia`                                                                                                                                                         |
| Manifesto     | `"activation": ["onSubjectTag:anatomia"]`                                                                                                                                                                                                    |
| Comportamento | Ao abrir uma nota cuja matéria (ou matéria acima) tem a etiqueta, aparece uma **sugestão discreta** "Abrir Esqueleto 3D" no topo da nota. **Nunca abre sozinho** (decisão do usuário, 2026-11-17: opção A, sem opção de abertura automática) |

### Segurança e desempenho

| Tema                    | Decisão                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebAssembly nos plugins | Liberar `'wasm-unsafe-eval'` na política dos plugins. Muitas bibliotecas (descompressão de modelos 3D, áudio, OCR) usam WebAssembly. O isolamento continua: sem rede além do declarado, sem acesso ao app |
| Um 3D por vez           | No máximo um plugin com superfície de card ou painel vivo ao mesmo tempo além de widgets; ao fechar, o iframe é descartado (libera a memória da GPU)                                                      |
| Tamanho                 | Limite de pacote continua 50 MB; o Esqueleto 3D deve ficar bem abaixo (meta: modelo ≤ 8 MB)                                                                                                               |

## Plugin Esqueleto 3D

### Modelo anatômico

- **Fonte:** **Z-Anatomy** (CC BY-SA 4.0), derivado do **BodyParts3D** (DBCLS, CC BY-SA 2.1 Japão).
  Distribuído como arquivo do Blender; não há GLB pronto, então há uma etapa de preparação.
- **Recorte inicial:** só o **sistema esquelético** (cerca de 200 ossos; lados esquerdo e direito
  separados, ex.: "Fêmur (esquerdo)").
- **Preparação** (script versionado em `plugins/esqueleto-3d/tools/`, executado uma vez, sem
  depender de ninguém refazer à mão):
  1. Exportar do Blender (em modo sem interface) a coleção do esqueleto para glTF, com o nome de
     cada osso preservado
  2. Simplificar a malha e quantizar (gltf-transform) até a meta de tamanho, conferindo a
     aparência
  3. Gerar `ossos.json`: id → nome em **português** (Terminologia Anatômica), nome em latim,
     região (crânio, coluna, membro superior…) e lado
- **Licença:** o modelo e o `ossos.json` derivado ficam sob **CC BY-SA 4.0**, com atribuição
  visível no plugin (Z-Anatomy e BodyParts3D). O código do plugin pode ter a licença do projeto.

### Funcionalidades

| Superfície                     | O que faz                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Painel e tela própria          | Modelo 3D (Three.js): girar, zoom com pinça, tocar num osso → destaca e mostra nome em português e latim; busca de ossos; filtro por região; "isolar região"                   |
| Criar questão visual           | Gera a miniatura com o osso destacado (`assets.save`) e propõe um card visual: frente "Que osso está destacado?" com o modelo; verso com o nome. Reserva: a miniatura e o nome |
| Revisão (`cardRenderer`)       | Modelo girável com o osso destacado na frente; no verso, o nome aparece destacado                                                                                              |
| Adicionar à nota (`noteEmbed`) | Insere um bloco com a miniatura e o nome do osso; tocar abre o modelo naquele osso                                                                                             |
| Sugestão automática            | Etiqueta `anatomia` na matéria                                                                                                                                                 |
| Widget (opcional)              | "Osso do dia" pequeno no Início                                                                                                                                                |

Permissões: `notes:read`, `notes:write`, `cards:write`, `assets:write`, `storage`. Sem rede.

## Passos

1. **Contrato e kit**: `files.read`, `assets.save`, `cards.proposeVisual`, `notes.insertEmbed`,
   superfície `card`, contexto `card` e `embed`, `wasm-unsafe-eval`; testes
2. **Banco**: busca usando a reserva dos cards de plugin (atualizar gatilhos); etiquetas de matéria
3. **Cards de plugin**: confirmação com prévia da reserva; exibição na revisão com troca para a
   reserva em caso de falha; lista e busca com a reserva
4. **Blocos de plugin na nota**: nó do editor, miniatura, tocar abre o painel, plugin indisponível
5. **Etiquetas e sugestão** de abrir o plugin na nota
6. **Modelo**: preparar o esqueleto (script), medir tamanho e desempenho no Galaxy A52 **antes**
   de construir a interface do plugin — se não ficar fluido, simplificar mais ou dividir por região
7. **Plugin Esqueleto 3D**: visualizador, seleção, busca, questão visual, card na revisão, bloco
   na nota, atribuição
8. Guia de plugins (cards visuais, blocos, imagens, arquivos, ativação); testes; relatório

## Critério de pronto

- Testes de navegador (computador e celular) com um modelo pequeno de teste:
  - criar questão visual → confirmar → card aparece na revisão com o plugin; responder agenda normalmente
  - plugin desativado → a revisão mostra a reserva (texto e imagem) e continua funcionando
  - plugin que não responde → reserva após 10 s
  - bloco na nota: inserir, ver miniatura, tocar abre o painel no ponto certo; com o plugin
    removido, mostra "indisponível"
  - etiqueta `anatomia` → sugestão aparece; sem etiqueta → não aparece
  - busca encontra cards visuais pela reserva; backup e restauração preservam cards, blocos e imagens
- No Galaxy A52: modelo abre em até 3 s, gira de forma fluida, tocar seleciona o osso certo,
  revisão de 20 cards visuais seguidos sem travar nem esquentar de forma anormal
- Lint, tipos e todos os testes passando; relatório em `documentos/relatorio-fase-4.md`

## Fora do escopo

- Outros sistemas (músculos, órgãos, vasos): o mesmo plugin pode crescer depois, por região
- Editar um card visual depois de criado
- Plugins com IA (Fase 5)
- Abrir o painel automaticamente sem pedir

## Riscos

| Risco                                         | Mitigação                                                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Modelo pesado demais para o celular           | Medir no passo 6, antes da interface; simplificar, quantizar ou dividir por região                       |
| Preparação do modelo depender de Blender      | Script em modo sem interface, versionado; o GLB gerado fica no repositório para não precisar refazer     |
| Nomes em português incorretos                 | Usar a Terminologia Anatômica; lista revisável em `ossos.json`; pedir revisão a um estudante de medicina |
| Toque impreciso em ossos pequenos (mãos, pés) | Raio de seleção maior no celular; lista/busca como alternativa ao toque                                  |
| Revisão lenta (um iframe 3D por card)         | Reaproveitar o mesmo iframe entre cards do mesmo plugin, trocando só o contexto                          |
| Licença share-alike                           | Modelo e dados derivados sob CC BY-SA 4.0 com atribuição; separado do código                             |

## Fontes

- Z-Anatomy, repositório e licença: https://github.com/Z-Anatomy/The-blend e https://github.com/Z-Anatomy/Models-of-human-anatomy
- Sobre o Z-Anatomy (base BodyParts3D): https://www.cgchannel.com/?p=136643
