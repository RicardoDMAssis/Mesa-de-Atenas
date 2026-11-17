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
apps/app            App React (web + Android via Capacitor)
  src/routes        Telas
  src/plugin-host   Iframe isolado, política de rede e ponte de mensagens
  src/data          Abertura do banco
  public/builtin-plugins    Plugin de prova usado no diagnóstico
packages/core       Regras de negócio sem interface
packages/db         Schema, migrações e drivers do SQLite
packages/plugin-api Contrato app ↔ plugin (manifesto e protocolo)
```

## Regras do projeto

- **Banco**: toda tabela usa as colunas de sync (`id` UUID v7, `created_at`, `updated_at`,
  `deleted_at`). Excluir é preencher `deleted_at`, nunca `DELETE`.
- **Consultas**: telas não escrevem SQL. Leem com `useLiveQuery` e gravam chamando funções de
  `packages/db/src/queries/`. Funções de escrita devolvem a instrução sem executar: use `await`
  ou coloque-as em `db.batch([...])`.
- **Transações**: use `db.batch([...])`, nunca `db.transaction()`.
- **Migrações**: nunca edite uma migração já gerada; mude o schema e rode `pnpm db:generate`.
- **Plugins**: o app nunca confia no plugin. Toda mensagem passa por schema, e o que o plugin
  pode chamar é decidido em `plugin-host`, não no código do plugin.
- **Estado**: Zustand guarda só estado de interface e preferências do aparelho. Dados e
  preferências de estudo vêm do banco.

## Formato de um plugin

Uma pasta com `manifest.json` e uma página de entrada. Scripts e estilos referenciados pela
página são embutidos pelo app (o JavaScript precisa estar empacotado, sem `import` relativo).
Outros arquivos são lidos sob demanda com `plugin.readFile({ path })`. Exemplo funcional em
`apps/app/public/builtin-plugins/spike`.

## Diagnóstico

Em **Ajustes → Diagnóstico** o app mostra, no aparelho em uso, se o banco está persistindo e se
o isolamento de plugins está funcionando. É a primeira tela a conferir em um aparelho novo.
