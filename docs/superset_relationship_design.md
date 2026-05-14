# Dataset Relationship Engine — Design Document

**Projeto:** hibi (fork Apache Superset)  
**Data:** 2026-05-14  
**Autor:** Abacus AI Agent  
**Status:** Proposta (Draft)

---

## 1. Resumo Executivo

Este documento descreve o design técnico para implementação de um **motor de relacionamentos entre datasets** no fork `hibi` do Apache Superset. O objetivo é permitir que dashboards combinem dados de múltiplos datasets — inclusive de **bancos de dados diferentes** — através de JOINs, drill-downs e propagação de filtros.

### Problema

Atualmente o Superset trata cada dataset como uma entidade isolada. Para combinar dados de fontes diferentes, o usuário precisa criar views SQL manualmente ou usar datasets virtuais. Não há suporte nativo para:

- Relacionamentos declarativos entre datasets
- JOINs automáticos entre tabelas do mesmo banco
- Merge de dados entre bancos diferentes (cross-database)
- Drill-down hierárquico entre datasets relacionados
- Propagação automática de filtros entre charts com datasets diferentes

### Solução Proposta

Um engine de relacionamentos em 3 fases:

1. **Phase 1 — Backend & Engine**: Novas tabelas, API e dual-mode JOIN engine
2. **Phase 2 — Frontend & Model View**: Canvas visual para modelagem de relacionamentos
3. **Phase 3 — Advanced Interactions**: Cross-filtering, drill-down e propagação de filtros

---

## 2. Phase 1 — Backend & Engine

### 2.1 Novas Tabelas de Banco de Dados

#### Tabela `dataset_relationships`

```sql
CREATE TABLE dataset_relationships (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid            VARCHAR(36) UNIQUE NOT NULL,
    
    -- Source dataset
    source_dataset_id   INTEGER NOT NULL REFERENCES ab_datasets(id) ON DELETE CASCADE,
    
    -- Target dataset
    target_dataset_id   INTEGER NOT NULL REFERENCES ab_datasets(id) ON DELETE CASCADE,
    
    -- Relationship metadata
    relationship_type   VARCHAR(20) NOT NULL DEFAULT 'many_to_one',
        -- one_to_one, one_to_many, many_to_one, many_to_many
    
    join_type           VARCHAR(10) NOT NULL DEFAULT 'LEFT',
        -- LEFT, INNER, RIGHT, FULL
    
    -- Cross-database flag (computed on save)
    is_cross_database   BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Descriptive
    name                VARCHAR(256),
    description         TEXT,
    
    -- Audit
    created_by_fk       INTEGER REFERENCES ab_user(id),
    changed_by_fk       INTEGER REFERENCES ab_user(id),
    created_on          DATETIME DEFAULT CURRENT_TIMESTAMP,
    changed_on          DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_dataset_relationship UNIQUE (source_dataset_id, target_dataset_id)
);
```

#### Tabela `dataset_relationship_columns`

```sql
CREATE TABLE dataset_relationship_columns (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    
    relationship_id INTEGER NOT NULL 
        REFERENCES dataset_relationships(id) ON DELETE CASCADE,
    
    -- Column mapping
    source_column   VARCHAR(256) NOT NULL,
    target_column   VARCHAR(256) NOT NULL,
    
    -- Operator for join condition (default =)
    operator        VARCHAR(10) NOT NULL DEFAULT '=',
    
    -- Order of this column pair in multi-column joins
    ordinal         INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT uq_rel_column_pair UNIQUE (relationship_id, source_column, target_column)
);
```

### 2.2 SQLAlchemy Models

```python
# superset/models/dataset_relationship.py

class DatasetRelationship(Model, AuditMixinNullable):
    """Represents a declared relationship between two datasets."""
    
    __tablename__ = "dataset_relationships"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, nullable=False, default=generate_uuid)
    
    source_dataset_id = Column(Integer, ForeignKey("tables.id", ondelete="CASCADE"), nullable=False)
    target_dataset_id = Column(Integer, ForeignKey("tables.id", ondelete="CASCADE"), nullable=False)
    
    relationship_type = Column(String(20), nullable=False, default="many_to_one")
    join_type = Column(String(10), nullable=False, default="LEFT")
    is_cross_database = Column(Boolean, nullable=False, default=False)
    
    name = Column(String(256))
    description = Column(Text)
    
    # Relationships
    source_dataset = relationship("SqlaTable", foreign_keys=[source_dataset_id])
    target_dataset = relationship("SqlaTable", foreign_keys=[target_dataset_id])
    column_mappings = relationship(
        "DatasetRelationshipColumn",
        back_populates="relationship",
        cascade="all, delete-orphan",
        order_by="DatasetRelationshipColumn.ordinal",
    )


class DatasetRelationshipColumn(Model):
    """Column pair mapping within a dataset relationship."""
    
    __tablename__ = "dataset_relationship_columns"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    relationship_id = Column(
        Integer, 
        ForeignKey("dataset_relationships.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    source_column = Column(String(256), nullable=False)
    target_column = Column(String(256), nullable=False)
    operator = Column(String(10), nullable=False, default="=")
    ordinal = Column(Integer, nullable=False, default=0)
    
    relationship = relationship("DatasetRelationship", back_populates="column_mappings")
```

### 2.3 Dual-Mode JOIN Engine

O engine opera em dois modos, determinados automaticamente pelo flag `is_cross_database`:

#### Modo 1 — Same-Database (SQL JOIN)

Quando ambos os datasets estão no mesmo banco de dados, o engine injeta cláusulas JOIN diretamente na query SQL gerada.

**Ponto de injeção:** `superset/models/helpers.py` → `ExploreMixin.get_sqla_query()`

```python
# Pseudocódigo da modificação em get_sqla_query()
def get_sqla_query(self, query_obj, ...):
    qry = sa.select(columns).select_from(self.get_from_clause())
    
    # === NEW: Inject relationship JOINs ===
    if query_obj.relationships:
        for rel in query_obj.relationships:
            if not rel.is_cross_database:
                target_table = rel.target_dataset.get_sqla_table()
                join_condition = and_(
                    *[
                        getattr(source_table.c, cm.source_column) 
                        == getattr(target_table.c, cm.target_column)
                        for cm in rel.column_mappings
                    ]
                )
                qry = qry.join(
                    target_table,
                    join_condition,
                    isouter=(rel.join_type == "LEFT"),
                )
    # === END NEW ===
    
    # ... resto do pipeline de filtros, groupby, orderby ...
    return qry
```

#### Modo 2 — Cross-Database (Pandas Merge)

Quando os datasets estão em bancos diferentes, o engine executa queries separadas e faz merge dos DataFrames resultantes no nível da aplicação.

**Ponto de injeção:** `superset/models/helpers.py` → `ExploreMixin.get_query_result()`

```python
# Pseudocódigo da modificação em get_query_result()
def get_query_result(self, query_obj, ...):
    # Executa query principal
    primary_result = self.query(query_obj)
    primary_df = primary_result.df
    
    # === NEW: Cross-database merges ===
    if query_obj.relationships:
        for rel in query_obj.relationships:
            if rel.is_cross_database:
                # Proteção de memória
                if len(primary_df) > RELATIONSHIP_MAX_MERGE_ROWS:
                    raise RelationshipMergeError(
                        f"Primary dataset exceeds {RELATIONSHIP_MAX_MERGE_ROWS} rows limit"
                    )
                
                # Executa query no dataset target
                target_result = rel.target_dataset.query(
                    _build_target_query(rel, primary_df)
                )
                target_df = target_result.df
                
                if len(target_df) > RELATIONSHIP_MAX_MERGE_ROWS:
                    raise RelationshipMergeError(
                        f"Target dataset exceeds {RELATIONSHIP_MAX_MERGE_ROWS} rows limit"
                    )
                
                # Merge dos DataFrames
                primary_df = primary_df.merge(
                    target_df,
                    left_on=[cm.source_column for cm in rel.column_mappings],
                    right_on=[cm.target_column for cm in rel.column_mappings],
                    how=rel.join_type.lower(),
                    suffixes=("", f"__{rel.target_dataset.table_name}"),
                )
    # === END NEW ===
    
    primary_result.df = primary_df
    return primary_result
```

**Constante de proteção:**
```python
# superset/config.py
RELATIONSHIP_MAX_MERGE_ROWS = 100_000
```

### 2.4 API REST

```
# Dataset Relationships API
GET    /api/v1/dataset_relationship/              # List all relationships
POST   /api/v1/dataset_relationship/              # Create relationship
GET    /api/v1/dataset_relationship/<id>/         # Get relationship details
PUT    /api/v1/dataset_relationship/<id>/         # Update relationship
DELETE /api/v1/dataset_relationship/<id>/         # Delete relationship

# Relationship discovery
GET    /api/v1/dataset_relationship/related/<dataset_id>/  # Get all relationships for a dataset
GET    /api/v1/dataset_relationship/graph/                  # Get full relationship graph
```

#### Exemplo de payload para criação:

```json
{
  "source_dataset_id": 1,
  "target_dataset_id": 5,
  "relationship_type": "many_to_one",
  "join_type": "LEFT",
  "name": "Orders → Customers",
  "column_mappings": [
    {
      "source_column": "customer_id",
      "target_column": "id",
      "operator": "="
    }
  ]
}
```

### 2.5 DAO Layer

```python
# superset/daos/dataset_relationship.py

class DatasetRelationshipDAO(BaseDAO[DatasetRelationship]):
    model_cls = DatasetRelationship
    
    @classmethod
    def find_by_dataset(cls, dataset_id: int) -> list[DatasetRelationship]:
        """Find all relationships where dataset is source or target."""
        return (
            db.session.query(DatasetRelationship)
            .filter(
                or_(
                    DatasetRelationship.source_dataset_id == dataset_id,
                    DatasetRelationship.target_dataset_id == dataset_id,
                )
            )
            .all()
        )
    
    @classmethod
    def compute_is_cross_database(cls, rel: DatasetRelationship) -> bool:
        """Determine if relationship spans different databases."""
        return (
            rel.source_dataset.database_id != rel.target_dataset.database_id
        )
    
    @classmethod
    def get_relationship_graph(cls) -> dict:
        """Return all relationships as a graph structure for visualization."""
        rels = db.session.query(DatasetRelationship).all()
        nodes = set()
        edges = []
        for rel in rels:
            nodes.add(rel.source_dataset_id)
            nodes.add(rel.target_dataset_id)
            edges.append({
                "source": rel.source_dataset_id,
                "target": rel.target_dataset_id,
                "type": rel.relationship_type,
                "is_cross_db": rel.is_cross_database,
            })
        return {"nodes": list(nodes), "edges": edges}
```

### 2.6 Alembic Migration

```python
# superset/migrations/versions/xxxx_add_dataset_relationships.py

def upgrade():
    op.create_table(
        "dataset_relationships",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("uuid", sa.String(36), unique=True, nullable=False),
        sa.Column("source_dataset_id", sa.Integer(), sa.ForeignKey("tables.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_dataset_id", sa.Integer(), sa.ForeignKey("tables.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relationship_type", sa.String(20), nullable=False, server_default="many_to_one"),
        sa.Column("join_type", sa.String(10), nullable=False, server_default="LEFT"),
        sa.Column("is_cross_database", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("name", sa.String(256)),
        sa.Column("description", sa.Text()),
        sa.Column("created_by_fk", sa.Integer(), sa.ForeignKey("ab_user.id")),
        sa.Column("changed_by_fk", sa.Integer(), sa.ForeignKey("ab_user.id")),
        sa.Column("created_on", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("changed_on", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("source_dataset_id", "target_dataset_id", name="uq_dataset_relationship"),
    )
    
    op.create_table(
        "dataset_relationship_columns",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("relationship_id", sa.Integer(), sa.ForeignKey("dataset_relationships.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_column", sa.String(256), nullable=False),
        sa.Column("target_column", sa.String(256), nullable=False),
        sa.Column("operator", sa.String(10), nullable=False, server_default="="),
        sa.Column("ordinal", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("relationship_id", "source_column", "target_column", name="uq_rel_column_pair"),
    )

def downgrade():
    op.drop_table("dataset_relationship_columns")
    op.drop_table("dataset_relationships")
```

---

## 3. Phase 2 — Frontend & Model View

### 3.1 Canvas Visual de Relacionamentos

Uma interface visual usando **`@xyflow/react`** (React Flow) para modelagem drag-and-drop de relacionamentos entre datasets.

#### Componentes Principais:

- **`RelationshipCanvas`** — Container principal com o React Flow canvas
- **`DatasetNode`** — Nó representando um dataset, mostrando nome, banco e colunas
- **`RelationshipEdge`** — Aresta representando o relacionamento com label do tipo
- **`ColumnPicker`** — Modal/drawer para selecionar colunas de mapeamento
- **`RelationshipSidebar`** — Painel lateral com detalhes e configuração do relacionamento selecionado

#### Localização:
```
superset-frontend/src/features/datasets/relationships/
├── RelationshipCanvas.tsx
├── components/
│   ├── DatasetNode.tsx
│   ├── RelationshipEdge.tsx
│   ├── ColumnPicker.tsx
│   └── RelationshipSidebar.tsx
├── hooks/
│   ├── useRelationships.ts
│   └── useRelationshipGraph.ts
├── api.ts
├── types.ts
└── index.ts
```

### 3.2 Integração no Explore View

O seletor de colunas no Explore será estendido para mostrar colunas de datasets relacionados, agrupadas por dataset de origem:

```
▼ orders (primary)
  ├── order_id
  ├── customer_id
  ├── total_amount
  └── order_date
▼ customers (via relationship "Orders → Customers")
  ├── customer_name
  ├── email
  └── segment
▼ products (via relationship "Orders → Products")
  ├── product_name
  ├── category
  └── price
```

### 3.3 Dashboard Integration

O `json_metadata` do dashboard será estendido para armazenar configurações de relacionamentos ativos:

```json
{
  "active_relationships": [
    {
      "relationship_id": 42,
      "enabled": true,
      "override_join_type": null
    }
  ],
  "drill_down_hierarchies": [
    {
      "name": "Geography",
      "levels": [
        {"dataset_id": 1, "column": "country"},
        {"dataset_id": 2, "column": "state"},
        {"dataset_id": 3, "column": "city"}
      ]
    }
  ]
}
```

---

## 4. Phase 3 — Advanced Interactions

### 4.1 Cross-Filtering via Relationships

Quando o usuário clica em um elemento de um chart, o sistema:

1. Identifica o dataset do chart clicado
2. Busca todos os relacionamentos desse dataset
3. Para cada chart no dashboard cujo dataset é target de um relacionamento:
   - Traduz o valor filtrado usando o mapeamento de colunas
   - Aplica o filtro traduzido ao chart target

**Ponto de modificação:** `superset-frontend/src/dashboard/util/crossFilters.ts`

```typescript
// Extensão de getCrossFiltersConfiguration()
function getRelationshipAwareCrossFilters(
  dashboardInfo: DashboardInfo,
  chartsState: ChartsState,
): ChartConfiguration {
  const relationships = dashboardInfo.metadata?.active_relationships ?? [];
  const config = getCrossFiltersConfiguration(dashboardInfo, chartsState);
  
  // Extend scope based on relationships
  for (const rel of relationships) {
    if (!rel.enabled) continue;
    // Find charts backed by related datasets
    // Add them to each other's cross-filter scope
    extendScopeWithRelationship(config, chartsState, rel);
  }
  
  return config;
}
```

### 4.2 Drill-Down Hierárquico

Permite navegação entre níveis de granularidade definidos por hierarquias de relacionamento:

- Clique em "Brazil" no mapa mundial → abre chart de estados do Brasil
- Clique em "São Paulo" → abre chart de cidades de SP

Cada nível pode vir de um dataset diferente, conectado por relacionamentos.

### 4.3 Propagação de Filtros Nativos

Os filtros nativos do dashboard são automaticamente traduzidos e propagados para datasets relacionados:

```
Filtro nativo: country = "Brazil" (dataset: countries)
    ↓ via relationship countries → orders (countries.id = orders.country_id)
Filtro propagado: country_id IN (SELECT id FROM countries WHERE country = "Brazil")
    ↓ aplicado automaticamente ao chart de orders
```

**Ponto de modificação:** `superset-frontend/src/dataMask/reducer.ts`

```typescript
// Na action UPDATE_DATA_MASK:
case UPDATE_DATA_MASK: {
  const { filterId, filterState } = action;
  
  // Existing logic
  draft[filterId] = { ...draft[filterId], ...filterState };
  
  // === NEW: Propagate through relationships ===
  const propagatedFilters = translateFilterThroughRelationships(
    filterId,
    filterState,
    dashboardRelationships,
  );
  
  for (const pf of propagatedFilters) {
    draft[pf.targetFilterId] = {
      ...draft[pf.targetFilterId],
      ...pf.translatedFilterState,
    };
  }
  // === END NEW ===
  
  break;
}
```

---

## 5. Configuração e Limites

### 5.1 Feature Flags

```python
# superset/config.py
FEATURE_FLAGS = {
    "DATASET_RELATIONSHIPS": True,          # Master toggle
    "CROSS_DATABASE_RELATIONSHIPS": True,   # Enable cross-DB merges
    "RELATIONSHIP_CROSS_FILTER": True,      # Enable cross-filter propagation
    "RELATIONSHIP_DRILL_DOWN": False,       # Phase 3 - disabled by default
}
```

### 5.2 Limites de Segurança

```python
# superset/config.py

# Maximum rows for cross-database DataFrame merge
RELATIONSHIP_MAX_MERGE_ROWS = 100_000

# Maximum number of relationships per dataset
RELATIONSHIP_MAX_PER_DATASET = 10

# Timeout for cross-database merge operations (seconds)
RELATIONSHIP_MERGE_TIMEOUT = 30

# Maximum depth for drill-down hierarchies
RELATIONSHIP_MAX_DRILL_DEPTH = 5
```

---

## 6. Pontos de Modificação no Código Existente

### Backend

| Arquivo | Modificação |
|---------|------------|
| `superset/models/helpers.py` | `get_sqla_query()` — injetar JOINs same-DB |
| `superset/models/helpers.py` | `get_query_result()` — merge cross-DB DataFrames |
| `superset/connectors/sqla/models.py` | Adicionar `back_populates` para relationships |
| `superset/common/query_context_processor.py` | `get_df_payload()` — orquestrar merge cross-DB |
| `superset/config.py` | Feature flags e limites |
| `superset/datasets/api.py` | Endpoints de relationship ou link para nova API |

### Frontend

| Arquivo | Modificação |
|---------|------------|
| `superset-frontend/src/dashboard/util/crossFilters.ts` | Scope de cross-filter via relationships |
| `superset-frontend/src/dataMask/reducer.ts` | Propagação de filtros traduzidos |
| `superset-frontend/src/explore/` | Column picker agrupado por dataset |
| `superset-frontend/src/features/datasets/` | Novo módulo de relationships UI |

### Migrations

| Arquivo | Descrição |
|---------|-----------|
| `superset/migrations/versions/xxxx_add_dataset_relationships.py` | Novas tabelas |

---

## 7. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Merge cross-DB com muitas linhas causa OOM | Limite `RELATIONSHIP_MAX_MERGE_ROWS` + timeout |
| JOINs degradam performance de queries | Índices nas colunas de join + cache de resultados |
| Complexidade no frontend (muitos datasets) | Canvas visual organizado + lazy loading de colunas |
| Conflitos com funcionalidades existentes | Feature flags granulares + testes de regressão |
| Circular relationships causam loops infinitos | Validação de grafo acíclico no DAO |

---

## 8. Roadmap de Implementação

### Phase 1 (4-6 semanas)
- [ ] Tabelas de banco + migration
- [ ] Models SQLAlchemy
- [ ] DAO + validações
- [ ] API REST CRUD
- [ ] Same-DB JOIN engine em `get_sqla_query()`
- [ ] Cross-DB merge engine em `get_query_result()`
- [ ] Testes unitários e de integração

### Phase 2 (3-4 semanas)
- [ ] React Flow canvas para modelagem visual
- [ ] Column picker estendido no Explore
- [ ] Dashboard metadata integration
- [ ] Testes E2E com Playwright

### Phase 3 (4-6 semanas)
- [ ] Cross-filter propagation via relationships
- [ ] Drill-down hierárquico
- [ ] Filter translation engine
- [ ] Performance optimization + caching
- [ ] Documentação completa

---

## 9. Referências

- Apache Superset Architecture: https://superset.apache.org/docs/contributing/architecture
- SQLAlchemy Relationships: https://docs.sqlalchemy.org/en/14/orm/relationships.html
- React Flow: https://reactflow.dev/
- Pandas merge: https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.merge.html
