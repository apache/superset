# Delaunator [![Build Status](https://travis-ci.org/mapbox/delaunator.svg?branch=master)](https://travis-ci.org/mapbox/delaunator) [![](https://img.shields.io/badge/simply-awesome-brightgreen.svg)](https://github.com/mourner/projects)

An incredibly fast JavaScript library for
[Delaunay triangulation](https://en.wikipedia.org/wiki/Delaunay_triangulation) of 2D points.

- [Interactive Demo](https://mapbox.github.io/delaunator/demo.html)
- [Guide to data structures](https://mapbox.github.io/delaunator/)

### Projects based on Delaunator

- [d3-delaunay](https://github.com/d3/d3-delaunay) for Voronoi diagrams, search, traversal and rendering.
- [d3-geo-voronoi](https://github.com/Fil/d3-geo-voronoi) for Delaunay triangulations and Voronoi diagrams on a sphere (e.g. for geographic locations).

### Ports to other languages

- [delaunator-rs](https://github.com/mourner/delaunator-rs) (Rust)
- [fogleman/delaunay](https://github.com/fogleman/delaunay) (Go)
- [delaunator-cpp](https://github.com/delfrrr/delaunator-cpp) (C++)

<img src="delaunator.png" alt="Delaunay triangulation example" width="600" />

## Example

```js
const points = [[168, 180], [168, 178], [168, 179], [168, 181], [168, 183], ...];

const delaunay = Delaunator.from(points);
console.log(delaunay.triangles);
// [623, 636, 619,  636, 444, 619, ...]
```

## Install

Install with NPM (`npm install delaunator`) or Yarn (`yarn add delaunator`), then:

```js
// import as an ES module
import Delaunator from 'delaunator';

// or require in Node / Browserify
const Delaunator = require('delaunator');
```

Or use a browser build directly:

```html
<script src="https://unpkg.com/delaunator@4.0.0/delaunator.min.js"></script> <!-- minified build -->
<script src="https://unpkg.com/delaunator@4.0.0/delaunator.js"></script> <!-- dev build -->
```

## API Reference

#### Delaunator.from(points[, getX, getY])

Constructs a delaunay triangulation object given an array of points (`[x, y]` by default).
`getX` and `getY` are optional functions of the form `(point) => value` for custom point formats.
Duplicate points are skipped.

#### new Delaunator(coords)

Constructs a delaunay triangulation object given an array of point coordinates of the form:
`[x0, y0, x1, y1, ...]` (use a typed array for best performance).

#### delaunay.triangles

A `Uint32Array` array of triangle vertex indices (each group of three numbers forms a triangle).
All triangles are directed counterclockwise.

To get the coordinates of all triangles, use:

```js
for (let i = 0; i < triangles.length; i += 3) {
    coordinates.push([
        points[triangles[i]],
        points[triangles[i + 1]],
        points[triangles[i + 2]]
    ]);
}
```

#### delaunay.halfedges

A `Int32Array` array of triangle half-edge indices that allows you to traverse the triangulation.
`i`-th half-edge in the array corresponds to vertex `triangles[i]` the half-edge is coming from.
`halfedges[i]` is the index of a twin half-edge in an adjacent triangle
(or `-1` for outer half-edges on the convex hull).

The flat array-based data structures might be counterintuitive,
but they're one of the key reasons this library is fast.

#### delaunay.hull

A `Uint32Array` array of indices that reference points on the convex hull of the input data, counter-clockwise.

#### delaunay.coords

An array of input coordinates in the form `[x0, y0, x1, y1, ....]`,
of the type provided in the constructor (or `Float64Array` if you used `Delaunator.from`).

#### delaunay.update()

Updates the triangulation if you modified `delaunay.coords` values in place, avoiding expensive memory allocations.
Useful for iterative relaxation algorithms such as [Lloyd's](https://en.wikipedia.org/wiki/Lloyd%27s_algorithm).

## Performance

Benchmark results against other Delaunay JS libraries
(`npm run bench` on Macbook Pro Retina 15" 2017, Node v10.10.0):

&nbsp; | uniform 100k | gauss 100k | grid 100k | degen 100k | uniform 1&nbsp;million | gauss 1&nbsp;million | grid 1&nbsp;million | degen 1&nbsp;million
:-- | --: | --: | --: | --: | --: | --: | --: | --:
**delaunator** | 82ms | 61ms | 66ms | 25ms | 1.07s | 950ms | 830ms | 278ms
[faster&#8209;delaunay](https://github.com/Bathlamos/delaunay-triangulation) | 473ms | 411ms | 272ms | 68ms | 4.27s | 4.62s | 4.3s | 810ms
[incremental&#8209;delaunay](https://github.com/mikolalysenko/incremental-delaunay) | 547ms | 505ms | 172ms | 528ms | 5.9s | 6.08s | 2.11s | 6.09s
[d3&#8209;voronoi](https://github.com/d3/d3-voronoi) | 972ms | 909ms | 358ms | 720ms | 15.04s | 13.86s | 5.55s | 11.13s
[delaunay&#8209;fast](https://github.com/ironwallaby/delaunay) | 3.8s | 4s | 12.57s | timeout | 132s | 138s | 399s | timeout
[delaunay](https://github.com/darkskyapp/delaunay) | 4.85s | 5.73s | 15.05s | timeout | 156s | 178s | 326s | timeout
[delaunay&#8209;triangulate](https://github.com/mikolalysenko/delaunay-triangulate) | 2.24s | 2.04s | OOM | 1.51s | OOM | OOM | OOM | OOM
[cdt2d](https://github.com/mikolalysenko/cdt2d) | 45s | 51s | 118s | 17s | timeout | timeout | timeout | timeout

## Papers

The algorithm is based on ideas from the following papers:

- [A simple sweep-line Delaunay triangulation algorithm](http://www.academicpub.org/jao/paperInfo.aspx?paperid=15630), 2013, Liu Yonghe, Feng Jinming and Shao Yuehong
- [S-hull: a fast radial sweep-hull routine for Delaunay triangulation](http://www.s-hull.org/paper/s_hull.pdf), 2010, David Sinclair
- [A faster circle-sweep Delaunay triangulation algorithm](http://cglab.ca/~biniaz/papers/Sweep%20Circle.pdf), 2011, Ahmad Biniaz and Gholamhossein Dastghaibyfard
