# Semantic Layer MCP — Research

**Story**: SC-98803 — Semantic Layer & MCP  
**Branch**: `research-semantic-layer-mcp`  
**Date**: 2026-05-20

---

## Story Summary

Story #98803 is titled "Semantic Layer & MCP" with no written description or acceptance criteria. Two
comments clarify intent:

1. "Probably worth meeting with Beto to start discussing what Semantic Layer work means for MCP"
2. "not putting any more stories in mcp v1 and rather triaging future work in the Preset MCP V2 epic"

This is a **research spike** to map out what "Semantic Layer MCP" would mean, what already exists, what
gaps remain, and what would go into MCP v2. No implementation is expected from this story.

---

## What Superset's Semantic Layer Is

Superset has **two distinct semantic layer concepts** that must be treated separately:

### 1. Built-in Dataset Semantic Layer (SqlaTable)

Every Superset dataset (`SqlaTable`) carries a lightweight semantic layer composed of:

| Concept | Model | Storage |
|---|---|---|
| **Saved metrics** | `SqlMetric` | `sql_metrics` table; `expression` column holds SQL (e.g. `COUNT(*)`, `SUM(revenue)`) |
| **Calculated columns** | `TableColumn.expression` | `table_columns` table; non-null `expression` = virtual column |
| **Dimensions** | `TableColumn` with `groupby=True` | Physical or calculated columns marked as groupable |
| **Filters** | `TableColumn` with `filterable=True` | Drives filter dropdowns |
| **Time grains** | `SqlaTable.main_dttm_col` | Primary datetime column for temporal slicing |
| **RLS** | `RowLevelSecurityFilter` | Per-user WHERE clause predicates |

At query time, `TableColumn.get_sqla_col()` either wraps the physical column (`column(name)`) or inlines
the SQL expression as `literal_column(expression)`. Jinja2 templates are processed before injection.
Saved metrics follow the same pattern via `SqlMetric.get_sqla_col()`.

Physical vs. virtual datasets:
- **Physical** — `sql=NULL`; metadata discovered from DB schema
- **Virtual** — `sql=<SELECT ...>`; metadata discovered by running the SQL; `is_sqllab_view=True`

### 2. External Semantic Layer (SemanticLayer / SemanticView)

A newer plugin-based system for connecting to external semantic catalogs:

- `SemanticLayer` model (`superset/semantic_layers/models.py`) — a connection record (type, encrypted config)
- `SemanticView` model — a queryable view within a layer (maps to a dbt model, a Cube cube, etc.)
- `superset/semantic_layers/registry.py` — plugin registry mapping `type → implementation class`
- `superset/semantic_layers/mapper.py` — translates Superset's `QueryObject` → `SemanticQuery` for
  dispatch to the implementation; handles metrics, dimensions, filters, time grains, and time comparison
- REST API: `GET/POST /api/v1/semantic_layer/`, `GET/POST /api/v1/semantic_layer/{id}/semantic_view/`
- Query path uses `datasource_type="semantic_view"` (distinct from `"table"` for SqlaTable)

The registry is currently empty in OSS (`registry: dict[str, type[SemanticLayer]] = {}`); implementations
are contributed via the extension/plugin mechanism referenced by the TODO in `models.py`.

---

## Existing MCP Tool Surface

The MCP service (`superset/mcp_service/`) already covers Superset's built-in semantic layer well:

| Tool | Tag | What it does |
|---|---|---|
| `list_datasets` | discovery | List/search datasets by name, schema, database |
| `get_dataset_info` | discovery | Full dataset metadata: **columns** (dimensions) + **metrics** (saved metrics) |
| `query_dataset` | data | Query using metric names + column names + filters + time range — **no SQL needed** |
| `create_virtual_dataset` | mutate | Save a SQL SELECT as a named virtual dataset |
| `execute_sql` | data | Raw SQL against any DB (bypasses semantic layer entirely) |

`query_dataset` is the core semantic layer MCP tool. It:
1. Resolves dataset by ID or UUID
2. Validates requested metric/column names against the dataset's saved metrics and columns (with typo
   suggestions via `difflib.get_close_matches`)
3. Builds a `QueryContext` with `datasource_type="table"` and dispatches via `ChartDataCommand`
4. Returns tabular rows, column metadata, cache status, and applied filters

**What is NOT covered:**
- No MCP tools for `SemanticLayer` or `SemanticView` models (external semantic layers)
- No cross-dataset metric/dimension discovery (no `list_metrics`, `list_dimensions` tools)
- No tool for querying external semantic layers via the `datasource_type="semantic_view"` path

---

## Proposed MCP Tools

The following analysis groups proposed tools by priority tier.

### Tier 1 — External Semantic Layer Discovery (highest value, unblocked)

These tools mirror what `list_datasets` / `get_dataset_info` do for SqlaTable but for the external
semantic layer model.

---

**`list_semantic_layers`**
- **Description**: List available external semantic layer connections (dbt, Cube, etc.)
- **Inputs**: `page`, `page_size`, `search` (optional name filter)
- **Outputs**: `[{id, uuid, name, type, description, view_count}]`, pagination
- **Pattern**: `ModelListCore(SemanticLayerDAO, ...)`
- **Notes**: Requires `SemanticLayer` FAB permission; respects `semantic_layer_access` PVM.

---

**`get_semantic_layer_info`**
- **Description**: Get details of a semantic layer including its registered views
- **Inputs**: `identifier` (UUID)
- **Outputs**: `{uuid, name, type, description, views: [{id, uuid, name, description}]}`
- **Pattern**: `ModelGetInfoCore(SemanticLayerDAO, ...)`
- **Notes**: Views list drives the LLM to choose the right view before querying.

---

**`list_semantic_views`**
- **Description**: List views within a specific semantic layer
- **Inputs**: `semantic_layer_uuid`, `page`, `page_size`, `search`
- **Outputs**: `[{id, uuid, name, description, metric_count, dimension_count}]`
- **Pattern**: DAO query on `SemanticView` filtered by `semantic_layer_uuid`
- **Notes**: Separate from `get_semantic_layer_info` to support pagination on large layers.

---

### Tier 2 — External Semantic Layer Query

---

**`get_semantic_view_schema`**
- **Description**: Get available metrics and dimensions for a semantic view
- **Inputs**: `semantic_view_id` (int or UUID)
- **Outputs**: `{metrics: [{name, type, description, ...}], dimensions: [{name, type, is_dttm, ...}]}`
- **Notes**: Calls the layer's `implementation` to fetch live schema from the external system. This is
  distinct from `get_dataset_info` because the metadata comes from the external catalog, not Superset's DB.
  The `MetricMetadata` and `ColumnMetadata` dataclasses in `semantic_layers/models.py` define the shape.

---

**`query_semantic_view`**
- **Description**: Query an external semantic layer view by metric and dimension names
- **Inputs**: `semantic_view_id`, `metrics: list[str]`, `dimensions: list[str]`, `filters`, `time_range`,
  `time_grain`, `row_limit`
- **Outputs**: Same shape as `query_dataset` (tabular rows + column metadata + performance)
- **Notes**: Uses the `datasource_type="semantic_view"` path through `QueryContextFactory`. The
  `mapper.py` `get_results()` function already handles the translation. This is a peer to `query_dataset`,
  not a replacement.
- **Key design question**: How to handle authentication to the external system (dbt Cloud token, Cube API
  key, etc.) — stored in encrypted `SemanticLayer.configuration`, fetched at query time.

---

### Tier 3 — Cross-Dataset Discovery (nice-to-have, lower priority)

These are useful for LLM agents that need to find metrics without knowing which dataset to start from.

---

**`list_metrics`**
- **Description**: Search saved metrics across all accessible datasets
- **Inputs**: `search` (metric name / description), `dataset_id` (optional), `page`, `page_size`
- **Outputs**: `[{metric_name, expression, dataset_id, dataset_name, description, d3format}]`
- **Notes**: Direct DAO query on `SqlMetric` with RBAC filtering. High value for LLMs that start with
  "find me a revenue metric" rather than "query dataset 42."

---

**`list_dimensions`**
- **Description**: Search groupable columns across accessible datasets
- **Inputs**: `search`, `dataset_id` (optional), `is_dttm` (optional), `page`, `page_size`
- **Outputs**: `[{column_name, type, is_dttm, dataset_id, dataset_name, description}]`
- **Notes**: Same pattern as `list_metrics` but on `TableColumn` with `groupby=True`.
  Complementary to `list_metrics` for fully metric-driven workflows.

---

### Summary Table

| Tool | Tier | Effort | Depends on |
|---|---|---|---|
| `list_semantic_layers` | 1 | S | `SemanticLayerDAO` (exists) |
| `get_semantic_layer_info` | 1 | S | `SemanticLayerDAO` (exists) |
| `list_semantic_views` | 1 | S | `SemanticLayerDAO` (exists) |
| `get_semantic_view_schema` | 2 | M | External layer implementation |
| `query_semantic_view` | 2 | M | `mapper.py` (exists), `QueryContextFactory` |
| `list_metrics` | 3 | S | `SqlMetric` DAO query |
| `list_dimensions` | 3 | S | `TableColumn` DAO query |

Effort scale: S = 1–2 days, M = 3–5 days, L = 1–2 weeks, XL = 2+ weeks.

---

## Landscape Survey

### How Other Tools Do It

**Looker** (Google)
- Looker has a full Semantic Layer API: `/api/4.0/lookml_models/{name}/explores/{name}/fields` returns
  dimensions, measures, and filters from LookML
- LookML is the semantic definition language; AI/LLM access is via Looker's Explore REST API
- Looker Studio integration reads the semantic layer directly

**Cube.dev**
- Cube ships an official MCP server (`@cubejs-backend/mcp`) with:
  - `list_cubes` — returns all cubes with measure/dimension/segment definitions
  - `query_cube` — runs a semantic query by cube+measures+dimensions+filters
  - `get_cube_meta` — live schema for a specific cube
- This is the closest prior art to what Superset's Tier 1+2 tools would look like

**dbt Semantic Layer (MetricFlow)**
- dbt Cloud exposes metrics via JDBC/GraphQL Semantic Layer API
- MetricFlow's conceptual model: `Metric`, `Dimension`, `Entity`, `TimeDimension`
- LLM integrations (e.g., dbt Copilot) use `list_metrics`, `list_dimensions`, and a `query_metrics`
  endpoint that returns results as Arrow IPC

**MetricFlow**
- Query API: `list_metrics()`, `list_dimensions()`, `query_metrics(metrics=[], groupBy=[])`
- Self-describing schema: each metric knows its required dimensions and time grains

**Key takeaway**: The industry pattern is consistent — a 3-tool surface: `list_metrics`, `list_dimensions`,
`query_metrics`. Superset's `get_dataset_info` + `query_dataset` already implement this pattern for the
built-in semantic layer. The gap is the external semantic layer equivalents and cross-dataset discovery.

### Prior Art in the Superset Community

- The `semantic_layers/` module (models, mapper, registry, API) was built ahead of any specific
  implementation — it is the extension point for dbt, Cube, Snowflake Cortex, etc.
- No OSS implementations are registered; implementations come via the Preset plugin mechanism
- No Preset-specific semantic layer MCP tools exist in `superset-shell/preset/mcp/` today

---

## Implementation Approach

### Phase 1: External Semantic Layer Discovery (Tier 1)

The `SemanticLayerDAO` already exists and the REST API is live. Adding `list_semantic_layers`,
`get_semantic_layer_info`, and `list_semantic_views` follows the exact same pattern as the existing
dataset tools. Use `ModelListCore` and `ModelGetInfoCore` from `mcp_core.py`. This is straightforward
work (3 × S = ~3–4 days total) and unblocked.

Create `superset/mcp_service/semantic_layer/` module with:
- `schemas.py` — Pydantic schemas for SemanticLayer and SemanticView
- `tool/list_semantic_layers.py`
- `tool/get_semantic_layer_info.py`
- `tool/list_semantic_views.py`
- `tool/__init__.py`

Register all three in `app.py`.

### Phase 2: External Semantic Layer Query (Tier 2)

`get_semantic_view_schema` requires calling the external implementation's schema method, which may do
a network call. This needs timeout handling and graceful error messaging.

`query_semantic_view` is the most complex: it must go through the `mapper.py` + `QueryContextFactory`
path with `datasource_type="semantic_view"`. The query execution path exists but is untested from MCP.
Recommend writing this alongside integration tests against a mock external layer.

### Phase 3: Cross-Dataset Discovery (Tier 3)

`list_metrics` and `list_dimensions` are pure DAO queries on `SqlMetric` and `TableColumn`. They need
RBAC filtering (only return metrics/columns from datasets the user can access) which adds complexity.
The simplest safe approach is to call `DatasetDAO.find_all()` to get accessible datasets and then filter
metrics/columns in Python — this avoids writing a custom RBAC-aware JOIN.

### Key Design Decisions

1. **Unified `query` tool vs. split tools**: Should `query_dataset` be extended to detect
   `semantic_view_id` inputs, or should `query_semantic_view` be a separate tool? Recommendation:
   **separate tools** — the query paths are genuinely different (different datasource types, different
   schema shapes) and separate tools are clearer for LLMs.

2. **Schema exposure**: Should `get_semantic_view_schema` return the full external schema or only the
   subset Superset knows about? Recommendation: **live from external system** — this is the value prop.

3. **`list_metrics` RBAC**: Should it join dataset permissions in SQL or filter in Python? Recommendation:
   **Python filtering via DatasetDAO** until proven to be a performance problem.

4. **Prompt updates**: `DEFAULT_INSTRUCTIONS` in `app.py` should be updated to mention the semantic layer
   tools and when to prefer them over `execute_sql`.

---

## Open Questions

1. **What does MCP v2 mean architecturally?** The story comment says these tools belong in "MCP v2
   epic." Are there breaking changes (new tool naming, new auth model, new transport) that affect how
   these tools should be designed?

2. **Which external semantic layer implementations exist at Preset?** The `registry` is empty in OSS.
   What types are registered in `superset-shell`? Which implementations should `query_semantic_view`
   be tested against first (dbt, Snowflake Cortex, Cube)?

3. **Is Beto's (betodealmeida) semantic layer work complete enough to build MCP tools on top of?**
   The `TODO` comment in `SemanticLayer.implementation` references an `extension_manager` that isn't
   wired yet. Is the plugin mechanism stable?

4. **RLS for external semantic layers**: SqlaTable RLS is handled by `get_sqla_row_level_filters()`.
   External layers have their own permission models (dbt Cloud access, Cube tenant isolation). How should
   MCP enforce per-user data access when querying external layers?

5. **Should `list_metrics` / `list_dimensions` be scoped to Tier 1 (Superset built-in) or include
   external semantic layers?** If external layers have their own metric catalogs, a unified `list_metrics`
   that spans both could be very powerful but complex.

6. **Privacy controls for external layer schema**: `get_semantic_view_schema` returns metric/dimension
   names from external systems. Should it be gated behind the same `requires_data_model_metadata_access`
   decorator as `get_dataset_info` and `query_dataset`?

---

## Effort Estimate

| Scope | Effort | Notes |
|---|---|---|
| `list_semantic_layers` | S (1–2 days) | Follows exact ModelListCore pattern |
| `get_semantic_layer_info` | S (1–2 days) | Follows exact ModelGetInfoCore pattern |
| `list_semantic_views` | S (1 day) | Subset of get_semantic_layer_info |
| `get_semantic_view_schema` | M (3 days) | Network call to external system + error handling |
| `query_semantic_view` | M (4–5 days) | New query path + integration tests |
| `list_metrics` | S (2 days) | DAO query + RBAC filter |
| `list_dimensions` | S (1–2 days) | Same pattern as list_metrics |
| Prompt/instructions updates | S (1 day) | Update DEFAULT_INSTRUCTIONS + tool docs |
| **Total Tier 1** | **~1 week** | |
| **Total Tier 1+2** | **~2.5 weeks** | Assuming external implementation is available |
| **Total Tier 1+2+3** | **~3.5 weeks** | |

These estimates assume the external semantic layer plugin mechanism (`registry`) has at least one working
implementation to test against. If that work is not complete, Tier 2 is blocked and effort increases.
