var test = require('tap').test
var geojsonVt = require('geojson-vt')
var VectorTile = require('@mapbox/vector-tile').VectorTile
var Pbf = require('pbf')
var vtvalidate = require('@mapbox/vtvalidate')
var geojsonFixtures = require('@mapbox/geojson-fixtures')
var mvtf = require('@mapbox/mvt-fixtures')
var GeoJsonEquality = require('geojson-equality')
var eq = new GeoJsonEquality({ precision: 1 })

var vtpbf = require('../')

test('geojson-vt', function (t) {
  var geometryTypes = ['polygon', 'point', 'multipoint', 'multipolygon', 'polygon', 'multilinestring']

  const fixtures = geometryTypes.map(function (type) {
    return {
      name: type,
      data: { type: 'Feature', properties: {}, geometry: geojsonFixtures.geometry[type] }
    }
  })

  fixtures.forEach(function (fixture) {
    t.test(fixture.name, function (t) {
      var tile = geojsonVt(fixture.data).getTile(0, 0, 0)
      var buff = vtpbf.fromGeojsonVt({ 'geojsonLayer': tile })
      vtvalidate.isValid(buff, (err, invalid) => {
        t.error(err)

        t.ok(!invalid, invalid)

        // Compare roundtripped features with originals
        const expected = fixture.data.type === 'FeatureCollection' ? fixture.data.features : [fixture.data]
        var layer = new VectorTile(new Pbf(buff)).layers['geojsonLayer']
        t.equal(layer.length, expected.length, expected.length + ' features')
        for (var i = 0; i < layer.length; i++) {
          var actual = layer.feature(i).toGeoJSON(0, 0, 0)
          t.ok(eq.compare(actual, expected[i]), 'feature ' + i)
        }
        t.end()
      })
    })
  })

  t.end()
})

test('vector-tile-js', function (t) {
  // See https://github.com/mapbox/mvt-fixtures/blob/master/FIXTURES.md for
  // fixture descriptions
  mvtf.each(function (fixture) {
    // skip invalid tiles
    if (!fixture.validity.v2) return

    t.test('mvt-fixtures: ' + fixture.id + ' ' + fixture.description, function (t) {
      var original = new VectorTile(new Pbf(fixture.buffer))

      if (fixture.id === '020') {
        t.comment('Skipping test due to https://github.com/mapbox/vt-pbf/issues/30')
        t.end()
        return
      }

      if (fixture.id === '049' || fixture.id === '050') {
        t.comment('Skipping test due to https://github.com/mapbox/vt-pbf/issues/31')
        t.end()
        return
      }

      var buff = vtpbf(original)
      var roundtripped = new VectorTile(new Pbf(buff))

      vtvalidate.isValid(buff, (err, invalid) => {
        t.error(err)

        if (invalid && invalid === 'ClosePath command count is not 1') {
          t.comment('Skipping test due to https://github.com/mapbox/vt-pbf/issues/28')
          t.end()
          return
        }

        // UNKOWN geometry type is valid in the spec, but vtvalidate considers
        // it an error
        if (fixture.id === '016' || fixture.id === '039') {
          invalid = null
        }

        t.ok(!invalid, invalid)

        // Compare roundtripped features with originals
        for (var name in original.layers) {
          var originalLayer = original.layers[name]
          t.ok(roundtripped.layers[name], 'layer ' + name)
          var roundtrippedLayer = roundtripped.layers[name]
          t.equal(roundtrippedLayer.length, originalLayer.length)
          for (var i = 0; i < originalLayer.length; i++) {
            var actual = roundtrippedLayer.feature(i)
            var expected = originalLayer.feature(i)

            t.equal(actual.id, expected.id, 'id')
            t.equal(actual.type, expected.type, 'type')
            t.deepEqual(actual.properties, expected.properties, 'properties')
            t.deepEqual(actual.loadGeometry(), expected.loadGeometry(), 'geometry')
          }
        }

        t.end()
      })
    })
  })
  t.end()
})
