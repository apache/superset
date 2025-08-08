# BigNumber Control Panel Migration Guide

This guide shows how to migrate BigNumber control panels from configuration-based to React component-based approach.

## Overview

The BigNumber plugin now uses React component-based control panels:

1. **Modern** - React component-based controls (current approach)
2. **Legacy** - String-based control references (deprecated and removed)

## Benefits of Migration

- **Type Safety**: Full TypeScript support for all controls
- **Reusability**: Share control components across charts
- **Better UX**: More interactive and dynamic controls
- **Easier Testing**: React components are easier to test
- **Maintainability**: Less configuration, more explicit behavior

## Migration Patterns

### Pattern 1: Gradual Migration (Recommended)

Start by replacing simple controls with React components while keeping complex ones:

```tsx
// Before (deprecated)
controlSetRows: [
  ['metric'],  // String reference - no longer supported
  ['adhoc_filters'],
  ['y_axis_format'],
  [headerFontSize],
]

// After - React components
import { MetricControl, AdhocFiltersControl } from '@superset-ui/chart-controls';

controlSetRows: [
  [MetricControl()],  // React component
  [AdhocFiltersControl()],  // React component
  [<FormatControl  // Custom React component
    name="y_axis_format"
    formatType="number"
  />],
  [<FontSizeControl  // Custom React component
    name="header_font_size"
    options={FONT_SIZE_OPTIONS_LARGE}
  />],
]
```

### Pattern 2: Section-by-Section

Replace entire sections with React components:

```tsx
// Before
{
  label: t('Chart Options'),
  controlSetRows: [
    ['y_axis_format'],
    ['currency_format'],
    [headerFontSize],
    [subtitleControl],
    // ... many more controls
  ]
}

// After
{
  label: t('Chart Options'),
  controlSetRows: [
    [<BigNumberControlPanel
      variant="total"
      values={values}
      onChange={onChange}
    />]
  ]
}
```

### Pattern 3: Full Modernization

Replace the entire control panel:

```tsx
import { MetricControl, AdhocFiltersControl } from '@superset-ui/chart-controls';
import BigNumberControlPanel from './components/BigNumberControlPanel';

const controlPanel = {
  controlPanelSections: [
    {
      label: t('Query'),
      controlSetRows: [
        [MetricControl()],  // React component
        [AdhocFiltersControl()],  // React component
      ],
    },
    {
      label: t('Chart Options'),
      controlSetRows: [
        [<BigNumberControlPanel
          variant="total"
          values={{}}
          onChange={() => {}}
        />],
      ],
    },
  ],
};
```

## Component Library

### Available React Controls

1. **FontSizeControl** - Dropdown for font size selection
2. **FormatControl** - Number/date/currency formatting
3. **AppearanceControls** - Grouped appearance settings
4. **BigNumberControlPanel** - Complete panel for BigNumber charts

### Creating Custom Controls

```tsx
import { FC } from 'react';
import { ControlHeader } from '@superset-ui/chart-controls';

const MyCustomControl: FC<Props> = ({ name, value, onChange }) => {
  return (
    <div>
      <ControlHeader name={name} label="My Control" />
      {/* Your control implementation */}
    </div>
  );
};
```

## Migration Steps

1. **Identify Controls to Migrate**
   - Start with simple, standalone controls
   - Leave complex controls (metric, filters) for later

2. **Create React Components**
   - Use existing components from `./components`
   - Create new ones as needed

3. **Update Control Panel**
   - Replace control references with React components
   - Test that values are properly saved/loaded

4. **Test Thoroughly**
   - Ensure backward compatibility
   - Verify all controls work as expected
   - Check that saved charts still load

## Examples

### BigNumberTotal Migration

```tsx
// Old (controlPanel.ts) - DEPRECATED
export default {
  controlPanelSections: [
    {
      label: t('Query'),
      controlSetRows: [
        ['metric'],  // String reference - no longer supported
        ['adhoc_filters'],  // String reference - no longer supported
      ],
    },
    // ...
  ],
};

// New (controlPanelModern.tsx)
import { MetricControl, AdhocFiltersControl } from '@superset-ui/chart-controls';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      controlSetRows: [
        [MetricControl()],  // React component
        [AdhocFiltersControl()],  // React component
      ],
    },
    {
      label: t('Chart Options'),
      controlSetRows: [
        [<BigNumberControlPanel
          variant="total"
          values={{}}
          onChange={() => {}}
        />],
      ],
    },
  ],
};
```

### Using Individual Components

```tsx
import { MetricControl } from '@superset-ui/chart-controls';

controlSetRows: [
  // All controls must be React components
  [MetricControl()],  // React component from @superset-ui/chart-controls
  [
    <FormatControl
      name="y_axis_format"
      label={t('Number Format')}
      formatType="number"
    />
  ],
  [
    <FontSizeControl
      name="header_font_size"
      label={t('Header Size')}
      options={FONT_SIZE_OPTIONS_LARGE}
    />
  ],
]
```

## Best Practices

1. **Use React Components for All Controls** - Import from @superset-ui/chart-controls
2. **Group Related Controls** - Use container components for related settings
3. **Maintain Backward Compatibility** - Ensure old charts still work
4. **Use TypeScript** - Leverage type safety for better developer experience
5. **Test Incrementally** - Migrate and test one control at a time

## Troubleshooting

### Values Not Saving
- Ensure `onChange` properly calls `setControlValue`
- Check that control names match form data keys

### Controls Not Rendering
- Verify React components are properly imported
- Check for TypeScript/build errors

### Backward Compatibility Issues
- Use same control names as original
- Maintain same value formats
- Test with existing saved charts

## Future Enhancements

- JSON-driven form generation
- Visual control panel builder
- Automatic migration tools
- Enhanced validation framework
