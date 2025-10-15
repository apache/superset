# Chart Data Request Flow in Apache Superset

This document traces the complete path of a chart data request through the Superset backend, from API endpoint to database query and back.

## Overview

When a client requests chart data (e.g., loading a histogram chart), the request flows through multiple layers:

1. API Endpoint
2. Schema Validation/Parsing
3. Command Pattern (Business Logic)
4. Query Context Processing
5. Database Execution
6. Post-Processing
7. Response Formatting

## Detailed Flow

### 1. Entry Point: API Endpoint

**File**: `superset/charts/data/api.py:187`

**Endpoint**: `POST /api/v1/chart/data`

The request hits `ChartDataRestApi.data()` method which:
- Parses the JSON body from the request
- Creates a `QueryContext` object from the form data via `ChartDataQueryContextSchema`
- Creates a `ChartDataCommand` to execute the query
- Validates and executes the command

```python
def data(self) -> Response:
    json_body = request.json
    query_context = self._create_query_context_from_form(json_body)
    command = ChartDataCommand(query_context)
    command.validate()
    return self._get_data_response(command, ...)
```

### 2. Schema Layer: Request Parsing

**File**: `superset/charts/schemas.py:1384`

`ChartDataQueryContextSchema.load()` deserializes the request into:

**QueryContext object** (the main container):
- datasource: Database table/query info
- queries: List of query objects
- result_format: JSON/CSV/XLSX
- result_type: FULL/SAMPLES/QUERY/etc
- force: Whether to bypass cache

**List of QueryObject instances** (one per query in the request):
- columns: Columns to select (e.g., ["age"])
- metrics: Aggregations to compute
- filters: WHERE clause filters
- post_processing: Client-side transformations (e.g., histogram with bins=25)

### 3. Command Pattern: Business Logic

**File**: `superset/commands/chart/data/get_data_command.py:39`

`ChartDataCommand.run()` orchestrates the execution:

```python
def run(self, **kwargs: Any) -> dict[str, Any]:
    payload = self._query_context.get_payload(
        cache_query_context=cache_query_context,
        force_cached=force_cached
    )

    for query in payload["queries"]:
        if query.get("error"):
            raise ChartDataQueryFailedError(query["error"])

    return {
        "query_context": self._query_context,
        "queries": payload["queries"]
    }
```

### 4. Query Context Processor: Core Execution

**File**: `superset/common/query_context_processor.py:1052`

`QueryContextProcessor.get_payload()`:
- Iterates through each `QueryObject` in `query_context.queries`
- For each query, calls `get_query_results()` which routes based on result_type:
  - `FULL` → `_get_full()` → `get_df_payload()`
  - `SAMPLES` → `_get_samples()`
  - `QUERY` → `_get_query()`

**File**: `superset/common/query_context_processor.py:128`

`QueryContextProcessor.get_df_payload()`:

1. **Generate cache key** from query object
2. **Check cache** using `QueryCacheManager`
3. **If cache miss**:
   - Validate columns exist in datasource
   - Call `get_query_result(query_obj)` to execute SQL
   - Get annotation data if needed
   - Cache the result with appropriate timeout
4. **Return payload** with DataFrame and metadata

```python
def get_df_payload(self, query_obj, force_cached=False):
    cache_key = self.query_cache_key(query_obj)
    timeout = self.get_cache_timeout()
    cache = QueryCacheManager.get(key=cache_key, ...)

    if not cache.is_loaded:
        query_result = self.get_query_result(query_obj)
        annotation_data = self.get_annotation_data(query_obj)
        cache.set_query_result(...)

    return {
        "cache_key": cache_key,
        "df": cache.df,
        "query": cache.query,
        "is_cached": cache.is_cached,
        ...
    }
```

### 5. Database Query Execution

**File**: `superset/common/query_context_processor.py:267`

`QueryContextProcessor.get_query_result()`:

```python
def get_query_result(self, query_object: QueryObject) -> QueryResult:
    # Execute SQL query on the datasource
    result = query_context.datasource.query(query_object.to_dict())
    df = result.df

    # Normalize timestamps to pandas datetime format
    if not df.empty:
        df = self.normalize_df(df, query_object)

        # Handle time offset comparisons if specified
        if query_object.time_offsets:
            time_offsets = self.processing_time_offsets(df, query_object)
            df = time_offsets["df"]

        # Apply post-processing operations
        df = query_object.exec_post_processing(df)

    result.df = df
    return result
```

The `datasource.query()` call goes to your database connector (e.g., `SqlaTable.query()`) which:
- Converts the QueryObject dict to SQL using SQLAlchemy
- Executes the query via database engine
- Returns a `QueryResult` with a pandas DataFrame

### 6. Post-Processing

**File**: `superset/common/query_object.py:484`

`QueryObject.exec_post_processing()`:
- Applies operations from `post_processing` list in sequence
- Each operation is a pandas transformation (e.g., pivot, aggregate, histogram)
- Uses functions from `superset.utils.pandas_postprocessing`

Example for histogram:
```python
def exec_post_processing(self, df: DataFrame) -> DataFrame:
    for post_process in self.post_processing:
        operation = post_process.get("operation")  # "histogram"
        options = post_process.get("options", {})  # {column: "age", bins: 25}
        df = getattr(pandas_postprocessing, operation)(df, **options)
    return df
```

### 7. Response Formatting

**File**: `superset/charts/data/api.py:346`

`ChartDataRestApi._send_chart_response()`:
- Takes the result dict from command
- Formats based on `result_format`:
  - **JSON**: Converts DataFrame to list of dicts
  - **CSV**: Converts to CSV string
  - **XLSX**: Converts to Excel binary
- Returns Flask Response with appropriate headers

```python
def _send_chart_response(self, result, form_data=None, datasource=None):
    result_format = result["query_context"].result_format

    if result_format == ChartDataResultFormat.JSON:
        queries = result["queries"]
        response_data = json.dumps(
            {"result": queries},
            default=json.json_int_dttm_ser,
            ignore_nan=True,
        )
        resp = make_response(response_data, 200)
        resp.headers["Content-Type"] = "application/json; charset=utf-8"
        return resp
```

## Key Objects and Data Structures

### QueryContext

**File**: `superset/common/query_context.py:41`

The main container for a chart data request.

```python
{
    datasource: BaseDatasource,           # Dataset (e.g., id=19, type="table")
    queries: list[QueryObject],           # List of queries to execute
    result_type: ChartDataResultType,     # "full", "samples", "query", etc.
    result_format: ChartDataResultFormat, # "json", "csv", "xlsx"
    force: bool,                          # Bypass cache flag
    form_data: dict,                      # Original form_data from client
    custom_cache_timeout: int | None      # Override cache timeout
}
```

### QueryObject

**File**: `superset/common/query_object.py:79`

Represents a single database query.

```python
{
    columns: list[Column],              # Columns to select ["age"]
    metrics: list[Metric] | None,       # Aggregations to compute
    filters: list[FilterClause],        # WHERE clause filters
    extras: dict[str, Any],            # Additional query options
    post_processing: list[dict],        # Client-side transformations
    row_limit: int | None,             # LIMIT clause
    row_offset: int,                   # OFFSET clause
    order_desc: bool,                  # Sort direction
    time_range: str | None,            # Time filter range
    granularity: str | None,           # Temporal grouping column
    annotation_layers: list[dict],      # Annotations to overlay
    from_dttm: datetime | None,        # Computed time range start
    to_dttm: datetime | None           # Computed time range end
}
```

### QueryResult

**File**: `superset/models/helpers.py`

Returned from `datasource.query()`.

```python
{
    df: pd.DataFrame,          # The data from database
    query: str,                # Executed SQL query
    from_dttm: datetime,       # Time range start
    to_dttm: datetime,         # Time range end
    error: str | None,         # Error message if failed
    status: QueryStatus        # success, failed, etc.
}
```

## Example Request Flow

For a histogram chart request like:

```bash
curl 'https://example.com/api/v1/chart/data' \
  -H 'content-type: application/json' \
  --data-raw '{
    "datasource":{"id":19,"type":"table"},
    "queries":[{
      "columns":["age"],
      "filters":[{
        "col":"time_start",
        "op":"TEMPORAL_RANGE",
        "val":"No filter"
      }],
      "row_limit":10000,
      "post_processing":[{
        "operation":"histogram",
        "options":{"column":"age","bins":25}
      }]
    }],
    "result_format":"json",
    "result_type":"full"
  }'
```

### Flow Summary

```
Client Request (curl)
  ↓
ChartDataRestApi.data()
  ↓ (parses JSON)
ChartDataQueryContextSchema.load()
  ↓ (creates objects)
QueryContext + [QueryObject]
  ↓
ChartDataCommand.run()
  ↓
QueryContextProcessor.get_payload()
  ↓ (for each QueryObject)
get_query_results() → _get_full()
  ↓
get_df_payload()
  ├→ Check Cache (QueryCacheManager)
  └→ get_query_result()
       ├→ datasource.query() → Build SQL → Execute → pandas DataFrame
       ├→ normalize_df() → Timestamp normalization
       └→ exec_post_processing() → Apply histogram operation
  ↓
Return payload {df, query, metadata}
  ↓
_send_chart_response()
  ↓ (format as JSON)
Flask Response → Client
```

## Architecture Patterns

The codebase follows clean separation of concerns:

1. **API Layer** (`superset/charts/data/api.py`): Handles HTTP requests/responses
2. **Schema Layer** (`superset/charts/schemas.py`): Validates and deserializes input
3. **Command Layer** (`superset/commands/`): Orchestrates business logic
4. **Query Context/Processor** (`superset/common/`): Manages execution and caching
5. **Query Object**: Represents individual database queries
6. **Datasource Layer** (`superset/connectors/`): Database abstraction and SQL generation

### Key Benefits

- **Caching**: Results cached at multiple levels (query result, query context)
- **Security**: Access control enforced via `raise_for_access()`
- **Flexibility**: Supports multiple result types and formats
- **Post-processing**: Client-side transformations without re-querying database
- **Time Comparison**: Built-in support for time offset queries
- **Annotations**: Overlay additional data layers on charts

## Caching Strategy

**File**: `superset/common/utils/query_cache_manager.py`

Cache keys are generated from:
- Query object (columns, metrics, filters, etc.)
- Datasource UID
- RLS (Row Level Security) rules
- User context (if per-user caching enabled)
- Time range (using relative time strings, not absolute timestamps)

This ensures that:
- Same query returns cached results
- Different users see appropriate cached data
- Time-relative queries (e.g., "Last 7 days") cache correctly
