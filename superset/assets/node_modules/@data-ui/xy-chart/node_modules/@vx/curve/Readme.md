# @vx/curve

```
npm install --save @vx/curve
```

## Overview

A curve is a function that can be passed into other vx objects, mainly a LinePath to change the way the line is structured.

For example, checkout the difference between a `Curve.natural`:

![natural curve](https://raw.githubusercontent.com/d3/d3-shape/master/img/natural.png)

and a `Curve.step`:

![step curve](https://raw.githubusercontent.com/d3/d3-shape/master/img/step.png)

The `@vx/curve` package is a wrapper over [d3-shape](https://github.com/d3/d3-shape) curve functions.

Any function with the prefix `curve` in d3 can be used through `vx` like so:

``` javascript
import { curveCatmullRomOpen } from '@vx/curve';
let line = (<Shape.LinePath curve={curveCatmullRomOpen} />)

// or if you want namespace all Curves under the `Curve`
import * as Curve from `@vx/curve`;
let line = (<Shape.LinePath curve={Curve.curveCatmullRomOpen} />)
```

## Functions

|           vx          |                                      d3                                       |
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
