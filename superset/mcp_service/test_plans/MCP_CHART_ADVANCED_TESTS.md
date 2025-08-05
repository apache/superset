# MCP Chart Tools Tests

This document contains advanced test cases designed to exploit subtle vulnerabilities and edge cases in the MCP chart generation pipeline. These tests go beyond basic validation .

## Advanced SQL Injection Techniques

### 1. Second-Order SQL Injection
```json
# Step 1: Store malicious payload in chart name
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [{"name": "product"}]
    },
    "save_chart": true
  }
}

# Step 2: Update chart with injection in the update itself
mcp__mcp-server__update_chart {
  "request": {
    "identifier": "[CHART_ID_FROM_STEP_1]",
    "chart_name": "Updated Chart'; INSERT INTO users VALUES ('hacker', 'password'); --",
    "config": {
      "chart_type": "table",
      "columns": [{"name": "sales", "aggregate": "SUM"}]
    }
  }
}
```

### 2. Unicode Normalization Attacks
```json
# Test Case: Unicode characters that normalize to dangerous strings
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "saｌes", "aggregate": "SUM"},  # Full-width 'l'
        {"name": "ѕales", "aggregate": "COUNT"},  # Cyrillic 's'
        {"name": "／etc／passwd", "label": "File Access"}  # Full-width slashes
      ]
    }
  }
}
```

### 3. Filter Chain Exploitation
```json
# Test Case: Chained filters to bypass validation
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [{"name": "product"}],
      "filters": [
        {"column": "id", "op": "=", "value": "1"},
        {"column": "id", "op": "!=", "value": "1 UNION SELECT * FROM information_schema.tables"},
        {"column": "name", "op": "=", "value": "test' AND SLEEP(5) AND 'x'='x"}
      ]
    }
  }
}
```

## Advanced XSS

### 1. DOM Clobbering
```json
# Test Case: DOM property override attempts
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "toString", "label": "Override toString"},
        {"name": "constructor", "label": "Override constructor"},
        {"name": "__proto__", "label": "Prototype pollution"}
      ]
    }
  }
}
```

### 2. SVG-based XSS
```json
# Test Case: SVG injection
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": [{
        "name": "sales",
        "aggregate": "SUM",
        "label": "<svg><foreignObject><iframe src='javascript:alert(1)'></iframe></foreignObject></svg>"
      }],
      "x_axis": {
        "title": "<svg><animate attributeName='href' values='javascript:alert(1)'/></svg>"
      }
    }
  }
}
```

### 3. Event Handler Smuggling
```json
# Test Case: Hidden event handlers
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "product", "label": "Product\" onmouseover=\"alert(1)\" x=\""},
        {"name": "sales", "label": "Sales' style='background:url(javascript:alert(2))'"}
      ]
    }
  }
}
```

## Cache Poisoning Attacks

### 1. Cache Key Manipulation
```json
# Test Case: Cache key collision attack
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": "1",
    "config": {
      "chart_type": "table",
      "columns": [{"name": "test"}]
    },
    "cache_timeout": 86400,
    "force_refresh": false,
    "use_cache": true
  }
}

# Follow up with same dataset but different actual ID
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": "01",  # May resolve to same ID but different cache key
    "config": {
      "chart_type": "table",
      "columns": [{"name": "malicious_data"}]
    },
    "use_cache": true
  }
}
```

### 2. Cache Timing Attacks
```json
# Test Case: Exploit cache timing for information disclosure
# First request - prime the cache
mcp__mcp-server__get_chart_data {
  "request": {
    "identifier": 1,
    "use_cache": false,
    "force_refresh": true
  }
}

# Rapid follow-up requests to measure timing differences
mcp__mcp-server__get_chart_data {
  "request": {
    "identifier": 1,
    "use_cache": true
  }
}
```

## Type Confusion Exploits

### 1. Prototype Pollution via Type Confusion
```json
# Test Case: Attempt prototype pollution through config
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [{"name": "test"}],
      "__proto__": {
        "isAdmin": true,
        "canDelete": true
      },
      "constructor": {
        "prototype": {
          "isAuthorized": true
        }
      }
    }
  }
}
```

### 2. Type Juggling Attacks
```json
# Test Case: Exploit weak type comparison
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": "1e0",  # Scientific notation
    "config": {
      "chart_type": "table",
      "columns": [{"name": "test"}]
    },
    "cache_timeout": "0x10",  # Hexadecimal
    "save_chart": "true"  # String instead of boolean
  }
}
```

## Resource Exhaustion Attacks

### 1. Algorithmic Complexity Attacks
```json
# Test Case: Regex DoS (ReDoS)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "a" + "a".repeat(100) + "!", "label": "ReDoS Test"}
      ],
      "filters": [
        {"column": "description", "op": "=", "value": "x" + "x".repeat(1000) + "!"}
      ]
    }
  }
}
```

### 2. Memory Exhaustion
```json
# Test Case: Exponential memory consumption
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "xy",
      "x": {"name": "date"},
      "y": Array(1000).fill(null).map((_, i) => ({
        "name": "metric_" + "x".repeat(1000) + i,
        "aggregate": "SUM",
        "label": "Label_" + "y".repeat(1000) + i
      }))
    }
  }
}
```

## Business Logic Bypasses

### 1. Permission Escalation via Chart Sharing
```json
# Test Case: Create chart with elevated permissions
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [{"name": "sensitive_data"}]
    },
    "save_chart": true
  }
}

# Then attempt to access via preview without save
mcp__mcp-server__get_chart_preview {
  "request": {
    "identifier": "[RESTRICTED_CHART_ID]",
    "format": "table"
  }
}
```

### 2. Dataset ID Enumeration
```json
# Test Case: Enumerate valid dataset IDs through error messages
for i in range(1, 100):
  mcp__mcp-server__generate_chart {
    "request": {
      "dataset_id": i,
      "config": {
        "chart_type": "table",
        "columns": [{"name": "test"}]
      },
      "save_chart": false
    }
  }
```

## Advanced Filter Bypass Techniques

### 1. Filter Encoding Attacks
```json
# Test Case: Various encoding attempts
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [{"name": "product"}],
      "filters": [
        {"column": "name", "op": "=", "value": "\u003cscript\u003ealert(1)\u003c/script\u003e"},
        {"column": "desc", "op": "=", "value": "\\x3cscript\\x3ealert(2)\\x3c/script\\x3e"},
        {"column": "info", "op": "=", "value": "%3Cscript%3Ealert(3)%3C%2Fscript%3E"}
      ]
    }
  }
}
```

### 2. Operator Injection
```json
# Test Case: Inject via operator field
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [{"name": "product"}],
      "filters": [
        {"column": "price", "op": "= 100 OR 1=1 --", "value": "0"},
        {"column": "status", "op": "!= 'active' UNION SELECT * FROM users --", "value": "test"}
      ]
    }
  }
}
```

## Concurrency & Race Condition Exploits

### 1. TOCTOU (Time-of-Check Time-of-Use)
```json
# Execute these in rapid succession
# Request 1: Create preview
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {"chart_type": "table", "columns": [{"name": "safe_column"}]},
    "save_chart": false
  }
}

# Request 2: Immediately update with malicious content
mcp__mcp-server__update_chart_preview {
  "request": {
    "form_data_key": "[KEY_FROM_REQUEST_1]",
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [{"name": "'; DROP TABLE charts; --"}]
    }
  }
}

# Request 3: Access the preview
mcp__mcp-server__get_chart_preview {
  "request": {
    "identifier": "[Use form_data_key somehow]",
    "format": "table"
  }
}
```

### 2. Cache Race Conditions
```json
# Simultaneous requests with different cache settings
# Terminal 1
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {"chart_type": "table", "columns": [{"name": "column1"}]},
    "force_refresh": true,
    "cache_timeout": 0
  }
}

# Terminal 2 (same time)
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {"chart_type": "table", "columns": [{"name": "column2"}]},
    "use_cache": true,
    "cache_timeout": 3600
  }
}
```

## State Manipulation Attacks

### 1. Form Data Key Prediction
```json
# Test Case: Attempt to guess/manipulate form_data_keys
mcp__mcp-server__update_chart_preview {
  "request": {
    "form_data_key": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "dataset_id": 1,
    "config": {"chart_type": "table", "columns": [{"name": "hacked"}]}
  }
}

# Try sequential keys
mcp__mcp-server__update_chart_preview {
  "request": {
    "form_data_key": "00000000-0000-0000-0000-000000000001",
    "dataset_id": 1,
    "config": {"chart_type": "table", "columns": [{"name": "test"}]}
  }
}
```

### 2. Preview URL Manipulation
```json
# Test Case: Exploit explore URL generation
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [{"name": "test&malicious_param=<script>alert(1)</script>"}]
    },
    "save_chart": false,
    "generate_preview": true,
    "preview_formats": ["url"]
  }
}
```

## Validation Bypass via Edge Cases

### 1. Aggregate Function Edge Cases
```json
# Test Case: Valid but unusual aggregate usage
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "id", "aggregate": "COUNT_DISTINCT"},
        {"name": "id", "aggregate": "COUNT"},  # Same column, different aggregate
        {"name": "id", "aggregate": "SUM"},    # ID column with SUM
        {"name": "id", "aggregate": "AVG"}     # ID column with AVG
      ]
    }
  }
}
```

### 2. Mixed Valid/Invalid Configurations
```json
# Test Case: Hide malicious content among valid data
mcp__mcp-server__generate_chart {
  "request": {
    "dataset_id": 1,
    "config": {
      "chart_type": "table",
      "columns": [
        {"name": "product", "label": "Product Name"},
        {"name": "sales", "aggregate": "SUM", "label": "Total Sales"},
        {"name": "'; SELECT * FROM users; --", "label": "Region"},
        {"name": "profit", "aggregate": "AVG", "label": "Avg Profit"},
        {"name": "cost", "aggregate": "MIN", "label": "Min Cost"}
      ]
    }
  }
}
```

## Success Indicators for Attackers

If any of these attacks succeed, look for:
1. **Error Message Information Disclosure**: Detailed error messages revealing system internals
2. **Timing Differences**: Significant delays indicating processing of injected code
3. **Unexpected Behavior**: Charts displaying data they shouldn't have access to
4. **Cache Pollution**: Other users seeing injected content
5. **State Corruption**: Persistent changes to the system state
6. **Permission Bypass**: Access to restricted datasets or operations

## Defensive Testing Checklist

After running these tests, verify:
- [ ] All injection attempts are properly escaped/rejected
- [ ] Error messages don't reveal sensitive information
- [ ] System performance remains stable
- [ ] No persistent side effects from failed attacks
- [ ] Audit logs capture suspicious activity
- [ ] Rate limiting prevents rapid-fire attacks
- [ ] Cache integrity is maintained
- [ ] Proper input validation at all layers
