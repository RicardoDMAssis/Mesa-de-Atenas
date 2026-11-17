# Fase 3.1 — Destaques de palavras por plugins

**Objetivo:** permitir que plugins **colorem palavras nas notas** sem alterar o texto salvo e sem
quebrar o isolamento. Exemplo: um plugin onde o estudante cadastra "conectivos" em azul e
"figuras de linguagem" em rosa, e essas palavras aparecem coloridas em todas as notas.

**Ponto de partida:** sistema de plugins v1 (Fase 3) — contrato com permissões verificadas pelo
app, kit `@estudarella/plugin-sdk`, armazenamento por plugin (`plugin_data`), editor TipTap.

## Princípios

1. **O texto salvo nunca muda.** O destaque é só visual: o app pinta as palavras ao exibir a nota
   (decorações do editor). Busca, backup, links e grafo continuam iguais.
2. **O plugin descreve, o app desenha.** O plugin envia _regras_ (palavra → estilo). Quem aplica é
   o app, com cores da paleta do tema. Nenhum HTML ou CSS vem do plugin.
3. **Funciona sem o plugin estar aberto.** As regras ficam guardadas pelo app; não é preciso
   carregar o iframe do plugin para abrir uma nota. Isso mantém a nota rápida e o plugin sob demanda.
4. **Desativar desfaz tudo.** Desativar ou remover o plugin faz os destaques sumirem na hora.
5. **O usuário controla.** Permissão própria, aprovada ao ativar, e um botão para esconder os
   destaques na nota.

## Decisões

| Tema                | Decisão                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permissão nova      | `notes:highlight` — "Destacar palavras nas notas (sem alterar o texto)"                                                                                             |
| Manifesto           | `contributes.highlights: true` (o plugin aparece na legenda de destaques)                                                                                           |
| Métodos novos       | `highlights.set(regras)` substitui todas as regras do plugin; `highlights.get()`; `highlights.clear()`                                                              |
| Formato da regra    | `{ termo, cor, estilo?, rotulo?, comando? }`                                                                                                                        |
| `termo`             | Palavra ou expressão de até 60 caracteres. Casa **palavra inteira**, sem diferenciar maiúsculas; acentos opcionais (`ignorarAcentos`, padrão: sim)                  |
| `cor`               | Uma das 8 da paleta: `roxo`, `rosa`, `verde`, `laranja`, `azul`, `ciano`, `marrom`, `cinza`. Cada uma tem versão para tema claro e escuro, com contraste verificado |
| `estilo`            | `marca-texto` (fundo, padrão), `texto` (cor da letra) ou `sublinhado`                                                                                               |
| `rotulo`            | Até 80 caracteres; aparece ao passar o mouse / tocar e segurar (ex.: "conectivo")                                                                                   |
| `comando`           | Opcional: id de um comando do próprio plugin. Tocar na palavra abre o painel do plugin com essa palavra (como "Definir palavra")                                    |
| Limites             | Até 500 regras por plugin; até 2.000 destaques pintados por nota (acima disso, para de pintar e avisa)                                                              |
| Conflitos           | Termos que se sobrepõem: vale o mais longo; empate: o plugin ativado primeiro                                                                                       |
| Onde guarda         | Tabela `plugin_data`, chave reservada `__destaques` (já entra no backup e é apagada ao remover o plugin). O plugin não lê nem escreve essa chave por `storage.*`    |
| Exibição            | Modo edição e leitura. Não aparece em cards nem na busca                                                                                                            |
| Controle do usuário | Menu da nota: "Mostrar destaques" liga/desliga (preferência do aparelho). Legenda: rótulos e cores ativos na nota                                                   |
| Acessibilidade      | Não depender só de cor: o rótulo vira dica e texto para leitores de tela; estilos `sublinhado` e `texto` para quem prefere                                          |

### Exemplo de uso no plugin

```ts
await app.highlights.set([
  { termo: "portanto", cor: "azul", rotulo: "conectivo conclusivo" },
  { termo: "no entanto", cor: "azul", rotulo: "conectivo adversativo" },
  {
    termo: "metáfora",
    cor: "rosa",
    estilo: "texto",
    rotulo: "figura de linguagem",
    comando: "explicar",
  },
]);
```

## Etapas

### Etapa 1 — Regras fixas (esta fase)

O plugin define uma lista de termos que vale para **todas as notas**. Cobre o exemplo pedido
(palavras coloridas) e casos como conectivos, termos técnicos ou vocabulário de uma matéria.

1. **Contrato**: permissão, `contributes.highlights`, métodos `highlights.*` com validação
   (formato, limites, paleta) e descrições em português; kit atualizado
2. **Regras no app**: guardar/ler `__destaques` por plugin; store com as regras de todos os plugins
   ativos com a permissão, atualizada quando um plugin muda regras, é ativado ou desativado
3. **Motor de correspondência** (`packages/core`): compila as regras em um buscador único
   (palavra inteira, sem acento, maior termo primeiro), devolve intervalos `{de, até, regra}`.
   Testes de unidade, incluindo desempenho (nota de 20 mil palavras com 2.000 regras)
4. **Pintura no editor**: extensão TipTap com decorações do ProseMirror, recalculadas só nos
   parágrafos alterados; paleta como variáveis CSS do tema; dica com o rótulo; toque abre o
   comando do plugin (quando houver)
5. **Controles**: "Mostrar destaques" no menu da nota; legenda dos destaques ativos; seção na
   tela de Plugins explicando o que cada plugin destaca
6. **Exemplo no modelo de plugin** (não haverá plugin oficial de marca-texto: o usuário vai
   criar o dele usando este recurso; o guia e o modelo precisam bastar para isso)
7. **Guia**: seção nova no guia de plugins; exemplo no modelo
8. **Testes** no navegador (computador e celular) e no Galaxy A52; relatório

### Etapa 2 — Destaques calculados pelo plugin (depois, se for preciso)

Para casos em que a regra depende da análise do texto (ex.: "pintar todos os verbos"), o plugin
precisaria ler a nota e devolver intervalos. Isso exige rodar o plugin em segundo plano ao abrir
cada nota, o que pesa mais e tem riscos próprios (ordem das respostas, notas grandes, plugin lento).
**Fica fora desta fase**; será reavaliada quando houver um plugin que precise.

## Fora do escopo

- Plugin oficial de marca-texto (decisão do usuário, 2026-11-17: ele mesmo vai criar)

- Destaques calculados pelo plugin (etapa 2)
- Destaques em cards e na tela de revisão
- Cores livres (só a paleta do tema)
- Alterar o texto da nota (continua sendo só `notes.insertText`, com `notes:write`)

## Critério de pronto

- Testes de navegador (computador e celular):
  - plugin com a permissão define regras → palavras aparecem coloridas em edição e leitura
  - o texto salvo, a busca e o backup não mudam
  - desativar o plugin → destaques somem na hora; reativar → voltam
  - plugin sem a permissão → `forbidden`; regras fora do formato ou cor fora da paleta → `invalid_params`
  - "Mostrar destaques" desligado → nada pintado
  - tocar numa palavra com `comando` → abre o painel do plugin com a palavra
- Testes de unidade do motor de correspondência, incluindo acentos, maiúsculas, palavra inteira,
  sobreposição e desempenho
- Nota longa continua fluida ao digitar com destaques ativos (medido)
- Funcionando no Galaxy A52 (tema claro e escuro)
- Lint, tipos e todos os testes passando; relatório em `documentos/`

## Riscos

| Risco                                                   | Mitigação                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Digitação lenta em notas grandes                        | Recalcular só os parágrafos alterados; teste de desempenho; limite de 2.000 destaques por nota |
| Destaques atrapalharem a leitura                        | Paleta suave com contraste verificado; botão para esconder                                     |
| Plugin abusar (pintar tudo)                             | Limite de regras e de destaques; o usuário vê o que cada plugin destaca e pode desativar       |
| Conflito com links `[[...]]` e com o comando de seleção | Destaque não pinta dentro de links; testes de seleção com palavra destacada                    |
| Mudança no contrato                                     | Acréscimo compatível (`apiVersion` continua "1"); plugins antigos não são afetados             |
