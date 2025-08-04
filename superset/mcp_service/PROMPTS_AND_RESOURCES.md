# MCP Prompts and Resources

Superset MCP now includes **Prompts** and **Resources** to enhance LLM interactions:

## Available Prompts

### `superset_quickstart`
**Location**: `system/prompts.py`  
**Purpose**: Interactive onboarding for new users

```
User: "I'm new to Superset, help me get started"
LLM: [Activates superset_quickstart prompt with personalized guidance]
```

**Parameters**:
- `user_type`: "analyst", "executive", or "developer"
- `focus_area`: "sales", "marketing", "operations", or "general"

### `create_chart_guided`
**Location**: `chart/prompts.py`  
**Purpose**: Step-by-step chart creation guidance

```
User: "Help me create a sales trend chart"
LLM: [Activates create_chart_guided prompt with visualization best practices]
```

**Parameters**:
- `chart_type`: "auto", "line", "bar", "pie", "table", etc.
- `business_goal`: "exploration", "reporting", "monitoring", "presentation"

## Available Resources

### `superset://instance/metadata`
**Location**: `system/resources.py`  
**Purpose**: Instance statistics and configuration

**Provides**:
- Dataset, dashboard, chart counts
- Popular datasets and dashboards
- Available chart types
- Database engines
- Feature flags
- Sample queries and tips

### `superset://chart/templates`
**Location**: `chart/resources.py`  
**Purpose**: Chart templates and best practices

**Provides**:
- Pre-configured chart settings
- Color schemes
- Performance optimization tips  
- Chart selection guidance

## Architecture

Follows existing MCP service structure:
```
superset/mcp_service/
├── system/
│   ├── prompts.py        # System-level prompts
│   ├── resources.py      # Instance metadata
│   └── tool/            # Existing tools
├── chart/
│   ├── prompts.py        # Chart creation prompts  
│   ├── resources.py      # Chart templates
│   └── tool/            # Existing chart tools
└── dashboard/           # Future: dashboard prompts/resources
    └── sql_lab/         # Future: SQL prompts/resources
```

## Registration Pattern

Uses the same decorator pattern as tools:

```python
from superset.mcp_service.mcp_app import mcp

@mcp.prompt("prompt_name")
async def my_prompt(param: str = "default") -> str:
    return "Prompt response..."

@mcp.resource("superset://domain/resource")
async def my_resource() -> str:
    return json.dumps(data)
```

Auto-registered via imports in `mcp_app.py`:
```python
import superset.mcp_service.system.prompts   # noqa: F401, E402
import superset.mcp_service.chart.resources  # noqa: F401, E402
```

## Testing

Test with MCP Inspector:
```bash
npx mcp-inspector run --transport streamable-http --url http://localhost:5008

# Check "Prompts" and "Resources" tabs
```

Or via Claude Desktop - prompts activate automatically based on user queries.
