# react-sticky [![Build Status](https://travis-ci.org/captivationsoftware/react-sticky.svg?branch=master)](https://travis-ci.org/captivationsoftware/react-sticky)

Make your React components sticky!

#### Demos

* [Basic](http://react-sticky.netlify.com/#/basic)
* [Relative](http://react-sticky.netlify.com/#/relative)
* [Stacked](http://react-sticky.netlify.com/#/stacked)

#### Version 6.x Highlights

* Completely redesigned to support sticky behavior via higher-order component, giving you ultimate control of implementation details
* Features a minimal yet efficient API
* Drops support for versions of React < 15.3. If you are using an earlier version of React, continue to use the 5.x series

#### CSS
There's a CSS alternative to `react-sticky`: the `position: sticky` feature. However it currently does not have [full browser support](https://caniuse.com/#feat=css-sticky), specifically a lack of IE11 support and some bugs with table elements. Before using `react-sticky`, check to see if the browser support and restrictions prevent you from using `position: sticky`, as CSS will always be faster and more durable than a JS implementation.
```css
position: -webkit-sticky;
position: sticky;
top: 0;
```

## Installation

```sh
npm install react-sticky
```

## Overview & Basic Example

The goal of `react-sticky` is make it easier for developers to build UIs that have sticky elements. Some examples include a sticky navbar, or a two-column layout where the left side sticks while the right side scrolls.

`react-sticky` works by calculating the position of a `<Sticky>` component relative to a `<StickyContainer>` component. If it would be outside the viewport, the styles required to affix it to the top of the screen are passed as an argument to a render callback, a function passed as a child.

```js
<StickyContainer>
  <Sticky>{({ style }) => <h1 style={style}>Sticky element</h1>}</Sticky>
</StickyContainer>
```

The majority of use cases will only need the style to pass to the DOM, but some other properties are passed for advanced use cases:

* `style` _(object)_ - modifiable style attributes to optionally be passed to the element returned by this function. For many uses, this will be the only attribute needed.
* `isSticky` _(boolean)_ - is the element sticky as a result of the current event?
* `wasSticky` _(boolean)_ - was the element sticky prior to the current event?
* `distanceFromTop` _(number)_ - number of pixels from the top of the `Sticky` to the nearest `StickyContainer`'s top
* `distanceFromBottom` _(number)_ - number of pixels from the bottom of the `Sticky` to the nearest `StickyContainer`'s bottom
* `calculatedHeight` _(number)_ - height of the element returned by this function

The `Sticky`'s child function will be called when events occur in the parent `StickyContainer`,
and will serve as the callback to apply your own logic and customizations, with sane `style` attributes
to get you up and running quickly.

### Full Example

Here's an example of all of those pieces together:

app.js

```js
import React from 'react';
import { StickyContainer, Sticky } from 'react-sticky';
// ...

class App extends React.Component {
  render() {
    return (
      <StickyContainer>
        {/* Other elements can be in between `StickyContainer` and `Sticky`,
        but certain styles can break the positioning logic used. */}
        <Sticky>
          {({
            style,

            // the following are also available but unused in this example
            isSticky,
            wasSticky,
            distanceFromTop,
            distanceFromBottom,
            calculatedHeight
          }) => (
            <header style={style}>
              {/* ... */}
            </header>
          )}
        </Sticky>
        {/* ... */}
      </StickyContainer>
    );
  },
};
```

When the "stickiness" becomes activated, the arguments to the sticky function
are modified. Similarly, when deactivated, the arguments will update accordingly.

### `<StickyContainer />` Props

`<StickyContainer />` supports all valid `<div />` props.

### `<Sticky />` Props

#### relative _(default: false)_

Set `relative` to `true` if the `<Sticky />` element will be rendered within
an overflowing `<StickyContainer />` (e.g. `style={{ overflowY: 'auto' }}`) and you want
the `<Sticky />` behavior to react to events only within that container.

When in `relative` mode, `window` events will not trigger sticky state changes. Only scrolling
within the nearest `StickyContainer` can trigger sticky state changes.

#### topOffset _(default: 0)_

Sticky state will be triggered when the top of the element is `topOffset` pixels from the top of the closest `<StickyContainer />`. Positive numbers give the impression of a lazy sticky state, whereas negative numbers are more eager in their attachment.

app.js

```js
<StickyContainer>
  ...
  <Sticky topOffset={80}>
    { props => (...) }
  </Sticky>
  ...
</StickyContainer>
```

The above would result in an element that becomes sticky once its top is greater than or equal to 80px away from the top of the `<StickyContainer />`.

#### bottomOffset _(default: 0)_

Sticky state will be triggered when the bottom of the element is `bottomOffset` pixels from the bottom of the closest `<StickyContainer />`.

app.js

```js
<StickyContainer>
  ...
  <Sticky bottomOffset={80}>
    { props => (...) }
  </Sticky>
  ...
</StickyContainer>
```

The above would result in an element that ceases to be sticky once its bottom is 80px away from the bottom of the `<StickyContainer />`.

#### disableCompensation _(default: false)_

Set `disableCompensation` to `true` if you do not want your `<Sticky />` to apply padding to
a hidden placeholder `<div />` to correct "jumpiness" as attachment changes from `position:fixed`
and back.

app.js

```js
<StickyContainer>
  ...
  <Sticky disableCompensation>
    { props => (...) }
  </Sticky>
  ...
</StickyContainer>
```

#### disableHardwareAcceleration _(default: false)_

When `disableHardwareAcceleration` is set to `true`, the `<Sticky />` element will not use hardware acceleration (e.g. `transform: translateZ(0)`). This setting is not recommended as it negatively impacts
the mobile experience, and can usually be avoided by improving the structure of your DOM.

app.js

```js
<StickyContainer>
  ...
  <Sticky disableHardwareAcceleration>
    { props => (...) }
  </Sticky>
  ...
</StickyContainer>
```
