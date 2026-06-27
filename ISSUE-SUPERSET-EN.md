## [Feature] Dataset Relationship Model — declare and manage relationships between datasets

> Reference implementation: https://github.com/apache/superset/pull/40981

---

### 🎯 Problem

Apache Superset has no first-class concept of relationships between datasets. In normalized databases (star schemas, relational models), users must manually create denormalized views or virtual datasets with JOINs every time they need to reference columns from a related table.

This creates friction:
- **Duplication:** multiple virtual datasets that are just thin JOIN wrappers
- **No navigability:** no way to see how datasets connect to each other
- **No infrastructure:** features like cross-filtering, drill-down, and dataset merging lack a standardized metadata layer to consume

### ✅ Proposed Solution

Introduce a data model + API + UI for declaring **typed, directed relationships** between any pair of Superset datasets.

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
│ GET /api/v1/dataset/{id} → includes    │
│   relationships (feature-gated)        │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│          FRONTEND (React Flow)         │
│                                        │
│ RelationshipCanvas → Graph editor      │
│ DatasetNode → Custom node              │
│ RelationshipEdge → Edge with label     │
│ ColumnPickerModal → Map columns        │
│ RelationshipBadge → Explore sidebar    │
│ DrillDownConfig → Drill-down config    │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│         CROSS-DATASET FILTERS          │
│                                        │
│ useCrossDatasetFilters hook            │
│ → translates active chart filters      │
│   from source to target WHERE clauses  │
│ → cross-database merge engine          │
│   (Redis cache, schema drift detect)   │
│ → hierarchical drill-down across       │
│   related datasets                     │
└────────────────────────────────────────┘
```

### 👤 User Stories

**US1 — Visual navigation**
> "As an analyst, I want to see a graph of how my datasets relate to each other, so I can understand the data model without hunting through documentation."

**US2 — Cross-dataset cross-filtering**
> "As an analyst, I want a filter applied to an Orders chart to automatically filter a related Customers chart, without manually creating JOINs."

**US3 — Hierarchical drill-down**
> "As an analyst, I want to click a country in a Sales chart and drill down to state-level detail, navigating through a many-to-one relationship."

**US4 — Cross-database merge**
> "As an admin, I want to relate a PostgreSQL dataset with a MySQL dataset and let Superset merge them automatically, without an intermediate ETL."

### 📐 Technical Design

#### Models

**DatasetRelationship**

| Field | Type | Description |
|-------|------|-------------|
| id | Integer PK | Auto |
| source_dataset_id | FK → tables.id | Source dataset |
| target_dataset_id | FK → tables.id | Target dataset |
| relationship_type | Enum | one_to_one, one_to_many, many_to_one, many_to_many |
| join_type | Enum | INNER, LEFT, RIGHT, FULL |
| is_cross_database | Bool | Auto-detected |
| is_active | Bool | Soft toggle |
| name | String(255) | Human-readable name (optional) |
| description | Text | Description (optional) |
| created_on / changed_on | DateTime | Audit |
| created_by_fk / changed_by_fk | FK | Audit |

**DatasetRelationshipColumn**

| Field | Type | Description |
|-------|------|-------------|
| id | Integer PK | Auto |
| relationship_id | FK → dataset_relationships | Cascade delete |
| source_column_name | String(255) | Source column |
| target_column_name | String(255) | Target column |
| operator | String(10) | Default "=" |
| ordinal | Integer | Order for multi-column join keys |

Constraints:
- Unique on `(source_dataset_id, target_dataset_id)`
- At least one column pair (Python validation)
- Cascade delete: removing a dataset removes its relationships

#### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/dataset_relationship/ | List (filterable, paginated) |
| POST | /api/v1/dataset_relationship/ | Create |
| GET | /api/v1/dataset_relationship/{id} | Get by ID |
| PUT | /api/v1/dataset_relationship/{id} | Update |
| DELETE | /api/v1/dataset_relationship/{id} | Delete |
| DELETE | /api/v1/dataset_relationship/?q=[ids] | Bulk delete |
| GET | /api/v1/dataset_relationship/dataset/{id} | List all for a dataset |

The dataset detail endpoint (`GET /api/v1/dataset/{id}`) gains an optional `relationships` field (feature-gated).

#### Frontend (React Flow)

- **RelationshipCanvas** — interactive graph with zoom, pan, and auto-layout
- **DatasetNode** — custom node showing name, database icon, key columns
- **RelationshipEdge** — custom edge with directional arrow and label (cardinality + join type)
- **ColumnPickerModal** — modal for mapping source → target columns
- **DrillDownConfig** — hierarchical drill-down configuration panel
- **RelationshipBadge** — badge in Explore sidebar showing relationship count

#### Cross-Dataset Filters

- `useCrossDatasetFilters` hook that translates active chart filters into WHERE clauses targeting the related dataset
- Cross-database merge engine with Redis caching
- Automatic JOIN injection for related datasets
- Schema drift detection via scheduled Celery task

### 🔧 Feature Flag

**`DATASET_RELATIONSHIPS = False`** in `config.py`.

When disabled:
- API returns 403 on relationship endpoints
- Relationship fields do not appear in responses
- Frontend does not render the canvas or badges
- Zero impact on performance or existing behavior

### 📦 Dependencies

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| @xyflow/react | ^12.x | MIT | Graph canvas rendering |

Zero new Python dependencies.

### 🔄 Migration

One Alembic revision creating:
- `dataset_relationships`
- `dataset_relationship_columns`

Safe rollback via `DROP TABLE ... CASCADE`.

### ❓ Open Questions

1. **Cross-database merge engine**: should it ship in v1 or as a follow-up feature?
2. **Drill-down config**: how to expose it in the UI without cluttering the chart builder?
3. **Performance**: is Redis caching sufficient for frequent cross-database merges, or is something more needed?
4. **Schema drift**: ideal frequency for the detection Celery task? Daily? Weekly?
5. **Naming**: is "Dataset Relationship Model" clear enough, or are there better suggestions?

### 🔗 Links

- **Implementation PR:** https://github.com/apache/superset/pull/40981
- **SIP Document:** https://github.com/hjadm/hibi/blob/main/SIP-DATASET-RELATIONSHIPS.md

### 🏗️ Implementation Status

| Block | Status |
|-------|--------|
| Models + Migration | ✅ Complete |
| REST API | ✅ Complete |
| Feature Flag | ✅ Complete |
| Frontend Canvas | ✅ Complete |
| Cross-DB Merge Engine | ✅ Complete |
| Cross-Dataset Filters | ✅ Complete |
| Drill-Down Navigation | ✅ Complete |
| Tests (156 passing) | ✅ Complete |
| Schema Drift Detection | ✅ Complete |

### 🚧 Blockers for Upstream

- Decision on whether cross-database merge should ship in v1
- Security review of automatic JOIN injection
- Performance benchmarks for cross-database queries
- Schema drift periodicity definition
- SIP approval by the community
