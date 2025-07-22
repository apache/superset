# Superset MCP Service

The Superset Model Context Protocol (MCP) service provides a modular, schema-driven interface for programmatic access to Superset dashboards, charts, datasets, and instance metadata. It is designed for LLM agents and automation tools, and is built on the FastMCP protocol.

**⚠️ This functionality is under active development and not yet complete. Expect breaking changes and evolving APIs.**

## 🚀 Quickstart

### 1. Install Requirements

```bash
uv pip install -r requirements/development.txt
uv pip install -e .
source .venv/bin/activate
```

### 2. Run the MCP Service

```bash
superset mcp run --port 5008 --debug --sql-debug
```

### 3. Test Your Setup

Run the unit and integration tests to verify your environment:

```bash
pytest tests/unit_tests/mcp_service/ --maxfail=1 -v
# For integration tests:
python tests/integration_tests/mcp_service/run_mcp_tests.py
```

## Available Tools

All tools are modular, strongly typed, and use Pydantic v2 schemas. Every field is documented for LLM/OpenAPI compatibility.

**Dashboards**
- `list_dashboards` (advanced filtering, search)
- `get_dashboard_info`
- `get_dashboard_available_filters`

**Datasets**
- `list_datasets` (advanced filtering, search, now returns columns and metrics)
- `get_dataset_info` (now returns columns and metrics)
- `get_dataset_available_filters`

**Charts**
- `list_charts` (advanced filtering, search)
- `get_chart_info`
- `get_chart_available_filters`
- `create_chart` (basic chart creation with line, bar, area, scatter, table support)

**System**
- `get_superset_instance_info`

See the architecture doc for full tool signatures and usage.

## Filtering & Search

All `list_*` tools support:
- **Filters**: Complex (list of filter objects) or simple (field=value).
- **Search**: Free-text search across key fields (e.g., dashboard title, chart name, dataset table name).

Example:
```python
list_dashboards(
    search="churn",
    filters=[{"col": "published", "opr": "eq", "value": True}]
)
```

## Chart Creation

The `create_chart` tool supports comprehensive chart creation with:

### Supported Chart Types
- **Table charts** — Simple column display with filters and sorting
- **Line charts** — Time series line charts
- **Bar charts** — Time series bar charts  
- **Area charts** — Time series area charts
- **Scatter charts** — Time series scatter charts

### Chart Saving vs Explore Links
The tool supports two modes via the `save_chart` parameter:
- **`save_chart=True` (default)** — Creates and saves a permanent chart in Superset
- **`save_chart=False`** — Generates an explore link for temporary chart configuration without saving

### Intelligent Metric Handling
The tool automatically handles two metric formats:
1. **Simple metrics** (like `["count"]`) — Passed as simple strings
2. **Complex metrics** (like column names) — Converted to full Superset metric objects with SQL aggregators (SUM, COUNT, AVG, MIN, MAX)

### Example Usage
```python
# Create and save a line chart with SQL aggregators
config = XYChartConfig(
    chart_type="xy",
    x=ColumnRef(name="date"),
    y=[
        ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
        ColumnRef(name="orders", aggregate="COUNT", label="Order Count")
    ],
    kind="line"
)
request = CreateChartRequest(dataset_id="1", config=config, save_chart=True)

# Generate an explore link without saving
request = CreateChartRequest(dataset_id="1", config=config, save_chart=False)
```

### Practical Example
```python
# Create a chart and save it permanently
saved_chart_request = CreateChartRequest(
    dataset_id="1",
    config=XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="date"),
        y=[ColumnRef(name="sales", aggregate="SUM")],
        kind="line"
    ),
    save_chart=True
)

# Generate an explore link for temporary exploration
explore_request = CreateChartRequest(
    dataset_id="1",
    config=XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="date"),
        y=[ColumnRef(name="sales", aggregate="SUM")],
        kind="line"
    ),
    save_chart=False
)
```

## Modular Structure & Best Practices

- Tools are organized by domain: `dashboard/`, `dataset/`, `chart/`, `system/`.
- All input/output is validated with Pydantic v2.
- Shared schemas live in `pydantic_schemas/`.
- All tool calls are logged and RBAC/auth hooks are pluggable.
- **All tool functions must be decorated with `@mcp.tool` and `@mcp_auth_hook`.**
- **All Superset DAOs, command classes, and most Superset modules must be imported inside the function body, not at the top of the file.** This ensures proper app context and avoids initialization errors.

## What's Implemented

- All list/info tools for dashboards, datasets (with columns and metrics), and charts, with full search and filter support.
- Chart creation (`create_chart`) with comprehensive support for line, bar, area, scatter, and table charts with intelligent metric handling.
