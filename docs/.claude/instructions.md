# Developer Portal Documentation Instructions

## Core Principle: Stories Are the Single Source of Truth

When working on the Storybook-to-MDX documentation system:

**ALWAYS fix the story first. NEVER add workarounds to the generator.**

## Why This Matters

The generator (`scripts/generate-superset-components.mjs`) should be lightweight - it extracts data from stories and passes it through. When you add special cases to the generator:
- It becomes harder to maintain
- Stories diverge from their docs representation
- Future stories need to know about generator quirks

When you fix stories to match the expected patterns:
- Stories work identically in Storybook and Docs
- The generator stays simple and predictable
- Patterns are consistent and learnable

## Story Patterns for Docs Generation

### Required Structure
```tsx
// Use inline export default (NOT const meta = ...; export default meta)
export default {
  title: 'Components/MyComponent',
  component: MyComponent,
};

// Name interactive stories with Interactive prefix
export const InteractiveMyComponent: Story = {
  args: {
    // Default prop values
  },
  argTypes: {
    // Control definitions - MUST be at story level, not meta level
    propName: {
      control: { type: 'select' },
      options: ['a', 'b', 'c'],
      description: 'What this prop does',
    },
  },
};
```

### For Components with Variants (size × style grids)
```tsx
const sizes = ['small', 'medium', 'large'];
const variants = ['primary', 'secondary', 'danger'];

InteractiveButton.parameters = {
  docs: {
    gallery: {
      component: 'Button',
      sizes,
      styles: variants,
      sizeProp: 'size',
      styleProp: 'variant',
    },
  },
};
```

### For Components Requiring Children
```tsx
InteractiveIconTooltip.parameters = {
  docs: {
    // Component descriptors with dot notation for nested components
    sampleChildren: [{ component: 'Icons.InfoCircleOutlined', props: { iconSize: 'l' } }],
  },
};
```

### For Custom Live Code Examples
```tsx
InteractiveMyComponent.parameters = {
  docs: {
    liveExample: `function Demo() {
  return <MyComponent prop="value">Content</MyComponent>;
}`,
  },
};
```

### For Complex Props (objects, arrays)
```tsx
InteractiveMenu.parameters = {
  docs: {
    staticProps: {
      items: [
        { key: '1', label: 'Item 1' },
        { key: '2', label: 'Item 2' },
      ],
    },
  },
};
```

## Common Issues and How to Fix Them (in the Story)

| Issue | Wrong Approach | Right Approach |
|-------|---------------|----------------|
| Component not generated | Add pattern to generator | Change story to use inline `export default` |
| Control shows as text instead of select | Add special case in generator | Add `argTypes` with `control: { type: 'select' }` |
| Missing children/content | Modify StorybookWrapper | Add `parameters.docs.sampleChildren` |
| Gallery not showing | Add to generator output | Add `parameters.docs.gallery` config |
| Wrong live example | Hardcode in generator | Add `parameters.docs.liveExample` |

## Files

- **Generator**: `docs/scripts/generate-superset-components.mjs`
- **Wrapper**: `docs/src/components/StorybookWrapper.jsx`
- **Output**: `docs/developer_docs/components/`
- **Stories**: `superset-frontend/packages/superset-ui-core/src/components/*/`
