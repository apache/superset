## Dataset Relationship Model

> Proposta de feature para o Apache Superset, baseada na implementação do PR #40981.
> Issue de referência: https://github.com/apache/superset/pull/40981

---

### 🎯 Problema

O Apache Superset não tem um conceito de primeiro nível para relações entre datasets. Em bancos normalizados (star schema, relational models), usuários precisam criar views denormalizadas ou virtual datasets com JOINs manuais toda vez que precisam referenciar colunas de uma tabela relacionada.

Isso gera:
- **Duplicação:** múltiplos virtual datasets que são só thin JOIN wrappers
- **Sem navegabilidade:** não dá pra ver como datasets se conectam
- **Sem infraestrutura:** features como cross-filtering, drill-down e merge de datasets não têm um metadata layer padronizado pra consumir

### ✅ Solução Proposta

Introduzir um modelo de dados + API + UI para declarar relações **tipadas e direcionadas** entre qualquer par de datasets do Superset.

```
┌─────────────────────────────────────────┐
│              FEATURE FLAG               │
│        DATASET_RELATIONSHIPS (bool)      │
│         Default: False (opt-in)          │
└─────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐
│   SQLAlchemy    │    │   Alembic       │
│   Models        │───▶│   Migration     │
│                 │    │                 │
│ - source/target │    │ create table    │
│ - relationship  │    │   dataset_      │
│   type (enum)   │    │   relationships │
│ - join_type     │    │ create table    │
│ - column pairs  │    │   dataset_      │
│ - soft delete   │    │   relationship_ │
│ - audit cols    │    │   columns       │
└─────────────────┘    └─────────────────┘

┌────────────────────────────────────────┐
│            REST API                    │
│                                        │
│ GET/POST/PUT/DELETE /api/v1/           │
│   dataset_relationship/                │
│ GET /api/v1/dataset_relationship/      │
│   dataset/{id}                         │
│ GET /api/v1/dataset/{id} → inclui      │
│   relationships (feature-gated)        │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│          FRONTEND (React Flow)         │
│                                        │
│ RelationshipCanvas → Graph editor      │
│ DatasetNode → Node customizado         │
│ RelationshipEdge → Edge com label      │
│ ColumnPickerModal → Mapear colunas     │
│ RelationshipBadge → Explore sidebar    │
│ DrillDownConfig → Config drill-down    │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│         CROSS-DATASET FILTERS          │
│                                        │
│ useCrossDatasetFilters hook            │
│ → traduz filtros ativos do chart       │
│   source para WHERE clauses no         │
│   dataset target                       │
│ → merge engine cross-database          │
│   (cache Redis, schema drift detect)   │
│ → drill-down hierárquico entre         │
│   datasets relacionados                │
└────────────────────────────────────────┘
```

### 👤 User Stories

**US1 — Navegação visual**
> "Como analista, quero ver um grafo mostrando como meus datasets se relacionam, para entender o modelo de dados sem caçar em documentação."

**US2 — Cross-filtering entre datasets**
> "Como analista, quero que um filtro aplicado no chart de Pedidos filtre automaticamente o chart de Clientes quando eles estão relacionados, sem precisar criar joins manuais."

**US3 — Drill-down hierárquico**
> "Como analista, quero clicar num país no chart de Vendas e ver o detalhamento por estado, navegando pela relação many-to-one entre as tabelas."

**US4 — Merge cross-database**
> "Como admin, quero relacionar um dataset do PostgreSQL com um do MySQL e permitir que o Superset faça merge automático, sem precisar de ETL intermediário."

### 📐 Detalhamento Técnico

#### Modelos

**DatasetRelationship**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | Integer PK | Auto |
| source_dataset_id | FK → tables.id | Dataset origem |
| target_dataset_id | FK → tables.id | Dataset destino |
| relationship_type | Enum | one_to_one, one_to_many, many_to_one, many_to_many |
| join_type | Enum | INNER, LEFT, RIGHT, FULL |
| is_cross_database | Bool | Auto-detectado |
| is_active | Bool | Soft toggle |
| name | String(255) | Nome legível (opcional) |
| description | Text | Descrição (opcional) |
| created_on / changed_on | DateTime | Audit |
| created_by_fk / changed_by_fk | FK | Audit |

**DatasetRelationshipColumn**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | Integer PK | Auto |
| relationship_id | FK → dataset_relationships | Cascade delete |
| source_column_name | String(255) | Coluna source |
| target_column_name | String(255) | Coluna target |
| operator | String(10) | Default "=" |
| ordinal | Integer | Ordem join multi-coluna |

#### API REST

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /api/v1/dataset_relationship/ | Listar (filtros + paginação) |
| POST | /api/v1/dataset_relationship/ | Criar |
| GET | /api/v1/dataset_relationship/{id} | Obter por ID |
| PUT | /api/v1/dataset_relationship/{id} | Atualizar |
| DELETE | /api/v1/dataset_relationship/{id} | Deletar |
| DELETE | /api/v1/dataset_relationship/?q=[ids] | Bulk delete |
| GET | /api/v1/dataset_relationship/dataset/{id} | Listar para dataset |

#### Frontend (React Flow)

- **RelationshipCanvas** — grafo interativo com suporte a zoom, pan e layout automático
- **DatasetNode** — node customizado mostrando nome, database, colunas-chave
- **RelationshipEdge** — edge com seta direcional e label (tipo cardinalidade + join type)
- **ColumnPickerModal** — modal para mapear colunas source → target
- **DrillDownConfig** — config de navegação hierárquica
- **RelationshipBadge** — badge no Explore indicando quantas relações o dataset tem

#### Cross-Dataset Filters

- Hook `useCrossDatasetFilters` que traduz filtros ativos do chart atual para o dataset relacionado
- Merge engine cross-database com cache Redis
- Injeção automática de JOINs para datasets relacionados
- Schema drift detection via tarefa Celery agendada

### 🔧 Feature Flag

**`DATASET_RELATIONSHIPS = False`** em `config.py`.

Quando desligada:
- API retorna 403
- Campos de relationship não aparecem em responses
- Frontend não renderiza canvas nem badges
- Zero impacto em performance ou comportamento existente

### 📦 Dependências

| Package | Versão | Licença | Uso |
|---------|--------|---------|-----|
| @xyflow/react | ^12.x | MIT | Canvas de grafos |

Zero novas dependências Python.

### 🔄 Migração

Uma migration Alembic criando:
- `dataset_relationships`
- `dataset_relationship_columns`

Rollback seguro via `DROP TABLE ... CASCADE`.

### ❓ Open Questions (para discussão com a comunidade)

1. **Cross-database merge engine**: deve vir como feature separada ou já na primeira versão?
2. **Drill-down config**: como expor na UI de forma intuitiva sem poluir o chart builder?
3. **Performance**: cache Redis é suficiente para merges cross-database frequentes, ou precisa de algo mais?
4. **Schema drift**: periodicidade ideal para a tarefa de detecção? Diária? Semanal?
5. **Nomenclatura**: o nome "Dataset Relationship Model" é claro ou sugestões melhores?

### 🔗 Links

- **PR de referência (implementação completa):** https://github.com/apache/superset/pull/40981
- **SIP Original:** https://github.com/hjadm/hibi/blob/main/SIP-DATASET-RELATIONSHIPS.md

### 🏗️ Status da Implementação

Bloqueios no PR #40981:

| Bloco | Status |
|-------|--------|
| Models + Migration | ✅ Pronto |
| REST API | ✅ Pronto |
| Feature Flag | ✅ Pronto |
| Frontend Canvas | ✅ Pronto |
| Cross-DB Merge Engine | ✅ Pronto |
| Cross-Dataset Filters | ✅ Pronto |
| Drill-Down Navigation | ✅ Pronto |
| Tests (156 passando) | ✅ Pronto |
| Schema Drift Detection | ✅ Pronto |

### 🚧 Bloqueios para Upstream

- Decisão sobre inclusão de cross-database merge na primeira versão
- Revisão de segurança da injeção de JOINs automáticos
- Performance benchmarks para cross-database queries
- Definição de periodicidade do schema drift
- Aprovação do SIP pela comunidade
