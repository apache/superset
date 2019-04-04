# geojson-types

Flow type declarations for [GeoJSON](https://tools.ietf.org/html/rfc7946).


## Install

```
npm install @mapbox/geojson-types
```

## Use

```js
// @flow

import type {
    GeoJSONFeatureCollection,
    GeoJSONFeature,

    // specific geometries
    GeoJSONPoint,
    GeoJSONLineString,
    GeoJSONPolygon,
    GeoJSONMultiPoint,
    GeoJSONMultiLineString,
    GeoJSONMultiPolygon,

    // any geometry
    GeoJSONGeometry,

    // any feature collection, feature, or geometry
    GeoJSON,
} from '@mapbox/geojson-types';

function doSomething(data: GeoJSON) {
    // ...
}
```


