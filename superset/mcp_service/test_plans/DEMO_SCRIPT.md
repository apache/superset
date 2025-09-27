# 🚀 MCP Service Demo Script - Advanced Features Showcase

This demo showcases the powerful capabilities of the Superset MCP service, including the new Vega-Lite visualization and enhanced ASCII chart features.

## Prerequisites
- ✅ Superset running on http://localhost:9001
- ✅ MCP service running on port 5008
- ✅ Sample datasets loaded (e.g., "examples" database)
- ✅ Claude Desktop or compatible MCP client

## 🎯 Demo Flow

### Part 1: System Health & Discovery

#### 1.1 Instance Health Check
```
Let's start by checking the Superset instance health and capabilities:

Use the get_superset_instance_info tool
```
**Expected**: System stats, version info, available features

#### 1.2 Smart Dataset Discovery
```
Discover available datasets with advanced filtering:

Use the list_datasets tool with:
{
  "search": "sales",
  "page": 1,
  "page_size": 10,
  "use_cache": false
}
```
**Expected**: Fresh dataset list with sales-related tables

### Part 2: Interactive Chart Visualization

#### 2.1 Generate a Line Chart with Vega-Lite Preview
```
Create an interactive time series visualization:

Use the generate_chart tool with:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "line",
    "x": {"name": "date"},
    "y": [
      {"name": "sales", "aggregate": "SUM", "label": "Total Sales"},
      {"name": "profit", "aggregate": "AVG", "label": "Avg Profit"}
    ],
    "time_grain": "P1D",
    "time_range": "Last 30 days"
  },
  "slice_name": "Sales Trend Analysis",
  "save_chart": true,
  "preview_formats": ["url", "vega_lite", "ascii"]
}
```
**Expected**:
- Chart URL for web viewing
- Interactive Vega-Lite JSON specification
- ASCII art visualization with trend indicators (📈 📉)

#### 2.2 Explore the Vega-Lite Specification
```
The Vega-Lite preview returns a JSON spec that can be rendered in any Vega-Lite viewer.
Look for:
- Intelligent data type detection (temporal, quantitative, nominal)
- Proper axis encoding
- Interactive tooltips configuration
- Responsive layout settings
```

### Part 3: Enhanced ASCII Visualizations

#### 3.1 Generate Bar Chart with Smart Orientation
```
Create a bar chart that auto-selects horizontal/vertical based on labels:

Use the generate_chart tool with:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "bar",
    "x": {"name": "category"},
    "y": [{"name": "revenue", "aggregate": "SUM"}],
    "filters": [{"column": "year", "op": "=", "value": 2024}]
  },
  "slice_name": "Revenue by Category",
  "save_chart": false,
  "preview_formats": ["ascii"]
}
```
**Expected**:
- Horizontal bars if category names are long
- Vertical bars if labels are short
- Gradient bar effects based on value intensity
- Smart number formatting (K, M suffixes)

#### 3.2 Line Chart with Trend Analysis
```
Visualize trends with connected ASCII line charts:

Use the get_chart_preview tool with:
{
  "identifier": [ID from previous chart],
  "format": "ascii",
  "width": 80,
  "height": 25
}
```
**Expected**:
- Connected line segments showing data flow
- Trend indicators: 📈 (rising), 📉 (falling), ➡️ (stable)
- Min/max value annotations
- Statistical summary at the bottom

### Part 4: Multi-Format Data Export

#### 4.1 Get Chart Data with Insights
```
Extract data with intelligent analysis:

Use the get_chart_data tool with:
{
  "identifier": [chart ID],
  "format": "json",
  "include_column_metadata": true,
  "generate_insights": true,
  "force_refresh": true
}
```
**Expected**:
- Fresh data with cache_hit=false
- Column type analysis
- Data quality metrics
- Intelligent insights and recommendations

#### 4.2 Table Preview with Smart Formatting
```
Get enhanced table visualization:

Use the get_chart_preview tool with:
{
  "identifier": [chart ID],
  "format": "table",
  "max_rows": 10
}
```
**Expected**:
- Professional Unicode box-drawing characters
- Smart column selection (prioritizes business-relevant fields)
- Numeric summaries (sum, avg, min, max)
- Proper column width calculation

### Part 5: Dashboard Integration

#### 5.1 Create Optimized Dashboard
```
Generate a dashboard with multiple charts:

Use the generate_dashboard tool with:
{
  "chart_ids": [1, 2, 3, 4],
  "dashboard_title": "MCP Demo Dashboard - Enhanced Visualizations",
  "description": "Showcasing Vega-Lite and ASCII capabilities",
  "published": true
}
```
**Expected**:
- Dashboard URL with optimized 2-chart-per-row layout
- Proper chart sizing (5×50 units)
- Responsive design

#### 5.2 Interactive Exploration
```
Generate an explore link for custom analysis:

Use the generate_explore_link tool with:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "scatter",
    "x": {"name": "price"},
    "y": [{"name": "quantity"}],
    "size": {"name": "profit", "aggregate": "SUM"},
    "color": {"name": "category"}
  }
}
```
**Expected**: Explore URL for interactive chart building

### Part 6: Advanced Features Demo

#### 6.1 Comprehensive Chart Type Coverage
```
Test our 13+ supported chart types:

Use the generate_chart tool with:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "pie",
    "dimension": {"name": "region"},
    "metric": {"name": "sales", "aggregate": "SUM"}
  },
  "slice_name": "Sales Distribution",
  "save_chart": false,
  "preview_formats": ["vega_lite", "ascii"]
}
```
**Supported types**: line, bar, area, scatter, pie, heatmap, histogram, box plot, gauge, funnel, big number, mixed timeseries, table

#### 6.2 Error Handling with Helpful Suggestions
```
Test intelligent error messages:

Use the generate_chart tool with:
{
  "dataset_id": 1,
  "config": {
    "chart_type": "line",
    "x": {"name": "nonexistent_column"},
    "y": [{"name": "sales"}]
  }
}
```
**Expected**:
- Detailed error message
- List of available columns
- Fuzzy match suggestions for typos

### Part 7: Performance & Cache Control

#### 7.1 Cache Performance Testing
```
Test cache behavior:

1. First request - fresh data:
Use the get_chart_data tool with:
{
  "identifier": 1,
  "use_cache": false,
  "force_refresh": true
}

2. Second request - cached data:
Use the get_chart_data tool with:
{
  "identifier": 1,
  "use_cache": true
}
```
**Expected**:
- First: cache_hit=false, slower response
- Second: cache_hit=true, fast response, cache_age_seconds shown

### Part 8: Production Features

#### 8.1 Bulk Operations
```
List charts with advanced filtering:

Use the list_charts tool with:
{
  "filters": [
    {"col": "viz_type", "opr": "in", "value": ["line", "bar", "area"]},
    {"col": "created_by", "opr": "eq", "value": 1}
  ],
  "order_column": "changed_on",
  "order_direction": "desc",
  "page_size": 20
}
```

#### 8.2 UUID and Slug Support
```
Access entities by different identifiers:

Use the get_dashboard_info tool with:
{
  "identifier": "sales-dashboard"  // Using slug instead of ID
}
```

## 🎉 Key Highlights

### New Vega-Lite Features
- ✨ 13+ chart types with automatic mapping
- 🧠 Intelligent data type detection
- 📊 Interactive specifications (v5)
- 🎯 Proper field encoding
- 🔄 Fallback strategies for unknown types

### Enhanced ASCII Charts
- 📊 Horizontal & vertical bar charts
- 📈 Connected line charts with trends
- 🎨 Gradient effects based on values
- 📐 Smart layout selection
- 💫 Professional Unicode characters

### Production Ready
- 🚀 Full mypy and ruff compliance
- 🔒 Comprehensive error handling
- 💾 Advanced cache control
- 📝 Detailed audit logging
- 🔍 UUID/slug identifier support

## 📋 Response Patterns

### Successful Chart with Previews
```json
{
  "chart": {
    "id": 123,
    "slice_name": "Sales Analysis",
    "url": "http://localhost:5008/explore/?slice_id=123"
  },
  "previews": {
    "url": "http://localhost:5008/screenshot/chart/123",
    "vega_lite": {
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      "data": {"values": [...]},
      "mark": "line",
      "encoding": {...}
    },
    "ascii": "📈 Line Chart\n════════════\n[ASCII visualization]"
  }
}
```

### Cache-Aware Data Response
```json
{
  "data": [...],
  "cache_status": {
    "cache_hit": true,
    "cache_type": "query_cache",
    "cache_age_seconds": 120
  },
  "insights": [
    "Trend: 15% growth over period",
    "Peak value: $125K on 2024-03-15"
  ]
}
```

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| No Vega-Lite preview | Ensure chart type is supported (see list above) |
| ASCII looks wrong | Check terminal width, use width=80 for best results |
| Cache not working | Verify Redis is running, check cache_timeout settings |
| Preview URL 404 | Screenshot service may need restart |

## 🎯 Success Metrics

After completing this demo, you should have:
- ✅ Generated charts in multiple formats
- ✅ Seen Vega-Lite JSON specifications
- ✅ Viewed enhanced ASCII visualizations
- ✅ Created an optimized dashboard
- ✅ Tested cache performance
- ✅ Experienced intelligent error handling

## 🚀 Next Steps

1. Try different chart types with your own data
2. Experiment with complex aggregations
3. Test the streaming capabilities for large datasets
4. Integrate with your LLM workflows
5. Explore the plugin architecture

---

**Pro Tip**: Save successful chart IDs and reuse them throughout the demo for consistent testing!
