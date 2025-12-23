# Superset Plugin Chart ECharts PTM

**Portal Telemedicina Custom Chart Plugin System for Apache Superset**

A framework for creating Superset chart plugins with consistent Portal Telemedicina branding, styling, and user controls.

## 🎯 Overview

This plugin system wraps existing Superset chart plugins and applies:

- ✅ **PTM Design System**: Consistent colors, typography, and styling
- ✅ **Smart Default Application**: ECharts-aware merging with proper precedence
- ✅ **User Controls**: Color palettes, series types, zoom controls, JSON overrides
- ✅ **Minimal Boilerplate**: Create new plugins with just a few lines of code
- ✅ **Type-Safe**: Full TypeScript support with comprehensive type definitions

## 📦 Included Plugins

- **PTM Timeseries** - Time-series charts with full customization (line, bar, smooth, step, zoom)
- **PTM Pie Chart** - Pie/donut charts with PTM styling
- **PTM Big Number** - Large single-value displays with optional trendlines
- **PTM Table** - Clean tabular data with optional pill-styled columns for categorical values

## 🚀 Quick Start

### Create a New Plugin

```typescript
import { createPtmPlugin } from '@superset-ui/plugin-chart-echarts-ptm';
import thumbnail from './images/thumbnail.png';
import MY_CHART_DEFAULTS from './defaults';

const PtmMyChartPlugin = createPtmPlugin({
  name: 'PTM My Chart',
  description: 'Description of my chart',
  thumbnail,
  base: {
    buildQuery: MyChartBuildQuery,
    transformProps: MyChartTransformProps,
    controlPanel: MyChartControlPanel,
    Chart: EchartsMyChart,
  },
  transforms: 'timeseries',  // or 'pie', 'bar', 'table'
  ptmDefaults: MY_CHART_DEFAULTS,
});

export default PtmMyChartPlugin;
```

That's it! Your plugin now has:
- PTM styling automatically applied
- Color palette selector
- Series type override (if using 'timeseries' or 'bar' preset)
- Zoom controls (if using 'timeseries' preset)
- JSON override capability
- Consistent branding

## 📚 Documentation

- **[Developer Guide](./DEVELOPER_GUIDE.md)** - Complete guide with quick start, architecture, API reference, and best practices
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions

## 🎨 Features

### 1. Transform Presets

Choose the right preset for your chart type:

```typescript
transforms: 'timeseries'  // Full features: zoom, series type, colors
transforms: 'pie'         // Minimal: colors only
transforms: 'bar'         // Medium: series type, colors
transforms: 'table'       // Minimal: colors only
```

Or create custom configurations:

```typescript
transforms: {
  defaults: true,
  seriesType: true,
  dataZoom: false,
  colorPalette: true,
  userOverrides: true,
}
```

### 2. Smart Default Merging

Defaults are applied intelligently based on ECharts property types:

- **Series/Axes**: Merged into each array item
- **Tooltip/Legend**: Deep merged with existing config
- **DataZoom**: Only set if missing
- **Color Palette**: Completely replaced

### 3. Layered Precedence

Clear priority order ensures predictable behavior:

```
PTM Defaults (lowest)
    ↓
User Controls (medium)
    ↓
JSON Overrides (highest)
```

### 4. Built-in User Controls

Automatically added to control panel based on enabled transforms:

- **Color Palette**: Blue, Green, Red, Teal, Yellow, Mixed
- **Color Order**: Normal, Reverse, Light-to-Dark, Dark-to-Light
- **Series Type**: Auto, Line, Bar, Smooth, Step (Timeseries only)
- **Zoom Controls**: Enable/disable, axis selection, size, padding (Timeseries only)
- **Pill Columns**: Multi-select dropdown to style specific columns as colorful pills (Table only)
- **JSON Override**: Advanced custom ECharts configuration

### 5. Debug Mode

Enable visual and console debugging:

```typescript
createPtmPlugin({
  // ...
  debug: true,
});
```

Provides:
- Detailed console logging for each transform step
- Visual background tint on chart
- Debug title overlay
- Property-level merge tracking

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│      createPtmPlugin()              │
│                                     │
│  1. Wraps base plugin               │
│  2. Applies PTM transformProps      │
│  3. Adds control panel section      │
│  4. Sets metadata (category, tags)  │
└─────────────────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│    wrapTransformProps()             │
│                                     │
│  Single Transform Pipeline:         │
│  1. Run base transformProps         │
│  2. Call pluginTransform()          │
│     (custom or default)             │
│  3. Apply JSON overrides            │
└─────────────────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│    pluginTransform                  │
│                                     │
│  defaultPluginTransform (base):     │
│  - Apply PTM defaults               │
│  - Apply color palette              │
│                                     │
│  OR extended (e.g. timeseries):     │
│  - Call defaultPluginTransform()    │
│  - Add seriesType override          │
│  - Add dataZoom configuration       │
└─────────────────────────────────────┘
```

## 🎨 PTM Theme

The system includes a comprehensive design system:

### Colors
- Primary (Blues): `#2C9FE5`, `#2B7ADC`, etc.
- Secondary (Teals): `#71B6D7`, `#51D7BF`, etc.
- Success (Greens): `#5AD7A5`, `#52D182`, etc.
- Error (Reds): `#EC4B60`, `#C23043`, etc.
- Neutral (Grays): `#F7F7F6` to `#222222`

### Typography
- Body: Inter font family
- Headings: Manrope font family
- Sizes: 12px (small) to 24px (xlarge)

### Pre-built Components
- `PTM_ECHART_BASE`: Base styling
- `PTM_ECHART_GRID`: Grid configuration
- `PTM_ECHART_X_AXIS`: X-axis styling
- `PTM_ECHART_Y_AXIS`: Y-axis styling
- `PTM_ECHART_TOOLTIP`: Tooltip styling
- `PTM_ECHART_LEGEND`: Legend styling

## 📝 Examples

### Example 1: Timeseries Chart

```typescript
import { createPtmPlugin } from '../../shared';
import {
  PTM_ECHART_BASE,
  PTM_ECHART_X_AXIS,
  PTM_ECHART_Y_AXIS,
  PTM_ECHART_TOOLTIP,
} from '../../shared/ptmTheme';

const TIMESERIES_DEFAULTS = {
  ...PTM_ECHART_BASE,
  xAxis: PTM_ECHART_X_AXIS,
  yAxis: PTM_ECHART_Y_AXIS,
  tooltip: { ...PTM_ECHART_TOOLTIP, trigger: 'axis' },
  series: [{ smooth: true, showSymbol: false }],
};

export default createPtmPlugin({
  name: 'PTM Timeseries',
  description: 'Time-series with PTM styling',
  transforms: 'timeseries',
  ptmDefaults: TIMESERIES_DEFAULTS,
  base: { /* base plugin config */ },
});
```

### Example 2: Pie Chart

```typescript
const PIE_DEFAULTS = {
  ...PTM_ECHART_BASE,
  tooltip: { ...PTM_ECHART_TOOLTIP, trigger: 'item' },
  series: [{ 
    radius: ['45%', '70%'],
    itemStyle: { borderRadius: 8 },
  }],
};

export default createPtmPlugin({
  name: 'PTM Pie',
  description: 'Pie chart with PTM styling',
  transforms: 'pie',
  ptmDefaults: PIE_DEFAULTS,
  base: { /* base plugin config */ },
});
```

### Example 3: Table with Pill Columns

```typescript
// Table plugin with pill formatting for categorical columns
export default createPtmPlugin({
  name: 'Table PTM',
  description: 'Table with optional pills for categorical values',
  transforms: TABLE_TRANSFORM_CONFIG,
  additionalPtmControls: [tablePillColumnsControl],
  base: {
    buildQuery: TableBuildQuery,
    transformProps: wrapTableTransformProps(TableTransformProps),
    controlPanel: TableControlPanel,
    Chart: TableChartPTM,
  },
});

// The pill control dynamically populates with columns from query results
// Users select which columns to style as pills - great for status, category, etc.
```

### Example 4: Custom Controls

```typescript
import { t } from '@superset-ui/core';

const customControl = [{
  name: 'my_option',
  config: {
    type: 'SelectControl',
    label: t('My Option'),
    default: 'value1',
    choices: [
      ['value1', t('Option 1')],
      ['value2', t('Option 2')],
    ],
    renderTrigger: true,
  },
}];

export default createPtmPlugin({
  name: 'PTM Custom Chart',
  transforms: 'timeseries',
  additionalPtmControls: [customControl],
  ptmDefaults: { /* ... */ },
  base: { /* ... */ },
});
```

## 🔧 Development

### Directory Structure

```
src/
├── plugin/                    # Individual chart plugins
│   ├── timeseries/
│   │   ├── index.ts
│   │   ├── defaults.ts
│   │   ├── timeseriesTransformConfig.ts
│   │   ├── timeseriesPluginTransform.ts
│   │   ├── transformHelpers/
│   │   └── images/
│   ├── pie/
│   │   ├── index.ts
│   │   ├── defaults.ts
│   │   ├── pieTransformConfig.ts
│   │   └── images/
│   └── table/
│       ├── index.ts
│       ├── tableTransformConfig.ts
│       ├── pillFormat.ts
│       └── Styles.tsx
├── shared/                    # Core system
│   ├── createPtmPlugin.ts     # Main factory
│   ├── wrapTransformProps.ts  # Transform orchestrator
│   ├── defaultPluginTransform.ts  # Default transform base
│   ├── ptmControlSection.ts   # Control panel builder
│   ├── ptmTheme.ts            # Design system
│   └── transformHelpers/      # Shared transform utilities
│       ├── transformRegistry.ts
│       ├── echartsSchema.ts
│       ├── applyDefaults.ts
│       └── colorPalette.ts
└── index.ts                   # Main exports
```

### Adding a New Plugin

1. Create `src/plugin/my-chart/` directory
2. Define defaults in `defaults.ts`
3. Create plugin in `index.ts` using `createPtmPlugin`
4. Add thumbnail image
5. Export in `src/index.ts`
6. Register in Superset

See [Full Documentation](./PTM_PLUGIN_DOCUMENTATION.md) for detailed steps.

## 🐛 Debugging

Enable debug mode to see detailed transform information:

```typescript
createPtmPlugin({
  // ...
  debug: true,
});
```

See [Troubleshooting Guide](./TROUBLESHOOTING.md) for detailed debugging help.

## 📖 API Reference

### `createPtmPlugin(config: PtmPluginConfig)`

Creates a PTM-wrapped chart plugin.

**Parameters:**
- `name` - Plugin display name
- `description` - Plugin description
- `thumbnail` - Path to thumbnail image
- `base` - Base plugin configuration (buildQuery, transformProps, controlPanel, Chart)
- `transforms` - Transform preset name or custom config
- `ptmDefaults` - PTM default styling (ECharts options)
- `additionalPtmControls` - Optional custom controls
- `debug` - Optional debug mode flag

**Returns:** ChartPlugin class

### Transform Presets

- `'timeseries'` - Full features
- `'pie'` - Minimal features
- `'bar'` - Medium features
- `'table'` - Minimal features

### Transform Configuration

```typescript
interface TransformConfig {
  defaults?: boolean;        // Apply PTM defaults
  seriesType?: boolean;      // Enable series type control
  dataZoom?: boolean;        // Enable zoom controls
  colorPalette?: boolean;    // Enable color palette control
  userOverrides?: boolean;   // Enable JSON overrides
}
```

## 🤝 Contributing

When contributing new plugins or features:

1. Follow existing patterns and naming conventions
2. Use PTM theme constants instead of hardcoded values
3. Test with debug mode enabled
4. Document any new controls or features
5. Update relevant documentation files

## 📄 License

Licensed under the Apache License, Version 2.0. See LICENSE for details.

## 🔗 Resources

- [Developer Guide](./DEVELOPER_GUIDE.md) - Complete documentation
- [Troubleshooting](./TROUBLESHOOTING.md) - Problem solving
- [ECharts Documentation](https://echarts.apache.org/en/option.html) - ECharts API reference
- [Superset Documentation](https://superset.apache.org/docs/intro) - Superset docs

---

**Maintained by**: Portal Telemedicina Development Team  
**Version**: 1.0  
**Last Updated**: December 2024
