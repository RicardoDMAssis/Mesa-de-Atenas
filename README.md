# Estudarella

App de estudos local-first para web e Android, com core enxuto e sistema de plugins.
O plano completo está em [`planejamento/planejamento.md`](planejamento/planejamento.md).

## Requisitos

- Node 24+
- pnpm (via `corepack enable pnpm`)
- Para o Android: Android Studio (SDK + emulador ou aparelho)

## Comandos

| Comando                                       | O que faz                                                             |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `pnpm install`                                | Instala as dependências                                               |
| `pnpm dev`                                    | Abre o app em http://localhost:5173                                   |
| `pnpm test`                                   | Testes de unidade                                                     |
| `pnpm e2e`                                    | Testes no navegador (computador e celular), sobre o build de produção |
| `pnpm typecheck` / `pnpm lint`                | Tipos e estilo                                                        |
| `pnpm format`                                 | Formata e corrige o que for automático                                |
| `pnpm db:generate`                            | Gera uma migração após mudar `packages/db/src/schema.ts`              |
| `pnpm --filter @estudarella/app android:sync` | Compila e copia o app para o projeto Android                          |
| `pnpm --filter @estudarella/app android:open` | Abre o projeto no Android Studio                                      |

Na primeira vez, `pnpm e2e` pede `pnpm --filter @estudarella/app exec playwright install chromium`.

## Estrutura

```
apps/app                 App React (web + Android via Capacitor)
  src/routes             Telas
  src/features           Notas, cards, matérias, grafo, foco, progresso, Início, backup
  src/navigation         Registro de telas, painel "Ir para", botão voltar do Android
  src/plugin-host        Iframe isolado, ponte, permissões, registro e instalação de plugins
  src/data               Abertura do banco, leitura reativa, arquivos
  public/builtin-plugins Plugins oficiais compilados (gerados) e plugin de prova do diagnóstico
  scripts/android-cdp.mjs Inspeção do app rodando no aparelho
packages/core            Regras sem interface (agendamento, lacunas, dia de estudo, sequência)
packages/db              Schema, migrações, consultas e driver do SQLite
packages/plugin-api      Contrato app ↔ plugin (manifesto, métodos, permissões, protocolo)
packages/plugin-sdk      Kit usado pelos plugins
plugins/                 Plugins oficiais (dicionario-pt) e modelo (_template)
docs/                    Guia para autores de plugin
instruções/              Plano de cada fase
documentos/              Relatório de cada fase
planejamento/            Plano geral
```

## Android

Requisitos: Android Studio (SDK em `~/Android/Sdk`) e o Java dele (21). Nesta máquina:

```bash
export ANDROID_HOME=$HOME/Android/Sdk JAVA_HOME=/opt/android-studio/jbr
export PATH=$ANDROID_HOME/platform-tools:$PATH
pnpm --filter @estudarella/app android:sync      # compila a web e copia para o Android
cd apps/app && npx cap run android               # instala e abre no aparelho/emulador
```

Para inspecionar o app no aparelho (apenas build de depuração):

```bash
adb forward tcp:9333 localabstract:$(adb shell cat /proc/net/unix | grep -o "webview_devtools_remote_[0-9]*" | head -1)
node apps/app/scripts/android-cdp.mjs 'location.pathname' [captura.png]
```

## Regras do projeto

- **Banco**: toda tabela usa as colunas de sync (`id` UUID v7, `created_at`, `updated_at`,
  `deleted_at`). Excluir é preencher `deleted_at`, nunca `DELETE`.
- **Consultas**: telas não escrevem SQL. Leem com `useLiveQuery` e gravam chamando funções de
  `packages/db/src/queries/`. Toda função de gravação é `async` e executa na hora: uma instrução
  do Drizzle solta (sem `await`) **não roda**, então nunca devolva o construtor da consulta.
- **Transações**: use `db.batch([...])`, nunca `db.transaction()`.
- **Migrações**: nunca edite uma migração já gerada; mude o schema e rode `pnpm db:generate`.
- **Plugins**: o app nunca confia no plugin. Toda mensagem passa por schema, e o que o plugin
  pode chamar é decidido em `plugin-host`, não no código do plugin.
- **Estado**: Zustand guarda só estado de interface e preferências do aparelho. Dados e
  preferências de estudo vêm do banco.

## Plugins

Guia completo para criar um plugin: [`docs/guia-de-plugins.md`](docs/guia-de-plugins.md).
Modelo pronto em `plugins/_template` (`pnpm --filter @estudarella/plugin-template zip` gera o `.zip`).
Os plugins oficiais em `plugins/*` são compilados para `apps/app/public/builtin-plugins/` antes
de `pnpm dev` e `pnpm build`.

## Diagnóstico

Em **Ajustes → Diagnóstico** o app mostra, no aparelho em uso, se o banco está persistindo e se
o isolamento de plugins está funcionando. É a primeira tela a conferir em um aparelho novo.
