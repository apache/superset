# Safira — Sprints de Frontend

## Visão Geral

**Três frentes:**

| Frente | O que resolve | Prazo |
|---|---|---|
| **1. Visual (casca)** | Cliente para de comparar com Power BI | Curto |
| **2. Drill customizado** | Cliente vê dados relevantes no detalhe | Curto |
| **3. Cross-filter entre datasets** | Relacionamento entre tabelas + filtro cruzado real | Médio |

---

## Sprint 1 — Visual: Theme Tokens + Filtros + Chart Cards

**Objetivo:** Mudar a percepção visual com o menor esforço possível. Não refazer tudo, mas acertar os pontos que o cliente mais vê.

### Tarefas

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 1.1 | Configurar `THEME_DEFAULT` com paleta Safira no `config.py` | 30min | Nenhuma |
| 1.2 | Configurar fontes (Inter já tá, mas confirmar carregamento) | 15min | 1.1 |
| 1.3 | Subir frontend dev standalone (porta 9000) pra ver preview | 30min | Nenhuma |
| 1.4 | Estilizar filtros nativos — cards com border radius, sombra, hover | 4h | 1.3 |
| 1.5 | Estilizar chart cards — moldura com sombra suave, header minimalista | 4h | 1.3 |
| 1.6 | Estilizar dashboard header / toolbar — versão mais limpa | 2h | 1.3 |
| 1.7 | Ajustar navbar + branding (logo, cores, fonte) | 1h | 1.1 |

**Total estimado:** ~12h (2 dias)

**Critério de aceite:** Dashboard embedado no Safira Portal com filtros e charts visualmente superiores ao Power BI (na opinião do Higor).

---

## Sprint 2 — Drill Customizado

**Objetivo:** Quando o cliente clicar pra detalhar, ver informações relevantes — não o raw data inteiro.

### Tarefas

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 2.1 | Adicionar campo `drill_columns` no JSON metadata do chart (backend) | 2h | Nenhuma |
| 2.2 | Criar UI no Explore pra configurar colunas do drill | 3h | 2.1 |
| 2.3 | Modificar `DrillDetailPane.tsx` pra usar só as colunas configuradas | 2h | 2.1 |
| 2.4 | Adicionar opção de agregação no drill (soma, média, contagem) | 2h | 2.2 |
| 2.5 | Adicionar breadcrumb de navegação entre níveis de drill | 1h | 2.3 |
| 2.6 | Estilizar a tabela de drill (mesmo padrão visual da Sprint 1) | 1h | Sprint 1 |

**Total estimado:** ~11h (1.5 dias)

**Critério de aceite:** Drill abre modal/tabela com somente as colunas configuradas, dados agregados, breadcrumb funcional.

---

## Sprint 3 — Cross-filter entre Datasets

**Objetivo:** Finalizar a branch `feature/dataset-relationships-design` e ativar em produção.

### Tarefas

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 3.1 | Review completo do que já foi implementado na branch | 2h | Nenhuma |
| 3.2 | Validar migrations + modelos + API endpoints | 1h | 3.1 |
| 3.3 | Finalizar UI de configuração de relacionamento (`DatasetRelationshipsPage.tsx`) | 4h | 3.1 |
| 3.4 | Ativar feature flag `DATASET_RELATIONSHIPS` em homologação | 15min | 3.2 |
| 3.5 | Testar com dados reais (relacionamento + cross-filter) | 2h | 3.4 |
| 3.6 | Ativar feature flag em produção | 15min | 3.5 |
| 3.7 | Documentar como configurar relacionamentos (pra você e pro cliente) | 1h | 3.5 |

**Total estimado:** ~10h (1.5 dias)

**Critério de aceite:** Cliente configura relação entre datasets no UI, cross-filter funciona entre charts de datasets diferentes.

---

## Sprint 4 — Cross-filter Visual

**Objetivo:** Quando um chart filtra outro, dar feedback visual (diminuir opacidade dos não afetados, destacar os filtrados).

*Depende da Sprint 3 estar funcionando.*

### Tarefas

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 4.1 | Mapear estado de cross-filter no Redux pra cada chart | 2h | Sprint 3 |
| 4.2 | Implementar dimming (opacidade reduzida) nos charts não afetados | 2h | 4.1 |
| 4.3 | Implementar badge de "filtrado por" no header do chart | 1h | 4.1 |
| 4.4 | Animação suave na transição de filtro | 1h | 4.2 |

**Total estimado:** ~6h (1 dia)

**Critério de aceite:** Clica num chart → charts relacionados são destacados, não relacionados ficam com opacidade reduzida. Badge mostra qual chart está filtrando.

---

## Cronograma Sugerido

| Sprint | Dias | Total acumulado |
|---|---|---|
| Sprint 1 — Visual | 2 | 2 |
| Sprint 2 — Drill | 1.5 | 3.5 |
| Sprint 3 — Cross-filter datasets | 1.5 | 5 |
| Sprint 4 — Cross-filter visual | 1 | 6 |

**6 dias úteis de trabalho focados** pra entregar as três dores.

---

## Como Rodar

Cada sprint tem `critério de aceite`. Só avança pra próxima quando o critério da anterior for validado por você. Isso impede acumular coisa incompleta.

Se quiser, posso quebrar a **Sprint 1** em tarefas individuais mais detalhadas (arquivos específicos, snippets de código, branches). É só falar qual sprint quer começar.
