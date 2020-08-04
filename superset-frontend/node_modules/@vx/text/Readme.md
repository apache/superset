# @vx/text

```
npm install --save @vx/text
```

The `@vx/text` provides a better SVG `<Text>` component with the following features

- Word-wrapping (when `width` prop is defined)
- Vertical alignment (`verticalAnchor` prop)
- Rotation (`angle` prop)
- Scale-to-fit text (`scaleToFit` prop)

## Example
Simple demo to show off a useful feature.  Since svg `<text>` itself does not support `verticalAnchor`, normally text rendered at `0,0` would be outside the viewport and thus not visible.  By using `<Text>` with the `verticalAnchor="start"` prop, the text will now be visible as you'd expect.
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

## Props
Property | Type | Default | Description
-------- | ---- | ------- | -----------
`x` | number | | x coordinate to use as a basis for positioning the text element
`y` | number | | y coordinate to use as a basis for positioning the text element
`dx` | number | | Horizontal shift from the x coordinate
`dy` | number | | Vertical shift from the y coordinate
`width` | number | | Width of text container.  Used to implement word wrapping and for context when `scaleToFit` is true
`scaleToFit` | bool | false | Resize text to fit container width
`angle` | number | | Rotate text around origin (defined by `textAnchor` and `verticalAnchor`)
`textAnchor` | string | start | How the text is horizontally positioned relative to the given `x` and `y` coordinates. Options are `start`, `middle`, `end`, and `inherit`.
`verticalAnchor` | string | end | How text is vertically positioned relative to the given `x` and `y` coordinates. Options are `start`, `middle`, `end`
`lineHeight` | string | 1em | How much space a single line of text should take up
`capHeight` | string | 0.71em (Magic number from d3) | Defines a text metric for the font being used: the expected height of capital letters. This is necessary because of SVG, which (a) positions the bottom of the text at y, and (b) has no notion of line height. This prop should be given as a number of ems
additional props | | | Additional props are passed down to underlying `<text>` component, including `style` and `className`
