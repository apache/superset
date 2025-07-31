# Critical Issues Report - MCP Superset Service

**Date:** 2025-07-31  
**Status:** 🔴 CRITICAL - Immediate attention required

## Executive Summary

Three critical issues have been identified during comprehensive testing that severely impact core visualization functionality:

1. **Time series data aggregation bug** - Charts lose temporal dimension
2. **Missing previews for unsaved charts** - Preview generation completely broken
3. **Vega-Lite field mapping errors** - Incorrect specifications generated

## Issue #1: Time Series Data Aggregation Bug 🔴

### Severity: HIGH
**Component:** `generate_chart` → Chart data processing pipeline  
**Impact:** All time series visualizations collapse into single data point

### Problem
When generating charts with temporal X-axis fields, the system incorrectly aggregates all time periods into a single point instead of preserving the time series structure.

### Technical Details
```python
# Input configuration
{
    "chart_type": "line",
    "x": {"name": "order_date"},
    "y": [{"name": "sales", "aggregate": "SUM"}]
}

# Expected output: Multiple time points
[
  {"order_date": "2003-01-01", "Total Sales": 123456},
  {"order_date": "2003-02-01", "Total Sales": 234567},
  {"order_date": "2003-03-01", "Total Sales": 345678}
]

# Actual output: Single aggregated point
[
  {"Total Sales": 10032628.85}  # Missing order_date dimension!
]
```

### Root Cause Analysis
The issue appears to be in the query generation logic where:
1. The X-axis field is not being added to the GROUP BY clause
2. The temporal field is not being recognized as a dimension
3. Global aggregation is applied instead of time-based grouping

### Affected Code Path
```
generate_chart()
  → _create_chart_form_data()
    → _build_query_context()  # ← Likely bug location
      → Missing: groupby.append(x_field)
```

### Reproduction
```python
# Any time series chart fails
generate_chart({
    "dataset_id": 24,
    "config": {
        "chart_type": "line",
        "x": {"name": "order_date"},
        "y": [{"name": "sales", "aggregate": "SUM"}]
    }
})
```

## Issue #2: Missing Previews for Unsaved Charts 🔴

### Severity: HIGH
**Component:** Preview generation service  
**Impact:** Cannot preview charts without saving to database

### Problem
Charts created with `save_chart: false` return empty preview objects instead of generating requested formats.

### Technical Details
```python
# Request
{
    "save_chart": false,
    "preview_formats": ["ascii", "vega_lite", "table"]
}

# Response
{
    "chart": {
        "form_data_key": "8fF6-dWtpTI",
        "saved": false
    },
    "previews": {}  # ← EMPTY! Should contain requested formats
}
```

### Root Cause Analysis
The preview generation pipeline has a hard dependency on saved chart IDs:
1. Preview functions expect numeric `chart_id`, not `form_data_key`
2. Missing code path for generating previews from form data
3. The `_generate_preview_from_form_data()` function may not be called

### Affected Code Path
```
generate_chart()
  → if not save_chart:
      → _generate_preview_from_form_data()  # ← Not being called
      → OR missing implementation
```

### Impact
- Breaks the entire "try before save" workflow
- Forces unnecessary database writes
- Violates RESTful principles (GET-like operation requiring POST)

## Issue #3: Vega-Lite Field Mapping Errors 🟡

### Severity: MEDIUM  
**Component:** Vega-Lite transformation layer  
**Impact:** Generated specs produce incorrect visualizations

### Problem
Vega-Lite specifications use aggregated column names instead of original field names, causing incorrect axis mappings.

### Technical Details
```json
// Current (WRONG)
{
  "encoding": {
    "x": {
      "field": "Total Sales",      // ← Using aggregated name
      "type": "quantitative"       // ← Wrong type for time axis
    },
    "y": {
      "field": "Avg Price",
      "type": "quantitative"
    }
  }
}

// Expected (CORRECT)
{
  "encoding": {
    "x": {
      "field": "order_date",       // ← Original field name
      "type": "temporal"           // ← Correct type
    },
    "y": {
      "field": "sales",            // ← Or keep aggregated name
      "type": "quantitative"
    }
  }
}
```

### Root Cause Analysis
The Vega-Lite generator receives post-aggregation data instead of the original configuration:
1. Field mapping is lost during aggregation
2. Type detection happens on wrong data structure
3. Original `x`/`y` configuration not preserved

### Affected Code Path
```
VegaLitePreviewStrategy._create_vega_lite_spec()
  → Uses data columns instead of original config
  → Should use self.chart.config to get field mappings
```

## Secondary Issue: Form Data Key Lookup Failures 🟡

### Problem
Form data keys cannot be used with other tools like `get_chart_preview`.

### Error
```json
{
  "error": "No chart found with identifier: 8fF6-dWtpTI",
  "error_type": "NotFound"
}
```

### Root Cause
Chart lookup logic doesn't check form data cache:
```python
# Current logic
if identifier.isdigit():
    chart = ChartDAO.find_by_id(int(identifier))
else:
    chart = ChartDAO.find_by_id(identifier, id_column="uuid")
# Missing: Check form_data_cache
```

## Immediate Action Plan

### P0 - Critical (This Sprint)

#### 1. Fix Time Series Aggregation
```python
# In _build_query_context or equivalent
if x_field and x_field != time_column:
    groupby.append(x_field)  # Add X-axis to GROUP BY
```

#### 2. Enable Unsaved Chart Previews
```python
# In generate_chart
if not save_chart and preview_formats:
    previews = _generate_preview_from_form_data(
        form_data_key,
        dataset,
        preview_formats
    )
```

#### 3. Fix Form Data Key Lookup
```python
# In chart lookup functions
if not chart and not identifier.isdigit():
    # Try form data cache
    form_data = get_form_data_from_key(identifier)
    if form_data:
        chart = create_transient_chart(form_data)
```

### P1 - High Priority (Next Sprint)

1. **Fix Vega-Lite Field Mapping**
   - Preserve original field names through pipeline
   - Use config instead of data for field mapping

2. **Add Integration Tests**
   ```python
   def test_time_series_preservation():
       chart = generate_chart(time_series_config)
       assert len(chart.data) > 1
       assert all('order_date' in row for row in chart.data)

   def test_unsaved_chart_previews():
       chart = generate_chart(save_chart=False, preview_formats=["ascii"])
       assert chart["previews"]["ascii"] is not None
   ```

3. **Monitoring & Telemetry**
   - Add metrics for preview generation success rate
   - Monitor time series aggregation correctness
   - Track form data cache hit rate

## Verification Test Suite

```python
# Test 1: Time Series Preservation
def test_time_series_grouping():
    result = generate_chart({
        "dataset_id": 24,
        "config": {
            "chart_type": "line",
            "x": {"name": "order_date"},
            "y": [{"name": "sales", "aggregate": "SUM"}]
        }
    })

    # Should have multiple data points
    assert len(result["data"]) > 1
    # Each point should have the time dimension
    assert all("order_date" in point for point in result["data"])
    # Should be ordered by time
    dates = [point["order_date"] for point in result["data"]]
    assert dates == sorted(dates)

# Test 2: Unsaved Chart Previews
def test_unsaved_chart_preview_generation():
    result = generate_chart({
        "dataset_id": 24,
        "config": {"chart_type": "table", "columns": [{"name": "region"}]},
        "save_chart": False,
        "preview_formats": ["ascii", "table", "vega_lite"]
    })

    # Should generate all requested previews
    assert "ascii" in result["previews"]
    assert "table" in result["previews"]
    assert "vega_lite" in result["previews"]
    # Should not save to database
    assert result["chart"]["saved"] is False

# Test 3: Vega-Lite Field Mapping
def test_vega_lite_field_preservation():
    result = generate_chart({
        "dataset_id": 24,
        "config": {
            "chart_type": "line",
            "x": {"name": "order_date"},
            "y": [{"name": "sales", "aggregate": "SUM"}]
        },
        "preview_formats": ["vega_lite"]
    })

    vega_spec = result["previews"]["vega_lite"]["specification"]
    # X-axis should use original field name
    assert vega_spec["encoding"]["x"]["field"] == "order_date"
    assert vega_spec["encoding"]["x"]["type"] == "temporal"
    # Y-axis can use aggregated name
    assert "sales" in vega_spec["encoding"]["y"]["field"].lower()

# Test 4: Form Data Key Resolution
def test_form_data_key_lookup():
    # Create unsaved chart
    unsaved = generate_chart({
        "dataset_id": 24,
        "config": {"chart_type": "table", "columns": [{"name": "region"}]},
        "save_chart": False
    })

    form_data_key = unsaved["chart"]["form_data_key"]

    # Should be able to get preview using form_data_key
    preview = get_chart_preview({
        "identifier": form_data_key,
        "format": "ascii"
    })

    assert preview is not None
    assert "error" not in preview
```

## Impact on Demo

These issues make the demo script fail at critical points:
- Part 2.1: Line chart shows single point instead of trend
- Part 3: No ASCII previews for unsaved charts  
- Part 2.2: Vega-Lite specs are incorrect

**Demo is currently NOT suitable for customer presentations.**

## Recommended Timeline

- **Day 1-2**: Fix time series aggregation (P0)
- **Day 3-4**: Fix unsaved chart previews (P0)
- **Day 5**: Fix form data key lookup (P0)
- **Week 2**: Vega-Lite fixes and comprehensive testing

## Success Criteria

✅ Time series charts show multiple data points  
✅ Unsaved charts generate all preview formats  
✅ Vega-Lite specs have correct field mappings  
✅ Form data keys work across all tools  
✅ Demo script runs without errors
