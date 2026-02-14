# MCP Service - LLM Agent Guide

This guide helps LLM agents understand the Superset MCP (Model Context Protocol) service architecture and development conventions.

## ⚠️ CRITICAL: Apache License Headers

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

The MCP service provides programmatic access to Superset via the Model Context Protocol, allowing AI assistants to interact with dashboards, charts, datasets, SQL Lab, and instance metadata.

### Key Components

```
superset/mcp_service/
├── app.py                      # FastMCP app factory and tool registration
├── auth.py                     # Authentication and authorization
├── mcp_config.py              # Default configuration
├── mcp_core.py                # Reusable core classes for tools
├── flask_singleton.py         # Flask app singleton for MCP context
├── chart/                     # Chart-related tools
│   ├── schemas.py            # Pydantic schemas for chart responses
│   └── tool/                 # Chart tool implementations
│       ├── __init__.py       # Tool exports
│       ├── list_charts.py
│       └── get_chart_info.py
├── dashboard/                 # Dashboard-related tools
│   ├── schemas.py
│   └── tool/
├── dataset/                   # Dataset-related tools
│   ├── schemas.py
│   └── tool/
└── system/                    # System/instance tools
    ├── schemas.py
    └── tool/
```

## Critical Convention: Tool, Prompt, and Resource Registration

**IMPORTANT**: When creating new MCP tools, prompts, or resources, you MUST add their imports to `app.py` for auto-registration. Do NOT add them to `server.py` - that approach doesn't work properly.

### How to Add a New Tool

1. **Create the tool file** in the appropriate directory (e.g., `chart/tool/my_new_tool.py`)
2. **Decorate with `@mcp.tool`** to register it with FastMCP
3. **Add import to `app.py`** at the bottom of the file where other tools are imported (around line 210-242)

**Example**:
```python
# superset/mcp_service/chart/tool/my_new_tool.py
from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook

@mcp.tool
@mcp_auth_hook
def my_new_tool(param: str) -> dict:
    """Tool description for LLMs."""
    return {"result": "success"}
```

**Then add to app.py**:
```python
# superset/mcp_service/app.py (at the bottom, around line 207-224)
from superset.mcp_service.chart.tool import (  # noqa: F401, E402
    get_chart_info,
    list_charts,
    my_new_tool,  # ADD YOUR TOOL HERE
)
```

**Why this matters**: Tools use `@mcp.tool` decorators and register automatically on import. The import MUST be in `app.py` at the bottom of the file (after the `mcp` instance is created). If you don't import the tool in `app.py`, it won't be available to MCP clients. DO NOT add imports to `server.py` - that file is for running the server only.

### How to Add a New Prompt

1. **Create the prompt file** in the appropriate directory (e.g., `chart/prompts/my_new_prompt.py`)
2. **Decorate with `@mcp.prompt`** to register it with FastMCP
3. **Add import to module's `__init__.py`** (e.g., `chart/prompts/__init__.py`)
4. **Ensure module is imported in `app.py`** (around line 244-253)

**Example**:
```python
# superset/mcp_service/chart/prompts/my_new_prompt.py
from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook

@mcp.prompt("my_new_prompt")
@mcp_auth_hook
async def my_new_prompt_handler(ctx: Context) -> str:
    """Interactive prompt for doing something."""
    return "Prompt instructions here..."
```

**Then add to `chart/prompts/__init__.py`**:
```python
# superset/mcp_service/chart/prompts/__init__.py
from . import create_chart_guided  # existing
from . import my_new_prompt  # ADD YOUR PROMPT HERE
```

**Verify module import exists in `app.py`** (around line 248):
```python
# superset/mcp_service/app.py
from superset.mcp_service.chart import prompts as chart_prompts  # This imports all prompts
```

### How to Add a New Resource

1. **Create the resource file** in the appropriate directory (e.g., `chart/resources/my_new_resource.py`)
2. **Decorate with `@mcp.resource`** to register it with FastMCP
3. **Add import to module's `__init__.py`** (e.g., `chart/resources/__init__.py`)
4. **Ensure module is imported in `app.py`** (around line 244-253)

**Example**:
```python
# superset/mcp_service/chart/resources/my_new_resource.py
from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook

@mcp.resource("superset://chart/my_resource")
@mcp_auth_hook
def get_my_resource() -> str:
    """Resource description for LLMs."""
    return "Resource data here..."
```

**Then add to `chart/resources/__init__.py`**:
```python
# superset/mcp_service/chart/resources/__init__.py
from . import chart_configs  # existing
from . import my_new_resource  # ADD YOUR RESOURCE HERE
```

**Verify module import exists in `app.py`** (around line 249):
```python
# superset/mcp_service/app.py
from superset.mcp_service.chart import resources as chart_resources  # This imports all resources
```

**Why this matters**: Prompts and resources work similarly to tools - they use decorators and register on import. The module-level imports (`chart/prompts/__init__.py`, `chart/resources/__init__.py`) ensure individual files are imported when the module is imported. The `app.py` imports ensure the modules are loaded when the MCP service starts.

## Tool Development Patterns

### 1. Use Core Classes for Reusability

The `mcp_core.py` module provides reusable patterns:

- **`ModelListCore`**: For listing resources (dashboards, charts, datasets)
- **`ModelGetInfoCore`**: For getting resource details by ID/UUID
- **`ModelGetAvailableFiltersCore`**: For retrieving filterable columns

**Example**:
```python
from superset.mcp_service.mcp_core import ModelListCore
from superset.daos.dashboard import DashboardDAO
from superset.mcp_service.dashboard.schemas import DashboardList

list_core = ModelListCore(
    dao_class=DashboardDAO,
    output_schema=DashboardList,
    logger=logger,
)

@mcp.tool
@mcp_auth_hook
def list_dashboards(filters: List[DashboardFilter], page: int = 1) -> DashboardList:
    return list_core.run_tool(filters=filters, page=page, page_size=10)
```

### 2. Always Use Authentication

**Every tool must use `@mcp_auth_hook`** to ensure:
- User authentication from API key (via FAB SecurityManager), JWT, or configured admin user
- Permission checking via FAB RBAC
- Audit logging of tool access

```python
from superset.mcp_service.auth import mcp_auth_hook

@mcp.tool
@mcp_auth_hook  # REQUIRED
def my_tool() -> dict:
    # g.user is set by mcp_auth_hook
    return {"user": g.user.username}
```

### 3. Use Pydantic Schemas

**All tool inputs and outputs must be Pydantic models** for:
- Automatic validation
- LLM-friendly schema generation
- Type safety

**Convention**: Place schemas in `{module}/schemas.py`

```python
from pydantic import BaseModel, Field

class MyToolRequest(BaseModel):
    param: str = Field(..., description="Parameter description for LLMs")

class MyToolResponse(BaseModel):
    result: str = Field(..., description="Result description")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Response timestamp"
    )
```

### 4. Follow the DAO Pattern

**Use Superset's DAO (Data Access Object) layer** instead of direct database queries:

```python
from superset.daos.dashboard import DashboardDAO

# GOOD: Use DAO
dashboard = DashboardDAO.find_by_id(dashboard_id)

# BAD: Don't query directly
dashboard = db.session.query(Dashboard).filter_by(id=dashboard_id).first()
```

### 5. Python Type Hints (Python 3.10+ Style)

**CRITICAL**: Always use modern Python 3.10+ union syntax for type hints.

```python
# GOOD - Modern Python 3.10+ syntax
from typing import List, Dict, Any
from pydantic import BaseModel, Field

class MySchema(BaseModel):
    name: str | None = Field(None, description="Optional name")
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

def my_function(
    id: int,
    filters: List[str] | None = None,
    options: Dict[str, Any] | None = None
) -> MySchema | None:
    pass

# BAD - Old-style Optional (DO NOT USE)
from typing import Optional, List, Dict, Any

class MySchema(BaseModel):
    name: Optional[str] = Field(None, description="Optional name")  # Wrong!

def my_function(
    id: int,
    filters: Optional[List[str]] = None,  # Wrong!
    options: Optional[Dict[str, Any]] = None  # Wrong!
) -> Optional[MySchema]:  # Wrong!
    pass
```

**Key rules:**
- Use `T | None` instead of `Optional[T]`
- Do NOT import `Optional` from typing
- Still import `List`, `Dict`, `Any`, etc. from typing (for now)
- All new code must follow this pattern

### 6. Error Handling

**Use consistent error schemas**:

```python
class MyError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Error timestamp"
    )

@mcp.tool
@mcp_auth_hook
def my_tool(id: int) -> MyResponse:
    try:
        result = process_data(id)
        return MyResponse(data=result)
    except NotFound:
        raise ValueError(f"Resource {id} not found")
```

## Testing Conventions

### Unit Tests

Place unit tests in `tests/unit_tests/mcp_service/{module}/tool/test_{tool_name}.py`

**Test structure**:
```python
from unittest.mock import MagicMock, patch
import pytest

class TestMyTool:
    @pytest.fixture
    def mock_dao(self):
        """Create mock DAO for testing."""
        dao = MagicMock()
        dao.find_by_id.return_value = create_mock_object()
        return dao

    @patch("superset.mcp_service.chart.tool.my_tool.ChartDAO")
    def test_my_tool_success(self, mock_dao_class, mock_dao):
        """Test successful tool execution."""
        mock_dao_class.return_value = mock_dao

        result = my_tool(id=1)

        assert result.data is not None
        mock_dao.find_by_id.assert_called_once_with(1)
```

### Integration Tests

Use Flask test client for integration tests:

```python
def test_tool_with_flask_context(app):
    """Test tool with full Flask app context."""
    with app.app_context():
        result = my_tool(id=1)
        assert result is not None
```

## Common Pitfalls to Avoid

### 1. ❌ Forgetting Tool Import in app.py
**Problem**: Tool exists but isn't available to MCP clients.
**Solution**: Always add tool import to `app.py` (at the bottom) after creating it. Never add to `server.py`.

### 2. ❌ Adding Tool Imports to server.py
**Problem**: Tools won't register properly, causing runtime errors.
**Solution**: Tool imports must be in `app.py` at the bottom of the file, not in `server.py`. The `server.py` file is only for running the server.

### 3. ❌ Missing @mcp_auth_hook Decorator
**Problem**: Tool bypasses authentication and authorization.
**Solution**: Always use `@mcp_auth_hook` on every tool.

### 4. ❌ Using `Optional` Instead of Union Syntax
**Problem**: Old-style Optional[T] is not Python 3.10+ style.
**Solution**: Use `T | None` instead of `Optional[T]` for all type hints.
```python
# GOOD - Modern Python 3.10+ syntax
def my_function(param: str | None = None) -> int | None:
    pass

# BAD - Old-style Optional
from typing import Optional
def my_function(param: Optional[str] = None) -> Optional[int]:
    pass
```

### 5. ❌ Using `any` Types in Schemas
**Problem**: Violates TypeScript modernization goals, no validation.
**Solution**: Use proper Pydantic types with Field descriptions.

### 6. ❌ Direct Database Queries
**Problem**: Bypasses Superset's security and caching layers.
**Solution**: Use DAO classes (ChartDAO, DashboardDAO, etc.).

### 7. ❌ Not Using Core Classes
**Problem**: Duplicating list/get_info/filter logic across tools.
**Solution**: Use ModelListCore, ModelGetInfoCore, ModelGetAvailableFiltersCore.

### 8. ❌ Missing Apache License Headers
**Problem**: CI fails on license check.
**Solution**: Add Apache license header to all new .py files. Use this exact template at the top of every new Python file:

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

**Note**: LLM instruction files like `CLAUDE.md`, `AGENTS.md`, etc. are excluded from this requirement (listed in `.rat-excludes`) to avoid token overhead.

### 9. ❌ Using `@mcp.tool()` with Empty Parentheses
**Problem**: Inconsistent decorator style.
**Solution**: Use `@mcp.tool` without parentheses unless passing arguments.
```python
# GOOD
@mcp.tool
def my_tool():
    pass

# BAD
@mcp.tool()
def my_tool():
    pass
```

### 10. ❌ Circular Imports
**Problem**: Importing `mcp` from `app.py` creates circular dependency.
**Solution**: Import `mcp` at module level in tool files:
```python
# GOOD
from superset.mcp_service.app import mcp

@mcp.tool
def my_tool():
    pass

# BAD - causes circular import
from superset.mcp_service.app import mcp, some_other_function
```

## Configuration

Default configuration is in `mcp_config.py`. Users can override in `superset_config.py`:

```python
# superset_config.py
MCP_ADMIN_USERNAME = "your_admin"
MCP_AUTH_ENABLED = True
MCP_JWT_PUBLIC_KEY = "your_public_key"
```

## Tool Discovery

MCP clients discover tools via:
1. **Tool listing**: All tools with `@mcp.tool` are automatically listed
2. **Schema introspection**: Pydantic schemas generate JSON Schema for LLMs
3. **Instructions**: `DEFAULT_INSTRUCTIONS` in `app.py` documents available tools

## Resources for Learning

- **MCP Specification**: https://modelcontextprotocol.io/
- **FastMCP Documentation**: https://github.com/jlowin/fastmcp
- **Superset DAO Patterns**: See `superset/daos/` for examples
- **Pydantic Documentation**: https://docs.pydantic.dev/

## Quick Checklist for New Tools

- [ ] Created tool file in `{module}/tool/{tool_name}.py`
- [ ] Added `@mcp.tool` decorator
- [ ] Added `@mcp_auth_hook` decorator
- [ ] Created Pydantic request/response schemas in `{module}/schemas.py`
- [ ] Used DAO classes instead of direct queries
- [ ] Added tool import to `app.py` (around line 210-242)
- [ ] Added Apache license header to new files
- [ ] Created unit tests in `tests/unit_tests/mcp_service/{module}/tool/test_{tool_name}.py`
- [ ] Updated `DEFAULT_INSTRUCTIONS` in `app.py` if adding new capability
- [ ] Tested locally with MCP client (e.g., Claude Desktop)

## Quick Checklist for New Prompts

- [ ] Created prompt file in `{module}/prompts/{prompt_name}.py`
- [ ] Added `@mcp.prompt("prompt_name")` decorator
- [ ] Added `@mcp_auth_hook` decorator
- [ ] Made function async: `async def prompt_handler(ctx: Context) -> str`
- [ ] Added import to `{module}/prompts/__init__.py`
- [ ] Verified module import exists in `app.py` (around line 244-253)
- [ ] Added Apache license header to new file
- [ ] Updated `DEFAULT_INSTRUCTIONS` in `app.py` to list the new prompt
- [ ] Tested locally with MCP client (e.g., Claude Desktop)

## Quick Checklist for New Resources

- [ ] Created resource file in `{module}/resources/{resource_name}.py`
- [ ] Added `@mcp.resource("superset://{path}")` decorator with unique URI
- [ ] Added `@mcp_auth_hook` decorator
- [ ] Implemented resource data retrieval logic
- [ ] Added import to `{module}/resources/__init__.py`
- [ ] Verified module import exists in `app.py` (around line 244-253)
- [ ] Added Apache license header to new file
- [ ] Updated `DEFAULT_INSTRUCTIONS` in `app.py` to list the new resource
- [ ] Tested locally with MCP client (e.g., Claude Desktop)

## Getting Help

- Check existing tool implementations for patterns (chart/tool/, dashboard/tool/)
- Review core classes in `mcp_core.py` for reusable functionality
- See `CLAUDE.md` in project root for general Superset development guidelines
- Consult Superset documentation: https://superset.apache.org/docs/
