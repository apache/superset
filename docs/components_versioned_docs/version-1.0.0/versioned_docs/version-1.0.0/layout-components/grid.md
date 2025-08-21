---
title: Grid (v1.0.0)
sidebar_position: 1
---

# Grid Component

The Grid component provides a flexible layout system for arranging content in rows and columns.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gutter` | `number` or `[number, number]` | `0` | Grid spacing between items, can be a single number or [horizontal, vertical] |
| `columns` | `number` | `12` | Number of columns in the grid |
| `justify` | `string` | `'start'` | Horizontal alignment: 'start', 'center', 'end', 'space-between', 'space-around' |
| `align` | `string` | `'top'` | Vertical alignment: 'top', 'middle', 'bottom' |
| `wrap` | `boolean` | `true` | Whether to wrap items when they overflow |

### Row Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gutter` | `number` or `[number, number]` | `0` | Spacing between items in the row |
| `justify` | `string` | `'start'` | Horizontal alignment for this row |
| `align` | `string` | `'top'` | Vertical alignment for this row |

### Col Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `span` | `number` | - | Number of columns the grid item spans |
| `offset` | `number` | `0` | Number of columns the grid item is offset |
| `xs`, `sm`, `md`, `lg`, `xl` | `number` or `object` | - | Responsive props for different screen sizes |

## Examples

### Basic Grid

```jsx
import { Grid, Row, Col } from '@superset-ui/core';

function Example() {
  return (
    <Grid>
      <Row gutter={16}>
        <Col span={8}>
          <div>Column 1</div>
        </Col>
        <Col span={8}>
          <div>Column 2</div>
        </Col>
        <Col span={8}>
          <div>Column 3</div>
        </Col>
      </Row>
    </Grid>
  );
}
```

### Responsive Grid

```jsx
import { Grid, Row, Col } from '@superset-ui/core';

function Example() {
  return (
    <Grid>
      <Row gutter={[16, 24]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <div>Responsive Column 1</div>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <div>Responsive Column 2</div>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <div>Responsive Column 3</div>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <div>Responsive Column 4</div>
        </Col>
      </Row>
    </Grid>
  );
}
```

## Best Practices

- Use the Grid system for complex layouts that need to be responsive
- Specify column widths for different screen sizes to ensure proper responsive behavior
- Use gutters to create appropriate spacing between grid items
- Keep the grid structure consistent throughout your application
- Consider using the grid system for dashboard layouts to ensure consistent spacing and alignment
