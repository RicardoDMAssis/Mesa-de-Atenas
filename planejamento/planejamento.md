# Estudarella — Planejamento do Projeto (v2)

**Status:** Planejamento
**Criado em:** 2026-11-16 · **Revisado em:** 2026-11-16 (v2 — versão anterior em `planejamento-v1.md`)

---

## 1. Visão Geral

App de estudos local-first para **Web (computador)** e **Android**, com core enxuto e um sistema
de plugins capaz de hospedar experiências ricas (3D, gráficos, IA).
Filosofia: simples por padrão, poderoso com extensões — inspirado no Obsidian.

- Usuário primário da v1: estudante universitário de Letras - Português.
- Escopo inicial: 2 usuários. Meta: distribuição pública.
- iOS e app desktop empacotado ficam fora do escopo até a validação (a arquitetura não os impede).

### Objetivos de arquitetura

| Objetivo | Como o plano atende |
|---|---|
| Escalável | Schema pronto para sync desde o dia 1; core separado da UI; plugins carregados sob demanda |
| Estável | Plugin isolado nunca derruba o app; todo card de plugin tem fallback estático; migrações versionadas; testes no core |
| Manutenção simples | Um único código de UI para web e Android; uma única ponte de plugins; monorepo com pacotes pequenos |
| Eficiente | Banco SQLite local; grafo em WebGL; plugins e modelos 3D só carregam quando usados |
| Plugins ricos | Plugin é uma página web completa (WebGL, WASM, Canvas) com pontos de extensão para painel, card e bloco de nota |
| Seguro | Sandbox sem acesso ao app, permissões declaradas e aprovadas, rede bloqueada por padrão, nenhuma chave no cliente |
| Personalizável | Temas por tokens de design, plugins ativáveis por matéria, configurações por plugin |

---

## 2. Problema que resolve

Apps de estudo existentes são ou simples demais (Quizlet), ou poderosos mas genéricos e com
curva de aprendizado alta (Anki, Obsidian, Notion). Estudantes de áreas específicas precisam de
ferramentas adaptadas ao seu contexto sem montar um sistema do zero.

Solução: núcleo funcional e enxuto (notas + SRS + grafo), extensível por plugins focados em cada
área do conhecimento.

---

## 3. Decisão central: app web-first, não React Native

A v1 previa Expo/React Native. A v2 troca para **um app web (React) empacotado no Android com
Capacitor**. É o mesmo modelo do Obsidian. Motivos:

1. **Plugins são web.** Em React Native o plugin rodaria em WebView no Android e em iframe na web:
   duas pontes, dois modelos de segurança. Num app web o plugin é um `<iframe>` nas duas
   plataformas — uma ponte, um sandbox.
2. **O caso do Esqueleto 3D exige isso.** O plugin precisa renderizar dentro do card de revisão e
   dentro da nota. Embutir iframes no meio de conteúdo web é trivial; embutir WebViews no meio de
   telas nativas é caro e frágil.
3. **Editor de notas e grafo.** As melhores bibliotecas (TipTap/ProseMirror, Sigma.js) são web.
   Em React Native elas acabariam rodando dentro de WebView de qualquer forma.
4. **Web é alvo de primeira classe.** No Expo, o SQLite para web ainda é marcado como alpha.

Custo aceito: a interface não usa componentes nativos do Android. Para um app de notas e
flashcards isso é pouco perceptível, desde que as telas sejam desenhadas mobile-first.

---

## 4. Stack Tecnológica

| Camada | Tecnologia | Motivo |
|---|---|---|
| Linguagem | TypeScript (strict) | Contrato de plugins e schema tipados |
| UI | React + Vite | Ecossistema, build rápido |
| Android | Capacitor | Empacota o mesmo app web; notificações, botão voltar, download de plugins |
| Computador | Web instalável (PWA) | Sem instalador; funciona offline |
| Estilo | Tailwind + primitivos Radix (no modelo do shadcn/ui, sem a CLI) | Componentes acessíveis; temas por variáveis CSS |
| Rotas | React Router | Simples e estável |
| Estado de UI | Zustand | Estado de interface e preferências do aparelho (tema, timer, navegação, Início) |
| Dados | SQLite + Drizzle ORM | Fonte única da verdade; schema e migrações tipadas |
| Driver SQLite — Android | O mesmo SQLite WASM + OPFS da web | Testado no emulador (Android 14) e no Galaxy A52: persiste ao fechar o app. O driver nativo (`@capacitor-community/sqlite`) fica como alternativa se aparecer um WebView incompatível |
| Driver SQLite — Web | SQLite WASM em Web Worker, persistido em OPFS | Mesmo SQL das duas plataformas |
| Editor de notas | TipTap (ProseMirror) | WYSIWYG amigável; blocos customizados para embeds de plugin |
| SRS | `ts-fsrs` (v6, FSRS-7) | Implementação mantida do FSRS; isolada em `packages/core/src/srs.ts` |
| Grafo | Sigma.js 4 + graphology + ForceAtlas2 (worker) | WebGL; 1.000 notas abrem com bloqueio máximo de ~240 ms |
| Gráficos de progresso | SVG próprio | Leve, usa as cores do tema |
| Pacotes de plugin | fflate | Leitura e geração de `.zip` |
| Validação | Zod | Valida manifestos e toda mensagem vinda de plugin |
| Nuvem (fase 5) | Supabase | Auth, Postgres com RLS, Storage, Edge Functions |
| Sync (fase 5) | PowerSync (candidato) | SQLite ↔ Postgres offline-first; usa os mesmos drivers acima. SDK Capacitor ainda em beta — reavaliar na hora |
| IA | Edge Function como proxy | Chaves ficam no servidor; cota por usuário |
| Testes | Vitest (core) + Playwright (fluxos) | Core testável sem UI |
| Repositório | pnpm workspaces + Biome + GitHub Actions | Monorepo simples |

### Regras de dados

- **Leitura reativa**: telas leem com `useLiveQuery`, que refaz a consulta sozinho quando alguma
  das tabelas observadas é alterada. Toda escrita avisa automaticamente; nenhuma tela "invalida" nada.
- **Escrita atômica**: várias gravações que precisam valer juntas usam `db.batch([...])`. Não se usa
  `db.transaction()`: o banco tem uma conexão só, e consultas de outras telas cairiam dentro dela.
- **Camada de consultas**: telas não escrevem SQL; chamam funções de `packages/db/src/queries/`,
  que já aplicam exclusão lógica e `updated_at`.
- **Preferências em dois lugares, de propósito**: preferências do aparelho (tema, tamanho de fonte)
  ficam no armazenamento local do dispositivo e não sincronizam; preferências de estudo (virada do
  dia, limite de cards novos) ficam na tabela `settings` e acompanham o usuário.
- **Arquivos fora do SQLite**: imagens, áudios e modelos ficam em uma pasta privada do app (OPFS),
  nomeados pelo hash SHA-256 do conteúdo. A tabela `assets` guarda só os metadados.
- **Uma aba por vez**: o banco no navegador aceita uma única aba ativa. Uma segunda aba mostra um
  aviso e assume sozinha quando a primeira é fechada.
- Zustand **não** guarda cópia de notas ou cards.

---

## 5. Core (vanilla)

Disponível sem nenhum plugin:

- **Notas** em texto rico, com links `[[entre notas]]`, organizadas em matéria > tópico > subtópico
- **Flashcards** — tipos nativos: básico (frente/verso, com imagem opcional) e cloze (lacuna).
  Agendamento automático (FSRS) ou **intervalos personalizados por baralho**; **prática** de um
  baralho a qualquer momento, sem mudar o agendamento
- **Mapa de grafos** interativo — diferencial principal
- **Timer de foco** (Pomodoro), com notificação no Android
- **Streak e progresso diário**
- **Busca** em notas e cards (sem diferenciar acentos)
- **Backup**: exportar/importar tudo em um arquivo (JSON + imagens)
- **Início personalizável** com widgets do app e de plugins (`instruções/inicio-personalizavel.md`)
- **Navegação** com barra inferior personalizável e painel "Ir para" (Ctrl+K), pronta para telas de plugins
- **Temas**: claro, escuro e personalizados

### Grafo — decisão fechada

O grafo é **gerado automaticamente**:

- Nós: notas e tópicos.
- Arestas: links `[[...]]` entre notas, hierarquia (nota → tópico → matéria) e referências criadas
  por plugins.
- Conectar "manualmente" é simplesmente escrever um link na nota. Não há editor de arestas separado.

---

## 6. Modelo de Dados

Convenções em todas as tabelas (preparam o sync sem custo agora):

- `id` UUID v7 gerado no cliente
- `created_at`, `updated_at`
- `deleted_at` (exclusão lógica — nunca `DELETE` direto)

| Tabela | Conteúdo |
|---|---|
| `subjects` | Árvore matéria/tópico/subtópico (`parent_id`) |
| `notes` | Documento TipTap (JSON), texto plano para busca, `subject_id` |
| `links` | Origem → destino, extraídos do conteúdo da nota a cada salvamento |
| `decks` | Baralhos, `subject_id`, `settings` (modo de agendamento e intervalos personalizados) |
| `cards` | `type` (`basic`, `cloze`, `plugin`), `content` JSON, `plugin_id`, `fallback`; agendamento: `srs` (estado interno do FSRS, opaco) e as cópias `due`, `state`, `reps`, `lapses`, `last_review` |
| `review_logs` | Uma linha por resposta: nota dada, estado anterior, horário, duração e o registro completo do FSRS em `data` |
| `study_sessions` | Pomodoros e sessões de revisão (base do streak) |
| `assets` | Metadados (hash, tipo, tamanho) de imagens, áudio e arquivos de plugins. O conteúdo fica fora do SQLite, endereçado pelo hash |
| `plugins` | Manifesto, versão, permissões concedidas, ativo/inativo, origem (`builtin`, `file`, `link`) e endereço de origem |
| `plugin_data` | Armazenamento chave-valor isolado por plugin |
| `settings` | Preferências, incluindo a hora de virada do dia para o streak |

Busca textual com FTS5 (`search_index`), mantida por gatilhos SQL, sem diferenciar acentos.

Fora do SQLite: os bytes de imagens (pasta privada `assets/`, por hash) e os arquivos de plugins
instalados (pasta privada `plugins/<id>/`).

---

## 7. Sistema de Plugins

### 7.1 Conceito

Um plugin é uma pequena aplicação web empacotada. Roda em `<iframe sandbox="allow-scripts allow-forms">`
(origem opaca), sem acesso ao DOM, ao banco ou ao armazenamento do app. Tudo que ele faz passa
pela ponte de mensagens e é verificado contra as permissões concedidas.

O desenvolvedor não usa `postMessage` na mão: usa o pacote **`@estudarella/plugin-sdk`**, tipado.

```ts
import { app } from "@estudarella/plugin-sdk";

const context = await app.ready();            // conecta, aplica o tema, diz onde o plugin está
const nota = await app.notes.getCurrent();    // exige notes:read
const { created } = await app.cards.propose({ front: "feliz", back: "que sente alegria" });
// o app mostra o card, o usuário escolhe o baralho e confirma
```

Referência completa para autores: `docs/guia-de-plugins.md`.

### 7.2 Protocolo

- RPC sobre `MessageChannel`: toda chamada tem `id`, `method`, `params`; toda resposta tem
  `id` e `result` ou `error`.
- Eventos do app para o plugin: `{ event, payload }`.
- Nomes em inglês (API pública).
- `apiVersion` no manifesto. Versão atual: "1". Acréscimos compatíveis (como widgets) não mudam a versão.
- Toda mensagem recebida é validada com Zod; limite de 60 chamadas por segundo; plugin que não
  chama o app em 10 s depois de abrir é dado como travado.
- Métodos v1: `host.getTheme`, `host.getContext`, `ui.toast`, `ui.openPage`, `ui.closePanel`,
  `notes.getCurrent`, `notes.insertText`, `decks.list`, `cards.propose`, `storage.get/set/delete/keys`.

### 7.3 Pontos de extensão

| Tipo | O que é | Exemplo |
|---|---|---|
| `panel` | Painel lateral (computador) ou folha inferior (celular), ligado ao contexto | Modelo 3D ao abrir nota de anatomia |
| `page` | Tela própria na navegação | Analisador de Edital |
| `command` | Ação sobre o texto selecionado na nota (barra no rodapé); abre o painel do plugin. Paleta: aceito no manifesto, ainda não exibido | "Definir palavra" |
| `widgets` | Quadros de altura fixa que o usuário põe no Início (até 5 por plugin, até 4 de plugins no Início) | "Busca rápida" do dicionário |
| `cardRenderer` (Fase 4) | Renderiza frente e verso de cards `type: plugin` na revisão | Card com modelo 3D girável |
| `noteEmbed` (Fase 4) | Bloco dentro da nota | Thumbnail 3D clicável |
| destaques (Fase 3.1) | Palavras coloridas na nota, sem alterar o texto | Marca-texto (será criado pelo usuário) |
| `settings` | Tela de configuração do plugin | Idioma do dicionário |

Eventos implementados: `theme.changed` e `context.changed` (ex.: outra palavra selecionada com o
painel aberto). Previstos conforme a necessidade dos plugins: `note.opened`, `note.closed`,
`review.cardShown`.

### 7.4 Manifesto

```json
{
  "id": "anatomy-3d",
  "name": "Esqueleto 3D",
  "version": "1.0.0",
  "apiVersion": "1",
  "entry": "index.html",
  "contributes": {
    "panel": { "title": "Anatomia 3D" },
    "cardRenderer": true,
    "noteEmbed": true
  },
  "activation": ["onSubjectTag:anatomia"],
  "permissions": ["notes:read", "notes:write", "cards:write", "assets:write", "storage"],
  "network": []
}
```

`activation` é aceito no manifesto mas ainda não é usado: hoje o plugin abre pelo que o usuário
toca (tela, comando, widget). Abrir sozinho conforme a matéria da nota fica para a Fase 4.

Um plugin é uma pasta com `manifest.json`, a página de entrada e quaisquer recursos, distribuída
como um arquivo compactado. Como o iframe isolado não busca arquivos por conta própria, há duas
formas de carregamento (já implementadas e testadas):

- **Código e estilo** referenciados pela página de entrada (`<script src>`,
  `<link rel="stylesheet">`) são embutidos pelo app ao abrir o plugin. Por isso o JavaScript
  precisa estar empacotado: um arquivo por `<script>`, sem `import` de caminhos relativos.
- **Demais arquivos** (modelos 3D, imagens, dados) são pedidos pelo plugin só quando necessários,
  com `plugin.readFile({ path })`, e chegam por transferência, sem cópia. O app recusa qualquer
  caminho fora da pasta do plugin.

O acesso aos arquivos passa por uma interface (`PluginSource`), com duas implementações: plugins
embutidos (servidos com o app) e instalados (pasta privada do app no aparelho).

### 7.5 Permissões

| Permissão | Libera |
|---|---|
| `notes:read` / `notes:write` | Ler a nota aberta e a seleção / inserir texto puro na nota |
| `cards:read` / `cards:write` | Ver a lista de baralhos / propor cards (o usuário confirma cada um) |
| `assets:write` | Salvar imagens e arquivos |
| `storage` | Chave-valor privado do plugin |
| `ai` | Chamar o proxy de IA do app (sujeito a cota) |
| `network` | Acessar **apenas** os domínios listados no manifesto |

O usuário vê e aprova as permissões ao ativar o plugin (tudo ou nada nesta versão). Sem `network`, o plugin não faz nenhuma
requisição externa (bloqueio por Content-Security-Policy injetada pelo app).

### 7.6 Estabilidade e eficiência

- **Carregamento sob demanda**: o iframe só é criado quando a tela, o painel, o widget visível ou
  o comando é usado.
- **Fallback obrigatório**: todo card de plugin carrega texto e imagem estáticos. Se o plugin for
  desinstalado, falhar ou demorar, a revisão continua com o fallback.
- **Embeds baratos**: na nota aparece uma imagem estática; o iframe interativo só abre ao clicar.
- **Limite de iframes vivos** e descarte dos inativos; plugin travado é encerrado sem afetar o app.
- **Recursos pesados** (modelos 3D) ficam em cache local após o primeiro uso.

### 7.7 Distribuição

1. Desde a Fase 3: plugins oficiais embutidos; instalação de arquivo `.zip` e de link (`.zip`
   publicado, ex.: release do GitHub). De arquivo/link = "origem não verificada", com aviso.
2. Kit e modelo: `packages/plugin-sdk` e `plugins/_template` (o kit será publicado no npm na Fase 6).
3. Fase 6: catálogo — um índice estático com versão e hash SHA-256 de cada pacote, verificado
   antes de instalar. Assinatura e revisão de plugins de terceiros vêm depois.

A política da Google Play proíbe baixar código executável nativo, mas abre exceção para
JavaScript em WebView; ainda assim os plugins precisam respeitar as demais políticas da loja.

### 7.8 Caso de referência — Esqueleto 3D

| Passo do usuário | Mecanismo |
|---|---|
| Abre a nota "Sistema Cardiovascular" | Evento `note.opened` + `activation: onSubjectTag:anatomia` |
| Modelo 3D aparece no painel | Ponto de extensão `panel`; Three.js + modelo GLB comprimido, dentro do iframe |
| Gira, dá zoom, clica na aorta | Tudo interno ao plugin |
| "Criar questão visual" | `app.assets.save(thumbnail)` + um método novo da Fase 4 para cards `type: plugin` (com `content` e `fallback`), seguindo a regra de `cards.propose`: o usuário confirma |
| "Adicionar referência à nota" | `app.notes.insertEmbed({ data, thumbnail })` — também vira aresta no grafo |
| Revisão com o modelo girável | `cardRenderer`: o app abre o iframe do plugin com o `content` do card; a avaliação (errei/difícil/bom/fácil) continua sendo do app |

Atenção à licença dos modelos anatômicos (ex.: BodyParts3D e Z-Anatomy exigem atribuição e
compartilhamento pela mesma licença).

### 7.9 Plugins oficiais planejados

| Plugin | Público | Pontos de extensão | Observação |
|---|---|---|---|
| Dicionário PT | Letras | `command`, `panel` | Primeiro plugin. Fonte de dados a definir (ver seção 11) |
| Conjugador de Verbos | Letras / Línguas | `command`, `page` | Pode funcionar 100% offline com base embutida |
| Leitor de Contexto | Línguas | `page`, `command` | Importa texto e adiciona vocabulário ao deck |
| Esqueleto 3D | Medicina | `panel`, `cardRenderer`, `noteEmbed` | Prova do sistema de plugins ricos |
| Analisador de Edital | Concursos | `page` | Depende do proxy de IA (fase 5) |

---

## 8. Segurança

- Iframe com origem opaca: sem cookies, sem armazenamento, sem DOM do app.
- Rede bloqueada por padrão; liberação por domínio declarado e aprovado.
- Permissões verificadas no app a cada chamada, não no SDK.
- Nenhuma chave de API no cliente ou em plugin; IA só pelo proxy autenticado, com cota.
- Supabase com Row Level Security em todas as tabelas.
- Conteúdo de notas sanitizado pelo schema do editor (sem HTML arbitrário).
- Pacotes de plugin verificados por hash antes de instalar ou atualizar.

---

## 9. Estrutura do Repositório

```
estudarella/
├── apps/
│   └── app/                     # App React (web + Android via Capacitor)
│       ├── src/
│       │   ├── routes/          # Telas: home, notas, revisão, grafo, foco, plugins, ajustes
│       │   ├── features/        # notes/, cards/, subjects/, graph/, focus/, progress/, home/, backup/
│       │   ├── navigation/      # Registro de telas, painel "Ir para", botão voltar do Android
│       │   ├── plugin-host/     # Iframe, ponte, permissões, registro, instalação, painel
│       │   ├── components/      # Componentes de interface (Radix + tokens do tema)
│       │   ├── data/            # Abertura do banco, leitura reativa, arquivos
│       │   ├── stores/          # Zustand (estado de interface e preferências do aparelho)
│       │   └── theme/           # Tokens de design e temas
│       ├── public/builtin-plugins/  # Plugins oficiais compilados (gerados de plugins/*)
│       ├── scripts/android-cdp.mjs  # Inspeção do app rodando no aparelho
│       └── android/             # Projeto Capacitor
│
├── packages/
│   ├── core/                    # Regras sem UI: agendamento, lacunas, dia de estudo, sequência, árvore
│   ├── db/                      # Schema Drizzle, migrações, queries, drivers (web / android)
│   ├── plugin-api/              # Tipos e schemas Zod do contrato (compartilhado app ↔ SDK)
│   └── plugin-sdk/              # SDK usado pelos autores de plugin
│
├── plugins/
│   ├── _template/               # Modelo para novos plugins (gera o .zip)
│   └── dicionario-pt/           # Plugin oficial
│
├── docs/guia-de-plugins.md      # Guia para autores de plugin
├── instruções/                  # Plano de cada fase
├── documentos/                  # Relatórios de cada fase
└── planejamento/                # Este plano geral
```

---

## 10. Fases de Desenvolvimento

### Fase 0 — Fundação e provas de risco
- [x] Monorepo, app React + Vite, Tailwind, tema claro/escuro
- [x] Navegação base (barra lateral no computador, barra inferior no celular)
- [x] Camada de dados: schema Drizzle, migrações, convenções de sync, driver web
- [x] Escrita atômica (`db.batch`), leitura reativa (`useLiveQuery`) e camada de consultas
- [x] Armazenamento de arquivos (`AssetStore`, por hash)
- [x] Contrato de plugins inicial (`plugin-api`: manifesto e protocolo)
- [x] Plugins com vários arquivos (código e estilo embutidos; demais arquivos sob demanda)
- [x] PWA: instalável e funcionando sem internet
- [x] **Prova 1 (web):** banco persistindo no navegador via OPFS
- [x] **Prova 2 (web):** iframe isolado com WebGL, ponte de mensagens, rede e navegação externa bloqueadas
- [x] CI: lint, tipos, testes, build, testes de navegador (escrito; ainda não executado em servidor)
- [x] Projeto Android gerado (Capacitor)
- [x] Compilar e rodar no Android (emulador Pixel 6, Android 14, WebView Chrome 113)
- [x] **Prova 1 (Android):** o próprio SQLite WASM + OPFS persiste no WebView (sobrevive a fechar o app à força). Driver nativo não foi necessário por ora
- [x] **Prova 2 (Android):** diagnóstico todo verde no WebView (3D, vários arquivos, isolamento, rede bloqueada)
- [ ] Prova 2 com modelo GLB real e biblioteca 3D (o teste atual usa um modelo binário simples em WebGL puro)

Achado da Prova 2: um iframe isolado ainda consegue navegar a si mesmo para um site externo
(vazando dados pela URL). Corrigido com `frame-src 'none'` na política do app e coberto por teste.

Relatório completo: `documentos/relatorio-fase-0.md`.

### Fase 1 — Notas e Flashcards
- [x] Componentes de interface (Radix + tokens do tema)
- [x] Hierarquia matéria > tópico > subtópico (criar, renomear, mover, excluir)
- [x] Editor de notas com salvamento automático, links `[[...]]` (com criação de nota), "notas que apontam para esta"
- [x] Baralhos; cards frente/verso (com imagem) e lacunas
- [x] Revisão com FSRS, intervalos previstos, atalhos e virada do dia configurável
- [x] Busca textual em notas e cards
- [x] Backup: exportar/importar (inclui imagens)
- [x] Tela inicial com o que vence hoje e notas recentes

Plano: `instruções/fase-1.md` · Relatório: `documentos/relatorio-fase-1.md`

### Fase 2 — Grafo, Foco e Progresso
- [x] Consultas e regras: dados do grafo, sessões, sequência de dias, séries de progresso
- [x] Grafo com Sigma.js (filtros, cores por matéria); toque no nó abre a nota
- [x] Grafo local na tela da nota
- [x] Timer Pomodoro com notificação e escolha de matéria
- [x] Registro de sessões de foco e de revisão
- [x] Sequência de dias e progresso (início + tela de progresso)
- [x] Rascunho local das notas (corrige perda da última edição ao recarregar)
- [x] Colar `[[Nota]]` / `[[Nota]](texto)` cria links
- [ ] Notificação do timer verificada em celular real
- **Marco: v1 utilizável pelos 2 usuários**

Plano: `instruções/fase-2.md` · Relatório: `documentos/relatorio-fase-2.md`

### Fase 3 — Plugins v1 (contextuais)
- [x] `plugin-api`, `plugin-sdk`, host com permissões e CSP
- [x] Pontos de extensão: `panel`, `command`, `page`, `settings`
- [x] Tela de gerenciamento de plugins e aprovação de permissões
- [x] Plugin Dicionário PT

- [x] Instalação de `.zip` e de link; guia (`docs/guia-de-plugins.md`) e modelo (`plugins/_template`)

- [x] Início personalizável com widgets, inclusive de plugins (`instruções/inicio-personalizavel.md`)

Plano: `instruções/fase-3.md` · Relatório: `documentos/relatorio-fase-3.md`

### Fase 3.1 — Destaques de palavras por plugins
- [ ] Permissão `notes:highlight` e métodos `highlights.*` no contrato e no kit
- [ ] Motor de correspondência (palavra inteira, sem acento, maior termo primeiro)
- [ ] Pintura no editor (decorações, sem alterar o texto), controles e legenda
- [ ] Guia e modelo atualizados (o plugin "Marca-texto" será criado pelo usuário)

Plano: `instruções/fase-3.1-destaques.md`

### Fase 4 — Plugins v2 (ricos)
- [ ] Contrato e kit: `files.read`, `assets.save`, `cards.proposeVisual`, `notes.insertEmbed`, superfície `card`
- [ ] Cards de plugin com reserva estática (`cardRenderer`) na revisão
- [ ] Blocos de plugin na nota (`noteEmbed`) com miniatura
- [ ] Etiquetas de matéria e sugestão de abrir o plugin (`activation`)
- [ ] Modelo do esqueleto (Z-Anatomy/BodyParts3D, CC BY-SA) preparado e medido no celular
- [ ] Plugin Esqueleto 3D (caso de referência completo)

Plano: `instruções/fase-4.md`

### Fase 5 — Conta, Sync e IA
- [ ] Autenticação (Supabase)
- [ ] Sync entre dispositivos
- [ ] Proxy de IA com cota
- [ ] Plugin Analisador de Edital

### Fase 6 — Distribuição pública
- [ ] Publicação na Play Store e site
- [ ] Catálogo de plugins com verificação de hash
- [x] Guia e modelo para autores de plugin (feitos na Fase 3)
- [ ] Publicar o kit de plugins no npm

---

## 11. Decisões em Aberto

- ~~Fonte do Dicionário PT~~ — decidido: Wikcionário, com cache das últimas palavras consultadas.
- ~~Imagens em cards~~ — feito na Fase 1. **Imagens dentro das notas**: ainda sem fase definida.
- **Importação de decks do Anki**: entra no core, vira plugin ou fica fora?
- **Modelo de negócio** (recomendação, a confirmar): app e plugins oficiais gratuitos, sem limites no uso local; assinatura única para o que tem custo de servidor (sync entre dispositivos + cota de IA). SDK e plugins oficiais com código aberto. Plugins pagos de terceiros só depois de existir um catálogo ativo. Só precisa ser fechado antes da Fase 5.
- **Sync**: confirmar PowerSync ou alternativa no início da Fase 5.
- ~~Nome final~~ — decidido: **Estudarella** (o repositório no GitHub chama-se Mesa-de-Atenas).

---

## 12. Referências e Inspirações

- **Obsidian** — plugins, grafo, dados do usuário; mesma arquitetura web + Capacitor
- **Anki** — SRS robusto, FSRS
- **VS Code** — manifesto com pontos de contribuição e ativação sob demanda
- **Figma** — plugins em iframe isolado com ponte de mensagens
- **LingQ** — vocabulário em contexto
- **Duolingo** — gamificação suave
