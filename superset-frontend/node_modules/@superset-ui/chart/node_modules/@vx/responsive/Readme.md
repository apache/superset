# @vx/responsive

<a title="@vx/responsive npm downloads" href="https://www.npmjs.com/package/@vx/responsive">
  <img src="https://img.shields.io/npm/dm/@vx/responsive.svg?style=flat-square" />
</a>

The `@vx/responsive` package is here to help you make responsive graphs.

**With Enhancers**

`withScreenSize`

`withParentSize`

**With Components**

`ParentSize`

`ScaleSVG`

## `withScreenSize`

If you would like your graph to adapt to the screen size, you can use `withScreenSize()`. The
resulting component will pass `screenWidth` and `screenHeight` props to the wrapped component
containing the respective screen dimensions.

### Example:

```js
import { withScreenSize } from '@vx/responsive';
// or
// import * as Responsive from '@vx/responsive';
// Responsive.withScreenSize(...);

let chartToRender = withScreenSize(MySuperCoolVxChart);

// ... Render the chartToRender somewhere
```

## `withParentSize`

If you would like your graph to adapt to it's parent component's size, you can use
`withParentSize()`. The resulting component will pass `parentWidth` and `parentHeight` props to the
wrapped component containing the respective parent's dimensions.

### Example:

```js
import { withParentSize } from '@vx/responsive';
// or
// import * as Responsive from '@vx/responsive';
// Responsive.withParentSize(...);

let chartToRender = withParentSize(MySuperCoolVxChart);

// ... Render the chartToRender somewhere
```

## `ParentSize`

You might do the same thing using the `ParentSize` component.

### Example:

```js
import { ParentSize } from '@vx/responsive';
// or
// import * as Responsive from '@vx/responsive';
// <Responsive.ParentSize />;

let chartToRender = (
  <ParentSize>
    {parent => (
      <MySuperCoolVxChart
        parentWidth={parent.width}
        parentHeight={parent.height}
        parentTop={parent.top}
        parentLeft={parent.left}
        // this is the referer to the wrapper component
        parentRef={parent.ref}
        // this function can be called inside MySuperCoolVxChart to cause a resize of the wrapper component
        resizeParent={parent.resize}
      />
    )}
  </ParentSize>
);

// ... Render the chartToRender somewhere
```

## `ScaleSVG`

You can also create a responsive chart with a specific viewBox with the `ScaleSVG` component.

### Example:

```js
import { ScaleSVG } from '@vx/responsive';
// or
// import * as Responsive from '@vx/responsive';
// <Responsive.ScaleSVG />

let chartToRender = (
  <ScaleSVG width={400} height={400}>
    <MySuperCoolVXChart />
  </ScaleSVG>
);

// ... Render the chartToRender somewhere
```

## Installation

```
npm install --save @vx/responsive
```
