[![Build Status](https://travis-ci.org/mapbox/geojson-area.png)](https://travis-ci.org/mapbox/geojson-area)

# geojson-area

Calculate the area inside of any [GeoJSON](http://geojson.org/) geometry.

## usage

    npm install @mapbox/geojson-area

## example

```js
var geojsonArea = require('@mapbox/geojson-area');

var area = geojsonArea.geometry(obj);
```

## api

### `geojsonArea.geometry(obj)`

Given a Geometry object, return contained
area as square meters. Invalid input will return `null`.

Adapted from [OpenLayers](http://openlayers.org/)
