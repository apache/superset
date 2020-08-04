var vows = require("vows"),
    assert = require("assert"),
    topojson = require("../");

var suite = vows.describe("topojson.bind");

suite.addBatch({
  "bind": {
    topic: function() {
      return topojson.bind;
    },
    "properties are bound to top-level features by id": function(bind) {
      var topology = topojson.topology({feature: {type: "Feature", id: "foo", properties: {}, geometry: null}});
      bind(topology, {foo: {color: "red"}});
      assert.deepEqual(topology.objects.feature.properties, {color: "red"});
    },
    "properties are bound to collected features by id": function(bind) {
      var topology = topojson.topology({collection: {type: "FeatureCollection", features: [
        {type: "Feature", id: "foo", properties: {}, geometry: null},
        {type: "Feature", id: "bar", properties: {}, geometry: {type: "Point", coordinates: [0, 0]}}
      ]}});
      bind(topology, {
        foo: {color: "red"},
        bar: {size: 42}
      });
      assert.deepEqual(topology.objects.collection.geometries[0].properties, {color: "red"});
      assert.deepEqual(topology.objects.collection.geometries[1].properties, {size: 42});
    }
  }
});

suite.export(module);
