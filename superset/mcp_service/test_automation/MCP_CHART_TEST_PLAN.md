# MCP Chart Tools Test Plan

This document provides a comprehensive test plan for testing the MCP chart tools with Claude Desktop.

**✅ Phase 1 Complete - Production Ready**  
Covers all 9 chart tools with optimized dashboard integration and comprehensive error handling.

## Important Test Instructions

### 🔗 **ALWAYS SHOW URLs**
When any tool returns a URL (e.g., `url`, `preview_url`, `explore_url`), **always display the complete URL** in your response. For example:
- "Chart created successfully! View it at: http://localhost:5008/explore/?slice_id=123"
- "Preview URL: http://localhost:5008/screenshot/chart/123"

### 🖼️ **EMBED IMAGES WHEN POSSIBLE**
When testing preview tools:
1. For `format: "url"` - Display the preview URL and attempt to embed the image
2. For `format: "base64"` - Decode and display the image inline
3. For `format: "ascii"` or `format: "table"` - Display the text representation in a code block

## Prerequisites

1. Ensure Superset is running locally on http://localhost:8088
2. Have at least one dataset available (e.g., "examples.births_2008" or any dataset ID)
3. Have some existing charts in your Superset instance
4. Verify MCP service is running on port 5008

## Important Schema Notes

- **Filter operator field**: Use `op` not `operator` in filter objects
- **Data format**: Use `excel` not `xlsx` for Excel export
- **Preview formats**: Only `url`, `ascii`, and `table` are supported (NOT `base64`, `interactive`, or `vega_lite`)
- **Explore Link**: Use `generate_explore_link` tool for interactive chart exploration (preferred for visualization workflows)
- **Column selection**: The `url` field is not in default columns - must be explicitly requested
- **Sort parameters**: Use `order_column` and `order_direction`, not `sort_columns`

## Test Coverage Overview

| Tool | Basic | Advanced | Error Cases | Performance | Dashboard Integration |
|------|-------|----------|-------------|-------------|---------------------|
| list_charts | ✅ | ✅ | ✅ | ✅ | - |
| get_chart_info | ✅ | ✅ | ✅ | ✅ | - |
| get_chart_available_filters | ✅ | ✅ | ✅ | - | - |
| generate_chart | ✅ | ✅ | ✅ | ✅ | ✅ |
| update_chart | ✅ | ✅ | ✅ | - | ✅ |
| update_chart_preview | ✅ | ✅ | ✅ | - | - |
| get_chart_data | ✅ | ✅ | ✅ | ✅ | - |
| get_chart_preview | ✅ | ✅ | ✅ | ✅ | - |
| generate_explore_link | ✅ | ✅ | ✅ | - | ✅ |

## 1. Test list_charts

### Basic Listing
```
Test: List all charts with default pagination
Expected: Returns first 20 charts with metadata including URLs
Action: Display the URL for at least one chart
```

### Pagination Tests
```
Test: List charts with page=2, page_size=5
Expected: Returns charts 6-10

Test: List charts with page_size=50
Expected: Returns up to 50 charts on first page

Test: List with cache control use_cache=false
Expected: Fresh data with cache_status showing cache_hit=false
```

### Search Tests
```
Test: Search for charts with search="sales"
Expected: Returns charts with "sales" in name or description

Test: Search with UUID/slug search="abc-123-def"
Expected: Searches across UUID and slug fields

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

Test: Filter with IN operator
filters=[{"col": "viz_type", "opr": "in", "value": ["line", "bar", "area"]}]
Expected: Returns charts matching any of the specified types
```

### Column Selection
```
Test: Select specific columns with select_columns=["id", "slice_name", "viz_type", "url"]
Expected: Returns only requested fields - DISPLAY THE URL

Test: Include UUID with select_columns=["id", "slice_name", "uuid", "url"]
Expected: Returns charts with UUID field populated - DISPLAY THE URL
```

### Sort Options
```
Test: Sort by name ascending order_column="slice_name", order_direction="asc"
Expected: Charts ordered alphabetically

Test: Sort by updated date order_column="changed_on", order_direction="desc"
Expected: Most recently updated charts first
```

## 2. Test get_chart_info

### Valid Chart Lookup
```
Test: Get info for existing chart by numeric ID (e.g., 1)
Expected: Returns full chart details including form_data and URLs
Action: DISPLAY the chart URL

Test: Get info for chart by UUID (if you have one)
Expected: Returns same chart info using UUID identifier
Action: DISPLAY the chart URL
```

### Error Cases
```
Test: Get info for non-existent chart ID 99999
Expected: Returns error with type "NotFound"

Test: Get info with invalid identifier "not-a-valid-id"
Expected: Returns appropriate validation error
```

## 3. Test get_chart_available_filters

### Basic Filter Discovery
```
Test: Get available filters for a chart
Request: {"identifier": 1}
Expected: Returns filterable columns with operators and current values
```

### With Current Filters
```
Test: See interaction with existing filters
Request: {"identifier": 1, "include_filter_values": true}
Expected: Shows columns, operators, and any applied filter values
```

## 4. Test generate_chart

### Table Chart Generation

#### Basic Table
```
Test: Generate simple table chart
Request:
{
  "dataset_id": 1,  // Use your dataset ID
  "config": {
    "chart_type": "table",
    "columns": [
      {"name": "region", "label": "Region"},
      {"name": "sales", "label": "Sales"}
    ]
  }
}
Expected: Creates table chart with selected columns
Action: DISPLAY THE CHART URL from response
```

#### Table with Aggregation
```
Test: Generate table with aggregated metrics
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "table",
    "columns": [
      {"name": "region", "label": "Region"},
      {"name": "sales", "label": "Total Sales", "aggregate": "SUM"},
      {"name": "quantity", "label": "Avg Quantity", "aggregate": "AVG"}
    ],
    "filters": [{"column": "year", "op": "=", "value": 2024}],
    "time_range": "Last quarter"
  }
}
Expected: Creates table with aggregated data, filtered and time-scoped
Action: DISPLAY THE CHART URL
```

#### Table with All Options
```
Test: Comprehensive table configuration
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "table",
    "columns": [
      {"name": "date", "label": "Date"},
      {"name": "category", "label": "Category"},
      {"name": "sales", "label": "Sales", "aggregate": "SUM"},
      {"name": "profit", "label": "Profit %", "aggregate": "AVG"}
    ],
    "filters": [
      {"column": "region", "op": "in", "value": ["East", "West"]},
      {"column": "sales", "op": ">", "value": 1000}
    ],
    "order_by": [
      {"column": "sales", "desc": true}
    ],
    "row_limit": 100,
    "show_totals": true,
    "conditional_formatting": [
      {
        "column": "profit",
        "op": "<",
        "value": 0,
        "color": "#FF0000"
      }
    ]
  },
  "save_chart": true,
  "slice_name": "Regional Sales Analysis"
}
Expected: Creates fully configured table
Action: DISPLAY THE CHART URL
```

### Line Chart Generation

#### Time Series Line Chart
```
Test: Generate time series line chart
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "line",
    "x": {"name": "date"},
    "y": [{"name": "sales", "aggregate": "SUM"}],
    "time_grain": "P1D",
    "time_range": "Last 30 days"
  }
}
Expected: Creates line chart with daily granularity
Action: DISPLAY THE CHART URL
```

#### Multi-Metric Line Chart
```
Test: Generate chart with multiple metrics
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "line",
    "x": {"name": "date"},
    "y": [
      {"name": "sales", "aggregate": "SUM", "label": "Total Sales"},
      {"name": "profit", "aggregate": "SUM", "label": "Total Profit"},
      {"name": "orders", "aggregate": "COUNT", "label": "Order Count"}
    ],
    "group_by": ["region"],
    "show_legend": true,
    "y_axis_format": ",.0f"
  }
}
Expected: Creates multi-line chart with grouping
Action: DISPLAY THE CHART URL
```

### Bar Chart Generation

#### Simple Bar Chart
```
Test: Generate bar chart
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "bar",
    "x": {"name": "category"},
    "y": [{"name": "sales", "aggregate": "SUM"}]
  }
}
Expected: Creates vertical bar chart
Action: DISPLAY THE CHART URL
```

#### Stacked Bar Chart
```
Test: Generate stacked bar chart
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "bar",
    "x": {"name": "month"},
    "y": [{"name": "sales", "aggregate": "SUM"}],
    "group_by": ["product_line"],
    "stack": true,
    "show_values": true
  }
}
Expected: Creates stacked bar chart with values
Action: DISPLAY THE CHART URL
```

### Area Chart Generation
```
Test: Generate area chart
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "area",
    "x": {"name": "date"},
    "y": [{"name": "revenue", "aggregate": "SUM"}],
    "group_by": ["segment"],
    "opacity": 0.7,
    "show_brush": true
  }
}
Expected: Creates area chart with brush selection
Action: DISPLAY THE CHART URL
```

### Scatter Plot Generation
```
Test: Generate scatter plot
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "scatter",
    "x": {"name": "price", "label": "Price"},
    "y": [{"name": "quantity", "label": "Quantity Sold"}],
    "size": {"name": "profit", "aggregate": "SUM"},
    "color": {"name": "category"},
    "max_bubble_size": 50
  }
}
Expected: Creates scatter plot (limited to 50 data points in ASCII preview)
Action: DISPLAY THE CHART URL
```

### Preview Without Saving
```
Test: Generate chart without saving (preview only)
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "table",
    "columns": [{"name": "region"}, {"name": "sales", "aggregate": "SUM"}]
  },
  "save_chart": false
}
Expected: Returns preview data without saving
Action: Note that no permanent URL is created
```

### Error Cases

#### Invalid Dataset
```
Test: Generate chart with non-existent dataset
Request:
{
  "dataset_id": 99999,
  "config": {
    "chart_type": "table",
    "columns": [{"name": "col1"}]
  }
}
Expected: Returns error with type "DatasetNotFound"
```

#### Invalid Column
```
Test: Generate chart with non-existent column
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "table",
    "columns": [{"name": "nonexistent_column"}]
  }
}
Expected: Returns validation error with column suggestions
Action: Note the suggested column names for next test
```

#### Invalid Aggregation
```
Test: Use SUM on text column
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "table",
    "columns": [
      {"name": "region", "aggregate": "SUM"}  // Text column with numeric aggregate
    ]
  }
}
Expected: Returns validation error about aggregate type mismatch
```

#### Missing Required Fields
```
Test: Generate chart without required x axis
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "line",
    "y": [{"name": "sales", "aggregate": "SUM"}]
    // Missing x field
  }
}
Expected: Returns validation error about missing x axis
```

## 5. Test update_chart

### Basic Update
```
Test: Update chart name and description
Request:
{
  "identifier": 1,  // Use existing chart ID
  "updates": {
    "slice_name": "Updated Chart Name",
    "description": "This chart has been updated via MCP"
  }
}
Expected: Updates chart metadata
Action: DISPLAY THE UPDATED CHART URL
```

### Update Visualization
```
Test: Update chart configuration
Request:
{
  "identifier": 1,
  "config": {
    "chart_type": "xy",
    "kind": "line",
    "x": {"name": "date"},
    "y": [{"name": "sales", "aggregate": "SUM"}]
  }
}
Expected: Updates chart with new configuration
Action: DISPLAY THE URL to see the change
```

### Update with Cache Refresh
```
Test: Update and force cache refresh
Request:
{
  "identifier": 1,
  "updates": {
    "slice_name": "Fresh Data Chart"
  },
  "force_refresh": true
}
Expected: Updates chart and refreshes cache
```

## 6. Test update_chart_preview

### Update Existing Preview
```
Test: Refresh chart preview
Request:
{
  "identifier": 1,
  "force_refresh": true
}
Expected: Regenerates preview with fresh data
Action: Note cache_status in response
```

### Update Preview Format
```
Test: Change preview settings
Request:
{
  "identifier": 1,
  "width": 1200,
  "height": 800,
  "force_refresh": true
}
Expected: Updates preview with new dimensions
```

## 7. Test get_chart_preview

### URL Preview (Screenshot)
```
Test: Get chart preview as URL
Request:
{
  "identifier": 1,  // Use existing chart ID
  "format": "url",
  "width": 800,
  "height": 600
}
Expected: Returns preview_url
Action: DISPLAY THE PREVIEW URL and attempt to embed the image:
![Chart Preview](returned_preview_url_here)
```

### Base64 Preview (Not Supported)
```
Test: Attempt to get chart as base64 image
Request:
{
  "identifier": 1,
  "format": "base64"
}
Expected: Returns error "Unsupported preview format: base64"
Action: This is an expected error - base64 format is not implemented
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
Expected: Returns ASCII representation (limited to 50 rows)
Action: Display in a code block:
```
[ASCII art will appear here]
```

### Table Preview
```
Test: Get chart data as formatted table
Request:
{
  "identifier": 1,
  "format": "table",
  "max_rows": 10
}
Expected: Returns tabular data (limited to 20 rows)
Action: Display the table in a formatted code block
```

### Cache Control in Preview
```
Test: Force fresh preview
Request:
{
  "identifier": 1,
  "format": "url",
  "force_refresh": true,
  "cache_timeout": 0
}
Expected: Returns fresh preview with cache_hit=false
Action: DISPLAY THE PREVIEW URL
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

Test: Invalid format
Request:
{
  "identifier": 1,
  "format": "invalid_format"
}
Expected: Returns error "Unsupported preview format: invalid_format"

Test: Unsupported format (base64)
Request:
{
  "identifier": 1,
  "format": "base64"
}
Expected: Returns error "Unsupported preview format: base64"
```

## 8. Test get_chart_data

### Basic Data Retrieval
```
Test: Get data for existing chart
Request:
{
  "identifier": 1,
  "format": "json",
  "limit": 100
}
Expected: Returns chart data with metadata
Action: Display sample of data and note total_rows
```

### CSV Export
```
Test: Get data as CSV
Request:
{
  "identifier": 1,
  "format": "csv"
}
Expected: Returns CSV formatted data
Action: Display first few lines of CSV
```

### Excel Export  
```
Test: Get data as Excel
Request:
{
  "identifier": 1,
  "format": "excel"  // Note: use "excel" not "xlsx"
}
Expected: Returns base64 encoded Excel file
Action: Note that Excel file was generated
```

### With Additional Processing
```
Test: Get data with insights
Request:
{
  "identifier": 1,
  "format": "json",
  "include_column_metadata": true,
  "generate_insights": true,
  "limit": 50
}
Expected: Returns data with column analysis and insights
Action: Display the insights and column metadata
```

### Cache Control
```
Test: Force fresh data
Request:
{
  "identifier": 1,
  "format": "json",
  "force_refresh": true,
  "use_cache": false
}
Expected: Returns fresh data with cache_hit=false
Action: Note the cache_status details
```

### Big Number Chart Handling
```
Test: Get data for big_number chart type
Request:
{
  "identifier": [ID of a big_number chart],
  "format": "json"
}
Expected: Should handle appropriately or return specific error
```

## 9. Integration Test Scenarios

### Complete Chart Lifecycle
```
1. Generate a new chart with save_chart=true
   - DISPLAY THE CHART URL
2. Use returned chart_id to get_chart_info
   - Verify all details match
3. Update the chart with update_chart
   - DISPLAY THE UPDATED URL
4. Get preview in multiple formats
   - DISPLAY URL preview and embed image
   - Show ASCII preview in code block
5. Get chart data in JSON and CSV formats
   - Display sample data
6. Update chart preview with new dimensions
   - DISPLAY new preview URL
```

### Error Recovery Flow
```
1. Try to generate chart with invalid column
   - Note the error and suggestions
2. Use list_datasets to find correct dataset
3. Use get_dataset_info to see columns
4. Generate chart with correct column names
   - DISPLAY THE SUCCESSFUL CHART URL
```

### Cache Testing Flow
```
1. Get chart data with use_cache=true
   - Note cache_hit status
2. Get same data again
   - Verify cache_hit=true
3. Get data with force_refresh=true
   - Verify cache_hit=false
4. Check cache_age_seconds values
```

### Multi-Format Export
```
1. Create a complex chart with multiple metrics
   - DISPLAY THE CHART URL
2. Export as:
   - JSON (display sample)
   - CSV (display headers)
   - Excel (note generation)
3. Get preview as:
   - URL (embed image)
   - ASCII (show in code block)
   - Table (display formatted)
```

## 10. Performance and Load Tests

### Large Dataset Handling
```
Test: Generate chart with row_limit=10000
Expected: Handles gracefully, returns data or appropriate limit

Test: Get data with limit=50000
Expected: Returns data or indicates maximum allowed
```

### Concurrent Operations
```
Test: Generate 5 charts rapidly in sequence
Expected: All succeed without conflicts
Action: DISPLAY ALL CHART URLs
```

### Complex Aggregations
```
Test: Chart with multiple groupings and aggregations
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "table",
    "columns": [
      {"name": "region"},
      {"name": "category"},
      {"name": "sales", "aggregate": "SUM"},
      {"name": "sales", "aggregate": "AVG", "label": "Avg Sale"},
      {"name": "sales", "aggregate": "MAX", "label": "Max Sale"},
      {"name": "sales", "aggregate": "MIN", "label": "Min Sale"},
      {"name": "sales", "aggregate": "COUNT", "label": "Sale Count"}
    ],
    "order_by": [{"column": "sales", "desc": true}],
    "row_limit": 500
  }
}
Expected: Handles complex aggregations efficiently
Action: DISPLAY THE CHART URL
```

## 11. Test generate_explore_link (Preferred Tool)

### Basic Explore Link Generation
```
Test: Generate explore link for line chart
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "xy",
    "kind": "line",
    "x": {"name": "date"},
    "y": [{"name": "sales", "aggregate": "SUM"}]
  }
}
Expected: Returns explore_url and form_data_key
Action: DISPLAY THE EXPLORE URL - this is the preferred way to create visualizations
```

### Complex Chart Configuration
```
Test: Generate explore link with full configuration
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "xy",
    "kind": "bar",
    "x": {"name": "category"},
    "y": [
      {"name": "sales", "aggregate": "SUM", "label": "Total Sales"},
      {"name": "profit", "aggregate": "AVG", "label": "Avg Profit"}
    ],
    "group_by": {"name": "region"},
    "filters": [
      {"column": "year", "op": "=", "value": 2024}
    ],
    "legend": {"show": true, "position": "top"},
    "y_axis": {"format": "$,.0f", "title": "Revenue"}
  }
}
Expected: Returns explore URL with all parameters configured
Action: DISPLAY THE EXPLORE URL for interactive editing
```

### Table Chart Explore Link
```
Test: Generate explore link for table visualization
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "table",
    "columns": [
      {"name": "region"},
      {"name": "sales", "aggregate": "SUM"},
      {"name": "profit", "aggregate": "AVG"}
    ],
    "filters": [
      {"column": "region", "op": "!=", "value": "Unknown"}
    ],
    "sort_by": ["sales"]
  }
}
Expected: Returns explore URL for table configuration
Action: DISPLAY THE EXPLORE URL
```

### With Cache Control
```
Test: Generate explore link with cache control
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "xy",
    "kind": "line",
    "x": {"name": "date"},
    "y": [{"name": "metric", "aggregate": "SUM"}]
  },
  "use_cache": false,
  "force_refresh": true
}
Expected: Returns explore URL with fresh data
Action: Note form_data_key for subsequent updates
```

### Error Cases
```
Test: Invalid dataset
Request:
{
  "dataset_id": 99999,
  "config": {
    "chart_type": "xy",
    "kind": "line",
    "x": {"name": "date"},
    "y": [{"name": "value"}]
  }
}
Expected: Returns error with dataset not found

Test: Invalid column reference
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "xy",
    "kind": "line",
    "x": {"name": "nonexistent_column"},
    "y": [{"name": "sales"}]
  }
}
Expected: Returns validation error with column suggestions
```

## 12. Dashboard Integration Tests

### Test generate_dashboard with Chart Integration
```
Test: Create dashboard with multiple charts
Request:
{
  "chart_ids": [1, 2, 3, 4],  // Use existing chart IDs
  "dashboard_title": "MCP Test Dashboard",
  "description": "Generated via MCP for testing optimized layouts",
  "published": true
}
Expected: Creates dashboard with 2-chart rows using 5-unit width layouts
Action: DISPLAY THE DASHBOARD URL and verify layout quality
```

### Test add_chart_to_existing_dashboard
```
Test: Add chart to existing dashboard
Request:
{
  "dashboard_id": [existing_dashboard_id],
  "chart_id": [new_chart_id]
}
Expected: Adds chart with optimized positioning and proper dimensions
Action: DISPLAY THE UPDATED DASHBOARD URL and check layout
```

### Test Dashboard Layout Optimization
```
Test: Create dashboard and verify chart proportions
1. Generate dashboard with 6 charts
   - Expected: 3 rows of 2 charts each
   - Chart dimensions: 5 width × 50 height units
   - DISPLAY THE DASHBOARD URL
2. Verify charts are properly sized (not too wide/narrow)
3. Check responsive behavior across screen sizes
```

### Test Chart-to-Dashboard Workflow
```
Complete Integration Test:
1. Generate 2 new charts using generate_chart
   - DISPLAY BOTH CHART URLs
2. Create dashboard with these charts using generate_dashboard
   - DISPLAY THE DASHBOARD URL
3. Generate 1 more chart
   - DISPLAY THE NEW CHART URL
4. Add new chart to dashboard using add_chart_to_existing_dashboard
   - DISPLAY THE UPDATED DASHBOARD URL
5. Verify all charts display properly with optimized layouts
```

## 13. Special Cases and Edge Cases

### Unicode and Special Characters
```
Test: Chart with unicode in name
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "table",
    "columns": [{"name": "region"}]
  },
  "slice_name": "Sales 销售 🌏 Report"
}
Expected: Handles unicode correctly
Action: DISPLAY THE CHART URL with unicode name
```

### Very Long Names
```
Test: Chart with very long name
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "table",
    "columns": [{"name": "region"}]
  },
  "slice_name": "This is a very long chart name that exceeds typical length limits and should be handled gracefully by the system without causing any errors or truncation issues"
}
Expected: Handles or truncates appropriately
```

### SQL Injection Prevention
```
Test: Attempt SQL injection in filter
Request:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "table",
    "columns": [{"name": "region"}],
    "filters": [{"column": "region", "op": "=", "value": "'; DROP TABLE users; --"}]
  }
}
Expected: Safely handles without executing SQL
```

## Expected Response Patterns

### Successful Chart Creation
```json
{
  "chart": {
    "id": 123,
    "slice_name": "My Chart",
    "viz_type": "table",
    "url": "http://localhost:5008/explore/?slice_id=123",
    "uuid": "abc-123-def",
    "saved": true
  },
  "success": true
}
```
**Action: ALWAYS DISPLAY THE URL**

### Successful Preview
```json
{
  "chart_id": 123,
  "format": "url",
  "content": {
    "type": "url",
    "preview_url": "http://localhost:5008/screenshot/chart/123",
    "expires_at": "2024-01-01T12:00:00Z"
  }
}
```
**Action: DISPLAY AND EMBED THE preview_url**

### Validation Error
```json
{
  "error": "validation_error",
  "message": "Chart configuration validation failed",
  "validation_errors": [
    {
      "field": "columns[0]",
      "error_type": "column_not_found",
      "message": "Column 'nonexistent' not found",
      "suggestions": ["region", "sales", "profit"]
    }
  ]
}
```

### Data Response with Cache Info
```json
{
  "chart_id": 123,
  "data": [],
  "row_count": 100,
  "total_rows": 5000,
  "cache_status": {
    "cache_hit": true,
    "cache_type": "query",
    "cache_age_seconds": 300
  },
  "insights": ["Data served from cache", "Large dataset - consider filtering"]
}
```

## Test Execution Checklist

- [ ] Environment setup verified
- [ ] Basic CRUD operations tested
- [ ] All chart types tested
- [ ] Error handling verified
- [ ] Cache behavior confirmed
- [ ] Preview formats working
- [ ] URLs displayed for all operations
- [ ] Images embedded where possible
- [ ] Performance acceptable
- [ ] Edge cases handled
- [ ] Dashboard integration tested
- [ ] Chart layout optimization verified
- [ ] Dashboard URLs properly generated
- [ ] Chart-to-dashboard workflow validated

## Debugging Tips

1. **Always display returned URLs** - They're crucial for verification
2. **For image previews** - Try to embed using markdown: `![Preview](url)`
3. **For errors** - Show the complete error response
4. **For data** - Show a representative sample, not everything
5. **Check cache_status** - Helps understand performance
6. **Save successful IDs** - Reuse for subsequent tests
7. **Note patterns** - Errors often reveal API patterns

## Summary Report Template

After running tests, summarize:

```
Test Summary for MCP Chart Tools
================================
Total Tests Run: X
Passed: X
Failed: X

Working Features:
- ✅ Chart Creation (with URL: ...)
- ✅ Dashboard Generation (with URL: ...)
- ✅ Chart Previews (with preview: ...)
- ✅ Dashboard Layout Optimization
- ✅ Multi-format Data Export

Issues Found:
- ❌ Issue 1: Description
- ❌ Issue 2: Description

Performance Notes:
- Average response time: Xs
- Cache hit rate: X%
- Dashboard layout quality: Excellent/Good/Needs improvement

Dashboard Integration:
- Chart positioning: Optimized/Standard
- Layout responsiveness: Excellent/Good/Poor
- Chart proportions: Proper/Too wide/Too narrow

Recommendations:
- ...
```
