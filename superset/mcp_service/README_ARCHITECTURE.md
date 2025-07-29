# Superset MCP Service Architecture

The Superset Model Context Protocol (MCP) service provides a modular, schema-driven interface for programmatic access to Superset dashboards, charts, datasets, and instance metadata. It is designed for LLM agents and automation tools, and is built on the FastMCP protocol.

**Status:** Phase 1 Complete (95% done). Core functionality stable, authentication production-ready, extensive testing coverage. See [SIP-171](https://github.com/apache/superset/issues/33870) for the roadmap.

---

## Overview

- **All tools are Python functions decorated with `@mcp.tool` and `@mcp_auth_hook`.**
- **All Superset DAOs, command classes, and most Superset modules must be imported inside the function body, not at the top of the file.** This ensures proper app context and avoids initialization errors.
- Tools are grouped by domain: `dashboard/`, `dataset/`, `chart/`, `system/`.
- Shared abstractions live in `generic_tools.py` (for list/info/filter tools) and `middleware.py` (for logging, RBAC, etc).
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

The MCP service supports **configurable production-ready authentication** with JWT Bearer tokens:

### Authentication Features
- **JWT Bearer Authentication**: RS256 tokens validated against JWKS or public key
- **Configurable Factory Pattern**: Follows Superset's configuration patterns per @dpgaspar's design
- **User Context**: JWT claims mapped to Superset users with proper Flask `g.user` context
- **Scope-Based Authorization**: Tool-level permissions based on JWT scopes
- **Flexible User Resolution**: Configurable JWT claim extraction (subject, client_id, email, username)
- **Audit Logging**: All operations logged with JWT user context
- **Development Mode**: Authentication disabled by default for local development

### Configuration
```python
# Enable authentication in superset_config.py
MCP_AUTH_ENABLED = True
MCP_JWKS_URI = "https://auth.company.com/.well-known/jwks.json"
MCP_JWT_ISSUER = "https://auth.company.com/"
MCP_JWT_AUDIENCE = "superset-mcp-api"
```

### Tool Authorization
| Tool | Required Scope |
|------|----------------|
| `list_dashboards`, `get_dashboard_info` | `dashboard:read` |
| `list_charts`, `get_chart_info` | `chart:read` |
| `generate_chart` | `chart:write` |
| `list_datasets`, `get_dataset_info` | `dataset:read` |
| `get_superset_instance_info` | `instance:read` |

The `@mcp_auth_hook` decorator handles user extraction, scope validation, impersonation support, and audit logging.

---

## How to Add a New Tool

1. **Choose the Right Domain**
   - Place your tool in the appropriate subfolder: `dashboard/`, `dataset/`, `chart/`, or `system/`.
2. **Define Schemas**
   - Use Pydantic models for all input and output. Add `description` to every field.
   - Make info schemas have all optional fields to handle missing data gracefully.
   - Design schemas to exclude null values that weren't in the select statement.
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

## Configuration Best Practices

### URL Configuration
Configure Superset base URL for proper chart and explore URL generation:
```python
# In superset_config.py
SUPERSET_WEBSERVER_ADDRESS = "http://localhost:8088"  # Development
SUPERSET_WEBSERVER_ADDRESS = "https://superset.company.com"  # Production
```

**Centralized URL Management:**
- All MCP tools use `get_superset_base_url()` utility from `url_utils.py`
- Fallback hierarchy: `SUPERSET_WEBSERVER_ADDRESS` → component URLs → localhost:8088
- Screenshot service uses same port as MCP service (WSGI endpoint)
- Environment flexibility for development and production deployments

### Schema Optimization
- **Minimal Columns**: List tools show only essential columns by default
- **Optional Fields**: Info schemas use `Optional[]` for all fields to handle missing data
- **Null Handling**: Schemas exclude keys for null values not in original select statement
- **Type Safety**: Prevent LLMs from passing incorrect types with clear Pydantic validation

---

## Security and Permissions

The MCP service provides enterprise-grade security features:

### Authentication Security
- **JWT Validation**: RS256 signature verification with JWKS or public key
- **Token Expiration**: Standard JWT exp claim validation
- **Audience Validation**: Prevents token reuse across services
- **Issuer Validation**: Ensures tokens from trusted identity providers

### Authorization & Access Control
- **Scope-Based Permissions**: Fine-grained access control per tool
- **User Impersonation**: Support for `run_as` parameter with proper auditing
- **Fallback Admin**: Graceful degradation to admin users when JWT user not found
- **Active User Validation**: Inactive users automatically denied access

### Audit & Monitoring
- **Logging**: All tool calls logged with user context
- **JWT Context**: Access logs include JWT user, scopes, and token metadata
- **Error Tracking**: Authentication failures logged with debug information
- **Permission Denials**: Clear audit trail for access control decisions

All security features are implemented in `auth.py` with 149 passing unit tests ensuring robust operation.

---

## System Architecture Overview

The MCP service provides a layered architecture with authentication, tool execution, and direct database access:

```mermaid
graph TB
    subgraph "Client Layer"
        LLM[LLM/Agent Client]
        SDK[Claude SDK]
        HTTP[HTTP Client]
    end

    subgraph "MCP Service Layer"
        FastMCP[FastMCP Server<br/>Port 5008]
        Auth[JWT Auth Hook<br/>@mcp_auth_hook]
        Tools[16 MCP Tools<br/>@mcp.tool]
    end

    subgraph "Superset Integration Layer"
        DAOs[Superset DAOs<br/>ChartDAO, DashboardDAO, DatasetDAO]
        Commands[Superset Commands<br/>CreateChartCommand, etc.]
        Utils[Superset Utils<br/>Screenshots, URLs, etc.]
    end

    subgraph "Data & Services Layer"
        DB[(Superset Database<br/>PostgreSQL/MySQL)]
        Screenshots[Firefox WebDriver<br/>Chart Screenshots]
        Cache[Cache Layer<br/>Redis/SimpleCache]
    end

    LLM --> FastMCP
    SDK --> FastMCP
    HTTP --> FastMCP

    FastMCP --> Auth
    Auth --> Tools

    Tools --> DAOs
    Tools --> Commands
    Tools --> Utils

    DAOs --> DB
    Commands --> DB
    Utils --> Screenshots
    Utils --> Cache

    Screenshots --> DB
```

## Tool Categories & Data Flow

### Dashboard Tools (5 tools)
```mermaid
graph LR
    subgraph "Dashboard Operations"
        ListDash[list_dashboards]
        GetDash[get_dashboard_info]
        FilterDash[get_dashboard_available_filters]
        GenDash[generate_dashboard]
        AddChart[add_chart_to_existing_dashboard]
    end

    subgraph "Data Access"
        DashDAO[DashboardDAO]
        ChartDAO[ChartDAO]
        CreateCmd[CreateDashboardCommand]
    end

    subgraph "Database"
        DashTable[(dashboards table)]
        DashCharts[(dashboard_slices table)]
    end

    ListDash --> DashDAO
    GetDash --> DashDAO
    FilterDash --> DashDAO
    GenDash --> CreateCmd
    AddChart --> DashDAO

    DashDAO --> DashTable
    CreateCmd --> DashTable
    CreateCmd --> DashCharts
    AddChart --> DashCharts
```

### Chart Tools (6 tools)
```mermaid
graph LR
    subgraph "Chart Operations"
        ListChart[list_charts]
        GetChart[get_chart_info]
        FilterChart[get_chart_available_filters]
        CreateChart[generate_chart]
        GetData[get_chart_data]
        GetPreview[get_chart_preview]
    end

    subgraph "Data & Services"
        ChartDAO[ChartDAO]
        CreateCmd[CreateChartCommand]
        DataCmd[ChartDataCommand]
        Screenshot[ChartScreenshot]
    end

    subgraph "Database & External"
        ChartsTable[(slices table)]
        WebDriver[Firefox WebDriver]
        QueryEngine[SQL Query Engine]
    end

    ListChart --> ChartDAO
    GetChart --> ChartDAO
    FilterChart --> ChartDAO
    CreateChart --> CreateCmd
    GetData --> DataCmd
    GetPreview --> Screenshot

    ChartDAO --> ChartsTable
    CreateCmd --> ChartsTable
    DataCmd --> QueryEngine
    Screenshot --> WebDriver
```

### Dataset Tools (3 tools)
```mermaid
graph LR
    subgraph "Dataset Operations"
        ListDS[list_datasets]
        GetDS[get_dataset_info]
        FilterDS[get_dataset_available_filters]
    end

    subgraph "Data Access"
        DatasetDAO[DatasetDAO]
        ColumnDAO[TableColumnDAO]
        MetricDAO[SqlMetricDAO]
    end

    subgraph "Database Tables"
        TablesTable[(tables table)]
        ColumnsTable[(table_columns table)]
        MetricsTable[(sql_metrics table)]
    end

    ListDS --> DatasetDAO
    GetDS --> DatasetDAO
    FilterDS --> DatasetDAO

    DatasetDAO --> TablesTable
    DatasetDAO --> ColumnDAO
    DatasetDAO --> MetricDAO

    ColumnDAO --> ColumnsTable
    MetricDAO --> MetricsTable
```

### System & SQL Lab Tools (3 tools)
```mermaid
graph LR
    subgraph "System Operations"
        Instance[get_superset_instance_info]
        ExploreLink[generate_explore_link]
        SqlLab[open_sql_lab_with_context]
    end

    subgraph "Services"
        Config[Superset Config]
        URLGen[URL Generator]
        DBDao[DatabaseDAO]
    end

    subgraph "Resources"
        AppCtx[Flask App Context]
        Database[(Database Connection)]
    end

    Instance --> Config
    ExploreLink --> URLGen
    SqlLab --> DBDao

    Config --> AppCtx
    URLGen --> AppCtx
    DBDao --> Database
```

## Individual Tool Execution Flows

### Chart Creation Flow
```mermaid
sequenceDiagram
    participant Client as LLM Client
    participant MCP as FastMCP Server
    participant Auth as Auth Hook
    participant Tool as generate_chart
    participant DAO as ChartDAO
    participant CMD as CreateChartCommand
    participant DB as Database

    Client->>+MCP: generate_chart(request)
    MCP->>+Auth: @mcp_auth_hook
    Auth->>Auth: Validate JWT & Scopes
    Auth->>+Tool: Execute with user context
    Tool->>Tool: Parse GenerateChartRequest
    Tool->>+DAO: find_by_id(dataset_id)
    DAO->>DB: SELECT from tables
    DB-->>DAO: Dataset record
    DAO-->>Tool: Dataset object
    Tool->>Tool: Build form_data config
    Tool->>+CMD: CreateChartCommand.run()
    CMD->>DB: INSERT into slices
    DB-->>CMD: Chart ID
    CMD-->>Tool: Chart object
    Tool->>Tool: Generate explore URL
    Tool-->>Auth: ChartCreationResponse
    Auth-->>MCP: Response with chart data
    MCP-->>Client: JSON response
```

### Dashboard Generation Flow
```mermaid
sequenceDiagram
    participant Client as LLM Client
    participant MCP as FastMCP Server
    participant Tool as generate_dashboard
    participant ChartDAO as ChartDAO
    participant DashCmd as CreateDashboardCommand
    participant DB as Database

    Client->>+MCP: generate_dashboard(request)
    MCP->>+Tool: Execute with auth
    Tool->>Tool: Parse chart_ids array

    loop For each chart_id
        Tool->>+ChartDAO: find_by_id(chart_id)
        ChartDAO->>DB: SELECT from slices
        DB-->>ChartDAO: Chart record
        ChartDAO-->>Tool: Chart object
    end

    Tool->>Tool: Generate 2-column layout
    Tool->>Tool: Create dashboard JSON
    Tool->>+DashCmd: CreateDashboardCommand.run()
    DashCmd->>DB: INSERT into dashboards
    DashCmd->>DB: INSERT into dashboard_slices
    DB-->>DashCmd: Dashboard ID
    DashCmd-->>Tool: Dashboard object
    Tool->>Tool: Generate dashboard URL
    Tool-->>MCP: Dashboard response
    MCP-->>Client: JSON with dashboard info
```

### Chart Preview Flow
```mermaid
sequenceDiagram
    participant Client as LLM Client
    participant MCP as FastMCP Server
    participant Tool as get_chart_preview
    participant DAO as ChartDAO
    participant Screenshot as ChartScreenshot
    participant WebDriver as Firefox WebDriver
    participant DB as Database

    Client->>+MCP: get_chart_preview(request)
    MCP->>+Tool: Execute with auth
    Tool->>+DAO: find_by_id(chart_id)
    DAO->>DB: SELECT from slices
    DB-->>DAO: Chart record
    DAO-->>Tool: Chart object

    alt format="url" or "base64"
        Tool->>+Screenshot: ChartScreenshot(chart_url)
        Screenshot->>+WebDriver: Launch Firefox headless
        WebDriver->>WebDriver: Navigate to chart URL
        WebDriver->>WebDriver: Wait for chart render
        WebDriver->>WebDriver: Take screenshot
        WebDriver-->>Screenshot: PNG image data
        Screenshot-->>Tool: Image bytes
        Tool->>Tool: Generate preview URL/base64
    else format="ascii" or "table"
        Tool->>Tool: Extract chart data
        Tool->>Tool: Generate ASCII/table representation
    end

    Tool-->>MCP: ChartPreview response
    MCP-->>Client: Preview data/URL
```

## Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant Client as LLM Client
    participant MCP as FastMCP Server
    participant Auth as @mcp_auth_hook
    participant JWT as JWT Validator
    participant User as UserManager
    participant Tool as MCP Tool
    participant Audit as AuditLogger

    Client->>+MCP: Tool call with JWT Bearer
    MCP->>+Auth: @mcp_auth_hook decorator
    Auth->>+JWT: Validate JWT token
    JWT->>JWT: Verify signature (RS256)
    JWT->>JWT: Check expiration
    JWT->>JWT: Validate audience/issuer
    JWT-->>Auth: JWT claims

    Auth->>+User: Find user by JWT subject
    User->>User: Check user active status
    User-->>Auth: Superset User object

    Auth->>Auth: Check required scopes
    alt Scopes valid
        Auth->>Auth: Set Flask g.user context
        Auth->>+Audit: Log tool access
        Audit->>Audit: Record user, tool, timestamp
        Auth->>+Tool: Execute tool function
        Tool->>Tool: Business logic
        Tool-->>Auth: Tool response
        Auth-->>MCP: Success response
    else Scopes invalid
        Auth->>+Audit: Log permission denied
        Auth-->>MCP: 403 Permission Denied
    end

    MCP-->>Client: Final response
```

## Request Schema Pattern Flow

```mermaid
graph TD
    subgraph "LLM Client Side"
        LLM[LLM generates call]
        Validate[Parameter validation]
    end

    subgraph "MCP Service Side"
        Schema[Pydantic Request Schema]
        Parse[Parse & Validate]
        Execute[Execute Business Logic]
    end

    subgraph "Traditional Approach Problems"
        MultiParam[Multiple parameters]
        Ambiguity[Type ambiguity]
        Conflicts[Parameter conflicts]
        Errors[Validation errors]
    end

    subgraph "Request Schema Benefits"
        SingleObj[Single request object]
        TypeSafe[Strong typing]
        NoConflict[No parameter conflicts]
        ClearErrors[Clear validation messages]
    end

    LLM --> Validate
    Validate --> Schema
    Schema --> Parse
    Parse --> Execute

    MultiParam -.-> Ambiguity
    Ambiguity -.-> Conflicts
    Conflicts -.-> Errors

    SingleObj --> TypeSafe
    TypeSafe --> NoConflict
    NoConflict --> ClearErrors

    style MultiParam fill:#ffcccc
    style Ambiguity fill:#ffcccc
    style Conflicts fill:#ffcccc
    style Errors fill:#ffcccc

    style SingleObj fill:#ccffcc
    style TypeSafe fill:#ccffcc
    style NoConflict fill:#ccffcc
    style ClearErrors fill:#ccffcc
```

---

## Tool/DAO Mapping

| Tools | DAO | Features |
|-------|-----|----------|
| `list_dashboards`, `get_dashboard_info`, `get_dashboard_available_filters` | DashboardDAO | ID/UUID/slug lookup, UUID/slug search |
| `list_datasets`, `get_dataset_info`, `get_dataset_available_filters` | DatasetDAO | ID/UUID lookup, columns & metrics, UUID search |
| `list_charts`, `get_chart_info`, `get_chart_available_filters`, `generate_chart`, `update_chart`, `update_chart_preview` | ChartDAO | ID/UUID lookup, chart creation/updates, UUID search |
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
- Chart creation tools have tests covering all 5 supported chart types and SQL aggregators.
- **Multi-identifier Testing**: All get_*_info tools have tests for ID, UUID, and slug (where applicable) lookup
- **Request Schema Testing**: All list tools tested with new request schema pattern
- **Validation Testing**: Tests verify that search+filters conflicts are properly prevented
- Improved test mocks and LLM/OpenAPI compatibility for all dataset-related tools.

---

## Current Status & Roadmap

### ✅ Completed (Phase 1 Core)
- **Service Infrastructure**: FastMCP server, CLI, configuration
- **Production Authentication**: JWT Bearer with configurable factory pattern
- **All List/Info Tools**: Dashboards, datasets, charts with multi-identifier support
- **Chart Creation**: `generate_chart` with line, bar, area, scatter, table support
- **Navigation Tools**: `generate_explore_link` for explore URLs
- **System Tools**: Instance info and available filters
- **Request Schema Pattern**: Eliminates LLM parameter validation issues
- **Testing**: 194+ unit tests, full pre-commit compliance

### 🟡 Recently Completed (Phase 1 Final)
- **Chart Update Operations**: `update_chart` and `update_chart_preview` for modifying saved and cached charts ✅
- **Centralized URL Configuration**: `SUPERSET_WEBSERVER_ADDRESS` support with centralized URL management ✅
- **MCP Audit Logging**: Comprehensive audit trails with impersonation tracking and payload sanitization ✅
- **Backend Chart Rendering**: Screenshot URLs for LLM chat integration ✅
- **SQL Lab Integration**: `open_sql_lab_with_context` for pre-loaded queries ✅
- **Dashboard Generation**: `generate_dashboard` and `add_chart_to_existing_dashboard` ✅
- **Chart Data & Preview**: `get_chart_data` and `get_chart_preview` with multiple formats ✅
- **BaseDAO Type Safety**: Enhanced UUID handling with extensive test coverage ✅

### 🎯 Phase 1 Stretch Goals
- **Demo Script/Notebook**: Interactive bot capabilities showcase
- **OAuth Integration**: User impersonation with secure authentication flows
- **LLM-Friendly Rendering**: Vega-Lite/Plotly JSON for chat embedding

**Phase 1 Progress**: 95% complete, core features ready for production

### Integration Examples
- **Claude Agent SDK**: Create cloud agents connecting to MCP service
- **LangChain Integration**: Use `langchain-mcp` toolkit for chatbot connections
- **End-to-End Testing**: Synthetic environments with example database for integration testing
- **Video Demonstrations**: Tool workflow examples for community engagement

---

For more, see the main [README](./README.md) and [SIP-171](https://github.com/apache/superset/issues/33870).
