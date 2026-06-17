# Glyph Pattern Migration Guide

This guide documents how to migrate traditional Superset chart plugins to the single-file Glyph pattern.

## Overview

The Glyph pattern simplifies chart plugin development by:
- **Arguments define BOTH controls AND render props** - No separate files needed
- **No `controlPanel.ts`** - Generated from argument definitions
- **No `transformProps.ts`** - Arguments are passed directly to render
- **No `buildQuery.ts`** - Inferred from Metric/Dimension/Temporal arguments
- **Single file** - Everything in one place (~200 lines vs 500+ across multiple files)

## Migration Steps

### 1. Analyze the Existing Chart

Identify from the original chart:
- **Metrics/Dimensions**: What data does it query?
- **Controls**: What options does the user configure?
- **Styling**: What visual customizations exist?
- **Rendering**: How is the data displayed?

### 2. Create the Glyph Chart File

Create a new file: `src/BigNumber/BigNumberGlyph/index.tsx`

```typescript
import { t } from '@apache-superset/core';
import { styled } from '@apache-superset/core/ui';
import { Behavior, getNumberFormatter, CurrencyFormatter } from '@superset-ui/core';

import {
  defineChart,
  Metric,
  Select,
  Text,
  Checkbox,
  NumberFormat,
  Currency,
  TimeFormat,
  ConditionalFormatting,
} from '@superset-ui/glyph-core';
```

### 3. Define Arguments (Controls + Props)

**CRITICAL: Use camelCase for argument names!**

Superset converts control names to camelCase in `formData`. If you use snake_case (`show_metric_name`), it won't match the camelCase key in formData (`showMetricName`).

```typescript
arguments: {
  // Data arguments
  metric: Metric.with({ label: t('Metric') }),

  // Visual arguments - USE CAMELCASE!
  headerFontSize: Select.with({
    label: t('Font Size'),
    options: [
      { label: t('Small'), value: 0.2 },
      { label: t('Large'), value: 0.4 },
    ],
    default: 0.4,
  }),

  showMetricName: Checkbox.with({
    label: t('Show Metric Name'),
    default: false,
  }),

  // Declarative visibility (preferred)
  metricNameFontSize: {
    arg: Select.with({ ... }),
    visibleWhen: { showMetricName: true },
  },

  // Declarative disabled state
  subtitleFontSize: {
    arg: Select.with({ ... }),
    disabledWhen: { subtitle: '' },
  },
}
```

### 4. Available Argument Types

| Type | Control Generated | Value Type | Properties |
|------|------------------|------------|------------|
| `Metric` | MetricControl | `{ value, name, formattedValue }` | `label` |
| `Dimension` | GroupByControl | `string[]` | `label` |
| `Temporal` | TemporalControl | `string` | `label` |
| `Select` | SelectControl | `string \| number` | `label`, `description`, `options`, `default` |
| `Text` | TextControl | `string` | `label`, `description`, `default`, `placeholder` |
| `Checkbox` | CheckboxControl | `boolean` | `label`, `description`, `default` |
| `Int` | SliderControl | `number` | `label`, `description`, `default`, `min`, `max`, `step` |
| `Color` | ColorPickerControl | `string` (hex) | `label`, `description`, `default` |
| `NumberFormat` | SelectControl (freeform) | `string` | `label`, `description`, `default` |
| `Currency` | CurrencyControl | `{ symbol?, symbolPosition? }` | `label`, `description`, `default` |
| `TimeFormat` | SelectControl (freeform) | `string` | `label`, `description`, `default` |
| `ConditionalFormatting` | ConditionalFormattingControl | `Rule[]` | `label`, `description` |

### 5. Declarative Visibility & Disabled States

Instead of Redux `mapStateToProps`, use declarative conditions:

```typescript
// Simple equality check - visible when showMetricName is true
metricNameFontSize: {
  arg: Select.with({ ... }),
  visibleWhen: { showMetricName: true },
},

// Function check - visible when subtitle is not empty
subtitleFontSize: {
  arg: Select.with({ ... }),
  visibleWhen: { subtitle: (val) => !!val },
},

// Multiple conditions (AND) - visible when both conditions are met
advancedOption: {
  arg: Checkbox.with({ ... }),
  visibleWhen: {
    showMetricName: true,
    subtitle: (val) => !!val,
  },
},

// Disabled state (control visible but not editable)
formatOption: {
  arg: Select.with({ ... }),
  disabledWhen: { forceTimestampFormatting: true },
},
```

### 6. Number, Currency, and Time Formatting

Use the built-in format argument types:

```typescript
arguments: {
  numberFormat: NumberFormat.with({
    label: t('Number Format'),
    description: t('D3 format string'),
    default: 'SMART_NUMBER',
  }),

  currencyFormat: Currency.with({
    label: t('Currency Format'),
  }),

  timeFormat: TimeFormat.with({
    label: t('Date Format'),
    default: 'smart_date',
  }),
}
```

Then use them directly in the render function:

```typescript
render: ({ numberFormat, currencyFormat, timeFormat, metric }) => {
  const formatter = currencyFormat?.symbol
    ? new CurrencyFormatter({
        currency: { symbol: currencyFormat.symbol, symbolPosition: currencyFormat.symbolPosition ?? 'prefix' },
        d3Format: numberFormat,
      })
    : getNumberFormatter(numberFormat);

  return <div>{formatter(metric.value)}</div>;
}
```

### 7. Conditional Formatting (Colors)

Use `ConditionalFormatting` for color-based rules:

```typescript
import { getColorFormatters } from '@superset-ui/chart-controls';

arguments: {
  conditionalFormatting: ConditionalFormatting.with({
    label: t('Conditional Formatting'),
    description: t('Apply conditional color formatting to metric'),
  }),
},

render: ({ conditionalFormatting, metric, data, theme }) => {
  let numberColor: string | undefined;

  if (conditionalFormatting?.length > 0 && metric.value != null) {
    const colorFormatters = getColorFormatters(conditionalFormatting, data, theme, false);
    if (colorFormatters) {
      for (const formatter of colorFormatters) {
        const color = formatter.getColorFromValue(metric.value as number);
        if (color) {
          numberColor = color;
          break;
        }
      }
    }
  }

  return <BigNumberText color={numberColor}>{metric.formattedValue}</BigNumberText>;
}
```

### 8. Styled Components

Use Superset's theme properties with template literal syntax:

```typescript
const Container = styled.div<{ height: number }>`
  ${({ theme, height }) => `
    height: ${height}px;
    padding: ${theme.sizeUnit * 4}px;
    font-family: ${theme.fontFamily};
    color: ${theme.colorText};
  `}
`;
```

**Common theme properties:**
| Property | Description |
|----------|-------------|
| `theme.sizeUnit` | Base spacing unit (typically 4px) |
| `theme.fontFamily` | Default font family |
| `theme.fontWeightNormal` | Normal font weight |
| `theme.fontWeightLight` | Light font weight |
| `theme.fontSizeSM` | Small font size |
| `theme.colorText` | Primary text color |
| `theme.colorTextTertiary` | Muted/secondary text color |
| `theme.borderRadius` | Standard border radius |

### 9. Render Function

The render function receives all arguments directly - no formData lookup needed:

```typescript
render: ({
  metric,
  headerFontSize,
  showMetricName,
  numberFormat,
  currencyFormat,
  conditionalFormatting,
  height,
  data,
  theme,
}) => {
  // All arguments are directly available!
  const formatter = currencyFormat?.symbol
    ? new CurrencyFormatter({ currency: currencyFormat, d3Format: numberFormat })
    : getNumberFormatter(numberFormat);

  const formattedValue = metric.value != null
    ? formatter(metric.value as number)
    : t('No data');

  return (
    <Container height={height}>
      {showMetricName && <MetricName>{metric.name}</MetricName>}
      <BigNumberText>{formattedValue}</BigNumberText>
    </Container>
  );
},
```

### 10. Register the Plugin

In `BigNumber/index.ts`:
```typescript
export { default as BigNumberGlyphChartPlugin } from './BigNumberGlyph';
```

In `plugin-chart-echarts/src/index.ts`:
```typescript
export { BigNumberGlyphChartPlugin } from './BigNumber';
```

In `MainPreset.js`:
```typescript
import { BigNumberGlyphChartPlugin } from '@superset-ui/plugin-chart-echarts';

new BigNumberGlyphChartPlugin().configure({ key: 'big_number_glyph' }),
```

## Common Pitfalls

### 1. Snake Case vs Camel Case
- **WRONG**: `show_metric_name` - won't match formData
- **RIGHT**: `showMetricName` - matches Superset's camelCase conversion

### 2. Theme Undefined
- **WRONG**: `theme.gridUnit` - crashes if theme is undefined
- **RIGHT**: `theme?.gridUnit ?? 4` - safe with fallback

### 3. Metric Value Extraction
The Glyph core automatically extracts metric values from query results. The `metric` argument provides:
- `metric.value` - The raw numeric value
- `metric.name` - The metric label/name
- `metric.formattedValue` - Basic string representation

### 4. Visibility vs Legacy Functions
- **Prefer**: `visibleWhen: { showMetricName: true }` - declarative, clean
- **Legacy**: `visibility: ({ controls }) => controls?.showMetricName?.value === true` - still works

## File Structure Comparison

### Traditional (5+ files, ~500 lines)
```
BigNumberTotal/
├── index.ts           # Plugin registration
├── controlPanel.ts    # Control definitions (~100 lines)
├── transformProps.ts  # Data transformation (~150 lines)
├── buildQuery.ts      # Query building (~50 lines)
├── BigNumberViz.tsx   # React component (~150 lines)
└── types.ts           # TypeScript types (~50 lines)
```

### Glyph Pattern (1 file, ~250 lines)
```
BigNumberGlyph/
└── index.tsx          # Everything in one file!
```

## Complete Example

See `BigNumber/BigNumberGlyph/index.tsx` for a complete working example with:
- Metric display
- Number/currency/time formatting
- Conditional color formatting
- Declarative visibility
- Subtitle support
- Font size controls
