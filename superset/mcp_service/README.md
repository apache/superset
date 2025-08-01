# Superset MCP Service

The Superset Model Context Protocol (MCP) service provides a modular, schema-driven interface for programmatic access to Superset dashboards, charts, datasets, and instance metadata. It is designed for LLM agents and automation tools, and is built on the FastMCP protocol.

**✅ Phase 1 Complete - Production Ready. Core functionality stable, authentication production-ready, comprehensive testing coverage, optimized dashboard layouts, automated test framework.**

## 🚀 Quickstart

### 1. Install Superset Locally

```bash
# Clone the repository
git clone https://github.com/apache/superset.git
cd superset

# Create virtual environment and install (Python 3.10 or 3.11 required)
make venv
source venv/bin/activate
make install

# Start Superset (in a separate terminal)
source venv/bin/activate
superset run -p 8088 --with-threads --reload --debugger
```

For alternative installation methods, see the [official Superset development guide](https://superset.apache.org/docs/contributing/development).

### 2. Run the MCP Service

The MCP service runs as an HTTP server (not stdout) and requires a proxy for Claude Desktop:

```bash
# In a new terminal, with your virtual environment activated
source venv/bin/activate  # if using make venv
# OR
# pyenv activate superset-mcp  # if using pyenv

# Run the MCP service
superset mcp run --port 5008 --debug
```

The service will start on http://localhost:5008

### 3. Connect to Claude Desktop

Since the MCP service runs on HTTP (not stdout), you need to use the FastMCP proxy:

**Step 1: Configure the existing proxy script**
The proxy script `superset/mcp_service/run_proxy.sh` is already provided. Update the paths in it if needed for your environment.

**Step 2: Configure Claude Desktop**
Add to your Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json):
```json
{
  "mcpServers": {
    "Superset MCP Proxy": {
      "command": "/path/to/your/superset/superset/mcp_service/run_proxy.sh",
      "args": [],
      "env": {}
    }
  }
}
```

**Step 3: Restart Claude Desktop**
- Quit Claude Desktop completely
- Start it again
- The Superset MCP tools should now be available

### 4. Install Browser Dependencies (Optional - for chart screenshots)

The chart preview functionality requires Firefox and geckodriver. See the [Superset documentation](https://superset.apache.org/docs/contributing/development) for installation instructions.

**Quick install on macOS:**
```bash
brew install --cask firefox
brew install geckodriver
```

### 5. Verify Your Setup

**Check that Superset is running:**
```bash
curl http://localhost:8088/health
# Should return {"status": "OK"}
```

**Check that MCP service is running:**
```bash
# Check if the MCP service port is listening
lsof -i :5008
# Should show the superset mcp process listening on port 5008

# Or check the process directly
ps aux | grep "superset mcp"
```

**Test in Claude Desktop:**
- Ask Claude to "list dashboards" or "get superset instance info"
- Claude should be able to use the MCP tools to query your Superset instance

### 6. Run Tests (Optional)

Run the tests to verify your environment:

```bash
# Unit tests
pytest tests/unit_tests/mcp_service/ --maxfail=1 -v

# Integration tests with Anthropic API
cd tests/integration_tests/mcp_service/

# Quick smoke test (2 fixed tests)
python smoke_test.py

# Run markdown test plans
python comprehensive_test_runner.py poc_test.md
python comprehensive_test_runner.py MCP_CHART_TEST_PLAN.md 5  # Run first 5 tests only
```

See the [MCP Integration Test README](../../../tests/integration_tests/mcp_service/README.md) for detailed test automation instructions including ngrok setup for Claude API testing.

## 🌐 Using ModelContextChat.com (Web-based MCP Client)

If you prefer a web-based interface instead of Claude Desktop, you can use ModelContextChat.com to interact with your Superset MCP service. This is particularly useful for quick testing or when you can't install desktop applications.

> ⚠️ **Important**: This setup is intended for development, testing, and sandboxing only. Do not use this configuration for production environments.

### Prerequisites

1. **Running MCP Service**: Ensure your MCP service is running on port 5008
2. **Credit Card**: Required for OpenRouter.com account (not for ModelContextChat.com)
3. **Public Access**: Your MCP port needs to be publicly accessible

### Step-by-Step Setup

#### Step 1: Make Your MCP Port Public (GitHub Codespaces)

If using GitHub Codespaces, you need to make port 5008 public:

1. Open the **PORTS** tab in your Codespace
2. Find port **5008** (MCP Service)
3. Right-click on the port entry
4. Select **Port Visibility** → **Public**
5. Copy the public URL (it will look like `https://fictional-space-123abc-5008.app.github.dev`)

> ⚠️ **Security Note**: This is for development/testing only. Never expose production MCP services publicly. Making ports public exposes your service to the internet without authentication.

#### Step 2: Set Up OpenRouter Account

ModelContextChat.com uses OpenRouter for AI model access:

1. **Create Account**:
   - Visit [OpenRouter.com](https://openrouter.ai)
   - Sign up and verify your email

2. **Add Credits** (OpenRouter only):
   - Navigate to billing section in OpenRouter
   - Add $5-10 in credits (enough for extensive testing)
   - Credits are only needed for OpenRouter, not ModelContextChat.com
   - OpenRouter uses pay-as-you-go pricing

3. **Create API Key**:
   - Go to API Keys section
   - Create a new key with a descriptive name
   - **Copy the key immediately** (won't be shown again)

> 💡 **Why OpenRouter?** It's a reputable service providing access to all major AI models. Your account will be useful beyond this tutorial. The credits you add are used to pay for AI model usage.

#### Step 3: Configure ModelContextChat.com

1. **Open ModelContextChat**:
   - Navigate to [ModelContextChat.com](https://modelcontextchat.com)

2. **Enter API Key**:
   - Paste your OpenRouter API key when prompted
   - The key is stored locally in your browser

3. **Select AI Model**:
   - Choose Claude 3.5 Sonnet (recommended for MCP)
   - Other models work but may have varying MCP support

#### Step 4: Connect to Your MCP Service

1. **Add MCP Connection**:
   - Look for MCP settings or "Add Server" option
   - Enter connection details:
     ```
     Name: Superset MCP
     Server Type: Streamable HTTP
     URL: https://your-codespace-name-5008.app.github.dev/mcp/
     Authentication: None (leave empty)
     ```

   ![Form for adding a new MCP connection in ModelContextChat.com](https://github.com/user-attachments/assets/0571f2f0-b2f9-45d8-927f-bc54891afe97)

   > ⚠️ **Important**:
   > - Set Server Type as **"Streamable HTTP"**
   > - Add `/mcp/` to the end of your URL
   > - No authentication is required for this setup

2. **Verify Connection**:
   - You should see a green "MCP Connected" indicator
   - If not, check that:
     - Port is public
     - URL ends with `/mcp/`
     - Server Type is "Streamable HTTP"

   ![Configured Chat Settings Screenshot after adding the configuration to the MCP Server](https://github.com/user-attachments/assets/35418ff9-a571-4051-b68b-cf88c901bf25)

> 🔒 **Security Warning**: This setup is for development and sandboxing purposes only. Making your port public exposes your MCP server to the internet without authentication. Only work with public/sample data and never expose sensitive information this way. For production use, implement proper authentication, use private networking, and never make ports publicly accessible.

#### Step 5: Start Interacting with Superset

Once connected, try these example queries:

**Basic Information**:
```
"List all dashboards in my Superset instance"
"Show me the charts in the Sales Dashboard"
"What datasets are available?"
```

**Data Exploration**:
```
"What columns are in the flights dataset?"
"Show me charts using the energy_usage table"
"Export data from the COVID Vaccine Dashboard"
```

**Advanced Operations**:
```
"Create a line chart showing monthly revenue"
"Generate an explore link for the customer dataset"
"Run a SQL query: SELECT COUNT(*) FROM flights"
```

![Screenshot of Interacting with a model + MCP in ModelContextChat.com](https://github.com/user-attachments/assets/19a51bbe-7157-4c70-a9e2-218315c2c1d1)

### Troubleshooting ModelContextChat

**Connection Issues**:
- Verify MCP service is running: `curl http://localhost:5008/health`
- Check port is public in Codespaces
- Ensure you're using HTTPS for Codespaces URLs

**No Data Returned**:
- Confirm Superset has sample data loaded
- Check MCP service logs for errors
- Try simpler queries first

**Cost Management**:
- Claude 3.5 Sonnet costs ~$0.01-0.10 per conversation
- Monitor usage in OpenRouter dashboard
- $5-10 credit typically lasts hundreds of interactions

### Alternative: Local Development

For local development without Codespaces:
1. Use ngrok to expose port 5008: `ngrok http 5008`
2. Use the ngrok URL in ModelContextChat
3. Follow the same setup steps above

## Troubleshooting

**If Claude Desktop can't connect:**
1. Ensure both Superset (port 8088) and MCP service (port 5008) are running
2. Check the proxy script has the correct path to your virtual environment
3. Look at Claude Desktop logs: `tail -f ~/Library/Logs/Claude/mcp-server-Superset MCP Proxy.log`
4. Verify the proxy works manually: `./run_proxy.sh` (should show MCP protocol messages)

**If screenshots don't work:**
1. Ensure Firefox and geckodriver are installed and in PATH
2. Check `which geckodriver` returns a valid path
3. Try running Firefox manually to ensure it works

## Available Tools

**16 MCP tools** with Pydantic v2 schemas and comprehensive field documentation for LLM compatibility.

### 📊 Dashboard Tools (5)
- **`list_dashboards`** - List with search/filters/pagination, UUID/slug support
- **`get_dashboard_info`** - Get by ID/UUID/slug with metadata
- **`get_dashboard_available_filters`** - Discover filterable columns
- **`generate_dashboard`** - Create dashboards with multiple charts
- **`add_chart_to_existing_dashboard`** - Add charts to existing dashboards

### 📈 Chart Tools (8)  
- **`list_charts`** - List with search/filters/pagination, UUID support
- **`get_chart_info`** - Get by ID/UUID with full metadata
- **`get_chart_available_filters`** - Discover filterable columns
- **`generate_chart`** - Create charts (table, line, bar, area, scatter)
- **`update_chart`** - Update existing saved charts
- **`update_chart_preview`** - Update cached chart previews
- **`get_chart_data`** - Export data (JSON/CSV/Excel)
- **`get_chart_preview`** - Screenshots, ASCII art, table previews

### 🗂️ Dataset Tools (3)
- **`list_datasets`** - List with columns/metrics, UUID support
- **`get_dataset_info`** - Get by ID/UUID with columns/metrics metadata
- **`get_dataset_available_filters`** - Discover filterable columns

### 🖥️ System Tools (2)
- **`get_superset_instance_info`** - Instance statistics and version info
- **`generate_explore_link`** - Generate chart exploration URLs

### 🧪 SQL Lab Tools (1)
- **`open_sql_lab_with_context`** - Pre-configured SQL Lab sessions

## Available Operations

### ✅ Read Operations (All entities)
- **List**: Paginated lists with filtering, search, and UUID/slug support
- **Get Info**: Detailed information by ID, UUID, or slug
- **Get Filters**: Discover available filter columns and operators
- **Get Data**: Export chart data in multiple formats
- **Get Previews**: Chart screenshots, ASCII art, and table representations

### ✅ Create Operations
- **Charts**: Create charts with 5 visualization types (table, line, bar, area, scatter)
- **Dashboards**: Generate dashboards with multiple charts and automatic layout
- **Add to Dashboard**: Add existing charts to dashboards with smart positioning

### ✅ Update Operations
- **Charts**: Update saved charts and cached chart previews
- **Navigation**: Generate explore links and SQL Lab sessions

### ❌ Not Available (Future phases)
- **Update/Delete**: Dashboard and dataset modifications
- **SQL Execution**: Query execution in SQL Lab (opens sessions only)

## 📖 Complete Documentation

The MCP service is fully documented on the **[official Superset documentation site](https://superset.apache.org/docs/mcp-service/intro)**:

### Quick Access
- **[🚀 MCP Service Overview](https://superset.apache.org/docs/mcp-service/intro)** - Complete introduction and features
- **[📚 API Reference](https://superset.apache.org/docs/mcp-service/api-reference)** - All 16 tools with examples
- **[🔧 Development Guide](https://superset.apache.org/docs/mcp-service/development)** - Adding new tools and architecture
- **[🔐 Authentication](https://superset.apache.org/docs/mcp-service/authentication)** - Production security setup

### By Role
**👩‍💻 Developers & Integrators:** [Overview](https://superset.apache.org/docs/mcp-service/overview) → [API Reference](https://superset.apache.org/docs/mcp-service/api-reference) → [Development Guide](https://superset.apache.org/docs/mcp-service/development)

**🔒 DevOps & Production:** [Authentication](https://superset.apache.org/docs/mcp-service/authentication) → [Architecture](https://superset.apache.org/docs/mcp-service/architecture)

**🏢 Enterprise Teams:** [Preset Integration](https://superset.apache.org/docs/mcp-service/preset-integration)

> 💡 **Local Development?** See the [local docs folder](./docs/) for markdown versions during development.

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

**Label Uniqueness**: All columns and metrics must have unique labels within a chart. Labels are automatically generated from column names and aggregation functions (e.g., "SUM(sales)"), or can be explicitly set using the `label` field. Duplicate labels will be rejected at the schema validation level with clear error messages.

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
- **ASCII**: Enhanced text-based charts with:
  - Horizontal and vertical bar charts with gradient effects
  - Connected line charts with trend analysis (📈 📉 ➡️)
  - Smart table formatting with numeric summaries
  - Professional Unicode box-drawing characters
- **Table**: Structured data representation
- **Vega-Lite**: Interactive chart specifications (v5) with:
  - Support for 13+ chart types (line, bar, area, scatter, pie, etc.)
  - Intelligent data type detection (temporal, quantitative, nominal)
  - Proper field mapping and encoding
  - Interactive tooltips and responsive layouts

## Modular Structure & Best Practices

- Tools are organized by domain: `dashboard/`, `dataset/`, `chart/`, `system/`.
- All input/output is validated with Pydantic v2.
- Shared schemas live in `schemas/`.
- All tool calls are logged and RBAC/auth hooks are pluggable.
- **All tool functions must be decorated with `@mcp.tool` and `@mcp_auth_hook`.**
- **All Superset DAOs, command classes, and most Superset modules must be imported inside the function body, not at the top of the file.** This ensures proper app context and avoids initialization errors.

## Current Status

### ✅ Phase 1 Complete - Production Ready
- **FastMCP Server**: CLI with `superset mcp run`, HTTP service on port 5008
- **Authentication**: Production-ready JWT Bearer with configurable factory pattern
- **16 Core Tools**: All list/info/filter tools, chart creation, dashboard generation
- **Request Schema Pattern**: Eliminates LLM parameter validation issues
- **Cache Control**: Comprehensive control over Superset's existing cache layers
- **Audit Logging**: MCP context tracking with impersonation and payload sanitization
- **Optimized Layouts**: Dashboard layouts based on real Superset patterns for proper chart sizing
- **Testing**: 200+ unit tests with full pre-commit compliance and integration testing

### 🎯 Future Enhancements
- Demo notebooks and interactive examples
- OAuth integration for user impersonation  
- Enhanced chart rendering formats (Vega-Lite, Plotly JSON)
- Advanced security features and tool poisoning prevention

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

## 🧪 Testing & Quality Assurance

### Automated Test Framework

The MCP service includes comprehensive test automation for reliable AI agent interactions:

#### Test Execution Options

All test automation tools are located in the `test_automation/` folder:

1. **Simple Test Runner** (Recommended for quick testing):
   ```bash
   cd superset/mcp_service/test_automation
   ./run_tests_simple.sh
   ```

2. **Full Test Plans**:
   ```bash
   # Run comprehensive chart tests
   ./run_mcp_tests.sh MCP_CHART_TEST_PLAN.md

   # Run with Python script (CI/CD compatible)
   export ANTHROPIC_API_KEY=sk-ant-...
   python run_mcp_tests.py MCP_CHART_TEST_PLAN.md
   ```

3. **GitHub Actions** (Automated CI):
   - Runs automatically on PRs touching MCP service
   - Manual dispatch available for specific test plans
   - Posts results as PR comments

#### Test Plans

Located in `test_automation/`:
- `MCP_CHART_TEST_PLAN.md` - Comprehensive chart tool testing
- `ENTITY_TESTING_PLAN.md` - Entity listing and filtering tests
- Additional plans for dashboards, datasets, and system tools

#### Test Infrastructure

- **Local Testing**: Run against your development instance
- **CI Environment**: PostgreSQL, Redis, and example data
- **GitHub Codespaces**: Pre-configured test environment
- **Reports**: HTML and JSON test reports with pass/fail metrics

See [test_automation/README.md](./test_automation/README.md) for complete testing documentation.

**Note**: Claude CLI has known parameter passing limitations with MCP tools. When using `--dangerously-skip-permissions` or standard patterns, structured request objects may not serialize correctly. Use the Python test runner with Anthropic API for reliable results.

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
- **Optimized Dashboard Layouts**: Based on analysis of real Superset dashboards for proper chart proportions
- **Smart Positioning**: 2-chart rows with 5-unit width for balanced, responsive layouts
- **Context Preservation**: Seamless navigation between Superset interfaces

### 🔒 **Production-Ready Architecture**
- **Configurable Auth Factory**: Enterprise JWT authentication following Superset patterns
- **Request Schema Pattern**: Structured inputs eliminating LLM parameter validation issues  
- **Multi-identifier Support**: ID, UUID, and slug lookups across all tools with type safety
- **Professional Testing**: Integration tests, mocking patterns, and edge case coverage
- **MCP Audit Logging**: Comprehensive audit trails with MCP context, payload sanitization, and impersonation tracking
