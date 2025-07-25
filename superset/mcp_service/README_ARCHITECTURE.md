# Superset MCP Service Architecture

The Superset Model Context Protocol (MCP) service provides a modular, schema-driven interface for programmatic access to Superset dashboards, charts, datasets, and instance metadata. It is designed for LLM agents and automation tools, and is built on the FastMCP protocol.

**Status:** Under active development. Expect breaking changes and evolving APIs. See [SIP-171](https://github.com/apache/superset/issues/33870) for the roadmap.

---

## Overview

- **All tools are Python functions decorated with `@mcp.tool` and `@mcp_auth_hook`.**
- **All Superset DAOs, command classes, and most Superset modules must be imported inside the function body, not at the top of the file.** This ensures proper app context and avoids initialization errors.
- Tools are grouped by domain: `dashboard/`, `dataset/`, `chart/`, `system/`.
- Shared abstractions live in `model_tools.py` (for list/info/filter tools) and `middleware.py` (for logging, RBAC, etc).
- All input/output is validated with Pydantic v2 models, with field descriptions for LLM/OpenAPI compatibility.

---

## Tool Registration and Structure

- The global FastMCP instance (`mcp`) is defined in `mcp_app.py`.
- Tool modules must import `mcp` and decorate each tool function with `@mcp.tool` (for registration) and `@mcp_auth_hook` (for user context, RBAC, and logging).
- All tool modules are imported in `mcp_app.py` to ensure registration.
- Example tool function:
  ```python
  @mcp.tool
  @mcp_auth_hook
  def list_dashboards(...):
      from superset.daos.dashboard import DashboardDAO
      ...
  ```

---

## Enhanced Parameter Handling

All MCP tools now use the **FastMCP Complex Inputs Pattern** to eliminate LLM parameter validation issues:

### Request Schema Pattern
Instead of individual parameters, tools use structured request objects with clear, unambiguous types:
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

### Validation Logic
All `list_*` tools include validation to prevent conflicting parameters:
- Cannot use both `search` and `filters` simultaneously
- Clear error messages guide LLMs to use either text search OR structured filters

---

## Tool Abstractions

- **ModelListTool**: Generic class for list/search/filter tools (dashboards, charts, datasets). Handles pagination, column selection, and serialization. Now serializes columns and metrics for datasets. Uses FastMCP Complex Inputs Pattern with request schemas.
- **ModelGetInfoTool**: Enhanced class for retrieving a single object by multiple identifier types (ID, UUID, slug). Supports intelligent identifier detection and lookup.
- **ModelGetAvailableFiltersTool**: Generic class for returning available filterable columns/operators for a DAO.

---

## Middleware

- **LoggingMiddleware**: Logs every tool call to Superset's event logger, including user, agent, and resource IDs.
- **PrivateToolMiddleware**: Blocks access to tools tagged as "private".

---

## Authentication, RBAC, and User Context

- The `@mcp_auth_hook` decorator sets up Flask user context (`g.user`), supports impersonation, and enforces RBAC (overridable).
- By default, all access is allowed (admin mode). Override `has_permission` and related hooks in `auth.py` for enterprise RBAC.

---

## How to Add a New Tool

1. **Choose the Right Domain**
   - Place your tool in the appropriate subfolder: `dashboard/`, `dataset/`, `chart/`, or `system/`.
2. **Define Schemas**
   - Use Pydantic models for all input and output. Add `description` to every field.
   - Place shared schemas in `pydantic_schemas/`.
3. **Implement the Tool**
   - Decorate with `@mcp.tool` and `@mcp_auth_hook`.
   - **Import all Superset DAOs, command classes, and most Superset modules inside the function body.**
   - Use `ModelListTool`, `ModelGetInfoTool`, or `ModelGetAvailableFiltersTool` as appropriate.
   - Follow the style and conventions of existing tools.
4. **Register the Tool**
   - Add your tool to the appropriate `__init__.py` in the tool directory.
5. **Test**
   - Add unit tests in `tests/unit_tests/mcp_service/`.
   - Add integration tests in `tests/integration_tests/mcp_service/` if needed.

> **Tip:** See existing tools for examples of correct decorator usage and import placement.

---

## Security and Permissions

- All authentication, impersonation, RBAC, and access logging is handled by `@mcp_auth_hook` and middleware.
- Hooks for RBAC and logging are overridable in `auth.py` and `middleware.py`.

---

## Data Flow

- Chart creation tools now support chart types including line, bar, area, scatter, and table charts with  SQL aggregator support.
- The `create_chart` tool intelligently handles both simple metrics (like `["count"]`) and complex SQL aggregations (like `SUM`, `COUNT`, `AVG`, `MIN`, `MAX`).

```mermaid
flowchart TD
    subgraph FastMCP Service
        A["LLM/Agent or Client"]
        B["FastMCP Tool Call"]
        C["Tool Entrypoint (@mcp.tool, @mcp_auth_hook)"]
        D1["DashboardDAO"]
        D2["ChartDAO"]
        D3["DatasetDAO (returns columns & metrics)"]
        E["Superset DB"]
        F["Superset Command (for mutations, planned)"]
    end

    A --> B
    B --> C
    C -- list/count/info --> D1
    C -- list/count/info --> D2
    C -- list/count/info --> D3
    D1 --> E
    D2 --> E
    D3 --> E
    B -. "create/update/delete (planned)" .-> F
    F -.uses.-> C
    F --> D1
    F --> D2
    F --> D3
    F --> E
```

---

## Tool/DAO Mapping

| Tools | DAO | Features |
|-------|-----|----------|
| `list_dashboards`, `get_dashboard_info`, `get_dashboard_available_filters` | DashboardDAO | ID/UUID/slug lookup, UUID/slug search |
| `list_datasets`, `get_dataset_info`, `get_dataset_available_filters` | DatasetDAO | ID/UUID lookup, columns & metrics, UUID search |
| `list_charts`, `get_chart_info`, `get_chart_available_filters`, `create_chart` | ChartDAO | ID/UUID lookup, chart creation, UUID search |
| `get_superset_instance_info` | System | Instance metadata |
| `generate_explore_link` | Chart | Temporary chart exploration |

---

## Filtering & Search

- All list tools support advanced (object-based) and simple (field=value) filters, as well as free-text search.
- **Enhanced Search**: UUID and slug fields are included in search columns for better discoverability
- **Validation**: Tools prevent using both `search` and `filters` simultaneously to avoid query conflicts
- **Request Schemas**: All filtering uses structured request objects with clear validation rules
- Use the available filters tool for each domain to discover supported fields and operators.

---

## Test Coverage

- All dataset tools now have unit tests verifying columns and metrics are included in responses.
- Chart creation tools have comprehensive tests covering all supported chart types and SQL aggregators.
- **Multi-identifier Testing**: All get_*_info tools have tests for ID, UUID, and slug (where applicable) lookup
- **Request Schema Testing**: All list tools tested with new request schema pattern
- **Validation Testing**: Tests verify that search+filters conflicts are properly prevented
- Improved test mocks and LLM/OpenAPI compatibility for all dataset-related tools.

---

## Roadmap

- All list/info tools for dashboards, datasets, and charts are implemented.
- Chart creation (`create_chart`) is available with support for line, bar, area, scatter, and table charts.
- System info and available filters are implemented.
- Mutations (create/update/delete) and navigation tools are planned.
- Full unit and integration test coverage.
- Protocol-level tests for agent compatibility.

---

For more, see the main [README](./README.md) and [SIP-171](https://github.com/apache/superset/issues/33870).
