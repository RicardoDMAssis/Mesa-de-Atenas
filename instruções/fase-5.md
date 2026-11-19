# Fase 5 — Conta, backup na nuvem e IA

**Objetivo:** permitir usar o Estudarella em mais de um aparelho sem perder nada e dar acesso a
IA, sem transformar o servidor num banco com as notas de todo mundo.

**Ponto de partida:** tudo local (SQLite no aparelho); backup manual em arquivo, que **substitui**
tudo ao restaurar; colunas de sincronização (`id` gerado no aparelho, `updated_at`, `deleted_at`)
em todas as tabelas desde a Fase 0; permissão `ai` já prevista no contrato de plugins, sem métodos.

## Decisões tomadas com o usuário (2026-11-18)

- **Sem sync em tempo real.** O servidor guarda só conta, assinatura e os backups que o usuário gera.
- **Login** com Google, e-mail e outras formas comuns.
- **IA de duas fontes:** a chave do próprio usuário (grátis, mais trabalhosa) ou a IA contratada
  por nós, paga, com limite diário e semanal (mais fácil e certeira).
- **Backup na nuvem sem limite** para quem tem conta: a intenção é lançar o app por assinatura.
  Os limites ficam numa tabela de planos, para poder criar depois um plano grátis com limite sem
  mudar o app.
- **Criptografia do backup: opcional.**
- **Uso grátis só local** (decidido em 2026-11-18): sem conta ou sem assinatura, o app funciona
  inteiro no aparelho, inclusive a IA com a chave do próprio usuário. A assinatura acrescenta o
  backup na nuvem e a IA contratada.
- **Uma assinatura só**: backup na nuvem e IA contratada vêm juntos, sem adicional.
- **Funções com IA** (todas entram): gerar cards a partir de uma nota, explicar a resposta de um
  card, conversar com o mascote (tirar dúvidas gerais e sobre o que está sendo estudado) e pedir
  ao mascote que crie notas.

## Conta

| Tema              | Decisão                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Provedor          | Supabase Auth                                                                                                                            |
| Formas de entrar  | Google, e-mail (senha ou link mágico); Apple e Microsoft se for simples de ligar                                                         |
| Sem conta         | O app continua funcionando inteiro, só local. Conta é necessária para backup na nuvem e IA por assinatura                                |
| Android           | Login com Google pelo navegador do sistema, voltando ao app por link próprio (`com.estudarella.app://`); nada de WebView embutido        |
| Dados no servidor | Tabelas `profiles` (nome, criado em), `subscriptions` (plano, status, validade, loja) e `plans` (limites). RLS: cada um vê só o seu      |
| Apagar conta      | Na tela de conta: apaga perfil, assinatura e todos os backups (LGPD). Os dados do aparelho ficam, a menos que o usuário peça para apagar |

## Backup na nuvem

| Tema         | Decisão                                                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onde         | Supabase Storage, pasta privada por usuário (`backups/<user_id>/`), protegida por RLS                                                                                              |
| Formato      | O mesmo arquivo do backup local (banco + imagens), compactado                                                                                                                      |
| Quando       | Manual (botão) e automático: ao fechar ou esconder o app, no máximo uma vez a cada 6 h, só se algo mudou                                                                           |
| Versões      | Guarda as N mais recentes (N vem do plano; padrão 10); as mais antigas são apagadas                                                                                                |
| Criptografia | Opcional: senha do backup, chave derivada no aparelho (PBKDF2/Argon2) e AES-GCM. Sem a senha ninguém lê, nem o servidor. Esqueceu a senha, perdeu o backup (aviso claro ao ativar) |
| Tela         | Conta → Backups: lista com data, aparelho e tamanho; restaurar; baixar o arquivo                                                                                                   |

### Restauração que mescla

Hoje restaurar substitui tudo. Com mais de um aparelho isso perde trabalho, então a restauração
passa a **mesclar** linha por linha, usando as colunas que já existem:

| Situação                                  | Resultado                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Item só existe de um lado                 | Entra                                                                                       |
| Item existe dos dois lados                | Fica a versão com `updated_at` mais recente                                                 |
| Excluído de um lado (`deleted_at`)        | Continua excluído se a exclusão for mais recente que a última edição do outro lado          |
| `review_logs` (histórico de respostas)    | Soma os dois lados (nunca conflita: cada resposta tem o seu `id`)                           |
| Estado do card depois de somar respostas  | O agendamento do card fica o da versão mais recente; o histórico completo serve para o FSRS |
| Imagens                                   | Pelo hash: entra o que falta                                                                |
| Preferências do aparelho (tema, mascote…) | Não fazem parte do backup                                                                   |

A opção "substituir tudo" continua existindo, com confirmação, para quem quiser voltar no tempo.

## IA

Um único serviço interno no app (`ai.complete`, `ai.chat`) usado por todas as funções e plugins.
Só muda **de onde** a IA vem.

### Fonte 1 — chave do próprio usuário (sem custo extra)

| Tema          | Decisão                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Provedores    | Google AI Studio (Gemini), Groq, OpenRouter, e qualquer serviço com API compatível com OpenAI (endereço personalizado), inclusive Ollama local         |
| Como conectar | OpenRouter: botão "Entrar com OpenRouter" (OAuth com PKCE, devolve a chave). Demais: passo a passo com link de onde criar a chave e campo para colar   |
| Onde fica     | Só no aparelho, nunca no servidor, no backup ou em plugins. Botão para testar e para apagar                                                            |
| Avisos        | Limites da camada grátis de cada serviço; alguns usam o que é enviado para treinar modelos (ex.: Google AI Studio grátis). Aviso antes do primeiro uso |
| Chamadas      | Direto do aparelho ao provedor. No Android pelo HTTP nativo do Capacitor (sem problema de CORS); na web, conferir CORS de cada provedor no passo 1     |

### Fonte 2 — IA contratada (assinatura)

| Tema      | Decisão                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Caminho   | App → Edge Function (exige login e assinatura ativa) → provedor contratado. A chave do provedor fica só no servidor                      |
| Limites   | Por **créditos** (cada uso gasta conforme o tamanho do texto enviado e recebido), com teto **diário e semanal** vindos da tabela `plans` |
| Ao acabar | Mensagem clara com quando renova; sugestão de usar a própria chave                                                                       |
| Registro  | Tabela `ai_usage` (usuário, dia, créditos). Sem guardar o conteúdo enviado                                                               |
| Pagamento | Android: Google Play Billing (obrigatório para assinatura no app; a loja fica com 15%). Web: Mercado Pago ou Stripe (Pix e cartão)       |

### Privacidade e uso

- O app mostra **o que** vai ser enviado (ex.: "o texto desta nota") antes da primeira vez em cada função.
- Plugins com a permissão `ai` chamam `app.ai.complete()`; nunca veem a chave nem sabem a fonte.
  O uso deles conta nos mesmos limites.
- Funções do app com IA (decidido em 2026-11-18):
  - gerar cards a partir de uma nota (lote, com a mesma tela de confirmação dos plugins);
  - explicar a resposta de um card na revisão;
  - **conversar com o mascote**: tirar dúvidas gerais e sobre a matéria, num chat que abre pelo
    balão do mascote; ele recebe o contexto (nota aberta, matéria, cards do dia) só quando a
    pergunta pede;
  - **pedir ao mascote que crie uma nota** (ex.: "faça um resumo de mitose"): a nota passa pela
    mesma tela de confirmação de `notes.propose` (o usuário confere, escolhe a matéria e cria).
- **Foto para nota com IA**: o plugin Foto para nota (já feito, leitura no aparelho) ganha a
  opção "Ler com IA" para letra de mão e páginas difíceis, usando `ai.*` com imagem. A leitura no
  aparelho continua sendo o padrão.

## Planos e limites

Tabela `plans` no servidor, lida pelo app e pela Edge Function:

| Campo               | Exemplo (assinatura) |
| ------------------- | -------------------- |
| `backup_versions`   | 10                   |
| `backup_max_mb`     | sem limite (`null`)  |
| `ai_daily_credits`  | 200                  |
| `ai_weekly_credits` | 1000                 |

Criar depois um plano "grátis com limite" é só inserir uma linha (ex.: 1 versão, 50 MB, sem IA
contratada) e associar a quem não assina. O app não muda.

## Passos

1. **Pesquisa rápida:** CORS e formato de chamada de cada provedor de IA; custo do Supabase e do
   provedor contratado por usuário/mês; regras do Play Billing
2. **Supabase:** projeto, tabelas `profiles`, `subscriptions`, `plans`, `ai_usage`, RLS e Storage
   com testes de acesso (um usuário não lê o backup de outro)
3. **Conta no app:** entrar, sair, apagar conta; Google no Android
4. **Mesclagem** no `packages/db` (função pura, muito testada) e restauração local que mescla
5. **Backup na nuvem:** enviar, listar, restaurar, versões, automático; criptografia opcional
6. **IA com chave própria:** serviço interno, adaptador compatível com OpenAI, OpenRouter OAuth,
   tela de configuração, avisos
7. **IA por assinatura:** Edge Function, créditos, limites, mensagens
8. **Contrato de plugins:** `ai.complete` (permissão `ai`, aceitando imagem), kit e guia; "Ler com
   IA" no Foto para nota
9. **Mascote com IA:** chat pelo balão (dúvidas gerais e sobre a matéria) e pedido de nota
10. **Pagamento:** Play Billing e pagamento web
11. **Plugin Analisador de Edital**
12. Testes, relatório em `documentos/relatorio-fase-5.md`

## Critério de pronto

- Entrar com Google e com e-mail no computador e no Galaxy A52; sair; apagar a conta apaga tudo no servidor
- Dois aparelhos: editar notas e responder cards nos dois, fazer backup num e restaurar no outro → nada se perde (testado com o cenário da tabela de mesclagem)
- Backup criptografado não abre sem a senha; com a senha, restaura
- IA com chave própria (Groq ou Gemini) gera cards de uma nota; a chave não aparece no backup nem em nenhuma requisição ao nosso servidor
- IA por assinatura respeita o limite diário e o semanal
- O mascote responde uma dúvida e cria uma nota (confirmada pelo usuário) com as duas fontes de IA
- Lint, tipos e todos os testes passando

## Fora do escopo

- Sync em tempo real
- Compartilhar notas ou baralhos com outras pessoas
- Plugins pagos de terceiros

## Riscos

| Risco                                                             | Mitigação                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Mesclagem perder edição quando os dois lados mudaram a mesma nota | A versão perdida vai para "conflitos" (nota cópia marcada) em vez de sumir — decidir no passo 4 |
| Provedor grátis mudar limites ou fechar a camada grátis           | Adaptador genérico; trocar de provedor é trocar endereço e chave                                |
| Custo da IA contratada maior que o previsto                       | Limites por créditos na tabela de planos, ajustáveis sem atualizar o app                        |
| Backups grandes (muitas imagens)                                  | Compactar; enviar imagens pelo hash só quando faltarem (passo 5)                                |
| Regras da Play Store para assinatura                              | Usar Play Billing desde o início no Android                                                     |

## A confirmar com o usuário

Nada pendente: uso grátis, assinatura única e funções com IA foram decididos em 2026-11-18.
