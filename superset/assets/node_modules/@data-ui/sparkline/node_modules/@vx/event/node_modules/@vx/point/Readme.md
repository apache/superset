# @vx/point

```
npm install --save @vx/point
```

A simple class to represent an x, y coordinate.

## Example Usage

```js
import { Point } from '@vx/point';

let point  = new Point({ x: 2, y: 3 });
let {x, y} = point.value()   // Get the cords from the point
let array  = point.toArray() // Convert point to array
```

## Methods

### `point.value()`

Returns an `{x, y}` object with the x and y coordinates.

### `point.toArray()`

Returns the coordinates as an array `[x, y]`.
