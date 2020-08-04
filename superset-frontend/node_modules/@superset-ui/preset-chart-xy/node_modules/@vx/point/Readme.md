# @vx/point

<a title="@vx/point npm downloads" href="https://www.npmjs.com/package/@vx/point">
  <img src="https://img.shields.io/npm/dm/@vx/point.svg?style=flat-square" />
</a>

```
npm install --save @vx/point
```

A simple class to represent an `x, y` coordinate.

## Example Usage

```js
import { Point } from '@vx/point';

const point = new Point({ x: 2, y: 3 });
const { x, y } = point.value(); // Get the coords as an object
const [x, y] = point.toArray(); // or array
```

## Methods

### `point.value()`

Returns an `{ x, y }` object with the x and y coordinates.

### `point.toArray()`

Returns the coordinates as an array `[x, y]`.
