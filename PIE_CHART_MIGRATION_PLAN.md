# Pie Chart Control Panel Migration - Phased Approach

## Phase 1: Parallel Implementation ✅ COMPLETED

We've created a modern control panel alongside the legacy one:

### Files Created:
1. **`controlPanelModern.tsx`** - Modern React-based control panel
2. **`ModernControlPanelRenderer.tsx`** - Bridge component for compatibility
3. **Updated `ControlPanelsContainer.tsx`** - Support for modern panels

### Key Features:
- Full React component structure (no `controlSetRows`)
- Uses Ant Design Grid directly
- Type-safe with TypeScript interfaces
- Conditional rendering based on form values
- Organized into logical sections

## Phase 2: Integration Testing 🚧 NEXT STEP

### 2.1 Update the Pie Chart Plugin

```typescript
// In plugins/plugin-chart-echarts/src/Pie/index.ts
import controlPanel from './controlPanel'; // Legacy
import controlPanelModern from './controlPanelModern'; // Modern

// Feature flag to toggle between old and new
const useModernPanel = window.featureFlags?.MODERN_CONTROL_PANELS;

export default class EchartsPieChartPlugin extends ChartPlugin {
  constructor() {
    super({
      // ... other config
      controlPanel: useModernPanel ? controlPanelModern : controlPanel,
    });
  }
}
```

### 2.2 Test the Modern Panel

Create test file to verify both panels produce same output:

```typescript
// controlPanel.test.tsx
describe('Pie Control Panel Migration', () => {
  it('modern panel handles all legacy controls', () => {
    // Test that all controls from legacy panel exist in modern
  });

  it('produces same form_data structure', () => {
    // Verify form_data compatibility
  });

  it('visibility conditions work correctly', () => {
    // Test conditional rendering
  });
});
```

## Phase 3: Feature Flag Rollout

### 3.1 Add Feature Flag

```python
# In superset/config.py
FEATURE_FLAGS = {
    "MODERN_CONTROL_PANELS": False,  # Start disabled
}
```

### 3.2 Gradual Rollout

1. **Internal Testing**: Enable for development environment
2. **Beta Users**: Enable for select users (5%)
3. **Wider Rollout**: Increase to 50%
4. **Full Migration**: Enable for all users
5. **Cleanup**: Remove legacy code

## Phase 4: Migration Utilities

### 4.1 Control Panel Converter

```typescript
// convertLegacyPanel.ts
export function convertControlSetRows(rows: ControlSetRow[]): ReactElement {
  return rows.map(row => {
    if (row.length === 1) {
      return <SingleControlRow>{convertControl(row[0])}</SingleControlRow>;
    }
    if (row.length === 2) {
      return (
        <TwoColumnRow
          left={convertControl(row[0])}
          right={convertControl(row[1])}
        />
      );
    }
    // ... handle other cases
  });
}
```

### 4.2 Common Patterns Library

```typescript
// commonPanelPatterns.tsx
export const QuerySection = ({ values, onChange }) => (
  <>
    <GroupByControl />
    <MetricControl />
    <AdhocFiltersControl />
    <RowLimitControl />
  </>
);

export const AppearanceSection = ({ values, onChange }) => (
  <>
    <ColorSchemeControl />
    <OpacityControl />
    <LegendControls />
  </>
);
```

## Phase 5: Migrate Other Charts

### Priority Order (Simple to Complex):

1. **Simple Charts** (1-2 weeks each)
   - Bar Chart
   - Line Chart
   - Area Chart
   - Scatter Plot

2. **Medium Complexity** (2-3 weeks each)
   - Table
   - Pivot Table
   - Heatmap
   - Treemap

3. **Complex Charts** (3-4 weeks each)
   - Mixed Time Series
   - Box Plot
   - Sankey
   - Graph/Network

### Migration Checklist per Chart:

- [ ] Create `controlPanelModern.tsx`
- [ ] Update plugin index to support both
- [ ] Write migration tests
- [ ] Test with feature flag
- [ ] Document any chart-specific patterns
- [ ] Update TypeScript types if needed

## Phase 6: System-Wide Updates

### 6.1 Update Control Panel Registry

```typescript
// getChartControlPanelRegistry.ts
export interface ModernControlPanelRegistry {
  get(key: string): ControlPanelConfig | ReactControlPanelConfig;
  registerModern(key: string, config: ReactControlPanelConfig): void;
}
```

### 6.2 Update Explore Components

- `ControlPanelsContainer` - Full support for modern panels ✅
- `Control` - Ensure all control types work
- `ControlRow` - Already modernized ✅
- `getSectionsToRender` - Update to handle React components

### 6.3 Update Types

```typescript
// types.ts
export type ControlPanelConfig = LegacyControlPanelConfig | ModernControlPanelConfig;

export interface ModernControlPanelConfig {
  type: 'modern';
  sections: ReactControlPanelSection[];
  controlOverrides?: ControlOverrides;
  formDataOverrides?: FormDataOverrides;
}
```

## Benefits Tracking

### Metrics to Monitor:
1. **Developer Velocity**: Time to add new controls
2. **Bug Rate**: Control panel-related issues
3. **Performance**: Rendering time for control panels
4. **Type Safety**: TypeScript coverage percentage
5. **Code Maintainability**: Lines of code, complexity metrics

### Expected Improvements:
- 50% reduction in control panel code
- 80% reduction in control panel bugs
- 100% TypeScript coverage
- 30% faster control panel rendering
- Easier onboarding for new developers

## Rollback Plan

If issues arise:

1. **Feature Flag**: Immediately disable `MODERN_CONTROL_PANELS`
2. **Hotfix**: Revert to legacy panel for affected charts
3. **Investigation**: Debug issues in staging environment
4. **Fix Forward**: Address issues and re-enable gradually

## Timeline Estimate

- **Phase 1**: ✅ Completed
- **Phase 2**: 1 week (testing and integration)
- **Phase 3**: 2 weeks (feature flag and rollout)
- **Phase 4**: 1 week (utilities and patterns)
- **Phase 5**: 3-6 months (all charts migration)
- **Phase 6**: 2 weeks (system updates)
- **Cleanup**: 1 week (remove legacy code)

**Total: 4-7 months for complete migration**

## Next Immediate Steps

1. Test the modern Pie control panel in development
2. Fix any issues with value binding and onChange handlers
3. Create feature flag in Python backend
4. Write comprehensive tests
5. Get team buy-in on approach
6. Start incremental migration

## Code Snippets for Testing

```bash
# Test the modern panel
cd superset-frontend
npm run dev

# In browser console
window.featureFlags = { MODERN_CONTROL_PANELS: true };

# Create a new Pie chart and verify controls work
```

## Success Criteria

- [ ] All control panels migrated to modern format
- [ ] No regression in functionality
- [ ] Improved developer experience
- [ ] Better performance metrics
- [ ] Reduced maintenance burden
- [ ] Full TypeScript coverage
