---
title: MCP Tools
hide_title: true
sidebar_position: 8
version: 1
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# MCP Tools

Model Context Protocol (MCP) tools allow extensions to register custom AI agent capabilities that integrate seamlessly with Superset's MCP service. This enables extensions to provide specialized functionality that AI agents can discover and execute.

## What are MCP Tools?

MCP tools are Python functions that AI agents can call to perform specific tasks. When you create an extension, you can register these tools to extend Superset's capabilities with your custom business logic.

**Examples of MCP tools:**
- Data processing and transformation functions
- Custom analytics calculations  
- Integration with external APIs
- Specialized report generation
- Business-specific operations

## Getting Started

### Basic Tool Registration

The simplest way to create an MCP tool is using the `@mcp_tool` decorator:

```python
from superset_core.mcp import mcp_tool

@mcp_tool()
def hello_world() -> dict:
    """A simple greeting tool."""
    return {"message": "Hello from my extension!"}
```

This creates a tool that AI agents can call by name. The tool name defaults to the function name.

### Decorator Parameters

The `@mcp_tool` decorator accepts several optional parameters:

**Parameter details:**
- **`name`**: Tool identifier (AI agents use this to call your tool)
- **`description`**: Explains what the tool does (helps AI agents decide when to use it)
- **`tags`**: Categories for organization and discovery
- **`auth`**: Whether the tool requires user authentication (defaults to `True`)

### Naming Your Tools

For extensions, include your extension ID in tool names to avoid conflicts:

## Complete Example

Here's a more comprehensive example showing best practices:

```python
# backend/mcp_tools.py
import random
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from superset_core.mcp import mcp_tool

class RandomNumberRequest(BaseModel):
    """Request schema for random number generation."""

    min_value: int = Field(
        description="Minimum value (inclusive) for random number generation",
        ge=-2147483648,
        le=2147483647
    )
    max_value: int = Field(
        description="Maximum value (inclusive) for random number generation",
        ge=-2147483648,
        le=2147483647
    )

@mcp_tool(
    name="example_extension.random_number",
    tags=["extension", "utility", "random", "generator"]
)
def random_number_generator(request: RandomNumberRequest) -> dict:
    """
    Generate a random integer between specified bounds.

    This tool validates input ranges and provides detailed error messages
    for invalid requests.
    """

    # Validate business logic (Pydantic handles type/range validation)
    if request.min_value > request.max_value:
        return {
            "status": "error",
            "error": f"min_value ({request.min_value}) cannot be greater than max_value ({request.max_value})",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    # Generate random number
    result = random.randint(request.min_value, request.max_value)

    return {
        "status": "success",
        "random_number": result,
        "min_value": request.min_value,
        "max_value": request.max_value,
        "range_size": request.max_value - request.min_value + 1,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
```

## Best Practices

### Response Format

Use consistent response structures:

```python
# Success response
{
    "status": "success",
    "result": "your_data_here",
    "timestamp": "2024-01-01T00:00:00Z"
}

# Error response  
{
    "status": "error",
    "error": "Clear error message",
    "timestamp": "2024-01-01T00:00:00Z"
}
```

### Documentation

Write clear descriptions and docstrings:

```python
@mcp_tool(
    name="my_extension.process_data",
    description="Process customer data and generate insights. Requires valid customer ID and date range.",
    tags=["analytics", "customer", "reporting"]
)
def process_data(customer_id: int, start_date: str, end_date: str) -> dict:
    """
    Process customer data for the specified date range.

    This tool analyzes customer behavior patterns and generates
    actionable insights for business decision-making.

    Args:
        customer_id: Unique customer identifier
        start_date: Analysis start date (YYYY-MM-DD format)
        end_date: Analysis end date (YYYY-MM-DD format)

    Returns:
        Dictionary containing analysis results and recommendations
    """
    # Implementation here
    pass
```

### Tool Naming

- **Extension tools**: Use prefixed names like `my_extension.tool_name`
- **Descriptive names**: `calculate_tax_amount` vs `calculate`  
- **Consistent naming**: Follow patterns within your extension

## How AI Agents Use Your Tools

Once registered, AI agents can discover and use your tools automatically:

```
User: "Generate a random number between 1 and 100"
Agent: I'll use the random number generator tool.
→ Calls: example_extension.random_number(min_value=1, max_value=100)
← Returns: {"status": "success", "random_number": 42, ...}
Agent: I generated the number 42 for you.
```

The AI agent sees your tool's:
- **Name**: How to call it
- **Description**: What it does and when to use it  
- **Parameters**: What inputs it expects (from Pydantic schema)
- **Tags**: Categories for discovery

## Troubleshooting

### Tool Not Available to AI Agents

1. **Check extension registration**: Verify your tool module is listed in extension entrypoints
2. **Verify decorator**: Ensure `@mcp_tool` is correctly applied
3. **Extension loading**: Confirm your extension is installed and enabled

### Input Validation Errors

1. **Pydantic models**: Ensure field types match expected inputs
2. **Field constraints**: Check min/max values and string lengths are reasonable  
3. **Required fields**: Verify which parameters are required vs optional

### Runtime Issues

1. **Error handling**: Add try/catch blocks with clear error messages
2. **Response format**: Use consistent status/error/timestamp structure
3. **Testing**: Test your tools with various input scenarios

### Development Tips

1. **Start simple**: Begin with basic tools, add complexity gradually
2. **Test locally**: Use MCP clients (like Claude Desktop) to test your tools  
3. **Clear descriptions**: Write tool descriptions as if explaining to a new user
4. **Meaningful tags**: Use tags that help categorize and discover tools
5. **Error messages**: Provide specific, actionable error messages

## Next Steps

- **[Extension Project Structure](./extension-project-structure)** - Organize larger extensions
- **[Development Mode](./development-mode)** - Faster iteration during development  
- **[Security Implications](./security-implications)** - Security best practices for extensions
