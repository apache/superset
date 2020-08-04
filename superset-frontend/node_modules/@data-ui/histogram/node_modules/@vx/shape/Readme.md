# @vx/shape

```
npm install --save @vx/shape
```

Shapes are the core elements of vx. Most of what you see on the screen, like lines, bars, and areas are shapes.

## `<AreaClosed />`

AreaClosed is a closed area under a curve.

### Example

![AreaClosed Example](http://i.imgur.com/hT0q8qx.png)

```js
<AreaClosed
  data={myData}
  xScale={myXScale}
  yScale={myYScale}
  x={myX}
  y={myY}
  strokeWidth={2}
  stroke={'url(#linear)'}
  fill={'url(#linear)'}
/>
```

### Properties

| Name            | Default             | Type     | Description                                                                                                 |
| :-------------- | :------------------ | :------- | :---------------------------------------------------------------------------------------------------------- |
| x               |                     | function | The d3 [x function](https://github.com/d3/d3-shape#area_x).                                                 |
| y               |                     | function | The d3 [y1 function](https://github.com/d3/d3-shape#area_y1).                                               |
| xScale          |                     | function | A [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale) for the xs.                  |
| yScale          |                     | function | A [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale) for the ys.                  |
| data            |                     | array    | An array of x and y data.                                                                                   |
| defined         | `d => y(d) && x(d)` | function | A [function](https://github.com/d3/d3-shape/blob/master/README.md#area_defined) called by `area.defined()`. |
| className       | `vx-area-closed`    | string   | The class name for the `path` element.                                                                      |
| strokeDasharray |                     | array    | The [pattern of dashes](https://mzl.la/1l7EiTQ) in the stroke.                                              |
| strokeWidth     | 2                   | number   | The size of the stroke.                                                                                     |
| stroke          | black               | string   | The color of the stroke.                                                                                    |
| fill            | rgba(0,0,0,0.3)     | string   | The color of the fill.                                                                                      |
| curve           |                     | function | The [curve function](https://github.com/hshoff/vx/tree/master/packages/vx-curve)                            |

## `<AreaStack />`

An `<AreaStack />` is used to represent several area's stacked on top of each other.

### Example

![AreaStack Example](http://i.imgur.com/Gh930t7.png)

```js
<AreaStack
  reverse
  top={margin.top}
  left={margin.left}
  keys={keys}
  data={data}
  x={d => xScale(x(d.data))}
  y0={d => yScale(d[0] / 100)}
  y1={d => yScale(d[1] / 100)}
  stroke={(d, i) => colorScale(i)}
  strokeWidth={1}
  fillOpacity={(d, i) => (selected.includes(browserNames[i]) ? 0.8 : 0.2)}
  fill={(d, i) => colorScale(i)}
  onMouseEnter={(d, i) => event => {
    updateSelected(prevState => [browserNames[i]]);
  }}
  onMouseLeave={(d, i) => event => {
    updateSelected(prevState => {
      if (prevState.includes(browserNames[i])) return [];
      return prevState;
    });
  }}
/>
```

### Properties

| Name      | Default | Type     | Description                                                                                                 |
| :-------- | :------ | :------- | :---------------------------------------------------------------------------------------------------------- |
| className |         | string   | The class name for the `path` element.                                                                      |
| top       | 0       | number   | The margin on top.                                                                                          |
| left      | 0       | number   | The margin on the left.                                                                                     |
| keys      |         | array    | Keys for the [d3.stack.](https://github.com/d3/d3-shape/blob/master/README.md#stack)                        |
| data      |         | array    | The data for each stack.                                                                                    |
| curve     |         | function | The [curve function](https://github.com/hshoff/vx/tree/master/packages/vx-curve)                            |
| defined   |         | function | A [function](https://github.com/d3/d3-shape/blob/master/README.md#area_defined) called by `area.defined()`. |
| x         |         | function | The d3 [x function.](https://github.com/d3/d3-shape#area_x)                                                 |
| x0        |         | function | The d3 [x0 function.](https://github.com/d3/d3-shape#area_x0)                                               |
| x1        |         | function | The d3 [x1 function.](https://github.com/d3/d3-shape#area_x1)                                               |
| y0        |         | function | The d3 [y0 function.](https://github.com/d3/d3-shape#area_y0)                                               |
| y1        |         | function | The d3 [y1 function.](https://github.com/d3/d3-shape#area_y1)                                               |
| glyph     |         | glyph    | [A glyph](https://github.com/hshoff/vx/tree/master/packages/vx-glyph) to be added to the stack.             |
| reverse   | false   | bool     | If true, reverses the order of stacks.                                                                      |

## `<Bar />`

A simple rectangle (a `<rect>` element) to use in your graphs.

### Example

![bar example](http://i.imgur.com/pvV9BJU.png)

```js
<Bar
  width={xScale.bandwidth()}
  height={barHeight}
  x={xScale(x(d))}
  y={yMax - barHeight}
  fill="url('#lines')"
  stroke={'black'}
  strokeWidth={1}
/>
```

### Properties

| Name             | Default   | Type   | Description                                                    |
| :--------------- | :-------- | :----- | :------------------------------------------------------------- |
| className        |           | string | The class name for the `path` element.                         |
| x                | 0         | number | A number or function for the x coordinate.                     |
| y                | 0         | number | A number or function for the y coordinate.                     |
| width            |           | number | The pixel width of the bar.                                    |
| height           |           | number | The pixel height of the bar.                                   |
| rx               |           | number | The pixel value of the corner radius.                          |
| ry               |           | number | The pixel value of the corner radius.                          |
| fill             | steelblue | string | The color for the fill of the rect element.                    |
| fillOpacity      |           | number | The opacity for the fill of the rect element                   |
| stroke           |           | string | The color for the stroke of the rect element.                  |
| strokeWidth      |           | number | The pixel width of the stroke.                                 |
| strokeDasharray  |           | array  | The [pattern of dashes](https://mzl.la/1l7EiTQ) in the stroke. |
| strokeLinecap    |           | string | The svg [linecap](https://mzl.la/2pM1786) of the stroke.       |
| strokeLinejoin   |           | string | The svg [linejoin](https://mzl.la/2pzdxEB) of the stroke.      |
| strokeMiterlimit |           | number | The svg [Miterlimit](https://mzl.la/2pLVE13) of the stroke.    |
| strokeOpacity    |           | number | The svg opacity.                                               |

## `<BarGroup />`

![BarGroup Example](https://i.imgur.com/Ef9fVqe.png)

```js
<BarGroup
  data={data}
  keys={keys}
  height={yMax}
  x0={x0}
  x0Scale={x0Scale}
  x1Scale={x1Scale}
  yScale={yScale}
  zScale={zScale}
  rx={4}
/>
```

### Properties

| Name      | Default | Type     | Description                                                                                                                     |
| :-------- | :------ | :------- | :------------------------------------------------------------------------------------------------------------------------------ |
| data      |         | array    | An array of data elements.                                                                                                      |
| className |         | string   | The class name for the `path` element.                                                                                          |
| top       |         | number   | The margin on top.                                                                                                              |
| left      |         | number   | The margin on the left.                                                                                                         |
| x0        |         | function | xs accessor function.                                                                                                           |
| x0Scale   |         | function | A [scale band function](https://github.com/hshoff/vx/tree/master/packages/vx-scale#band-scaling) for the bar group.             |
| x1Scale   |         | function | A [scale band function](https://github.com/hshoff/vx/tree/master/packages/vx-scale#band-scaling) for each bar within the group. |
| yScale    |         | function | A [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale) for the ys.                                      |
| zScale    |         | function | A [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale) for the keys.                                    |
| keys      |         | array    | A list of data keys                                                                                                             |
| height    |         | number   | The pixel height of the bar group.                                                                                              |

## `<BarGroupHorizontal />`

![BarGroupHorizontal Example](https://i.imgur.com/RDBJewO.png)

```js
<BarGroupHorizontal
  data={data}
  keys={keys}
  width={xMax}
  y0={y0}
  y0Scale={y0Scale}
  y1Scale={y1Scale}
  xScale={xScale}
  zScale={zScale}
  rx={4}
/>
```

### Properties

| Name      | Default | Type     | Description                                                                                                                     |
| :-------- | :------ | :------- | :------------------------------------------------------------------------------------------------------------------------------ |
| data      |         | array    | An array of data elements.                                                                                                      |
| className |         | string   | The class name for the `path` element.                                                                                          |
| top       |         | number   | The margin on top.                                                                                                              |
| left      |         | number   | The margin on the left.                                                                                                         |
| y0        |         | function | ys accessor function.                                                                                                           |
| y0Scale   |         | function | A [scale band function](https://github.com/hshoff/vx/tree/master/packages/vx-scale#band-scaling) for the bar group.             |
| y1Scale   |         | function | A [scale band function](https://github.com/hshoff/vx/tree/master/packages/vx-scale#band-scaling) for each bar within the group. |
| xScale    |         | function | A [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale) for the xs.                                      |
| zScale    |         | function | A [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale) for the keys.                                    |
| keys      |         | array    | A list of data keys                                                                                                             |
| height    |         | number   | The pixel height of the bar group.                                                                                              |

## `<Line />`

A simple line. Good for drawing in the sand.

### Example

```js
<Line from={new Point({ x: 0, y: 3 })} to={new Point({ x: 0, y: 10 })} />
```

### Properties

| Name            | Default                  | Type   | Description                                                                               |
| :-------------- | :----------------------- | :----- | :---------------------------------------------------------------------------------------- |
| from            | new Point({ x: 0 y: 0 }) | Point  | The beginning [point](https://github.com/hshoff/vx/tree/master/packages/vx-point).        |
| to              | new Point({ x: 1 y: 1 }) | Point  | The end [point](https://github.com/hshoff/vx/tree/master/packages/vx-point).              |
| stroke          | black                    | string | The color of the stroke.                                                                  |
| strokeWidth     | 1                        | number | The pixel width of the stroke.                                                            |
| strokeDasharray |                          | array  | The [pattern of dashes](https://mzl.la/1l7EiTQ) in the stroke.                            |
| transform       |                          | string | An [SVG transform.](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform) |
| className       |                          | string | The class name for the `line` element.                                                    |

## `<LinePath />`

A more complicated line path. A `<LinePath />` is useful for making line graphs and drawing.

### Example

![Linepath example](http://i.imgur.com/YoDZrGi.png)

```js
<LinePath
  data={dataset[1].data}
  xScale={xScale}
  yScale={yScale}
  x={x}
  y={y}
  stroke={'black'}
  strokeWidth={2}
/>
```

### Properties

| Name            | Default      | Type     | Description                                                                                                 |
| :-------------- | :----------- | :------- | :---------------------------------------------------------------------------------------------------------- |
| data            |              | array    | The data in x, y.                                                                                           |
| xScale          |              | function | A [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale) for the xs.                  |
| yScale          |              | function | A [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale) for the ys.                  |
| x               |              | function | The d3 [x function](https://github.com/d3/d3-shape#line_x).                                                 |
| y               |              | function | The d3 [y function](https://github.com/d3/d3-shape#line_y).                                                 |
| defined         |              | function | A [function](https://github.com/d3/d3-shape/blob/master/README.md#line_defined) called by `line.defined()`. |
| className       |              | string   | The class name for the `path` element.                                                                      |
| stroke          | steelblue    | string   | The color of the stroke.                                                                                    |
| strokeWidth     | 2            | number   | The pixel value for the stroke.                                                                             |
| strokeDasharray |              | array    | The [pattern of dashes](https://mzl.la/1l7EiTQ) in the stroke.                                              |
| fill            | none         | string   | The color of the fill for the `path` element.                                                               |
| curve           | Curve.linear | function | The [curve function](https://github.com/hshoff/vx/tree/master/packages/vx-curve)                            |
| glyph           |              | glyph    | [A glyph](https://github.com/hshoff/vx/tree/master/packages/vx-glyph) to be added to the line.              |

## `<LineRadial />`

![LineRadial Example](http://i.imgur.com/Zcud84N.png)

```js
<LineRadial
  data={appleStock}
  angle={d => xScale(x(d))}
  radius={d => yScale(y(d))}
  fill="none"
  stroke={"url('#line-gradient')"}
  strokeWidth={2}
  strokeOpacity={0.7}
  curve={curveBasisOpen}
  strokeLinecap="round"
/>
```

### Properties

| Name      | Default | Type     | Description                                                                                                 |
| :-------- | :------ | :------- | :---------------------------------------------------------------------------------------------------------- |
| className |         | string   | The class for the <path /> element.                                                                         |
| angle     |         | function | The angle at each point.                                                                                    |
| radius    |         | function | The radius at each angle.                                                                                   |
| defined   |         | function | A [function](https://github.com/d3/d3-shape/blob/master/README.md#area_defined) called by `area.defined()`. |
| curve     |         | function | The [curve function](https://github.com/hshoff/vx/tree/master/packages/vx-curve)                            |
| data      |         | array    | An array of x and y data.                                                                                   |

## `<Pie />`

![Pie Example](https://i.imgur.com/OLKpcX1.png)

```js
<Pie
  data={browsers}
  pieValue={d => d.usage}
  outerRadius={radius - 80}
  innerRadius={radius - 120}
  fill="white"
  fillOpacity={d => 1 / (d.index + 2)}
  cornerRadius={3}
  padAngle={0}
  centroid={(centroid, arc) => {
    const [x, y] = centroid;
    const { startAngle, endAngle } = arc;
    if (endAngle - startAngle < 0.1) return null;
    return (
      <Label x={x} y={y}>
        {arc.data.label}
      </Label>
    );
  }}
/>
```

### Properties

| Name          | Default | Type     | Description                                                                                                                        |
| :------------ | :------ | :------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| className     |         | string   | The class for the <path /> element.                                                                                                |
| top           | 0       | number   | The distance in pixels from the top.                                                                                               |
| left          | 0       | number   | The distance in pixels from the left.                                                                                              |
| data          |         | array    | An array of data elements.                                                                                                         |
| pieValue      |         | function | A function that takes a data element and returns the value for the corresponding pie’s slice.                                      |
| innerRadius   | 0       | number   | The distance of arcs’ inner side from the center of the pie. Make it non-zero to have a “donut” chart.                             |
| outerRadius   |         | number   | The total radius of the pie.                                                                                                       |
| cornerRadius  | 0       | number   | The corner radius of pie arcs in pixels.                                                                                           |
| startAngle    | 0       | number   | The angle in radians at which the pie should start.                                                                                |
| endAngle      | 2π      | number   | The angle in radians at which the pie should end.                                                                                  |
| padAngle      | 0       | number   | The pad (or gutter) between arcs in radians.                                                                                       |
| padRadius     |         | number   | Set the arc [padRadius](https://github.com/d3/d3-shape#arc_padRadius)                                                              |
| pieSort       |         | function | A comparator function which takes two data elements and returns `-1`, `0` or `+1` to sort arcs.                                    |
| pieSortValues |         | function | A comparator function which takes two values (as returned from `pieValue`) and returns `-1`, `0` or `+1` to sort arcs.             |
| centroid      |         | function | A render function which takes a [centroid](https://github.com/d3/d3-shape#arc_centroid) and an `arc` argument called for each arc. |

## `<Polygon />`

A simple polygon shape. Supply the sides and the length and we will do the rest.

### Example

```js
// hexagon
<Polygon sides={6} size={25} {...additionalProps[i]} />
```

### Properties

| Name   | Default                  | Type   | Description                                                                                    |
| :----- | :----------------------- | :----- | :--------------------------------------------------------------------------------------------- |
| sides  |                          | number | The number of sides in the polygon.                                                            |
| size   | 25                       | number | The length of each side of the polygon.                                                        |
| rotate | 0                        | number | The angle in degrees to rotate the polygon.                                                    |
| center | new Point({ x: 0 y: 0 }) | Point  | The center of the polygon [point](https://github.com/hshoff/vx/tree/master/packages/vx-point). |

## Sources For Components

* [`<AreaClosed />`](https://github.com/hshoff/vx/blob/master/packages/vx-shape/src/shapes/AreaClosed.js)
* [`<AreaStack />`](https://github.com/hshoff/vx/blob/master/packages/vx-shape/src/shapes/AreaStack.js)
* [`<Bar />`](https://github.com/hshoff/vx/blob/master/packages/vx-shape/src/shapes/Bar.js)
* [`<BarGroup />`](https://github.com/hshoff/vx/blob/master/packages/vx-shape/src/shapes/BarGroup.js)
* [`<BarGroupHorizontal />`](https://github.com/hshoff/vx/blob/master/packages/vx-shape/src/shapes/BarGroupHorizontal.js)
* [`<Line />`](https://github.com/hshoff/vx/blob/master/packages/vx-shape/src/shapes/Line.js)
* [`<LinePath />`](https://github.com/hshoff/vx/blob/master/packages/vx-shape/src/shapes/LinePath.js)
* [`<LineRadial />`](https://github.com/hshoff/vx/blob/master/packages/vx-shape/src/shapes/LineRadial.js)
* [`<Pie />`](https://github.com/hshoff/vx/blob/master/packages/vx-shape/src/shapes/Pie.js)
* [`<Polygon`](https://github.com/hshoff/vx/blob/master/packages/vx-shape/src/shapes/Polygon.js)
