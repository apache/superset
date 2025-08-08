# Control Panel Migration Guide: From Arrays to JSON Forms

## Overview

We're migrating from the proprietary array-based control panel layout system to JSON Forms, which provides:
- **Standard UI Schema**: Industry-standard layout definitions
- **Better Layout Control**: Horizontal/vertical layouts, groups, tabs
- **Native Collapsible Sections**: Using AntD components
- **Conditional Visibility**: Built-in rules for showing/hiding controls
- **Type Safety**: Full TypeScript support

## Old System (Deprecated)

```typescript
// Array of arrays for rows and columns
controlPanelSections: [
  {
    label: t('Query'),
    expanded: true,
    controlSetRows: [
      [MetricControl()],           // Single column
      [GroupByControl(), ColumnsControl()],  // Two columns
    ],
  },
]
```

## New System (JSON Forms)

```typescript
import {
  createVerticalLayout,
  createHorizontalLayout,
  createCollapsibleGroup,
  createControl,
} from '@superset-ui/chart-controls';

// Define data schema
const schema: JsonSchema = {
  type: 'object',
  properties: {
    metric: { type: 'string', title: t('Metric') },
    groupby: { type: 'array', title: t('Group By') },
    columns: { type: 'array', title: t('Columns') },
  },
};

// Define layout using JSON Forms
const uischema = createVerticalLayout([
  createCollapsibleGroup(
    t('Query'),
    [
      createControl('#/properties/metric'),
      createHorizontalLayout([
        createControl('#/properties/groupby'),
        createControl('#/properties/columns'),
      ]),
    ],
    true, // expanded
  ),
]);
```

## Layout Components

### 1. Vertical Layout (Default)
```typescript
createVerticalLayout([
  createControl('#/properties/field1'),
  createControl('#/properties/field2'),
])
```

### 2. Horizontal Layout (Columns)
```typescript
createHorizontalLayout([
  createControl('#/properties/left'),
  createControl('#/properties/right'),
])
```

### 3. Collapsible Sections (AntD Collapse)
```typescript
createCollapsibleGroup(
  'Section Title',
  [/* controls */],
  true, // expanded by default
)
```

### 4. Tabbed Layout (AntD Tabs)
```typescript
createTabbedLayout([
  {
    label: 'Tab 1',
    elements: [/* controls */],
  },
  {
    label: 'Tab 2',
    elements: [/* controls */],
  },
])
```

## Conditional Visibility

```typescript
{
  type: 'Control',
  scope: '#/properties/conditionalField',
  rule: {
    effect: 'SHOW',
    condition: {
      scope: '#/properties/toggleField',
      schema: { const: true },
    },
  },
}
```

## Migration Steps

### 1. Automatic Migration

```typescript
import { migrateControlPanel } from '@superset-ui/chart-controls';

const oldConfig: ControlPanelConfig = {
  controlPanelSections: [/* ... */],
};

const { schema, uischema } = migrateControlPanel(oldConfig);
```

### 2. Manual Migration

1. **Create JSON Schema**: Define data types and validation
2. **Create UI Schema**: Define layout using helper functions
3. **Replace controlPanelSections**: Use schema + uischema

### 3. Incremental Migration

You can embed JSON Forms panels within existing control panels:

```typescript
controlPanelSections: [
  {
    label: t('Modern Section'),
    controlSetRows: [
      [
        <JsonFormsControlPanel
          schema={schema}
          uischema={uischema}
          data={formData}
          onChange={handleChange}
        />,
      ],
    ],
  },
]
```

## Custom Renderers

For complex controls, create custom renderers:

```typescript
const CustomControlRenderer = ({ uischema, schema, path, data }) => {
  return <YourCustomComponent />;
};

const customRenderers = [
  {
    tester: (uischema) =>
      uischema.options?.controlType === 'custom' ? 10 : -1,
    renderer: CustomControlRenderer,
  },
];
```

## Benefits

1. **Standardized**: Uses JSON Schema and JSON Forms standards
2. **Declarative**: Layout defined in data, not code
3. **Reusable**: Share schemas across charts
4. **Maintainable**: Clear separation of data and layout
5. **Extensible**: Easy to add custom renderers
6. **Type-safe**: Full TypeScript support

## Examples

See these files for complete examples:
- `plugins/legacy-plugin-chart-chord/src/controlPanelJsonForms.tsx`
- `plugins/plugin-chart-echarts/src/BigNumber/BigNumberTotal/controlPanelJsonForms.tsx`

## Roadmap

1. ✅ Create JSON Forms utilities and helpers
2. ✅ Add AntD integration for collapsible sections and tabs
3. 🔄 Migrate existing control panels
4. 🔄 Create custom renderers for complex controls
5. 📋 Remove deprecated array-based system
6. 📋 Update documentation and examples
