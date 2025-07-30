# Superset MCP Service

The Superset Model Context Protocol (MCP) service provides a modular, schema-driven interface for programmatic access to Superset dashboards, charts, datasets, and instance metadata. It is designed for LLM agents and automation tools, and is built on the FastMCP protocol.

**✅ Phase 1 Complete (95% done). Core functionality stable, authentication production-ready, comprehensive testing coverage.**

## 🚀 Quickstart

### 1. Install Requirements

```bash
uv pip install -r requirements/development.txt
uv pip install -e .
source .venv/bin/activate
```

### 2. Install Browser Dependencies (for chart screenshots)

The chart preview functionality requires Firefox and geckodriver:

**macOS:**
```bash
# Install Firefox (if not already installed)
brew install --cask firefox

# Install geckodriver
brew install geckodriver
```

**Ubuntu/Debian:**
```bash
# Install Firefox
sudo apt-get update
sudo apt-get install firefox

# Install geckodriver
sudo apt-get install firefox-geckodriver
```

**Manual Installation:**
- Download Firefox from https://www.mozilla.org/firefox/
- Download geckodriver from https://github.com/mozilla/geckodriver/releases
- Add geckodriver to your PATH

### 3. Run the MCP Service

```bash
superset mcp run --port 5008 --debug --sql-debug
```

### 4. Test Your Setup

Run the unit and integration tests to verify your environment:

```bash
pytest tests/unit_tests/mcp_service/ --maxfail=1 -v
# For integration tests:
python tests/integration_tests/mcp_service/run_mcp_tests.py
```

## Available Tools

All tools are modular, strongly typed, and use Pydantic v2 schemas. Every field is documented for LLM/OpenAPI compatibility.

### 📊 Dashboard Tools
- **`list_dashboards`** - Advanced filtering, search, pagination with UUID and slug support and metadata caching
- **`get_dashboard_info`** - Supports ID, UUID, and slug lookups with detailed metadata and cache control
- **`get_dashboard_available_filters`** - Dynamic filter discovery for dashboard queries
- **`generate_dashboard`** - ✨ **NEW**: Create dashboards with multiple charts and automatic layout
- **`add_chart_to_existing_dashboard`** - ✨ **NEW**: Add charts to existing dashboards with smart positioning

### 📈 Chart Tools  
- **`list_charts`** - Advanced filtering, search, pagination with UUID support and metadata caching
- **`get_chart_info`** - Supports ID and UUID lookups with full chart metadata
- **`get_chart_available_filters`** - Dynamic filter discovery for chart queries
- **`generate_chart`** - Chart creation supporting 5 types with cache control
- **`update_chart`** - ✨ **NEW**: Update existing saved charts with new configuration and cache control
- **`update_chart_preview`** - ✨ **NEW**: Update cached chart previews without saving
- **`get_chart_data`** - ✨ **NEW**: Retrieve chart data in multiple formats with advanced cache control and status reporting
- **`get_chart_preview`** - ✨ **NEW**: Generate chart previews with cache control

### 🗂️ Dataset Tools
- **`list_datasets`** - Advanced filtering, search, pagination with UUID support + columns/metrics and metadata caching
- **`get_dataset_info`** - Supports ID and UUID lookups with columns/metrics metadata and cache control
- **`get_dataset_available_filters`** - Dynamic filter discovery for dataset queries

### 🖥️ System Tools
- **`get_superset_instance_info`** - Instance statistics including version, tools, and auth status with system-level metadata caching
- **`generate_explore_link`** - Generate Superset explore URLs with pre-configured chart settings

### 🧪 SQL Lab Tools
- **`open_sql_lab_with_context`** - ✨ **NEW**: Open SQL Lab with pre-selected database, schema, and SQL

### 🔧 Navigation & Workflow Tools
All tools now support seamless navigation between Superset interfaces with proper URL generation and context preservation.

## Available Operations

The MCP service currently provides the following operations:

### ✅ Read Operations (Available for all entities)
- **List**: Get paginated lists with filtering and search
- **Get Info**: Retrieve detailed information by ID, UUID, or slug
- **Get Filters**: Discover available filter columns and operators

### ✅ Create Operations (Limited availability)
- **Charts**: Create new charts with 5 visualization types
- **Dashboards**: Generate new dashboards with automatic layout
- **Add to Dashboard**: Add existing charts to dashboards

### ✅ Update Operations (Limited availability)
- **Charts**: Update saved charts and cached chart previews

### ❌ Not Yet Available
- **Update**: No update operations for dashboards or datasets
- **Delete**: No delete operations for any entity
- **Execute**: SQL Lab opens sessions but doesn't execute queries

This reflects Phase 1 focus on read operations and essential creation capabilities.

See the architecture doc for full tool signatures and usage examples.

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

The `generate_chart` tool supports chart creation with:

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
request = GenerateChartRequest(dataset_id="1", config=config)

# Create a table chart
table_config = TableChartConfig(
    chart_type="table",
    columns=[
        ColumnRef(name="region", label="Region"),
        ColumnRef(name="sales", label="Sales")
    ]
)
table_request = GenerateChartRequest(dataset_id="1", config=table_config)
```

## Dashboard Generation & Management

New dashboard management tools provide dashboard creation and chart addition capabilities:

### Dashboard Creation
```python
# Generate a dashboard with multiple charts
generate_dashboard(request={
    "chart_ids": [1, 2, 3, 4],
    "dashboard_title": "Sales Analytics Dashboard",
    "description": "Sales performance metrics dashboard",
    "published": True
})
```

### Chart Addition to Existing Dashboards
```python
# Add a chart to an existing dashboard
add_chart_to_existing_dashboard(request={
    "dashboard_id": 123,
    "chart_id": 456,
    "target_tab": "Overview"  # Optional
})
```

## SQL Lab Integration

Direct integration with Superset's SQL Lab for seamless development workflows:

```python
# Open SQL Lab with context
open_sql_lab_with_context(request={
    "database_connection_id": 1,
    "schema": "public",
    "dataset_in_context": "sales_data",
    "sql": "SELECT * FROM sales_data WHERE region = 'US'",
    "title": "US Sales Analysis"
})
```

**Features:**
- Pre-selected database and schema
- Contextual SQL templates
- Dataset-aware query generation
- Proper URL parameter handling (`dbid` for compatibility)

## Chart Data & Preview System

Advanced chart preview and data extraction capabilities:

### Chart Data Retrieval
```python
# Get chart data in multiple formats
get_chart_data(request={
    "identifier": "chart-uuid-or-id",
    "format": "json",  # json, csv, excel
    "row_count": 1000,
    "row_offset": 0
})
```

### Chart Preview Generation
```python
# Generate chart previews  
get_chart_preview(request={
    "identifier": "chart-uuid-or-id",
    "format": "url",  # url, base64, ascii, table
    "width": 800,
    "height": 600
})
```

**Preview Formats:**
- **URL**: Screenshot URLs served by MCP service
- **Base64**: Embedded image data for direct display  
- **ASCII**: Text-based charts for terminal/chat display
- **Table**: Structured data representation

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
| **[Implement Chart Creation Mutation](https://app.shortcut.com/preset-ext/story/90304)** | 🟡 In Review | `generate_chart` tool supporting 5 chart types |
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
| `generate_chart` | `chart:write` |
| `list_datasets`, `get_dataset_info` | `dataset:read` |
| `get_superset_instance_info` | `instance:read` |

**MCP Audit Logging**: All operations logged with MCP-specific context including impersonation tracking, source identification, and sanitized payloads

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

## MCP Audit Logging

The MCP service implements comprehensive audit logging to distinguish MCP requests from regular user requests in audit trails:

### Required Context Fields
- **`log_source`**: Always set to "mcp" to identify MCP requests
- **`impersonation`**: Username of the authenticated user making the MCP request
- **`mcp_tool`**: Name of the specific MCP tool being executed

### Optional Enhanced Fields
- **`model_info`**: LLM model information from User-Agent header
- **`session_info`**: Session tracking from X-Session-ID header  
- **`whitelisted_payload`**: Sanitized tool parameters (sensitive data redacted)

### Payload Sanitization
- **Sensitive keys redacted**: password, token, secret, key, auth fields
- **Large content truncated**: Strings over 1000 characters truncated
- **Security-first approach**: Better to over-redact than expose sensitive data

### Usage
All MCP tools automatically include audit context via the `@mcp_auth_hook` decorator:

```python
@mcp.tool
@mcp_auth_hook  # Automatically adds MCP audit context
def my_tool(request: MyRequest) -> Dict[str, Any]:
    # Tool implementation
    pass
```

This enables enterprise audit compliance and helps distinguish automated MCP requests from interactive user sessions.

## Cache Control & Performance

The MCP service provides comprehensive cache control that leverages Superset's existing cache infrastructure for optimal performance:

### Superset Cache Layers

Superset has multiple cache layers that the MCP service leverages:
1. **Query Result Cache** - Caches actual query results from customer databases
2. **Metadata Cache** - Caches table schemas, column info, etc.
3. **Form Data Cache** - Caches chart configurations for explore URLs  
4. **Dashboard Cache** - Caches rendered dashboard components

### Cache Control Parameters

All MCP tools support cache control through request parameters:

#### Query Cache Control
For tools that execute SQL queries (`get_chart_data`, `get_chart_data_cached`, `generate_chart`, `update_chart`):

```python
{
  "use_cache": true,           # Whether to use Superset's cache layers
  "force_refresh": false,      # Force refresh cached data
  "cache_timeout": 3600        # Override cache timeout for this query (seconds)
}
```

#### Metadata Cache Control  
For tools that fetch metadata (`list_dashboards`, `list_charts`, `list_datasets`, `get_*_info`):

```python
{
  "use_cache": true,           # Whether to use metadata cache
  "refresh_metadata": false    # Force refresh metadata for datasets/tables
}
```

#### Form Data Cache Control
For tools that work with chart configurations (`generate_explore_link`, `update_chart_preview`):

```python
{
  "cache_form_data": true      # Whether to cache form data configurations
}
```

### Cache Status Information

Tools return detailed cache status to help understand data freshness:

```python
{
  "cache_status": {
    "cache_hit": true,           # Whether data was served from cache
    "cache_type": "query",       # Type of cache used (query, metadata, form_data)
    "cache_age_seconds": 300,    # Age of cached data in seconds
    "refreshed": false           # Whether cache was refreshed in this request
  }
}
```

### Usage Examples

```python
# Get fresh data, bypassing cache
get_chart_data({
  "identifier": 123,
  "use_cache": false,
  "force_refresh": true
})

# Use cache but with custom timeout
get_chart_data({
  "identifier": 123,
  "cache_timeout": 1800,  # 30 minutes
  "use_cache": true
})

# Refresh metadata for datasets
list_datasets({
  "refresh_metadata": true,
  "use_cache": false
})

# Fast metadata queries from cache
list_charts({
  "use_cache": true,
  "refresh_metadata": false
})
```

### Performance Benefits

- **Faster Response Times**: Cached queries return instantly without database execution
- **Reduced Database Load**: Identical queries hit cache regardless of how they were created (UI vs MCP)  
- **Smart Cache Keys**: Cache based on query hash, so identical SQL queries share cache entries
- **Configurable TTL**: Per-dataset and global cache timeout configuration
- **Cache Transparency**: Clear cache status reporting helps users understand data freshness

### Cache Iteration Support

Chart iterations can effectively utilize the cache layer:
- When you modify a chart through MCP tools, if the underlying SQL query hasn't changed (same metrics, filters, time range), Superset serves from its query result cache
- The cache key is based on query hash, so identical queries hit the cache regardless of how they were created (UI vs MCP)
- This enables rapid chart iteration and preview generation

## Configuration & Deployment

### URL Configuration
The MCP service now uses centralized URL configuration for consistency across all tools:

```python
# In superset_config.py
SUPERSET_WEBSERVER_ADDRESS = "http://localhost:8088"  # Development
SUPERSET_WEBSERVER_ADDRESS = "https://superset.company.com"  # Production
```

**Key Features:**
- **Centralized URL management**: All tools use `get_superset_base_url()` utility
- **Environment flexibility**: Fallback to `SUPERSET_WEBSERVER_SCHEME`/`SUPERSET_WEBSERVER_HOST`/`SUPERSET_WEBSERVER_PORT`
- **Screenshot service integration**: MCP service serves screenshots on same port as WSGI endpoint
- **Configuration hierarchy**: `SUPERSET_WEBSERVER_ADDRESS` → component URLs → localhost:8088 fallback

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

## Recent Major Improvements

### 🔧 **BaseDAO Type Safety & Performance**
- **UUID Type Conversion**: Centralized `_convert_value_for_column()` method for type-safe UUID handling
- **Flexible Column Support**: Enhanced `find_by_id()` and `find_by_ids()` with customizable column lookups
- **Test Coverage**: 185+ passing unit tests including edge cases and error scenarios
- **Code Quality**: Eliminated code duplication and hardcoded string checks

### 🚀 **MCP Service Consistency & Reliability**
- **Async Pattern Cleanup**: Removed unnecessary async declarations for better performance  
- **SQL Lab Integration**: Fixed parameter naming (`dbid`) for proper frontend compatibility
- **Error Handling**: Robust UUID conversion with graceful fallbacks for malformed data
- **Type Validation**: Enhanced SQLAlchemy column type inspection for safer operations

### 🆕 **New Dashboard & SQL Lab Tools**
- **Dashboard Generation**: Dashboard creation with automatic chart layout
- **Chart Management**: Add charts to existing dashboards with intelligent positioning
- **SQL Lab Context**: Pre-configured SQL Lab sessions with database/schema selection
- **Preview System**: Chart screenshots, ASCII art, and data extraction capabilities

### 📊 **Enhanced Chart & Data Capabilities**  
- **Multi-format Data Export**: JSON, CSV, Excel export with pagination support
- **Preview Generation**: URL screenshots, base64 images, ASCII charts, and table data
- **Smart Layout**: Automatic 2-column dashboard layouts with optimized positioning
- **Context Preservation**: Seamless navigation between Superset interfaces

### 🔒 **Production-Ready Architecture**
- **Configurable Auth Factory**: Enterprise JWT authentication following Superset patterns
- **Request Schema Pattern**: Structured inputs eliminating LLM parameter validation issues  
- **Multi-identifier Support**: ID, UUID, and slug lookups across all tools with type safety
- **Professional Testing**: Integration tests, mocking patterns, and edge case coverage
- **MCP Audit Logging**: Comprehensive audit trails with MCP context, payload sanitization, and impersonation tracking
