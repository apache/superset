var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.wagner6");

suite.addBatch({
  "wagner6": {
    topic: load("wagner6"),
    "default": {
      topic: function(geo) { return geo.wagner6(); },
      "projections and inverse projections": function(wagner6) {
        assert.equalInverse(wagner6, [   0,   0], [480,        250]);
        assert.equalInverse(wagner6, [   0, -90], [480,        485.619449]);
        assert.equalInverse(wagner6, [   0,  90], [480,         14.380550]);
        assert.equalInverse(wagner6, [   0, -45], [480,        367.809724]);
        assert.equalInverse(wagner6, [   0,  45], [480,        132.190275]);
        assert.equalInverse(wagner6, [-180,   0], [  8.761101, 250]);
        assert.equalInverse(wagner6, [ 180,   0], [951.238898, 250]);
        assert.equalInverse(wagner6, [-179,  15], [16.2862562, 210.730091]);
        assert.equalInverse(wagner6, [   1,   1], [482.617872, 247.382006]);
      }
    }
  }
});

suite.export(module);
