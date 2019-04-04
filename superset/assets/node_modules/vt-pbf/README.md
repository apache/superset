# vt-pbf [![CircleCI](https://circleci.com/gh/mapbox/vt-pbf.svg?style=svg)](https://circleci.com/gh/mapbox/vt-pbf)

Serialize [Mapbox vector tiles](https://github.com/mapbox/vector-tile-spec) to binary protobufs in javascript.

## Usage

As far as I know, the two places you might get a JS representation of a vector
tile are [geojson-vt](https://github.com/mapbox/geojson-vt) and
[vector-tile-js](https://github.com/mapbox/vector-tile-js).  These both use
slightly different internal representations, so serializing each looks slightly
different:

## From vector-tile-js

```javascript
var vtpbf = require('vt-pbf')
var VectorTile = require('vector-tile').VectorTile

var data = fs.readFileSync(__dirname + '/fixtures/rectangle-1.0.0.pbf')
var tile = new VectorTile(new Pbf(data))
var orig = tile.layers['geojsonLayer'].feature(0).toGeoJSON(0, 0, 1)

var buff = vtpbf(tile)
fs.writeFileSync('my-tile.pbf', buff)
```

## From geojson-vt

```javascript
var vtpbf = require('vt-pbf')
var geojsonVt = require('geojson-vt')

var orig = JSON.parse(fs.readFileSync(__dirname + '/fixtures/rectangle.geojson'))
var tileindex = geojsonVt(orig)
var tile = tileindex.getTile(1, 0, 0)

// pass in an object mapping layername -> tile object
var buff = vtpbf.fromGeojsonVt({ 'geojsonLayer': tile })
fs.writeFileSync('my-tile.pbf', buff)
```


