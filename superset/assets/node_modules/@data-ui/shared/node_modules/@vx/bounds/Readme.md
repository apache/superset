# @vx/bounds

```
npm install --save @vx/bounds
```

### `withBoundingRects` HOC
It's often useful to determine whether elements (e.g., tooltips) overflow the bounds of their parent container and adjust positioning accordingly. The `withBoundingRects` higher-order component is meant to simplify this computation by passing in a component's bounding rect as well as its _parent's_ bounding rect.


### Example usage
Example usage with a `<Tooltip />` component

```javascript
import React from 'react';
import PropTypes from 'prop-types';
import { withBoundingRects, withBoundingRectsProps } from '@vx/bounds';

const propTypes = {
  ...withBoundingRectsProps,
  left: PropTypes.number.isRequired,
  top: PropTypes.number.isRequired,
  children: PropTypes.node,
};

const defaultProps = {
  children: null,
};

function Tooltip({
  left: initialLeft,
  top: initialTop,
  rect,
  parentRect,
  children,
}) {
  let left = initialLeft;
  let top = initialTop;

  if (rect && parentRect) {
    left = rect.right > parentRect.right ? (left - rect.width) : left;
    top = rect.bottom > parentRect.bottom ? (top - rect.height) : top;
  }

  return (
    <div style={{ top, left, ...myTheme }}>
      {children}
    </div>
  );
}

Tooltip.propTypes = propTypes;
Tooltip.defaultProps = defaultProps;

export default withBoundingRects(Tooltip);
```
