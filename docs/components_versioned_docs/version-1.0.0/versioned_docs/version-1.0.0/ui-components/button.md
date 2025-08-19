<!--
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
-->
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
