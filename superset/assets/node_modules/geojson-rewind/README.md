[![Build Status](https://travis-ci.org/mapbox/geojson-rewind.png)](https://travis-ci.org/mapbox/geojson-rewind)

# geojson-rewind

The [GeoJSON](https://tools.ietf.org/html/rfc7946) specification is [picky about winding order](https://tools.ietf.org/html/rfc7946#section-3.1.6).

This helps you generate compliant Polygon and MultiPolygon geometries. Furthermore it lets you use [Canvas](http://www.bit-101.com/blog/?p=3702) and other drawing libraries's default behavior to color the interior rings of Polygon and MultiPolygon features.

## usage

as npm module:

    npm install --save geojson-rewind

as console utility

    # install
    npm install -g geojson-rewind
    # use
    geojson-rewind foo.geojson

as browser library

copy `geojson-rewind.js`

## api

`rewind(geojson, clockwise)`

Given a GeoJSON FeatureCollection, Feature, or Geometry, return a version
with inner and outer rings of different winding orders.

If `clockwise` is `true`, the outer ring is clockwise, otherwise
it is counterclockwise.
