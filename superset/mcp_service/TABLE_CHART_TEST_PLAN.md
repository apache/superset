# Table Chart Aggregation Fixes - Test Plan (UPDATED)

This test plan validates the table chart aggregation improvements including **CRITICAL FIXES** for raw columns and numeric type validation. Run these tests to verify the fixes work correctly.

## Test Overview

**Purpose**: Verify table chart aggregation behavior and preview formatting improvements  
**Time**: ~10-15 minutes  
**Prerequisites**: Superset MCP service running with sample data  
**Updated**: Includes fixes for raw column empty queries and DOUBLE PRECISION aggregation support

## Test Cases

### Test 1: Raw Columns Only (No Aggregation)
**Expected**: Show individual rows without grouping

```python
# Generate a table with only raw columns
{
    "dataset_id": [your_dataset_id],
    "config": {
        "chart_type": "table",
        "columns": [
            {"name": "customer_name"},
            {"name": "order_date"},
            {"name": "product_name"}
        ]
    },
    "generate_preview": true,
    "preview_formats": ["table"]
}
```

**✅ Expected Results** (CRITICAL FIX):
- Shows individual rows (not aggregated)
- All customer names appear (no grouping)
- **Table preview contains actual data** (not empty)
- **No "Empty query?" errors**
- Preview shows multiple rows with different customers  
- Column headers are not truncated
- **Form data includes query_mode="raw" and row_limit**

### Test 2: Numeric Aggregates (CRITICAL FIX)
**Expected**: SUM/AVG work on DOUBLE PRECISION, BIGINT, etc.

```python
# Test SUM on DOUBLE PRECISION (previously failing)
{
    "dataset_id": [your_dataset_id],
    "config": {
        "chart_type": "table",
        "columns": [
            {"name": "sales", "aggregate": "SUM"},        # DOUBLE PRECISION type
            {"name": "price_each", "aggregate": "AVG"}    # DOUBLE PRECISION type
        ]
    },
    "generate_preview": true,
    "preview_formats": ["table"]
}
```

**✅ Expected Results** (CRITICAL FIX):
- **No validation errors** (previously rejected DOUBLE PRECISION)
- Shows single row with aggregated totals
- Column headers show "SUM(sales)", "AVG(price_each)"
- **Numeric types properly recognized**: DOUBLE PRECISION, BIGINT, INTEGER, FLOAT all work
- Values are properly aggregated across all data

### Test 3: Aggregated Columns Only
**Expected**: Show single summary row with totals

```python
# Generate a table with only aggregated columns  
{
    "dataset_id": [your_dataset_id],
    "config": {
        "chart_type": "table",
        "columns": [
            {"name": "revenue", "aggregate": "SUM"},
            {"name": "order_id", "aggregate": "COUNT"}
        ]
    },
    "generate_preview": true,
    "preview_formats": ["table"]
}
```

**✅ Expected Results**:
- Shows single row with totals
- Column headers show "SUM(revenue)", "COUNT(order_id)"
- Values are properly aggregated across all data

### Test 3: Mixed Columns (Raw + Aggregated)
**Expected**: Group by raw columns, aggregate metrics

```python
# Generate a table mixing raw and aggregated columns
{
    "dataset_id": [your_dataset_id],
    "config": {
        "chart_type": "table",
        "columns": [
            {"name": "customer_name"},
            {"name": "revenue", "aggregate": "SUM"},
            {"name": "order_id", "aggregate": "COUNT"}
        ]
    },
    "generate_preview": true,
    "preview_formats": ["table"]
}
```

**✅ Expected Results**:
- One row per customer (grouped by customer_name)
- Revenue and order counts aggregated per customer
- Multiple customers visible in preview
- Clear grouping behavior

### Test 4: Enhanced Table Preview Formatting
**Expected**: Better formatting and more information

```python
# Generate table with various data types to test formatting
{
    "dataset_id": [your_dataset_id],
    "config": {
        "chart_type": "table",
        "columns": [
            {"name": "customer_name"},
            {"name": "revenue", "aggregate": "SUM"},
            {"name": "avg_rating", "aggregate": "AVG"}
        ]
    },
    "generate_preview": true,
    "preview_formats": ["table"]
}
```

**✅ Expected Results**:
- Column widths adjust to content (not fixed 15 chars)
- Numbers show thousands separators (e.g., "1,234.56")
- Large numbers use scientific notation if needed
- Table shows "Total: X rows × Y columns" at bottom
- No harsh truncation of column names

### Test 5: Error Validation (Enhanced Error Messages)
**Expected**: Helpful error messages with suggestions

```python
# Try invalid column name to test error handling
{
    "dataset_id": [your_dataset_id],
    "config": {
        "chart_type": "table",
        "columns": [
            {"name": "invalid_column_name"}
        ]
    }
}
```

**✅ Expected Results**:
- Clear error message about invalid column
- Suggestions for similar column names (fuzzy matching)
- List of available columns
- Helpful context about the dataset

### Test 6: Invalid Aggregation (Type Checking)
**Expected**: Prevent incompatible aggregations

```python
# Try invalid aggregation (SUM on text column)
{
    "dataset_id": [your_dataset_id],
    "config": {
        "chart_type": "table",
        "columns": [
            {"name": "customer_name", "aggregate": "SUM"}
        ]
    }
}
```

**✅ Expected Results**:
- Error about incompatible aggregation
- Suggestion to use COUNT/COUNT_DISTINCT for text columns
- Clear explanation of what went wrong

## Success Criteria

### ✅ Core Functionality
- [ ] Raw columns show individual rows (no forced aggregation)
- [ ] Aggregated columns show proper totals
- [ ] Mixed columns group correctly
- [ ] No unexpected SUM() wrapping of text columns

### ✅ Preview Quality  
- [ ] Table previews show more than 5 columns
- [ ] Column headers not truncated at 15 characters
- [ ] Numbers formatted with thousands separators
- [ ] Dynamic column widths based on content
- [ ] Summary information at bottom

### ✅ Error Handling
- [ ] Invalid columns give helpful suggestions
- [ ] Invalid aggregations provide clear guidance
- [ ] Error messages include available options
- [ ] Fuzzy matching suggests corrections

## Quick Validation Commands

Use these MCP tool calls to quickly test the fixes:

```bash
# Test 1: Raw columns
generate_chart with dataset_id and raw columns only

# Test 2: Aggregated columns  
generate_chart with dataset_id and aggregated columns only

# Test 3: Mixed columns
generate_chart with dataset_id mixing raw and aggregated

# Test 4: Invalid column
generate_chart with invalid column name (expect helpful error)
```

## Regression Tests

Ensure these still work:
- [ ] Chart screenshots still generate
- [ ] Explore page screenshots still work
- [ ] Other chart types (XY charts) unaffected
- [ ] Filters still work with table charts

## Notes for Testing

1. **Use a dataset with multiple rows and columns** for best results
2. **Check both preview and actual chart generation**
3. **Test with different data types** (text, numbers, dates)
4. **Verify error messages are user-friendly**
5. **Confirm no performance regression**

---

**Expected Test Duration**: 10-15 minutes  
**Pass Criteria**: All ✅ checkboxes completed successfully
