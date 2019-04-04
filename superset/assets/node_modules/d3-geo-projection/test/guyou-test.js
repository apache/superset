var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.guyou");

suite.addBatch({
  "guyou": {
    topic: load("guyou"),
    "default": {
      topic: function(geo) { return geo.guyou(); },
      "projections and inverse projections": function(guyou) {
        assert.equalInverse(guyou, [  0,   0], [480,        250]);
        assert.equalInverse(guyou, [  0, -45], [480,        487.382], 1e-3);
        assert.equalInverse(guyou, [  0,  45], [480,         12.6172], 1e-4);
        assert.equalInverse(guyou, [-90,   0], [242.617240, 250]);
        assert.equalInverse(guyou, [ 90,   0], [717.382759, 250]);
        assert.equalInverse(guyou, [ 45,   0], [611.625205, 250]);
        assert.equalInverse(guyou, [-80,  15], [264.628233, 216.032299]);
        assert.equalInverse(guyou, [  1,   1], [483.160518, 246.839962]);
        assert.equalInverse(guyou, [ 15,  45], [561.412842,  86.826667]);
        assert.equalInverse(guyou, [180, -60], [823.140312, 487.382759], 1e-4);
      }
    }
  }
});

suite.export(module);
