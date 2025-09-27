# Superset Entity Testing Plan

## Overview
This plan provides a systematic approach to test all parameter combinations for Superset list endpoints (`list_datasets`, `list_charts`, `list_dashboards`, etc.). Each test validates different aspects of the API functionality.

## Prerequisites
1. Access to Superset MCP Proxy tools
2. At least 10+ entities in the target category for meaningful testing
3. Knowledge of available filter fields (use `get_[entity]_available_filters` first)

## Test Execution Steps

### Step 0: Preparation
**Get Available Filters**
```
Tool: get_[entity]_available_filters
Purpose: Understand filterable fields and supported operators
```

### Step 1: Basic Default Parameters
**Objective:** Validate basic functionality with minimal parameters
```json
{}
```
**Validates:**
- Default pagination (page 1, page_size 100)
- Default ordering (usually by changed_on desc)
- Total count and basic entity structure

### Step 2: Pagination Parameters
**Objective:** Test pagination controls
```json
{"page": 2, "page_size": 5}
```
**Validates:**
- Custom page size working
- Page navigation
- Pagination metadata (total_pages, has_next, has_previous)

### Step 3: Ordering Parameters
**Objective:** Test sorting functionality
```json
{"page_size": 10, "order_column": "[sortable_field]", "order_direction": "asc"}
```
**Common sortable fields:**
- Datasets: `table_name`, `id`, `changed_on`, `created_on`
- Charts: `slice_name`, `id`, `changed_on`, `created_on`  
- Dashboards: `dashboard_title`, `id`, `changed_on`, `created_on`

**Validates:**
- Custom sorting working
- Result order matches requested direction

### Step 4: Text Search
**Objective:** Test search functionality
```json
{"search": "[common_term]", "page_size": 5}
```
**Common search terms:**
- Datasets: "birth", "sales", "user"
- Charts: "revenue", "sales", "time"
- Dashboards: "dashboard", "overview"

**Validates:**
- Search filtering working
- Reduced total_count from filtering

### Step 5: Basic Filters
**Objective:** Test single filter functionality
```json
{"filters": [{"col": "[filter_field]", "opr": "eq", "value": "[filter_value]"}], "page_size": 5}
```
**Common filters:**
- Datasets: `{"col": "schema", "opr": "eq", "value": "main"}`
- Charts: `{"col": "viz_type", "opr": "eq", "value": "line"}`
- Dashboards: `{"col": "published", "opr": "eq", "value": true}`

**Validates:**
- Single filter application
- `filters_applied` metadata
- Filtered result count

### Step 6: Multiple Filters with Different Operators
**Objective:** Test multiple filters and different operators
```json
{
  "filters": [
    {"col": "[field1]", "opr": "sw", "value": "[prefix]"},
    {"col": "[field2]", "opr": "eq", "value": "[exact_value]"}
  ],
  "page_size": 5
}
```
**Example combinations:**
- Datasets: `table_name` starts with + `schema` equals
- Charts: `slice_name` starts with + `viz_type` equals
- Dashboards: `dashboard_title` contains + `published` equals

**Validates:**
- Multiple filter combination (AND logic)
- Different operator types working
- Complex filtering accuracy

### Step 7: Custom Column Selection
**Objective:** Test selective field retrieval
```json
{"page_size": 8, "select_columns": ["id", "[name_field]", "[key_fields]"]}
```
**Common column selections:**
- Datasets: `["id", "table_name", "database_name", "is_virtual"]`
- Charts: `["id", "slice_name", "viz_type", "datasource_name"]`
- Dashboards: `["id", "dashboard_title", "published", "slug"]`

**Validates:**
- Column selection working
- `columns_requested` vs `columns_loaded` metadata
- Response structure with limited fields

### Step 8: Cache Control Parameters
**Objective:** Test caching behavior
```json
{"page_size": 3, "use_cache": false, "force_refresh": true}
```
**Validates:**
- Cache bypass functionality
- Fresh data retrieval
- Performance impact of cache settings

### Step 9: Metadata Refresh Parameters
**Objective:** Test metadata refresh functionality
```json
{
  "page_size": 4,
  "order_column": "id",
  "order_direction": "asc",
  "refresh_metadata": true
}
```
**Validates:**
- Metadata refresh working
- Fresh schema/column information
- Impact on response completeness

### Step 10: Complex Parameter Combination
**Objective:** Test all parameter types working together
```json
{
  "page": 2,
  "filters": [{"col": "[field]", "opr": "like", "value": "%[pattern]%"}],
  "page_size": 3,
  "use_cache": false,
  "order_column": "changed_on",
  "force_refresh": true,
  "order_direction": "desc",
  "refresh_metadata": true
}
```
**Validates:**
- Complex parameter interaction
- No conflicts between parameter types
- All functionality working simultaneously

## Entity-Specific Adaptations

### For Datasets (`list_datasets`)
- **Tool:** `Superset MCP Proxy:list_datasets`
- **Filter prep:** `get_dataset_available_filters`
- **Key fields:** `table_name`, `schema`, `database_name`
- **Search terms:** Table/dataset names
- **Common filters:** `schema`, `table_name`, `owner`

### For Charts (`list_charts`)
- **Tool:** `Superset MCP Proxy:list_charts`
- **Filter prep:** `get_chart_available_filters`  
- **Key fields:** `slice_name`, `viz_type`, `datasource_name`
- **Search terms:** Chart names, visualization types
- **Common filters:** `viz_type`, `slice_name`, `datasource_name`

### For Dashboards (`list_dashboards`)
- **Tool:** `Superset MCP Proxy:list_dashboards`
- **Filter prep:** `get_dashboard_available_filters`
- **Key fields:** `dashboard_title`, `published`, `slug`
- **Search terms:** Dashboard names
- **Common filters:** `published`, `dashboard_title`, `favorite`

### For New Entities
1. Identify the `list_[entity]` tool
2. Check if `get_[entity]_available_filters` exists
3. Examine initial response to understand:
   - Key identifying fields
   - Available sortable columns  
   - Common filterable fields
   - Typical data patterns
4. Adapt test values accordingly

## Validation Checklist

For each test, verify:
- ✅ **Response Structure:** Proper JSON with expected fields
- ✅ **Status:** No errors returned
- ✅ **Data Integrity:** Results match expected parameters
- ✅ **Metadata:** Pagination, filtering, and sorting metadata accurate
- ✅ **Count Consistency:** `count` matches actual results returned
- ✅ **Pagination Logic:** Page boundaries and navigation work correctly

## Common Issues to Watch For

1. **Empty Results:** Page 2+ with small result sets
2. **Filter Mismatches:** Case sensitivity in string filters
3. **Column Selection:** Some fields may not populate as expected
4. **Cache Behavior:** Performance differences with cache settings
5. **Operator Support:** Not all operators work with all field types

## Automation Considerations

This plan can be automated by:
1. Creating parameterized test functions
2. Building entity-specific configuration objects
3. Implementing validation assertion helpers
4. Adding performance timing measurements
5. Generating test reports with pass/fail status

## Example Execution Flow

```
1. Run get_[entity]_available_filters
2. Execute Steps 1-10 sequentially
3. Wait for "next" confirmation between steps
4. Document any unexpected behaviors
5. Verify all parameter combinations work
6. Generate summary report
```

This plan ensures comprehensive testing of all Superset list endpoint functionality while being adaptable to any current or future entity type.

## Improvements and Enhancements

### Suggested Improvements

1. **Performance Testing:** Add response time measurements for cache vs non-cache scenarios
2. **Edge Case Testing:** Test with extreme values (very large page_size, invalid dates, etc.)
3. **Error Handling Testing:** Test invalid parameters to verify proper error responses
4. **Data Quality Testing:** Verify data consistency across different parameter combinations
5. **Concurrent Testing:** Test multiple simultaneous requests to check for race conditions
6. **Memory Usage Testing:** Monitor memory consumption with large result sets
7. **Backward Compatibility:** Test with legacy parameter formats if applicable

### Implementation Suggestions

1. **Test Configuration Files:** Create JSON configs for each entity type with common test values
2. **Result Comparison:** Add utilities to compare results across different parameter combinations
3. **Regression Testing:** Save baseline results to detect unexpected changes
4. **Visual Reports:** Generate HTML reports with pass/fail status and performance metrics
5. **CI Integration:** Automate this test plan as part of continuous integration

### Advanced Testing Scenarios

1. **Load Testing:** Test with hundreds of concurrent requests
2. **Data Volume Testing:** Test with databases containing millions of records
3. **Network Failure Testing:** Test behavior with intermittent network issues
4. **Permission Testing:** Test with different user roles and permissions
5. **Multi-tenant Testing:** Test across different organization contexts
