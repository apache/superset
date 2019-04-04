var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.aitoff");

suite.addBatch({
  "aitoff": {
    topic: load("aitoff"),
    "default": {
      topic: function(geo) { return geo.aitoff(); },
      "projections and inverse projections": function(aitoff) {
        assert.equalInverse(aitoff, [   0,   0], [480,        250]);
        assert.equalInverse(aitoff, [   0, -90], [480,        485.619449]);
        assert.equalInverse(aitoff, [   0,  90], [480,         14.380550]);
        assert.equalInverse(aitoff, [   0, -45], [480,        367.809724]);
        assert.equalInverse(aitoff, [   0,  45], [480,        132.190275]);
        assert.equalInverse(aitoff, [-180,   0], [  8.761101, 250]);
        assert.equalInverse(aitoff, [ 180,   0], [951.238898, 250]);
        assert.equalInverse(aitoff, [-179,  15], [ 27.261952, 189.342293]);
        assert.equalInverse(aitoff, [   1,   1], [482.617728, 247.381972]);
        assert.equalInverse(aitoff, [  45,  87], [489.158099, 21.6821110]);
      },
      "the inverse projection of points outside the target region are falsey": function(aitoff) {
        assert.ok(!aitoff.invert([0, 0]));
      }
    }
  }
});

suite.export(module);
