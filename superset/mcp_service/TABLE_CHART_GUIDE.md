# Table Chart Configuration Guide

This guide explains how table charts work in the Superset MCP service, including the improved aggregation behavior and formatting.

## Table Chart Behavior

### Column Types

Table charts support two types of columns:

#### 1. Raw Columns (No Aggregation)
```python
ColumnRef(name="customer_name")  # No aggregate specified
ColumnRef(name="order_date")     # Raw date values
```
- Shows individual row values
- No grouping applied
- Displays data as-is from the dataset

#### 2. Aggregated Columns (With Aggregation)
```python
ColumnRef(name="revenue", aggregate="SUM")     # Sum of revenue
ColumnRef(name="orders", aggregate="COUNT")    # Count of orders
ColumnRef(name="price", aggregate="AVG")       # Average price
```
- Applies specified aggregation function
- Groups data when mixed with raw columns
- Supported aggregates: SUM, COUNT, AVG, MIN, MAX, COUNT_DISTINCT

### Mixed Column Behavior

When you mix raw and aggregated columns, the table automatically groups by the raw columns:

#### Example 1: Pure Raw Columns
```python
TableChartConfig(
    chart_type="table",
    columns=[
        ColumnRef(name="customer_name"),
        ColumnRef(name="order_date"),
        ColumnRef(name="product_name")
    ]
)
```
**Result**: Shows individual rows, no grouping
```
customer_name | order_date | product_name
John Smith    | 2024-01-15 | Widget A
Jane Doe      | 2024-01-16 | Widget B
John Smith    | 2024-01-17 | Widget C
```

#### Example 2: Pure Aggregated Columns
```python
TableChartConfig(
    chart_type="table",
    columns=[
        ColumnRef(name="revenue", aggregate="SUM"),
        ColumnRef(name="orders", aggregate="COUNT")
    ]
)
```
**Result**: Single row with aggregated totals
```
SUM(revenue) | COUNT(orders)
45,250.00    | 1,247
```

#### Example 3: Mixed Raw + Aggregated (Recommended)
```python
TableChartConfig(
    chart_type="table",
    columns=[
        ColumnRef(name="customer_name"),          # Raw (becomes GROUP BY)
        ColumnRef(name="revenue", aggregate="SUM"), # Aggregated
        ColumnRef(name="orders", aggregate="COUNT") # Aggregated
    ]
)
```
**Result**: Groups by customer_name, aggregates metrics
```
customer_name | SUM(revenue) | COUNT(orders)
John Smith    | 15,750.00    | 8
Jane Doe      | 29,500.00    | 12
```

## Aggregation Functions

### Supported Aggregates

| Function | Description | Works With |
|----------|-------------|------------|
| `SUM` | Sum of values | Numeric columns |
| `COUNT` | Count of rows | All column types |
| `COUNT_DISTINCT` | Count unique values | All column types |
| `AVG` | Average value | Numeric columns |
| `MIN` | Minimum value | Numeric, date columns |
| `MAX` | Maximum value | Numeric, date columns |

### Type Compatibility

The validation system prevents incompatible aggregations:
- ✅ `SUM(revenue)` - numeric column
- ✅ `COUNT(customer_name)` - text column  
- ❌ `SUM(customer_name)` - invalid (text column)
- ✅ `MIN(order_date)` - date column
- ❌ `AVG(customer_name)` - invalid (text column)

## Improved Table Preview

### Enhanced Formatting Features

1. **Dynamic Column Widths**: Columns adjust width based on content
2. **Better Number Formatting**:
   - Thousands separators: `1,234.56`
   - Scientific notation for large numbers: `1.23e+06`
   - Proper decimal places for floats
3. **More Columns Shown**: Up to 8 columns (was 5)
4. **More Rows Shown**: Up to 15 rows (was 10)
5. **Smart Truncation**: Uses `..` to indicate truncated content
6. **NULL Handling**: Shows `NULL` for null values

### Example Enhanced Preview
```
Table Preview
================================================================================
customer_name     | region    | SUM(revenue) | COUNT(orders) | AVG(rating)
------------------+-----------+--------------+---------------+-------------
John Smith        | North     | 15,750.00    | 8             | 4.25
Jane Doe          | South     | 29,500.00    | 12            | 4.67
Mike Johnson      | West      | 8,900.00     | 5             | 3.80
Sarah Wilson      | East      | 22,100.00    | 9             | 4.44
... and 146 more rows
... and 3 more columns

Total: 150 rows × 11 columns
```

## Configuration Examples

### Basic Customer Report
```python
TableChartConfig(
    chart_type="table",
    columns=[
        ColumnRef(name="customer_name"),
        ColumnRef(name="total_orders", aggregate="COUNT"),
        ColumnRef(name="total_revenue", aggregate="SUM"),
        ColumnRef(name="avg_order_value", aggregate="AVG")
    ],
    sort_by=["total_revenue"]  # Sort by revenue descending
)
```

### Regional Sales Summary
```python
TableChartConfig(
    chart_type="table",
    columns=[
        ColumnRef(name="region"),
        ColumnRef(name="sales_rep"),
        ColumnRef(name="revenue", aggregate="SUM"),
        ColumnRef(name="deals_closed", aggregate="COUNT")
    ],
    filters=[
        FilterConfig(column="region", op="!=", value="Unknown")
    ]
)
```

### Product Performance Analysis
```python
TableChartConfig(
    chart_type="table",
    columns=[
        ColumnRef(name="product_category"),
        ColumnRef(name="product_name"),
        ColumnRef(name="units_sold", aggregate="SUM"),
        ColumnRef(name="revenue", aggregate="SUM"),
        ColumnRef(name="profit_margin", aggregate="AVG")
    ],
    sort_by=["revenue", "units_sold"]
)
```

## Migration from Previous Behavior

### Before (Problematic)
- All columns were forced to have aggregation (defaulted to SUM)
- Mixed raw and aggregated behavior was unclear
- Headers were truncated to 15 characters
- Only 5 columns and 10 rows shown

### After (Fixed)
- Raw columns stay raw, aggregated columns stay aggregated
- Clear grouping behavior when mixing column types
- Dynamic column widths with smart truncation
- Better number formatting and more data shown
- Detailed preview with summary statistics

## Best Practices

### 1. Choose Column Types Intentionally
- Use raw columns for dimensional data (names, categories, dates)
- Use aggregated columns for metrics (revenue, counts, averages)

### 2. Meaningful Grouping
```python
# Good: Groups customers by region, shows metrics
columns=[
    ColumnRef(name="region"),           # GROUP BY
    ColumnRef(name="revenue", aggregate="SUM")
]

# Bad: Mixing unrelated raw columns
columns=[
    ColumnRef(name="customer_name"),    # Will group by this
    ColumnRef(name="product_name"),     # And this (Cartesian product!)
    ColumnRef(name="revenue", aggregate="SUM")
]
```

### 3. Use Appropriate Aggregates
```python
# Good
ColumnRef(name="price", aggregate="AVG")        # Average price
ColumnRef(name="order_count", aggregate="COUNT") # Count orders

# Bad  
ColumnRef(name="customer_name", aggregate="SUM") # Invalid!
```

### 4. Sort by Important Metrics
```python
TableChartConfig(
    # ... columns ...
    sort_by=["revenue", "customer_name"]  # Sort by revenue desc, then name asc
)
```

## Troubleshooting

### Issue: Too Many Grouped Rows
**Problem**: When mixing many raw columns, you get too many groups
**Solution**: Reduce raw columns or use filters to limit data

### Issue: Unexpected Aggregation
**Problem**: Getting aggregated data when you want raw rows
**Solution**: Remove `aggregate` parameter from column definitions

### Issue: Missing Data in Groups
**Problem**: Some combinations showing NULL
**Solution**: This is normal - not all combinations exist in your data

### Issue: Performance Problems
**Problem**: Table takes too long to load
**Solution**: Add filters to reduce data volume, or use fewer grouping columns

---

This improved table chart implementation provides clearer behavior, better formatting, and more predictable results for users.
