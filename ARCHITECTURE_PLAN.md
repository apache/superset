# Simplified Control Panel Architecture Plan

## Goals
1. **Simplify** - Make control panels easier to build and maintain
2. **Type Safety** - Full TypeScript with proper types
3. **Reusability** - Controls in monorepo packages for use across Superset
4. **Dynamic** - Controls can show/hide and affect each other
5. **Compatible** - Maintain compatibility with existing formData in database

## Current State Problems
- String-referenced controls are hard to maintain
- State management is complex with multiple sources of truth
- Controls are tightly coupled to explore view
- No clear separation between control definition and rendering
- Difficult to test and document

## Proposed Architecture

### 1. State Management
Keep it simple - use Redux for global state (as it exists) but simplify the flow:

```typescript
// Single source of truth for form data
interface ExploreState {
  formData: QueryFormData;  // This is what gets saved to DB
  controlsMetadata: ControlsMetadata;  // Visibility, validation, etc
}
```

### 2. Control Components Location
All reusable controls in `@superset-ui/chart-controls`:

```
packages/superset-ui-chart-controls/
├── src/
│   ├── components/           # Actual control components
│   │   ├── ColumnSelect/
│   │   ├── MetricSelect/
│   │   ├── FilterControl/
│   │   ├── ColorScheme/
│   │   └── ...
│   ├── shared-controls/      # Pre-configured control definitions
│   └── index.ts
```

### 3. Control Panel Definition
Simple React components or JSON schemas:

```typescript
// Option 1: React Component
export const WordCloudControlPanel: React.FC = () => {
  const [formData, setFormData] = useFormData();
  
  return (
    <ControlPanel>
      <Section title="Query">
        <ColumnSelect 
          name="series"
          value={formData.series}
          onChange={value => setFormData({ series: value })}
        />
        <MetricSelect
          name="metric" 
          value={formData.metric}
          onChange={value => setFormData({ metric: value })}
        />
      </Section>
    </ControlPanel>
  );
};

// Option 2: Configuration Object (simpler)
export const wordCloudControls = {
  sections: [
    {
      title: 'Query',
      controls: [
        { type: 'ColumnSelect', name: 'series', required: true },
        { type: 'MetricSelect', name: 'metric', required: true },
      ]
    }
  ]
};
```

### 4. Control State Flow

```
User Input → Control onChange → Update Redux formData → Trigger Query (if needed)
                                          ↓
                                  buildQuery & transformProps
                                          ↓
                                     Render Chart
```

### 5. Dynamic Control Behavior
Controls can react to formData changes:

```typescript
const MyControl = () => {
  const formData = useFormData();
  const isVisible = formData.someValue === 'show';
  
  if (!isVisible) return null;
  
  return <ControlComponent />;
};
```

## Implementation Steps

### Phase 1: Minimal POC
1. Create a simple `useFormData` hook that connects to Redux
2. Build one control (e.g., TextControl) that works with the hook
3. Create a control panel using just React components
4. Test with Word Cloud chart

### Phase 2: Core Controls
1. Migrate essential controls to the new pattern:
   - ColumnSelect
   - MetricSelect
   - FilterControl
   - ColorScheme
2. Ensure they work in both explore and dashboard contexts

### Phase 3: Control Panel Builder
1. Create layout components (Section, Row, Column)
2. Add visibility/conditional logic helpers
3. Support for control dependencies

### Phase 4: Migration Tools
1. Helper to convert legacy control panels
2. Documentation and examples
3. Testing utilities

## Key Decisions

### Use React, not JSON Forms
- **Pros**: Simpler, more flexible, better TypeScript support, easier debugging
- **Cons**: Less declarative, need to build our own layout system
- **Decision**: Start with React components, can add JSON config layer later if needed

### Keep Redux for State
- Already integrated with save/load/query mechanisms
- Just simplify the actions and reducers
- Use hooks to make it easier to work with

### Incremental Migration
- New system works alongside old system
- Charts can opt-in to new control panels
- No breaking changes to saved charts

## Next Steps
1. Create `useFormData` hook
2. Build TextControl component
3. Create simple control panel for Word Cloud
4. Test the flow end-to-end

This approach prioritizes simplicity and developer experience while maintaining compatibility with existing data.