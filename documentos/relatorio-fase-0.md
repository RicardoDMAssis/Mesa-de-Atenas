# Relatório da Fase 0 — Fundação e provas de risco

**Data:** 2026-11-16
**Plano de referência:** `planejamento/planejamento.md` (v2)

## Resumo

A Fase 0 está concluída na web e incompleta no Android. As duas provas de risco passaram no
navegador, e as inconsistências encontradas na revisão foram resolvidas, com exceção das que
dependem do Android SDK, que não está instalado na máquina de desenvolvimento.

A Fase 1 pode começar. O risco que continua aberto é o SQLite no Android: nenhum código do app
rodou em um aparelho ainda.

## Situação por item

| Item                                                    | Situação                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| Monorepo, app React + Vite, Tailwind, tema claro/escuro | Feito                                                            |
| Navegação (lateral no computador, inferior no celular)  | Feito                                                            |
| Schema (11 tabelas), migrações, driver do navegador     | Feito                                                            |
| Escrita atômica, leitura reativa, camada de consultas   | Feito                                                            |
| Armazenamento de arquivos (imagens, modelos)            | Feito                                                            |
| Contrato de plugins (manifesto e protocolo)             | Feito                                                            |
| Plugins com vários arquivos                             | Feito                                                            |
| PWA: instalável e offline                               | Feito                                                            |
| Prova 1 na web: banco persiste                          | Passou                                                           |
| Prova 2 na web: plugin isolado com 3D                   | Passou                                                           |
| CI                                                      | Escrito; nunca executado em servidor (não há repositório remoto) |
| Projeto Android (Capacitor)                             | Gerado; nunca compilado                                          |
| Driver SQLite do Android                                | Não escrito                                                      |
| Provas 1 e 2 no Android                                 | Não feitas                                                       |
| Prova com modelo GLB e biblioteca 3D reais              | Não feita                                                        |
| shadcn/ui                                               | Movido para o primeiro passo da Fase 1                           |

## Verificação

Rodado ao final desta fase, tudo passando:

- Lint e checagem de tipos em todos os pacotes
- 27 testes de unidade (core 4, contrato de plugins 5, banco 12, app 6)
- 14 testes de navegador sobre o build de produção (7 cenários, em tamanho de computador e de celular)

Cenários de navegador:

1. O dado gravado continua depois de recarregar a página, e o armazenamento de arquivos funciona.
2. O plugin renderiza 3D, carrega seus vários arquivos, não lê fora da própria pasta, não acessa
   armazenamento, cookies nem a tela do app, tem a rede bloqueada, e uma chamada não autorizada é recusada.
3. O plugin não consegue navegar para um site externo.
4. O tema escolhido persiste e é repassado ao plugin.
5. O app abre sem internet depois da primeira visita.
6. O manifesto de instalação e os ícones estão disponíveis.
7. Uma segunda aba espera e assume sozinha quando a primeira fecha.

Ainda não há commit no git.

## Provas de risco

### Prova 1 — banco local

O SQLite roda em WASM dentro de um Web Worker e persiste no OPFS. A busca textual (FTS5) está
disponível nessa versão. No Android, a pesquisa indicou que essa combinação não é confiável no
WebView, por isso o plano prevê um driver nativo; ele ainda não foi escrito.

### Prova 2 — plugin isolado

O plugin roda em `<iframe sandbox="allow-scripts">` com uma política de segurança injetada pelo app.

**Brecha encontrada e corrigida:** mesmo isolado, o plugin conseguia navegar o próprio iframe para
um site externo, o que permitiria vazar dados pela URL. A correção é a diretiva `frame-src 'none'`
na política do app, coberta por teste.

**Limite da prova:** o modelo 3D é um arquivo binário simples desenhado em WebGL puro. Falta
repetir com uma biblioteca 3D empacotada e um arquivo GLB.

## Inconsistências encontradas e como foram resolvidas

### Bloqueavam o início da Fase 1

| Problema                                                                                                                                  | Solução                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Transações não eram seguras: com uma única conexão e chamadas assíncronas, a consulta de uma tela podia cair dentro da transação de outra | O driver ganhou uma operação em lote que roda inteira dentro do worker, sem pausas. Usa-se `db.batch([...])`; `db.transaction()` está proibida. As migrações também passaram a usar o lote |
| Não existia o mecanismo de leitura reativa que o plano prometia                                                                           | Toda escrita avisa automaticamente qual tabela mudou, e o hook `useLiveQuery` refaz a consulta das telas que observam essa tabela                                                          |
| Exclusão lógica e `updated_at` dependiam de cada tela lembrar                                                                             | Criada a camada `packages/db/src/queries/` com o filtro `active`, `softDelete` e as funções de `settings`. Telas não escrevem SQL                                                          |

### Encaminhadas nesta rodada

| Problema                                       | Solução                                                                                                                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugins com mais de um arquivo não funcionavam | O app lê o manifesto, embute o código e o estilo referenciados pela página de entrada e entrega os demais arquivos sob demanda (`plugin.readFile`), por transferência sem cópia. Caminhos fora da pasta do plugin são recusados |
| PWA estava na stack mas em nenhuma fase        | Implementado: manifesto, ícones e service worker que guarda o app, o SQLite e os plugins embutidos. No Android o service worker não é registrado                                                                                |
| Preferências em dois lugares sem regra         | Oficializado: preferências do aparelho (tema) no armazenamento local, sem sync; preferências de estudo na tabela `settings`                                                                                                     |

### Menores

| Problema                                                 | Solução                                                                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A tabela `assets` não dizia onde os bytes ficam          | Criado o `AssetStore`: arquivos em uma pasta privada do app (OPFS), nomeados pelo hash SHA-256. A tabela guarda só metadados |
| O plano usava `fallback.image` e o schema `imageAssetId` | Plano alinhado ao schema (`imageAssetId`)                                                                                    |
| O app só abria em uma aba, sem explicação                | A segunda aba explica o motivo e assume sozinha quando a primeira fecha                                                      |
| Risco do SQLite no Android aberto                        | Não resolvido: depende de instalar o Android Studio                                                                          |

## Pendências

**Dependem do Android Studio**

- Compilar e abrir o app em um aparelho ou emulador
- Escrever e testar o driver SQLite nativo
- Repetir o Diagnóstico (Ajustes → Diagnóstico) no aparelho

**Não dependem**

- Prova com modelo GLB e biblioteca 3D reais (pode ficar para a Fase 4)
- Executar o CI pela primeira vez, quando houver repositório remoto
- Primeiro commit

**Decisões em aberto**

- Imagens em notas e cards: Fase 1 ou Fase 4? O armazenamento já existe; falta a interface.
- Finalidade da pasta `instruções/` na raiz, que está vazia.

## Observação sobre o formato de plugins

A solução para vários arquivos impõe uma regra a quem escreve plugins: o JavaScript precisa estar
empacotado em um arquivo por `<script>`, sem `import` de caminhos relativos. Isso é normal para
quem usa um empacotador, e o template de plugin da Fase 3 deve trazer essa configuração pronta.

Os iframes de plugin herdam a política de segurança do app. Qualquer diretiva nova adicionada à
política do app passa a valer também para os plugins, e precisa ser testada com eles.

## Próximos passos — Fase 1

Em ordem; cada passo entrega algo utilizável:

1. shadcn/ui e hierarquia matéria > tópico > subtópico
2. Editor de notas com links `[[...]]` e "notas que apontam para esta"
3. Decks e cards básicos e cloze
4. Revisão com FSRS e virada do dia
5. Busca em notas e cards
6. Backup: exportar e importar
