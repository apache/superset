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
- `list_dashboards` (advanced filtering, search, UUID and slug included in default response columns)
- `get_dashboard_info` (supports ID, UUID, and slug lookup)
- `get_dashboard_available_filters`

**Datasets**
- `list_datasets` (advanced filtering, search, UUID included in default response columns, returns columns and metrics)
- `get_dataset_info` (supports ID and UUID lookup, returns columns and metrics)
- `get_dataset_available_filters`

**Charts**
- `list_charts` (advanced filtering, search, UUID included in default response columns)
- `get_chart_info` (supports ID and UUID lookup)
- `get_chart_available_filters`
- `create_chart` (comprehensive chart creation with line, bar, area, scatter, table support)
- `generate_explore_link` (generate explore links for chart configurations)

**System**
- `get_superset_instance_info`

See the architecture doc for full tool signatures and usage.

## Enhanced Parameter Handling

All MCP tools now use the **FastMCP Complex Inputs Pattern** to eliminate LLM parameter validation issues:

### Request Schema Pattern
Instead of individual parameters, tools use structured request objects:
```python
# New approach (current)
get_dataset_info(request={"identifier": 123})  # ID
get_dataset_info(request={"identifier": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"})  # UUID

# Old approach (replaced)
get_dataset_info(dataset_id=123)
```

### Multi-Identifier Support
All `get_*_info` tools now support multiple identifier types:
- **Datasets/Charts**: ID (numeric) or UUID (string)
- **Dashboards**: ID (numeric), UUID (string), or slug (string)

### Filtering & Search
All `list_*` tools support:
- **Filters**: Structured filter objects with validation to prevent conflicts
- **Search**: Free-text search across key fields (including UUID and slug)
- **Validation**: Cannot use both `search` and `filters` simultaneously

Example:
```python
# Using request schema with filters
list_dashboards(request={
    "search": "sales",
    "page": 1,
    "page_size": 20
})

# Or with filters (but not both)
list_dashboards(request={
    "filters": [{"col": "published", "opr": "eq", "value": True}],
    "page": 1,
    "page_size": 20
})
```

## Chart Creation

The `create_chart` tool supports comprehensive chart creation with:

### Supported Chart Types
- **Table charts** — Simple column display with filters and sorting
- **Line charts** — Time series line charts
- **Bar charts** — Time series bar charts  
- **Area charts** — Time series area charts
- **Scatter charts** — Time series scatter charts

### Chart Creation
The tool creates and saves permanent charts in Superset with automatically generated explore URLs.

### Intelligent Metric Handling
The tool automatically handles two metric formats:
1. **Simple metrics** (like `["count"]`) — Passed as simple strings
2. **Complex metrics** (like column names) — Converted to full Superset metric objects with SQL aggregators (SUM, COUNT, AVG, MIN, MAX)

### Example Usage
```python
# Create a line chart with SQL aggregators
config = XYChartConfig(
    chart_type="xy",
    x=ColumnRef(name="date"),
    y=[
        ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
        ColumnRef(name="orders", aggregate="COUNT", label="Order Count")
    ],
    kind="line"
)
request = CreateChartRequest(dataset_id="1", config=config)

# Create a table chart
table_config = TableChartConfig(
    chart_type="table",
    columns=[
        ColumnRef(name="region", label="Region"),
        ColumnRef(name="sales", label="Sales")
    ]
)
table_request = CreateChartRequest(dataset_id="1", config=table_config)
```

## Modular Structure & Best Practices

- Tools are organized by domain: `dashboard/`, `dataset/`, `chart/`, `system/`.
- All input/output is validated with Pydantic v2.
- Shared schemas live in `pydantic_schemas/`.
- All tool calls are logged and RBAC/auth hooks are pluggable.
- **All tool functions must be decorated with `@mcp.tool` and `@mcp_auth_hook`.**
- **All Superset DAOs, command classes, and most Superset modules must be imported inside the function body, not at the top of the file.** This ensures proper app context and avoids initialization errors.

## What's Implemented

### Core Tools (✅ Complete)
- **All list/info tools** for dashboards, datasets (with columns and metrics), and charts, with full search and filter support
- **Enhanced get_*_info tools** supporting multiple identifier types (ID/UUID/slug)
- **Chart creation** (`create_chart`) with comprehensive support for line, bar, area, scatter, and table charts
- **Explore link generation** (`generate_explore_link`) for temporary chart configurations
- **FastMCP Complex Inputs Pattern** eliminating LLM parameter validation issues

### Recent Major Improvements
- **Request Schema Pattern**: All tools use structured request objects instead of individual parameters
- **Multi-identifier Support**: Get tools support ID, UUID, and slug lookups
- **Enhanced Default Columns**: List tools include UUID/slug in default response columns for better discoverability
- **Accurate Metadata**: `columns_requested` and `columns_loaded` fields accurately track request schema pattern
- **Search Enhancement**: UUID/slug fields included in search columns
- **Validation Logic**: Prevents conflicting search+filters usage
- **Comprehensive Testing**: Full test coverage for all identifier types and validation scenarios
