# @vx/curve

<a title="@vx/curve npm downloads" href="https://www.npmjs.com/package/@vx/curve">
  <img src="https://img.shields.io/npm/dm/@vx/curve.svg?style=flat-square" />
</a>

## Installation

```
npm install --save @vx/curve
```

## Overview

The `@vx/curve` package is a wrapper of the [d3-shape](https://github.com/d3/d3-shape) curve
functions. A `curve` is a function that can be passed into other `vx` objects that draw lines or
paths, such as a `LinePath`, to change the way the line between points is drawn. Click on the
example below for an interactive way to explore curve aesthetics.

Any function with the prefix `curve` in `d3` can be used through `vx` like so:

```javascript
import { curveCatmullRomOpen } from '@vx/curve';
let line = (<Shape.LinePath curve={curveCatmullRomOpen} />)

// or if you want namespace all Curves under the `Curve`
import * as Curve from `@vx/curve`;
let line = (<Shape.LinePath curve={Curve.curveCatmullRomOpen} />)
```

## Functions

| vx                    | d3                                                                            |
| --------------------- | ----------------------------------------------------------------------------- |
| curveBasis            | [curveBasis](https://github.com/d3/d3-shape#curveBasis)                       |
| curveBasisClose       | [curveBasisClosed](https://github.com/d3/d3-shape#curveBasisClosed)           |
| curveBasisOpen        | [curveBasisOpen](https://github.com/d3/d3-shape#curveBasisOpen)               |
| curveStep             | [curveStep](https://github.com/d3/d3-shape#curveStep)                         |
| curveStepAfter        | [curveStepAfter](https://github.com/d3/d3-shape#curveStepAfter)               |
| curveStepBefore       | [curveStepbefore](https://github.com/d3/d3-shape#curveStepBefore)             |
| curveBundle           | [curveBundle](https://github.com/d3/d3-shape#curveBundle)                     |
| curveLinear           | [curveLinear](https://github.com/d3/d3-shape#curveLinear)                     |
| curveLinearClosed     | [curveLinearClosed](https://github.com/d3/d3-shape#curveLinearClosed)         |
| curveMonotoneX        | [curveMonotoneX](https://github.com/d3/d3-shape#curveMonotoneX)               |
| curveMonotoneY        | [curveMonotoneY](https://github.com/d3/d3-shape#curveMonotoneY)               |
| curveCardinal         | [curveCardinal](https://github.com/d3/d3-shape#curveCardinal)                 |
| curveCardinalClosed   | [curveCardinalClosed](https://github.com/d3/d3-shape#curveCardinalClosed)     |
| curveCardinalOpen     | [curveCardinalOpen](https://github.com/d3/d3-shape#curveCardinalOpen)         |
| curveCatmullRom       | [curveCatmullRom](https://github.com/d3/d3-shape#curveCatmullRom)             |
| curveCatmullRomClosed | [curveCatmullRomClosed](https://github.com/d3/d3-shape#curveCatmullRomClosed) |
| curveCatmullRomOpen   | [curveCatmullRomOpen](https://github.com/d3/d3-shape#curveCatmullRomOpen)     |
| curveNatural          | [curveNatural](https://github.com/d3/d3-shape#curveNatural)                   |
