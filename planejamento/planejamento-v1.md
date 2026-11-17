# Estudarella — Planejamento do Projeto

**Status:** Planejamento
**Criado em:** 2026-11-16

---

## Visão Geral

App de estudos cross-platform (Android + Web/Desktop) com core minimalista e sistema de plugins.
Filosofia: simples por padrão, poderoso com extensões — inspirado no Obsidian.

Usuário primário da v1: estudante universitário de Letras - Português.
Escopo inicial: 2 usuários. Meta: escalar para distribuição pública.

---

## Problema que resolve

Apps de estudo existentes são ou muito simples (Duolingo, Quizlet) ou muito genéricos e complexos
(Notion, Obsidian). Estudantes de áreas específicas precisam de ferramentas adaptadas ao seu
contexto sem montar um sistema do zero.

Solução: um app de estudos com núcleo funcional e enxuto, extensível por plugins focados
em cada área do conhecimento.

---

## Funcionalidades Essenciais (Core — vanilla)

Disponíveis para todos os usuários, sem nenhum plugin instalado:

- Flashcards com repetição espaçada (SRS) — algoritmo FSRS
- Notas vinculadas por tópico/matéria
- Mapa de grafos interativo — visualiza conexões entre assuntos (diferencial principal)
- Timer de foco (Pomodoro)
- Streak e progresso diário
- Organização hierárquica: matéria > tópico > subtópico

---

## Sistema de Plugins

### Conceito

O app define uma interface (contrato). Qualquer plugin que seguir esse contrato é aceito.
Plugins rodam em WebView sandbox — isolados do app, comunicam por troca de mensagens.

### Por que WebView sandbox

- Plugins podem ser ricos (3D, gráficos, chamadas de API, IA)
- Desenvolvedor de plugin usa HTML + JS — não precisa saber React Native
- Isolamento real: plugin não acessa banco do app sem permissão explícita
- Manutenção simples: a ponte de mensagens é implementada uma vez no app

### Fluxo de comunicação

```
App → Plugin : { evento: "palavra-selecionada", valor: "ephemeral" }
Plugin → App : { acao: "exibir-resultado", dados: { definicao: "..." } }
Plugin → App : { acao: "adicionar-flashcard", frente: "ephemeral", verso: "..." }
```

### Estrutura de um plugin

Cada plugin tem 3 arquivos:

```
manifest.json   — nome, versão, slot que ocupa, permissões necessárias
index.html      — interface visual (roda no WebView)
plugin.js       — lógica + comunicação com o app via mensagens
```

### Slots disponíveis (pontos de extensão do app)

| Slot | Disparado quando |
|---|---|
| `palavra-selecionada` | Usuário seleciona uma palavra em qualquer nota |
| `nota-aberta` | Usuário abre uma nota específica |
| `deck-criado` | Novo deck de flashcards é criado |
| `sessao-revisao` | Antes de iniciar uma sessão SRS |
| `tela-livre` | Plugin ocupa uma tela própria na navegação |

### Plugins Oficiais Planejados

| Plugin | Público-alvo | Funcionalidade |
|---|---|---|
| Dicionário PT | Letras | Significado, sinônimos e antônimos de palavra selecionada |
| Conjugador de Verbos | Letras / Línguas | Conjugação completa + exercícios gerados |
| Leitor de Contexto | Línguas | Lookup em texto com adição direta ao deck SRS |
| Analisador de Edital | Concursos | Upload de edital → LLM extrai e organiza as matérias |
| Esqueleto 3D | Medicina | Modelo 3D interativo do corpo humano; usuário cria questões usando o modelo como gabarito visual |

O plugin **Dicionário PT** é o MVP do sistema de plugins — mais simples, útil para o usuário imediato.

---

## Stack Tecnológica

| Camada | Tecnologia | Motivo |
|---|---|---|
| Base cross-platform | Expo (React Native) | Android + iOS + Web com um código |
| Linguagem | TypeScript | Segurança de tipos desde o início |
| Navegação | Expo Router | File-based routing, sem config manual |
| Estado global | Zustand | Simples, sem boilerplate |
| Banco local | Expo SQLite | Offline-first, bom para SRS e progresso |
| UI / Estilo | NativeWind (Tailwind) | Produtivo para dev solo |
| Grafo | react-native-vis-network ou D3.js via WebView | Visualização interativa |
| Nuvem / Auth | Supabase | PostgreSQL + auth + storage, free tier generoso |
| IA (plugins) | Ollama local ou API externa por plugin | Decisão por plugin conforme necessidade |

---

## Estrutura de Pastas

```
app-estudos/
│
├── app/                          # Telas (Expo Router)
│   ├── (tabs)/
│   │   ├── index.tsx             # Home / Dashboard
│   │   ├── notas.tsx             # Lista de notas
│   │   ├── flashcards.tsx        # Decks e revisão
│   │   ├── grafo.tsx             # Mapa de grafos
│   │   └── plugins.tsx           # Gerenciar plugins instalados
│   ├── nota/[id].tsx             # Nota individual
│   ├── revisao/[deckId].tsx      # Sessão de revisão SRS
│   └── _layout.tsx               # Layout raiz
│
├── src/
│   ├── components/               # Componentes reutilizáveis
│   │   ├── ui/                   # Botões, inputs, cards, modais
│   │   ├── flashcard/            # Card de revisão, avaliação
│   │   ├── grafo/                # Visualizador de grafos
│   │   └── plugin/
│   │       ├── PluginPanel.tsx   # Painel lateral com o WebView
│   │       └── PluginBridge.ts   # Lógica de mensagens app ↔ plugin
│   │
│   ├── core/                     # Lógica de negócio (sem UI)
│   │   ├── srs/
│   │   │   └── fsrs.ts           # Algoritmo de repetição espaçada
│   │   ├── grafo/
│   │   │   └── builder.ts        # Monta relações entre notas
│   │   └── plugins/
│   │       ├── loader.ts         # Carrega e registra plugins
│   │       ├── registry.ts       # Lista de plugins instalados
│   │       └── types.ts          # Interface que todo plugin deve seguir
│   │
│   ├── db/                       # Banco de dados local
│   │   ├── schema.ts             # Definição das tabelas SQLite
│   │   ├── migrations/           # Versões do schema
│   │   └── queries/
│   │       ├── notas.ts
│   │       ├── flashcards.ts
│   │       └── progresso.ts
│   │
│   ├── store/                    # Estado global (Zustand)
│   │   ├── useNotasStore.ts
│   │   ├── useFlashcardsStore.ts
│   │   └── usePluginsStore.ts
│   │
│   └── utils/
│       ├── date.ts
│       └── text.ts
│
├── plugins/                      # Plugins oficiais
│   ├── dicionario-pt/
│   │   ├── manifest.json
│   │   ├── index.html
│   │   └── plugin.js
│   ├── analisador-edital/
│   │   ├── manifest.json
│   │   ├── index.html
│   │   └── plugin.js
│   └── _template/                # Base para criar novos plugins
│       ├── manifest.json
│       ├── index.html
│       └── plugin.js
│
├── assets/
├── app.json
├── tsconfig.json
└── package.json
```

---

## Fases de Desenvolvimento

### Fase 0 — Fundação
- [ ] Configurar projeto Expo + TypeScript + NativeWind
- [ ] Navegação base com Expo Router
- [ ] Schema SQLite: notas, flashcards, decks, progresso
- [ ] CRUD de notas e flashcards
- [ ] Timer Pomodoro

### Fase 1 — Core de Estudos
- [ ] Engine SRS com algoritmo FSRS
- [ ] Tela de sessão de revisão (card + avaliação)
- [ ] Streak e progresso diário
- [ ] Organização por matéria/tópico

### Fase 2 — Mapa de Grafos
- [ ] Modelar relações entre notas/tópicos no banco
- [ ] Renderizar grafo interativo
- [ ] Navegação pelo grafo (toque no nó → abre nota)

### Fase 3 — Sistema de Plugins
- [ ] Definir `types.ts` (interface/contrato dos plugins)
- [ ] Implementar PluginBridge (ponte de mensagens)
- [ ] Plugin loader e registry
- [ ] Primeiro plugin oficial: Dicionário PT
- [ ] Segundo plugin: Analisador de Edital

### Fase 4 — Nuvem e Escala
- [ ] Autenticação com Supabase
- [ ] Sync entre dispositivos
- [ ] Marketplace de plugins

---

## Decisões em Aberto

- Grafo gerado automaticamente por tags/links nas notas, ou o usuário conecta manualmente?
- Plugins de IA: Ollama local ou API externa? Decisão pode ser por plugin.
- Suporte a iOS: desde o início ou só após validar no Android?
- Modelo de negócio: freemium, plugins pagos, open source com hosting pago?
- Nome final do app: "Estudarella" (provisório)

---

## Referências e Inspirações

- **Obsidian** — filosofia de plugins, mapa de grafos, ownership dos dados pelo usuário
- **Anki** — SRS robusto, lógica de revisão bem estabelecida
- **Duolingo** — acessibilidade, gamificação suave
- **LingQ** — lookup de vocabulário em contexto real
