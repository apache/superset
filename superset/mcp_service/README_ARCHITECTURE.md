# Superset MCP Service Architecture

**⚠️ The Superset MCP service is under active development and not yet complete. Functionality, APIs, and tool coverage are evolving rapidly. See [SIP-171](https://github.com/apache/superset/issues/33870) for the roadmap and proposal.**

The Superset MCP service exposes high-level tools for dashboards, charts, and datasets via the FastMCP protocol. All read/list/count operations use Superset DAOs, orchestrated by the `ModelListTool` abstraction and protected by the `mcp_auth_hook` for security and user context. Mutations (create/update/delete) will use Superset command objects in future versions.

## Flow Overview

```mermaid
flowchart TD
    subgraph FastMCP Service
        A["LLM/Agent or Client"]
        B["FastMCP Tool Call"]
        C["Tool Entrypoint (with mcp_auth_hook)"]
        D1["DashboardDAO"]
        D2["ChartDAO"]
        D3["DatasetDAO"]
        E["Superset DB"]
        F["Superset Command (planned for mutations)"]
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

## Modular Tool Structure

All tools are organized by domain for clarity and maintainability:

- `superset/mcp_service/tools/dashboard/`
- `superset/mcp_service/tools/dataset/`
- `superset/mcp_service/tools/chart/`
- `superset/mcp_service/tools/system/`

Each tool is a standalone Python module. Shared utilities live in `tools/base.py` and `utils.py`.

## Pydantic Model/Data Flow

```mermaid
flowchart TD
    subgraph Tool Layer
        T["FastMCP Tool"]
        PI["Pydantic Input Model"]
        PO["Pydantic Output Model"]
    end
    subgraph Service Layer
        DAO["DAO (DashboardDAO, ChartDAO, DatasetDAO)"]
    end
    subgraph Data Layer
        DB["Superset DB"]
        SA["SQLAlchemy Models"]
    end

    T -- input schema --> PI
    PI -- validated params --> DAO
    DAO -- queries --> DB
    DB -- returns --> SA
    SA -- returned by --> DAO
    DAO -- SQLAlchemy models --> T
    T -- builds --> PO
    PO -- response schema --> T
```

- **Pydantic Input Model**: Defines and validates tool input parameters.
- **ModelListTool**: Orchestrates DAO calls and output serialization.
- **mcp_auth_hook**: Handles user context, RBAC, and logging at the tool entrypoint.
- **FastMCP Tool**: Converts SQLAlchemy models to the Pydantic output model for the response.
- **Pydantic Output Model**: Defines the structured response returned by each tool.
- All tool contracts are strongly typed, ensuring robust agent and client integration for dashboards, charts, and datasets.

## ModelListTool Abstraction

The `ModelListTool` class provides a generic, configurable way to implement list tools for any domain (dashboards, charts, datasets). It handles:
- Input validation and parameter normalization
- DAO invocation and pagination
- Output serialization (with only requested columns)
- Consistent response structure for all list tools

This abstraction reduces code duplication and ensures all list tools behave consistently.

## How to Add a New Tool

1. **Choose the Right Domain**
   - Place your tool in the appropriate subfolder under `tools/` (e.g., `tools/chart/`).
2. **Define Schemas**
   - Use Pydantic models for all input and output.
   - Add `description` to every field for LLM/OpenAPI friendliness.
   - Place shared schemas in `pydantic_schemas/`.
3. **Implement the Tool**
   - Use `log_tool_call` from `tools/base.py` for logging.
   - Use `ModelListTool` for list tools, or direct DAO/command usage for others.
   - Protect the entrypoint with `mcp_auth_hook` for user context and RBAC.
   - Follow the style and conventions of existing tools.
4. **Register the Tool**
   - Add your tool to `tools/__init__.py` in the `MCP_TOOLS` dict and `__all__` list.
5. **Test**
   - Add unit tests in `tests/unit_tests/mcp_service/`.
   - Add integration tests in `tests/integration_tests/mcp_service/` if needed.

See existing tools in each domain for examples and best practices.

## Security and Permissions

All authentication, impersonation, RBAC, and access logging for MCP tools is now handled by the `mcp_auth_hook` decorator. This decorator:

- Sets up the Flask user context (`g.user`) for every tool call, so all downstream DAO/model code sees the correct user.
- Supports impersonation ("run as this user") and is ready for OIDC/OAuth/Okta integration.
- Provides hooks for endpoint-level permissioning and RBAC (role-based access control).
- Provides a hook for access and action logging (for observability/audit).

By default, all access is allowed (admin mode), but you can override the hooks in `utils.py` for enterprise integration. The `ModelListTool` and `mcp_auth_hook` are the main extension points for custom logic.

## Tool/DAO Mapping
- **list_dashboards, get_dashboard_info**: DashboardDAO
- **list_datasets, get_dataset_info**: DatasetDAO
- **list_charts, get_chart_info**: ChartDAO
- **get_superset_instance_info**: System metadata
- **Mutations (planned)**: Use Superset command objects for all create/update/delete actions

## Filtering & Search

All list tools support both advanced (object-based) and simple (field-based) filters, as well as free-text search across key fields. See the README for usage examples.

## Current Status & Roadmap

- All list/info tools for dashboards, datasets, and charts are implemented, with full search and filter support.
- Chart creation (`create_chart_simple`) is available.
- System info and available filters are implemented.
- Full unit and integration test coverage for all tools, including search and error handling.
- Protocol-level tests for agent compatibility.
- **Planned:** Mutations (create/update/delete) via Superset command objects, more granular RBAC, and richer system tools.

## References
- [SIP-171: MCP Service Proposal](https://github.com/apache/superset/issues/33870)
- [Main README](./README.md)
