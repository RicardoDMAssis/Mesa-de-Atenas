# Relatório — Plugin Foto para nota

**Data:** 2026-11-18 · **Pedido:** "Crie um plugin que fará a leitura de fotos para criar notas"

## Resumo

Plugin embutido **Foto para nota**: o usuário tira foto (câmera) ou escolhe fotos (galeria) de um
livro, apostila ou quadro; o plugin lê o texto **no próprio aparelho**, arruma o texto e sugere
uma nota. O app mostra a nota para o usuário corrigir, escolher a matéria e confirmar. As fotos
originais podem ficar guardadas num bloco no topo da nota.

Nada sai do aparelho: a leitura usa o Tesseract (WebAssembly) com o modelo de português que vai
junto com o app. Funciona sem internet.

## Entregue

| Parte              | Resultado                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fotos              | "Tirar foto" (abre a câmera) e "Escolher fotos" (várias, até 10 por nota). Girar, mudar a ordem e remover cada foto. Respeita a orientação gravada pela câmera                                                                                                                                                                       |
| Leitura            | Tesseract 6 (LSTM, modelo `por` "best_int", 1,4 MB). Barra de progresso por foto, cancelar. Imagem reduzida a 2400 px e em tons de cinza antes de ler                                                                                                                                                                                |
| Arrumação do texto | Separa parágrafos pelas posições das linhas (linha curta, espaço maior, recuo); junta as linhas quebradas pela largura da página, desfaz a hifenização ("orga-" + "nela"), mantém hífen de palavra composta, transforma •, –, · em lista, mantém itens numerados, tira linhas de sujeira. Opção "Manter as quebras de linha da foto" |
| Título             | Sugerido pela primeira linha, se for curta e estiver sozinha                                                                                                                                                                                                                                                                         |
| Revisão no plugin  | Título e texto editáveis; aviso se a confiança da leitura for baixa (foto escura, torta, letra de mão) ou se nada foi encontrado                                                                                                                                                                                                     |
| Criar nota         | Pelo método novo `notes.propose`: tela "Criar nota" do app com título, matéria, texto e "Guardar junto na nota: Foto original". Ao confirmar, o app abre a nota                                                                                                                                                                      |
| Fotos na nota      | Guardadas como arquivos do plugin (JPEG até 1800 px) e mostradas num bloco com miniatura; tocar no bloco abre as fotos. Se o usuário cancelar, as fotos guardadas são apagadas                                                                                                                                                       |
| Nota aberta        | No painel ao lado de uma nota, "Inserir na nota aberta" põe o texto lido no cursor                                                                                                                                                                                                                                                   |

## Mudanças no app e no contrato de plugins

- Permissão nova **`notes:create`** ("Criar notas novas — você confere e confirma cada uma").
- Método **`notes.propose`** `{ title, text, embed? }` → `{ noteId | null }`. Texto puro, sem
  HTML; `## `/`### ` viram títulos, `- ` vira lista, linha em branco separa parágrafos (até 100
  mil caracteres). O conversor (`features/notes/fromText.ts`) só gera parágrafos, títulos, listas
  e quebras de linha.
- `createNote` aceita conteúdo inicial (uma escrita só).
- `storage.saveFile` aceita imagens (JPEG, PNG, WebP) sem redução, para guardar fotos.
- Kit (`app.notes.propose`), guia de plugins e ícone `camera`.
- O app guarda offline também arquivos `.gz` (o modelo de português).

Esse método será usado também pelo mascote com IA na Fase 5 ("crie uma nota sobre…").

## Tamanho

| Arquivo                | Tamanho                               |
| ---------------------- | ------------------------------------- |
| Código do plugin       | 30 KB                                 |
| Motor (com e sem SIMD) | 2 × 3,9 MB (o aparelho carrega só um) |
| Modelo de português    | 1,4 MB                                |
| Script do worker       | 110 KB                                |

O motor só é carregado ao tocar em "Ler texto" pela primeira vez.

## Verificação

- Lint e tipos sem erros.
- Testes de unidade: arrumação do texto e parágrafos pelas posições das linhas (10) e conversão do
  texto em nota (3).
- Testes de navegador (computador e celular), com uma foto de texto impresso gerada no teste:
  lê "Citologia" como título, junta as linhas e desfaz a hifenização; a tela do app permite
  corrigir o texto; a nota criada tem o título, o parágrafo, a lista e o bloco com a foto; tocar
  no bloco mostra a foto; a nota aparece na busca. Cancelar a nota não deixa arquivos guardados.

## Limitações

- Letra de mão: o Tesseract lê mal. Na Fase 5 entra "Ler com IA" (plano em `instruções/fase-5.md`).
- Fórmulas, tabelas e colunas lado a lado saem como texto corrido; a opção de manter as quebras
  de linha ajuda em tabelas simples.
- As fotos não entram dentro do texto da nota (o editor ainda não tem imagens); ficam no bloco.

## No Galaxy A52 (Android 14, WebView 157), 2026-11-18

| Verificação                   | Resultado                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| "Tirar foto" abre a câmera    | Sim: a câmera do sistema abre a partir do plugin; cancelar volta ao plugin sem erro                                                    |
| Leitura de uma página inteira | **8 a 10 s** para uma página de ~330 palavras (foto de página levemente torta), contando ~2,5 s para carregar o leitor na primeira vez |
| Qualidade                     | Texto impresso sem nenhum erro de letra ou acento; título, os 3 parágrafos, a frase antes da lista e a lista separados certos          |
| Nota criada                   | Com o bloco "Foto original" e a miniatura                                                                                              |

Achados no aparelho, corrigidos:

| Achado                                                                                   | Correção                                                                                                          |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| "Arquivo não encontrado": o build do Android descompacta arquivos `.gz` e o modelo sumia | O modelo vai como `.bin` (continua compactado; o leitor reconhece pelo conteúdo)                                  |
| Parágrafos grudados: o texto simples do leitor não separa parágrafos                     | O texto é montado pelas posições das linhas: linha curta, espaço maior entre linhas ou recuo encerram o parágrafo |
