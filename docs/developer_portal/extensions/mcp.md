---
title: MCP Integration
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

# MCP Integration

Model Context Protocol (MCP) integration allows extensions to register custom AI agent capabilities that integrate seamlessly with Superset's MCP service. Extensions can provide both **tools** (executable functions) and **prompts** (interactive guidance) that AI agents can discover and use.

## What is MCP?

MCP enables extensions to extend Superset's AI capabilities in two ways:

### MCP Tools
Tools are Python functions that AI agents can call to perform specific tasks. They provide executable functionality that extends Superset's capabilities.

**Examples of MCP tools:**
- Data processing and transformation functions
- Custom analytics calculations
- Integration with external APIs
- Specialized report generation
- Business-specific operations

### MCP Prompts
Prompts provide interactive guidance and context to AI agents. They help agents understand how to better assist users with specific workflows or domain knowledge.

**Examples of MCP prompts:**
- Step-by-step workflow guidance
- Domain-specific context and knowledge
- Interactive troubleshooting assistance
- Template generation helpers
- Best practices recommendations

## Getting Started

## MCP Tools

### Basic Tool Registration

The simplest way to create an MCP tool is using the `@tool` decorator:

```python
from superset_core.mcp import tool

@tool
def hello_world() -> dict:
    """A simple greeting tool."""
    return {"message": "Hello from my extension!"}
```

This creates a tool that AI agents can call by name. The tool name defaults to the function name.

### Decorator Parameters

The `@tool` decorator accepts several optional parameters:

**Parameter details:**
- **`name`**: Tool identifier (AI agents use this to call your tool)
- **`description`**: Explains what the tool does (helps AI agents decide when to use it)
- **`tags`**: Categories for organization and discovery
- **`protect`**: Whether the tool requires user authentication (defaults to `True`)

### Naming Your Tools

For extensions, include your extension ID in tool names to avoid conflicts:

## Complete Example

Here's a more comprehensive example showing best practices:

```python
# backend/mcp_tools.py
import random
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from superset_core.mcp import tool

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

@tool(
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
@tool(
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
2. **Verify decorator**: Ensure `@tool` is correctly applied
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

## MCP Prompts

### Basic Prompt Registration

Create interactive prompts using the `@prompt` decorator:

```python
from superset_core.mcp import prompt
from fastmcp import Context

@prompt("my_extension.workflow_guide")
async def workflow_guide(ctx: Context) -> str:
    """Interactive guide for data analysis workflows."""
    return """
    # Data Analysis Workflow Guide

    Here's a step-by-step approach to effective data analysis in Superset:

    ## 1. Data Discovery
    - Start by exploring your datasets using the dataset browser
    - Check data quality and identify key metrics
    - Look for patterns and relationships in your data

    ## 2. Chart Creation
    - Choose appropriate visualizations for your data types
    - Apply filters to focus on relevant subsets
    - Configure proper aggregations and groupings

    ## 3. Dashboard Assembly
    - Combine related charts into coherent dashboards
    - Use filters and parameters for interactivity
    - Add markdown components for context and explanations

    Would you like guidance on any specific step?
    """
```

### Advanced Prompt Examples

#### Domain-Specific Context

```python
@prompt(
    "sales_extension.sales_analysis_guide",
    title="Sales Analysis Guide",
    description="Specialized guidance for sales data analysis workflows"
)
async def sales_analysis_guide(ctx: Context) -> str:
    """Provides sales-specific analysis guidance and best practices."""
    return """
    # Sales Data Analysis Best Practices

    ## Key Metrics to Track
    - **Revenue Growth**: Month-over-month and year-over-year trends
    - **Conversion Rates**: Lead-to-opportunity-to-close ratios
    - **Customer Lifetime Value**: Total value per customer segment
    - **Sales Cycle Length**: Time from lead to close by product/region

    ## Recommended Chart Types
    - **Time Series**: Revenue trends, seasonal patterns
    - **Funnel Charts**: Conversion analysis across sales stages
    - **Geographic Maps**: Regional performance comparison
    - **Cohort Analysis**: Customer retention and growth patterns

    ## Common Pitfalls to Avoid
    - Don't mix different time granularities without proper context
    - Always normalize for business days when comparing periods
    - Consider external factors (holidays, market events) in analysis
    - Segment by relevant dimensions (product, region, channel)

    ## Next Steps
    1. Identify your primary sales KPIs
    2. Create baseline trend charts for each metric
    3. Build comparative views across segments
    4. Set up automated alerts for significant changes
    """
```

#### Interactive Troubleshooting

```python
@prompt("support_extension.troubleshoot_charts")
async def troubleshoot_charts(ctx: Context) -> str:
    """Interactive troubleshooting assistant for chart issues."""
    return """
    # Chart Troubleshooting Assistant

    Let's diagnose your chart issue step by step:

    ## Common Issues and Solutions

    ### 🚫 No Data Showing
    **Possible causes:**
    - Filters are too restrictive
    - Date range doesn't match your data
    - Database connection issues
    - Missing permissions

    **Check:** Try removing all filters and expanding the date range first.

    ### 📊 Unexpected Aggregation Results
    **Possible causes:**
    - Incorrect grouping dimensions
    - Wrong aggregation function (SUM vs COUNT vs AVG)
    - Data quality issues (duplicates, nulls)
    - Time zone mismatches

    **Check:** Verify your GROUP BY columns and aggregation logic.

    ### 🐌 Slow Performance
    **Possible causes:**
    - Large dataset without proper indexing
    - Complex joins or calculations
    - Missing query optimizations
    - Resource constraints

    **Check:** Simplify the query and add appropriate filters first.

    ## Debug Steps
    1. **Start Simple**: Create a basic count query first
    2. **Add Gradually**: Introduce complexity step by step
    3. **Check SQL**: Review the generated SQL for issues
    4. **Test Data**: Verify with a small sample first

    What specific issue are you experiencing?
    """
```

### Prompt Best Practices

#### Content Structure
- **Use clear headings** and sections for easy navigation
- **Provide actionable steps** rather than just theory
- **Include examples** relevant to the user's domain
- **Offer next steps** to continue the workflow

#### Interactive Design
- **Ask questions** to engage the user
- **Provide options** for different scenarios
- **Reference specific Superset features** by name
- **Link to related tools** when appropriate

#### Context Awareness
```python
@prompt("analytics_extension.context_aware_guide")
async def context_aware_guide(ctx: Context) -> str:
    """Provides guidance based on current user context."""
    # Access user information if available
    user_info = getattr(ctx, 'user', None)

    guidance = """# Personalized Analytics Guide\n\n"""

    if user_info:
        guidance += f"Welcome back! Here's guidance tailored for your role:\n\n"

    guidance += """
    ## Getting Started
    Based on your previous activity, here are recommended next steps:

    1. **Review Recent Dashboards**: Check your most-used dashboards for updates
    2. **Explore New Data**: Look for recently added datasets in your domain
    3. **Share Insights**: Consider sharing successful analyses with your team

    ## Advanced Techniques
    - Set up automated alerts for key metrics
    - Create parameterized dashboards for different audiences
    - Use SQL Lab for complex custom analyses
    """

    return guidance
```

## Combining Tools and Prompts

Extensions can provide both tools and prompts that work together:

```python
# Tool for data processing
@tool("analytics_extension.calculate_metrics")
def calculate_metrics(data: dict) -> dict:
    """Calculate advanced analytics metrics."""
    # Implementation here
    pass

# Prompt that guides users to the tool
@prompt("analytics_extension.metrics_guide")
async def metrics_guide(ctx: Context) -> str:
    """Guide users through advanced metrics calculation."""
    return """
    # Advanced Metrics Calculation

    Use the `calculate_metrics` tool to compute specialized analytics:

    ## Available Metrics
    - Customer Lifetime Value (CLV)
    - Cohort Retention Rates
    - Statistical Significance Tests
    - Predictive Trend Analysis

    ## Usage
    Call the tool with your dataset to get detailed calculations
    and recommendations for visualization approaches.

    Would you like to calculate metrics for your current dataset?
    """
```

## Next Steps

- **[Development](./development)** - Project structure, APIs, and dev workflow
- **[Security](./security)** - Security best practices for extensions
