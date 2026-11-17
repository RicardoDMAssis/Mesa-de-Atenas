# Relatório da Fase 3 — Plugins v1 (contextuais)

**Data:** 2026-11-17 · **Plano:** `instruções/fase-3.md`

## Resumo

O sistema de plugins saiu da prova de conceito e virou recurso do app: instalar, ativar com
aprovação de permissões, usar em tela própria, painel, comando sobre texto selecionado e
configurações. O primeiro plugin real, **Dicionário PT**, funciona no navegador e no celular
consultando o Wikcionário de verdade. Também foram entregues o guia para criar plugins e um modelo.

## Entregue

| Área                            | Resultado                                                                                                                                                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrato v1 (`plugin-api`)      | Métodos com a permissão exigida por cada um, descrições das permissões em português, eventos (`theme.changed`, `context.changed`), campos `description`, `author` e `icon` no manifesto                                                                   |
| Kit (`@estudarella/plugin-sdk`) | `app.ready()`, `notes`, `decks`, `cards.propose`, `storage`, `ui`, eventos; aplica o tema sozinho; erros com código (`PluginError`)                                                                                                                       |
| Instalação                      | Oficiais embutidos; **arquivo `.zip`**; **link para `.zip`** (no Android, sem as restrições do navegador). Validação do pacote (manifesto, caminhos, limites de tamanho). Arquivos guardados na área privada do app                                       |
| Ativação                        | Começa desativado; ativar mostra o que o plugin poderá fazer e os sites que acessa. Plugins de arquivo/link marcados como "origem não verificada"                                                                                                         |
| Host                            | Permissão conferida a cada chamada; parâmetros validados; limite de 60 chamadas/s; plugin que não responde em 10 s vira aviso com "Tentar de novo"                                                                                                        |
| Pontos de extensão              | `page` (tela própria, no painel "Mais" e no menu lateral), `panel` (coluna à direita / folha inferior), `command` sobre texto selecionado (modo edição e leitura), `settings`                                                                             |
| Segurança de dados              | Card proposto por plugin só é criado depois que o usuário revisa, escolhe o baralho e confirma. Texto inserido na nota é sempre texto puro                                                                                                                |
| Dicionário PT                   | Definições, primeiro exemplo de cada, sinônimos e antônimos do Wikcionário (com atribuição). Busca na tela própria, painel a partir da seleção, criar card, cache das últimas palavras (padrão 500, ajustável de 100 a 2.000) para uso sem internet. 8 KB |
| Guia e modelo                   | `docs/guia-de-plugins.md` e `plugins/_template` com script que gera o `.zip`                                                                                                                                                                              |

## Decisões tomadas com o usuário

- Fonte do dicionário: Wikcionário, guardando só as palavras já consultadas.
- Instalação nesta fase: embutidos, `.zip` e link.
- O plugin "Marca-texto" será criado pelo próprio usuário depois da Fase 3.1 (destaques).

## Achados durante a fase

| Achado                                                                            | Correção                                                                                        |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| O isolamento bloqueava formulários: o botão "Buscar" do dicionário não fazia nada | `allow-forms` no isolamento; enviar dados para fora continua bloqueado por `form-action 'none'` |
| Menu "⋯" e outros menus do Radix não abrem com clique simulado, só com toque real | Comportamento correto do componente; testes no aparelho passaram a usar toques reais            |
| Número "0.3 KB" com ponto nas configurações do dicionário                         | Formato brasileiro ("0,3 KB")                                                                   |

## Verificação

- Lint e tipos sem erros
- 84 testes de unidade (core 25, contrato 5, banco 30, dicionário 3, app 21)
- 75 testes de navegador (computador e celular), incluindo: ativar com aprovação de permissões,
  definir palavra selecionada em modo leitura, criar card com confirmação, tela própria pelo
  painel "Ir para", cache sem internet, configurações, instalar de arquivo e de link, permissão
  negada (`forbidden`), plugin travado, remoção, e o `.zip` gerado pelo modelo instalando e funcionando

### No Galaxy A52 (Android 14, WebView 157, tema escuro)

| Verificação                                                                      | Resultado                                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Ativar o dicionário pela tela de Plugins                                         | OK                                                                              |
| Toque longo real do Android seleciona a palavra; barra "Definir palavra" aparece | OK — convive com o menu nativo (Copiar/Compartilhar), que fica junto da palavra |
| Painel com a consulta real ao Wikcionário                                        | OK (definições, exemplo, sinônimos, antônimos)                                  |
| Criar card com confirmação                                                       | OK                                                                              |
| Botão voltar fecha o painel sem sair da nota                                     | OK                                                                              |
| Tamanho do cache                                                                 | 0,3 KB por palavra (500 palavras ≈ 150 KB)                                      |

Observação: o teste no aparelho criou um card "feliz" no baralho real "Analise sintatica" e a
nota "Teste do dicionário".

## Pendências

- A correção do "0,3 KB" ainda não foi instalada no celular (vai na próxima instalação).
- Comandos de plugin no painel "Ir para" (`"context": "palette"`): aceitos no manifesto, ainda
  não exibidos.
- Kit ainda não publicado no npm: plugins são criados dentro do repositório (Fase 6).
- Plugins instalados de arquivo/link não entram no backup (só os dados que eles guardam).

## Próximos passos

Fase 3.1 — destaques de palavras por plugins (`instruções/fase-3.1-destaques.md`).

## Ajustes após a entrega (2026-11-17)

### Início personalizável e widgets de plugins

Plano: `instruções/inicio-personalizavel.md`.

| Item                | Resultado                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Início              | Feito de widgets: **Personalizar** permite adicionar, remover, subir, descer e restaurar o padrão. Salvo no aparelho                                                     |
| Widgets do app      | Sequência, Hoje, Foco, Notas recentes e **Atalhos** (telas escolhidas pelo usuário, inclusive de plugins)                                                                |
| Contrato            | Novo `contributes.widgets` (`id`, `title`, `size` small/medium/large, até 5) e superfície `widget` com `context.widget`. Acréscimo compatível: `apiVersion` continua "1" |
| Widgets de plugins  | Quadro de altura fixa, carregado só quando aparece na tela, no máximo 4 no Início. Somem se o plugin for desativado e voltam ao reativar                                 |
| Dicionário PT 1.1.0 | Widget "Busca rápida": digitar no Início abre a tela do dicionário com a palavra                                                                                         |
| Guia                | Seção sobre widgets em `docs/guia-de-plugins.md`                                                                                                                         |

Verificação: 85 testes de unidade e 81 de navegador. No Galaxy A52: widget adicionado e
reordenado pela tela de personalização; busca digitada com o teclado real abriu o dicionário com
"casa" consultada no Wikcionário.
