# @vx/text

<a title="@vx/text npm downloads" href="https://www.npmjs.com/package/@vx/text">
  <img src="https://img.shields.io/npm/dm/@vx/text.svg?style=flat-square" />
</a>

The `@vx/text` provides a better SVG `<Text>` component with the following features

- Word-wrapping (when `width` prop is defined)
- Vertical alignment (`verticalAnchor` prop)
- Rotation (`angle` prop)
- Scale-to-fit text (`scaleToFit` prop)

## Example

Simple demo to show off a useful feature. Since svg `<text>` itself does not support
`verticalAnchor`, normally text rendered at `0,0` would be outside the viewport and thus not
visible. By using `<Text>` with the `verticalAnchor="start"` prop, the text will now be visible as
you'd expect.

```jsx
import React from 'react';
import { render } from 'react-dom';
import { Text } from '@vx/text';

const App = () => (
  <svg>
    <Text verticalAnchor="start">Hello world</Text>
  </svg>
);

render(<App />, document.getElementById('root'));
```

## Installation

```
npm install --save @vx/text
```
