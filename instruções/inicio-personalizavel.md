# Início personalizável e widgets de plugins

**Pedido do usuário (2026-11-17):** personalizar a página inicial com as telas que quiser,
incluindo plugins.

## Decisões

| Tema                       | Decisão                                                                                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estrutura                  | O Início vira uma lista de **widgets** que o usuário adiciona, remove e reordena (botões subir/descer, que funcionam bem no toque e com leitor de tela)                                                              |
| Onde fica salvo            | Preferência do aparelho (celular e computador podem ter inícios diferentes)                                                                                                                                          |
| Widgets do app             | Sequência, Hoje, Foco, Notas recentes (já existiam) e **Atalhos** (novo: botões para telas escolhidas pelo usuário, inclusive telas de plugins)                                                                      |
| Widgets de plugins         | Novo ponto de extensão `contributes.widgets: [{ id, title, size }]`, com `size` `small` (120 px), `medium` (200 px) ou `large` (320 px). Superfície nova `widget`; o contexto informa qual widget (`context.widget`) |
| Compatibilidade            | Acréscimo ao contrato; `apiVersion` continua "1"; plugins existentes não mudam                                                                                                                                       |
| Desempenho                 | No máximo 4 widgets de plugin no Início; cada um só carrega quando aparece na tela                                                                                                                                   |
| Plugin desativado/removido | O widget some do Início sozinho; volta se o plugin for reativado                                                                                                                                                     |
| Exemplo                    | Dicionário PT ganha o widget "Busca rápida" (pequeno)                                                                                                                                                                |

## Passos

1. Contrato: `contributes.widgets`, superfície `widget`, `context.widget`; testes
2. Registro de widgets (app + plugins ativos) e arranjo salvo no aparelho
3. Início renderizado a partir do arranjo; modo "Personalizar" (adicionar, remover, subir, descer,
   restaurar padrão); configuração do widget Atalhos
4. Widget de plugin: quadro de altura fixa, carregamento ao aparecer, limite de 4
5. Widget "Busca rápida" no Dicionário PT
6. Guia de plugins atualizado; testes de navegador e no celular
