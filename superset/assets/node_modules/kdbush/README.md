## KDBush [![Build Status](https://travis-ci.org/mourner/kdbush.svg?branch=master)](https://travis-ci.org/mourner/kdbush) [![Simply Awesome](https://img.shields.io/badge/simply-awesome-brightgreen.svg)](https://github.com/mourner/projects)

A very fast static spatial index for 2D points based on a flat KD-tree.
Compared to [RBush](https://github.com/mourner/rbush):

- points only — no rectangles
- static — you can't add/remove items
- indexing is 5-8 times faster

```js
const index = new KDBush(points);         // make an index
const ids1 = index.range(10, 10, 20, 20); // bbox search - minX, minY, maxX, maxY
const ids2 = index.within(10, 10, 5);     // radius search - x, y, radius
```

## Install

Install using NPM (`npm install kdbush`) or Yarn (`yarn add kdbush`), then:

```js
// import as a ES module
import KDBush from 'kdbush';

// or require in Node / Browserify
const KDBush = require('kdbush');
```

Or use a browser build directly:

```html
<script src="https://unpkg.com/kdbush@2.0.0/kdbush.min.js"></script>
```

## API

#### new KDBush(points[, getX, getY, nodeSize, arrayType])

Creates an index from the given points.

- `points`: Input array of points.
- `getX`, `getY`: Functions to get `x` and `y` from an input point. By default, it assumes `[x, y]` format.
- `nodeSize`: Size of the KD-tree node, `64` by default. Higher means faster indexing but slower search, and vise versa.
- `arrayType`: Array type to use for storing coordinate values. `Float64Array` by default, but if your coordinates are integer values, `Int32Array` makes things a bit faster.

```js
const index = kdbush(points, p => p.x, p => p.y, 64, Int32Array);
```

#### index.range(minX, minY, maxX, maxY)

Finds all items within the given bounding box and returns an array of indices that refer to the items in the original `points` input array.

```js
const results = index.range(10, 10, 20, 20).map(id => points[id]);
```

#### index.within(x, y, radius)

Finds all items within a given radius from the query point and returns an array of indices.

```js
const results = index.within(10, 10, 5).map(id => points[id]);
```
