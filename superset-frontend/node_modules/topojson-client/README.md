# TopoJSON Client

The **topojson-client** module provides tools for manipulating [TopoJSON](https://github.com/topojson/topojson), such as to [merge shapes](#merge) or [quantize coordinates](#quantize), and for converting back to [GeoJSON](#feature) for rendering with standard tools such as [d3.geoPath](https://github.com/d3/d3-geo/blob/master/README.md#geoPath). For example, [bl.ocks.org/3783604](https://bl.ocks.org/mbostock/3783604):

```html
<!DOCTYPE html>
<canvas width="960" height="600"></canvas>
<script src="https://d3js.org/d3.v4.min.js"></script>
<script src="https://unpkg.com/topojson-client@3"></script>
<script>

var context = d3.select("canvas").node().getContext("2d"),
    path = d3.geoPath().context(context);

d3.json("https://d3js.org/us-10m.v1.json", function(error, us) {
  if (error) throw error;

  context.beginPath();
  path(topojson.mesh(us));
  context.stroke();
});

</script>
```

## Installing

If you use NPM, `npm install topojson-client`. Otherwise, download the [latest release](https://github.com/topojson/topojson-client/releases/latest). You can also load directly from [UNPKG](https://unpkg.com) as a [standalone library](https://unpkg.com/topojson-client@3). AMD, CommonJS, and vanilla environments are supported. In vanilla, a `topojson` global is exported:

```html
<script src="https://unpkg.com/topojson-client@3"></script>
<script>

var feature = topojson.feature(topology, "foo");

</script>
```

The TopoJSON client API is implemented using ES2015 modules. In compatible environments, you can import the library as a namespace, like so:

```js
import * as topojson from "topojson-client";
```

[Try topojson-client in your browser.](https://runkit.com/npm/topojson-client)

# API Reference

<a name="feature" href="#feature">#</a> topojson.<b>feature</b>(<i>topology</i>, <i>object</i>) [<>](https://github.com/topojson/topojson-client/blob/master/src/feature.js "Source")

Returns the GeoJSON Feature or FeatureCollection for the specified *object* in the given *topology*. If the specified object is a string, it is treated as *topology*.objects[*object*]. Then, if the object is a GeometryCollection, a FeatureCollection is returned, and each geometry in the collection is mapped to a Feature. Otherwise, a Feature is returned. The returned feature is a shallow copy of the source *object*: they may share identifiers, bounding boxes, properties and coordinates.

Some examples:

* A point is mapped to a feature with a geometry object of type “Point”.
* Likewise for line strings, polygons, and other simple geometries.
* A null geometry object (of type null in TopoJSON) is mapped to a feature with a null geometry object.
* A geometry collection of points is mapped to a feature collection of features, each with a point geometry.
* A geometry collection of geometry collections is mapped to a feature collection of features, each with a geometry collection.

See [feature-test.js](https://github.com/topojson/topojson-client/blob/master/test/feature-test.js) for more examples.

<a name="merge" href="#merge">#</a> topojson.<b>merge</b>(<i>topology</i>, <i>objects</i>) [<>](https://github.com/topojson/topojson-client/blob/master/src/merge.js#L5 "Source")

Returns the GeoJSON MultiPolygon geometry object representing the union for the specified array of Polygon and MultiPolygon *objects* in the given *topology*. Interior borders shared by adjacent polygons are removed. See [Merging States](https://bl.ocks.org/mbostock/5416405) for an example. The returned geometry is a shallow copy of the source *object*: they may share coordinates.

<a name="mergeArcs" href="#mergeArcs">#</a> topojson.<b>mergeArcs</b>(<i>topology</i>, <i>objects</i>) [<>](https://github.com/topojson/topojson-client/blob/master/src/merge.js#L9 "Source")

Equivalent to [topojson.merge](#merge), but returns TopoJSON rather than GeoJSON. The returned geometry is a shallow copy of the source *object*: they may share coordinates.

<a name="mesh" href="#mesh">#</a> topojson.<b>mesh</b>(<i>topology</i>[, <i>object</i>[, <i>filter</i>]]) [<>](https://github.com/topojson/topojson-client/blob/master/src/mesh.js#L4 "Source")

Returns the GeoJSON MultiLineString geometry object representing the mesh for the specified *object* in the given *topology*. This is useful for rendering strokes in complicated objects efficiently, as edges that are shared by multiple features are only stroked once. If *object* is not specified, a mesh of the entire topology is returned. The returned geometry is a shallow copy of the source *object*: they may share coordinates.

An optional *filter* function may be specified to prune arcs from the returned mesh using the topology. The filter function is called once for each candidate arc and takes two arguments, *a* and *b*, two geometry objects that share that arc. Each arc is only included in the resulting mesh if the filter function returns true. For typical map topologies the geometries *a* and *b* are adjacent polygons and the candidate arc is their boundary. If an arc is only used by a single geometry then *a* and *b* are identical. This property is useful for separating interior and exterior boundaries; an easy way to produce a mesh of interior boundaries is:

```js
var interiors = topojson.mesh(topology, object, function(a, b) { return a !== b; });
```

See this [county choropleth](https://bl.ocks.org/mbostock/4060606) for example. Note: the *a* and *b* objects are TopoJSON objects (pulled directly from the topology), and not automatically converted to GeoJSON features as by [topojson.feature](#feature).

<a name="meshArcs" href="#meshArcs">#</a> topojson.<b>meshArcs</b>(<i>topology</i>[, <i>object</i>[, <i>filter</i>]]) [<>](https://github.com/topojson/topojson-client/blob/master/src/mesh.js#L8 "Source")

Equivalent to [topojson.mesh](#mesh), but returns TopoJSON rather than GeoJSON. The returned geometry is a shallow copy of the source *object*: they may share coordinates.

<a name="neighbors" href="#neighbors">#</a> topojson.<b>neighbors</b>(<i>objects</i>) [<>](https://github.com/topojson/topojson-client/blob/master/src/neighbors.js "Source")

Returns an array representing the set of neighboring objects for each object in the specified *objects* array. The returned array has the same number of elements as the input array; each element *i* in the returned array is the array of indexes for neighbors of object *i* in the input array. For example, if the specified objects array contains the features *foo* and *bar*, and these features are neighbors, the returned array will be \[\[1\], \[0\]\], indicating that *foo* is a neighbor of *bar* and *vice versa*. Each array of neighbor indexes for each object is guaranteed to be sorted in ascending order.

For a practical example, see the [world map](https://bl.ocks.org/mbostock/4180634) with topological coloring.

### Transforms

<a name="bbox" href="#bbox">#</a> topojson.<b>bbox</b>(<i>topology</i>) [<>](https://github.com/topojson/topojson-client/blob/master/src/bbox.js "Source")

Returns the computed [bounding box](https://github.com/topojson/topojson-specification#3-bounding-boxes) of the specified *topology* [*x*₀, *y*₀, *x*₁, *y*₁] where *x*₀ is the minimum *x*-value, *y*₀ is the minimum *y*-value, *x*₁ is the maximum *x*-value, and *y*₁ is the maximum *y*-value. If the *topology* has no points and no arcs, the returned bounding box is [∞, ∞, -∞, -∞]. (This method ignores the existing *topology*.bbox, if any.)

<a name="quantize" href="#quantize">#</a> topojson.<b>quantize</b>(<i>topology</i>, <i>transform</i>) [<>](https://github.com/topojson/topojson-client/blob/master/src/quantize.js "Source")

Returns a shallow copy of the specified *topology* with [quantized and delta-encoded](https://github.com/topojson/topojson-specification#213-arcs) arcs according to the specified [*transform* object](https://github.com/topojson/topojson-specification/blob/master/README.md#212-transforms). If the *topology* is already quantized, an error is thrown. See also [topoquantize](#topoquantize).

If a quantization number *n* is specified instead of a *transform* object, the corresponding transform object is first computed using the bounding box of the topology. In this case, the quantization number *n* must be a positive integer greater than one which determines the maximum number of expressible values per dimension in the resulting quantized coordinates; typically, a power of ten is chosen such as 1e4, 1e5 or 1e6. If the *topology* does not already have a *topology*.bbox, one is computed using [topojson.bbox](#bbox).

<a name="transform" href="#transform">#</a> topojson.<b>transform</b>(<i>transform</i>) [<>](https://github.com/topojson/topojson-client/blob/master/src/transform.js "Source")

If the specified [*transform* object](https://github.com/topojson/topojson-specification/blob/master/README.md#212-transforms) is non-null, returns a [point *transform* function](#_transform) to remove delta-encoding and apply the transform. If the *transform* is null, returns the identity function.

<a name="untransform" href="#untransform">#</a> topojson.<b>untransform</b>(<i>transform</i>) [<>](https://github.com/topojson/topojson-client/blob/master/src/untransform.js "Source")

If the specified [*transform* object](https://github.com/topojson/topojson-specification/blob/master/README.md#212-transforms) is non-null, returns a [point *transform* function](#_transform) to apply quantized delta-encoding and remove the transform. If the *transform* is null, returns the identity function. See also [topojson.quantize](#quantize).

<a name="_transform" href="#_transform">#</a> <i>transform</i>(<i>point</i>[, <i>index</i>])

Applies this transform function to the specified *point*, returning a new point with the transformed coordinates. If the specified *index* is truthy, the input *point* is treated as relative to the previous point passed to this transform, as is the case with delta-encoded arcs.

## Command Line Reference

### topo2geo

<a name="topo2geo" href="#topo2geo">#</a> <b>topo2geo</b> [<i>options…</i>] &lt;<i>name</i>=<i>file</i>&gt;… [<>](https://github.com/topojson/topojson-client/blob/master/bin/topo2geo "Source")

Converts one or more TopoJSON objects from an input topology to one or more GeoJSON features. For example, to convert the “states” TopoJSON GeometryCollection object in us.json to a GeoJSON feature collection in us-states.json:

```
topo2geo states=us-states.json < us.json
```

For convenience, you can omit the object name and specify only the file *name*; the object name will be the basename of the file, with the directory and extension removed. For example, to convert the “states” TopoJSON GeometryCollection object in us.json to a GeoJSON feature collection in states.json:

```
topo2geo states.json < us.json
```

See also [geo2topo](https://github.com/topojson/topojson/blob/master/README.md#geo2topo).

To list the available object names, use [--list](#topo2geo_list).

<a name="topo2geo_help" href="#topo2geo_help">#</a> topo2geo <b>-h</b>
<br><a href="#topo2geo_help">#</a> topo2geo <b>--help</b>

Output usage information.

<a name="topo2geo_version" href="#topo2geo_version">#</a> topo2geo <b>-V</b>
<br><a href="#topo2geo_version">#</a> topo2geo <b>--version</b>

Output the version number.

<a name="topo2geo_newline_delimited" href="#topo2geo_newline_delimited">#</a> topo2geo <b>-n</b>
<br><a href="#topo2geo_newline_delimited">#</a> topo2geo <b>--newline-delimited</b>

Output [newline-delimited JSON](http://ndjson.org/), with one feature per line.

<a name="topo2geo_in" href="#topo2geo_in">#</a> topo2geo <b>-i</b> <i>file</i>
<br><a href="#topo2geo_in">#</a> topo2geo <b>--in</b> <i>file</i>

Specify the input TopoJSON file name. Defaults to “-” for stdin.

<a name="topo2geo_list" href="#topo2geo_list">#</a> topo2geo <b>-l</b>
<br><a href="#topo2geo_list">#</a> topo2geo <b>--list</b>

List the names of the objects in the input topology, and then exit. For example, this:

```
topo2geo -l < us.json
```

Will output this:

```
counties
states
nation
```

### topomerge

<a name="topomerge" href="#topomerge">#</a> <b>topomerge</b> [<i>options…</i>] &lt;<i>target</i>=<i>source</i>&gt; [<i>file</i>] [<>](https://github.com/topojson/topojson-client/blob/master/bin/topomerge "Source")

Merges polygons (or meshes lines) from the specified *source* TopoJSON geometry collection object, assigning to the *target* object.

See also [topojson.mergeArcs](#mergeArcs) and [topojson.meshArcs](#meshArcs).

<a name="topomerge_help" href="#topomerge_help">#</a> topomerge <b>-h</b>
<br><a href="#topomerge_help">#</a> topomerge <b>--help</b>

Output usage information.

<a name="topomerge_version" href="#topomerge_version">#</a> topomerge <b>-V</b>
<br><a href="#topomerge_version">#</a> topomerge <b>--version</b>

Output the version number.

<a name="topomerge_out" href="#topomerge_out">#</a> topomerge <b>-o</b> <i>file</i>
<br><a href="#topomerge_out">#</a> topomerge <b>--out</b> <i>file</i>

Specify the output TopoJSON file name. Defaults to “-” for stdout.

<a name="topomerge_key" href="#topomerge_key">#</a> topomerge <b>-k</b> <i>expression</i>
<br><a href="#topomerge_key">#</a> topomerge <b>--key</b> <i>expression</i>

Specify a JavaScript *expression*, given a TopoJSON geometry object *d* and its zero-based index *i* in its parent collection, that determines how geometry objects are grouped before merging; each group is merged separately. For example, given a topology of U.S. *counties*, where the *id* of each county is it’s five-digit FIPS code, the county boundaries can be merged into state boundaries by using the first two digits of the county FIPS code, which represents the state FIPS code:

```
topomerge states=counties -k 'd.id.slice(0, 2)' < us-counties.json > us-states.json
```

If a key is not specified, all input geometry objects will be merged together. For example, this can be used to merge the state boundaries into a single nation boundary:

```
topomerge nation=states < us-states.json > us.json
```

<a name="topomerge_filter" href="#topomerge_filter">#</a> topomerge <b>-f</b> <i>expression</i>
<br><a href="#topomerge_filter">#</a> topomerge <b>--filter</b> <i>expression</i>

Specify a JavaScript *expression* that filters the input geometries before merging or meshing. In conjunction with [--mesh](#topomerge_mesh), the *expression* is given two TopoJSON geometry objects *a* and *b* that represent the adjacent features for a given arc segment; if the *expression* evaluates truthily, the associated arc segment is retained in mesh. Otherwise, the *expression* is given an input TopoJSON geometry object *d* and its zero-based index *i* in its parent collection; if the *expression* evaluates truthily, the geometry object is retained in the merged polygon.

<a name="topomerge_mesh" href="#topomerge_mesh">#</a> topomerge <b>--mesh</b>

Use [topojson.meshArcs](#meshArcs) instead of [topojson.mergeArcs](#mergeArcs), generating a geometry collection of lines rather than polygons.

### topoquantize

<a name="topoquantize" href="#topoquantize">#</a> <b>topoquantize</b> [<i>options…</i>] &lt;<i>n</i>&gt; [<i>file</i>] [<>](https://github.com/topojson/topojson-client/blob/master/bin/topoquantize "Source")

Quantizes the coordinates of the input TopoJSON topology and [delta-encodes](https://github.com/topojson/topojson-specification#213-arcs) the topology’s arcs. The quantization parameter *n* must be a positive integer greater than one, and determines the maximum expressible number of unique values per dimension in the resulting quantized coordinates; typically, a power of ten is chosen such as 1e4, 1e5 or 1e6. If the *topology* does not already have a [bbox](#bbox), one is computed and assigned. If the *topology* is already quantized, an error is thrown. See also [topojson.quantize](#quantize).

<a name="topoquantize_help" href="#topoquantize_help">#</a> topoquantize <b>-h</b>
<br><a href="#topoquantize_help">#</a> topoquantize <b>--help</b>

Output usage information.

<a name="topoquantize_version" href="#topoquantize_version">#</a> topoquantize <b>-V</b>
<br><a href="#topoquantize_version">#</a> topoquantize <b>--version</b>

Output the version number.

<a name="topoquantize_out" href="#topoquantize_out">#</a> topoquantize <b>-o</b> <i>file</i>
<br><a href="#topoquantize_out">#</a> topoquantize <b>--out</b> <i>file</i>

Specify the output TopoJSON file name. Defaults to “-” for stdout.
