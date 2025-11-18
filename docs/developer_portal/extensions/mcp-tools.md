---
title: MCP Tools
hide_title: true
sidebar_position: 8
version: 1
---

# MCP Tools

Model Context Protocol (MCP) tools allow extensions to register custom AI agent capabilities that integrate seamlessly with Superset's MCP service. This enables extensions to provide specialized functionality that AI agents can discover and execute.

## Overview

MCP tools are Python functions that can be called by AI agents to perform specific tasks. Extensions can register these tools using the `superset-core` MCP abstractions, making them available to AI agents without requiring changes to the core Superset MCP service.

## Key Concepts

- **Tool Registration**: Extensions use `@register_mcp_tool` to register functions as MCP tools
- **Pydantic Schemas**: Input validation using Pydantic models ensures type safety
- **Namespacing**: Extension tools are prefixed with extension ID to prevent conflicts
- **FastMCP Integration**: Tools integrate directly with Superset's existing FastMCP service

## Creating MCP Tools

### Tool Implementation

Create a Python module in your extension's backend directory with MCP tools:

```python
# backend/mcp_tools.py
import random
from datetime import datetime, timezone

from fastmcp import Context
from pydantic import BaseModel, Field
from superset_core.mcp import register_mcp_tool


class RandomNumberRequest(BaseModel):
    """Request schema for random number generation."""

    min_value: int = Field(
        description="Minimum value (inclusive) for random number generation",
        ge=-2147483648,  # 32-bit int minimum
        le=2147483647    # 32-bit int maximum
    )
    max_value: int = Field(
        description="Maximum value (inclusive) for random number generation",
        ge=-2147483648,
        le=2147483647
    )


@register_mcp_tool(
    name="example_extension.random_number",
    description="Generate a random integer between min and max values (inclusive). Useful for creating test data, sampling, or demonstrations.",
    tags=["extension", "utility", "random", "generator"]
)
async def random_number_generator(ctx: Context, request: RandomNumberRequest) -> dict:
    """
    Generate a random integer between specified bounds.

    Args:
        ctx: FastMCP context for logging
        request: Request object with min_value and max_value

    Returns:
        Dictionary containing the generated random number and metadata
    """
    min_value = request.min_value
    max_value = request.max_value

    await ctx.info(f"Generating random number between {min_value} and {max_value}")

    # Validate business logic (Pydantic handles type/range validation)
    if min_value > max_value:
        error_msg = f"min_value ({min_value}) cannot be greater than max_value ({max_value})"
        await ctx.error(error_msg)
        return {
            "status": "error",
            "error": error_msg,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    # Generate random number
    result = random.randint(min_value, max_value)

    await ctx.info(f"Generated random number: {result}")

    return {
        "status": "success",
        "random_number": result,
        "min_value": min_value,
        "max_value": max_value,
        "range_size": max_value - min_value + 1,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
```

## Tool Design Patterns

### Input Validation

Always use Pydantic models for input validation:

```python
class ToolRequest(BaseModel):
    """Strongly typed request schema."""

    parameter: str = Field(
        description="Clear parameter description",
        min_length=1,
        max_length=100
    )
    optional_param: int = Field(
        default=10,
        description="Optional parameter with default",
        ge=1,
        le=100
    )
```

### Error Handling

Provide structured error responses:

```python
@register_mcp_tool(name="extension.example_tool", description="...", tags=[])
async def example_tool(ctx: Context, request: ToolRequest) -> dict:
    try:
        # Tool logic here
        result = perform_operation(request.parameter)

        await ctx.info(f"Operation completed successfully")

        return {
            "status": "success",
            "result": result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except ValueError as e:
        error_msg = f"Invalid input: {str(e)}"
        await ctx.error(error_msg)
        return {
            "status": "error",
            "error": error_msg,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
```

### Logging

Use the FastMCP context for logging:

```python
await ctx.info("Informational message")
await ctx.warning("Warning message")  
await ctx.error("Error message")
```

## Tool Naming Conventions

- **Prefix with extension ID**: `extension_id.tool_name`
- **Use descriptive names**: `data_processor.clean_dataset` vs `data_processor.clean`
- **Avoid conflicts**: Check existing tool names before registration

## Integration with AI Agents

Once registered, your tools become available to AI agents through the MCP service:

```
Agent: "Generate a random number between 1 and 100"
→ Calls: example_extension.random_number(min_value=1, max_value=100)
← Returns: {"status": "success", "random_number": 42, ...}
```

### Documentation
- **Clear descriptions**: Write helpful tool and parameter descriptions
- **Examples**: Include usage examples in docstrings
- **Tags**: Use meaningful tags for tool discovery

## Troubleshooting

### Tool Not Discovered
- Verify the module is registered in the entrypoints
- Check that `@register_mcp_tool` decorator is applied
- Ensure the extension is properly loaded

### Type Validation Errors
- Confirm Pydantic model fields match tool parameters
- Check that field constraints are reasonable
- Verify required vs optional parameters

### Runtime Errors
- Check FastMCP context usage (`await ctx.info()`)
- Verify async/await patterns are correct
- Ensure proper error handling and logging
