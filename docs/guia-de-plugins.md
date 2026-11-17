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

| Pode                                                                               | Como                                                |
| ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| Ter uma **tela própria** (aparece no painel "Mais" e no menu lateral)              | `contributes.page`                                  |
| Abrir um **painel ao lado da nota** (folha inferior no celular)                    | `contributes.panel`                                 |
| Oferecer um **comando sobre o texto selecionado** na nota (ex.: "Definir palavra") | `contributes.commands` com `"context": "selection"` |
| Ter uma **tela de configurações** (dentro de Plugins)                              | `contributes.settings`                              |
| Ter **widgets** que o usuário põe no Início (até 5 por plugin)                     | `contributes.widgets`                               |
| **Ler** a nota aberta e o trecho selecionado                                       | permissão `notes:read`                              |
| **Inserir texto** na nota aberta (só em modo edição)                               | permissão `notes:write`                             |
| **Ver a lista de baralhos**                                                        | permissão `cards:read`                              |
| **Propor um flashcard** (o usuário revisa, escolhe o baralho e confirma)           | permissão `cards:write`                             |
| **Guardar dados próprios** no aparelho (até 256 KB por chave)                      | permissão `storage`                                 |
| **Acessar sites** específicos                                                      | campo `network`                                     |
| Mostrar um **aviso curto** na tela do app                                          | sem permissão                                       |

**Ainda não disponível:**

- **Mudar a aparência do texto da nota** (ex.: colorir palavras). Proposta: um ponto de extensão
  de _destaques_, em que o plugin envia palavras e cores e o app as pinta ao exibir a nota, sem
  alterar o conteúdo salvo.
- Mostrar conteúdo **dentro** da nota ou **dentro** de um card (previsto para a Fase 4).
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

## 8. Segurança: o que o usuário vê

Plugins instalados de arquivo ou link aparecem como **"origem não verificada"**, com um aviso na
instalação. Isso não impede o uso: o isolamento continua valendo e o plugin só faz o que está na
lista aprovada. A verificação de autoria (assinatura de pacotes) está prevista para a Fase 6,
junto com o catálogo de plugins.
