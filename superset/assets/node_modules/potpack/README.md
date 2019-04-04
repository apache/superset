# potpack

A tiny JavaScript library for packing 2D rectangles into a near-square container,
which is useful for generating CSS sprites and WebGL textures. Similar to [shelf-pack](https://github.com/mapbox/shelf-pack),
but static (you can't add items once a layout is generated), and aims for maximal space utilization.

A variation of algorithms used in
[rectpack2D](https://github.com/TeamHypersomnia/rectpack2D) and
[bin-pack](https://github.com/bryanburgers/bin-pack),
which are in turn based on
[this article by Blackpawn](http://blackpawn.com/texts/lightmaps/default.html).

## [Demo](https://mapbox.github.io/potpack/)

## Example usage

```js
import potpack from 'potpack';

const boxes = [
    {w: 300, h: 50},
    {w: 100, h: 200},
    ...
];

const {w, h, fill} = potpack(boxes);
// w and h are resulting container's width and height;
// fill is the space utilization value (0 to 1), higher is better

// potpack mutates the boxes array: it's sorted by height,
// and box objects are augmented with x, y coordinates:
boxes[0]; // {w: 300, h: 50,  x: 100, y: 0}
boxes[1]; // {w: 100, h: 200, x: 0,   y: 0}
```

## Install

Install with NPM (`npm install potpack`) or Yarn (`yarn add potpack`), then:

```js
// import as an ES module
import potpack from 'potpack';

// or require in Node / Browserify
const potpack = require('potpack');
```

Or use a browser build directly:

```html
<script src="https://unpkg.com/potpack@1.0.0/index.js"></script>
```
