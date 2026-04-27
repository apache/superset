# MCP Service - LLM Agent Guide

This guide helps LLM agents understand the Superset MCP (Model Context Protocol) service architecture and development conventions.

## CRITICAL: Apache License Headers

**EVERY Python file in the MCP service MUST have the Apache Software Foundation license header.**

This includes:
- All `.py` files (tool files, schemas, __init__.py files, etc.)
- **NEVER remove existing license headers during refactoring or edits**
- **ALWAYS add license headers when creating new files**
- **ALWAYS verify license headers are present after editing files**

If you see a file without a license header, ADD IT IMMEDIATELY. If you accidentally remove one during editing, ADD IT BACK.

Use this exact template at the top of EVERY Python file:

```python
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
```

**Note**: LLM instruction files like `CLAUDE.md`, `AGENTS.md`, etc. are excluded from this requirement (listed in `.rat-excludes`) to avoid token overhead, but ALL other Python files require it.

## Architecture Overview

The MCP service provides programmatic access to Superset via the Model Context Protocol, allowing AI assistants to interact with dashboards, charts, datasets, databases, SQL Lab, and instance metadata.

### Key Components

```
superset/mcp_service/
├── app.py                      # FastMCP app factory and tool registration
├── auth.py                     # Authentication, authorization, and RBAC
├── mcp_config.py              # Default configuration
├── mcp_core.py                # Reusable core classes for tools
├── flask_singleton.py         # Flask app singleton for MCP context
├── middleware.py              # FastMCP middleware (logging, errors, size guards)
├── server.py                  # Server startup (streamable-http, multi-pod)
├── jwt_verifier.py            # JWT token validation
├── chart/                     # Chart tools, schemas, prompts, resources
│   ├── schemas.py
│   ├── chart_utils.py
│   ├── preview_utils.py
│   ├── validation.py
│   ├── tool/
│   ├── prompts/
│   └── resources/
├── dashboard/                 # Dashboard tools and schemas
│   ├── schemas.py
│   └── tool/
├── dataset/                   # Dataset tools and schemas
│   ├── schemas.py
│   └── tool/
├── explore/                   # Explore link generation
│   ├── schemas.py
│   └── tool/
├── sql_lab/                   # SQL Lab tools (execute, save, open)
│   ├── schemas.py
│   └── tool/
├── system/                    # System tools (health, instance info, schema)
│   ├── schemas.py
│   ├── tool/
│   ├── prompts/
│   └── resources/
├── common/                    # Shared error schemas
├── commands/                  # MCP-specific command classes
└── utils/                     # Utilities (URL, schema parsing, error builders)
```

### Dependency Injection Architecture

The `@tool` and `@prompt` decorators are defined as stubs in the `superset-core` package (`superset_core.mcp.decorators`). At startup, `app.py` calls `initialize_core_mcp_dependencies()` which replaces these stubs with concrete implementations that register tools/prompts with the FastMCP instance. This avoids circular imports between `superset_core` and `superset`.

**Startup flow**:
1. `app.py` creates the FastMCP `mcp` instance
2. `initialize_core_mcp_dependencies()` injects the real decorator implementations
3. Tool/prompt/resource imports at the bottom of `app.py` trigger registration
4. `server.py` adds middleware and starts the transport

## Critical Convention: Tool, Prompt, and Resource Registration

**IMPORTANT**: When creating new MCP tools, prompts, or resources, you MUST add their imports to `app.py` for auto-registration. Do NOT add them to `server.py` - that approach doesn't work properly.

### How to Add a New Tool

1. **Create the tool file** in the appropriate directory (e.g., `chart/tool/my_new_tool.py`)
2. **Decorate with `@tool`** using the decorator from `superset_core.mcp.decorators`
3. **Export from the module's `__init__.py`** (e.g., `chart/tool/__init__.py`)
4. **Add import to `app.py`** at the bottom of the file where other tools are imported

**Example (read-only tool)**:
```python
# superset/mcp_service/chart/tool/my_new_tool.py
from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger

@tool(
    tags=["core"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="My new tool",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def my_new_tool(request: MyRequest, ctx: Context) -> MyResponse:
    """Tool description for LLMs."""
    await ctx.info("Doing something: param=%s" % (request.param,))
    with event_logger.log_context(action="mcp.my_new_tool"):
        result = do_something()
    return MyResponse(data=result)
```

**Example (mutating tool)**:
```python
@tool(
    tags=["mutate"],
    class_permission_name="Chart",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create something",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_something(request: CreateRequest, ctx: Context) -> CreateResponse:
    """Creates a new resource."""
    ...
```

**Then add to app.py**:
```python
# superset/mcp_service/app.py (at the bottom, after initialize_core_mcp_dependencies())
from superset.mcp_service.chart.tool import (  # noqa: F401, E402
    get_chart_info,
    list_charts,
    my_new_tool,  # ADD YOUR TOOL HERE
)
```

**Why this matters**: Tools register automatically on import via the `@tool` decorator. The import MUST be in `app.py` at the bottom (after `initialize_core_mcp_dependencies()` is called). DO NOT add imports to `server.py`.

### How to Add a New Prompt

1. **Create the prompt file** in the appropriate directory (e.g., `chart/prompts/my_new_prompt.py`)
2. **Decorate with `@prompt`** from `superset_core.mcp.decorators`
3. **Add import to module's `__init__.py`** (e.g., `chart/prompts/__init__.py`)
4. **Ensure module is imported in `app.py`**

**Example**:
```python
# superset/mcp_service/chart/prompts/my_new_prompt.py
from superset_core.mcp.decorators import prompt

@prompt("my_new_prompt")
async def my_new_prompt_handler(
    chart_type: str = "auto", business_goal: str = "exploration"
) -> str:
    """Interactive prompt for doing something."""
    return "Prompt instructions here..."
```

### How to Add a New Resource

Resources use direct FastMCP decorators and **must include `@mcp_auth_hook`** for authentication:

```python
# superset/mcp_service/chart/resources/my_new_resource.py
from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook  # REQUIRED for resources

@mcp.resource("superset://chart/my_resource")
@mcp_auth_hook  # Always add this decorator to resources
def get_my_resource() -> str:
    """Resource description for LLMs."""
    return "Resource data here..."
```

## Tool Development Patterns

### 1. Tool Decorator Parameters

The `@tool` decorator from `superset_core.mcp.decorators` accepts:

- **`tags`**: List of tags (e.g., `["core"]`, `["mutate"]`). Default: `[]`
- **`class_permission_name`**: FAB permission class (e.g., `"Chart"`, `"Dashboard"`). Default: `None`
- **`method_permission_name`**: Permission action (e.g., `"read"`, `"write"`). Default: Auto — `"write"` if `"mutate"` in tags, else `"read"`
- **`protect`**: Enable authentication wrapping. Default: `True`
- **`annotations`**: MCP `ToolAnnotations` object. Default: `None`

**ToolAnnotations** (from `superset_core.mcp.decorators`):
```python
annotations=ToolAnnotations(
    title="Human-readable title",
    readOnlyHint=True,   # Whether tool only reads data
    destructiveHint=False, # Whether tool has destructive side effects
)
```

### 2. Use Core Classes for Reusability

The `mcp_core.py` module provides reusable patterns:

- **`ModelListCore`**: For listing resources with filtering, search, and pagination
  - Used by: `list_charts`, `list_dashboards`, `list_datasets`, `list_databases`
- **`ModelGetInfoCore`**: For getting resource details by ID, UUID, or slug
  - Used by: `get_chart_info`, `get_dashboard_info`, `get_dataset_info`, `get_database_info`
- **`ModelGetSchemaCore`**: For schema discovery (columns, filters, sortable columns)
  - Used by: `get_schema`
- **`InstanceInfoCore`**: For instance statistics and metadata
  - Used by: `get_instance_info`

### 3. Authentication and RBAC

Authentication is handled automatically by the `@tool` decorator (via `mcp_auth_hook` internally). RBAC permission checking uses `class_permission_name` and `method_permission_name`.

```python
from superset_core.mcp.decorators import tool, ToolAnnotations

# Authentication + RBAC enabled (default)
@tool(
    class_permission_name="Chart",  # Checks user has Chart access
)
async def my_tool(request: MyRequest, ctx: Context) -> MyResponse:
    # g.user is set automatically before this runs
    ...

# Public tool (no auth) - use sparingly
@tool(protect=False)
async def health_check(ctx: Context) -> dict:
    return {"status": "healthy"}
```

**Authentication priority order** (in `auth.py`):
1. JWT context (per-request ContextVar from FastMCP)
2. API Key authentication (via FAB SecurityManager)
3. `MCP_DEV_USERNAME` config (development only)
4. `g.user` fallback (set by external middleware)

**`@mcp_auth_hook`** is only used directly on **resources** — tools get auth wrapping from `@tool(protect=True)`.

### 4. Use Pydantic Schemas

**All tool inputs and outputs must be Pydantic models**. Place schemas in `{module}/schemas.py`.

```python
from pydantic import BaseModel, ConfigDict, Field

class MyToolRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    param: str = Field(..., description="Parameter description for LLMs")
    optional_param: str | None = Field(None, description="Optional parameter")

class MyToolResponse(BaseModel):
    result: str = Field(..., description="Result description")
    error: str | None = Field(None, description="Error message if failed")
```

### 5. Follow the DAO Pattern

**Use Superset's DAO (Data Access Object) layer** instead of direct database queries:

```python
from superset.daos.dashboard import DashboardDAO

# GOOD: Use DAO
dashboard = DashboardDAO.find_by_id(dashboard_id)

# BAD: Don't query directly
dashboard = db.session.query(Dashboard).filter_by(id=dashboard_id).first()
```

### 6. Python Type Hints (Python 3.10+ Style)

**CRITICAL**: Always use modern Python 3.10+ union syntax for type hints.

```python
# GOOD - Modern Python 3.10+ syntax
from typing import Any

from pydantic import BaseModel, Field

class MySchema(BaseModel):
    name: str | None = Field(None, description="Optional name")
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

def my_function(
    id: int,
    filters: list[str] | None = None,
) -> MySchema | None:
    pass

# BAD - Old-style (DO NOT USE)
from typing import Optional, List, Dict
name: Optional[str]  # Wrong! Use str | None
tags: List[str]      # Wrong! Use list[str]
```

### 7. Event Logger Instrumentation

**All tool operations should use `event_logger`** for observability:

```python
from superset.extensions import event_logger

@tool(...)
async def my_tool(request: MyRequest, ctx: Context) -> MyResponse:
    with event_logger.log_context(action="mcp.my_tool.step_name"):
        result = do_something()
    return MyResponse(data=result)
```

### 8. Context Logging

Use the FastMCP `Context` object for structured logging within tools:

```python
async def my_tool(request: MyRequest, ctx: Context) -> MyResponse:
    await ctx.info("Starting: param=%s" % (request.param,))
    await ctx.debug("Details: keys=%s" % (sorted(request.model_dump().keys()),))
    await ctx.warning("Something unexpected: %s" % (warning_msg,))
    await ctx.error("Failed: %s" % (str(exc),))
    await ctx.report_progress(1, 5, "Step 1 of 5")
```

### 9. Error Handling

**Pattern**: Catch specific exceptions for known failure modes, use broad `Exception` only as the outermost safety net that re-raises:

```python
from superset.commands.dataset.exceptions import DatasetInvalidError, DatasetCreateFailedError

@tool(...)
async def my_tool(request: MyRequest, ctx: Context) -> MyResponse:
    try:
        # Specific exception handling for known failure modes
        with event_logger.log_context(action="mcp.my_tool"):
            result = SomeCommand(properties).run()
        return MyResponse(data=result)

    except DatasetInvalidError as exc:
        # Return structured error response (don't raise)
        await ctx.error("Validation failed: %s" % (exc.normalized_messages(),))
        return MyResponse(error=str(exc.normalized_messages()))

    except DatasetCreateFailedError as exc:
        await ctx.error("Creation failed: %s" % (str(exc),))
        return MyResponse(error=f"Failed: {exc}")

    except Exception as exc:
        # Outermost safety net: log and re-raise (middleware handles it)
        await ctx.error("Unexpected: %s: %s" % (type(exc).__name__, str(exc)))
        raise
```

### 10. Dataset Validation for Chart Tools

All chart-related tools must validate that the chart's dataset is accessible:

```python
from superset.mcp_service.chart.chart_utils import validate_chart_dataset

validation_result = validate_chart_dataset(chart, check_access=True)
if not validation_result.is_valid:
    await ctx.warning("Dataset not accessible: %s" % (validation_result.error,))
    return ChartError(
        error=validation_result.error or "Chart's dataset is not accessible",
        error_type="DatasetNotAccessible",
    )
```

Used by: `get_chart_info`, `get_chart_preview`, `get_chart_data`, `generate_chart`

### 11. Compile Check for Chart Creation

When creating or saving charts, run a compile check to verify the query executes:

```python
from superset.mcp_service.chart.tool.generate_chart import _compile_chart

compile_result = _compile_chart(form_data, dataset.id)
if not compile_result.success:
    # Delete broken chart, return error
    ...
```

### 12. Flexible Input Parsing

`ModelListCore` handles JSON string vs. native object parsing automatically via utilities in `superset.mcp_service.utils.schema_utils`:

- `parse_json_or_passthrough(value, param_name)` - JSON string or dict
- `parse_json_or_list(value, param_name)` - JSON array, list, or comma-separated string
- `parse_json_or_model(value, model_class, param_name)` - JSON string or dict to Pydantic model
- `parse_json_or_model_list(value, model_class, param_name)` - JSON array to list of Pydantic models

These are used internally by `ModelListCore` for `filters` and `select_columns`. Individual tools using core classes do NOT need to add parsing logic.

## Middleware

The MCP service uses FastMCP middleware (registered in `server.py`):

- **`LoggingMiddleware`**: Logs tool calls with duration, entity IDs, sanitizes sensitive data
- **`GlobalErrorHandlerMiddleware`**: Catches unhandled exceptions, converts to ToolError
- **`StructuredContentStripperMiddleware`**: Strips structuredContent from responses (Claude.ai compatibility)
- **`ResponseSizeGuardMiddleware`**: Prevents oversized responses from crashing clients
- **`ResponseCachingMiddleware`**: Optional response caching (in-memory by default, Redis when store enabled)

Middleware is applied in `server.py` and should NOT be modified in individual tools.

## Configuration

Default configuration is in `mcp_config.py`. Override in `superset_config.py`:

```python
# Authentication
MCP_DEV_USERNAME = None          # Fallback username for dev mode
MCP_AUTH_ENABLED = False         # Enable JWT/API key auth
MCP_AUTH_FACTORY = None          # Custom auth factory function
MCP_JWT_PUBLIC_KEY = None
MCP_JWT_SECRET = None
MCP_JWKS_URI = None
MCP_USER_RESOLVER = None         # Custom function to extract username from JWT

# RBAC
MCP_RBAC_ENABLED = True          # Enable permission checking (default: True)


# Response Caching (optional, uses in-memory store by default; Redis when MCP_STORE_CONFIG enabled)
MCP_CACHE_CONFIG = {
    "enabled": False,
    "list_tools_ttl": 300,
    "call_tool_ttl": 3600,
    "excluded_tools": ["execute_sql", "generate_dashboard"],  # add tools to exclude
}

# Multi-pod Storage (optional, requires Redis)
MCP_STORE_CONFIG = {
    "enabled": False,
    "CACHE_REDIS_URL": None,
    "event_store_ttl": 3600,
}
```

## Testing Conventions

### Test Organization

Tests mirror the MCP service module structure:
```
tests/unit_tests/mcp_service/
├── conftest.py                    # Global fixtures (disable_mcp_rbac)
├── chart/
│   ├── test_chart_utils.py
│   ├── test_chart_schemas.py
│   └── tool/
│       ├── test_list_charts.py
│       ├── test_generate_chart.py
│       └── ...
├── dashboard/tool/
├── dataset/tool/
├── sql_lab/tool/
├── system/tool/
├── test_auth_*.py                 # Auth/RBAC tests
└── test_middleware*.py            # Middleware tests
```

### Async Tool Tests (primary pattern)

```python
from unittest.mock import MagicMock, patch
import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.utils import json

@pytest.fixture
def mcp_server():
    return mcp

@pytest.mark.asyncio
async def test_my_tool_success(mcp_server):
    mock_obj = MagicMock()
    mock_obj.id = 1
    mock_obj.name = "test"

    with patch("superset.daos.chart.ChartDAO.find_by_id", return_value=mock_obj):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "my_tool", {"request": {"id": 1}}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 1
```

### Key Testing Patterns

- **RBAC is disabled globally** via `conftest.py` autouse fixture (`MCP_RBAC_ENABLED = False`)
- **RBAC tests** are separate in `test_auth_rbac.py` with their own `enable_mcp_rbac` fixture
- **Auth is mocked** via `mock_auth` fixture that patches `get_user_from_request`
- **Mock objects** must have all attributes set explicitly (no auto-generation)
- **Patch at the DAO level**: `patch("superset.daos.chart.ChartDAO.find_by_id", ...)`
- **Schema validation tests** are synchronous (no Client needed)

## Common Pitfalls to Avoid

### 1. Forgetting Tool Import in app.py
**Problem**: Tool exists but isn't available to MCP clients.
**Solution**: Add tool import to `app.py` at the bottom (after `initialize_core_mcp_dependencies()`).

### 2. Adding Tool Imports to server.py
**Problem**: Tools won't register properly.
**Solution**: Tool imports MUST be in `app.py`, not `server.py`.

### 3. Wrong Decorator Import Path
**Problem**: Using stale import path.
**Solution**: Use `from superset_core.mcp.decorators import tool, ToolAnnotations` (NOT `superset_core.api.mcp`).

### 4. Missing ToolAnnotations
**Problem**: Tool lacks MCP directory compliance metadata.
**Solution**: Always include `annotations=ToolAnnotations(title=..., readOnlyHint=..., destructiveHint=...)`.

### 5. Using `Optional` Instead of Union Syntax
**Problem**: Old-style `Optional[T]` is not Python 3.10+ style.
**Solution**: Use `T | None` and `list[str]` instead of `Optional[T]` and `List[str]`.

### 6. Direct Database Queries
**Problem**: Bypasses Superset's security and caching layers.
**Solution**: Use DAO classes (ChartDAO, DashboardDAO, DatasetDAO, DatabaseDAO).

### 7. Not Using Core Classes
**Problem**: Duplicating list/get_info logic across tools.
**Solution**: Use `ModelListCore`, `ModelGetInfoCore`, `ModelGetSchemaCore`.

### 8. Missing Apache License Headers
**Problem**: CI fails on license check.
**Solution**: Add ASF license header to all new `.py` files (see template at top of this doc).

### 9. Circular Imports
**Problem**: Importing from `app.py` in tool files causes circular dependencies.
**Solution**: Use `from superset_core.mcp.decorators import tool` for tools/prompts. Only import `from superset.mcp_service.app import mcp` in resource files.

### 10. Missing event_logger Instrumentation
**Problem**: Tool operations are invisible to observability.
**Solution**: Wrap key operations with `event_logger.log_context(action="mcp.tool_name.step")`.

## Quick Checklist for New Tools

- [ ] Created tool file in `{module}/tool/{tool_name}.py`
- [ ] Added ASF license header
- [ ] Used `@tool(tags=[...], class_permission_name="...", annotations=ToolAnnotations(...))` decorator
- [ ] Import: `from superset_core.mcp.decorators import tool, ToolAnnotations`
- [ ] Created Pydantic request/response schemas in `{module}/schemas.py`
- [ ] Used DAO classes instead of direct queries
- [ ] Added `event_logger.log_context()` instrumentation
- [ ] Used `await ctx.info/error/debug()` for context logging
- [ ] Exported from `{module}/tool/__init__.py`
- [ ] Added tool import to `app.py` at the bottom
- [ ] Created async unit tests in `tests/unit_tests/mcp_service/{module}/tool/`
- [ ] Updated `DEFAULT_INSTRUCTIONS` in `app.py` if adding new capability

## Quick Checklist for New Prompts

- [ ] Created prompt file in `{module}/prompts/{prompt_name}.py`
- [ ] Added ASF license header
- [ ] Used `@prompt("prompt_name")` from `superset_core.mcp.decorators`
- [ ] Made function async: `async def prompt_handler(...) -> str`
- [ ] Added import to `{module}/prompts/__init__.py`
- [ ] Verified module import exists in `app.py`

## Quick Checklist for New Resources

- [ ] Created resource file in `{module}/resources/{resource_name}.py`
- [ ] Added ASF license header
- [ ] Used `@mcp.resource("superset://{path}")` decorator
- [ ] Added `@mcp_auth_hook` decorator
- [ ] Added import to `{module}/resources/__init__.py`
- [ ] Verified module import exists in `app.py`

## Getting Help

- Check existing tool implementations for patterns (chart/tool/, dashboard/tool/)
- Review core classes in `mcp_core.py` for reusable functionality
- See `CLAUDE.md` in project root for general Superset development guidelines
- Consult Superset documentation: https://superset.apache.org/docs/
