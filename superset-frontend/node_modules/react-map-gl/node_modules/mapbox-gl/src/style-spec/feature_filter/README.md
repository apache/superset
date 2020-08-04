## Filter

Filter expressions are used to target specific data in a layer. This library implements the semantics specified by the [Mapbox GL JS spec](https://www.mapbox.com/mapbox-gl-style-spec/#filter).

### API

`featureFilter(filter)`

Given a filter expressed as nested arrays, return a new function
that evaluates whether a given feature (with a .properties or .tags property)
passes its test.

#### Parameters

| parameter | type  | description      |
| --------- | ----- | ---------------- |
| `filter`  | Array | mapbox gl filter |

**Returns** `Function`, filter-evaluating function

### Usage

``` javascript
var ff = require('@mapbox/mapbox-gl-style-spec').featureFilter;

// will match a feature with class of street_limited,
// AND an admin_level less than or equal to 3,
// that's NOT a polygon.
var filter = [
    "all",
    ["==", "class", "street_limited"],
    ["<=", "admin_level", 3],
    ["!=", "$type", "Polygon"]
]

// will match a feature that has a class of
// wetland OR wetland_noveg.
// ["in", "class", "wetland", "wetland_noveg"]

// testFilter will be a function that returns a boolean
var testFilter = ff(filter);

// Layer feature that you're testing. Must have type
// and properties keys.
var feature = {
    type: 2,
    properties: {
       class: "street_limited",
       admin_level: 1
    }
};

// will return a boolean based on whether the feature matched the filter
return testFilter({zoom: 0}, feature);
```
