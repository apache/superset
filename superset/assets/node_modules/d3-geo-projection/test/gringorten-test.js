var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.gringorten");

suite.addBatch({
  "gringorten": {
    topic: load("gringorten"),
    "default": {
      topic: function(geo) { return geo.gringorten(); },
      "projections and inverse projections": function(gringorten) {
        assert.equalInverse(gringorten, [120,  30], [687.902966, 184.525491], 1e-5);
        assert.equalInverse(gringorten, [ 90,  80], [630,        112.748374]);
        assert.equalInverse(gringorten, [  0,   0], [480,        250], 1e-3);
        assert.equalInverse(gringorten, [-80,  15], [350.494657, 218.619874]);
        assert.equalInverse(gringorten, [  0, -45], [480,        399.999928], 1e-3);
        assert.equalInverse(gringorten, [  0,  45], [480,        100.000071], 1e-3);
        assert.equalInverse(gringorten, [ 15,  45], [499.360376, 117.149092], 1e-4);
        assert.equalInverse(gringorten, [  1,   1], [481.304784, 246.646234]);
      }
    }
  }
});

suite.export(module);
