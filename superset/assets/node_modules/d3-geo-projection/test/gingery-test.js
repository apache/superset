var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.gingery");

suite.addBatch({
  "gingery": {
    topic: load("gingery"),
    "default": {
      topic: function(geo) { return geo.gingery(); },
      "projections and inverse projections": function(gingery) {
        assert.equalInverse(gingery, [  0,   0], [480,        250]);
        assert.equalInverse(gingery, [  1, -45], [487.667479, 370.335522]);
        assert.equalInverse(gingery, [  1,  45], [487.667479, 129.664477]);
        assert.equalInverse(gingery, [-89,   0], [246.998544, 250]);
        assert.equalInverse(gingery, [ 90,   0], [715.619449, 250]);
        assert.equalInverse(gingery, [-80,  15], [271.117418, 210.560554]);
        assert.equalInverse(gingery, [  1,   1], [482.617728, 247.381873]);
        assert.equalInverse(gingery, [ 15,  45], [513.961314, 131.005015]);
        assert.equalInverse(gingery, [120,  30], [685.458267, 17.9517257]);
        assert.equalInverse(gingery, [110,  10], [767.208649, 223.806432]);
      }
    }
  }
});

suite.export(module);
