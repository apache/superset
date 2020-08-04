<img align="right" src="https://uber.github.io/img/h3Logo-color.svg" alt="H3 Logo" width="200">

# h3-js

[![H3 Version](https://img.shields.io/badge/h3_api-v3.6.2-blue.svg)](https://github.com/uber/h3/releases/tag/v3.6.2) [![Build Status](https://travis-ci.com/uber/h3-js.svg?branch=master)](https://travis-ci.com/uber/h3-js) [![Coverage Status](https://coveralls.io/repos/github/uber/h3-js/badge.svg?branch=master)](https://coveralls.io/github/uber/h3-js?branch=master)

The `h3-js` library provides a pure-JavaScript version of the [H3 Core Library](https://github.com/uber/h3), a hexagon-based geographic grid system. It can be used either in Node >= 6 or in the browser. The core library is transpiled from C using [emscripten](http://kripken.github.io/emscripten-site), offering full parity with the C API and highly efficient operations.

For more information on H3 and for the full API documentation, please see the [H3 Documentation](https://uber.github.io/h3/).

-   Post **bug reports or feature requests** to the [Github Issues page](https://github.com/uber/h3-js/issues)
-   Ask **questions** by posting to the [H3 tag on StackOverflow](https://stackoverflow.com/questions/tagged/h3)

## Install

    npm install h3-js

## Usage

The library uses ES6 modules. Bundles for Node and the browser are built to the `dist` folder.

### Import

ES6 usage:

```js
import {h3ToGeo} from "h3-js";
```

CommonJS usage:

```js
const h3 = require("h3-js");
```

Pre-bundled script (library is available as an `h3` global):

```html
<script src="https://unpkg.com/h3-js"></script>
```

### Core functions

```js
// Convert a lat/lng point to a hexagon index at resolution 7
const h3Index = h3.geoToH3(37.3615593, -122.0553238, 7);
// -> '87283472bffffff'

// Get the center of the hexagon
const hexCenterCoordinates = h3.h3ToGeo(h3Index);
// -> [37.35171820183272, -122.05032565263946]

// Get the vertices of the hexagon
const hexBoundary = h3.h3ToGeoBoundary(h3Index);
// -> [ [37.341099093235684, -122.04156135164334 ], ...]
```

### Useful algorithms

```js
// Get all neighbors within 1 step of the hexagon
const kRing = h3.kRing(h3Index, 1);
// -> ['87283472bffffff', '87283472affffff', ...]

// Get the set of hexagons within a polygon
const polygon = [
    [37.813318999983238, -122.4089866999972145],
    [37.7198061999978478, -122.3544736999993603],
    [37.8151571999998453, -122.4798767000009008]
];
const hexagons = h3.polyfill(polygon, 7);
// -> ['872830828ffffff', '87283082effffff', ...]

// Get the outline of a set of hexagons, as a GeoJSON-style MultiPolygon
const coordinates = h3.h3SetToMultiPolygon(hexagons, true);
// -> [[[
//      [-122.37681938644465, 37.76546768434345],
//      [-122.3856345540363,37.776004200673846],
//      ...
//    ]]]
```

## API Reference

<a name="module_h3"></a>

## h3

* [h3](#module_h3)
    * [.h3IsValid(h3Index)](#module_h3.h3IsValid) ⇒ <code>boolean</code>
    * [.h3IsPentagon(h3Index)](#module_h3.h3IsPentagon) ⇒ <code>boolean</code>
    * [.h3IsResClassIII(h3Index)](#module_h3.h3IsResClassIII) ⇒ <code>boolean</code>
    * [.h3GetBaseCell(h3Index)](#module_h3.h3GetBaseCell) ⇒ <code>number</code>
    * [.h3GetFaces(h3Index)](#module_h3.h3GetFaces) ⇒ <code>Array.&lt;number&gt;</code>
    * [.h3GetResolution(h3Index)](#module_h3.h3GetResolution) ⇒ <code>number</code>
    * [.geoToH3(lat, lng, res)](#module_h3.geoToH3) ⇒ <code>H3Index</code>
    * [.h3ToGeo(h3Index)](#module_h3.h3ToGeo) ⇒ <code>Array.&lt;number&gt;</code>
    * [.h3ToGeoBoundary(h3Index, [formatAsGeoJson])](#module_h3.h3ToGeoBoundary) ⇒ <code>Array.&lt;Array.&lt;number&gt;&gt;</code>
    * [.h3ToParent(h3Index, res)](#module_h3.h3ToParent) ⇒ <code>H3Index</code>
    * [.h3ToChildren(h3Index, res)](#module_h3.h3ToChildren) ⇒ <code>Array.&lt;H3Index&gt;</code>
    * [.h3ToCenterChild(h3Index, res)](#module_h3.h3ToCenterChild) ⇒ <code>H3Index</code>
    * [.kRing(h3Index, ringSize)](#module_h3.kRing) ⇒ <code>Array.&lt;H3Index&gt;</code>
    * [.kRingDistances(h3Index, ringSize)](#module_h3.kRingDistances) ⇒ <code>Array.&lt;Array.&lt;H3Index&gt;&gt;</code>
    * [.hexRing(h3Index, ringSize)](#module_h3.hexRing) ⇒ <code>Array.&lt;H3Index&gt;</code>
    * [.polyfill(coordinates, res, [isGeoJson])](#module_h3.polyfill) ⇒ <code>Array.&lt;H3Index&gt;</code>
    * [.h3SetToMultiPolygon(h3Indexes, [formatAsGeoJson])](#module_h3.h3SetToMultiPolygon) ⇒ <code>Array.&lt;Array.&lt;Array.&lt;Array.&lt;number&gt;&gt;&gt;&gt;</code>
    * [.compact(h3Set)](#module_h3.compact) ⇒ <code>Array.&lt;H3Index&gt;</code>
    * [.uncompact(compactedSet, res)](#module_h3.uncompact) ⇒ <code>Array.&lt;H3Index&gt;</code>
    * [.h3IndexesAreNeighbors(origin, destination)](#module_h3.h3IndexesAreNeighbors) ⇒ <code>boolean</code>
    * [.getH3UnidirectionalEdge(origin, destination)](#module_h3.getH3UnidirectionalEdge) ⇒ <code>H3Index</code>
    * [.getOriginH3IndexFromUnidirectionalEdge(edgeIndex)](#module_h3.getOriginH3IndexFromUnidirectionalEdge) ⇒ <code>H3Index</code>
    * [.getDestinationH3IndexFromUnidirectionalEdge(edgeIndex)](#module_h3.getDestinationH3IndexFromUnidirectionalEdge) ⇒ <code>H3Index</code>
    * [.h3UnidirectionalEdgeIsValid(edgeIndex)](#module_h3.h3UnidirectionalEdgeIsValid) ⇒ <code>boolean</code>
    * [.getH3IndexesFromUnidirectionalEdge(edgeIndex)](#module_h3.getH3IndexesFromUnidirectionalEdge) ⇒ <code>Array.&lt;H3Index&gt;</code>
    * [.getH3UnidirectionalEdgesFromHexagon(h3Index)](#module_h3.getH3UnidirectionalEdgesFromHexagon) ⇒ <code>Array.&lt;H3Index&gt;</code>
    * [.getH3UnidirectionalEdgeBoundary(edgeIndex, [formatAsGeoJson])](#module_h3.getH3UnidirectionalEdgeBoundary) ⇒ <code>Array.&lt;Array.&lt;number&gt;&gt;</code>
    * [.h3Distance(origin, destination)](#module_h3.h3Distance) ⇒ <code>number</code>
    * [.h3Line(origin, destination)](#module_h3.h3Line) ⇒ <code>Array.&lt;H3Index&gt;</code>
    * [.experimentalH3ToLocalIj(origin, destination)](#module_h3.experimentalH3ToLocalIj) ⇒ <code>CoordIJ</code>
    * [.experimentalLocalIjToH3(origin, coords)](#module_h3.experimentalLocalIjToH3) ⇒ <code>H3Index</code>
    * [.hexArea(res, unit)](#module_h3.hexArea) ⇒ <code>number</code>
    * [.edgeLength(res, unit)](#module_h3.edgeLength) ⇒ <code>number</code>
    * [.numHexagons(res)](#module_h3.numHexagons) ⇒ <code>number</code>
    * [.getRes0Indexes()](#module_h3.getRes0Indexes) ⇒ <code>Array.&lt;H3Index&gt;</code>
    * [.getPentagonIndexes(res)](#module_h3.getPentagonIndexes) ⇒ <code>Array.&lt;H3Index&gt;</code>
    * [.degsToRads(deg)](#module_h3.degsToRads) ⇒ <code>number</code>
    * [.radsToDegs(rad)](#module_h3.radsToDegs) ⇒ <code>number</code>
    * [.H3Index](#module_h3.H3Index) : <code>string</code>
    * [.CoordIJ](#module_h3.CoordIJ) : <code>Object</code>


* * *

<a name="module_h3.h3IsValid"></a>

### h3.h3IsValid(h3Index) ⇒ <code>boolean</code>
Whether a given string represents a valid H3 index

**Returns**: <code>boolean</code> - Whether the index is valid  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index to check |


* * *

<a name="module_h3.h3IsPentagon"></a>

### h3.h3IsPentagon(h3Index) ⇒ <code>boolean</code>
Whether the given H3 index is a pentagon

**Returns**: <code>boolean</code> - isPentagon  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index to check |


* * *

<a name="module_h3.h3IsResClassIII"></a>

### h3.h3IsResClassIII(h3Index) ⇒ <code>boolean</code>
Whether the given H3 index is in a Class III resolution (rotated versus
the icosahedron and subject to shape distortion adding extra points on
icosahedron edges, making them not true hexagons).

**Returns**: <code>boolean</code> - isResClassIII  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index to check |


* * *

<a name="module_h3.h3GetBaseCell"></a>

### h3.h3GetBaseCell(h3Index) ⇒ <code>number</code>
Get the number of the base cell for a given H3 index

**Returns**: <code>number</code> - Index of the base cell (0-121)  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index to get the base cell for |


* * *

<a name="module_h3.h3GetFaces"></a>

### h3.h3GetFaces(h3Index) ⇒ <code>Array.&lt;number&gt;</code>
Get the indices of all icosahedron faces intersected by a given H3 index

**Returns**: <code>Array.&lt;number&gt;</code> - Indices (0-19) of all intersected faces  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index to get faces for |


* * *

<a name="module_h3.h3GetResolution"></a>

### h3.h3GetResolution(h3Index) ⇒ <code>number</code>
Returns the resolution of an H3 index

**Returns**: <code>number</code> - The number (0-15) resolution, or -1 if invalid  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index to get resolution |


* * *

<a name="module_h3.geoToH3"></a>

### h3.geoToH3(lat, lng, res) ⇒ <code>H3Index</code>
Get the hexagon containing a lat,lon point

**Returns**: <code>H3Index</code> - H3 index  

| Param | Type | Description |
| --- | --- | --- |
| lat | <code>number</code> | Latitude of point |
| lng | <code>number</code> | Longtitude of point |
| res | <code>number</code> | Resolution of hexagons to return |


* * *

<a name="module_h3.h3ToGeo"></a>

### h3.h3ToGeo(h3Index) ⇒ <code>Array.&lt;number&gt;</code>
Get the lat,lon center of a given hexagon

**Returns**: <code>Array.&lt;number&gt;</code> - Point as a [lat, lng] pair  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index |


* * *

<a name="module_h3.h3ToGeoBoundary"></a>

### h3.h3ToGeoBoundary(h3Index, [formatAsGeoJson]) ⇒ <code>Array.&lt;Array.&lt;number&gt;&gt;</code>
Get the vertices of a given hexagon (or pentagon), as an array of [lat, lng]
points. For pentagons and hexagons on the edge of an icosahedron face, this
function may return up to 10 vertices.

**Returns**: <code>Array.&lt;Array.&lt;number&gt;&gt;</code> - Array of [lat, lng] pairs  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index |
| [formatAsGeoJson] | <code>boolean</code> | Whether to provide GeoJSON output: [lng, lat], closed loops |


* * *

<a name="module_h3.h3ToParent"></a>

### h3.h3ToParent(h3Index, res) ⇒ <code>H3Index</code>
Get the parent of the given hexagon at a particular resolution

**Returns**: <code>H3Index</code> - H3 index of parent, or null for invalid input  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index to get parent for |
| res | <code>number</code> | Resolution of hexagon to return |


* * *

<a name="module_h3.h3ToChildren"></a>

### h3.h3ToChildren(h3Index, res) ⇒ <code>Array.&lt;H3Index&gt;</code>
Get the children/descendents of the given hexagon at a particular resolution

**Returns**: <code>Array.&lt;H3Index&gt;</code> - H3 indexes of children, or empty array for invalid input  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index to get children for |
| res | <code>number</code> | Resolution of hexagons to return |


* * *

<a name="module_h3.h3ToCenterChild"></a>

### h3.h3ToCenterChild(h3Index, res) ⇒ <code>H3Index</code>
Get the center child of the given hexagon at a particular resolution

**Returns**: <code>H3Index</code> - H3 index of child, or null for invalid input  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index to get center child for |
| res | <code>number</code> | Resolution of hexagon to return |


* * *

<a name="module_h3.kRing"></a>

### h3.kRing(h3Index, ringSize) ⇒ <code>Array.&lt;H3Index&gt;</code>
Get all hexagons in a k-ring around a given center. The order of the hexagons is undefined.

**Returns**: <code>Array.&lt;H3Index&gt;</code> - H3 indexes for all hexagons in ring  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index of center hexagon |
| ringSize | <code>number</code> | Radius of k-ring |


* * *

<a name="module_h3.kRingDistances"></a>

### h3.kRingDistances(h3Index, ringSize) ⇒ <code>Array.&lt;Array.&lt;H3Index&gt;&gt;</code>
Get all hexagons in a k-ring around a given center, in an array of arrays
ordered by distance from the origin. The order of the hexagons within each ring is undefined.

**Returns**: <code>Array.&lt;Array.&lt;H3Index&gt;&gt;</code> - Array of arrays with H3 indexes for all hexagons each ring  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index of center hexagon |
| ringSize | <code>number</code> | Radius of k-ring |


* * *

<a name="module_h3.hexRing"></a>

### h3.hexRing(h3Index, ringSize) ⇒ <code>Array.&lt;H3Index&gt;</code>
Get all hexagons in a hollow hexagonal ring centered at origin with sides of a given length.
Unlike kRing, this function will throw an error if there is a pentagon anywhere in the ring.

**Returns**: <code>Array.&lt;H3Index&gt;</code> - H3 indexes for all hexagons in ring  
**Throws**:

- <code>Error</code> If the algorithm could not calculate the ring


| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index of center hexagon |
| ringSize | <code>number</code> | Radius of ring |


* * *

<a name="module_h3.polyfill"></a>

### h3.polyfill(coordinates, res, [isGeoJson]) ⇒ <code>Array.&lt;H3Index&gt;</code>
Get all hexagons with centers contained in a given polygon. The polygon
is specified with GeoJson semantics as an array of loops. Each loop is
an array of [lat, lng] pairs (or [lng, lat] if isGeoJson is specified).
The first loop is the perimeter of the polygon, and subsequent loops are
expected to be holes.

**Returns**: <code>Array.&lt;H3Index&gt;</code> - H3 indexes for all hexagons in polygon  

| Param | Type | Description |
| --- | --- | --- |
| coordinates | <code>Array.&lt;Array.&lt;number&gt;&gt;</code> \| <code>Array.&lt;Array.&lt;Array.&lt;number&gt;&gt;&gt;</code> | Array of loops, or a single loop |
| res | <code>number</code> | Resolution of hexagons to return |
| [isGeoJson] | <code>boolean</code> | Whether to expect GeoJson-style [lng, lat]                                  pairs instead of [lat, lng] |


* * *

<a name="module_h3.h3SetToMultiPolygon"></a>

### h3.h3SetToMultiPolygon(h3Indexes, [formatAsGeoJson]) ⇒ <code>Array.&lt;Array.&lt;Array.&lt;Array.&lt;number&gt;&gt;&gt;&gt;</code>
Get the outlines of a set of H3 hexagons, returned in GeoJSON MultiPolygon
format (an array of polygons, each with an array of loops, each an array of
coordinates). Coordinates are returned as [lat, lng] pairs unless GeoJSON
is requested.

**Returns**: <code>Array.&lt;Array.&lt;Array.&lt;Array.&lt;number&gt;&gt;&gt;&gt;</code> - MultiPolygon-style output.  

| Param | Type | Description |
| --- | --- | --- |
| h3Indexes | <code>Array.&lt;H3Index&gt;</code> | H3 indexes to get outlines for |
| [formatAsGeoJson] | <code>boolean</code> | Whether to provide GeoJSON output:                                    [lng, lat], closed loops |


* * *

<a name="module_h3.compact"></a>

### h3.compact(h3Set) ⇒ <code>Array.&lt;H3Index&gt;</code>
Compact a set of hexagons of the same resolution into a set of hexagons across
multiple levels that represents the same area.

**Returns**: <code>Array.&lt;H3Index&gt;</code> - Compacted H3 indexes  
**Throws**:

- <code>Error</code> If the input is invalid (e.g. duplicate hexagons)


| Param | Type | Description |
| --- | --- | --- |
| h3Set | <code>Array.&lt;H3Index&gt;</code> | H3 indexes to compact |


* * *

<a name="module_h3.uncompact"></a>

### h3.uncompact(compactedSet, res) ⇒ <code>Array.&lt;H3Index&gt;</code>
Uncompact a compacted set of hexagons to hexagons of the same resolution

**Returns**: <code>Array.&lt;H3Index&gt;</code> - The uncompacted H3 indexes  
**Throws**:

- <code>Error</code> If the input is invalid (e.g. invalid resolution)


| Param | Type | Description |
| --- | --- | --- |
| compactedSet | <code>Array.&lt;H3Index&gt;</code> | H3 indexes to uncompact |
| res | <code>number</code> | The resolution to uncompact to |


* * *

<a name="module_h3.h3IndexesAreNeighbors"></a>

### h3.h3IndexesAreNeighbors(origin, destination) ⇒ <code>boolean</code>
Whether two H3 indexes are neighbors (share an edge)

**Returns**: <code>boolean</code> - Whether the hexagons share an edge  

| Param | Type | Description |
| --- | --- | --- |
| origin | <code>H3Index</code> | Origin hexagon index |
| destination | <code>H3Index</code> | Destination hexagon index |


* * *

<a name="module_h3.getH3UnidirectionalEdge"></a>

### h3.getH3UnidirectionalEdge(origin, destination) ⇒ <code>H3Index</code>
Get an H3 index representing a unidirectional edge for a given origin and destination

**Returns**: <code>H3Index</code> - H3 index of the edge, or null if no edge is shared  

| Param | Type | Description |
| --- | --- | --- |
| origin | <code>H3Index</code> | Origin hexagon index |
| destination | <code>H3Index</code> | Destination hexagon index |


* * *

<a name="module_h3.getOriginH3IndexFromUnidirectionalEdge"></a>

### h3.getOriginH3IndexFromUnidirectionalEdge(edgeIndex) ⇒ <code>H3Index</code>
Get the origin hexagon from an H3 index representing a unidirectional edge

**Returns**: <code>H3Index</code> - H3 index of the edge origin  

| Param | Type | Description |
| --- | --- | --- |
| edgeIndex | <code>H3Index</code> | H3 index of the edge |


* * *

<a name="module_h3.getDestinationH3IndexFromUnidirectionalEdge"></a>

### h3.getDestinationH3IndexFromUnidirectionalEdge(edgeIndex) ⇒ <code>H3Index</code>
Get the destination hexagon from an H3 index representing a unidirectional edge

**Returns**: <code>H3Index</code> - H3 index of the edge destination  

| Param | Type | Description |
| --- | --- | --- |
| edgeIndex | <code>H3Index</code> | H3 index of the edge |


* * *

<a name="module_h3.h3UnidirectionalEdgeIsValid"></a>

### h3.h3UnidirectionalEdgeIsValid(edgeIndex) ⇒ <code>boolean</code>
Whether the input is a valid unidirectional edge

**Returns**: <code>boolean</code> - Whether the index is valid  

| Param | Type | Description |
| --- | --- | --- |
| edgeIndex | <code>H3Index</code> | H3 index of the edge |


* * *

<a name="module_h3.getH3IndexesFromUnidirectionalEdge"></a>

### h3.getH3IndexesFromUnidirectionalEdge(edgeIndex) ⇒ <code>Array.&lt;H3Index&gt;</code>
Get the [origin, destination] pair represented by a unidirectional edge

**Returns**: <code>Array.&lt;H3Index&gt;</code> - [origin, destination] pair as H3 indexes  

| Param | Type | Description |
| --- | --- | --- |
| edgeIndex | <code>H3Index</code> | H3 index of the edge |


* * *

<a name="module_h3.getH3UnidirectionalEdgesFromHexagon"></a>

### h3.getH3UnidirectionalEdgesFromHexagon(h3Index) ⇒ <code>Array.&lt;H3Index&gt;</code>
Get all of the unidirectional edges with the given H3 index as the origin (i.e. an edge to
every neighbor)

**Returns**: <code>Array.&lt;H3Index&gt;</code> - List of unidirectional edges  

| Param | Type | Description |
| --- | --- | --- |
| h3Index | <code>H3Index</code> | H3 index of the origin hexagon |


* * *

<a name="module_h3.getH3UnidirectionalEdgeBoundary"></a>

### h3.getH3UnidirectionalEdgeBoundary(edgeIndex, [formatAsGeoJson]) ⇒ <code>Array.&lt;Array.&lt;number&gt;&gt;</code>
Get the vertices of a given edge as an array of [lat, lng] points. Note that for edges that
cross the edge of an icosahedron face, this may return 3 coordinates.

**Returns**: <code>Array.&lt;Array.&lt;number&gt;&gt;</code> - Array of geo coordinate pairs  

| Param | Type | Description |
| --- | --- | --- |
| edgeIndex | <code>H3Index</code> | H3 index of the edge |
| [formatAsGeoJson] | <code>boolean</code> | Whether to provide GeoJSON output: [lng, lat] |


* * *

<a name="module_h3.h3Distance"></a>

### h3.h3Distance(origin, destination) ⇒ <code>number</code>
Get the grid distance between two hex indexes. This function may fail
to find the distance between two indexes if they are very far apart or
on opposite sides of a pentagon.

**Returns**: <code>number</code> - Distance between hexagons, or a negative
                              number if the distance could not be computed  

| Param | Type | Description |
| --- | --- | --- |
| origin | <code>H3Index</code> | Origin hexagon index |
| destination | <code>H3Index</code> | Destination hexagon index |


* * *

<a name="module_h3.h3Line"></a>

### h3.h3Line(origin, destination) ⇒ <code>Array.&lt;H3Index&gt;</code>
Given two H3 indexes, return the line of indexes between them (inclusive).

This function may fail to find the line between two indexes, for
example if they are very far apart. It may also fail when finding
distances for indexes on opposite sides of a pentagon.

Notes:

 - The specific output of this function should not be considered stable
   across library versions. The only guarantees the library provides are
   that the line length will be `h3Distance(start, end) + 1` and that
   every index in the line will be a neighbor of the preceding index.
 - Lines are drawn in grid space, and may not correspond exactly to either
   Cartesian lines or great arcs.

**Returns**: <code>Array.&lt;H3Index&gt;</code> - H3 indexes connecting origin and destination  
**Throws**:

- <code>Error</code> If the line cannot be calculated


| Param | Type | Description |
| --- | --- | --- |
| origin | <code>H3Index</code> | Origin hexagon index |
| destination | <code>H3Index</code> | Destination hexagon index |


* * *

<a name="module_h3.experimentalH3ToLocalIj"></a>

### h3.experimentalH3ToLocalIj(origin, destination) ⇒ <code>CoordIJ</code>
Produces IJ coordinates for an H3 index anchored by an origin.

- The coordinate space used by this function may have deleted
regions or warping due to pentagonal distortion.
- Coordinates are only comparable if they come from the same
origin index.
- Failure may occur if the index is too far away from the origin
or if the index is on the other side of a pentagon.
- This function is experimental, and its output is not guaranteed
to be compatible across different versions of H3.

**Returns**: <code>CoordIJ</code> - Coordinates as an `{i, j}` pair  
**Throws**:

- <code>Error</code> If the IJ coordinates cannot be calculated


| Param | Type | Description |
| --- | --- | --- |
| origin | <code>H3Index</code> | Origin H3 index |
| destination | <code>H3Index</code> | H3 index for which to find relative coordinates |


* * *

<a name="module_h3.experimentalLocalIjToH3"></a>

### h3.experimentalLocalIjToH3(origin, coords) ⇒ <code>H3Index</code>
Produces an H3 index for IJ coordinates anchored by an origin.

- The coordinate space used by this function may have deleted
regions or warping due to pentagonal distortion.
- Coordinates are only comparable if they come from the same
origin index.
- Failure may occur if the index is too far away from the origin
or if the index is on the other side of a pentagon.
- This function is experimental, and its output is not guaranteed
to be compatible across different versions of H3.

**Returns**: <code>H3Index</code> - H3 index at the relative coordinates  
**Throws**:

- <code>Error</code> If the H3 index cannot be calculated


| Param | Type | Description |
| --- | --- | --- |
| origin | <code>H3Index</code> | Origin H3 index |
| coords | <code>CoordIJ</code> | Coordinates as an `{i, j}` pair |


* * *

<a name="module_h3.hexArea"></a>

### h3.hexArea(res, unit) ⇒ <code>number</code>
Average hexagon area at a given resolution

**Returns**: <code>number</code> - Average area  
**Throws**:

- <code>Error</code> If the unit is invalid


| Param | Type | Description |
| --- | --- | --- |
| res | <code>number</code> | Hexagon resolution |
| unit | <code>string</code> | Area unit (either UNITS.m2 or UNITS.km2) |


* * *

<a name="module_h3.edgeLength"></a>

### h3.edgeLength(res, unit) ⇒ <code>number</code>
Average hexagon edge length at a given resolution

**Returns**: <code>number</code> - Average edge length  
**Throws**:

- <code>Error</code> If the unit is invalid


| Param | Type | Description |
| --- | --- | --- |
| res | <code>number</code> | Hexagon resolution |
| unit | <code>string</code> | Area unit (either UNITS.m or UNITS.km) |


* * *

<a name="module_h3.numHexagons"></a>

### h3.numHexagons(res) ⇒ <code>number</code>
The total count of hexagons in the world at a given resolution. Note that above
resolution 8 the exact count cannot be represented in a JavaScript 32-bit number,
so consumers should use caution when applying further operations to the output.

**Returns**: <code>number</code> - Count  

| Param | Type | Description |
| --- | --- | --- |
| res | <code>number</code> | Hexagon resolution |


* * *

<a name="module_h3.getRes0Indexes"></a>

### h3.getRes0Indexes() ⇒ <code>Array.&lt;H3Index&gt;</code>
Get all H3 indexes at resolution 0. As every index at every resolution > 0 is
the descendant of a res 0 index, this can be used with h3ToChildren to iterate
over H3 indexes at any resolution.

**Returns**: <code>Array.&lt;H3Index&gt;</code> - All H3 indexes at res 0  

* * *

<a name="module_h3.getPentagonIndexes"></a>

### h3.getPentagonIndexes(res) ⇒ <code>Array.&lt;H3Index&gt;</code>
Get the twelve pentagon indexes at a given resolution.

**Returns**: <code>Array.&lt;H3Index&gt;</code> - All H3 pentagon indexes at res  

| Param | Type | Description |
| --- | --- | --- |
| res | <code>number</code> | Hexagon resolution |


* * *

<a name="module_h3.degsToRads"></a>

### h3.degsToRads(deg) ⇒ <code>number</code>
Convert degrees to radians

**Returns**: <code>number</code> - Value in radians  

| Param | Type | Description |
| --- | --- | --- |
| deg | <code>number</code> | Value in degrees |


* * *

<a name="module_h3.radsToDegs"></a>

### h3.radsToDegs(rad) ⇒ <code>number</code>
Convert radians to degrees

**Returns**: <code>number</code> - Value in degrees  

| Param | Type | Description |
| --- | --- | --- |
| rad | <code>number</code> | Value in radians |


* * *

<a name="module_h3.H3Index"></a>

### h3.H3Index : <code>string</code>
64-bit hexidecimal string representation of an H3 index


* * *

<a name="module_h3.CoordIJ"></a>

### h3.CoordIJ : <code>Object</code>
Coordinates as an `{i, j}` pair

**Properties**

| Name | Type |
| --- | --- |
| i | <code>number</code> | 
| j | <code>number</code> | 


* * *


## Development

The `h3-js` library uses `yarn` as the preferred package manager. To install the dev dependencies, just run:

    yarn

To lint the code:

    yarn lint

To run the tests:

    yarn test

Code must be formatted with `prettier`; unformatted code will fail the build. To format all files:

    yarn prettier

### Benchmarks

The `h3-js` library includes a basic benchmark suite using [Benchmark.js](https://benchmarkjs.com/). Because many of the functions may be called over thousands of hexagons in a "hot loop", performance is an important concern. Benchmarks are run against the transpiled ES5 code by default.

To run the benchmarks in Node:

    yarn benchmark-node

To run the benchmarks in a browser:

    yarn benchmark-browser

Sample Node output (Macbook Pro running Node 6):

```
h3IsValid x 3,725,046 ops/sec ±0.47% (90 runs sampled)
geoToH3 x 227,458 ops/sec ±0.84% (89 runs sampled)
h3ToGeo x 843,167 ops/sec ±0.96% (87 runs sampled)
h3ToGeoBoundary x 220,797 ops/sec ±2.56% (86 runs sampled)
kRing x 144,955 ops/sec ±3.06% (85 runs sampled)
polyfill x 9,291 ops/sec ±1.12% (88 runs sampled)
h3SetToMultiPolygon x 311 ops/sec ±1.56% (82 runs sampled)
compact x 1,336 ops/sec ±4.51% (86 runs sampled)
uncompact x 574 ops/sec ±0.91% (85 runs sampled)
h3IndexesAreNeighbors x 670,031 ops/sec ±1.36% (88 runs sampled)
getH3UnidirectionalEdge x 356,089 ops/sec ±1.17% (85 runs sampled)
getOriginH3IndexFromUnidirectionalEdge x 1,052,652 ops/sec ±0.54% (89 runs sampled)
getDestinationH3IndexFromUnidirectionalEdge x 891,680 ops/sec ±0.90% (91 runs sampled)
h3UnidirectionalEdgeIsValid x 3,551,111 ops/sec ±0.69% (85 runs sampled)
```

When making code changes that may affect performance, please run benchmarks against `master` and then against your branch to identify any regressions.

### Transpiling the C Source

The core library is transpiled using [emscripten](http://kripken.github.io/emscripten-site). The easiest way to build from source locally is by using Docker. Make sure Docker is installed, then:

    yarn docker-boot
    yarn build-emscripten

The build script uses the `H3_VERSION` file to determine the version of the core library to build. To use a different version of the library (e.g. to test local changes), clone the desired H3 repo to `./h3c` and then run `yarn docker-emscripten`.

## Contributing

Pull requests and [Github issues](https://github.com/uber/h3-js/issues) are welcome. Please include tests for new work, and keep the library test coverage at 100%. Please note that the purpose of this module is to expose the API of the [H3 Core library](https://github.com/uber/h3), so we will rarely accept new features that are not part of that API. New proposed feature work is more appropriate in the core C library or in a new JS library that depends on `h3-js`.

Before we can merge your changes, you must agree to the [Uber Contributor License Agreement](http://cla-assistant.io/uber/h3-js).

## Versioning

The [H3 core library](https://github.com/uber/h3) adheres to [Semantic Versioning](http://semver.org/). The `h3-js` library has a `major.minor.patch` version scheme. The major and minor version numbers of `h3-js` are the major and minor version of the bound core library, respectively. The patch version is incremented independently of the core library.

## Legal and Licensing

The `h3-js` library is licensed under the [Apache 2.0 License](https://github.com/uber/h3-js/blob/master/LICENSE).

DGGRID Copyright (c) 2015 Southern Oregon University
