# d3-delaunay

<p align="center"><img src="https://raw.githubusercontent.com/d3/d3-delaunay/master/img/voronator.jpg" width="300">
<p align="center">Georgy “The Voronator” Voronoy

This is a fast, no-dependency library for computing the [Voronoi diagram](https://en.wikipedia.org/wiki/Voronoi_diagram) of a set of two-dimensional points. It is based on [Delaunator](https://github.com/mapbox/delaunator), a fast library for computing the [Delaunay triangulation](https://en.wikipedia.org/wiki/Delaunay_triangulation) using [sweep algorithms](https://github.com/mapbox/delaunator/blob/master/README.md#papers). The Voronoi diagram is constructed by connecting the circumcenters of adjacent triangles in the Delaunay triangulation.

For an interactive explanation of how this library works, see [The Delaunay’s Dual](https://observablehq.com/@mbostock/the-delaunays-dual).

## Installing

To install, `npm install d3-delaunay` or `yarn add d3-delaunay`. You can also download the [latest release](https://github.com/d3/d3-delaunay/releases/latest) or load directly from [unpkg](https://unpkg.com/d3-delaunay/). AMD, CommonJS and ES6+ environments are supported. In vanilla, a `d3` global is exported.

```js
import {Delaunay} from "d3-delaunay";

const points = [[0, 0], [0, 1], [1, 0], [1, 1]];
const delaunay = Delaunay.from(points);
const voronoi = delaunay.voronoi([0, 0, 960, 500]);
```

## API Reference

### Delaunay

<a href="#new_Delaunay" name="new_Delaunay">#</a> new <b>Delaunay</b>(<i>points</i>) [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

Returns the Delaunay triangulation for the given flat array [*x0*, *y0*, *x1*, *y1*, …] of *points*.

```js
const delaunay = new Delaunay(Float64Array.of(0, 0, 0, 1, 1, 0, 1, 1));
```

<a href="#delaunay_from" name="delaunay_from">#</a> Delaunay.<b>from</b>(<i>points</i>[, <i>fx</i>[, <i>fy</i>[, <i>that</i>]]]) [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

Returns the Delaunay triangulation for the given array or iterable of *points*. If *fx* and *fy* are not specified, then *points* is assumed to be an array of two-element arrays of numbers: [[*x0*, *y0*], [*x1*, *y1*], …]. Otherwise, *fx* and *fy* are functions that are invoked for each element in the *points* array in order, and must return the respective *x*- and *y*-coordinate for each point. If *that* is specified, the functions *fx* and *fy* are invoked with *that* as *this*. (See [Array.from](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/from) for reference.)

```js
const delaunay = Delaunay.from([[0, 0], [0, 1], [1, 0], [1, 1]]);
```

<a href="#delaunay_points" name="delaunay_points">#</a> <i>delaunay</i>.<b>points</b>

The coordinates of the points as an array [*x0*, *y0*, *x1*, *y1*, …]. Typically, this is a Float64Array, however you can use any array-like type in the [constructor](#new_Delaunay).

<a href="#delaunay_halfedges" name="delaunay_halfedges">#</a> <i>delaunay</i>.<b>halfedges</b>

The halfedge indexes as an Int32Array [*j0*, *j1*, …]. For each index 0 ≤ *i* < *halfedges*.length, there is a halfedge from triangle vertex *j* = *halfedges*[*i*] to triangle vertex *i*. Equivalently, this means that triangle ⌊*i* / 3⌋ is adjacent to triangle ⌊*j* / 3⌋. If *j* is negative, then triangle ⌊*i* / 3⌋ is an exterior triangle on the [convex hull](#delaunay_hull). For example, to render the internal edges of the Delaunay triangulation:

```js
const {points, halfedges, triangles} = delaunay;
for (let i = 0, n = halfedges.length; i < n; ++i) {
  const j = halfedges[i];
  if (j < i) continue;
  const ti = triangles[i];
  const tj = triangles[j];
  context.moveTo(points[ti * 2], points[ti * 2 + 1]);
  context.lineTo(points[tj * 2], points[tj * 2 + 1]);
}
```

See also [*delaunay*.render](#delaunay_render).

<a href="#delaunay_hull" name="delaunay_hull">#</a> <i>delaunay</i>.<b>hull</b>

An Int32Array of point indexes that form the convex hull in counterclockwise order. If the points are collinear, returns them ordered.

See also [*delaunay*.renderHull](#delaunay_renderHull).

<a href="#delaunay_triangles" name="delaunay_triangles">#</a> <i>delaunay</i>.<b>triangles</b>

The triangle vertex indexes as an Uint32Array [*i0*, *j0*, *k0*, *i1*, *j1*, *k1*, …]. Each contiguous triplet of indexes *i*, *j*, *k* forms a counterclockwise triangle. The coordinates of the triangle’s points can be found by going through [*delaunay*.points](#delaunay_points). For example, to render triangle *i*:

```js
const {points, triangles} = delaunay;
const t0 = triangles[i * 3 + 0];
const t1 = triangles[i * 3 + 1];
const t2 = triangles[i * 3 + 2];
context.moveTo(points[t0 * 2], points[t0 * 2 + 1]);
context.lineTo(points[t1 * 2], points[t1 * 2 + 1]);
context.lineTo(points[t2 * 2], points[t2 * 2 + 1]);
context.closePath();
```

See also [*delaunay*.renderTriangle](#delaunay_renderTriangle).

<a href="#delaunay_inedges" name="delaunay_inedges">#</a> <i>delaunay</i>.<b>inedges</b>

The incoming halfedge indexes as a Int32Array [*e0*, *e1*, *e2*, …]. For each point *i*, *inedges*[*i*] is the halfedge index *e* of an incoming halfedge. For coincident points, the halfedge index is -1; for points on the convex hull, the incoming halfedge is on the convex hull; for other points, the choice of incoming halfedge is arbitrary. The *inedges* table can be used to traverse the Delaunay triangulation; see also [*delaunay*.neighbors](#delaunay_neighbors).

<a href="#delaunay_find" name="delaunay_find">#</a> <i>delaunay</i>.<b>find</b>(<i>x</i>, <i>y</i>[, <i>i</i>]) [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

Returns the index of the input point that is closest to the specified point ⟨*x*, *y*⟩. The search is started at the specified point *i*. If *i* is not specified, it defaults to zero.

<a href="#delaunay_neighbors" name="delaunay_neighbors">#</a> <i>delaunay</i>.<b>neighbors</b>(<i>i</i>) [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

Returns an iterable over the indexes of the neighboring points to the specified point *i*. The iterable is empty if *i* is a coincident point.

<a href="#delaunay_render" name="delaunay_render">#</a> <i>delaunay</i>.<b>render</b>([<i>context</i>]) [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

<img alt="delaunay.render" src="https://raw.githubusercontent.com/d3/d3-delaunay/master/img/delaunay-mesh.png">

Renders the edges of the Delaunay triangulation to the specified *context*. The specified *context* must implement the *context*.moveTo and *context*.lineTo methods from the [CanvasPathMethods API](https://www.w3.org/TR/2dcontext/#canvaspathmethods). If a *context* is not specified, an SVG path string is returned instead.

<a href="#delaunay_renderHull" name="delaunay_renderHull">#</a> <i>delaunay</i>.<b>renderHull</b>([<i>context</i>]) [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

<img alt="delaunay.renderHull" src="https://raw.githubusercontent.com/d3/d3-delaunay/master/img/delaunay-hull.png">

Renders the convex hull of the Delaunay triangulation to the specified *context*. The specified *context* must implement the *context*.moveTo and *context*.lineTo methods from the [CanvasPathMethods API](https://www.w3.org/TR/2dcontext/#canvaspathmethods). If a *context* is not specified, an SVG path string is returned instead.

<a href="#delaunay_renderTriangle" name="delaunay_renderTriangle">#</a> <i>delaunay</i>.<b>renderTriangle</b>(<i>i</i>[, <i>context</i>]) [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

<img alt="delaunay.renderTriangle" src="https://raw.githubusercontent.com/d3/d3-delaunay/master/img/delaunay-triangle.png">

Renders triangle *i* of the Delaunay triangulation to the specified *context*. The specified *context* must implement the *context*.moveTo, *context*.lineTo and *context*.closePath methods from the [CanvasPathMethods API](https://www.w3.org/TR/2dcontext/#canvaspathmethods). If a *context* is not specified, an SVG path string is returned instead.

<a href="#delaunay_renderPoints" name="delaunay_renderPoints">#</a> <i>delaunay</i>.<b>renderPoints</b>(\[<i>context</i>\]\[, <i>radius</i>\]) [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

Renders the input points of the Delaunay triangulation to the specified *context* as circles with the specified *radius*. If *radius* is not specified, it defaults to 2. The specified *context* must implement the *context*.moveTo and *context*.arc methods from the [CanvasPathMethods API](https://www.w3.org/TR/2dcontext/#canvaspathmethods). If a *context* is not specified, an SVG path string is returned instead.

<a href="#delaunay_hullPolygon" name="delaunay_hullPolygon">#</a> <i>delaunay</i>.<b>hullPolygon()</b> [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

Returns the closed polygon [[*x0*, *y0*], [*x1*, *y1*], …, [*x0*, *y0*]] representing the convex hull.

<a href="#delaunay_trianglePolygons" name="delaunay_trianglePolygons">#</a> <i>delaunay</i>.<b>trianglePolygons()</b> [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

Returns an iterable over the [polygons for each triangle](#delaunay_trianglePolygon), in order.

<a href="#delaunay_trianglePolygon" name="delaunay_trianglePolygon">#</a> <i>delaunay</i>.<b>trianglePolygon(<i>i</i>)</b> [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

Returns the closed polygon [[*x0*, *y0*], [*x1*, *y1*], [*x2*, *y2*], [*x0*, *y0*]] representing the triangle *i*.

<a href="#delaunay_update" name="delaunay_update">#</a> <i>delaunay</i>.<b>update</b>() [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

Updates the triangulation after the points have been modified in-place.

<a href="#delaunay_voronoi" name="delaunay_voronoi">#</a> <i>delaunay</i>.<b>voronoi</b>([<i>bounds</i>]) [<>](https://github.com/d3/d3-delaunay/blob/master/src/delaunay.js "Source")

Returns the [Voronoi diagram](#voronoi) for the associated [points](#delaunay_points). When rendering, the diagram will be clipped to the specified *bounds* = [*xmin*, *ymin*, *xmax*, *ymax*]. If *bounds* is not specified, it defaults to [0, 0, 960, 500]. See [To Infinity and Back Again](https://observablehq.com/@mbostock/to-infinity-and-back-again) for an interactive explanation of Voronoi cell clipping.

The Voronoi diagram is returned even in degenerate cases where no triangulation exists — namely 0, 1 or 2 points, and collinear points.

### Voronoi

<a href="#voronoi_delaunay" name="voronoi_delaunay">#</a> <i>voronoi</i>.<b>delaunay</b>

The Voronoi diagram’s associated [Delaunay triangulation](#delaunay).

<a href="#voronoi_circumcenters" name="voronoi_circumcenters">#</a> <i>voronoi</i>.<b>circumcenters</b>

The [circumcenters](http://mathworld.wolfram.com/Circumcenter.html) of the Delaunay triangles as a Float64Array [*cx0*, *cy0*, *cx1*, *cy1*, …]. Each contiguous pair of coordinates *cx*, *cy* is the circumcenter for the corresponding triangle. These circumcenters form the coordinates of the Voronoi cell polygons.

<a href="#voronoi_vectors" name="voronoi_vectors">#</a> <i>voronoi</i>.<b>vectors</b>

A Float64Array [*vx0*, *vy0*, *wx0*, *wy0*, …] where each non-zero quadruple describes an open (infinite) cell on the outer hull, giving the directions of two open half-lines.

<a href="#voronoi_xmin" name="voronoi_xmin">#</a> <i>voronoi</i>.<b>xmin</b><br>
<a href="#voronoi_ymin" name="voronoi_ymin">#</a> <i>voronoi</i>.<b>ymin</b><br>
<a href="#voronoi_xmax" name="voronoi_xmax">#</a> <i>voronoi</i>.<b>xmax</b><br>
<a href="#voronoi_ymax" name="voronoi_ymax">#</a> <i>voronoi</i>.<b>ymax</b><br>

The bounds of the viewport [*xmin*, *ymin*, *xmax*, *ymax*] for rendering the Voronoi diagram. These values only affect the rendering methods ([*voronoi*.render](#voronoi_render), [*voronoi*.renderBounds](#voronoi_renderBounds), [*cell*.render](#cell_render)).

<a href="#voronoi_contains" name="voronoi_contains">#</a> <i>voronoi</i>.<b>contains</b>(<i>i</i>, <i>x</i>, <i>y</i>) [<>](https://github.com/d3/d3-delaunay/blob/master/src/cell.js "Source")

Returns true if the cell with the specified index *i* contains the specified point ⟨*x*, *y*⟩. (This method is not affected by the associated Voronoi diagram’s viewport [bounds](#voronoi_xmin).)

<a href="#voronoi_neighbors" name="voronoi_neighbors">#</a> <i>voronoi</i>.<b>neighbors</b>(<i>i</i>) [<>](https://github.com/d3/d3-delaunay/blob/master/src/voronoi.js "Source")

Returns an iterable over the indexes of the cells that share a common edge with the specified cell *i*. Voronoi neighbors are always neighbors on the Delaunay graph, but the converse is false when the common edge has been clipped out by the Voronoi diagram’s viewport.

<a href="#voronoi_render" name="voronoi_render">#</a> <i>voronoi</i>.<b>render</b>([<i>context</i>]) [<>](https://github.com/d3/d3-delaunay/blob/master/src/voronoi.js "Source")

<img alt="voronoi.render" src="https://raw.githubusercontent.com/d3/d3-delaunay/master/img/voronoi-mesh.png">

Renders the mesh of Voronoi cells to the specified *context*. The specified *context* must implement the *context*.moveTo and *context*.lineTo methods from the [CanvasPathMethods API](https://www.w3.org/TR/2dcontext/#canvaspathmethods). If a *context* is not specified, an SVG path string is returned instead.

<a href="#voronoi_renderBounds" name="voronoi_renderBounds">#</a> <i>voronoi</i>.<b>renderBounds</b>([<i>context</i>]) [<>](https://github.com/d3/d3-delaunay/blob/master/src/voronoi.js "Source")

<img alt="voronoi.renderBounds" src="https://raw.githubusercontent.com/d3/d3-delaunay/master/img/voronoi-bounds.png">

Renders the viewport extent to the specified *context*. The specified *context* must implement the *context*.rect method from the [CanvasPathMethods API](https://www.w3.org/TR/2dcontext/#canvaspathmethods). Equivalent to *context*.rect(*voronoi*.xmin, *voronoi*.ymin, *voronoi*.xmax - *voronoi*.xmin, *voronoi*.ymax - *voronoi*.ymin). If a *context* is not specified, an SVG path string is returned instead.

<a href="#voronoi_renderCell" name="voronoi_renderCell">#</a> <i>voronoi</i>.<b>renderCell</b>(<i>i</i>[, <i>context</i>]) [<>](https://github.com/d3/d3-delaunay/blob/master/src/voronoi.js "Source")

<img alt="cell.render" src="https://raw.githubusercontent.com/d3/d3-delaunay/master/img/spectral.png">

Renders the cell with the specified index *i* to the specified *context*. The specified *context* must implement the *context*.moveTo , *context*.lineTo and *context*.closePath methods from the [CanvasPathMethods API](https://www.w3.org/TR/2dcontext/#canvaspathmethods). If a *context* is not specified, an SVG path string is returned instead.

<a href="#voronoi_cellPolygons" name="voronoi_cellPolygons">#</a> <i>voronoi</i>.<b>cellPolygons</b>() [<>](https://github.com/d3/d3-delaunay/blob/master/src/voronoi.js "Source")

Returns an iterable over the non-empty [polygons for each cell](#voronoi_cellPolygon), with the cell index as property.

<a href="#voronoi_cellPolygon" name="voronoi_cellPolygon">#</a> <i>voronoi</i>.<b>cellPolygon</b>(<i>i</i>) [<>](https://github.com/d3/d3-delaunay/blob/master/src/voronoi.js "Source")

Returns the convex, closed polygon [[*x0*, *y0*], [*x1*, *y1*], …, [*x0*, *y0*]] representing the cell for the specified point *i*.

<a href="#voronoi_update" name="voronoi_update">#</a> <i>voronoi</i>.<b>update</b>() [<>](https://github.com/d3/d3-delaunay/blob/master/src/voronoi.js "Source")

Updates the Voronoi diagram and underlying triangulation after the points have been modified in-place — useful for Lloyd’s relaxation.

