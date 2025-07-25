# Superset MCP Service

The Superset Model Context Protocol (MCP) service provides a modular, schema-driven interface for programmatic access to Superset dashboards, charts, datasets, and instance metadata. It is designed for LLM agents and automation tools, and is built on the FastMCP protocol.

**⚠️ Phase 1 nearing completion (85% done). Core functionality stable, authentication production-ready. Stretch goals in progress.**

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

## Phase 1 Status

### ✅ Completed Features
| Epic | Status | Description |
|------|--------|--------------|
| **[Implement Standalone MCP Service CLI](https://app.shortcut.com/preset-ext/story/90298)** | ✅ Complete | ASGI/FastMCP server with CLI (`superset mcp run`) |
| **[Add Auth/RBAC Hooks](https://app.shortcut.com/preset-ext/story/90301)** | ✅ Complete | JWT Bearer authentication, RBAC hooks, logging, configurable factory pattern |
| **[Implement list/info tools for dataset, dashboard, chart](https://app.shortcut.com/preset-ext/story/90300)** | 🟡 In QA | All list/info tools for dashboards, datasets, charts with multi-identifier support |
| **[Define Modular, Typed Schemas](https://app.shortcut.com/preset-ext/story/90299)** | 🟡 In Review | Pydantic v2 schemas, FastMCP Complex Inputs Pattern |
| **[Write Dev Guide and Docs](https://app.shortcut.com/preset-ext/story/90302)** | 🟡 In Review | Architecture documentation, request/response examples |

### 🔄 Phase 1 In Progress
| Epic | Status | Description |
|------|--------|--------------|
| **[Implement Chart Creation Mutation](https://app.shortcut.com/preset-ext/story/90304)** | 🟡 In Review | `create_chart` tool with comprehensive chart type support |
| **[Implement Navigation Actions](https://app.shortcut.com/preset-ext/story/90305)** | 🟡 In Review | `generate_explore_link` ✅, `open_sql_lab_with_context` pending |
| **[backend rendering in the short term for embedded charts in to the chat](https://app.shortcut.com/preset-ext/story/90511)** | 🟨 In Development | Embedded charts for LLM chat integration |
| **[Support for Bearer authentication](https://app.shortcut.com/preset-ext/story/90509)** | 🟨 In Development | Enhanced JWT authentication features |
| **[Document Preset Extension Points](https://app.shortcut.com/preset-ext/story/90303)** | 🟡 In Review | RBAC, OIDC integration design for Preset team |

### 🎯 Phase 1 Stretch Goals
| Epic | Status | Description |
|------|--------|--------------|
| **[Create Demo Script / Notebook](https://app.shortcut.com/preset-ext/story/90306)** | 📋 Planned | Interactive demo showing bot capabilities, video demonstrations |
| **[In-Preset Hosted Demo (OAuth, impersonation)](https://app.shortcut.com/preset-ext/story/90397)** | 📋 Planned | User impersonation with OAuth handshake, cloud deployment |
| **[LLM / Chat friendly backend rendered charts](https://app.shortcut.com/preset-ext/story/90508)** | 📋 Planned | Chart embedding in LLM chats, screenshot URLs, Vega-Lite/Plotly JSON |

### 🚫 Out of Scope (Not Phase 1)
| Epic | Status | Description |
|------|--------|--------------|
| **[Security Hooks for Tool Poisoning Attacks](https://app.shortcut.com/preset-ext/story/90398)** | 📋 Future | Tool poisoning attack prevention |
| **[caching and refresh](https://app.shortcut.com/preset-ext/story/90510)** | 📋 Out of Scope | Leverage existing Superset cache layers |

## Security & Authentication

The MCP service supports **configurable JWT Bearer authentication** following Superset's factory pattern. Authentication is **disabled by default** for development convenience.

### Configuration Options

**Option 1: Simple Configuration** (Add to `superset_config.py`):
```python
# Enable authentication
MCP_AUTH_ENABLED = True

# JWT settings
MCP_JWKS_URI = "https://auth.company.com/.well-known/jwks.json"
MCP_JWT_ISSUER = "https://auth.company.com/"
MCP_JWT_AUDIENCE = "superset-mcp-api"
MCP_REQUIRED_SCOPES = ["dashboard:read", "chart:read"]
```

**Option 2: Custom Factory** (Advanced):
```python
def create_custom_mcp_auth(app):
    """Custom auth logic for your environment."""
    from fastmcp.server.auth.providers.bearer import BearerAuthProvider

    return BearerAuthProvider(
        jwks_uri=app.config["MCP_JWKS_URI"],
        issuer=app.config["MCP_JWT_ISSUER"],
        audience=app.config["MCP_JWT_AUDIENCE"],
    )

MCP_AUTH_FACTORY = create_custom_mcp_auth
```

**Option 3: Environment Variables** (Legacy):
```bash
MCP_AUTH_ENABLED=true
MCP_JWKS_URI=https://auth.company.com/.well-known/jwks.json
MCP_JWT_ISSUER=https://auth.company.com/
MCP_JWT_AUDIENCE=superset-mcp-api
MCP_REQUIRED_SCOPES=dashboard:read,chart:read
```

### Security Features

**JWT Authentication**: RS256 tokens validated against JWKS or public key

**User Context**: JWT claims mapped to Superset users for proper permissions

**Scope-Based Authorization**:
| Tool | Required Scope |
|------|----------------|
| `list_dashboards`, `get_dashboard_info` | `dashboard:read` |
| `list_charts`, `get_chart_info` | `chart:read` |
| `create_chart` | `chart:write` |
| `list_datasets`, `get_dataset_info` | `dataset:read` |
| `get_superset_instance_info` | `instance:read` |

**Audit Logging**: All operations logged with JWT user context

**Flexible User Resolution**: Configurable JWT claim extraction

### For Testing & Development

Generate test credentials using FastMCP's built-in utilities:

```python
from fastmcp.server.auth.providers.bearer import RSAKeyPair

# Generate test keypair
keypair = RSAKeyPair.generate()
print("Public key:", keypair.public_key)

# Create test token
token = keypair.create_token(
    subject="john.doe",
    issuer="https://test.example.com",
    audience="superset-mcp-api",
    scopes=["dashboard:read", "chart:read", "dataset:read"]
)
print("Test token:", token)
```

### Integration with Identity Providers

This authentication works with any JWT-compatible identity provider:
- **Auth0**: Use your tenant's JWKS URL
- **Okta**: Configure with your Okta domain JWKS endpoint  
- **AWS Cognito**: Use your user pool's JWKS URL
- **Azure AD**: Configure with Microsoft identity platform
- **Custom JWT**: Use your own public key for validation

The MCP service extracts user identity from standard JWT claims and doesn't require complex integration - just valid JWT tokens with appropriate scopes.

## Configuration & Deployment

### Host Configuration
Configure Superset host prefix for proper URL generation:
```python
# In superset_config.py
SUPERSET_HOST_PREFIX = "http://localhost:8088"  # Development
SUPERSET_HOST_PREFIX = "https://superset.company.com"  # Production
```

### Agent Integration Options
1. **Claude Agent SDK**: Create cloud agent connecting to local/deployed MCP service
2. **LangChain Toolkit**: Use `langchain-mcp` for chatbot integration
3. **Direct MCP Connection**: Connect any MCP-compatible client to service

## Future Milestones

### 🔒 Enterprise Security (Future Phase)
- **Advanced Security Hooks**: Tool poisoning attack prevention and rate limiting
- **Comprehensive Audit Logging**: Enhanced logging and monitoring for enterprise environments
- **RBAC Extensions**: Advanced permission models and user role management
- **Multi-tenant Support**: Isolated environments for enterprise deployments

### 📊 Advanced Analytics (Future Phase)
- **Smart Cache Management**: Intelligent caching strategies with force refresh capabilities
- **Dashboard Creation**: Automated dashboard generation with multiple related charts
- **Advanced Chart Types**: Support for complex visualizations (maps, 3D, custom viz)
- **Business Intelligence**: Natural language to SQL query generation
- **End-to-End Testing**: Synthetic environments with example database integration

### Recent Major Improvements
- **Configurable Auth Factory**: Production-ready JWT authentication following Superset patterns
- **Professional Code Quality**: Comprehensive refactoring with 149 passing unit tests
- **Request Schema Pattern**: Structured request objects eliminating LLM parameter validation issues
- **Multi-identifier Support**: ID, UUID, and slug lookups across all tools
- **Enhanced Testing**: Full test coverage with proper mocking and integration patterns
