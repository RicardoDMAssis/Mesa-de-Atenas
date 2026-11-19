# Guia: como criar um plugin do Estudarella

Este guia explica como criar, testar e instalar um plugin próprio. Ele vale para a **versão 1 do
contrato de plugins** (`"apiVersion": "1"`).

## 1. O que é um plugin

Um plugin é uma **pequena página web** (HTML + JavaScript/TypeScript + CSS) que o app abre de forma
isolada. Ele:

- roda separado do app: não vê a tela do app, o banco de dados nem os dados de outros plugins;
- conversa com o app por mensagens, usando o kit **`@estudarella/plugin-sdk`**;
- só faz o que declarou no `manifest.json` **e** o usuário aprovou ao ativar;
- só acessa a internet nos sites que declarou.

Isso significa que você não precisa saber React nem como o app funciona por dentro: basta HTML,
JavaScript e o kit.

## 2. O que um plugin pode (e não pode) fazer hoje

| Pode                                                                               | Como                                                            |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Ter uma **tela própria** (aparece no painel "Mais" e no menu lateral)              | `contributes.page`                                              |
| Abrir um **painel ao lado da nota** (folha inferior no celular)                    | `contributes.panel`                                             |
| Oferecer um **comando sobre o texto selecionado** na nota (ex.: "Definir palavra") | `contributes.commands` com `"context": "selection"`             |
| Ter uma **tela de configurações** (dentro de Plugins)                              | `contributes.settings`                                          |
| Ter **widgets** que o usuário põe no Início (até 5 por plugin)                     | `contributes.widgets`                                           |
| **Ler** a nota aberta e o trecho selecionado                                       | permissão `notes:read`                                          |
| **Inserir texto** na nota aberta (só em modo edição)                               | permissão `notes:write`                                         |
| **Ver a lista de baralhos**                                                        | permissão `cards:read`                                          |
| **Propor um flashcard** (o usuário revisa, escolhe o baralho e confirma)           | permissão `cards:write`                                         |
| **Guardar dados próprios** no aparelho (até 256 KB por chave)                      | permissão `storage`                                             |
| **Acessar sites** específicos                                                      | campo `network`                                                 |
| Mostrar um **aviso curto** na tela do app                                          | sem permissão                                                   |
| Trazer **mascotes** que o usuário pode escolher (até 5 por plugin)                 | `contributes.mascots`                                           |
| Criar **cards visuais**, desenhados pelo plugin na revisão (ex.: modelo 3D)        | `contributes.cardRenderer` + permissão `cards:write`            |
| Inserir **blocos** na nota (miniatura + rótulo; tocar abre o painel)               | `contributes.noteEmbed` + permissão `notes:write`               |
| **Salvar imagens** (miniaturas para cards e blocos)                                | permissão `assets:write`                                        |
| **Ler arquivos** da própria pasta (ex.: um modelo `.glb`)                          | sem permissão                                                   |
| Ser **sugerido** nas notas de matérias com uma etiqueta (ex.: `anatomia`)          | `activation: ["onSubjectTag:anatomia"]`                         |
| Usar **WebAssembly** (descompressão de modelos, áudio, OCR)                        | sem permissão                                                   |
| **Falar pelo mascote** do usuário                                                  | permissão `mascot`                                              |
| Criar **vários cards de uma vez** (até 200, uma confirmação)                       | permissão `cards:write`                                         |
| **Ver, corrigir e excluir os próprios cards** e ver o desempenho neles             | permissão `cards:own` (correção e exclusão: o usuário confirma) |
| **Destacar palavras** nas notas, sem alterar o texto (inclusive fórmulas: H₂SO₄)   | `contributes.highlights` + permissão `notes:highlight`          |
| **Guardar arquivos** (`.mol`, `.csv`, `.json`, áudio…), exportar e importar        | permissão `storage`                                             |
| **Sugerir uma nota nova** (o usuário confere, escolhe a matéria e confirma)        | permissão `notes:create`                                        |
| **Tirar foto ou escolher imagens** (câmera ou galeria do sistema)                  | `<input type="file" accept="image/*">`, sem permissão           |

**Ainda não disponível:**

- Ler outras notas além da aberta, ou cards que não foram criados pelo plugin.
- Câmera ao vivo (vídeo), microfone e sensores; fotos, só pelo seletor do sistema (acima).
- Blocos interativos dentro da nota (o bloco é estático; o interativo abre no painel).
- Usar inteligência artificial pelo app (previsto para a Fase 5).
- Comandos no painel "Ir para" (`"context": "palette"` já é aceito no manifesto, mas ainda não
  aparece em lugar nenhum).

## 3. O que você precisa

- **Node 24+** e **pnpm** (`corepack enable pnpm`).
- Uma cópia do repositório do Estudarella. O kit ainda não está publicado no npm (previsto para a
  Fase 6), então, por enquanto, plugins são criados **dentro do repositório**, na pasta `plugins/`.

## 4. Passo a passo

### 4.1 Copie o modelo

```bash
cp -r plugins/_template plugins/meu-plugin
```

No `package.json` da cópia, troque o `name` (ex.: `"@estudarella/plugin-meu-plugin"`) e rode
`pnpm install` na raiz do repositório.

O modelo já vem com um exemplo que conta as palavras da nota aberta ou do trecho selecionado.

### 4.2 Estrutura da pasta

```
plugins/meu-plugin/
├── public/manifest.json   ← identidade, permissões e onde o plugin aparece
├── index.html             ← página de entrada
├── src/main.ts            ← código do plugin (usa o kit)
├── src/style.css          ← estilo
├── vite.config.ts         ← gera o formato que o app aceita (não altere)
└── scripts/zip.mjs        ← empacota o plugin em .zip
```

### 4.3 Edite o `manifest.json`

```json
{
  "id": "meu-plugin",
  "name": "Meu plugin",
  "description": "O que o plugin faz, em uma frase.",
  "author": "Seu nome",
  "icon": "sparkles",
  "version": "0.1.0",
  "apiVersion": "1",
  "entry": "index.html",
  "contributes": {
    "page": { "title": "Meu plugin" },
    "panel": { "title": "Meu plugin" },
    "commands": [{ "id": "contar", "title": "Contar palavras", "context": "selection" }],
    "settings": false,
    "widgets": [{ "id": "resumo", "title": "Meu resumo", "size": "small" }]
  },
  "permissions": ["notes:read", "storage"],
  "network": []
}
```

Regras de cada campo:

| Campo                 | Regra                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | Único. Letras minúsculas, números e hífen (ex.: `cores-de-verbos`). Não pode repetir o de um plugin oficial                   |
| `name`                | Até 60 caracteres. É o que o usuário vê                                                                                       |
| `description`         | Até 300 caracteres. Aparece na tela de Plugins e na instalação                                                                |
| `icon`                | Um de: `book-a`, `languages`, `graduation-cap`, `sparkles`, `box`. Qualquer outro vira uma peça de quebra-cabeça              |
| `version`             | Formato `1.2.3`. Aumente a cada versão nova                                                                                   |
| `apiVersion`          | Sempre `"1"` nesta versão do app                                                                                              |
| `entry`               | Página de entrada, normalmente `index.html`                                                                                   |
| `contributes`         | Onde o plugin aparece (seção 2). `commands` precisa de `panel`: o comando abre o painel                                       |
| `contributes.widgets` | Cada widget tem `id`, `title` (até 40 caracteres) e `size`: `small` (120 px de altura), `medium` (200 px) ou `large` (320 px) |
| `permissions`         | Só o que o plugin realmente usa: `notes:read`, `notes:write`, `cards:read`, `cards:write`, `storage`                          |
| `network`             | Lista de sites, no formato `https://dominio.com` (sem caminho). Vazio = sem internet                                          |

Peça **o mínimo de permissões**: o usuário vê a lista antes de ativar.

### 4.4 Escreva o código com o kit

```ts
import { app, PluginError } from "@estudarella/plugin-sdk";

// 1. Sempre comece com app.ready(): conecta ao app, aplica o tema e devolve o contexto.
const context = await app.ready();

// 2. Veja onde o plugin está: "page", "panel", "settings" ou "widget".
if (context.surface === "panel" && context.command) {
  // Aberto por um comando sobre o texto selecionado:
  console.log(context.command.id, context.command.selection);
}

if (context.surface === "widget") {
  // context.widget = { id: "resumo", size: "small" } — desenhe algo compacto, sem rolagem.
}

// 3. Use o que as permissões liberam.
const nota = await app.notes.getCurrent(); // notes:read
await app.notes.insertText("texto"); // notes:write
const baralhos = await app.decks.list(); // cards:read
const { created } = await app.cards.propose({ front: "f", back: "v" }); // cards:write
await app.storage.set("chave", { qualquer: "JSON" }); // storage
const valor = await app.storage.get("chave");
await app.ui.toast("Pronto!");
await app.ui.openPage(); // abre a tela própria
await app.ui.closePanel();

// 4. Reaja a mudanças.
app.on("context.changed", (novo) => {
  /* ex.: outra palavra selecionada com o painel aberto */
});
app.on("theme.changed", () => {
  /* o kit já aplica as cores; use se precisar redesenhar */
});
```

**Erros.** Toda chamada pode falhar com `PluginError`, que tem um `code`:

| `code`           | Quando                                               |
| ---------------- | ---------------------------------------------------- |
| `forbidden`      | Falta a permissão (ou o usuário não a concedeu)      |
| `invalid_params` | Parâmetros fora do formato (ex.: texto longo demais) |
| `unknown_method` | Método que não existe nesta versão                   |
| `rate_limited`   | Mais de 60 chamadas por segundo                      |
| `internal`       | Erro do app                                          |

**Tema.** Depois de `app.ready()`, estas variáveis CSS ficam disponíveis e acompanham o tema claro
ou escuro: `--bg`, `--surface`, `--text`, `--muted`, `--border`, `--accent`, `--accent-contrast`.

### 4.5 Gere o `.zip`

```bash
pnpm --filter @estudarella/plugin-meu-plugin zip
```

Isso cria `plugins/meu-plugin/meu-plugin-0.1.0.zip`.

### 4.6 Instale e teste

1. No app, abra **Plugins** (painel "Mais" no celular).
2. Toque em **Instalar de arquivo** e escolha o `.zip`. Ou, se o arquivo estiver publicado (por
   exemplo, numa release do GitHub), use **De um link**.
3. Confira a lista de permissões e sites e toque em **Instalar e ativar**.
4. Teste cada lugar em que o plugin aparece (tela própria, painel, comando ao selecionar texto).

Para atualizar, aumente `version` no manifesto, gere o `.zip` de novo e instale por cima: o app
mantém a ativação, as permissões já concedidas e os dados guardados.

## 5. Padrões obrigatórios

O app recusa ou bloqueia o plugin se estes padrões não forem seguidos:

1. **Um único arquivo de código e um de estilo**, referenciados por caminho relativo em
   `<script src>` e `<link rel="stylesheet">`. O `vite.config.ts` do modelo já garante isso;
   não use `import` dinâmico nem divida o código.
2. **Nenhum código ou estilo vindo de fora** (CDN, fontes externas): é bloqueado. Inclua tudo no
   pacote. Imagens e dados podem ser lidos da própria pasta com caminhos relativos.
3. **Internet só para os sites do `network`**, e só por `fetch`. O site precisa aceitar chamadas
   de outras origens (cabeçalho `Access-Control-Allow-Origin`).
4. **Sem `localStorage`, cookies ou abrir janelas/links**: o isolamento bloqueia. Use
   `app.storage` para guardar dados.
5. **Nunca coloque dados da nota em `innerHTML`**. Use `textContent` (veja o modelo).
6. **Comece sempre com `await app.ready()`.** Se o plugin não chamar o app em 10 segundos
   depois de abrir, o app mostra "não respondeu" no lugar dele.
7. **Pacote** de até 20 MB compactado, 50 MB descompactado e 300 arquivos.

### Widgets no Início

- O usuário escolhe quais widgets aparecem no Início (botão **Personalizar**); o plugin não se
  adiciona sozinho.
- A altura é fixa pelo `size` e o widget não pode crescer: desenhe algo compacto e sem rolagem.
- O widget só carrega quando aparece na tela, e há no máximo 4 widgets de plugins no Início.
- Para "abrir mais", use `app.ui.openPage()` (leva à tela própria do plugin). Para passar o que o
  usuário escolheu, guarde antes com `app.storage.set` e leia na tela própria (veja o widget
  "Busca rápida" do Dicionário PT).
- Se o plugin for desativado, o widget some do Início; volta se for reativado.

### Cards visuais

Com `contributes.cardRenderer: true` e a permissão `cards:write`, o plugin propõe um card cuja
frente e verso ele mesmo desenha:

```js
const { assetId } = await app.assets.save({ data: pngArrayBuffer, mime: "image/png" });
await app.cards.proposeVisual({
  content: { osso: "femur-esquerdo" }, // seus dados, até 16 KB; só o seu plugin interpreta
  fallback: { front: "Que osso está destacado?", back: "Fêmur (esquerdo)", image: assetId },
});
```

- O app mostra a **reserva** (`fallback`) ao usuário, que escolhe o baralho e confirma.
- Na revisão, o app abre o plugin na superfície `card`, numa área de altura fixa, com
  `context.card = { content, side }`. Ao tocar em "Mostrar resposta", chega o evento
  `context.changed` com `side: "back"`. O mesmo iframe é reaproveitado entre cards seguidos.
- **Os botões Errei/Difícil/Bom/Fácil são do app**: o plugin nunca agenda nada.
- A reserva aparece na busca, na lista do baralho, quando o plugin está desativado ou removido,
  se ele falhar ao carregar e se não chamar o app em até 10 segundos.
- Card visual não é editável pelo app (só excluir).

### Blocos na nota

Com `contributes.noteEmbed: true` e a permissão `notes:write`, o plugin insere um bloco na nota
aberta (só em modo edição, até 20 por nota):

```js
await app.notes.insertEmbed({
  data: { osso: "femur-esquerdo" },
  label: "Fêmur (esquerdo)",
  thumbnail: assetId,
});
```

O bloco é **estático** (miniatura + rótulo): nada de iframe dentro da nota. Tocar nele abre o
painel do plugin com `context.embed.data`. O rótulo entra na busca. Com o plugin desativado ou
removido, o bloco mostra "Plugin indisponível" e continua na nota.

### Notas novas

Com a permissão `notes:create`, o plugin sugere uma nota; o app mostra a tela "Criar nota", onde o
usuário corrige o título e o texto, escolhe a matéria e confirma. Depois o app abre a nota.

```js
const { noteId } = await app.notes.propose({
  title: "Citologia",
  text: "## Organelas\nA mitocôndria faz a respiração celular.\n\n- ribossomo\n- lisossomo",
  // Opcional (pede contributes.noteEmbed): um bloco do plugin no topo da nota.
  embed: { data: { fotos: [fileId] }, label: "Foto original", thumbnail: assetId },
});
// noteId === null: o usuário cancelou.
```

O texto é puro, sem HTML: `## ` e `### ` viram títulos, linhas com `- ` viram lista e uma linha
em branco separa parágrafos. Até 100 mil caracteres.

**Fotos:** um `<input type="file" accept="image/*">` dentro do plugin abre a galeria; com
`capture="environment"`, abre a câmera. O plugin recebe só a foto escolhida. Exemplo completo:
`plugins/foto-nota`.

### Arquivos, imagens e sugestão por etiqueta

- `app.files.read("modelos/esqueleto.glb")` devolve um `ArrayBuffer` com um arquivo da pasta do
  plugin. Arquivos grandes não precisam entrar no HTML.
- `app.assets.save({ data, mime })` aceita PNG, JPEG ou WebP de até 2 MB; o app reduz para no
  máximo 1600 px e devolve o `assetId`. As imagens entram no backup.
- `"activation": ["onSubjectTag:anatomia"]`: nas notas de matérias com a etiqueta `anatomia`
  (ou dentro de uma matéria com ela), aparece o botão "Abrir <painel>". **O painel nunca abre
  sozinho.** O usuário dá etiquetas em Notas → menu da matéria → Etiquetas.

### Vários cards de uma vez

```js
const { created, ids } = await app.cards.proposeBatch({
  deckName: "Química orgânica", // sugestão, se o usuário quiser criar um baralho novo
  cards: [
    { front: "Etanol", back: "C₂H₆O", key: "etanol" },
    { cloze: "O {{c1::metano}} tem fórmula CH₄", key: "metano" },
    { content: { molecula: "co2" }, fallback: { front: "Que molécula?", back: "CO₂" }, key: "co2" },
  ],
});
```

- Uma tela só: o usuário escolhe o baralho, marca e desmarca, edita qualquer card e confirma.
- `key` (opcional, única no seu plugin) faz o app reconhecer cards que você já criou: eles
  aparecem desmarcados como "já existe". Sem `key`, o app compara a frente no baralho escolhido.
- Um item inválido recusa o lote inteiro (`invalid_params`). Cards visuais exigem `cardRenderer`.
- Volta `{ created, ids }` só com os cards aceitos.

### Os próprios cards (permissão `cards:own`)

O app registra qual plugin criou cada card. Com `cards:own`, você enxerga **só os seus**:

```js
const meus = await app.cards.listOwn({ key: "etanol" }); // ou { deckId }, páginas com { after }
const stats = await app.cards.statsOwn(meus.map((c) => c.id)); // estado, acertos, esquecimentos
await app.cards.updateContent(id, { molecula: "co2", angulo: 30 }); // só cards visuais; sem pedir
await app.cards.proposeUpdate([{ id, back: "C₂H₅OH" }]); // o usuário vê antes/depois e confirma
await app.cards.proposeDelete([id]); // o usuário confirma
```

- `editedAt` diz quando o usuário editou o card pelo app. Correções sugeridas para cards que ele
  personalizou aparecem **desmarcadas**: respeite o que ele escreveu.
- O plugin nunca muda quando um card volta na revisão.

### Destaques nas notas

Com `contributes.highlights: true` e a permissão `notes:highlight`, o plugin define termos e o app
os pinta em todas as notas (edição e leitura), **sem alterar o texto salvo** e sem precisar abrir
o plugin:

```js
await app.highlights.set([
  { term: "portanto", color: "blue", label: "conectivo conclusivo" },
  { term: "H2SO4", color: "green", style: "formula", label: "ácido sulfúrico" }, // aparece H₂SO₄
  { term: "sódio", color: "orange", label: "elemento", command: "elemento" }, // tocar abre o painel
]);
```

- Casa **palavra inteira**, sem diferenciar maiúsculas; acentos ignorados por padrão
  (`ignoreAccents: false` para exigir). Termos podem ter números e sinais (`H2O`, `Fe3+`).
- Cores (só a paleta do tema): `purple`, `pink`, `green`, `orange`, `blue`, `cyan`, `brown`, `gray`.
- Estilos: `marker` (marca-texto, padrão), `text`, `underline` e `formula` (números como
  subscrito e cargas como sobrescrito).
- `set` substitui todas as suas regras (até 500); `get` e `clear` também existem. Termos que se
  sobrepõem: vale o mais longo.
- O usuário esconde os destaques no menu da nota, e eles somem ao desativar o plugin.

### Arquivos

```js
const { fileId } = await app.storage.saveFile({
  name: "etanol.mol",
  mime: "chemical/x-mdl-molfile",
  data,
});
const bytes = await app.storage.readFile(fileId);
const lista = await app.storage.listFiles();
await app.storage.exportFile(fileId); // o usuário recebe o arquivo
const escolhido = await app.storage.pickFile([".csv"]); // o usuário escolhe; null se cancelar
await app.storage.deleteFile(fileId);
```

- Tipos: texto, CSV, Markdown, JSON, XML, molécula (`.mol`, `.pdb`), modelo 3D (`.glb`), áudio
  (MP3, OGG, WAV), imagem (JPEG, PNG, WebP, sem redução) e binário genérico. Nunca HTML nem
  scripts.
- Até 10 MB por arquivo e 100 MB por plugin. Os arquivos entram no backup. O usuário vê o espaço
  usado na tela de Plugins e escolhe se apaga os arquivos ao remover o plugin.
- Chaves de `storage` começando com `__` são reservadas do app.

### Mascotes

Um plugin pode trazer mascotes no formato do [open-bot-avatar](https://github.com/DominikScholz/open-bot-avatar):
um contorno SVG numa caixa `0 0 100 100` e a posição dos olhos. O app valida a geometria; um
mascote inválido é ignorado. Eles aparecem em **Ajustes → Mascote** enquanto o plugin estiver
ativo.

```json
"contributes": {
  "mascots": [
    {
      "id": "coruja",
      "name": "Coruja",
      "color": "#8b5cf6",
      "catchphrase": "Uhu!",
      "body": { "path": "M50 15 C75 15 85 35 85 55 ..." },
      "eyes": { "x": 50, "y": 46, "spacing": 18, "scale": 1.1 }
    }
  ]
}
```

Com a permissão `mascot`, o plugin faz o mascote do usuário (qualquer um que ele tenha escolhido)
dizer uma frase. O balão mostra o nome do plugin junto. Sem mascote escolhido, ou com os avisos
silenciados, nada aparece e a chamada devolve `{ shown: false }`.

```js
await app.mascot.say("Você aprendeu 10 palavras novas hoje!", "happy"); // "idle" | "thinking" | "happy"
```

Use com moderação: uma frase quando algo importante acontece, não a cada clique.

## 6. Boas práticas

- Funcione bem no celular: a folha inferior tem cerca de 60% da altura da tela; use botões com
  pelo menos 40 px de altura.
- Mostre um estado de "carregando" em consultas à internet e uma mensagem clara sem conexão.
- Guarde em cache o que for consultado na internet (veja o Dicionário PT, que guarda as últimas
  palavras).
- Cite a fonte de dados de terceiros e respeite a licença deles.
- Teste com o tema escuro.

## 7. Exemplos no repositório

- `plugins/_template` — modelo mínimo: tela, painel e comando sobre a seleção, com `notes:read` e
  `storage`.
- `plugins/dicionario-pt` — plugin completo: consulta o Wikcionário (`network`), guarda cache
  (`storage`), propõe cards (`cards:write`) e tem tela de configurações.
- `plugins/esqueleto-3d` — modelo 3D (`files.read`), cards visuais, blocos na nota.
- `plugins/foto-nota` — fotos pela câmera ou galeria, leitura de texto com WebAssembly
  (Tesseract) sem internet, nota sugerida com `notes.propose` e as fotos guardadas num bloco.

## 8. Segurança: o que o usuário vê

Plugins instalados de arquivo ou link aparecem como **"origem não verificada"**, com um aviso na
instalação. Isso não impede o uso: o isolamento continua valendo e o plugin só faz o que está na
lista aprovada. A verificação de autoria (assinatura de pacotes) está prevista para a Fase 6,
junto com o catálogo de plugins.
