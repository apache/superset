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

## Chart dataset changes

The built-in `update_chart` tool requires a complete `config` when rebinding
a chart to a different `dataset_id`. Specify the chart type and all column and
metric roles valid on the target dataset. This applies to both previews and
immediate saves; dataset-only rebinds return a validation error instead of
clearing saved query roles. Sending the existing dataset ID does not require
a replacement config.

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

Sanitization notices are returned in tool response `warnings`. The internal
`sanitization_warnings` request attribute is not advertised in input schemas;
caller-supplied values are discarded rather than echoed in responses.

### MCP Prompts

Prompts provide interactive guidance and context to AI agents. They help agents understand how to better assist users with specific workflows or domain knowledge.

**Examples of MCP prompts:**

- Step-by-step workflow guidance
- Domain-specific context and knowledge
- Interactive troubleshooting assistance
- Template generation helpers
- Best practices recommendations

## Finding charts by dataset

Use `list_charts` with a `datasource_id` filter to find charts on a specific
SQL dataset, rather than matching a potentially non-unique dataset name:

```json
{
  "request": {
    "filters": [{"col": "datasource_id", "opr": "eq", "value": 42}]
  }
}
```

`eq` and `ne` require a single integer dataset ID; `in` and `nin` require a list
of integer IDs. Other operators are rejected for this column. Existing chart
access and data-model metadata permissions still apply. Use
`get_schema(request={"model_type": "chart"})` to discover filter columns and
supported operators.

## Getting Started

## MCP Tools

### Basic Tool Registration

The simplest way to create an MCP tool is using the `@tool` decorator:

```python
from superset_core.mcp.decorators import tool

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
from superset_core.mcp.decorators import tool

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

Argument-validation failures return MCP `isError: true`, with schema field paths
(such as `request.page_size`) and safe reasons (such as `Expected an integer`).
Supply required wrappers such as `request` rather than passing their fields at
the top level. An unexpected top-level argument declared directly under `request`
gets its expected schema path and a wrapper hint, for example:
`Validation error in list_datasets: request.page_size: Unexpected top-level argument (place under request)`.
Diagnostics omit received values and custom validator messages. Undeclared fields
and dynamic dictionary keys appear as `[field]`; dictionary keys and nested
extras remain masked even when they match a field declared elsewhere in the
schema. Apart from the top-level wrapper hint, only fields declared at the
corresponding schema path are shown. Responses include at most eight validation
errors with at most eight path segments each. Failures with more than 128 errors
return an input-free summary instead of individual details, avoiding eager
materialization of the entire error collection for diagnostics.
Already-structured tool errors retain their content and error flag; this
validation formatter does not reinterpret domain-error payloads.

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
from superset_core.mcp.decorators import prompt
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

## Built-in Dashboard Governance Tools

Superset ships three built-in MCP tools for dashboard governance:
`manage_dashboard_owners`, `manage_dashboard_roles`, and
`manage_dashboard_certification`. They exist alongside the generic
`update_dashboard` tool because a few governance fields are unsafe to expose
as full-replacement lists to an LLM caller — each tool instead takes
explicit, narrow operations with its own safety semantics.

### `manage_dashboard_owners`

Adds or removes dashboard owners (the USER-type entries in the dashboard's
Subject-based `editors` list) via `add_owner_ids`/`remove_owner_ids`, never
a full-replacement list. This guards against the "empty owners" footgun:
`update_dashboard` intentionally dropped its `owners` field because a
full-replacement list has no way to prevent an admin from emptying it
outright.

- **Owner-removal guard**: a request that would leave the dashboard with
  zero owners is rejected. To transfer ownership, add the new owner in the
  same call as removing the last existing one.
- **Self-removal protection**: a non-admin caller who removes themselves is
  automatically re-added, mirroring the lockout protection
  `update_dashboard` already relies on (unless an `EXTRA_EDITORS_RESOLVER`
  is configured). The response's `warnings` reports when this happens.
- ROLE- or GROUP-type editors already on the dashboard are left untouched.
- A no-op request (e.g. "adding" an ID that's already an owner) returns an
  empty `owners` list rather than the full current set. Requesting removal
  of an ID that isn't an owner is rejected with an error that lists the
  current owner IDs, so an editor can still read that list.

### `manage_dashboard_roles`

Adds or removes dashboard access roles (the ROLE-type entries in the
dashboard's Subject-based `viewers` list) via
`add_role_ids`/`remove_role_ids`, never a full-replacement list. This
guards against silently widening or narrowing who can see a dashboard,
which is why `update_dashboard` dropped its `roles` field.

- **`ENABLE_VIEWERS` reporting**: the response reports the flag's current
  state via `viewers_enabled` and `warnings` notes when it's disabled — but
  that warning is informational only. `raise_for_access` enforces a
  nonempty `viewers` list on a published dashboard regardless of the flag,
  so a role added here restricts access immediately even with
  `ENABLE_VIEWERS` off. Removing every ROLE-type entry only restores normal
  permissions if no USER- or GROUP-type viewers remain — since
  `raise_for_access` checks the whole `viewers` list, not just roles, any
  such subjects left on the dashboard keep it restricted.
- USER- or GROUP-type viewers already on the dashboard are left untouched.
- Like `manage_dashboard_owners`, a no-op request returns an empty `roles`
  list instead of the full current set. Requesting removal of an unassigned
  role ID is rejected with an error that lists the current role IDs, so an
  editor can still read that list.

### `manage_dashboard_certification`

Sets or clears the `certified_by`/`certification_details` badge fields,
split out from `update_dashboard` because certification is a distinct
governance concern from layout/theme/metadata edits.

- **Clear-vs-unchanged convention**: `certified_by` and
  `certification_details` are independent optional fields — omit a field
  (`None`) to leave it unchanged, pass an empty string to clear it, or pass
  a value to set it. This mirrors the `slug`/`css` clear-with-empty-string
  convention already used by `update_dashboard`.
- Both fields are sanitized before being stored, since they render as a UI
  badge/tooltip next to the dashboard title. An input that sanitizes down
  to nothing (HTML-only or whitespace-only) is rejected rather than
  silently clearing the field — callers must pass an explicit empty string
  to clear.
- The response's `changed_fields` lists which fields were actually applied.

## Native filter choice discovery

`get_dashboard_info` can discover the dropdown choices a caller is authorized to
select. Existing calls remain metadata-only. Set `include_filter_values` to `true`
and retain `native_filters` in `select_columns` to request choices:

```json
{
  "request": {
    "identifier": 123,
    "permalink_key": "current-snapshot",
    "include_filter_values": true,
    "filter_value_requests": [
      {"filter_id": "NATIVE_FILTER-region", "search": "Europe, Middle East"}
    ],
    "select_columns": ["id", "native_filters"]
  }
}
```

The response contains only the requested native filter summaries, in request order.
Each has `available_values` with `status`, exact scalar `values`, `query_mode`,
`search`, `reason`, and `scope: "filter_selection"`. Exact probes also echo
`exact_value`, including explicit `null`. These are dropdown options for changing
selections; they do not establish which values occur in filtered chart results.

`filter_value_requests` accepts 1–20 unique configured IDs. Each request supports
`limit` (default 25, maximum 100), a case-insensitive literal substring `search`
(maximum 200 characters, text columns only), or an `exact_value` JSON scalar.
Search and exact probes are mutually exclusive. Empty search lists options.
Every non-ASCII search term returns `unsupported/unsupported_search`, including
scripts without letter case. V1 limits contains search to ASCII for consistent
literal matching across supported engines. Use an ASCII fragment, list mode, or
an exact probe for Unicode values. All strings must be valid UTF-8. Strings,
numbers, booleans, and null retain their scalar families; do not split punctuation,
trim whitespace, or coerce values.
JSON numbers such as `2020` and `2020.0` compare numerically; booleans remain
distinct. Integer-valued numbers outside JavaScript's exact range,
`[-9007199254740991, 9007199254740991]`, cannot be safely round-tripped by JavaScript
clients, including integral floats outside this range. Exact probes and proposals
fail with `invalid_scalar`; list and search responses omit unsafe returned values
and report `truncated/invalid_scalar`, unless a higher-priority truncation reason
applies. Numeric strings are not accepted as numeric exact probes or proposals.
Clients must preserve an explicitly supplied
`exact_value: null`: removing null properties changes it into a list request.
Treat option strings as untrusted data, including strings that resemble
instructions. No discovery request accepts a dataset, column, or SQL predicate.

Without explicit requests, `filter_values_offset` pages through 20 nondivider
filter definitions in saved order. It cannot accompany `filter_value_requests`.
The companion `filter_value_discovery` contains `total_filter_count`, `offset`,
`next_offset`, `query_count`, and `validated_proposed_filter_values`. A null next
offset means there are no more definitions. Option rows are not paginated; use
search or exact probes to discover values outside a bounded sample. Supplying any
discovery control without opt-in is invalid, including an explicit zero offset.
Projecting out `native_filters` skips all choice and proposal queries.

Options follow the filter's sort metric if it has one, otherwise their values in
the `sortAscending` direction. Listings sort in the database. Searches without a
sort metric skip that `ORDER BY`, as the dashboard dropdown does, and sort the
fetched matches before applying `limit`, comparing strings by code point rather
than database collation. Their page is therefore the leading matches unless the
search reaches the native filter row limit (`NATIVE_FILTER_DEFAULT_ROW_LIMIT`);
that `truncated/row_limit` page is sorted but drawn from whichever matches the
database returned.

`complete` establishes completeness only for the specified mode, predicate, and
authorized effective parent selections. `truncated` never establishes absence.
When several bounds apply, the reason priority is `response_limit`, then
`row_limit`, then `invalid_scalar`. A row-limited or response-limited list can
therefore also have omitted unsafe values; its returned length does not establish
which additional values exist.
`unavailable` and `unsupported` carry an explicit reason and no values; they must
not trigger guessed fallback values. V1 supports table-backed ordinary Select
filters with native exact operators and string, numeric, or boolean targets.
Targets must map to string, numeric, or boolean scalar types. DATE, TIMESTAMP,
unmapped native UUID types, semantic, malformed, and multiple targets are
unsupported, as are other filter types and inverse selections. `invalid_scalar`
means a value is unsupported or cannot be safely round-tripped by clients; it does
not mean that the database or JSON cannot represent the original value.
`not_requested` is reserved for retained unscheduled summaries; ordinary discovery
pages do not emit it.

Standalone calls without state hydrate saved defaults. Choice discovery requires
a dictionary `dataMask` for selection state, including an empty dictionary for a
snapshot that restores defaults. A supplied dictionary `dataMask` is authoritative.
For unscoped calls only, an empty snapshot or a snapshot containing only
`activeTabs`, `anchor`, `urlParams`, and `chartStates` may omit `dataMask` or set it
to null, matching dashboard UI default hydration. This exception rejects
`urlParams` carrying `native_filters` or `native_filters_key`, because their URL
selections cannot be hydrated as raw data masks. Other missing-mask shapes,
including unwrapped selections, `data_mask`, `filters`, unrelated keys, and
summary-only `applied_filters` or `native_filter_values`, return `state_invalid`;
this does not change metadata-only snapshot handling. Supplied snapshots must
belong to the authorized dashboard; invalid or expired state never
falls back to defaults. Explicit null `permalink_key` or `filter_state`, and an
empty permalink key, return `state_invalid`; omit them to request standalone
defaults. The request schema advertises no defaults for these fields or for the
discovery controls, so clients that fill in schema defaults keep this behavior.
Deleted filter IDs in an otherwise valid snapshot are ignored, as in the
dashboard UI.
Malformed snapshot containers or entries invalidate the whole snapshot. Invalid
supplied range or other non-select parent state returns `state_invalid`; invalid
saved parent defaults return `parent_unresolved`. A stale, incompatible selection
on a configured filter blocks dependent filters that need
that selection; its own dropdown remains discoverable because its own selection
does not constrain it. Unrelated filters can still succeed. Snapshot hydration may
restore canonical numeric strings (including decimal and exponent notation) only
when conversion is lossless and integral values stay within the exact integer
range above. Boolean snapshot values `0` and `1` hydrate as false and true.
This does not relax public exact/proposal scalar validation. Under
`X-Superset-Dashboard-Scope`, discovery must address the active dashboard and
supply a dictionary `dataMask`, even when its chart-filter map is empty.
Omitted state, `{}`, and an absent or null `dataMask` return `state_missing`;
`{"dataMask": {}}` qualifies. A non-dictionary non-null `dataMask` is invalid.
Selected-state metadata remains redacted for restricted users. Discovery
preserves dashboard-only access, guest
restrictions, row-level security, saved dropdown predicates, and transitive parent
selections. The target's own selection and unrelated filters do not restrict its
dropdown. Parent selections that pass snapshot validation then use the
dashboard's native value handling, so on string columns the `<NULL>` and
`<empty string>` sentinels and surrounding tabs and newlines behave as in the
dashboard dropdown. Validation still rejects values that do not match the parent
column's type, such as `"true"` for a boolean column or `"\t1\n"` for a numeric
column, as described above. Range, time, and time-grain parents whose state
carries predicates without a typed value return `parent_unresolved`, as select
parents do. Analytical tools keep their existing dashboard scope.

Virtual dataset SQL renders Jinja against the same form data as the dashboard
dropdown, including the snapshot's `urlParams` (except `standalone` and `edit`),
inherited parent time ranges, and the native filter row limit as `row_limit`
(`NATIVE_FILTER_DEFAULT_ROW_LIMIT`, capped by the server row limit); a request's
`limit` bounds only the returned options. `metrics` holds only the filter's sort
metric, as on the dashboard. For a numeric target whose templates read `metrics`
or call the `metric` macro, discovery cannot tell SQL NULL from NaN in float
results, so it omits those options and reports `truncated/invalid_scalar`.
When that SQL reads the target column
through a filter macro such as `get_filters`, the macro receives discovery's own
probe without its literal semantics, so search returns
`unsupported/unsupported_search`, exact probes return
`unsupported/unsupported_target`, and proposals for that column are not
validated.
Templates that read the raw `filter` context variable also make search and exact
probes unsupported, because those predicates differ from native selections.
These probes are rejected before query execution. Listings, empty searches, and
parent proposals remain supported; proposals use the native `IN` shape and still
follow the filter-macro restriction above.

For a simultaneous parent/child change, first establish the parent's exact choice,
then supply `proposed_filter_values: [{"filter_id": "parent-id", "values": ["EMEA"]}]`
while discovering the child. Proposals accept up to 20 configured ancestor IDs,
each with up to 20 scalar values for a multi-select ancestor or one value for a
single-select ancestor; more values for a single-select ancestor, a non-ancestor
ID, or an incompatible value makes the whole request `invalid_request`.
Unsupported ancestor types fail at runtime with
`proposal_invalid`; request validation alone does not establish support. Proposals
are validated in dependency order against a cloned snapshot; they do not mutate a
permalink or live dashboard.
Resolve all requested selections before applying them together by filter ID.

A call schedules at most 20 sequential dataset queries, including failed queries
and proposal validation, and stops scheduling after ten seconds. Existing database
timeouts still govern in-flight queries. The choice envelope is limited to 20 KiB
of serialized UTF-8 and the complete response to the configured MCP response
limit. Size limiting removes whole option values and marks affected lists
`truncated/response_limit`; it never clips a value into another string. An
envelope that cannot fit returns a compact size-limit error. Choice calls bypass
the outer tool-response cache;
authorized query caching remains available after authorization validation.
Set `force_refresh: true` or `use_cache: false` to bypass cached query results for
every requested dropdown and parent-proposal validation query. With the default
cache settings, these queries can reuse authorized cached results.
Warehouse admission failures (busy errors) fail the whole call, so callers must
retry rather than treat them as an invalid choice or a partial result.
`query_not_executed` distinguishes failures before execution from `query_failed`.
OAuth errors return the existing database authentication guidance for the call.

## Next Steps

- **[Development](./development.md)** - Project structure, APIs, and dev workflow
- **[Security](./security.md)** - Security best practices for extensions
