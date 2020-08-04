var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.bonne");

suite.addBatch({
  "bonne": {
    topic: load("bonne"),
    "40° parallel": {
      topic: function(geo) {
        return geo.bonne().parallel(40);
      },
      "projections and inverse projections": function(bonne) {
        assert.equalInverse(bonne, [   0,   0], [480,         250]);
        assert.equalInverse(bonne, [   0, -90], [480,         485.619449]);
        assert.equalInverse(bonne, [   0,  90], [480,          14.380550]);
        assert.equalInverse(bonne, [   0, -45], [480,         367.809724]);
        assert.equalInverse(bonne, [   0,  45], [480,         132.190275]);
        assert.equalInverse(bonne, [-180,   0], [197.703665,  -59.391754]);
        assert.equalInverse(bonne, [ 180,   0], [762.296334,  -59.391754]);
        assert.equalInverse(bonne, [-179,  15], [245.482446, -101.610988]);
        assert.equalInverse(bonne, [   1,   1], [482.617557,  247.369808]);
      }
    },
    "90° parallel (Werner)": {
      topic: function(geo) {
        return geo.bonne().parallel(90);
      },
      "projections and inverse projections": function(bonne) {
        assert.equalInverse(bonne, [0, 0], [480, 250]);
      }
    },
    "0° parallel (sinusoidal)": {
      topic: function(geo) {
        return geo.bonne().parallel(0);
      },
      "projections and inverse projections": function(bonne) {
        assert.equalInverse(bonne, [0, 0], [480, 250]);
      }
    }
  }
});

suite.export(module);
