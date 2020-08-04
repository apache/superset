var fs = require('fs')
const path = require('path')
var test = require('tap').test
var Pbf = require('pbf')
var geojsonVt = require('geojson-vt')
var VectorTile = require('@mapbox/vector-tile').VectorTile
var GeoJsonEquality = require('geojson-equality')

var eq = new GeoJsonEquality({ precision: 1 })

var vtpbf = require('../')

test('property encoding', function (t) {
  test('property encoding: JSON.stringify non-primitive values', function (t) {
    // Includes two properties with a common non-primitive value for
    // https://github.com/mapbox/vt-pbf/issues/9
    var orig = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          a: 'one',
          b: 1,
          c: { 'hello': 'world' },
          d: [ 1, 2, 3 ]
        },
        geometry: {
          type: 'Point',
          coordinates: [0, 0]
        }
      }, {
        type: 'Feature',
        properties: {
          a: 'two',
          b: 2,
          c: { 'goodbye': 'planet' },
          d: { 'hello': 'world' }
        },
        geometry: {
          type: 'Point',
          coordinates: [0, 0]
        }
      }]
    }

    var tileindex = geojsonVt(orig)
    var tile = tileindex.getTile(1, 0, 0)
    var buff = vtpbf.fromGeojsonVt({ 'geojsonLayer': tile })

    var vt = new VectorTile(new Pbf(buff))
    var layer = vt.layers['geojsonLayer']

    var first = layer.feature(0).properties
    var second = layer.feature(1).properties
    t.same(first.c, '{"hello":"world"}')
    t.same(first.d, '[1,2,3]')
    t.same(second.c, '{"goodbye":"planet"}')
    t.same(second.d, '{"hello":"world"}')
    t.end()
  })

  test('number encoding https://github.com/mapbox/vt-pbf/pull/11', function (t) {
    var orig = {
      type: 'Feature',
      properties: {
        'large_integer': 39953616224,
        'non_integer': 331.75415
      },
      geometry: {
        type: 'Point',
        coordinates: [0, 0]
      }
    }

    var tileindex = geojsonVt(orig)
    var tile = tileindex.getTile(1, 0, 0)
    var buff = vtpbf.fromGeojsonVt({ 'geojsonLayer': tile })
    var vt = new VectorTile(new Pbf(buff))
    var layer = vt.layers['geojsonLayer']

    var properties = layer.feature(0).properties
    t.equal(properties.large_integer, 39953616224)
    t.equal(properties.non_integer, 331.75415)
    t.end()
  })

  t.end()
})

test('id encoding', function (t) {
  var orig = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 123,
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [0, 0]
      }
    }, {
      type: 'Feature',
      id: 'invalid',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [0, 0]
      }
    }, {
      type: 'Feature',
      // no id
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [0, 0]
      }
    }]
  }
  var tileindex = geojsonVt(orig)
  var tile = tileindex.getTile(1, 0, 0)
  var buff = vtpbf.fromGeojsonVt({ 'geojsonLayer': tile })
  var vt = new VectorTile(new Pbf(buff))
  var layer = vt.layers['geojsonLayer']
  t.same(layer.feature(0).id, 123)
  t.notOk(layer.feature(1).id, 'Non-integer values should not be saved')
  t.notOk(layer.feature(2).id)
  t.end()
})

test('accept geojson-vt options https://github.com/mapbox/vt-pbf/pull/21', function (t) {
  var version = 2
  var extent = 8192
  var orig = JSON.parse(fs.readFileSync(path.join(__dirname, '/fixtures/rectangle.geojson')))
  var tileindex = geojsonVt(orig, { extent: extent })
  var tile = tileindex.getTile(1, 0, 0)
  var options = { version: version, extent: extent }
  var buff = vtpbf.fromGeojsonVt({ 'geojsonLayer': tile }, options)

  var vt = new VectorTile(new Pbf(buff))
  var layer = vt.layers['geojsonLayer']
  var features = []
  for (var i = 0; i < layer.length; i++) {
    var feat = layer.feature(i).toGeoJSON(0, 0, 1)
    features.push(feat)
  }

  t.equal(layer.version, options.version, 'version should be equal')
  t.equal(layer.extent, options.extent, 'extent should be equal')

  orig.features.forEach(function (expected) {
    var actual = features.shift()
    t.ok(eq.compare(actual, expected))
  })

  t.end()
})
