# MCP Chart Tools Runtime Failure Test Plan

This test plan focuses on **schema-valid inputs that cause runtime failures, rendering issues, or poor user experiences**. These are inputs that pass validation but result in broken charts, JavaScript errors, empty visualizations, or confusing displays.

## Test Philosophy

Unlike security testing, this focuses on:
- Inputs that are **technically valid** but **practically problematic**
- Edge cases that **pass validation** but **fail at runtime**
- Configurations that create **misleading or broken visualizations**
- Scenarios that might **crash the frontend** or **produce JavaScript errors**

## Test Execution Instructions

1. **Monitor Browser Console**: Check for JavaScript errors during chart rendering
2. **Visual Inspection**: Look for empty charts, broken layouts, misleading data
3. **Error Propagation**: See if backend errors surface properly in the UI
4. **Performance Impact**: Note any slow-loading or unresponsive charts

---

## 1. Data Type Mismatches (Valid Schema, Wrong Semantics)

### 1.1 Aggregating Text Fields
```json
# Test Case: SUM on text columns (schema allows, but mathematically meaningless)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "product_name"},
      "y": [{"name": "customer_name", "aggregate": "SUM"}]
    }
  }
}

# Test Case: AVG on categorical data
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [{"name": "country", "aggregate": "AVG"}]
    }
  }
}
```

### 1.2 COUNT_DISTINCT on Large Text Fields
```json
# Test Case: COUNT_DISTINCT on long text (might be slow or cause memory issues)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "description", "aggregate": "COUNT_DISTINCT"},
        {"name": "comments", "aggregate": "COUNT_DISTINCT"}
      ]
    }
  }
}
```

## 2. Cardinality Explosion (Valid but Unusable)

### 2.1 High-Cardinality X-Axis
```json
# Test Case: Using UUID or timestamp as X-axis (creates unreadable chart)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "kind": "bar",
      "x": {"name": "id"},  # High cardinality field
      "y": [{"name": "sales", "aggregate": "SUM"}]
    }
  }
}

# Test Case: Email addresses as categories
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "kind": "line",
      "x": {"name": "email"},
      "y": [{"name": "revenue", "aggregate": "COUNT"}]
    }
  }
}
```

### 2.2 Massive Group-By Operations
```json
# Test Case: Group by high-cardinality field (performance killer)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [{"name": "sales", "aggregate": "SUM"}],
      "group_by": {"name": "session_id"}  # Potentially thousands of groups
    }
  }
}
```

## 3. Semantic Nonsense (Valid Schema, No Meaning)

### 3.1 Temporal Aggregations on Non-Temporal Data
```json
# Test Case: Time-series chart with categorical X-axis
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "kind": "line",  # Line chart implies temporal relationship
      "x": {"name": "product_category"},  # But X is categorical
      "y": [{"name": "sales", "aggregate": "SUM"}]
    }
  }
}

# Test Case: Area chart with unrelated dimensions
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "kind": "area",
      "x": {"name": "customer_id"},  # Area chart suggests continuity
      "y": [{"name": "order_count", "aggregate": "COUNT"}]
    }
  }
}
```

### 3.2 Conflicting Aggregations
```json
# Test Case: Multiple conflicting aggregations on same field
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [
        {"name": "sales", "aggregate": "SUM", "label": "Total Sales"},
        {"name": "sales", "aggregate": "COUNT", "label": "Sales Count"},
        {"name": "sales", "aggregate": "AVG", "label": "Avg Sales"}
      ]
    }
  }
}
```

## 4. Scale and Range Issues

### 4.1 Extreme Value Ranges
```json
# Test Case: Mixing tiny and huge numbers (scale problems)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [
        {"name": "revenue", "aggregate": "SUM"},      # Potentially millions
        {"name": "conversion_rate", "aggregate": "AVG"} # Decimals like 0.03
      ]
    }
  }
}

# Test Case: All zeros or nulls
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [{"name": "cancelled_orders", "aggregate": "COUNT"}],
      "filters": [{"column": "status", "op": "=", "value": "cancelled"}]
    }
  }
}
```

### 4.2 Single Data Point Charts
```json
# Test Case: Chart with only one data point (line chart with one point)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "kind": "line",
      "x": {"name": "date"},
      "y": [{"name": "sales", "aggregate": "SUM"}],
      "filters": [{"column": "date", "op": "=", "value": "2024-01-01"}]
    }
  }
}
```

## 5. Filter Logic Traps

### 5.1 Impossible Filter Combinations
```json
# Test Case: Contradictory filters (results in empty dataset)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [{"name": "product"}, {"name": "sales", "aggregate": "SUM"}],
      "filters": [
        {"column": "price", "op": ">", "value": 1000},
        {"column": "price", "op": "<", "value": 100}  # Impossible: >1000 AND <100
      ]
    }
  }
}

# Test Case: Filters that exclude all data
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [{"name": "revenue", "aggregate": "SUM"}],
      "filters": [
        {"column": "status", "op": "=", "value": "DELETED"},
        {"column": "active", "op": "=", "value": false}
      ]
    }
  }
}
```

### 5.2 Non-Existent Filter Values
```json
# Test Case: Filtering for values that don't exist
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "month"},
      "y": [{"name": "sales", "aggregate": "SUM"}],
      "filters": [
        {"column": "country", "op": "=", "value": "Atlantis"},
        {"column": "year", "op": "=", "value": 2050}
      ]
    }
  }
}
```

## 6. Performance and Memory Edge Cases

### 6.1 Massive Table Requests
```json
# Test Case: Table with huge column count (may timeout or crash browser)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "id"}, {"name": "name"}, {"name": "email"}, {"name": "phone"},
        {"name": "address"}, {"name": "city"}, {"name": "state"}, {"name": "zip"},
        {"name": "country"}, {"name": "created_at"}, {"name": "updated_at"},
        {"name": "status"}, {"name": "type"}, {"name": "category"}, {"name": "tags"},
        {"name": "metadata"}, {"name": "description"}, {"name": "notes"}
      ]
    }
  }
}
```

### 6.2 Complex Multi-Dimensional Analysis
```json
# Test Case: Many Y-axis metrics (may overwhelm visualization)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [
        {"name": "sales", "aggregate": "SUM", "label": "Sales Sum"},
        {"name": "sales", "aggregate": "AVG", "label": "Sales Avg"},
        {"name": "sales", "aggregate": "MIN", "label": "Sales Min"},
        {"name": "sales", "aggregate": "MAX", "label": "Sales Max"},
        {"name": "orders", "aggregate": "COUNT", "label": "Order Count"},
        {"name": "customers", "aggregate": "COUNT_DISTINCT", "label": "Unique Customers"},
        {"name": "revenue", "aggregate": "SUM", "label": "Total Revenue"},
        {"name": "profit", "aggregate": "SUM", "label": "Total Profit"}
      ],
      "group_by": {"name": "region"}
    }
  }
}
```

## 7. Label and Display Edge Cases

### 7.1 Confusing Label Scenarios
```json
# Test Case: Labels that override important context
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [
        {"name": "revenue", "aggregate": "SUM", "label": "Profit"},  # Misleading!
        {"name": "costs", "aggregate": "SUM", "label": "Revenue"}   # Swapped!
      ]
    }
  }
}

# Test Case: Very similar labels (hard to distinguish)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [
        {"name": "sales_q1", "aggregate": "SUM", "label": "Sales Q1"},
        {"name": "sales_q2", "aggregate": "SUM", "label": "Sales Q1"}  # Duplicate label
      ]
    }
  }
}
```

### 7.2 Empty or Whitespace Labels
```json
# Test Case: Charts with minimal labeling
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date", "label": " "},  # Just spaces
      "y": [{"name": "sales", "aggregate": "SUM", "label": ""}],  # Empty string
      "x_axis": {"title": "   "},
      "y_axis": {"title": ""}
    }
  }
}
```

## 8. Format and Type Confusion

### 8.1 Inappropriate Formatting
```json
# Test Case: Currency format on count data
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "product"},
      "y": [{"name": "orders", "aggregate": "COUNT"}],
      "y_axis": {"format": "$,.2f"}  # Currency format on count!
    }
  }
}

# Test Case: Percentage format on absolute values
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [{"name": "revenue", "aggregate": "SUM"}],
      "y_axis": {"format": ".2%"}  # Percentage format on dollar amounts!
    }
  }
}
```

## 9. Logical Inconsistencies

### 9.1 Wrong Chart Type for Data Pattern
```json
# Test Case: Scatter plot with categorical data
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "kind": "scatter",  # Scatter implies correlation analysis
      "x": {"name": "department"},  # But data is categorical
      "y": [{"name": "employee_count", "aggregate": "COUNT"}]
    }
  }
}

# Test Case: Area chart with negative values (visual problems)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "kind": "area",
      "x": {"name": "date"},
      "y": [{"name": "profit_loss", "aggregate": "SUM"}]  # Could be negative
    }
  }
}
```

## 10. Dataset Edge Cases

### 10.1 Valid but Problematic Dataset References
```json
# Test Case: Using a very small dataset (insufficient data)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,  # Assume this dataset has only 1-2 rows
    "config": {
      "chart_type": "xy",
      "kind": "line",
      "x": {"name": "date"},
      "y": [{"name": "sales", "aggregate": "SUM"}],
      "group_by": {"name": "region"}
    }
  }
}

# Test Case: Dataset with mostly null values
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "optional_field_1"},
        {"name": "optional_field_2"},
        {"name": "rarely_populated_field"}
      ]
    }
  }
}
```

---

## Expected Failure Modes to Document

### Frontend JavaScript Errors:
- `Cannot read property 'length' of undefined`
- `TypeError: data.map is not a function`
- `RangeError: Maximum call stack size exceeded`
- Infinite loading spinners
- Blank/white chart areas

### Backend Issues:
- Query timeouts
- Memory exhaustion
- Empty result sets
- Type coercion failures

### User Experience Problems:
- Unreadable axis labels (overlapping text)
- Misleading visualizations
- Charts that don't tell a story
- Confusing legends
- Performance degradation

### Ideal Test Outcomes:
1. **Graceful Error Handling**: Clear error messages for impossible queries
2. **Performance Warnings**: Alerts when queries might be slow
3. **Data Quality Hints**: Suggestions when data patterns don't match chart types
4. **Smart Defaults**: Automatic fixes for common configuration mistakes
5. **JavaScript Error Logging**: Capture and report frontend rendering errors

This test plan focuses on the **"valley of despair"** between valid schemas and usable charts, helping identify where additional validation, warnings, or smart defaults could improve the user experience.
