# Superset MCP Service: Tool Schemas Reference

This document provides a reference for the input and output schemas of all MCP tools in the Superset MCP service. All schemas are Pydantic v2 models with field descriptions for LLM/OpenAPI compatibility.

**Status**: Phase 1 Complete (95% done). All core schemas stable and production-ready with extensive testing coverage.

## FastMCP Complex Inputs Pattern

All MCP tools use **structured request objects** instead of individual parameters to eliminate LLM validation issues:

```python
# All list tools use request objects
list_dashboards(request=ListDashboardsRequest(...))
list_datasets(request=ListDatasetsRequest(...))
list_charts(request=ListChartsRequest(...))

# All get_info tools use request objects with multi-identifier support
get_dashboard_info(request=GetDashboardInfoRequest(identifier="123"))  # ID
get_dashboard_info(request=GetDashboardInfoRequest(identifier="uuid-string"))  # UUID
get_dashboard_info(request=GetDashboardInfoRequest(identifier="slug-string"))  # Slug

# Chart creation with detailed config
generate_chart(request=GenerateChartRequest(
    dataset_id="1",
    config=XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="date"),
        y=[ColumnRef(name="sales", aggregate="SUM")],
        kind="line"
    )
))
```

### Key Benefits
- **No parameter ambiguity**: Filters are always arrays, never strings
- **Clear validation**: Cannot use both search and filters simultaneously
- **Multi-identifier support**: ID, UUID, and slug (where applicable) in single interface
- **LLM-friendly**: Unambiguous types prevent common LLM validation errors
- **Production-ready**: 185+ unit tests ensure schema reliability

## Cache Control Schemas

All MCP tools support cache control through schema inheritance:

### CacheControlMixin
Base mixin for all cache control:
- `use_cache`: `bool = True` — Whether to use Superset's cache layers
- `force_refresh`: `bool = False` — Whether to force refresh cached data

### QueryCacheControl
For tools that execute SQL queries (`get_chart_data`, `generate_chart`, `update_chart`):
- Inherits: `CacheControlMixin`
- `cache_timeout`: `Optional[int]` — Override cache timeout for this query (seconds)

### MetadataCacheControl  
For tools that fetch metadata (`list_*`, `get_*_info` tools):
- Inherits: `CacheControlMixin`
- `refresh_metadata`: `bool = False` — Force refresh metadata from database

### FormDataCacheControl
For tools working with chart configurations (`generate_explore_link`, `update_chart_preview`):
- Inherits: `CacheControlMixin`
- `cache_form_data`: `bool = True` — Whether to cache form data configurations

### CacheStatus
Returned by tools to indicate cache usage:
- `cache_hit`: `bool` — Whether data was served from cache
- `cache_type`: `Literal["query", "metadata", "form_data", "none"]` — Type of cache used
- `cache_age_seconds`: `Optional[int]` — Age of cached data in seconds
- `refreshed`: `bool` — Whether cache was refreshed in this request

## Dashboards

### list_dashboards

**Input:** `ListDashboardsRequest` (inherits `MetadataCacheControl`)
- `filters`: `List[DashboardFilter]` — List of filter objects (cannot be used with search)
- `search`: `Optional[str]` — Free-text search string (cannot be used with filters)
- `select_columns`: `List[str]` — Columns to select (defaults include id, dashboard_title, slug, uuid)
- `order_column`: `Optional[str]` — Column to order results by (valid: id, dashboard_title, slug, published, changed_on, created_on)
- `order_direction`: `Optional[Literal['asc', 'desc']]` — Order direction
- `page`: `int` — Page number (0-based)
- `page_size`: `int` — Number of items per page (default 100)
- `use_cache`: `bool = True` — Whether to use metadata cache
- `refresh_metadata`: `bool = False` — Force refresh metadata from database

**Returns:** `DashboardList`
- `dashboards`: `List[DashboardListItem]`
- `count`: `int`
- `total_count`: `int`
- `page`: `int`
- `page_size`: `int`
- `total_pages`: `int`
- `has_previous`: `bool`
- `has_next`: `bool`
- `columns_requested`: `List[str]`
- `columns_loaded`: `List[str]`
- `filters_applied`: `List[Any]`
- `pagination`: `PaginationInfo`
- `timestamp`: `datetime`

### get_dashboard_info

**Input:** `GetDashboardInfoRequest`
- `identifier`: `int | str` — Dashboard identifier (supports ID, UUID, or slug)

**Returns:** `DashboardInfo` or `DashboardError`

**Multi-Identifier Support:**
- **ID**: Numeric dashboard ID (e.g., `123`)
- **UUID**: Dashboard UUID string (e.g., `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`)
- **Slug**: Dashboard slug string (e.g., `"sales-dashboard"`)

### get_dashboard_available_filters

**Input:** `GetDashboardAvailableFiltersRequest` (API consistency)
- No parameters required (empty request object for consistent API design)

**Returns:** `DashboardAvailableFilters`
- `column_operators`: `Dict[str, Any]` — Available filter operators and metadata for each column

## Datasets

### list_datasets

**Input:** `ListDatasetsRequest` (inherits `MetadataCacheControl`)
- `filters`: `List[DatasetFilter]` — List of filter objects (cannot be used with search)
- `search`: `Optional[str]` — Free-text search string (cannot be used with filters)
- `select_columns`: `List[str]` — Columns to select (defaults include id, table_name, uuid)
- `order_column`: `Optional[str]` — Column to order results by (valid: id, table_name, schema, changed_on, created_on)
- `order_direction`: `Optional[Literal['asc', 'desc']]` — Order direction
- `page`: `int` — Page number (0-based)
- `page_size`: `int` — Number of items per page (default 100)
- `use_cache`: `bool = True` — Whether to use metadata cache
- `refresh_metadata`: `bool = False` — Force refresh metadata from database

**Returns:** `DatasetList`
- `datasets`: `List[DatasetListItem]` (each includes columns and metrics)
- `count`: `int`
- `total_count`: `int`
- `page`: `int`
- `page_size`: `int`
- `total_pages`: `int`
- `has_previous`: `bool`
- `has_next`: `bool`
- `columns_requested`: `List[str]`
- `columns_loaded`: `List[str]`
- `filters_applied`: `List[Any]`
- `pagination`: `PaginationInfo`
- `timestamp`: `datetime`

### get_dataset_info

**Input:** `GetDatasetInfoRequest`
- `identifier`: `int | str` — Dataset identifier (supports ID or UUID)

**Returns:** `DatasetInfo` or `DatasetError` (now includes columns and metrics)

**Multi-Identifier Support:**
- **ID**: Numeric dataset ID (e.g., `123`)
- **UUID**: Dataset UUID string (e.g., `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`)

#### DatasetInfo fields (new):
- `columns`: `List[TableColumnInfo]` — List of columns with name, type, verbose name, etc.
- `metrics`: `List[SqlMetricInfo]` — List of metrics with name, expression, verbose name, etc.

#### TableColumnInfo
- `column_name`: `str` — Column name
- `verbose_name`: `Optional[str]` — Verbose name
- `type`: `Optional[str]` — Column type
- `is_dttm`: `Optional[bool]` — Is datetime column
- `groupby`: `Optional[bool]` — Is groupable
- `filterable`: `Optional[bool]` — Is filterable
- `description`: `Optional[str]` — Column description

#### SqlMetricInfo
- `metric_name`: `str` — Metric name
- `verbose_name`: `Optional[str]` — Verbose name
- `expression`: `Optional[str]` — SQL expression
- `description`: `Optional[str]` — Metric description

> **Note:** All dataset list/info responses now include full column and metric metadata for each dataset.

### get_dataset_available_filters

**Input:** `GetDatasetAvailableFiltersRequest` (API consistency)
- No parameters required (empty request object for consistent API design)

**Returns:** `DatasetAvailableFilters`
- `column_operators`: `Dict[str, Any]` — Available filter operators and metadata for each column

## Charts

### list_charts

**Input:** `ListChartsRequest` (inherits `MetadataCacheControl`)
- `filters`: `List[ChartFilter]` — List of filter objects (cannot be used with search)
- `search`: `Optional[str]` — Free-text search string (cannot be used with filters)
- `select_columns`: `List[str]` — Columns to select (defaults include id, slice_name, uuid)
- `order_column`: `Optional[str]` — Column to order results by (valid: id, slice_name, viz_type, datasource_name, description, changed_on, created_on)
- `order_direction`: `Optional[Literal['asc', 'desc']]` — Order direction
- `page`: `int` — Page number (0-based)
- `page_size`: `int` — Number of items per page (default 100)
- `use_cache`: `bool = True` — Whether to use metadata cache
- `refresh_metadata`: `bool = False` — Force refresh metadata from database

**Returns:** `ChartList`
- `charts`: `List[ChartListItem]`
- `count`: `int`
- `total_count`: `int`
- `page`: `int`
- `page_size`: `int`
- `total_pages`: `int`
- `has_previous`: `bool`
- `has_next`: `bool`
- `columns_requested`: `List[str]`
- `columns_loaded`: `List[str]`
- `filters_applied`: `List[Any]`
- `pagination`: `PaginationInfo`
- `timestamp`: `datetime`

### get_chart_info

**Input:** `GetChartInfoRequest`
- `identifier`: `int | str` — Chart identifier (supports ID or UUID)

**Returns:** `ChartInfo` or `ChartError`

**Multi-Identifier Support:**
- **ID**: Numeric chart ID (e.g., `123`)
- **UUID**: Chart UUID string (e.g., `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`)

### get_chart_available_filters

**Input:** `GetChartAvailableFiltersRequest` (API consistency)
- No parameters required (empty request object for consistent API design)

**Returns:** `ChartAvailableFiltersResponse`
- `column_operators`: `Dict[str, Any]` — Available filter operators and metadata for each column

### generate_chart

**Input:** `GenerateChartRequest`
- `dataset_id`: `str` — ID of the dataset to use
- `config`: `ChartConfig` — Chart configuration (supports table and XY charts)

**Returns:** `Dict[str, Any]`
- `chart`: `Optional[Dict]` — The created chart info with id, slice_name, viz_type, and url
- `error`: `Optional[str]` — Error message, if creation failed

#### ChartConfig (Union of TableChartConfig and XYChartConfig)

#### TableChartConfig
- `chart_type`: `Literal["table"]` — Chart type
- `columns`: `List[ColumnRef]` — Columns to display
- `filters`: `Optional[List[FilterConfig]]` — Filters to apply
- `sort_by`: `Optional[List[str]]` — Columns to sort by

#### XYChartConfig
- `chart_type`: `Literal["xy"]` — Chart type
- `x`: `ColumnRef` — X-axis column
- `y`: `List[ColumnRef]` — Y-axis columns
- `kind`: `Literal["line", "bar", "area", "scatter"]` — Chart visualization type
- `group_by`: `Optional[ColumnRef]` — Column to group by
- `x_axis`: `Optional[AxisConfig]` — X-axis configuration
- `y_axis`: `Optional[AxisConfig]` — Y-axis configuration
- `legend`: `Optional[LegendConfig]` — Legend configuration
- `filters`: `Optional[List[FilterConfig]]` — Filters to apply

#### ColumnRef
- `name`: `str` — Column name
- `label`: `Optional[str]` — Display label for the column
- `dtype`: `Optional[str]` — Data type hint
- `aggregate`: `Optional[str]` — SQL aggregation function (SUM, COUNT, AVG, MIN, MAX, etc.)

#### AxisConfig
- `title`: `Optional[str]` — Axis title
- `scale`: `Optional[Literal["linear", "log"]]` — Axis scale type
- `format`: `Optional[str]` — Format string (e.g. '$,.2f')

#### LegendConfig
- `show`: `bool` — Whether to show legend
- `position`: `Optional[Literal["top", "bottom", "left", "right"]]` — Legend position

#### FilterConfig
- `column`: `str` — Column to filter on
- `op`: `Literal["=", ">", "<", ">=", "<=", "!="]` — Filter operator
- `value`: `str | int | float | bool` — Filter value

#### Supported Chart Types
- **Table charts** (`table`) — Simple column display with filters and sorting
- **Line charts** (`echarts_timeseries_line`) — Time series line charts
- **Bar charts** (`echarts_timeseries_bar`) — Time series bar charts
- **Area charts** (`echarts_area`) — Time series area charts
- **Scatter charts** (`echarts_timeseries_scatter`) — Time series scatter charts

#### Metric Handling
The tool intelligently handles two metric formats:
1. **Simple metrics** (like `["count"]`) — Passed as simple strings
2. **Complex metrics** (like column names) — Converted to full Superset metric objects with SQL aggregators (SUM, COUNT, AVG, MIN, MAX)

#### Chart Creation Output
```python
{
    "chart": {
        "id": 123,
        "slice_name": "Sales Over Time",
        "viz_type": "echarts_timeseries_line",
        "url": "/explore/?form_data=...",
        "explore_url": "http://localhost:8088/explore/?form_data=..."
    },
    "error": None
}
```

## System Tools

### get_superset_instance_info

**Input:** `GetSupersetInstanceInfoRequest` (API consistency)
- No parameters required (empty request object for consistent API design)

**Returns:** `SupersetInstanceInfo`
- `version`: `str` — Superset version
- `build_number`: `Optional[str]` — Build identifier
- `instance_id`: `str` — Unique instance identifier
- `mcp_service_version`: `str` — MCP service version
- `authentication_enabled`: `bool` — Whether JWT authentication is enabled
- `available_tools`: `List[str]` — List of available MCP tools
- `supported_chart_types`: `List[str]` — Supported chart types for creation

### generate_explore_link

**Input:** `GenerateExploreLinkRequest`
- `dataset_id`: `str` — Dataset ID to explore
- `config`: `ChartConfig` — Chart configuration (same as generate_chart)

**Returns:** `ExploreLinkResponse`
- `explore_url`: `str` — Full URL to Superset explore interface with chart configuration
- `form_data`: `Dict[str, Any]` — Serialized form data for the chart

## SQL Lab Tools

### open_sql_lab_with_context

**Input:** `OpenSqlLabRequest`
- `database_connection_id`: `int` — Database connection ID
- `schema`: `Optional[str]` — Default schema to select
- `dataset_in_context`: `Optional[str]` — Dataset/table name for context
- `sql`: `Optional[str]` — SQL query to pre-populate
- `title`: `Optional[str]` — Query title

**Returns:** `SqlLabUrlResponse`
- `url`: `str` — Full URL to SQL Lab with context
- `database_id`: `int` — Database ID used
- `schema`: `Optional[str]` — Schema selected
- `title`: `Optional[str]` — Query title
- `error`: `Optional[str]` — Error message if failed

### execute_sql

**Input:** `ExecuteSqlRequest`
- `database_id`: `int` — Database connection ID
- `sql`: `str` — SQL query to execute (validated for non-empty)
- `schema`: `Optional[str]` — Schema name
- `limit`: `int = 1000` — Result row limit (min: 1, max: 10000)
- `timeout`: `int = 30` — Query timeout in seconds (min: 1, max: 300)
- `parameters`: `Optional[Dict[str, Any]]` — Parameters for query substitution

**Returns:** `ExecuteSqlResponse`
- `success`: `bool` — Whether query executed successfully
- `rows`: `Optional[Any]` — Query results (list of dictionaries)
- `columns`: `Optional[List[ColumnInfo]]` — Column metadata
  - `name`: `str` — Column name
  - `type`: `str` — Column data type
  - `is_nullable`: `Optional[bool]` — Whether column allows NULL
- `row_count`: `Optional[int]` — Number of rows returned
- `affected_rows`: `Optional[int]` — Number of rows affected (for DML)
- `query_id`: `Optional[str]` — Query ID for tracking
- `execution_time`: `Optional[float]` — Query execution time in seconds
- `error`: `Optional[str]` — Error message if failed
- `error_type`: `Optional[str]` — Error type classification:
  - `SECURITY_ERROR` — Permission denied
  - `DATABASE_NOT_FOUND_ERROR` — Database doesn't exist
  - `DML_NOT_ALLOWED` — DML on read-only database
  - `DISALLOWED_FUNCTION` — Blocked SQL function used
  - `TIMEOUT` — Query exceeded timeout
  - `INVALID_PAYLOAD_FORMAT_ERROR` — Missing parameters
  - `EXECUTION_ERROR` — General execution failure

**Example:**
```python
# Simple query
execute_sql(request={
    "database_id": 1,
    "sql": "SELECT * FROM sales LIMIT 10"
})

# Query with parameters
execute_sql(request={
    "database_id": 1,
    "sql": "SELECT * FROM {table} WHERE year = {year}",
    "parameters": {"table": "sales", "year": "2024"},
    "limit": 100
})

# Response format
{
    "success": True,
    "rows": [{"id": 1, "amount": 1000}],
    "columns": [
        {"name": "id", "type": "INTEGER", "is_nullable": False},
        {"name": "amount", "type": "DECIMAL", "is_nullable": True}
    ],
    "row_count": 1,
    "execution_time": 0.123
}
```

## Authentication Context

When authentication is enabled, all tools receive additional context:

### JWT Authentication
- **User Extraction**: JWT claims (subject, client_id, email, username) mapped to Superset users
- **Scope Validation**: Each tool validates required scopes before execution
- **Audit Logging**: All operations logged with user context and JWT metadata
- **Impersonation**: Optional `run_as` parameter for user impersonation (where permitted)

### Error Responses
When authentication fails or permissions are insufficient:
```python
{
    "error": "Access denied: user lacks permission for tool_name",
    "error_type": "PermissionError",
    "required_scopes": ["chart:read"],
    "user_scopes": ["dashboard:read"]
}
```

## Model Relationships

```mermaid
flowchart TD
    subgraph Schema Types
        A["DashboardListItem"]
        B["DatasetListItem"]
        C["ChartListItem"]
        D["UserInfo"]
        E["TagInfo"]
        F["RoleInfo"]
        G["TableColumnInfo"]
        H["SqlMetricInfo"]
        I["ChartConfig"]
        J["GenerateChartRequest"]
    end
    A -- owners --> D
    A -- tags --> E
    A -- roles --> F
    B -- owners --> D
    B -- tags --> E
    B -- columns --> G
    B -- metrics --> H
    C -- owners --> D
    C -- tags --> E
    J -- config --> I
    I -- columns --> G
```

## Request Schema Pattern Benefits

All tools using the FastMCP Complex Inputs Pattern provide:

### For List Tools (`list_*`)
- **Clear array types**: `filters` is always `List[Filter]`, never a string
- **Mutual exclusion**: Cannot use both `search` and `filters` simultaneously
- **Default columns**: Include UUID/slug in default responses for better searchability
- **Validation messages**: Clear error messages guide LLM usage

### For Get Info Tools (`get_*_info`)
- **Multi-identifier support**: Single interface for ID, UUID, and slug lookup
- **Intelligent detection**: Automatically determines identifier type based on format
- **Enhanced flexibility**: Works with LLM-generated identifiers of any supported type
- **Rich metadata**: Full object details including relationships (columns, metrics, owners)
- **Error handling**: Clear error responses when objects not found or access denied

### ModelListTool and Schema Consistency

All list tools use the `ModelListTool` abstraction, which enforces:
- Consistent parameter order and types via request schemas
- Strongly-typed Pydantic input/output models
- LLM/OpenAPI-friendly field names
- Validation logic preventing parameter conflicts
- Enhanced search including UUID/slug fields
- Detailed metadata in responses (columns_requested, columns_loaded, etc.)

## Schema Validation & Testing

All schemas are thoroughly tested with:
- **194+ unit tests** covering all input/output combinations including URL utils and audit logging
- **Multi-identifier testing** for all get_*_info tools (ID, UUID, slug)
- **Request schema validation** preventing parameter conflicts
- **Authentication integration** testing with JWT contexts
- **Error response validation** for permission and authentication failures
- **Chart creation and update testing** covering all supported chart types and aggregators
- **Dashboard generation testing** for workflow validation
- **SQL Lab integration testing** with proper parameter handling

## Future Schema Enhancements

### Phase 1 Recently Completed ✅
- **Backend rendering schemas**: Chart screenshot and image response formats ✅
- **SQL Lab schemas**: Context-aware query session parameters ✅  
- **Dashboard generation schemas**: Complete dashboard creation and chart addition ✅
- **Chart data/preview schemas**: Multi-format data export and preview generation ✅
- **Enhanced error responses**: More detailed validation and permission error details ✅

### Future Phases
- **Advanced chart types**: Maps, 3D visualizations, custom components
- **Vega-Lite/Plotly output**: LLM-friendly chart rendering formats  
- **Advanced dashboard layouts**: Custom positioning and grid configurations
- **Business intelligence schemas**: Natural language to SQL query generation
