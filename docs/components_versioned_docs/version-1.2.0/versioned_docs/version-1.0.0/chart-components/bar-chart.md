---
title: Bar Chart (v1.0.0)
sidebar_position: 1
---

# Bar Chart Component

The Bar Chart component is used to visualize categorical data with rectangular bars.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `array` | `[]` | Array of data objects to visualize |
| `width` | `number` | `800` | Width of the chart in pixels |
| `height` | `number` | `600` | Height of the chart in pixels |
| `xField` | `string` | - | Field name for x-axis values |
| `yField` | `string` | - | Field name for y-axis values |
| `colorField` | `string` | - | Field name for color encoding |
| `colorScheme` | `string` | `'supersetColors'` | Color scheme to use |
| `showLegend` | `boolean` | `true` | Whether to show the legend |
| `showGrid` | `boolean` | `true` | Whether to show grid lines |
| `labelPosition` | `string` | `'top'` | Position of bar labels: 'top', 'middle', 'bottom' |

## Examples

### Basic Bar Chart

```jsx
import { BarChart } from '@superset-ui/chart-components';

const data = [
  { category: 'A', value: 10 },
  { category: 'B', value: 20 },
  { category: 'C', value: 15 },
  { category: 'D', value: 25 },
];

function Example() {
  return (
    <BarChart
      data={data}
      width={800}
      height={400}
      xField="category"
      yField="value"
      colorScheme="supersetColors"
    />
  );
}
```

### Grouped Bar Chart

```jsx
import { BarChart } from '@superset-ui/chart-components';

const data = [
  { category: 'A', group: 'Group 1', value: 10 },
  { category: 'A', group: 'Group 2', value: 15 },
  { category: 'B', group: 'Group 1', value: 20 },
  { category: 'B', group: 'Group 2', value: 25 },
  { category: 'C', group: 'Group 1', value: 15 },
  { category: 'C', group: 'Group 2', value: 10 },
];

function Example() {
  return (
    <BarChart
      data={data}
      width={800}
      height={400}
      xField="category"
      yField="value"
      colorField="group"
      colorScheme="supersetColors"
    />
  );
}
```

## Best Practices

- Use bar charts when comparing quantities across categories
- Sort bars by value for better readability, unless there's a natural order to the categories
- Use consistent colors for the same categories across different charts
- Consider using horizontal bar charts when category labels are long
