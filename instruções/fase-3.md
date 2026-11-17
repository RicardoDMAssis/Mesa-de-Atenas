# Fase 3 — Plugins v1 (contextuais)

**Objetivo:** transformar o host de plugins da prova de conceito em um sistema de verdade:
instalar, ativar, conceder permissões e usar plugins em tela própria, em painel ao lado da nota,
em comandos sobre o texto selecionado e em telas de configuração. Primeiro plugin real: o
**Dicionário PT**.

**Ponto de partida:**

- Contrato inicial em `packages/plugin-api` (manifesto e protocolo, validados com Zod).
- Host em `apps/app/src/plugin-host`: iframe isolado, política de rede, plugins com vários
  arquivos, leitura de arquivos da própria pasta, ponte de mensagens. Tudo testado na web e no
  Android (Fase 0).
- Navegação já preparada para telas de plugins (`usePluginScreens`, painel "Ir para").

## Decisões desta fase

| Tema                    | Decisão                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SDK                     | Pacote `@estudarella/plugin-sdk`, tipado, que esconde o `postMessage`: `app.notes`, `app.cards`, `app.storage`, `app.events`, `app.ui`. Gerado como um arquivo JS único para o plugin incluir                                              |
| Template                | `plugins/_template` com Vite já configurado para gerar um arquivo por `<script>` (exigência do host)                                                                                                                                       |
| Permissões              | Verificadas no app a cada chamada, conforme o manifesto e o que o usuário aprovou. Pedidas na ativação, com texto em português para cada uma                                                                                               |
| Rede                    | Bloqueada por padrão; liberada só para as origens do manifesto, mostradas ao usuário na aprovação                                                                                                                                          |
| Armazenamento do plugin | `app.storage` (chave-valor em `plugin_data`), isolado por plugin, entra no backup                                                                                                                                                          |
| Instalação              | Plugins oficiais vêm com o app (`public/builtin-plugins`). Também é possível instalar de um arquivo `.zip` (para testar plugins em desenvolvimento), guardado no armazenamento de arquivos do aparelho. Catálogo online fica para a Fase 6 |
| Ativação                | Plugin instalado começa desativado; ativar mostra as permissões. Desativar mantém os dados; remover apaga                                                                                                                                  |
| Carregamento            | Sob demanda: o iframe só é criado quando a tela, o painel ou o comando é usado. No máximo 3 iframes vivos; os menos usados são descartados                                                                                                 |
| Falhas                  | Plugin que trava (sem resposta em 10 s) ou lança erro é encerrado e mostra um aviso, sem afetar o app                                                                                                                                      |
| Tema                    | O app envia os tokens de cor e o modo claro/escuro ao plugin e avisa quando mudam (já existe na prova)                                                                                                                                     |

### Pontos de extensão desta fase

| Ponto      | Onde aparece                                                         | Exemplo no Dicionário            |
| ---------- | -------------------------------------------------------------------- | -------------------------------- |
| `page`     | Tela própria, no painel "Ir para" e no menu lateral (seção Plugins)  | Busca livre de palavras          |
| `panel`    | Computador: coluna ao lado da nota. Celular: folha inferior          | Definição da palavra selecionada |
| `command`  | Menu que aparece ao selecionar texto na nota (e no painel "Ir para") | "Definir palavra"                |
| `settings` | Dentro da tela de Plugins                                            | Mostrar sinônimos e antônimos    |

Eventos enviados: `note.opened`, `note.closed`, `selection.changed`, `theme.changed`.

Métodos da ponte desta fase: ler a nota aberta e a seleção (`notes:read`), inserir texto na nota
(`notes:write`), criar card em um baralho escolhido pelo usuário (`cards:write`), chave-valor do
plugin (`storage`), abrir o painel/tela do próprio plugin, mostrar aviso.

## Decisões em aberto (antes de começar)

1. **Fonte de dados do Dicionário PT** — adiada até agora, como combinado:
   - **Wikcionário em português (online)**: grátis, boa cobertura, licença CC BY-SA (exige
     atribuição); precisa de internet e da permissão de rede para `pt.wiktionary.org`.
   - **Base offline embutida**: funciona sem internet, mas bases abertas e boas de definições em
     português são raras e grandes; sinônimos têm bases abertas melhores que definições.
   - **Híbrido (recomendado)**: definições do Wikcionário (online) + sinônimos e antônimos de
     uma base aberta embutida (offline), com cache das palavras já consultadas.
2. **Instalar de arquivo `.zip`** já nesta fase (útil para criar e testar plugins) ou só plugins
   oficiais até o catálogo?

## Fora do escopo

- `cardRenderer`, `noteEmbed` e assets pesados (Fase 4, Esqueleto 3D)
- Catálogo online, assinatura de pacotes e atualização automática (Fase 6)
- Plugins com IA (dependem do proxy da Fase 5)

## Passos

1. **Contrato v1**: completar `plugin-api` (métodos, eventos, permissões com descrições) e criar
   `plugin-sdk` + template, com testes de unidade
2. **Registro de plugins**: tabela `plugins` em uso (instalado, versão, permissões concedidas,
   ativo), leitura dos oficiais e instalação por `.zip`
3. **Host v1**: ponte com verificação de permissão por chamada, timeout, limite de iframes,
   encerramento de plugin travado
4. **Tela de Plugins**: lista, ativar/desativar com aprovação de permissões, configurações,
   remover; aviso de rede
5. **Pontos de extensão**: `page` (integra ao painel "Ir para"), `panel` (lateral/folha
   inferior), `command` (menu de seleção de texto), `settings`
6. **Plugin Dicionário PT**, usando só o SDK (prova de que o contrato basta)
7. **Converter o plugin de prova** do Diagnóstico para o SDK
8. Testes no navegador e no celular; relatório

## Critério de pronto

- Fluxos cobertos por testes de navegador (computador e celular): ativar com aprovação de
  permissões, chamada sem permissão recusada, selecionar palavra → "Definir" → painel com a
  definição, criar card a partir da definição, tela própria do plugin no painel "Ir para",
  desativar e remover
- Plugin travado ou com erro não derruba o app (teste)
- Dicionário funcionando no celular, inclusive o menu de seleção com o teclado/toque do Android
- Lint, tipos e todos os testes passando
- Relatório em `documentos/relatorio-fase-3.md`

## Riscos

| Risco                                                                         | Mitigação                                                                                                        |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Menu de seleção de texto no Android conflita com o menu nativo (copiar/colar) | Mostrar nosso menu como uma barra flutuante acima da seleção, sem substituir o nativo; testar no Galaxy A52 cedo |
| Wikcionário fora do ar ou lento                                               | Cache local das palavras consultadas; mensagem clara de "sem conexão"                                            |
| Formato do Wikcionário difícil de interpretar                                 | Usar a API de definições estruturadas quando disponível; extrair só definição, classe gramatical e exemplos      |
| Contrato mudar depois que houver plugins                                      | `apiVersion` no manifesto; o app aceita a versão atual e a anterior                                              |
