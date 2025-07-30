# MCP Chart Tools Test Plan

This document provides a comprehensive test plan for testing the MCP chart tools with Claude Desktop.

## Prerequisites

1. Ensure Superset is running locally on http://localhost:8088
2. Have at least one dataset available (e.g., "examples.births_2008" or any dataset ID)
3. Have some existing charts in your Superset instance

## 1. Test list_charts

### Basic Listing
```
Test: List all charts with default pagination
Expected: Returns first 20 charts with metadata
```

### Pagination Tests
```
Test: List charts with page=2, page_size=5
Expected: Returns charts 6-10

Test: List charts with page_size=50
Expected: Returns up to 50 charts on first page
```

### Search Tests
```
Test: Search for charts with search="sales"
Expected: Returns charts with "sales" in name or description

Test: Search with no results search="xyz123nonexistent"
Expected: Returns empty list with count=0
```

### Filter Tests
```
Test: Filter by viz_type with filters=[{"col": "viz_type", "opr": "eq", "value": "table"}]
Expected: Returns only table charts

Test: Filter by multiple conditions
filters=[
  {"col": "viz_type", "opr": "eq", "value": "line"},
  {"col": "datasource_name", "opr": "sw", "value": "births"}
]
Expected: Returns line charts from births dataset
```

### Column Selection
```
Test: Select specific columns with select_columns=["id", "slice_name", "viz_type"]
Expected: Returns only requested fields

Test: Include UUID with select_columns=["id", "slice_name", "uuid"]
Expected: Returns charts with UUID field populated
```

## 2. Test get_chart_info

### Valid Chart Lookup
```
Test: Get info for existing chart by numeric ID (e.g., 1)
Expected: Returns full chart details including form_data

Test: Get info for chart by UUID (if you have one)
Expected: Returns same chart info using UUID identifier
```

### Error Cases
```
Test: Get info for non-existent chart ID 99999
Expected: Returns error with type "not_found"

Test: Get info with invalid identifier "not-a-valid-id"
Expected: Returns appropriate error
```

## 3. Test generate_chart

### Table Chart Generation

#### Basic Table
```
Test: Generate simple table chart
Request:
{
  "dataset_id": "1",  // Use your dataset ID
  "config": {
    "chart_type": "table",
    "columns": [
      {"name": "region", "label": "Region"},
      {"name": "sales", "label": "Sales"}
    ]
  }
}
Expected: Creates table chart with selected columns
```

#### Table with Aggregation
```
Test: Generate table with aggregated metrics
Request:
{
  "dataset_id": "1",
  "config": {
    "chart_type": "table",
    "columns": [
      {"name": "region", "label": "Region"},
      {"name": "sales", "label": "Total Sales", "aggregate": "SUM"},
      {"name": "quantity", "label": "Avg Quantity", "aggregate": "AVG"}
    ],
    "filters": [{"column": "year", "op": "=", "value": "2024"}],
    "sort_by": ["sales"]
  }
}
Expected: Creates table with aggregated data, filtered and sorted
```

### XY Chart Generation

#### Line Chart
```
Test: Generate time series line chart
Request:
{
  "dataset_id": "1",
  "config": {
    "chart_type": "xy",
    "x": {"name": "date"},
    "y": [{"name": "sales", "aggregate": "SUM"}],
    "kind": "line",
    "x_axis": {"title": "Date", "format": "smart_date"},
    "y_axis": {"title": "Sales", "format": "$,.2f"}
  }
}
Expected: Creates line chart with formatted axes
```

#### Bar Chart with Grouping
```
Test: Generate grouped bar chart
Request:
{
  "dataset_id": "1",
  "config": {
    "chart_type": "xy",
    "x": {"name": "region"},
    "y": [{"name": "sales", "aggregate": "SUM"}],
    "kind": "bar",
    "group_by": {"name": "category"},
    "legend": {"show": true, "position": "top"}
  }
}
Expected: Creates grouped bar chart with legend
```

#### Multi-Series Chart
```
Test: Generate chart with multiple Y values
Request:
{
  "dataset_id": "1",
  "config": {
    "chart_type": "xy",
    "x": {"name": "date"},
    "y": [
      {"name": "sales", "aggregate": "SUM", "label": "Total Sales"},
      {"name": "profit", "aggregate": "SUM", "label": "Total Profit"},
      {"name": "quantity", "aggregate": "COUNT", "label": "Order Count"}
    ],
    "kind": "line"
  }
}
Expected: Creates multi-line chart with three series
```

### Preview Options
```
Test: Generate chart without saving (preview only)
Request:
{
  "dataset_id": "1",
  "config": {
    "chart_type": "table",
    "columns": [{"name": "region"}]
  },
  "save_chart": false,
  "generate_preview": true,
  "preview_formats": ["url", "ascii", "table"]
}
Expected: Returns temporary chart with preview data but doesn't save
```

### Error Cases

#### Invalid Dataset
```
Test: Generate chart with non-existent dataset
Request:
{
  "dataset_id": "99999",
  "config": {
    "chart_type": "table",
    "columns": [{"name": "col1"}]
  }
}
Expected: Returns error with type "dataset_not_found"
```

#### Invalid Column
```
Test: Generate chart with non-existent column
Request:
{
  "dataset_id": "1",
  "config": {
    "chart_type": "table",
    "columns": [{"name": "nonexistent_column"}]
  }
}
Expected: Returns validation error with column suggestions
```

#### Invalid Aggregation
```
Test: Use SUM on text column
Request:
{
  "dataset_id": "1",
  "config": {
    "chart_type": "table",
    "columns": [
      {"name": "region", "aggregate": "SUM"}  // Text column with numeric aggregate
    ]
  }
}
Expected: Returns validation error about aggregate type mismatch
```

## 4. Test get_chart_preview

### URL Preview (Default)
```
Test: Get chart preview as URL
Request:
{
  "identifier": 1,  // Use existing chart ID
  "format": "url",
  "width": 800,
  "height": 600
}
Expected: Returns preview_url pointing to screenshot endpoint
```

### ASCII Preview
```
Test: Get chart as ASCII art
Request:
{
  "identifier": 1,
  "format": "ascii",
  "ascii_width": 80,
  "ascii_height": 20
}
Expected: Returns ASCII representation of chart
```

### Table Preview
```
Test: Get chart data as formatted table
Request:
{
  "identifier": 1,
  "format": "table"
}
Expected: Returns tabular data with row count
```

### Different Identifiers
```
Test: Get preview by UUID
Request:
{
  "identifier": "chart-uuid-here",
  "format": "url"
}
Expected: Returns preview for same chart using UUID
```

### Error Cases
```
Test: Get preview for non-existent chart
Request:
{
  "identifier": 99999,
  "format": "url"
}
Expected: Returns error with type "NotFound"
```

## 5. Test get_chart_data

### Basic Data Retrieval
```
Test: Get data for existing chart
Request:
{
  "identifier": 1,
  "format": "records",
  "limit": 100
}
Expected: Returns chart data as list of records
```

### Different Formats
```
Test: Get data as columns format
Request:
{
  "identifier": 1,
  "format": "columns"
}
Expected: Returns data organized by columns

Test: Get data as split format
Request:
{
  "identifier": 1,
  "format": "split"
}
Expected: Returns data with separate columns and data arrays
```

### With Filters
```
Test: Get filtered data
Request:
{
  "identifier": 1,
  "filters": [{"column": "year", "op": "=", "value": "2024"}],
  "limit": 50
}
Expected: Returns filtered subset of data
```

### Pagination
```
Test: Get paginated data
Request:
{
  "identifier": 1,
  "limit": 20,
  "offset": 40
}
Expected: Returns rows 41-60
```

## 6. Integration Test Scenarios

### Create and Preview Workflow
```
1. Generate a new chart with save_chart=true
2. Use the returned chart ID to get_chart_info
3. Use the chart ID to get_chart_preview in different formats
4. Use the chart ID to get_chart_data
Expected: All operations work with the newly created chart
```

### Validation Error Recovery
```
1. Try to generate chart with invalid column
2. Use the suggestions from error to find correct column names
3. Generate chart with corrected column names
Expected: Second attempt succeeds after using suggestions
```

### Dataset Discovery Flow
```
1. List available datasets (if you have list_datasets tool)
2. Get dataset info to see available columns
3. Generate chart using discovered columns
Expected: Chart creation succeeds with proper column names
```

## 7. Performance and Edge Cases

### Large Data Handling
```
Test: Generate chart with large dataset (if available)
Expected: Chart generates within reasonable time

Test: Get data with high limit (e.g., limit=10000)
Expected: Returns data or appropriate error/warning
```

### Special Characters
```
Test: Generate chart with columns containing spaces/special chars
Request:
{
  "dataset_id": "1",
  "config": {
    "chart_type": "table",
    "columns": [{"name": "column with spaces"}]
  }
}
Expected: Handles special characters correctly
```

### Concurrent Requests
```
Test: Generate multiple charts rapidly
Expected: All charts created successfully without conflicts
```

## Expected Error Patterns

When tests fail, you should see structured errors like:

```json
{
  "error_type": "validation_error",
  "message": "Chart configuration validation failed",
  "validation_errors": [...],
  "suggestions": [...]
}
```

Or for not found errors:
```json
{
  "error_type": "not_found",
  "message": "Chart not found",
  "details": "..."
}
```

## Notes for Testing

1. Start with simple tests and progress to complex ones
2. Save the IDs of created charts for use in other tests
3. Test both numeric IDs and UUIDs where applicable
4. Pay attention to the structure of returned data
5. Verify that preview URLs actually work when accessed
6. Check that ASCII/table previews are readable and useful

## Debugging Tips

If tests fail:
1. Check if the dataset_id is valid
2. Verify column names match exactly (case-sensitive)
3. Ensure Superset is running and accessible
4. Check for any authentication issues
5. Look at the detailed error messages and suggestions
