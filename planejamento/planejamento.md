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
| Android | Capacitor | Empacota o mesmo app web; acesso a SQLite nativo, arquivos, notificações |
| Computador | Web instalável (PWA) | Sem instalador; funciona offline |
| Estilo | Tailwind + shadcn/ui (Radix) | Componentes acessíveis; temas por variáveis CSS |
| Rotas | React Router | Simples e estável |
| Estado de UI | Zustand | Só estado de interface (painel aberto, tema, sessão atual) |
| Dados | SQLite + Drizzle ORM | Fonte única da verdade; schema e migrações tipadas |
| Driver SQLite — Android | `@capacitor-community/sqlite` | SQLite nativo (WASM+OPFS não é confiável no WebView do Android) |
| Driver SQLite — Web | SQLite WASM em Web Worker, persistido em OPFS | Mesmo SQL das duas plataformas |
| Editor de notas | TipTap (ProseMirror) | WYSIWYG amigável; blocos customizados para embeds de plugin |
| SRS | `ts-fsrs` | Implementação mantida do FSRS; não reimplementar |
| Grafo | Sigma.js + graphology | WebGL, aguenta milhares de nós |
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
- **Flashcards** com FSRS — tipos nativos: básico (frente/verso) e cloze (lacuna)
- **Mapa de grafos** interativo — diferencial principal
- **Timer de foco** (Pomodoro), com notificação no Android
- **Streak e progresso diário**
- **Backup**: exportar/importar tudo em um arquivo (JSON + anexos); notas exportáveis em Markdown
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
| `decks` | Baralhos, `subject_id` |
| `cards` | `type` (`basic`, `cloze`, `plugin`), `content` JSON, `plugin_id`, `fallback`, estado FSRS (due, stability, difficulty, state, reps, lapses) |
| `review_logs` | Uma linha por resposta (necessário para otimizar os parâmetros do FSRS) |
| `study_sessions` | Pomodoros e sessões de revisão (base do streak) |
| `assets` | Metadados (hash, tipo, tamanho) de imagens, áudio e arquivos de plugins. O conteúdo fica fora do SQLite, endereçado pelo hash |
| `plugins` | Instalados, versão, permissões concedidas, ativo/inativo |
| `plugin_data` | Armazenamento chave-valor isolado por plugin |
| `settings` | Preferências, incluindo a hora de virada do dia para o streak |

Busca textual com FTS5 sobre notas e cards.

---

## 7. Sistema de Plugins

### 7.1 Conceito

Um plugin é uma pequena aplicação web empacotada. Roda em `<iframe sandbox="allow-scripts">`
(origem opaca), sem acesso ao DOM, ao banco ou ao armazenamento do app. Tudo que ele faz passa
pela ponte de mensagens e é verificado contra as permissões concedidas.

O desenvolvedor não usa `postMessage` na mão: usa o pacote **`@estudarella/plugin-sdk`**, tipado.

```ts
import { app } from "@estudarella/plugin-sdk";

app.events.on("note.opened", async (note) => { /* ... */ });

await app.cards.create({
  deckId,
  type: "plugin",
  content: { structure: "aorta" },            // dados que só o plugin entende
  fallback: { front: "O que é isto?", back: "Artéria aorta", imageAssetId: thumbnailId },
});
```

### 7.2 Protocolo

- RPC sobre `MessageChannel`: toda chamada tem `id`, `method`, `params`; toda resposta tem
  `id` e `result` ou `error`.
- Eventos do app para o plugin: `{ event, payload }`.
- Nomes em inglês (API pública).
- `apiVersion` no manifesto (semver). O app suporta a versão atual e a anterior.
- Toda mensagem recebida é validada com Zod; chamadas têm timeout e limite de frequência.

### 7.3 Pontos de extensão

| Tipo | O que é | Exemplo |
|---|---|---|
| `panel` | Painel lateral (computador) ou folha inferior (celular), ligado ao contexto | Modelo 3D ao abrir nota de anatomia |
| `page` | Tela própria na navegação | Analisador de Edital |
| `command` | Ação no menu de seleção de texto ou na paleta de comandos | "Definir palavra" |
| `cardRenderer` | Renderiza frente e verso de cards `type: plugin` na revisão | Card com modelo 3D girável |
| `noteEmbed` | Bloco dentro da nota | Thumbnail 3D clicável |
| `settings` | Tela de configuração do plugin | Idioma do dicionário |

Eventos: `note.opened`, `note.closed`, `selection.changed`, `deck.created`, `review.started`,
`review.cardShown`, `theme.changed`.

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
  "activation": ["onSubjectTag:anatomia", "onCardType", "onEmbed"],
  "permissions": ["notes:read", "notes:write", "cards:write", "assets:write", "storage"],
  "network": []
}
```

Um plugin é uma pasta com `manifest.json`, a página de entrada e quaisquer recursos, distribuída
como um arquivo compactado. Como o iframe isolado não busca arquivos por conta própria, há duas
formas de carregamento (já implementadas e testadas):

- **Código e estilo** referenciados pela página de entrada (`<script src>`,
  `<link rel="stylesheet">`) são embutidos pelo app ao abrir o plugin. Por isso o JavaScript
  precisa estar empacotado: um arquivo por `<script>`, sem `import` de caminhos relativos.
- **Demais arquivos** (modelos 3D, imagens, dados) são pedidos pelo plugin só quando necessários,
  com `plugin.readFile({ path })`, e chegam por transferência, sem cópia. O app recusa qualquer
  caminho fora da pasta do plugin.

O acesso aos arquivos passa por uma interface (`PluginSource`); hoje ela lê plugins distribuídos
com o app, e na Fase 3 ganha a implementação para pacotes instalados.

### 7.5 Permissões

| Permissão | Libera |
|---|---|
| `notes:read` / `notes:write` | Ler a nota em contexto / inserir conteúdo e embeds |
| `cards:read` / `cards:write` | Ler cards do próprio plugin / criar cards |
| `assets:write` | Salvar imagens e arquivos |
| `storage` | Chave-valor privado do plugin |
| `ai` | Chamar o proxy de IA do app (sujeito a cota) |
| `network` | Acessar **apenas** os domínios listados no manifesto |

O usuário vê e aprova as permissões na instalação. Sem `network`, o plugin não faz nenhuma
requisição externa (bloqueio por Content-Security-Policy injetada pelo app).

### 7.6 Estabilidade e eficiência

- **Carregamento sob demanda**: o iframe só é criado quando uma condição de `activation` ocorre.
- **Fallback obrigatório**: todo card de plugin carrega texto e imagem estáticos. Se o plugin for
  desinstalado, falhar ou demorar, a revisão continua com o fallback.
- **Embeds baratos**: na nota aparece uma imagem estática; o iframe interativo só abre ao clicar.
- **Limite de iframes vivos** e descarte dos inativos; plugin travado é encerrado sem afetar o app.
- **Recursos pesados** (modelos 3D) ficam em cache local após o primeiro uso.

### 7.7 Distribuição

1. Fases 3–4: plugins oficiais embutidos no repositório.
2. Fase 6: catálogo — um índice estático com versão e hash SHA-256 de cada pacote, verificado
   antes de instalar. Assinatura e revisão de plugins de terceiros vêm depois.

A política da Google Play proíbe baixar código executável nativo, mas abre exceção para
JavaScript em WebView; ainda assim os plugins precisam respeitar as demais políticas da loja.

### 7.8 Caso de referência — Esqueleto 3D

| Passo do usuário | Mecanismo |
|---|---|
| Abre a nota "Sistema Cardiovascular" | Evento `note.opened` + `activation: onSubjectTag:anatomia` |
| Modelo 3D aparece no painel | Ponto de extensão `panel`; Three.js + modelo GLB comprimido, dentro do iframe |
| Gira, dá zoom, clica na aorta | Tudo interno ao plugin |
| "Criar questão visual" | `app.assets.save(thumbnail)` + `app.cards.create({ type: "plugin", content, fallback })` |
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
│       │   ├── features/        # notes/, flashcards/, graph/, focus/, progress/
│       │   ├── plugin-host/     # Iframe, ponte RPC, permissões, ciclo de vida
│       │   ├── components/ui/   # shadcn/ui
│       │   ├── stores/          # Zustand (somente estado de UI)
│       │   └── theme/           # Tokens de design e temas
│       └── android/             # Projeto Capacitor
│
├── packages/
│   ├── core/                    # Regras de negócio sem UI: srs/, graph/, streak/, backup/
│   ├── db/                      # Schema Drizzle, migrações, queries, drivers (web / android)
│   ├── plugin-api/              # Tipos e schemas Zod do contrato (compartilhado app ↔ SDK)
│   └── plugin-sdk/              # SDK usado pelos autores de plugin
│
├── plugins/
│   ├── _template/
│   ├── dicionario-pt/
│   └── anatomy-3d/
│
├── docs/                        # Guia para autores de plugin
└── planejamento/
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
- [ ] Compilar e rodar no Android (falta instalar o Android SDK)
- [ ] **Prova 1 (Android):** driver SQLite nativo (`@capacitor-community/sqlite`)
- [ ] **Prova 2 (Android):** repetir o diagnóstico no WebView do aparelho
- [ ] Prova 2 com modelo GLB real e biblioteca 3D (o teste atual usa um modelo binário simples em WebGL puro)

Achado da Prova 2: um iframe isolado ainda consegue navegar a si mesmo para um site externo
(vazando dados pela URL). Corrigido com `frame-src 'none'` na política do app e coberto por teste.

Relatório completo: `documentos/relatorio-fase-0.md`.

### Fase 1 — Notas e Flashcards
Em ordem; cada passo entrega algo utilizável.
- [ ] shadcn/ui + hierarquia matéria > tópico > subtópico (criar, renomear, mover, excluir)
- [ ] Editor de notas (TipTap) com salvamento automático, links `[[...]]` com sugestão, tabela `links` e "notas que apontam para esta"
- [ ] Decks e cards básicos e cloze (criar e editar)
- [ ] Revisão com `ts-fsrs`, `review_logs` e virada do dia
- [ ] Busca textual (FTS5) em notas e cards
- [ ] Backup: exportar/importar tudo em um arquivo

Fora da Fase 1 por enquanto: lixeira, limite diário de cards novos. Imagens em notas e cards: a decidir (seção 11).

### Fase 2 — Grafo, Foco e Progresso
- [ ] Grafo com Sigma.js; toque no nó abre a nota
- [ ] Timer Pomodoro com notificação
- [ ] Streak e progresso diário
- **Marco: v1 utilizável pelos 2 usuários**

### Fase 3 — Plugins v1 (contextuais)
- [ ] `plugin-api`, `plugin-sdk`, host com permissões e CSP
- [ ] Pontos de extensão: `panel`, `command`, `page`, `settings`
- [ ] Tela de gerenciamento de plugins e aprovação de permissões
- [ ] Plugin Dicionário PT

### Fase 4 — Plugins v2 (ricos)
- [ ] `cardRenderer` com fallback
- [ ] `noteEmbed` com thumbnail
- [ ] `assets` e cache de recursos pesados
- [ ] Plugin Esqueleto 3D (caso de referência completo)

### Fase 5 — Conta, Sync e IA
- [ ] Autenticação (Supabase)
- [ ] Sync entre dispositivos
- [ ] Proxy de IA com cota
- [ ] Plugin Analisador de Edital

### Fase 6 — Distribuição pública
- [ ] Publicação na Play Store e site
- [ ] Catálogo de plugins com verificação de hash
- [ ] Documentação e template para autores de plugin

---

## 11. Decisões em Aberto

- **Fontes de dados dos plugins** (Dicionário PT e semelhantes): adiado de propósito — decidir quando o core e o sistema de plugins estiverem prontos (após a Fase 3).
- **Imagens em notas e cards**: Fase 1 ou junto com o `cardRenderer` (Fase 4)? O armazenamento de arquivos já existe; falta a interface.
- **Importação de decks do Anki**: entra no core, vira plugin ou fica fora?
- **Modelo de negócio** (recomendação, a confirmar): app e plugins oficiais gratuitos, sem limites no uso local; assinatura única para o que tem custo de servidor (sync entre dispositivos + cota de IA). SDK e plugins oficiais com código aberto. Plugins pagos de terceiros só depois de existir um catálogo ativo. Só precisa ser fechado antes da Fase 5.
- **Sync**: confirmar PowerSync ou alternativa no início da Fase 5.
- **Nome final**: "Estudarella" (provisório).

---

## 12. Referências e Inspirações

- **Obsidian** — plugins, grafo, dados do usuário; mesma arquitetura web + Capacitor
- **Anki** — SRS robusto, FSRS
- **VS Code** — manifesto com pontos de contribuição e ativação sob demanda
- **Figma** — plugins em iframe isolado com ponte de mensagens
- **LingQ** — vocabulário em contexto
- **Duolingo** — gamificação suave
