var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.ginzburg8");

suite.addBatch({
  "ginzburg8": {
    topic: load("ginzburg8"),
    "default": {
      topic: function(geo) { return geo.ginzburg8(); },
      "projections and inverse projections": function(ginzburg8) {
        assert.equalInverse(ginzburg8, [   0,   0], [480,        250]);
        assert.equalInverse(ginzburg8, [   0, -90], [480,        534.066756]);
        assert.equalInverse(ginzburg8, [   0,  90], [480,        -34.066756]);
        assert.equalInverse(ginzburg8, [   0, -45], [480,        373.865637]);
        assert.equalInverse(ginzburg8, [   0,  45], [480,        126.134362]);
        assert.equalInverse(ginzburg8, [-180,   0], [113.741324, 250]);
        assert.equalInverse(ginzburg8, [ 180,   0], [846.258675, 250]);
        assert.equalInverse(ginzburg8, [-179,  15], [118.882415, 210.505798], 1e-5);
        assert.equalInverse(ginzburg8, [-179,  80], [230.428677,   6.534397]);
        assert.equalInverse(ginzburg8, [   1,   1], [482.277542, 247.381939]);
      }
    }
  }
});

suite.export(module);
