# Control Panel Migration Guide

This guide explains how to migrate chart control panels from the legacy configuration-based approach to the modern React component-based approach using JSON Forms.

## Overview

The migration involves:
1. Converting static configuration objects to React components
2. Using shared React components for common patterns
3. Preparing for eventual JSON Schema-based forms

## Key Changes

### Old Approach (Configuration-based)
```typescript
// controlPanel.ts
const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Chart Options'),
      controlSetRows: [
        [
          {
            name: 'x_axis_format',
            config: {
              type: 'SelectControl',
              label: t('X Axis Format'),
              choices: D3_FORMAT_OPTIONS,
              default: 'SMART_NUMBER',
            },
          },
        ],
      ],
    },
  ],
};
```

### New Approach (React Component-based)
```typescript
// controlPanelModern.tsx
import { AxisControlSection, FormatControlGroup } from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Chart Options'),
      controlSetRows: [
        [
          <AxisControlSection
            axis="x"
            showFormat={true}
            values={{}}
            onChange={(name, value) => {
              // Handle changes
            }}
          />,
        ],
      ],
    },
  ],
};
```

## Available Shared Components

### 1. AxisControlSection
Handles all axis-related controls (title, format, rotation, bounds, etc.)

```typescript
<AxisControlSection
  axis="x" // or "y"
  showTitle={true}
  showFormat={true}
  showRotation={true}
  showBounds={true}
  showLogarithmic={true} // Y-axis only
  showMinorTicks={true}   // Y-axis only
  showTruncate={true}
  timeFormat={true}       // For time series X-axis
  values={formData}
  onChange={(name, value) => updateFormData(name, value)}
/>
```

### 2. FormatControlGroup
Manages number, currency, date, and percentage formatting

```typescript
<FormatControlGroup
  showNumber={true}
  showCurrency={true}
  showDate={true}
  showPercentage={true}
  numberFormatLabel={t('Custom label')}
  values={formData}
  onChange={(name, value) => updateFormData(name, value)}
/>
```

### 3. OpacityControl
Slider control for opacity settings

```typescript
<OpacityControl
  name="bubble_opacity"
  label={t('Bubble Opacity')}
  description={t('Set the opacity of bubbles')}
  value={0.6}
  min={0}
  max={1}
  step={0.1}
  onChange={(value) => updateFormData('opacity', value)}
/>
```

### 4. MarkerControlGroup
Toggle and size control for line markers

```typescript
<MarkerControlGroup
  enabledLabel={t('Show markers')}
  sizeLabel={t('Marker size')}
  maxSize={20}
  values={{
    markerEnabled: false,
    markerSize: 6,
  }}
  onChange={(name, value) => updateFormData(name, value)}
/>
```

## Migration Steps

### Step 1: Create a Modern Control Panel File

Create a new file alongside your existing control panel:
- Old: `controlPanel.ts`
- New: `controlPanelModern.tsx`

### Step 2: Import Required Components

```typescript
import React from 'react';
import { t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  sections,
  AxisControlSection,
  FormatControlGroup,
  OpacityControl,
  MarkerControlGroup,
} from '@superset-ui/chart-controls';
```

### Step 3: Replace Common Patterns

#### Replace X/Y Axis Controls
```typescript
// Old: Multiple individual controls
['x_axis_title'],
['x_axis_format'],
['x_axis_label_rotation'],

// New: Single component
[
  <AxisControlSection
    key="x-axis-section"
    axis="x"
    showTitle={true}
    showFormat={true}
    showRotation={true}
    values={formData}
    onChange={handleChange}
  />,
]
```

#### Replace Format Controls
```typescript
// Old: Individual format controls
[
  {
    name: 'number_format',
    config: { /* ... */ },
  },
],
[
  {
    name: 'currency_format',
    config: { /* ... */ },
  },
],

// New: Grouped component
[
  <FormatControlGroup
    key="format-controls"
    showNumber={true}
    showCurrency={true}
    values={formData}
    onChange={handleChange}
  />,
]
```

### Step 4: Keep Complex Controls As-Is

For controls that don't have shared components yet, keep them in their original configuration format. They can coexist with React components:

```typescript
controlSetRows: [
  // React component
  [<AxisControlSection ... />],
  // Traditional control
  ['color_scheme'],
  // Custom control configuration
  [
    {
      name: 'custom_control',
      config: {
        type: 'SelectControl',
        // ...
      },
    },
  ],
]
```

### Step 5: Test the Migration

1. Import the modern control panel in your plugin index
2. Test all controls render correctly
3. Verify form data updates properly
4. Check that existing dashboards/charts still work

## Example: Complete Migration

See these examples for reference:
- `BigNumber/BigNumberTotal/controlPanelModern.tsx`
- `BoxPlot/controlPanelModern.tsx`
- `Bubble/controlPanelModern.tsx`
- `Timeseries/Regular/Line/controlPanelModern.tsx`

## Benefits of Migration

1. **Code Reuse**: Shared components reduce duplication
2. **Consistency**: Uniform UI/UX across all charts
3. **Type Safety**: Full TypeScript support with proper types
4. **Future-Ready**: Prepared for JSON Schema-based forms
5. **Maintainability**: Centralized components are easier to update

## Gradual Migration Strategy

You don't need to migrate everything at once:

1. Start with high-value components (axis controls, formats)
2. Keep complex/unique controls as configuration
3. Progressively extract more patterns to shared components
4. Eventually move to full JSON Schema definitions

## Need Help?

- Check existing migrated examples in the codebase
- Look for patterns in `superset-ui-chart-controls/src/shared-controls/components/`
- File an issue if you need a new shared component
