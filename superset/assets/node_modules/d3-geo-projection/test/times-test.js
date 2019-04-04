var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.times");

suite.addBatch({
  "times": {
    topic: load("times"),
    "default": {
      topic: function(geo) { return geo.times(); },
      "projections and inverse projections": function(times) {
        assert.equalInverse(times, [  0,   0], [480,        250]);
        assert.equalInverse(times, [  0, -45], [480,        356.066217]);
        assert.equalInverse(times, [  0,  45], [480,        143.933782]);
        assert.equalInverse(times, [-90,   0], [304.505921, 250]);
        assert.equalInverse(times, [ 90,   0], [655.494078, 250]);
        assert.equalInverse(times, [-80,  15], [324.777008, 216.288205]);
        assert.equalInverse(times, [  1,   1], [481.949891, 247.765341]);
        assert.equalInverse(times, [ 15,  45], [507.861496, 143.933782]);
      }
    }
  }
});

suite.export(module);
