# @vx/axis

```
npm install --save @vx/axis
```

An axis component consists of a line with ticks, tick labels, and an axis label that helps viewers interpret your graph.

You can use one of the 4 pre-made axes, or you can create your own based on the `<Axis />` element.

## Example

![Axis Example](http://i.imgur.com/uNIgPsg.png)

```javascript
import { AxisBottom, AxisLeft } from '@vx/axis';
// or
// import * as Axis from '@vx/axis';
// <Axis.AxisBottom />
// or
// import AxisBottom from '@vx/axis/build/Axis/AxisBottom';


function MyChart() {
  // ...
  return (
    <svg>
      // ...
      <AxisBottom
        scale={xScale}
        top={yMax + margin.top}
        left={margin.left}
        axisClassName="axis-class"
        labelClassName="axis-label-class"
        tickClassName="tick-label-class"
        label="Bottom axis label"
        stroke="#333333"
        tickStroke="#333333"
      />
      <AxisLeft
        scale={yScale}
        top={margin.top}
        left={margin.left}
        label="Left axis label"
        labelProps={{ fontSize: 12, fill: 'black' }}
        tickFormat={(value, index) => `$${value}`}
        tickProps={(value, index) => ({
          dx: "0.33em",
          fill: "black",
          fontSize: 8,
          opacity: index % 2 === 0 ? 0.5 : 0.9,
        })}
      />
    </svg>
  );
}
```

## `<AxisBottom />`

|        Name        |     Default     |   Type   |                                                   Description                                                   |
|:------------------ |:--------------- |:-------- |:--------------------------------------------------------------------------------------------------------------- |
| axisClassName      |                 | string   | The class name applied to the outermost axis group element.                                                     |
| axisLineClassName  |                 | string   | The class name applied to the axis line element.                                                                |
| hideAxisLine       | `false`         | bool     | If true, will hide the axis line.                                                                               |
| hideTicks          | `false`         | bool     | If true, will hide the ticks (but not the tick labels).                                                         |
| hideZero           | `false`         | bool     | If true, will hide the '0' value tick and tick label.                                                           |
| label              | `""`            | string   | The text for the axis label.                                                                                    |
| labelClassName     |                 | string   | The class name applied to the axis label text element.                                                          |
| labelOffset        | `8`             | number   | Px offset of the axis label (does not include tick label font size, which is accounted for automatically)       |
| labelProps         | `{ textAnchor: 'middle', fontFamily: 'Arial', fontSize: 10, fill: 'black' }` | object | Props applied to the axis label component.           |
| left               | `0`             | number   | A left pixel offset applied to the entire axis.                                                                 |
| numTicks           | `10`            | number   | The number of ticks wanted for the axis (note this is approximate)                                              |
| rangePadding       | `0`             | number   | Px padding to apply to both sides of the axis                                                                   |
| scale              | REQUIRED        | function | A d3 [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale).                              |
| stroke             | `black`         | string   | The color for the stroke of the lines.                                                                          |
| strokeWidth        | `1`             | number   | The pixel value for the width of the lines.                                                                     |
| strokeDasharray    |                 | string   | The [pattern of dashes](https://mzl.la/1l7EiTQ) in the stroke.                                                  |
| tickClassName      |                 | string   | The class name applied to each tick group.                                                                      |
| tickFormat         | `(val, i) => val` | function | A [d3 formatter](https://github.com/d3/d3-scale/blob/master/README.md#continuous_tickFormat) for the tick text. |
| tickLabelProps     | `(val, i) => ({ dy: '0.25em', textAnchor: 'middle', fontFamily: 'Arial', fontSize: 10, fill: 'black' })` | function | function that returns props for a given tick label. |
| tickLength         | `8`             | number   | The length of the tick lines.                                                                                   |
| tickStroke         | `black`         | string   | The color for the tick's stroke value.                                                                          |
| tickTransform      |                 | string   | A custom SVG transform value to be applied to each tick group.                                                  |
| tickValues         |                 | Array    | An array of values that determine the number and values of the ticks. Falls back to scale.ticks() or .domain(). |
| top                | `0`             | number   | A top pixel offset applied to the entire axis.                                                                  |


## `<AxisLeft />`

|        Name        |     Default     |   Type   |                                                   Description                                                   |
|:------------------ |:--------------- |:-------- |:--------------------------------------------------------------------------------------------------------------- |
| axisClassName      |                 | string   | The class name applied to the outermost axis group element.                                                     |
| axisLineClassName  |                 | string   | The class name applied to the axis line element.                                                                |
| hideAxisLine       | `false`         | bool     | If true, will hide the axis line.                                                                               |
| hideTicks          | `false`         | bool     | If true, will hide the ticks (but not the tick labels).                                                         |
| hideZero           | `false`         | bool     | If true, will hide the '0' value tick and tick label.                                                           |
| label              | `""`            | string   | The text for the axis label.                                                                                    |
| labelClassName     |                 | string   | The class name applied to the axis label text element.                                                          |
| labelOffset        | `36`            | number   | Px offset of the axis label (does not include tick label font size, which is accounted for automatically)       |
| labelProps         | `{ textAnchor: 'middle', fontFamily: 'Arial', fontSize: 10, fill: 'black' }` | object | Props applied to the axis label component.           |
| left               | `0`             | number   | A left pixel offset applied to the entire axis.                                                                 |
| numTicks           | `10`            | number   | The number of ticks wanted for the axis (note this is approximate)                                              |
| rangePadding       | `0`             | number   | Px padding to apply to both sides of the axis                                                                   |
| scale              | REQUIRED        | function | A d3 [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale).                              |
| stroke             | `black`         | string   | The color for the stroke of the lines.                                                                          |
| strokeWidth        | `1`             | number   | The pixel value for the width of the lines.                                                                     |
| strokeDasharray    |                 | string   | The [pattern of dashes](https://mzl.la/1l7EiTQ) in the stroke.                                                  |
| tickClassName      |                 | string   | The class name applied to each tick group.                                                                      |
| tickFormat         | `(val, i) => val` | function | A [d3 formatter](https://github.com/d3/d3-scale/blob/master/README.md#continuous_tickFormat) for the tick text. |
| tickLabelProps     | `(val, i) => ({ dx: '-0.25em', dy: '0.25em', textAnchor: 'end', fontFamily: 'Arial', fontSize: 10, fill: 'black' })` | function | function that returns props for a given tick label. |
| tickLength         | `8`             | number   | The length of the tick lines.                                                                                   |
| tickStroke         | `black`         | string   | The color for the tick's stroke value.                                                                          |
| tickTransform      |                 | string   | A custom SVG transform value to be applied to each tick group.                                                  |
| tickValues         |                 | Array    | An array of values that determine the number and values of the ticks. Falls back to scale.ticks() or .domain(). |
| top                | `0`             | number   | A top pixel offset applied to the entire axis.                                                                  |

## `<AxisRight />`

|        Name        |     Default     |   Type   |                                                   Description                                                   |
|:------------------ |:--------------- |:-------- |:--------------------------------------------------------------------------------------------------------------- |
| axisClassName      |                 | string   | The class name applied to the outermost axis group element.                                                     |
| axisLineClassName  |                 | string   | The class name applied to the axis line element.                                                                |
| hideAxisLine       | `false`         | bool     | If true, will hide the axis line.                                                                               |
| hideTicks          | `false`         | bool     | If true, will hide the ticks (but not the tick labels).                                                         |
| hideZero           | `false`         | bool     | If true, will hide the '0' value tick and tick label.                                                           |
| label              | `""`            | string   | The text for the axis label.                                                                                    |
| labelClassName     |                 | string   | The class name applied to the axis label text element.                                                          |
| labelOffset        | `36`            | number   | Px offset of the axis label (does not include tick label font size, which is accounted for automatically)       |
| labelProps         | `{ textAnchor: 'middle', fontFamily: 'Arial', fontSize: 10, fill: 'black' }` | object | Props applied to the axis label component.           |
| left               | `0`             | number   | A left pixel offset applied to the entire axis.                                                                 |
| numTicks           | `10`            | number   | The number of ticks wanted for the axis (note this is approximate)                                              |
| rangePadding       | `0`             | number   | Px padding to apply to both sides of the axis                                                                   |
| scale              | REQUIRED        | function | A d3 [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale).                              |
| stroke             | `black`         | string   | The color for the stroke of the lines.                                                                          |
| strokeWidth        | `1`             | number   | The pixel value for the width of the lines.                                                                     |
| strokeDasharray    |                 | string   | The [pattern of dashes](https://mzl.la/1l7EiTQ) in the stroke.                                                  |
| tickClassName      |                 | string   | The class name applied to each tick group.                                                                      |
| tickFormat         | `(val, i) => val` | function | A [d3 formatter](https://github.com/d3/d3-scale/blob/master/README.md#continuous_tickFormat) for the tick text. |
| tickLabelProps     | `(val, i) => ({ dx: '0.25em', dy: '0.25em', textAnchor: 'start', fontFamily: 'Arial', fontSize: 10, fill: 'black' })` | function | function that returns props for a given tick label. |
| tickLength         | `8`             | number   | The length of the tick lines.                                                                                   |
| tickStroke         | `black`         | string   | The color for the tick's stroke value.                                                                          |
| tickTransform      |                 | string   | A custom SVG transform value to be applied to each tick group.                                                  |
| tickValues         |                 | Array    | An array of values that determine the number and values of the ticks. Falls back to scale.ticks() or .domain(). |
| top                | `0`             | number   | A top pixel offset applied to the entire axis.                                                                  |

## `<AxisTop />`

|        Name        |     Default     |   Type   |                                                   Description                                                   |
|:------------------ |:--------------- |:-------- |:--------------------------------------------------------------------------------------------------------------- |
| axisClassName      |                 | string   | The class name applied to the outermost axis group element.                                                     |
| axisLineClassName  |                 | string   | The class name applied to the axis line element.                                                                |
| hideAxisLine       | `false`         | bool     | If true, will hide the axis line.                                                                               |
| hideTicks          | `false`         | bool     | If true, will hide the ticks (but not the tick labels).                                                         |
| hideZero           | `false`         | bool     | If true, will hide the '0' value tick and tick label.                                                           |
| label              | `""`            | string   | The text for the axis label.                                                                                    |
| labelClassName     |                 | string   | The class name applied to the axis label text element.                                                          |
| labelOffset        | `8`             | number   | Px offset of the axis label (does not include tick label font size, which is accounted for automatically)       |
| labelProps         | `{ textAnchor: 'middle', fontFamily: 'Arial', fontSize: 10, fill: 'black' }` | object | Props applied to the axis label component.           |
| left               | `0`             | number   | A left pixel offset applied to the entire axis.                                                                 |
| numTicks           | `10`            | number   | The number of ticks wanted for the axis (note this is approximate)                                              |
| rangePadding       | `0`             | number   | Px padding to apply to both sides of the axis                                                                   |
| scale              | REQUIRED        | function | A d3 [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale).                              |
| stroke             | `black`         | string   | The color for the stroke of the lines.                                                                          |
| strokeWidth        | `1`             | number   | The pixel value for the width of the lines.                                                                     |
| strokeDasharray    |                 | string   | The [pattern of dashes](https://mzl.la/1l7EiTQ) in the stroke.                                                  |
| tickClassName      |                 | string   | The class name applied to each tick group.                                                                      |
| tickFormat         | `(val, i) => val` | function | A [d3 formatter](https://github.com/d3/d3-scale/blob/master/README.md#continuous_tickFormat) for the tick text. |
| tickLabelProps     | `(val, i) => ({ dy: '-0.25em', textAnchor: 'middle', fontFamily: 'Arial', fontSize: 10, fill: 'black' })` | function | function that returns props for a given tick label. |
| tickLength         | `8`             | number   | The length of the tick lines.                                                                                   |
| tickStroke         | `black`         | string   | The color for the tick's stroke value.                                                                          |
| tickTransform      |                 | string   | A custom SVG transform value to be applied to each tick group.                                                  |
| tickValues         |                 | Array    | An array of values that determine the number and values of the ticks. Falls back to scale.ticks() or .domain(). |
| top                | `0`             | number   | A top pixel offset applied to the entire axis.                                                                  |


## `<Axis />`

|        Name        |     Default     |   Type   |                                                   Description                                                   |
|:------------------ |:--------------- |:-------- |:--------------------------------------------------------------------------------------------------------------- |
| axisClassName      |                 | string   | The class name applied to the outermost axis group element.                                                     |
| axisLineClassName  |                 | string   | The class name applied to the axis line element.                                                                |
| hideAxisLine       | `false`         | bool     | If true, will hide the axis line.                                                                               |
| hideTicks          | `false`         | bool     | If true, will hide the ticks (but not the tick labels).                                                         |
| hideZero           | `false`         | bool     | If true, will hide the '0' value tick and tick label.                                                           |
| label              | `""`            | string   | The text for the axis label.                                                                                    |
| labelClassName     |                 | string   | The class name applied to the axis label text element.                                                          |
| labelOffset        | `14`            | number   | Px offset of the axis label (does not include tick label font size, which is accounted for automatically)       |
| labelProps         | `{ textAnchor: 'middle', fontFamily: 'Arial', fontSize: 10, fill: 'black' }` | object | Props applied to the axis label component              |
| left               | `0`             | number   | A left pixel offset applied to the entire axis.                                                                 |
| numTicks           | `10`            | number   | The number of ticks wanted for the axis (note this is approximate)                                              |
| orientation        | `bottom`        | 'top', 'right', 'bottom', or 'left' | Specifies the orientation of the axis.                                               |
| rangePadding       | `0`             | number   | Px padding to apply to both sides of the axis                                                                   |
| scale              | REQUIRED        | function | A d3 [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale).                              |
| stroke             | `black`         | string   | The color for the stroke of the lines.                                                                          |
| strokeWidth        | `1`             | number   | The pixel value for the width of the lines.                                                                     |
| strokeDasharray    |                 | string   | The [pattern of dashes](https://mzl.la/1l7EiTQ) in the stroke.                                                  |
| tickClassName      |                 | string   | The class name applied to each tick group.                                                                      |
| tickFormat         | `(val, i) => val` | function | A [d3 formatter](https://github.com/d3/d3-scale/blob/master/README.md#continuous_tickFormat) for the tick text. |
| tickLabelProps     | `(val, i) => ({ textAnchor: 'middle', fontFamily: 'Arial', fontSize: 10, fill: 'black' })` | function | function that returns props for a given tick label. |
| tickLength         | `8`             | number   | The length of the tick lines.                                                                                   |
| tickStroke         | `black`         | string   | The color for the tick's stroke value.                                                                          |
| tickTransform      |                 | string   | A custom SVG transform value to be applied to each tick group.                                                  |
| tickValues         |                 | Array    | An array of values that determine the number and values of the ticks. Falls back to scale.ticks() or .domain(). |
| top                | `0`             | number   | A top pixel offset applied to the entire axis.                                                                  |

## Source code
+ [`<Axis />`](https://github.com/hshoff/vx/blob/master/packages/vx-axis/src/axis/Axis.js)
+ [`<AxisLeft />`](https://github.com/hshoff/vx/blob/master/packages/vx-axis/src/axis/AxisLeft.js)
+ [`<AxisBottom />`](https://github.com/hshoff/vx/blob/master/packages/vx-axis/src/axis/AxisBottom.js)
+ [`<AxisTop />`](https://github.com/hshoff/vx/blob/master/packages/vx-axis/src/axis/AxisTop.js)
+ [`<AxisRight />`](https://github.com/hshoff/vx/blob/master/packages/vx-axis/src/axis/AxisRight.js)
