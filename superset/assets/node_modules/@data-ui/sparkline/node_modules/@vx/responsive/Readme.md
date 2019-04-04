# @vx/responsive

```
npm install --save @vx/responsive
```

The `@vx/responsive` package is here to help you make responsive graphs.

If you would like your graph to adapt to the screen size, you can use `withScreenSize()` to take an element and attach events that will resize the graph to maintain the same size of the screen.

## Example:
``` js
import { withScreenSize } from `@vx/responsive`;
// or
// import * as Responsive from '@vx/responsive';
// Responsive.withScreenSize(...);

let chartToRender = withScreenSize(MySuperCoolVxChart);

// ... Render the chartToRender somewhere
```

You can also create a responsive chart with a specific viewBox with the `<ScaleSVG />` component.

## Example:

``` js
import { ScaleSVG } from `@vx/responsive`;
// or
// import * as Responsive from '@vx/responsive';
// <Responsive.ScaleSVG />

let chartToRender = (
  <ScaleSVG
    width={400}
    height={400}
  >
    <MySuperCoolVXChart/>
  </ScaleSVG>
)
```
