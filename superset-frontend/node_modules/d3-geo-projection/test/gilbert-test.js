var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load"),
    d3 = require("d3");

var suite = vows.describe("d3.geo.gilbert");

suite.addBatch({
  "gilbert": {
    topic: load("gilbert"),
    "default": {
      topic: function(geo) { return geo.gilbert(d3.geo.orthographic()); },
      "projections and inverse projections": function(gilbert) {
        assert.equalInverse(gilbert, [  0,   0], [480,        250]);
        assert.equalInverse(gilbert, [  0, -45], [480,        312.132034]);
        assert.equalInverse(gilbert, [  0,  45], [480,        187.867965]);
        assert.equalInverse(gilbert, [-90,   0], [373.933982, 250]);
        assert.equalInverse(gilbert, [ 90,   0], [586.066017, 250]);
        assert.equalInverse(gilbert, [-80,  15], [384.421088, 230.252125]);
        assert.equalInverse(gilbert, [  1,   1], [481.308930, 248.690969]);
        assert.equalInverse(gilbert, [ 15,  45], [497.820343, 187.867965]);
      }
    }
  }
});

suite.export(module);
