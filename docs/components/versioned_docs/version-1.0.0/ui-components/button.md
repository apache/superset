---
title: Button (v1.0.0)
sidebar_position: 1
---

# Button Component

The Button component is a fundamental UI element used throughout Superset for user interactions.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `buttonStyle` | `string` | `'primary'` | Button style: 'primary', 'secondary', 'link', 'dashed', 'danger' |
| `buttonSize` | `string` | `'default'` | Button size: 'small', 'default', 'large' |
| `disabled` | `boolean` | `false` | Whether the button is disabled |
| `onClick` | `function` | - | Callback when button is clicked |
| `href` | `string` | - | Turns button into an anchor link |
| `target` | `string` | - | Target attribute for anchor links |

## Examples

### Basic Button

```jsx
import { Button } from '@superset-ui/core';

function Example() {
  return (
    <Button buttonStyle="primary" onClick={() => console.log('Clicked!')}>
      Click Me
    </Button>
  );
}
```

### Button Styles

```jsx
import { Button } from '@superset-ui/core';

function Example() {
  return (
    <>
      <Button buttonStyle="primary">Primary</Button>
      <Button buttonStyle="secondary">Secondary</Button>
      <Button buttonStyle="link">Link</Button>
      <Button buttonStyle="dashed">Dashed</Button>
      <Button buttonStyle="danger">Danger</Button>
    </>
  );
}
```

## Best Practices

- Use primary buttons for the main action in a form or page
- Use secondary buttons for alternative actions
- Limit the number of primary buttons on a page to avoid confusion
- Use consistent button styles throughout your application
