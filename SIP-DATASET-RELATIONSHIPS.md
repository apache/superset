---
name: SIP
about: "Superset Improvement Proposal"
labels: sip
title: "[SIP] Dataset Relationship Model — declare and manage relationships between datasets"
assignees: "apache/superset-committers"
---

## [SIP] Dataset Relationship Model

### Motivation

Superset has no first-class concept of relationships between datasets. Users working with normalized schemas (star schemas, relational models) must manually create denormalized views or virtual datasets with JOINs every time they need to reference columns from a related table.

This creates friction:
- Users maintain multiple virtual datasets that are just thin JOIN wrappers
- There's no way to see or navigate how datasets connect to each other
- Features like drill-down or cross-filtering — which conceptually need relationship metadata — have no standard way to consume it

**Goal of this SIP:** Introduce a first-class API and storage model for declaring typed, directed relationships between any two Superset datasets (`SqlaTable`), plus a visual relationship graph. This model is designed as infrastructure that future features can build on — it does not itself change query behavior.

---

### Proposed Change

A **relationship** is a directed link from a *source* dataset to a *target* dataset, with metadata about cardinality, join type, and the column pairs that define the mapping.

#### Models

Two new SQLAlchemy models:

```
DatasetRelationship
├── source_dataset_id: FK → tables.id
├── target_dataset_id: FK → tables.id
├── relationship_type: enum(one_to_one, one_to_many, many_to_one, many_to_many)
├── join_type: enum(INNER, LEFT, RIGHT, FULL)
├── is_cross_database: bool (auto-detected)
├── is_active: bool (soft toggle)
├── name: str (optional, human-readable)
├── description: text (optional)
└── columns: [DatasetRelationshipColumn]

DatasetRelationshipColumn
├── relationship_id: FK → dataset_relationships.id
├── source_column_name: str
├── target_column_name: str
├── operator: str (default '=')
└── ordinal: int (for multi-column join keys)
```

Constraints:
- Unique on `(source_dataset_id, target_dataset_id)` — no duplicate relationships
- Cascade delete — removing a dataset removes its relationships
- At least one column pair required

#### REST API

Feature-flagged by `DATASET_RELATIONSHIPS` (default `False`). When disabled, the endpoints return 403 and no new fields appear in responses.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/dataset_relationship/` | List (filterable, paginated) |
| `POST` | `/api/v1/dataset_relationship/` | Create |
| `GET` | `/api/v1/dataset_relationship/{id}` | Get by ID |
| `PUT` | `/api/v1/dataset_relationship/{id}` | Update |
| `DELETE` | `/api/v1/dataset_relationship/{id}` | Delete single |
| `DELETE` | `/api/v1/dataset_relationship/?q=[ids]` | Bulk delete |
| `GET` | `/api/v1/dataset_relationship/dataset/{id}` | List all for a dataset |

The dataset detail endpoint (`GET /api/v1/dataset/{id}`) gains an optional `relationships` field in its response, listing both outgoing and incoming relationships. Feature-gated.

#### Frontend: Relationship Canvas

A new page at the Dataset detail view showing a **React Flow** graph:
- Datasets rendered as nodes (showing name, database icon, columns)
- Relationships rendered as directed edges (showing type + join type arrow)
- Users can create/delete relationships directly on the canvas via a sidebar
- Column pair mappings managed through a `ColumnPickerModal`

Components:
- `RelationshipCanvas` — the React Flow graph container
- `DatasetNode` — custom node component
- `RelationshipEdge` — custom edge with label
- `ColumnPickerModal` — modal to map source→target columns
- `RelationshipSidebar` — config panel for the selected relationship
- `RelationshipBadge` — indicator in Explore's DatasourcePanel

#### Feature Flag

`DATASET_RELATIONSHIPS = False` in `config.py`. All changes — backend and frontend — are gated behind this flag. Setting it to `True` exposes the API and canvas but changes no existing behavior.

---

### New or Changed Public Interfaces

**New SQLAlchemy models:**
- `superset.models.dataset_relationships.DatasetRelationship`
- `superset.models.dataset_relationships.DatasetRelationshipColumn`

**New REST endpoint:**
- `DatasetRelationshipRestApi` at `/api/v1/dataset_relationship/` (full CRUD + `get_by_dataset`)

**Modified endpoint:**
- `GET /api/v1/dataset/{id}` — adds `relationships` field (feature-gated)

**New frontend components** (all behind feature flag):
- `RelationshipCanvas` — React Flow graph editor at `superset/dataset/{id}/relationships`
- `RelationshipBadge` — badge in Explore DatasourcePanel showing relationship count

**No changes to:**
- Chart query pipeline
- Dashboard filtering
- Explore chart builder
- Saved URLs or embed payloads
- CLI or deployment

---

### New dependencies

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| `@xyflow/react` | ^12.x | MIT | Relationship canvas graph rendering |

Zero new Python dependencies.

---

### Migration Plan and Compatibility

**Migration**: One Alembic revision creating two tables:
- `dataset_relationships`
- `dataset_relationship_columns`

Both tables carry `AuditMixinNullable` columns (`created_on`, `changed_on`, `created_by_fk`, `changed_by_fk`).

**Rollback**: `downgrade()` drops both tables via `DROP TABLE ... CASCADE`.

**Compatibility**:
- Feature disabled by default — zero impact on existing deployments
- When enabled: no existing workflows, dashboards, charts, or APIs are altered
- Relationship data is stored separately — no modifications to `tables`, `slices`, `dashboards`, or any existing table
- `ON DELETE CASCADE` ensures deleting a dataset cleans up its relationships automatically

---

### Rejected Alternatives

**1. JSON metadata field on SqlaTable**
Rejected because: querying relationships would require parsing JSON across all datasets. A proper relational model allows indexed lookups, foreign key integrity, and native SQLAlchemy querying.

**2. Extending virtual datasets**
Rejected because: virtual datasets are SQL queries. Relationships solve a different problem — linking *already defined* datasets without creating new ones.

**3. Separate service (external metadata store)**
Rejected because: adds operational complexity (another service, another DB), breaks Superset's self-contained deployment model.

**4. Polymorphic tags / label system**
Rejected because: labels can't express directionality, cardinality, column mappings, or join semantics.
