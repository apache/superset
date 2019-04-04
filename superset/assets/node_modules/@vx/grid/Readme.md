# @vx/grid

```
npm install --save @vx/grid
```

The `@vx/grid` package lets you create rows and columns. Or, you can use a `<Grid />` to get them both at once!

## Example

![grid example](http://i.imgur.com/KPmq4XV.png)

``` js
import { Grid } from '@vx/grid';
// or
// import * as Grid from '@vx/grid';
// <Grid.Grid />

const grid = (<Grid
  xScale={xScale}
  yScale={yScale}
  width={xMax}
  height={yMax}
  numTicksRows={numTicksForHeight(height)}
  numTicksColumns={numTicksForWidth(width)}
/>);
```

## `<Grid />`

|      Name       | Default |   Type   |                                        Description                                         |
|:--------------- |:------- |:-------- |:------------------------------------------------------------------------------------------ |
| top             |         | number   | The top margin in pixels.                                                                  |
| left            |         | number   | The left margin in pixels.                                                                 |
| xScale          |         | function | A [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale) for the xs. |
| yScale          |         | function | A [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale) for the ys. |
| width           |         | number   | The pixel width of the grid.                                                               |
| height          |         | number   | The pixel height of the grid.                                                              |
| className       |         | string   | The class name for the Group element.                                                      |
| stroke          |         | string   | The color for the stroke of the grid.                                                      |
| strokeWidth     |         | number   | The width of the lines in the stroke.                                                      |
| strokeDasharray |         | array    | The [pattern of dashes](https://mzl.la/1l7EiTQ) in the stroke.                             |
| numTicksRows    |         | number   | The number of row lines.                                                                   |
| numTicksColumns |         | number   | The number of column lines.                                                                |

## `<Rows />`

|      Name       | Default |   Type   |                                         Description                                          |
|:--------------- |:------- |:-------- |:-------------------------------------------------------------------------------------------- |
| top             |         | number   | The top margin in pixels.                                                                    |
| left            |         | number   | The left margin in pixels.                                                                   |
| scale           |         | function | A [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale) for the rows. |
| width           |         | number   | The pixel width of the grid.                                                                 |
| stroke          | #eaf0f6 | string   | The color for the stroke of the lines.                                                       |
| strokeWidth     | 1       | number   | The width of the lines in the stroke.                                                        |
| strokeDasharray |         |          | The [pattern of dashes](https://mzl.la/1l7EiTQ) in the stroke.                               |
| className       |         |          | The class name for the Group element.                                                        |
| numTicks        | 10      | number   | The number of row lines.                                                                     |

## `<Columns />`

|      Name       | Default |   Type   |                                         Description                                          |
|:--------------- |:------- |:-------- |:-------------------------------------------------------------------------------------------- |
| top             |         | number   | The top margin in pixels.                                                                    |
| left            |         | number   | The left margin in pixels.                                                                   |
| scale           |         | function | A [scale function](https://github.com/hshoff/vx/tree/master/packages/vx-scale) for the rows. |
| height          |         | number   | The pixel height of the grid.                                                                |
| stroke          | #eaf0f6 | string   | The color for the stroke of the lines.                                                       |
| strokeWidth     | 1       | number   | The width of the lines in the stroke.                                                        |
| strokeDasharray |         |          | The [pattern of dashes](https://mzl.la/1l7EiTQ) in the stroke.                               |
| className       |         |          | The class name for the Group element.                                                        |
| numTicks        | 10      | number   | The number of row lines.                                                                     |


## Source For Components

+ [`<Grid />`](https://github.com/hshoff/vx/blob/master/packages/vx-grid/src/grids/Grid.js)
+ [`<Rows />`](https://github.com/hshoff/vx/blob/master/packages/vx-grid/src/grids/Rows.js)
+ [`<Columns />`](https://github.com/hshoff/vx/blob/master/packages/vx-grid/src/grids/Columns.js)
