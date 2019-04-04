var vows = require("vows"),
    assert = require("assert"),
    topojson = require("../");

var suite = vows.describe("topojson.filter");

suite.addBatch({
  "filter": {
    topic: function() {
      return topojson.filter;
    },
    "null top-level geometry objects are preserved": function(filter) {
      var topology = topojson.topology({
        feature: {type: "Feature", geometry: null},
        geometry: null
      });
      filter(topology, {"coordinate-system": "spherical"});
      assert.deepEqual(topology.objects.feature, {});
      assert.deepEqual(topology.objects.geometry, {});
    },
    "empty top-level feature collections are converted to null": function(filter) {
      var topology = topojson.topology({
        collection: {type: "FeatureCollection", features: [
          {type: "Feature", properties: {}, geometry: null},
          {type: "Feature", properties: {}, geometry: null}
        ]}
      });
      filter(topology, {"coordinate-system": "spherical"});
      assert.deepEqual(topology.objects.collection, {type: null});
    },
    "null inner features are removed": function(filter) {
      var topology = topojson.topology({
        collection: {type: "FeatureCollection", features: [
          {type: "Feature", properties: {}, geometry: null},
          {type: "Feature", properties: {}, geometry: {type: "Point", coordinates: [0, 0]}},
          {type: "Feature", properties: {}, geometry: null}
        ]}
      });
      filter(topology, {"coordinate-system": "spherical"});
      assert.deepEqual(topology.objects.collection, {type: "GeometryCollection", geometries: [{type: "Point", coordinates: [0, 0]}]});
    },
    "empty polygons are removed": function(filter) {
      var topology = topojson.topology({
        collection: {type: "FeatureCollection", features: [
          {type: "Feature", properties: {}, geometry: null},
          {type: "Feature", properties: {}, geometry: {type: "Point", coordinates: [0, 0]}},
          {type: "Feature", properties: {}, geometry: {type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 1], [0, 0]]]}},
          {type: "Feature", properties: {}, geometry: null}
        ]}
      });
      filter(topology, {"coordinate-system": "spherical"});
      assert.deepEqual(topology.objects.collection, {type: "GeometryCollection", geometries: [{type: "Point", coordinates: [0, 0]}]});
    },
    "empty top-level geometry objects are converted to null": function(filter) {
      var topology = topojson.topology({line: {type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 1], [0, 0]]]}});
      filter(topology, {"coordinate-system": "spherical"});
      assert.deepEqual(topology.objects.line, {type: null});
    },
    "non-empty top-level geometry objects are preserved": function(filter) {
      var topology = topojson.topology({polygon: {type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]}});
      filter(topology, {"coordinate-system": "spherical"});
      assert.deepEqual(topology.objects.polygon, {type: "Polygon", arcs: [[0]]});
    }
  }
});

suite.export(module);
