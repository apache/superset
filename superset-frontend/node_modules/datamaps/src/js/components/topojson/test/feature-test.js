var vows = require("vows"),
    assert = require("assert"),
    topojson = require("../");

var suite = vows.describe("topojson.feature");

suite.addBatch({
  "feature": {
    "the geometry type is preserved": function() {
      var t = simpleTopology({type: "Polygon", arcs: [[0]]});
      assert.equal(topojson.feature(t, t.objects.foo).geometry.type, "Polygon");
    },

    "Point is a valid geometry type": function() {
      var t = simpleTopology({type: "Point", coordinates: [0, 0]});
      assert.deepEqual(topojson.feature(t, t.objects.foo), {type: "Feature", properties: {}, geometry: {type: "Point", coordinates: [0, 0]}});
    },

    "MultiPoint is a valid geometry type": function() {
      var t = simpleTopology({type: "MultiPoint", coordinates: [[0, 0]]});
      assert.deepEqual(topojson.feature(t, t.objects.foo), {type: "Feature", properties: {}, geometry: {type: "MultiPoint", coordinates: [[0, 0]]}});
    },

    "LineString is a valid geometry type": function() {
      var t = simpleTopology({type: "LineString", arcs: [0]});
      assert.deepEqual(topojson.feature(t, t.objects.foo), {type: "Feature", properties: {}, geometry: {type: "LineString", coordinates: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]}});
    },

    "MultiLineString is a valid geometry type": function() {
      var t = simpleTopology({type: "LineString", arcs: [0]});
      assert.deepEqual(topojson.feature(t, t.objects.foo), {type: "Feature", properties: {}, geometry: {type: "LineString", coordinates: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]}});
    },

    "line-strings have at least two coordinates": function() {
      var t = simpleTopology({type: "LineString", arcs: [3]});
      assert.deepEqual(topojson.feature(t, t.objects.foo), {type: "Feature", properties: {}, geometry: {type: "LineString", coordinates: [[1, 1], [1, 1]]}});
      var t = simpleTopology({type: "MultiLineString", arcs: [[3], [4]]});
      assert.deepEqual(topojson.feature(t, t.objects.foo), {type: "Feature", properties: {}, geometry: {type: "MultiLineString", coordinates: [[[1, 1], [1, 1]], [[0, 0], [0, 0]]]}});
    },

    "Polygon is a valid feature type": function() {
      var t = simpleTopology({type: "Polygon", arcs: [[0]]});
      assert.deepEqual(topojson.feature(t, t.objects.foo), {type: "Feature", properties: {}, geometry: {type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}});
    },

    "MultiPolygon is a valid feature type": function() {
      var t = simpleTopology({type: "MultiPolygon", arcs: [[[0]]]});
      assert.deepEqual(topojson.feature(t, t.objects.foo), {type: "Feature", properties: {}, geometry: {type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]]}});
    },

    "polygons are closed, with at least four coordinates": function() {
      var topology = {
        type: "Topology",
        transform: {scale: [1, 1], translate: [0, 0]},
        objects: {foo: {type: "Polygon", arcs: [[0]]}, bar: {type: "Polygon", arcs: [[0, 1]]}},
        arcs: [[[0, 0], [1, 1]], [[1, 1], [-1, -1]]]
      };
      assert.deepEqual(topojson.feature(topology, topology.objects.foo).geometry.coordinates, [[[0, 0], [1, 1], [0, 0], [0, 0]]]);
      assert.deepEqual(topojson.feature(topology, topology.objects.bar).geometry.coordinates, [[[0, 0], [1, 1], [0, 0], [0, 0]]]);
    },

    "top-level geometry collections are mapped to feature collections": function() {
      var t = simpleTopology({type: "GeometryCollection", geometries: [{type: "MultiPolygon", arcs: [[[0]]]}]});
      assert.deepEqual(topojson.feature(t, t.objects.foo), {type: "FeatureCollection", features: [{type: "Feature", properties: {}, geometry: {type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]]}}]});
    },

    "geometry collections can be nested": function() {
      var t = simpleTopology({type: "GeometryCollection", geometries: [{type: "GeometryCollection", geometries: [{type: "Point", coordinates: [0, 0]}]}]});
      assert.deepEqual(topojson.feature(t, t.objects.foo), {type: "FeatureCollection", features: [{type: "Feature", properties: {}, geometry: {type: "GeometryCollection", geometries: [{type: "Point", coordinates: [0, 0]}]}}]});
    },

    "top-level geometry collections do not have ids, but second-level geometry collections can": function() {
      var t = simpleTopology({type: "GeometryCollection", id: "collection", geometries: [{type: "GeometryCollection", id: "feature", geometries: [{type: "Point", id: "geometry", coordinates: [0, 0]}]}]});
      assert.deepEqual(topojson.feature(t, t.objects.foo), {type: "FeatureCollection", features: [{type: "Feature", id: "feature", properties: {}, geometry: {type: "GeometryCollection", geometries: [{type: "Point", coordinates: [0, 0]}]}}]});
    },

    "top-level geometry collections do not have properties, but second-level geometry collections can": function() {
      var t = simpleTopology({type: "GeometryCollection", properties: {collection: true}, geometries: [{type: "GeometryCollection", properties: {feature: true}, geometries: [{type: "Point", properties: {geometry: true}, coordinates: [0, 0]}]}]});
      assert.deepEqual(topojson.feature(t, t.objects.foo), {type: "FeatureCollection", features: [{type: "Feature", properties: {feature: true}, geometry: {type: "GeometryCollection", geometries: [{type: "Point", coordinates: [0, 0]}]}}]});
    },

    "the object id is promoted to feature id": function() {
      var t = simpleTopology({id: "foo", type: "Polygon", arcs: [[0]]});
      assert.equal(topojson.feature(t, t.objects.foo).id, "foo");
    },

    "any object properties are promoted to feature properties": function() {
      var t = simpleTopology({type: "Polygon", properties: {color: "orange", size: 42}, arcs: [[0]]});
      assert.deepEqual(topojson.feature(t, t.objects.foo).properties, {color: "orange", size: 42});
    },

    "the object id is optional": function() {
      var t = simpleTopology({type: "Polygon", arcs: [[0]]});
      assert.isUndefined(topojson.feature(t, t.objects.foo).id);
    },

    "object properties are created if missing": function() {
      var t = simpleTopology({type: "Polygon", arcs: [[0]]});
      assert.deepEqual(topojson.feature(t, t.objects.foo).properties, {});
    },

    "arcs are converted to coordinates": function() {
      var t = simpleTopology({type: "Polygon", arcs: [[0]]});
      assert.deepEqual(topojson.feature(t, t.objects.foo).geometry.coordinates, [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]);
    },

    "negative arc indexes indicate reversed coordinates": function() {
      var t = simpleTopology({type: "Polygon", arcs: [[~0]]});
      assert.deepEqual(topojson.feature(t, t.objects.foo).geometry.coordinates, [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]);
    },

    "when multiple arc indexes are specified, coordinates are stitched together": function() {
      var t = simpleTopology({type: "LineString", arcs: [1, 2]});
      assert.deepEqual(topojson.feature(t, t.objects.foo).geometry.coordinates, [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
      var t = simpleTopology({type: "Polygon", arcs: [[~2, ~1]]});
      assert.deepEqual(topojson.feature(t, t.objects.foo).geometry.coordinates, [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]);
    },

    "unknown geometry types are converted to null geometries": function() {
      var topology = {
        type: "Topology",
        transform: {scale: [1, 1], translate: [0, 0]},
        objects: {
          foo: {id: "foo"},
          bar: {type: "Invalid", properties: {bar: 2}},
          baz: {type: "GeometryCollection", geometries: [{type: "Unknown", id: "unknown"}]}
        },
        arcs: []
      };
      assert.deepEqual(topojson.feature(topology, topology.objects.foo), {type: "Feature", id: "foo", properties: {}, geometry: null});
      assert.deepEqual(topojson.feature(topology, topology.objects.bar), {type: "Feature", properties: {bar: 2}, geometry: null});
      assert.deepEqual(topojson.feature(topology, topology.objects.baz), {type: "FeatureCollection", features: [{type: "Feature", id: "unknown", properties: {}, geometry: null}]});
    }
  }
});

function simpleTopology(object) {
  return {
    type: "Topology",
    transform: {scale: [1, 1], translate: [0, 0]},
    objects: {foo: object},
    arcs: [
      [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]],
      [[0, 0], [1, 0], [0, 1]],
      [[1, 1], [-1, 0], [0, -1]],
      [[1, 1]],
      [[0, 0]]
    ]
  };
}

suite.export(module);
