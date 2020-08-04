# vega-projection

Projections for cartographic mapping.

This package provides a [projection](#projection) method for managing registered cartographic projections. By default, the projection registry includes all projection types provided by the [d3-geo](https://github.com/d3/d3-geo) module.

## API Reference

<a name="projection" href="#projection">#</a>
vega.<b>projection</b>(<i>type</i>[, <i>projection</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-projection/src/projections.js "Source")

Registry function for adding and accessing projection constructor functions. The *type* argument is a String indicating the name of the projection type. If the *projection* argument is not specified, this method returns the matching projection constructor in the registry, or `null` if not found. If the *projection* argument is provided, it must be a projection constructor function to add to the registry under the given *type* name.

By default, the projection registry includes entries for all projection types provided by the [d3-geo](https://github.com/d3/d3-geo) module. Projections created using the constructor returned by this method are augmented with the following additional properties:

- `type`: A string value indicating the projection type.
- `path`: A D3 [geoPath](https://github.com/d3/d3-geo#geoPath) instance configured to use the projection. When using this path instance, be sure to set the [path context](https://github.com/d3/d3-geo#path_context) as needed.
- `copy`: A zero-argument function the produces a copy of the projection.


```js
// mercator projection
var mercator = vega.projection('mercator');
var proj = mercator().translate([400, 200]);
scale.type; // 'mercator'
scale([0, 0]); // [400, 200] center point
```
