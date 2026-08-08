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

## Questions for Beto — with Answers (2026-06-04)

1. **What does MCP v2 mean architecturally?** The story comment says these tools belong in "MCP v2
   epic." Are there breaking changes (new tool naming, new auth model, new transport) that affect how
   these tools should be designed?

   > **💬 Beto:** No. It's just the second release of the MCP service — not a breaking change. Build
   > these tools with the same conventions as v1.

2. **Which external semantic layer implementations exist at Preset?** The `registry` is empty in OSS.
   What types are registered in `superset-shell`? Which implementations should `query_semantic_view`
   be tested against first (dbt, Snowflake Cortex, Cube)?

   > **💬 Beto:** Our first target is Snowflake, followed by MetricFlow, Cube, DJ. But it shouldn't
   > matter — the interface is identical for all of them.

3. **Is `SemanticLayer.implementation` wiring complete?** There's a `TODO` comment in
   `semantic_layers/models.py` referencing an `extension_manager` that isn't fully wired yet (currently
   falls back directly to `registry[self.type]`). Is the plugin mechanism stable enough to build MCP
   tools on top of?

   > **💬 Beto:** It is. The TODO in the discovery mechanism is because we've been discussing changing
   > how installed extensions are discovered in the future, but it won't affect any APIs — it's purely
   > internal. Safe to build on top of today.

4. **RLS for external semantic layers**: SqlaTable RLS is handled by `get_sqla_row_level_filters()`.
   External layers have their own permission models (dbt Cloud access, Cube tenant isolation). How should
   MCP enforce per-user data access when querying external layers?

   > **💬 Beto:** We don't currently support RLS in semantic layers/views, but will eventually. Don't
   > worry about this now — when we add support it will be transparent to the MCP service.

5. **Should `list_metrics` / `list_dimensions` span built-in + external layers?** A unified
   `list_metrics` spanning both SqlaTable saved metrics and external semantic layer metrics could be
   very powerful but complex. Or should they be separate surfaces?

   > **💬 Beto:** Yes — unified. Most users will have only a single semantic layer (the whole point is
   > a single source of truth). Because of this, we should never force the user to choose a layer before
   > listing metrics — most of the time there will be only one, and we should never prompt to choose from
   > a single-element list. Even when there are multiple, start with global search.

6. **What is the intended LLM workflow for external semantic layers?** For built-in datasets the
   workflow is: `list_datasets` → `get_dataset_info` → `query_dataset`. What's the analogous flow
   for external layers?

   > **💬 Beto:** The flow is `list_metrics` → metrics come with related dimensions already — then
   > `get_table(metrics, dimensions, filters)`. Also worth exposing the `get_compatible_*()` methods
   > from `superset-core/src/superset_core/semantic_layers/view.py`. When listing metrics, compatible
   > dimensions should be part of the metric payload itself.

---

## Effort Estimate (original)

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

---

## Final Architecture Proposal

*Synthesized from the research above and Beto's 2026-06-04 answers.*

### Core Insight: Flat Metric-First Workflow

Beto's answer to Q6 collapses the original three-tier hierarchy into a much flatter design. The intended
LLM workflow is:

```
list_metrics  →  get_table(metrics, dimensions, filters)
```

Not the hierarchical: `list_semantic_layers → list_semantic_views → get_semantic_view_schema → query_semantic_view`.

This means `list_metrics` is the **primary entry point** — not an administrative helper — and it must
work globally across both built-in datasets and external semantic layers without the user choosing a
layer first. Compatible dimensions travel with each metric in the response payload.

The abstract interface in `superset-core/src/superset_core/semantic_layers/view.py` is the contract
we're wrapping. Every proposed MCP tool maps to a method there:

| MCP Tool | `view.py` method | Notes |
|---|---|---|
| `list_metrics` | `get_metrics()` | + `SqlMetric` for built-in |
| `get_compatible_dimensions` | `get_compatible_dimensions(metrics, dims)` | Refinement during selection |
| `get_compatible_metrics` | `get_compatible_metrics(metrics, dims)` | Refinement during selection |
| `get_table` | `get_table(query)` | Unified query; replaces `query_dataset` + `query_semantic_view` |
| `get_dimension_values` | `get_values(dimension, filters)` | Distinct values for filter UI |
| `get_row_count` | `get_row_count(query)` | Preview row count before full fetch |

### Revised Tool Design

#### `list_metrics` ★ Primary tool

Search all accessible metrics globally — spanning both built-in (`SqlMetric`) and external semantic
layer metrics (via `SemanticView.get_metrics()`). No layer selection required.

- **Inputs:** `search` (optional text filter), `page`, `page_size`
- **Outputs:**
  ```json
  [{
    "name": "total_revenue",
    "description": "...",
    "source": {"type": "dataset" | "semantic_view", "id": "<uuid>", "name": "Sales"},
    "compatible_dimensions": [
      {"name": "region", "type": "VARCHAR", "is_dttm": false},
      {"name": "order_date", "type": "TIMESTAMP", "is_dttm": true}
    ]
  }]
  ```
- **RBAC:** Built-in metrics: filter by accessible datasets via `DatasetDAO`. External: filter by
  accessible `SemanticLayer` connections.
- **Effort:** M (3–4 days) — unified across both sources is more complex than a single DAO query.

---

#### `get_table` ★ Unified query tool

Execute a semantic query against any metric source. Routes to the built-in path or the external
`SemanticView.get_table()` path based on where the metrics come from.

- **Inputs:** `metrics: list[str]`, `dimensions: list[str]`, `filters`, `time_range`, `time_grain`,
  `row_limit`
- **Outputs:** Tabular rows + column metadata + performance info (same shape as existing `query_dataset`)
- **Routing logic:**
  - All metrics from `SqlMetric` → existing `ChartDataCommand` path (`datasource_type="table"`)
  - Metrics from `SemanticView` → `mapper.py` + `datasource_type="semantic_view"` path
  - Mixed → error (metrics must come from a single source)
- **Notes:** This is the peer/replacement for `query_dataset` in semantic-layer-first workflows.
  Existing `query_dataset` is unchanged — it remains the direct-dataset tool.
- **Effort:** M (4–5 days) — routing logic + integration tests against both paths.

---

#### `get_compatible_dimensions`

Refine dimension selection given already-chosen metrics and dimensions. Surfaces
`view.get_compatible_dimensions()`.

- **Inputs:** `metric_names: list[str]`, `selected_dimensions: list[str]` (already picked)
- **Outputs:** `[{name, type, is_dttm, description}]` — dimensions compatible with the current selection
- **Use case:** LLM is helping user build a query step-by-step; user has picked 2 metrics and now asks
  "what dimensions can I group by?"
- **Effort:** S (1–2 days)

---

#### `get_compatible_metrics`

Mirror of `get_compatible_dimensions` — refine metric selection given selected dimensions.

- **Inputs:** `selected_metrics: list[str]`, `dimension_names: list[str]`
- **Outputs:** `[{name, description, source}]` — metrics compatible with the selected dimensions
- **Effort:** S (1 day)

---

#### `get_dimension_values`

Fetch distinct values for a dimension (for filter UI or LLM-driven filtering). Surfaces
`view.get_values()`.

- **Inputs:** `dimension_name: str`, `source_id` (dataset UUID or semantic_view UUID), `filters`
  (optional pre-filters)
- **Outputs:** `[{value, label}]`
- **Effort:** S (1–2 days)

---

#### `get_row_count`

Count rows a query would return before executing it — useful for previews and safety checks. Surfaces
`view.get_row_count()`.

- **Inputs:** `metrics: list[str]`, `dimensions: list[str]`, `filters`, `time_range`
- **Outputs:** `{row_count: int}`
- **Effort:** S (1 day)

---

#### Admin Discovery Tools (lower priority)

These are useful for admin/setup workflows but are NOT part of the primary LLM query flow:

| Tool | Effort | Purpose |
|---|---|---|
| `list_semantic_layers` | S (1–2 days) | List configured external connections |
| `get_semantic_layer_info` | S (1–2 days) | Details of a connection + its views |
| `list_semantic_views` | S (1 day) | Paginated views within a layer |

---

### What Changed from the Original Proposal

| Original | Revised | Reason |
|---|---|---|
| Tier 3 (`list_metrics`) = lowest priority | `list_metrics` = **highest priority** | Beto: it's the primary entry point |
| Separate `query_dataset` + `query_semantic_view` | Unified `get_table` | Beto: single query tool for the semantic workflow |
| `get_semantic_view_schema` for schema discovery | `list_metrics` includes compatible dims inline | Beto: schema travels with metrics |
| Layer selection required before listing metrics | Global search, no layer selection | Beto: single source of truth, never prompt to choose |
| `get_compatible_*()` not in scope | Now explicit MCP tools | Beto: expose these directly |

### Implementation Phases

**Phase 1 — Core semantic workflow (~2 weeks, mostly unblocked)**

All built-in layer support; external layer support added in Phase 2.

1. `list_metrics` (built-in SqlMetric + stub for external)
2. `get_table` (built-in path first; `datasource_type="table"`)
3. `get_compatible_dimensions` / `get_compatible_metrics`
4. Update `DEFAULT_INSTRUCTIONS` in `app.py`

**Phase 2 — External layer support (~1.5 weeks, needs Snowflake plugin)**

1. Extend `list_metrics` to query external `SemanticView.get_metrics()`
2. Extend `get_table` to route to `datasource_type="semantic_view"` path
3. `get_dimension_values` (via `view.get_values()`)
4. `get_row_count` (via `view.get_row_count()`)

**Phase 3 — Admin tools (~0.5 weeks, independent)**

1. `list_semantic_layers` / `get_semantic_layer_info` / `list_semantic_views`

### Revised Effort Summary

| Tool | Phase | Effort | Blocked? |
|---|---|---|---|
| `list_metrics` (built-in) | 1 | M (3 days) | No |
| `get_table` (built-in path) | 1 | M (3–4 days) | No |
| `get_compatible_dimensions` | 1 | S (1–2 days) | No |
| `get_compatible_metrics` | 1 | S (1 day) | No |
| `DEFAULT_INSTRUCTIONS` update | 1 | S (1 day) | No |
| `list_metrics` (external) | 2 | M (2 days) | Yes — needs Snowflake plugin |
| `get_table` (external path) | 2 | M (2–3 days) | Yes — needs Snowflake plugin |
| `get_dimension_values` | 2 | S (1–2 days) | Yes — needs Snowflake plugin |
| `get_row_count` | 2 | S (1 day) | Yes — needs Snowflake plugin |
| `list_semantic_layers` | 3 | S (1–2 days) | No |
| `get_semantic_layer_info` | 3 | S (1–2 days) | No |
| `list_semantic_views` | 3 | S (1 day) | No |
| **Total Phase 1** | | **~2 weeks** | |
| **Total Phase 1+2** | | **~3.5 weeks** | |
| **Total Phase 1+2+3** | | **~4 weeks** | |
