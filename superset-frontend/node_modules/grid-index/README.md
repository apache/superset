# grid-index

GridIndex is a 2D spatial index that is [transferable](https://developer.mozilla.org/en-US/docs/Web/API/Transferable).

Pairs of keys and boxes can be inserted into GridIndex. The grid can then be queried to find all the keys that intersect a given box. The grid can be serialized to an ArrayBuffer so that it can be transferred between WebWorkers.

**You should probably use [rbush](https://github.com/mourner/rbush) instead of GridIndex!** It's easier to use and it's as fast or faster in many cases.

GridIndex can be faster in a specific set of cases:
- the constructed index needs to be transferred between workers
- the extent of the features is fixed
- features are somewhat evenly sized and distributed
- a high number of insertions relative to the number of queries

GridIndex is used by [mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js) for label collision detection and feature picking.

## Example

```js
var GridIndex = require('grid-index');

var grid = new GridIndex(100, 5, 0);
var key1 = 1;
var key2 = 2;
var key3 = 3;
grid.insert(key1, 30, 10, 35, 15);
grid.insert(key2, 60, 20, 65, 25);
grid.insert(key3, 40, 10, 45, 15);

var keys = grid.query(0, 0, 100, 13);
// `keys` is now [key1, key3]

var arrayBuffer = grid.toArrayBuffer();
// transfer the ArrayBuffer to a different worker

var grid2 = new GridIndex(arrayBuffer);
var keys2 = grid2.query(0, 0, 100, 13);
// `keys2` is now [key1, key3]
```

## API

### `GridIndex(extent, n, padding)`
Create a new GridIndex.

- **extent**: The width and height of the square area that needs to be indexed, for example `4096`.
- **n**: The rows and columns the grid will be split into. `4` would divide the grid into 16 cells.
- **padding**: The number of extra rows and columns that should be added on each side of the main grid square.


### `GridIndex(arrayBuffer)`
Unserialize a GridIndex.

- **arrayBuffer**: an ArrayBuffer produced by `gridIndex.toArrayBuffer()`.


### `gridIndex.insert(key, x1, y1, x2, y2)`

Insert a new key, box pair into the grid.

- **key**: An unsigned 32bit integer.
- **x1**: The x coordinate of the left edge of the box.
- **y1**: The y coordinate of the bottom edge of the box.
- **x2**: The x coordinate of the right edge of the box.
- **y2**: The y coordinate of the top edge of the box.


### `gridIndex.query(key, x1, y1, x2, y2, intersectionTest?)`

Find the keys that intersect with the given box.

- **x1**: The x coordinate of the left edge of the box.
- **y1**: The y coordinate of the bottom edge of the box.
- **x2**: The x coordinate of the right edge of the box.
- **y2**: The y coordinate of the top edge of the box.
- **intersectionTest**: An optional function that can be used to filter results by bbox. If provided, this function is called for each possible result with four arguments: x1, y1, x2, y2. Return true to include the result in the returned value.

**returns** an array of keys.


### `gridIndex.toArrayBuffer()`

Serialize a GridIndex to an ArrayBuffer so that it can be transferred between WebWorkers efficiently.

**returns** an ArrayBuffer that can later be deserialized with `new GridIndex(arrayBuffer)`.
