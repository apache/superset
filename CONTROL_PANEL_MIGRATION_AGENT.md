# Control Panel Migration Agent

A comprehensive guide for migrating Apache Superset control panels from the legacy config-based approach to the new React-based approach.

## Overview

This migration transforms control panels from complex string-referenced configurations (`controlPanelSections`/`controlSetRows`) to pure React components. The new approach provides:

- **Direct React components** instead of config objects
- **Full TypeScript support** with proper type safety
- **Simplified architecture** with no JSON intermediary
- **Better developer experience** with IDE autocomplete and refactoring support

## Architecture Comparison

### Legacy Architecture
```typescript
// Old approach: Config-based with string references and config objects
const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [GroupByControl()], // String reference
        [MetricControl()],  // String reference
        [
          {
            name: 'show_labels',
            config: {
              type: 'CheckboxControl',
              label: t('Show Labels'),
              renderTrigger: true,
              default: true,
            },
          },
        ], // Config object
      ],
    },
  ],
};
```

### New React-Based Architecture
```typescript
// New approach: Pure React components with direct JSX
export const PieControlPanel: FC<PieControlPanelProps> = ({ ... }) => {
  return (
    <div>
      <DndColumnSelect
        value={formValues.groupby || []}
        onChange={handleChange('groupby')}
        // ... other props
      />
      <CheckboxControl
        label={t('Show Labels')}
        value={formValues.show_labels ?? true}
        onChange={handleChange('show_labels')}
        renderTrigger
      />
    </div>
  );
};

// Mark as modern panel
(PieControlPanel as any).isModernPanel = true;
```

## Migration Steps

### 1. File Structure

Keep the existing file location but change from config to React component:
- `controlPanel.ts` → `[ChartName]ControlPanelSimple.tsx`
- The file remains in the same directory as the original

### 2. Update Imports

**From (Legacy):**
```typescript
import {
  ControlPanelConfig,
  sharedControls,
  GroupByControl,
  MetricControl
} from '@superset-ui/chart-controls';
```

**To (Modern):**
```typescript
import { FC, useState } from 'react';
import { t } from '@superset-ui/core';
import { Tabs } from 'antd';
import {
  ColorSchemeControl,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
} from '@superset-ui/chart-controls';

// Direct component imports
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import SliderControl from '../../../../src/explore/components/controls/SliderControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import CurrencyControl from '../../../../src/explore/components/controls/CurrencyControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';
```

### 3. Component Structure Template

Create a React component with this structure:

```typescript
interface [ChartName]ControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

export const [ChartName]ControlPanel: FC<[ChartName]ControlPanelProps> = ({
  onChange,
  value,
  datasource,
  form_data,
  actions,
  controls,
}) => {
  // Safety checks for datasource
  if (!datasource || !form_data) {
    return <div>Loading control panel...</div>;
  }

  // Ensure safe data structures
  const safeColumns = Array.isArray(datasource?.columns) ? datasource.columns : [];
  const safeMetrics = Array.isArray(datasource?.metrics) ? datasource.metrics : [];

  // Helper for control changes
  const handleChange = (field: string) => (val: any) => {
    if (actions?.setControlValue) {
      actions.setControlValue(field, val);
    } else if (onChange) {
      onChange(field, val);
    }
  };

  // Get form values
  const formValues = form_data || value || {};

  // Tab state (if using tabs)
  const [activeTab, setActiveTab] = useState('data');

  // Component implementation here...

  return (
    <div style={{ padding: '16px' }}>
      {/* Your controls here */}
    </div>
  );
};

// CRITICAL: Mark as modern panel
([ChartName]ControlPanel as any).isModernPanel = true;

// Export wrapper config for compatibility
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[[ChartName]ControlPanel as any]],
    },
  ],
  controlOverrides: {
    // Move all defaults here
    field_name: {
      default: defaultValue,
      label: t('Field Label'),
      renderTrigger: true,
    },
  },
};

export default config;
```

### 4. Control Mapping Reference

#### String References → React Components

| Legacy String | Modern React Component | Notes |
|---------------|----------------------|--------|
| `['groupby']` | `<DndColumnSelect ... />` | Multi-select columns |
| `['metric']` | `<DndMetricSelect ... />` | Single metric select |
| `['metrics']` | `<DndMetricSelect ... />` | Multi metric select |
| `['adhoc_filters']` | `<DndFilterSelect ... />` | Advanced filters |
| `['row_limit']` | `<TextControl isInt ... />` | Numeric input |
| `['color_scheme']` | `ColorSchemeControl()` with `Control` wrapper | Special handling needed |

#### Config Objects → React Components

| Legacy Config | Modern Component | Example |
|---------------|------------------|---------|
| `{ type: 'TextControl', ... }` | `<TextControl ... />` | `<TextControl value={val} onChange={fn} />` |
| `{ type: 'CheckboxControl', ... }` | `<CheckboxControl ... />` | `<CheckboxControl label="..." value={val} />` |
| `{ type: 'SelectControl', ... }` | `<SelectControl ... />` | `<SelectControl choices={[...]} value={val} />` |
| `{ type: 'SliderControl', ... }` | `<SliderControl ... />` | `<SliderControl {...{min: 0, max: 100}} />` |

### 5. Props Mapping Guide

| Legacy Config Property | Modern React Prop | Notes |
|----------------------|------------------|-------|
| `label` | `label` prop OR `<ControlHeader>` | Use ControlHeader for tooltips |
| `description` | `description` prop OR `<ControlHeader>` | ControlHeader for complex descriptions |
| `default` | Move to `controlOverrides` | Don't set as component prop |
| `renderTrigger: true` | `renderTrigger` prop | Controls instant chart updates |
| `visibility` | Conditional rendering | `{condition && <Control />}` |
| `choices` | `choices` prop | For SelectControl |
| `min/max/step` | Spread object | `{...{ min: 10, max: 100, step: 1 }}` |

### 6. Implementing Tabbed Layout

Most modern control panels use a Data/Customize tab structure:

```typescript
const [activeTab, setActiveTab] = useState('data');

const dataTabContent = (
  <div>
    {/* Query-related controls: columns, metrics, filters, row limit */}
    <div style={{ marginBottom: 16 }}>
      <ControlHeader
        label={t('Group by')}
        description={t('Columns to group by')}
        hovered
      />
      <DndColumnSelect
        value={formValues.groupby || []}
        onChange={handleChange('groupby')}
        options={safeColumns}
        name="groupby"
        label=""  // Avoid duplicate labels
        multi
        canDelete
        ghostButtonText={t('Add dimension')}
        type="DndColumnSelect"
        actions={actions}
      />
    </div>
    {/* More data controls... */}
  </div>
);

const customizeTabContent = (
  <div>
    {/* Styling and display controls */}
    <div style={{ marginBottom: 24 }}>
      <h4>{t('Chart Options')}</h4>
      {/* Styling controls... */}
    </div>
  </div>
);

const tabItems = [
  { key: 'data', label: t('Data'), children: dataTabContent },
  { key: 'customize', label: t('Customize'), children: customizeTabContent },
];

return (
  <div style={{ padding: '16px' }}>
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      items={tabItems}
      size="large"
    />
  </div>
);
```

### 7. Common Control Patterns

#### Drag-and-Drop Controls
```typescript
{/* Group By - Column Selection */}
<DndColumnSelect
  value={formValues.groupby || []}
  onChange={handleChange('groupby')}
  options={safeColumns}
  name="groupby"
  label=""  // Empty to avoid duplicate with ControlHeader
  multi
  canDelete
  ghostButtonText={t('Add dimension')}
  type="DndColumnSelect"
  actions={actions}
/>

{/* Metric Selection */}
<DndMetricSelect
  value={formValues.metric}
  onChange={handleChange('metric')}
  datasource={safeDataSource}
  name="metric"
  label=""
  multi={false}
  savedMetrics={safeMetrics}
/>

{/* Filters */}
<DndFilterSelect
  value={formValues.adhoc_filters || []}
  onChange={handleChange('adhoc_filters')}
  datasource={safeDataSource}
  columns={safeColumns}
  formData={formValues}
  name="adhoc_filters"
  savedMetrics={safeMetrics}
  selectedMetrics={formValues.metric ? [formValues.metric] : []}
  type="DndFilterSelect"
  actions={actions}
/>
```

#### Color Scheme Control (Special Case)
```typescript
{/* Color Scheme requires special Control wrapper */}
{(() => {
  const colorSchemeControl = ColorSchemeControl();
  const { hidden, ...cleanConfig } = colorSchemeControl.config || {};
  return (
    <Control
      {...cleanConfig}
      name="color_scheme"
      value={formValues.color_scheme}
      actions={{
        ...actions,
        setControlValue: (field: string, val: any) => {
          handleChange('color_scheme')(val);
        },
      }}
      renderTrigger
    />
  );
})()}
```

#### Basic Controls
```typescript
{/* Text Input */}
<TextControl
  value={formValues.row_limit}
  onChange={handleChange('row_limit')}
  isInt
  placeholder="100"
  controlId="row_limit"
/>

{/* Checkbox */}
<CheckboxControl
  label={t('Show Labels')}
  description={t('Whether to display the labels.')}
  value={formValues.show_labels ?? true}
  onChange={handleChange('show_labels')}
  renderTrigger
  hovered
/>

{/* Select Dropdown */}
<SelectControl
  label={t('Label Type')}
  description={t('What should be shown on the label?')}
  value={formValues.label_type || 'key'}
  onChange={handleChange('label_type')}
  choices={[
    ['key', t('Category Name')],
    ['value', t('Value')],
    ['percent', t('Percentage')],
  ]}
  clearable={false}
  renderTrigger
  hovered
/>

{/* Slider */}
<SliderControl
  value={formValues.outerRadius || 70}
  onChange={handleChange('outerRadius')}
  {...{ min: 10, max: 100, step: 1 }}
/>
```

#### Control Headers with Tooltips
```typescript
<ControlHeader
  label={t('Percentage threshold')}
  description={t('Minimum threshold in percentage points for showing labels.')}
  renderTrigger
  hovered
/>
```

#### Conditional Rendering
```typescript
{/* Show control only when condition is met */}
{formValues.show_labels && (
  <CheckboxControl
    label={t('Put labels outside')}
    description={t('Put the labels outside of the pie?')}
    value={formValues.labels_outside ?? true}
    onChange={handleChange('labels_outside')}
    renderTrigger
    hovered
  />
)}

{/* Nested conditional rendering */}
{formValues.label_type === 'template' && (
  <TextControl
    value={formValues.label_template || ''}
    onChange={handleChange('label_template')}
    placeholder="{name}: {value}"
    controlId="label_template"
  />
)}
```

### 8. Section Organization

Use HTML headers and spacing for logical groupings:

```typescript
{/* Chart Options Section */}
<div style={{ marginBottom: 24 }}>
  <h4>{t('Chart Options')}</h4>

  {/* Controls for this section */}
  <div style={{ marginBottom: 16 }}>
    {/* Individual control */}
  </div>
</div>

{/* Labels Section */}
<div style={{ marginBottom: 24 }}>
  <h4>{t('Labels')}</h4>

  {/* Label-related controls */}
</div>
```

### 9. Control Defaults in controlOverrides

Move all default values to the `controlOverrides` section:

```typescript
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[PieControlPanel as any]],
    },
  ],
  controlOverrides: {
    groupby: {
      default: [],
      label: t('Group by'),
    },
    metric: {
      default: null,
      label: t('Metric'),
    },
    show_labels: {
      default: true,
      label: t('Show labels'),
      renderTrigger: true,
    },
    color_scheme: {
      default: 'supersetColors',
      label: t('Color scheme'),
      renderTrigger: true,
    },
    // ... all other defaults
  },
};
```

### 10. Chart Plugin Integration

Update the chart plugin to use the new control panel:

```typescript
// In your chart's index.ts file
import controlPanel from './PieControlPanelSimple'; // New React-based panel

export default class EchartsPieChartPlugin extends EchartsChartPlugin {
  constructor() {
    super({
      controlPanel,
      // ... other config
    });
  }
}
```

## Testing Your Migration

### 1. Visual Validation
- [ ] All controls render properly in the UI
- [ ] Tab navigation works (if using tabs)
- [ ] Control layout matches the original
- [ ] Conditional controls show/hide correctly

### 2. Functional Testing
- [ ] Control changes update the chart immediately (if `renderTrigger: true`)
- [ ] Form values persist when switching between tabs
- [ ] Drag-and-drop controls work with datasource
- [ ] Error states display appropriately
- [ ] Default values apply correctly

### 3. Integration Testing
- [ ] Control panel works in Explore view
- [ ] Values save correctly when creating charts
- [ ] Dashboard filters work with the controls
- [ ] Chart reloading preserves control values

## Common Issues & Solutions

### Issue: Double Labels on Controls
**Problem:** Control shows both ControlHeader label and control's built-in label
**Solution:** Set `label=""` on the control when using ControlHeader:
```typescript
<ControlHeader label={t('Group by')} />
<DndColumnSelect
  label=""  // Empty to prevent duplicate
  // ... other props
/>
```

### Issue: Slider Min/Max Not Working
**Problem:** Slider doesn't respect min/max values
**Solution:** Use spread operator with object literal:
```typescript
<SliderControl
  value={formValues.outerRadius || 70}
  onChange={handleChange('outerRadius')}
  {...{ min: 10, max: 100, step: 1 }}  // Use spread with object
/>
```

### Issue: Controls Not Triggering Chart Updates
**Problem:** Chart doesn't refresh when controls change
**Solution:** Ensure `renderTrigger` is set where needed:
```typescript
<CheckboxControl
  // ... other props
  renderTrigger  // Add this for instant updates
/>
```

### Issue: "Cannot read properties of undefined"
**Problem:** Attempting to access undefined datasource or form_data
**Solution:** Add safety checks and fallbacks:
```typescript
// Safety checks at component start
if (!datasource || !form_data) {
  return <div>Loading control panel...</div>;
}

// Safe array access
const safeColumns = Array.isArray(datasource?.columns) ? datasource.columns : [];
```

### Issue: Color Scheme Control Not Working
**Problem:** ColorSchemeControl doesn't integrate properly
**Solution:** Use the special Control wrapper pattern:
```typescript
{(() => {
  const colorSchemeControl = ColorSchemeControl();
  const { hidden, ...cleanConfig } = colorSchemeControl.config || {};
  return (
    <Control
      {...cleanConfig}
      name="color_scheme"
      value={formValues.color_scheme}
      actions={{
        ...actions,
        setControlValue: (field: string, val: any) => {
          handleChange('color_scheme')(val);
        },
      }}
      renderTrigger
    />
  );
})()}
```

## Migration Checklist

### Pre-Migration
- [ ] Identify all controls in the legacy control panel
- [ ] Note any conditional control visibility rules
- [ ] Check for custom control configurations
- [ ] Understand the chart's specific requirements

### During Migration
- [ ] Create new `[ChartName]ControlPanelSimple.tsx` file
- [ ] Implement component structure with proper interface
- [ ] Map all legacy controls to React components
- [ ] Add safety checks for datasource/form_data
- [ ] Implement tab structure (Data/Customize)
- [ ] Add all control defaults to `controlOverrides`
- [ ] Mark component as modern with `isModernPanel = true`
- [ ] Update chart plugin to import new control panel

### Post-Migration Testing
- [ ] Test all control interactions
- [ ] Verify chart updates on control changes
- [ ] Check conditional control visibility
- [ ] Validate default values
- [ ] Test with different datasources
- [ ] Run pre-commit hooks: `pre-commit run`
- [ ] Test in Explore and Dashboard contexts

## Advanced Patterns

### Dynamic Control Visibility
```typescript
// Show additional controls based on current selection
{formValues.chart_type === 'pie' && (
  <div>
    {/* Pie-specific controls */}
    <CheckboxControl
      label={t('Show as Donut')}
      value={formValues.donut ?? false}
      onChange={handleChange('donut')}
    />

    {formValues.donut && (
      <SliderControl
        value={formValues.innerRadius || 30}
        onChange={handleChange('innerRadius')}
        {...{ min: 0, max: 100, step: 1 }}
      />
    )}
  </div>
)}
```

### Complex Control Groups
```typescript
{/* Side-by-side controls */}
<div style={{ display: 'flex', gap: 16 }}>
  <div style={{ flex: 1 }}>
    <ControlHeader label={t('Min Value')} />
    <TextControl
      value={formValues.min_value}
      onChange={handleChange('min_value')}
      isFloat
    />
  </div>
  <div style={{ flex: 1 }}>
    <ControlHeader label={t('Max Value')} />
    <TextControl
      value={formValues.max_value}
      onChange={handleChange('max_value')}
      isFloat
    />
  </div>
</div>
```

### Custom Validation
```typescript
// Add validation logic to handleChange
const handleChange = (field: string) => (val: any) => {
  // Custom validation
  if (field === 'row_limit' && val && val < 1) {
    console.warn('Row limit must be positive');
    return;
  }

  if (actions?.setControlValue) {
    actions.setControlValue(field, val);
  } else if (onChange) {
    onChange(field, val);
  }
};
```

## Additional Migration Patterns

### Single Column Selection
When a control expects a single column value (not an array):
```typescript
// For Sankey source/target columns
const handleSingleColumnChange = (field: string) => (val: any) => {
  const singleValue = Array.isArray(val) ? val[0] : val;
  actions.setControlValue(field, singleValue);
};

// Usage
<DndColumnSelect
  value={formValues.source ? [formValues.source] : []}
  onChange={handleSingleColumnChange('source')}
  options={safeColumns}
  multi={false}
/>
```

### Required Field Validation
For controls that must have values:
```typescript
import { validateNonEmpty } from '@superset-ui/core';

// In controlOverrides
source: {
  validators: [validateNonEmpty],
  label: t('Source Column'),
},
```

### Chart Type Descriptions
Add helpful descriptions at the top of control panels:
```typescript
<div style={{ marginBottom: 16, padding: '12px', borderRadius: '4px' }}>
  <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
    {t('Sankey Diagram')}
  </div>
  <div style={{ fontSize: '12px', opacity: 0.65 }}>
    {t('Visualize flow between different entities')}
  </div>
</div>
```

## Common Migration Issues & Solutions

### Issue 1: "Cannot read properties of undefined (reading 'map')"
**Problem:** DndColumnSelect crashes when datasource is undefined
**Solution:** Pass `options={datasource?.columns || []}` instead of `datasource={datasource}`

### Issue 2: Tabs import error ("Element type is invalid")
**Problem:** Runtime error when loading control panel
**Solution:** Import from 'antd' directly: `import { Tabs } from 'antd';` (NOT from '@superset-ui/core')

### Issue 3: React hooks error
**Problem:** "React Hook 'useState' is called conditionally"
**Solution:** Always declare state hooks before any conditional returns:
```typescript
const [activeTab, setActiveTab] = useState('data'); // FIRST
if (!datasource) return <div>Loading...</div>;      // THEN conditions
```

### Issue 4: ESLint color literal warnings
**Problem:** theme-colors/no-literal-colors ESLint rule
**Solution:** Use opacity instead of color literals:
```typescript
// Bad: style={{ color: '#666' }}
// Good: style={{ opacity: 0.65 }}
```

### Issue 5: Single value vs array handling
**Problem:** Some controls expect single values but DndColumnSelect returns arrays
**Solution:** See "Single Column Selection" pattern above

### Issue 6: antd import warnings
**Problem:** "'antd' should be listed in the project's dependencies"
**Solution:** Use `SKIP=eslint-frontend` when committing if antd is already available

## Reference Implementation

The Pie chart control panel migration (`PieControlPanelSimple.tsx`) serves as the definitive reference implementation showing:

- Complete tab-based layout (Data/Customize)
- All major control types (DndColumnSelect, CheckboxControl, SelectControl, SliderControl, etc.)
- Conditional control rendering
- Proper safety checks and error handling
- Color scheme integration
- Control grouping and organization
- Modern React patterns and TypeScript usage

Study this implementation for best practices and patterns that can be applied to any chart control panel migration.

## Summary

The new React-based control panel approach provides:

1. **Better Developer Experience** - Direct React components with TypeScript
2. **Improved Maintainability** - Clear component structure and patterns
3. **Enhanced Flexibility** - Easy conditional rendering and dynamic controls
4. **Type Safety** - Full TypeScript support with proper interfaces
5. **Simplified Architecture** - No complex config intermediaries

The migration process involves converting string references and config objects to direct React components, implementing proper safety checks, and organizing controls in a logical tab-based structure. The key is to maintain compatibility with the existing Superset infrastructure while providing a more modern and maintainable development experience.
