# Superset MCP Service

The Superset Model Context Protocol (MCP) service provides a universal, schema-driven interface for programmatic access to Superset dashboards, charts, datasets, and instance metadata. It is designed for LLM agents and automation tools to interact with Superset securely and efficiently, following the [SIP-171 MCP proposal](https://github.com/apache/superset/issues/33870).

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
- `list_dashboards_simple` (simple filtering, search)
- `get_dashboard_info`
- `get_dashboard_available_filters`

**Datasets**
- `list_datasets` (advanced filtering, search)
- `list_datasets_simple` (simple filtering, search)
- `get_dataset_info`
- `get_dataset_available_filters`

**Charts**
- `list_charts` (advanced filtering, search)
- `list_charts_simple` (simple filtering, search)
- `get_chart_info`
- `get_chart_available_filters`
- `create_chart_simple`

**System**
- `get_superset_instance_info`

See the architecture doc for full tool signatures and usage.

## Filtering & Search

All `list_*` tools support:
- **Filters**: Complex (list of filter objects) or simple (field=value).
- **Search**: Free-text search across key fields (e.g., dashboard title, chart name, dataset table name).

Example:
```python
list_dashboards(search="churn", filters=[{"col": "published", "opr": "eq", "value": True}])
```

## Modular Structure

- Tools are organized by domain: `tools/dashboard/`, `tools/dataset/`, `tools/chart/`, `tools/system/`.
- All input/output is validated with Pydantic v2.
- Shared schemas live in `pydantic_schemas/`.
- All tool calls are logged and RBAC/auth hooks are pluggable.

## What's Implemented

- All list/info tools for dashboards, datasets, and charts, with full search and filter support.
- Chart creation (`create_chart_simple`).
- System info and available filters.
- Full unit and integration test coverage for all tools, including search and error handling.
- Protocol-level tests for agent compatibility.
- **Note:** The API and toolset are still evolving and not all planned features are implemented yet.

## Further Reading

- [Architecture & Roadmap](./README_ARCHITECTURE.md)
- [SIP-171: MCP Service Proposal](https://github.com/apache/superset/issues/33870)
- [Integration Tests](../../tests/integration_tests/mcp_service/README_mcp_tests.md)
- [Superset Docs](https://superset.apache.org/docs/)
