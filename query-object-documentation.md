# QueryObject Documentation

**File**: `superset/common/query_object.py`

The `QueryObject` class represents a single database query specification constructed on the client. It describes *what* data to fetch (columns, metrics, filters) without specifying *how* to fetch it. The datasource connector is responsible for translating the QueryObject into the appropriate query language (SQL, GraphQL, etc.).

## Table of Contents

- [Core Query Specification](#core-query-specification)
- [Data Selection](#data-selection)
- [Filtering](#filtering)
- [Aggregation & Metrics](#aggregation--metrics)
- [Time/Temporal](#timetemporal)
- [Sorting & Limiting](#sorting--limiting)
- [Series Limiting (Timeseries)](#series-limiting-timeseries)
- [Post-Processing](#post-processing)
- [Annotations](#annotations)
- [Query Execution Control](#query-execution-control)
- [Deprecated Fields](#deprecated-fields)

---

## Core Query Specification

### `datasource`

**Type**: `BaseDatasource | None`

**Description**: Reference to the datasource (dataset, table, or query) from which to fetch data. This is the data source object itself, not just an identifier.

**Default**: `None`

**Usage**: Set automatically by the QueryContext when loading from the schema. The datasource provides metadata about available columns, metrics, and handles the actual query execution.

**Example**:
```python
# Automatically set during query context creation
query_object.datasource  # <SqlaTable 'public.sales_data'>
```

---

### `columns`

**Type**: `list[Column]`

**Column Type**: `Union[AdhocColumn, str]`

**Description**: List of dimensions (non-aggregated columns) to select in the query. These become GROUP BY columns if metrics are specified, or simple SELECT columns otherwise.

**Default**: `[]` (empty list)

**Formats Supported**:
1. **String reference**: `"country"` - references a physical column
2. **Adhoc column** (dict):
   ```python
   {
       "label": "upper_name",
       "sqlExpression": "UPPER(name)",
       "hasCustomLabel": True
   }
   ```

**Usage Notes**:
- Formula annotations don't count as columns (filtered out)
- Used as the default for `series_columns` in timeseries queries
- Referenced in GROUP BY clauses when metrics are present

**Related**:
- `column_names` property: Returns list of column labels as strings
- `series_columns`: Subset of columns used for series limiting

**Example**:
```python
query_object.columns = ["country", "state", "city"]

# Or with adhoc columns:
query_object.columns = [
    "country",
    {
        "label": "year",
        "sqlExpression": "EXTRACT(YEAR FROM created_at)",
        "hasCustomLabel": True
    }
]
```

---

### `metrics`

**Type**: `list[Metric] | None`

**Metric Type**: `Union[AdhocMetric, str]`

**Description**: List of aggregate expressions to compute. These become the SELECT clause aggregations in SQL queries.

**Default**: `None`

**Formats Supported**:
1. **String reference**: `"count"` - references a predefined metric
2. **Legacy format**: `{"label": "count"}` - references a predefined metric (converted to string)
3. **Adhoc SIMPLE metric**:
   ```python
   {
       "expressionType": "SIMPLE",
       "aggregate": "SUM",
       "column": {"column_name": "revenue"},
       "label": "Total Revenue",
       "hasCustomLabel": True
   }
   ```
4. **Adhoc SQL metric**:
   ```python
   {
       "expressionType": "SQL",
       "sqlExpression": "SUM(price * quantity)",
       "label": "Total Sales",
       "hasCustomLabel": True
   }
   ```

**Usage Notes**:
- When metrics are specified, queries automatically include GROUP BY
- When `None` or empty, no aggregation is performed
- Legacy format `{"label": "..."}` is automatically converted to string

**Related**:
- `metric_names` property: Returns list of metric labels as strings
- `is_rowcount`: Alternative to metrics for counting rows

**Example**:
```python
# Simple metric references
query_object.metrics = ["count", "sum__revenue"]

# Adhoc metrics
query_object.metrics = [
    {
        "expressionType": "SIMPLE",
        "aggregate": "AVG",
        "column": {"column_name": "price"},
        "label": "Average Price"
    },
    {
        "expressionType": "SQL",
        "sqlExpression": "SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END)",
        "label": "Completed Orders"
    }
]
```

---

## Data Selection

### `is_timeseries`

**Type**: `bool`

**Description**: Indicates whether this query is a timeseries query (data points over time). Affects how results are processed and displayed.

**Default**: Automatically determined - `True` if `DTTM_ALIAS` (special time column constant) is in `columns`, otherwise can be explicitly set

**Usage Notes**:
- Influences `series_columns` initialization
- Affects post-processing behavior in some visualizations
- Used to determine if series limiting should apply

**Example**:
```python
# Automatically set to True for timeseries
query_object.columns = ["__timestamp", "country"]
query_object.is_timeseries  # True

# Explicitly set
query_object.is_timeseries = True
```

---

### `is_rowcount`

**Type**: `bool`

**Description**: When `True`, returns only the total row count instead of actual data. Used for preview operations or checking data volume.

**Default**: `False`

**Usage Notes**:
- Mutually exclusive with normal metric aggregation
- Result contains just a count, no actual rows
- Useful for pagination and data size checks

**Example**:
```python
query_object.is_rowcount = True
# Query returns: {"count": 15234}
```

---

### `result_type`

**Type**: `ChartDataResultType | None`

**Values**: `"full"`, `"samples"`, `"query"`, `"results"`, `"post_processed"`, `"columns"`, `"timegrains"`, `"drill_detail"`

**Description**: Specifies what type of result to return. Controls which processing pipeline is used.

**Default**: `None` (inherits from QueryContext if not specified)

**Types**:
- `"full"`: Complete query execution with all data
- `"samples"`: Sample rows from the datasource (no metrics, limited rows)
- `"query"`: Return the query string without executing
- `"results"`: Like "full" but with minimal metadata
- `"post_processed"`: Full results for client-side post-processing
- `"columns"`: Return column metadata only
- `"timegrains"`: Return available time granularities
- `"drill_detail"`: Return drill-through detail rows

**Example**:
```python
query_object.result_type = ChartDataResultType.SAMPLES
# Returns sample rows without aggregation
```

---

## Filtering

### `filter`

**Type**: `list[QueryObjectFilterClause]`

**FilterClause Type**:
```python
{
    "col": Union[str, AdhocColumn],  # Column to filter
    "op": str,                        # Operator (e.g., "==", "IN", "LIKE")
    "val": FilterValues | None,       # Value(s) to compare
    "grain": str | None,              # Time grain for temporal filters
    "isExtra": bool | None            # Added by dashboard filters
}
```

**Description**: List of filter conditions to apply to the query. These become WHERE clause conditions in SQL.

**Default**: `[]` (empty list)

**Supported Operators**: `==`, `!=`, `>`, `<`, `>=`, `<=`, `IN`, `NOT IN`, `LIKE`, `ILIKE`, `REGEX`, `TEMPORAL_RANGE`, `IS NULL`, `IS NOT NULL`, and more (see `FilterOperator` enum)

**Usage Notes**:
- Filters are ANDed together
- `isExtra: True` indicates filter was added by dashboard/native filters
- Temporal filters (`TEMPORAL_RANGE`) require `grain` to be set
- Filters go through Jinja template processing if datasource supports it
- Sanitized for SQL injection before execution

**Example**:
```python
query_object.filter = [
    {
        "col": "country",
        "op": "IN",
        "val": ["USA", "Canada", "Mexico"]
    },
    {
        "col": "revenue",
        "op": ">=",
        "val": 1000
    },
    {
        "col": "created_at",
        "op": "TEMPORAL_RANGE",
        "val": "Last 30 days",
        "grain": "P1D"
    }
]
```

---

### `extras`

**Type**: `dict[str, Any]`

**Description**: Additional query parameters and modifiers. This is an extensible dictionary for extra query options.

**Default**: `{}` (empty dict)

**Common Keys**:
- `"where"`: Raw SQL WHERE clause (added via AND)
- `"having"`: Raw SQL HAVING clause for aggregate filters
- `"time_grain_sqla"`: Time granularity (e.g., `"P1D"` for 1 day)
- `"relative_start"`: Start reference point (`"today"` or `"now"`)
- `"relative_end"`: End reference point (`"today"` or `"now"`)
- `"instant_time_comparison_range"`: For advanced time comparison features

**Usage Notes**:
- WHERE and HAVING clauses support Jinja templates
- All SQL clauses are sanitized for security
- `time_grain_sqla` controls temporal aggregation level
- **Warning**: Direct SQL clauses (`where`, `having`) bypass some security layers

**Example**:
```python
query_object.extras = {
    "where": "status = 'active' AND archived = false",
    "having": "SUM(revenue) > 10000",
    "time_grain_sqla": "P1W",  # Weekly granularity
    "relative_start": "now"
}
```

---

### `apply_fetch_values_predicate`

**Type**: `bool`

**Description**: When `True`, applies additional WHERE clause predicates defined in the datasource configuration for fetching filter values.

**Default**: `False`

**Usage Notes**:
- Used primarily when loading filter options
- Applies datasource-specific filter predicates
- Helps limit the domain of filter values

**Example**:
```python
query_object.apply_fetch_values_predicate = True
# Applies any predicates configured on the datasource
```

---

### `applied_time_extras`

**Type**: `dict[str, str]`

**Description**: Mapping of temporal extras that have been applied to the query. Used for tracking which time filters were actually used.

**Default**: `{}` (empty dict)

**Usage Notes**:
- Populated during query execution
- Used for displaying which time filters are active
- Keys are typically time column names
- Values are human-readable descriptions

**Example**:
```python
query_object.applied_time_extras = {
    "__time_range": "1 year ago : now",
    "__time_grain": "P1D"
}
```

---

## Aggregation & Metrics

### `groupby` (DEPRECATED)

**Status**: ⚠️ **DEPRECATED** - Use `columns` instead

**Type**: N/A (automatically renamed to `columns`)

**Description**: Legacy field name for grouping columns. Automatically converted to `columns` during initialization.

**Migration**: Replace `groupby` with `columns` in all new code.

---

## Time/Temporal

### `granularity`

**Type**: `str | None`

**Description**: Name of the temporal column to use for time-based operations (filtering, grouping). This is the primary time dimension for the query.

**Default**: `None`

**Usage Notes**:
- Used for temporal filtering and aggregation
- Essential for timeseries queries
- References a datetime column in the datasource
- Used in time range filters

**Related**:
- `extras["time_grain_sqla"]`: Controls temporal aggregation granularity
- `time_range`: The time range to filter by
- `granularity_sqla`: Deprecated alias for `granularity`

**Example**:
```python
query_object.granularity = "order_date"
# All time operations will use the order_date column
```

---

### `granularity_sqla` (DEPRECATED)

**Status**: ⚠️ **DEPRECATED** - Use `granularity` instead

**Type**: N/A (automatically renamed to `granularity`)

**Description**: Legacy SQL-specific field name for temporal column. Automatically converted during initialization.

**Migration**: Replace `granularity_sqla` with `granularity` in all new code.

---

### `time_range`

**Type**: `str | None`

**Description**: Human-readable time range specification for filtering temporal data. Supports both relative and absolute formats.

**Default**: `None`

**Supported Formats**:
- **Relative**: `"Last 7 days"`, `"Last week"`, `"Last month"`, `"Last quarter"`, `"Last year"`
- **Relative with number**: `"Last 30 days"`, `"Last 6 months"`, `"Next 2 weeks"`
- **Absolute**: `"2023-01-01 : 2023-12-31"` (ISO 8601)
- **Mixed**: `"2023-01-01 : now"`, `"1 year ago : now"`
- **No filter**: `"No filter"`

**Usage Notes**:
- Parsed into `from_dttm` and `to_dttm` datetime objects
- Relative times are resolved at query execution time
- Used for cache key generation (not the parsed datetime values)
- Supports parsedatetime syntax

**Related**:
- `from_dttm`: Computed start datetime
- `to_dttm`: Computed end datetime
- `granularity`: Column to filter on

**Example**:
```python
query_object.time_range = "Last 30 days"
# Computed at runtime: from_dttm = now() - 30 days, to_dttm = now()

query_object.time_range = "2023-01-01 : 2023-06-30"
# Explicit range
```

---

### `from_dttm`

**Type**: `datetime | None`

**Description**: Computed start datetime for the time range filter. Automatically calculated from `time_range`.

**Default**: `None`

**Usage Notes**:
- Set automatically during query processing
- Not included in cache key (time_range is used instead)
- May be overridden for time offset queries

**Example**:
```python
query_object.time_range = "Last 7 days"
# After processing:
query_object.from_dttm  # datetime(2024, 1, 15, 0, 0, 0)
```

---

### `to_dttm`

**Type**: `datetime | None`

**Description**: Computed end datetime for the time range filter. Automatically calculated from `time_range`.

**Default**: `None`

**Usage Notes**:
- Set automatically during query processing
- Not included in cache key (time_range is used instead)
- May be overridden for time offset queries

**Example**:
```python
query_object.time_range = "Last 7 days"
# After processing:
query_object.to_dttm  # datetime(2024, 1, 22, 23, 59, 59)
```

---

### `inner_from_dttm`

**Type**: `datetime | None`

**Description**: Inner time range start for nested temporal operations. Used when applying time filters to queries that don't have time as a dimension.

**Default**: `None`

**Usage Notes**:
- Used in advanced time comparison scenarios
- Typically same as `from_dttm` for simple queries
- May differ when time offsets are applied

**Example**:
```python
# Set during time offset processing
query_object.inner_from_dttm = datetime(2024, 1, 1)
```

---

### `inner_to_dttm`

**Type**: `datetime | None`

**Description**: Inner time range end for nested temporal operations. Used when applying time filters to queries that don't have time as a dimension.

**Default**: `None`

**Usage Notes**:
- Used in advanced time comparison scenarios
- Typically same as `to_dttm` for simple queries
- May differ when time offsets are applied

**Example**:
```python
# Set during time offset processing
query_object.inner_to_dttm = datetime(2024, 1, 31)
```

---

### `time_shift`

**Type**: `str | None`

**Description**: Shifts the entire time range by a specified offset. Used for comparing data across different time periods.

**Default**: `None`

**Supported Formats**: Any parsedatetime-compatible string (e.g., `"1 week ago"`, `"3 months ago"`, `"1 year ago"`)

**Usage Notes**:
- Applied to both `from_dttm` and `to_dttm`
- Different from `time_offsets` (which creates separate queries)
- Affects the main query time range

**Example**:
```python
query_object.time_range = "Last 7 days"
query_object.time_shift = "1 week ago"
# Shifts the entire 7-day window back by 1 week
```

---

### `time_offsets`

**Type**: `list[str]`

**Description**: List of time offsets for creating comparison queries. Each offset generates an additional query with shifted time ranges, enabling time-over-time comparisons.

**Default**: `[]` (empty list)

**Supported Formats**:
1. **Relative**: `"1 week ago"`, `"1 year ago"`, `"3 months ago"`
2. **Date range** (with feature flag): `"2023-01-01 : 2023-01-31"`
3. **Special**: `"inherit"` (uses the time range span)
4. **Custom date**: `"2023-06-15"` (compares to this specific date)

**Usage Notes**:
- Creates separate queries for each offset
- Results are joined with the main query results
- Offset metrics are renamed (e.g., `revenue` → `revenue__1 week ago`)
- Requires `DATE_RANGE_TIMESHIFTS_ENABLED` feature flag for date range format
- Used for year-over-year, month-over-month comparisons

**Related**:
- Time grain is required for proper joining of offset results
- `series_limit` applies to the main query, not offset queries

**Example**:
```python
query_object.time_offsets = ["1 week ago", "1 year ago"]
# Generates 3 queries total:
# 1. Main query (this week)
# 2. Same query shifted back 1 week
# 3. Same query shifted back 1 year
# Results joined on time + other dimensions

# Or with date range (requires feature flag):
query_object.time_offsets = ["2023-01-01 : 2023-01-31"]
# Compares current period to January 2023
```

---

## Sorting & Limiting

### `orderby`

**Type**: `list[OrderBy]`

**OrderBy Type**: `tuple[Union[Metric, Column], bool]`

**Description**: List of ordering specifications. Each tuple contains a column/metric and a boolean indicating ascending order.

**Default**: `[]` (empty list)

**Format**: `[(column_or_metric, is_ascending), ...]`

**Usage Notes**:
- Boolean `True` = ascending order
- Boolean `False` = descending order
- Can order by both columns and metrics
- Applied after aggregation

**Related**:
- `order_desc`: Default sort direction (deprecated in favor of explicit orderby)

**Example**:
```python
query_object.orderby = [
    ("revenue", False),  # Order by revenue descending
    ("country", True)    # Then by country ascending
]
```

---

### `order_desc`

**Type**: `bool`

**Description**: Default sort direction when orderby is not specified. Primarily affects how series are ordered.

**Default**: `True` (descending)

**Usage Notes**:
- Less flexible than `orderby`
- Prefer using explicit `orderby` for complex sorting
- Used mainly for backward compatibility

**Example**:
```python
query_object.order_desc = False
# Results sorted in ascending order
```

---

### `row_limit`

**Type**: `int | None`

**Description**: Maximum number of rows to return from the query. Acts as a SQL LIMIT clause.

**Default**: `None` (uses system default)

**Range**: `>= 0` (0 means no limit)

**Usage Notes**:
- Applied after all filtering and aggregation
- Different from `series_limit` (which limits timeseries)
- System default from `config["ROW_LIMIT"]`
- Can be overridden per-query

**Related**:
- `row_offset`: Works with row_limit for pagination
- `series_limit`: For limiting timeseries/series count

**Example**:
```python
query_object.row_limit = 1000
# Returns at most 1000 rows
```

---

### `row_offset`

**Type**: `int`

**Description**: Number of rows to skip before returning results. Acts as a SQL OFFSET clause for pagination.

**Default**: `0` (no offset)

**Range**: `>= 0`

**Usage Notes**:
- Used with `row_limit` for pagination
- Applied after ordering
- Useful for infinite scroll or paginated tables

**Example**:
```python
# Page 3 of results (20 per page)
query_object.row_limit = 20
query_object.row_offset = 40  # Skip first 40 rows
```

---

## Series Limiting (Timeseries)

### `series_columns`

**Type**: `list[Column]`

**Description**: Subset of `columns` to use when limiting the number of series in timeseries queries. Defines which dimensions create distinct series.

**Default**: Automatically initialized based on context:
- If explicitly provided, uses those columns
- If `is_timeseries=True` and `metrics` exist, uses all `columns`
- Otherwise, empty list

**Usage Notes**:
- All series_columns must be present in `columns`
- Used with `series_limit` to control series count
- Validated during query validation
- Creates one series per unique combination of series_column values

**Related**:
- `series_limit`: Maximum number of series
- `series_limit_metric`: Metric to use for ranking series
- `group_others_when_limit_reached`: Whether to group remaining series

**Example**:
```python
query_object.columns = ["country", "product", "date"]
query_object.series_columns = ["country", "product"]
# Creates one series per (country, product) combination
```

---

### `series_limit`

**Type**: `int`

**Description**: Maximum number of series to return in a timeseries query. Series are ranked by `series_limit_metric` and top N are kept.

**Default**: `0` (no limit)

**Usage Notes**:
- Only applies to timeseries queries
- Requires `series_columns` and `series_limit_metric` to be set
- Top series are selected by the specified metric
- See `group_others_when_limit_reached` for handling excluded series

**Related**:
- `series_columns`: Dimensions that define series
- `series_limit_metric`: Metric used for ranking
- `timeseries_limit`: Deprecated alias

**Example**:
```python
query_object.series_limit = 10
query_object.series_limit_metric = "revenue"
query_object.series_columns = ["country"]
# Returns top 10 countries by revenue
```

---

### `series_limit_metric`

**Type**: `Metric | None`

**Description**: The metric to use for ranking series when `series_limit` is applied. Determines which series are kept.

**Default**: `None`

**Usage Notes**:
- Required when `series_limit` is set
- Must be one of the metrics in the query
- Series are ranked in descending order by this metric
- Can be a string reference or adhoc metric

**Related**:
- `series_limit`: Number of series to keep
- `timeseries_limit_metric`: Deprecated alias

**Example**:
```python
query_object.series_limit_metric = "sum__revenue"
# Ranks series by total revenue
```

---

### `group_others_when_limit_reached`

**Type**: `bool`

**Description**: When `True` and series limit is reached, groups all remaining series into an "Others" category. Prevents incomplete data visualization.

**Default**: `False`

**Usage Notes**:
- Only relevant when `series_limit` is set
- Aggregates metrics for excluded series
- Helps show complete totals while limiting series count
- "Others" category appears as a separate series

**Example**:
```python
query_object.series_limit = 5
query_object.series_limit_metric = "count"
query_object.group_others_when_limit_reached = True
# Shows top 5 series + "Others" category with remaining aggregated
```

---

### `timeseries_limit` (DEPRECATED)

**Status**: ⚠️ **DEPRECATED** - Use `series_limit` instead

**Type**: N/A (automatically renamed to `series_limit`)

**Description**: Legacy field name for series limit. Automatically converted during initialization.

**Migration**: Replace `timeseries_limit` with `series_limit` in all new code.

---

### `timeseries_limit_metric` (DEPRECATED)

**Status**: ⚠️ **DEPRECATED** - Use `series_limit_metric` instead

**Type**: N/A (automatically renamed to `series_limit_metric`)

**Description**: Legacy field name for series limit metric. Automatically converted during initialization.

**Migration**: Replace `timeseries_limit_metric` with `series_limit_metric` in all new code.

---

## Post-Processing

### `post_processing`

**Type**: `list[dict[str, Any]]`

**Description**: Ordered list of post-processing operations to apply to the query results. These transformations run on the DataFrame after SQL execution.

**Default**: `[]` (empty list)

**Operation Format**:
```python
{
    "operation": str,      # Operation name (from pandas_postprocessing module)
    "options": dict        # Operation-specific parameters
}
```

**Available Operations**:
- `aggregate`: Group and aggregate data
- `pivot`: Pivot table transformation
- `rolling`: Rolling window calculations
- `sort`: Sort data
- `select`: Select/rename columns
- `contribution`: Calculate contribution percentages
- `prophet`: Time series forecasting
- `boxplot`: Statistical boxplot calculations
- `histogram`: Create histogram bins
- `geohash_decode`: Decode geohash to lat/lon
- `geohash_encode`: Encode lat/lon to geohash
- `geodetic_parse`: Parse geodetic coordinates
- And more...

**Usage Notes**:
- Operations applied in sequence
- Each operation receives output of previous operation
- All operations are from `superset.utils.pandas_postprocessing`
- Validation ensures operation names are valid
- Useful for client-side transformations without re-querying

**Example**:
```python
query_object.post_processing = [
    {
        "operation": "pivot",
        "options": {
            "index": ["country"],
            "columns": ["product"],
            "aggregates": {
                "revenue": {"operator": "sum"}
            }
        }
    },
    {
        "operation": "sort",
        "options": {
            "columns": {"revenue": False}  # Descending
        }
    }
]
```

**Histogram Example**:
```python
query_object.post_processing = [
    {
        "operation": "histogram",
        "options": {
            "column": "age",
            "bins": 25
        }
    }
]
```

---

## Annotations

### `annotation_layers`

**Type**: `list[dict[str, Any]]`

**Description**: List of annotation layers to overlay on the chart. Annotations add contextual information like events, ranges, or reference data.

**Default**: `[]` (empty list, formula annotations filtered out)

**Layer Structure**:
```python
{
    "annotationType": str,          # "FORMULA", "NATIVE", "line", "table"
    "name": str,                    # Layer name
    "value": Any,                   # Layer-specific value (ID, formula, etc.)
    "show": bool,                   # Whether to show the layer
    "sourceType": str,              # "NATIVE", "line", "table", etc.
    "color": str,                   # Layer color
    "opacity": str,                 # "opacityLow", "opacityMedium", "opacityHigh"
    "style": str,                   # "solid", "dashed", "dotted", "longDashed"
    "width": float,                 # Line width
    "showMarkers": bool,            # Show markers on line annotations
    "showLabel": bool,              # Always show label
    "hideLine": bool,               # Hide line (show markers only)
    "timeColumn": str,              # Column with timestamps
    "intervalEndColumn": str,       # For interval annotations
    "titleColumn": str,             # Column for titles
    "descriptionColumns": list,     # Columns for descriptions
    "overrides": dict               # Override query properties
}
```

**Annotation Types**:
- `"FORMULA"`: Simple formula overlays (e.g., constant line) - **filtered out, don't affect query**
- `"NATIVE"`: Native Superset annotations stored in DB
- `"line"` / `"table"`: Annotations from other charts/queries

**Usage Notes**:
- Formula annotations are filtered out (don't affect payload)
- Other annotations trigger additional data fetches
- Annotations can override time range, granularity, etc.
- Used primarily for time series visualizations

**Example**:
```python
query_object.annotation_layers = [
    {
        "annotationType": "NATIVE",
        "name": "Important Events",
        "value": 1,  # annotation_layer_id
        "show": True,
        "sourceType": "NATIVE",
        "color": "#ff0000"
    },
    {
        "annotationType": "line",
        "name": "Baseline",
        "value": 42,  # chart_id
        "show": True,
        "sourceType": "line",
        "style": "dashed",
        "overrides": {
            "time_range": "Last year"
        }
    }
]
```

---

## Query Execution Control

### `url_params`

**Type**: `dict[str, str]` (keys and values are strings)

**Description**: Optional query parameters passed from dashboard or Explore view URLs. Used for dynamic filtering and Jinja template variables.

**Default**: Not set (from kwargs)

**Usage Notes**:
- Available in Jinja templates via `url_param` function
- Typically set by dashboard filters or URL parameters
- Keys and values are always strings
- Can be used for dynamic query customization

**Example**:
```python
query_object.url_params = {
    "country_filter": "USA",
    "min_date": "2024-01-01"
}

# In Jinja template:
# WHERE country = '{{ url_param("country_filter") }}'
```

---

## Deprecated Fields

### `where` (DEPRECATED)

**Status**: ⚠️ **DEPRECATED** - Use `extras["where"]` instead

**Type**: Field moved to extras during initialization

**Description**: Raw SQL WHERE clause. Automatically moved to `extras["where"]`.

**Migration**: Use `extras["where"]` directly instead of passing `where` parameter.

---

### `having` (DEPRECATED)

**Status**: ⚠️ **DEPRECATED** - Use `extras["having"]` instead

**Type**: Field moved to extras during initialization

**Description**: Raw SQL HAVING clause. Automatically moved to `extras["having"]`.

**Migration**: Use `extras["having"]` directly instead of passing `having` parameter.

---

## Properties

### `metric_names`

**Type**: `list[str]` (read-only property)

**Description**: Returns the metric labels as strings. Converts adhoc metrics to their labels.

**Usage**: Accessing metric names without dealing with adhoc metric dictionaries.

**Example**:
```python
query_object.metrics = ["count", {"expressionType": "SQL", "label": "revenue", ...}]
query_object.metric_names  # ["count", "revenue"]
```

---

### `column_names`

**Type**: `list[str]` (read-only property)

**Description**: Returns the column labels as strings. Converts adhoc columns to their labels.

**Usage**: Accessing column names without dealing with adhoc column dictionaries.

**Example**:
```python
query_object.columns = ["country", {"label": "year", "sqlExpression": "...", ...}]
query_object.column_names  # ["country", "year"]
```

---

## Methods

### `validate(raise_exceptions: bool = True) -> QueryObjectValidationError | None`

**Description**: Validates the query object for correctness. Checks for duplicate labels, missing series columns, invalid time offsets, and sanitizes filters.

**Parameters**:
- `raise_exceptions`: If `True`, raises exception on validation error. If `False`, returns the error object.

**Validates**:
1. No missing series columns
2. No duplicate column/metric labels
3. Valid time offset configurations
4. Sanitizes WHERE/HAVING clauses for SQL injection

**Returns**: `None` if valid, or `QueryObjectValidationError` if `raise_exceptions=False`

**Example**:
```python
try:
    query_object.validate()
except QueryObjectValidationError as e:
    print(f"Validation failed: {e.message}")
```

---

### `to_dict() -> dict[str, Any]`

**Description**: Serializes the QueryObject to a dictionary. Used for passing to datasource connectors and caching.

**Returns**: Dictionary representation of the query object

**Usage**: Called internally when executing queries on datasources.

**Example**:
```python
query_dict = query_object.to_dict()
# {
#   "columns": ["country"],
#   "metrics": ["count"],
#   "filters": [...],
#   ...
# }
```

---

### `cache_key(**extra: Any) -> str`

**Description**: Generates a unique cache key for this query. Uses MD5/SHA hash of query parameters.

**Parameters**:
- `**extra`: Additional key-value pairs to include in cache key

**Key Components**:
- All query parameters from `to_dict()`
- `time_range` (not `from_dttm`/`to_dttm` - for relative time caching)
- `datasource.uid`
- `result_type`
- `post_processing`
- `time_offsets`
- `annotation_layers` (if present)
- User impersonation key (if enabled)

**Returns**: MD5/SHA hash string

**Example**:
```python
cache_key = query_object.cache_key(
    time_offset="1 week ago",
    time_grain="P1D"
)
# "a3f5c8e9d..."
```

---

### `exec_post_processing(df: DataFrame) -> DataFrame`

**Description**: Applies all post-processing operations to a DataFrame in sequence.

**Parameters**:
- `df`: Pandas DataFrame from query execution

**Returns**: Transformed DataFrame

**Raises**: `InvalidPostProcessingError` if operation is invalid

**Example**:
```python
df = datasource.query(query_object.to_dict()).df
processed_df = query_object.exec_post_processing(df)
```

---

## Type Definitions

### `Column`

**Type**: `Union[AdhocColumn, str]`

**AdhocColumn Structure**:
```python
{
    "label": str,              # Column label
    "sqlExpression": str,      # SQL expression
    "hasCustomLabel": bool,    # Whether label is custom
    "columnType": str,         # "BASE_AXIS" or "SERIES"
    "timeGrain": str           # Time grain if temporal
}
```

---

### `Metric`

**Type**: `Union[AdhocMetric, str]`

**AdhocMetric Structure**:
```python
{
    "expressionType": "SIMPLE" | "SQL",
    "label": str,
    "hasCustomLabel": bool,

    # For SIMPLE:
    "aggregate": "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "COUNT_DISTINCT",
    "column": AdhocMetricColumn,

    # For SQL:
    "sqlExpression": str
}
```

---

### `OrderBy`

**Type**: `tuple[Union[Metric, Column], bool]`

**Format**: `(column_or_metric, is_ascending)`

**Example**: `("revenue", False)` means "ORDER BY revenue DESC"

---

## Common Usage Patterns

### Basic Query

```python
query_object = QueryObject(
    columns=["country", "city"],
    metrics=["count"],
    row_limit=100
)
```

### Timeseries Query

```python
query_object = QueryObject(
    columns=["__timestamp", "country"],
    metrics=["sum__revenue"],
    granularity="order_date",
    time_range="Last 30 days",
    extras={"time_grain_sqla": "P1D"},
    is_timeseries=True
)
```

### Time Comparison Query

```python
query_object = QueryObject(
    columns=["country"],
    metrics=["sum__revenue"],
    time_range="Last 7 days",
    time_offsets=["1 week ago", "1 year ago"],
    granularity="order_date"
)
```

### Post-Processed Query

```python
query_object = QueryObject(
    columns=["age"],
    row_limit=10000,
    post_processing=[
        {
            "operation": "histogram",
            "options": {"column": "age", "bins": 25}
        }
    ]
)
```

### Filtered and Sorted Query

```python
query_object = QueryObject(
    columns=["country", "product"],
    metrics=["sum__revenue", "count"],
    filter=[
        {"col": "status", "op": "==", "val": "completed"},
        {"col": "revenue", "op": ">=", "val": 100}
    ],
    orderby=[("sum__revenue", False)],  # Descending
    row_limit=50
)
```
