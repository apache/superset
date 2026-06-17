# Dataset Relationship Engine

> **Status:** Phases 1–3 implemented (proposal)
> **Feature Flag:** `DATASET_RELATIONSHIPS` (default `False` in `superset/config.py`)

## Overview

The Dataset Relationship Engine adds Power BI–style dataset relationships to
Apache Superset. Users can declare explicit relationships between
datasets (tables) so that charts and dashboards automatically perform JOINs,
cross-database merges, cross-filter propagation, and hierarchical drill-downs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                        │
│  superset-frontend/src/features/datasets/relationships/ │
│    ├── components/   (DatasetNode, RelationshipEdge,    │
│    │                 RelationshipCanvas, ColumnPicker,   │
│    │                 RelationshipSidebar, DrillDown)     │
│    ├── hooks/        (CRUD API hooks, dataset list)     │
│    ├── filterTranslation.ts  (cross-filter engine)      │
│    ├── drillDownNavigation.ts (drill-down navigation)   │
│    └── types/        (TypeScript interfaces)            │
├─────────────────────────────────────────────────────────┤
│                    REST API Layer                        │
│  superset/dataset_relationship/api.py                   │
│  superset/dataset_relationship/schemas.py               │
│  Endpoints: CRUD + /dataset/<id> + /resolve_values/     │
├─────────────────────────────────────────────────────────┤
│                   Command Layer                         │
│  superset/commands/dataset_relationship/                │
│    ├── create.py   (CreateDatasetRelationshipCommand)   │
│    ├── update.py   (UpdateDatasetRelationshipCommand)   │
│    └── delete.py   (DeleteDatasetRelationshipCommand)   │
├─────────────────────────────────────────────────────────┤
│                    Data Access Layer                     │
│  superset/daos/dataset_relationship.py                  │
│  (DatasetRelationshipDAO)                               │
├─────────────────────────────────────────────────────────┤
│                    ORM Model Layer                       │
│  superset/models/dataset_relationships.py               │
│  (DatasetRelationship, DatasetRelationshipColumn)       │
├─────────────────────────────────────────────────────────┤
│                    Query Engine                          │
│  superset/common/relationship_query_injector.py         │
│  (same-database: automatic SQL JOIN injection)          │
│  superset/common/cross_database_merger.py               │
│  (cross-database: Pandas merge post-query)              │
│  superset/common/relationship_query_cache.py            │
│  (TTL-based cache for merge results)                    │
├─────────────────────────────────────────────────────────┤
│                    Integration Points                    │
│  superset/models/helpers.py                             │
│    _maybe_inject_relationship_joins() → in get_sqla_query │
│    _maybe_apply_cross_db_merges() → in get_query_result │
│  superset/initialization/__init__.py                    │
│    Conditional API registration (feature flag)          │
└─────────────────────────────────────────────────────────┘
```

## Feature Flag

All functionality is gated behind `DATASET_RELATIONSHIPS`:

```python
# superset/config.py
FEATURE_FLAGS = {
    "DATASET_RELATIONSHIPS": True,  # Enable the engine
}
```

When disabled:
- Backend API returns 403 on all endpoints
- Frontend route and button are hidden
- Query engine skips JOIN injection and cross-DB merges

## Database Schema

Two tables:

- **`dataset_relationship`** — stores relationship definitions
  - source/target dataset IDs, relationship type, join type, active flag
  - `is_cross_database` auto-determined at create time
- **`dataset_relationship_columns`** — stores column mapping pairs
  - source/target column names and comparison operator per pair

## Same-Database vs Cross-Database

- **Same-DB relationships**: JOIN injected at SQL level via SQLAlchemy
- **Cross-DB relationships**: Data merged in-memory via Pandas after query execution
- Auto-detected: if source and target datasets share the same database, it's same-DB

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/dataset_relationship/` | List all relationships |
| POST | `/api/v1/dataset_relationship/` | Create relationship |
| GET | `/api/v1/dataset_relationship/<id>` | Get relationship |
| PUT | `/api/v1/dataset_relationship/<id>` | Update relationship |
| DELETE | `/api/v1/dataset_relationship/<id>` | Delete relationship |
| GET | `/api/v1/dataset_relationship/dataset/<id>` | Relationships for dataset |
| POST | `/api/v1/dataset_relationship/resolve_values/` | Cross-DB value mapping |

## Frontend

- **Visual Canvas**: React Flow (`@xyflow/react`) at `/dataset/relationships/`
- **Components**: DatasetNode, RelationshipEdge, RelationshipCanvas, ColumnPickerModal, RelationshipSidebar, DrillDownConfig
- **Filter Translation**: `FilterTranslationEngine` — translates filters across related datasets
- **Drill-Down**: `useDrillDownNavigation` — navigate through hierarchy levels with breadcrumbs

## Testing

Existing test files:
- `tests/integration_tests/dataset_relationship_api_tests/api_tests.py`
- `tests/unit_tests/common/test_cross_database_merger.py`
- `tests/unit_tests/common/test_relationship_query_injector.py`
- `tests/unit_tests/daos/dataset_relationship_test.py`

## Configuration

```python
# superset/config.py
RELATIONSHIP_MAX_MERGE_ROWS = 100_000  # Max rows for cross-DB merge
RELATIONSHIP_QUERY_TIMEOUT = 30        # Timeout in seconds
```

## Migration

```
superset/migrations/versions/2026-05-14_10-00_a8b9c0d1e2f3_add_dataset_relationships.py
```

Run: `superset db upgrade`

---

*Proposed enhancement for Apache Superset — dataset relationship visualization and cross-filtering.*
