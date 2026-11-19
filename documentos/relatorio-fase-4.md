# Relatório da Fase 4 — Plugins v2 (ricos) e extras

**Data:** 2026-11-18 · **Plano:** `instruções/fase-4.md`

## Resumo

Os plugins agora podem viver **dentro do estudo**: cards cuja frente e verso o plugin desenha
(com uma reserva de texto e imagem para quando ele falta), blocos dentro da nota, imagens salvas e
sugestão de abrir conforme a matéria. O caso de referência, **Esqueleto 3D**, funciona de ponta a
ponta com o modelo real do Z-Anatomy: 210 ossos com nomes em português e latim, em 1,36 MB.

Antes da fase, a pedido do usuário, entraram dois extras fora do plano (aparência e mascote) e o
planejamento da Fase 5 foi refeito. A Fase 3.1 (destaques de palavras) foi adiada.

## Extras (fora das fases)

| Área      | Resultado                                                                                                                                                                                                                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aparência | 8 paletas (claro e escuro), cor de destaque própria, 7 fontes embutidas (funcionam sem internet), fonte separada para as notas, tamanho do texto, imagem de fundo com véu, desfoque e opacidade dos painéis. Aplicada antes da primeira pintura (sem piscar) e repassada aos plugins                                                                 |
| Mascote   | Mascotes do open-bot-avatar (4 do usuário + 4 de recompensa pela melhor sequência), apelido e cor. Aparece no canto da tela, no Início, na Busca (pensa enquanto busca; sem resultado, sugere criar a nota) e na revisão (reage às respostas e comemora)                                                                                             |
| Ajuda     | Lembretes de cards vencidos e de sequência em risco, meta diária com barra, quiz rápido no balão, dicas de estudo, reação ao fim do foco (dica para a pausa), cards difíceis, notas soltas, resumo da semana, lembrete de backup e lembrete diário (notificação no Android). Plugins podem trazer mascotes e falar pelo mascote (permissão `mascot`) |

## Planejamento

- **Fase 3.1** adiada por decisão do usuário; o plano continua válido.
- **Fase 5** refeita (`instruções/fase-5.md`): sem sync em tempo real; o servidor guarda só conta,
  assinatura e backups. Login com Google e e-mail, backup na nuvem com restauração que **mescla**
  dois aparelhos, criptografia opcional, IA com a chave do próprio usuário (grátis) ou por
  assinatura (limite diário e semanal), limites como tabela de planos no servidor.

## Fase 4 — Entregue

| Área                 | Resultado                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrato e kit       | `files.read`, `assets.save`, `cards.proposeVisual`, `notes.insertEmbed`, superfície `card`, contextos `card` e `embed`; WebAssembly liberado nos plugins (`'wasm-unsafe-eval'`)                                                                   |
| Cards de plugin      | Confirmação com tudo personalizável (pergunta, resposta, imagem). Na revisão: pergunta em cima, o plugin no meio, resposta embaixo; os botões de resposta são do app. Reserva quando o plugin está desativado, falha ou não responde em 10 s      |
| Personalização       | Cards vindos de plugins (Dicionário e Esqueleto) editáveis antes e depois de criados; a busca acompanha o texto editado                                                                                                                           |
| Blocos na nota       | Miniatura + rótulo, estáticos (sem iframe dentro da nota); tocar abre o painel do plugin no ponto certo; "Plugin indisponível" sem o plugin; até 20 por nota                                                                                      |
| Etiquetas e sugestão | Etiquetas por matéria (herdadas pelos tópicos); `activation: ["onSubjectTag:anatomia"]` mostra "Abrir Esqueleto 3D" na nota. Nunca abre sozinho                                                                                                   |
| Banco                | Busca dos cards de plugin pelo texto da reserva (migração `0005`); backup preserva cards visuais, blocos e imagens                                                                                                                                |
| Esqueleto 3D         | Girar, zoom com pinça, tocar num osso (raio maior no toque, para ossos pequenos), busca sem acento em português e latim, filtro e isolamento por região, questão visual com miniatura, card girável na revisão, bloco na nota, atribuição visível |
| Modelo               | Z-Anatomy (CC BY-SA 4.0, base BodyParts3D): 210 ossos, 126 mil vértices, **1,36 MB** (meta: até 8 MB). Nomes da Terminologia Anatômica (TA2) em português, com o lado ("Fêmur (lado esquerdo)")                                                   |
| Guia                 | `docs/guia-de-plugins.md` com cards visuais, blocos, imagens, arquivos, etiquetas e mascotes                                                                                                                                                      |

## Decisões tomadas com o usuário

- Recorte do Esqueleto: só o esqueleto; sugestão discreta, sem abrir sozinho (2026-11-17).
- Cards vindos de plugins devem continuar personalizáveis (2026-11-18).
- Mascote Livro liberado para todos (o usuário removeu o bloqueio).
- Rodar o Blender sobre o arquivo do Z-Anatomy autorizado pelo usuário (2026-11-18).

## Como o modelo foi preparado

Script versionado em `plugins/esqueleto-3d/tools/exportar_esqueleto.py` (passo a passo em
`tools/LEIA-ME.md`):

1. Blender 4.2 LTS sem interface, com `--disable-autoexec` (scripts embutidos do `.blend` desligados).
2. Carrega do `Startup.blend` **só** a coleção "Skeletal system": abrir o arquivo inteiro passou de
   4 GB e foi encerrado por falta de memória nesta máquina (7,5 GB). Só a coleção: cerca de 600 MB.
3. Separa os ossos dos rótulos do atlas (objetos de texto e linhas indicadoras de 2 vértices) e
   deixa de fora discos, ligamentos, cartilagens, seios da face e dentes.
4. Nomes pela TA2 em português; vértebras, costelas, metacarpais, metatarsais e falanges por regras
   a partir dela; 3 nomes à mão (Atlas, Áxis, sesamoides do pé) e 3 erros de digitação do latim da
   TA2 corrigidos.
5. `gltf-transform`: `weld`, `simplify` (proporção 0,5, erro 0,0005) e `meshopt` (8,5 MB → 1,36 MB).

## Achados durante a fase

| Achado                                                                                           | Correção                                                                                       |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| O painel descartava os dados do bloco: tocar no bloco abria o plugin sem o osso                  | O painel repassa `context.embed`                                                               |
| Na confirmação, mudar a lista de baralhos apagava o que o usuário tinha editado                  | O rascunho só é reiniciado quando chega uma proposta nova                                      |
| Posição dos ossos lida antes de o Blender calcular os pais (os dois fêmures no mesmo lugar)      | Atualizar a cena antes de ler; soltar cada osso do pai mantendo a posição no mundo             |
| Concordância do lado em português ("Falange… esquerda/esquerdo") impossível de acertar por regra | Formato "Fêmur (lado esquerdo)"                                                                |
| Mascote e widget do Dicionário vazios em capturas no celular                                     | Não era defeito: o Início leva alguns segundos para terminar de carregar depois de abrir o app |
| A tela do plugin repetia o nome do osso no verso, que podia divergir do texto personalizado      | O plugin mostra só o modelo; pergunta e resposta vêm do app                                    |

## Verificação

- Lint e tipos sem erros
- 112 testes de unidade (core 25, contrato 7, banco 34, dicionário 3, esqueleto 2, app 41)
- 99 testes de navegador (computador e celular): card visual com plugin de teste (personalizar,
  revisar frente e verso, editar depois, buscar, reserva com plugin desativado e com plugin que
  não responde em 10 s), bloco na nota (inserir, miniatura, tocar abre no ponto certo,
  "indisponível"), sugestão por etiqueta (e ausência sem etiqueta), Esqueleto 3D com o modelo real
  (buscar, selecionar, questão visual, revisar), aparência, mascote

### No Galaxy A52 (Android 14, WebView 157)

Medido em 2026-11-18, com o app instalado por USB e controlado pelo DevTools.

| Verificação                                                     | Resultado                                                                                                                                                                                                                    |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modelo abre em até 3 s                                          | **0,32 s** (3 aberturas com o app recém-aberto: 344, 319 e 318 ms, do iframe aberto até o modelo na tela)                                                                                                                    |
| Gira de forma fluida                                            | **61 quadros/s** girando com o dedo: mediana 16,5 ms por quadro, pior 16,7 ms, nenhum quadro acima de 33 ms                                                                                                                  |
| Tocar seleciona o osso certo                                    | **7 de 8** no corpo inteiro (frontal, esterno, úmero, quadril, os dois fêmures, tíbia). A mandíbula, pequena nessa distância, pegou o osso de trás pelo vão do arco; aproximando a câmera, 4 de 4 toques nela acertaram      |
| 20 cards visuais seguidos sem travar nem esquentar anormalmente | **20 de 20** num baralho de teste (apagado depois): modelo pronto em 0,42 s no primeiro card, os seguintes reaproveitam o mesmo quadro 3D; a resposta aparece em cerca de 22 ms. Bateria a 34,5 °C ao final, sem aquecimento |

Achados nas medições, já corrigidos: nomes "Talus" e "Incus" ficaram em latim (agora "Tálus" e
"Bigorna"); excluir um baralho não tirava as respostas dele das estatísticas, embora a tela
dissesse que sim (agora tira).

## Pendências

- Fase 3.1 (destaques) — feita na Fase 4.1.
- Fase 0: "Prova 2 com modelo GLB real e biblioteca 3D" — coberta pelo Esqueleto 3D (GLB real com
  Three.js e Meshopt), confirmada pelas medições acima.
