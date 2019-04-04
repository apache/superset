var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.larrivee");

suite.addBatch({
  "larrivee": {
    topic: load("larrivee"),
    "default": {
      topic: function(geo) { return geo.larrivee(); },
      "projections and inverse projections": function(larrivee) {
        assert.equalInverse(larrivee, [   0,   0], [480,        250]);
        assert.equalInverse(larrivee, [   0, -90], [480,        583.216220]);
        assert.equalInverse(larrivee, [   0,  90], [480,        -83.216220]);
        assert.equalInverse(larrivee, [   0, -45], [480,        377.516326]);
        assert.equalInverse(larrivee, [   0,  45], [480,        122.483673]);
        assert.equalInverse(larrivee, [-180,   0], [  8.761101, 250]);
        assert.equalInverse(larrivee, [ 180,   0], [951.238898, 250]);
        assert.equalInverse(larrivee, [-179,  15], [ 15.405661, 204.340225]);
        assert.equalInverse(larrivee, [   1,   1], [482.617894, 247.381895]);
      }
    }
  }
});

suite.export(module);
