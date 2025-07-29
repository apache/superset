# Chart Metadata API Reference

The Superset MCP service provides rich metadata alongside chart generation to enable better UI integration and user experiences.

## Background & Design Philosophy

Modern chart systems need to provide more than just visual output. Inspired by contemporary web standards and LLM integration patterns, this metadata system addresses several key needs:

**Accessibility-First Design**: Following WCAG guidelines and `aria-*` attribute patterns, charts include semantic descriptions and accessibility metadata to ensure inclusive experiences.

**Rich Context for AI Systems**: Similar to how platforms like social media generate rich previews (OpenGraph, Twitter Cards), charts provide semantic understanding beyond just visual representation - enabling AI agents to reason about and describe visualizations meaningfully.

**Performance-Aware Integration**: Modern web APIs emphasize performance transparency (Core Web Vitals, etc.). Charts include execution metrics and optimization suggestions to help UIs make informed decisions about rendering and user feedback.

**Capability-Driven UX**: Rather than requiring UIs to hardcode chart type behaviors, the system exposes what each chart can actually do - enabling dynamic, contextual interfaces that adapt to chart capabilities.

## Overview

When generating charts via `generate_chart`, the response includes structured metadata that helps UIs:
- Present appropriate controls and interactions
- Generate accessible descriptions
- Optimize rendering performance
- Guide user workflows

## Metadata Types

### ChartCapabilities

Describes what interactions and features the chart supports.

```python
{
  "supports_interaction": bool,      # User can interact (zoom, pan, hover)
  "supports_real_time": bool,        # Chart can update with live data
  "supports_drill_down": bool,       # Can navigate to more detailed views
  "supports_export": bool,           # Can be exported to other formats
  "optimal_formats": [               # Recommended preview formats
    "url",           # Static image URL
    "interactive",   # HTML with JavaScript controls
    "ascii",         # Text-based representation
    "vega_lite"      # Vega-Lite specification
  ],
  "data_types": [                    # Types of data visualized
    "time_series",   # Time-based data
    "categorical",   # Discrete categories
    "metric"         # Numeric measurements
  ]
}
```

**UI Integration:**
- Show/hide interaction controls based on `supports_interaction`
- Enable real-time updates if `supports_real_time`
- Display drill-down options for `supports_drill_down`
- Choose optimal preview format from `optimal_formats`

### ChartSemantics

Provides semantic understanding of what the chart represents and reveals.

```python
{
  "primary_insight": "Shows trends and changes over time",
  "data_story": "This line chart analyzes sales, revenue over Q1-Q4",
  "recommended_actions": [
    "Review data patterns and trends",
    "Consider filtering for more detail",
    "Export chart for reporting"
  ],
  "anomalies": [],                   # Notable outliers (future enhancement)
  "statistical_summary": {}         # Key statistics (future enhancement)
}
```

**UI Integration:**
- Display `primary_insight` as chart description
- Use `data_story` for accessibility and tooltips
- Show `recommended_actions` as suggested next steps
- Highlight `anomalies` in the visualization

### AccessibilityMetadata

Information for creating inclusive, accessible chart experiences.

```python
{
  "color_blind_safe": bool,          # Uses colorblind-friendly palette
  "alt_text": "Chart showing Sales Data over time",
  "high_contrast_available": bool    # High contrast version available
}
```

**UI Integration:**
- Use `alt_text` for screen readers
- Show accessibility indicators if `color_blind_safe`
- Offer high contrast mode if available

### PerformanceMetadata

Performance information for optimization and user feedback.

```python
{
  "query_duration_ms": 1250,        # Time to generate chart data
  "cache_status": "hit|miss|error", # Whether data came from cache
  "optimization_suggestions": [      # Performance improvement tips
    "Consider adding date filters to reduce data volume",
    "Chart complexity may impact load time"
  ]
}
```

**UI Integration:**
- Show loading indicators based on `query_duration_ms`
- Display cache status for debugging
- Present `optimization_suggestions` to users
- Warn about slow queries

## Example Response

```json
{
  "chart": {
    "id": 123,
    "slice_name": "Sales Trends Q1-Q4",
    "viz_type": "echarts_timeseries_line",
    "url": "/explore/?slice_id=123"
  },
  "capabilities": {
    "supports_interaction": true,
    "supports_real_time": false,
    "supports_drill_down": false,
    "supports_export": true,
    "optimal_formats": ["url", "interactive", "ascii"],
    "data_types": ["time_series", "metric"]
  },
  "semantics": {
    "primary_insight": "Shows trends and changes over time",
    "data_story": "This line chart analyzes sales over Q1-Q4",
    "recommended_actions": [
      "Review seasonal patterns",
      "Export for quarterly report"
    ]
  },
  "accessibility": {
    "color_blind_safe": true,
    "alt_text": "Line chart showing sales trends from Q1 to Q4",
    "high_contrast_available": false
  },
  "performance": {
    "query_duration_ms": 450,
    "cache_status": "miss",
    "optimization_suggestions": []
  }
}
```

## Usage Examples

### React Component Integration

```jsx
function ChartComponent({ chartData }) {
  const { capabilities, semantics, accessibility, performance } = chartData;

  return (
    <div>
      {/* Accessibility */}
      <img
        src={chartData.chart.url}
        alt={accessibility.alt_text}
        aria-describedby="chart-description"
      />

      {/* Semantic description */}
      <p id="chart-description">{semantics.primary_insight}</p>

      {/* Conditional controls based on capabilities */}
      {capabilities.supports_interaction && (
        <InteractiveControls />
      )}

      {capabilities.supports_export && (
        <ExportButton />
      )}

      {/* Performance feedback */}
      {performance.query_duration_ms > 2000 && (
        <SlowQueryWarning suggestions={performance.optimization_suggestions} />
      )}

      {/* Recommended actions */}
      <ActionSuggestions actions={semantics.recommended_actions} />
    </div>
  );
}
```

## Chart Type Mapping

Different chart types provide different capabilities:

| Chart Type | Interaction | Real-time | Drill-down | Optimal Formats |
|------------|------------|-----------|------------|-----------------|
| `echarts_timeseries_line` | ✅ | ✅ | ❌ | url, interactive, ascii |
| `echarts_timeseries_bar` | ✅ | ✅ | ❌ | url, interactive, ascii |
| `table` | ❌ | ❌ | ✅ | url, table, ascii |
| `pie` | ✅ | ❌ | ❌ | url, interactive |

## Future Enhancements

- **Statistical Summary**: Automatic calculation of mean, median, trends
- **Anomaly Detection**: Identification of outliers and unusual patterns
- **Smart Recommendations**: ML-powered suggestions for chart improvements
- **Accessibility Scoring**: Automated accessibility compliance checking
