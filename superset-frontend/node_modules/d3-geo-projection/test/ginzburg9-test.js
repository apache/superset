var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.ginzburg9");

suite.addBatch({
  "ginzburg9": {
    topic: load("ginzburg9"),
    "default": {
      topic: function(geo) { return geo.ginzburg9(); },
      "projections and inverse projections": function(ginzburg9) {
        assert.equalInverse(ginzburg9, [   0,   0], [480,        250]);
        assert.equalInverse(ginzburg9, [   0, -90], [480,        485.619449]);
        assert.equalInverse(ginzburg9, [   0,  90], [480,         14.380550]);
        assert.equalInverse(ginzburg9, [   0, -45], [480,        367.809724]);
        assert.equalInverse(ginzburg9, [   0,  45], [480,        132.190275]);
        assert.equalInverse(ginzburg9, [-180,   0], [ 82.26,     250]);
        assert.equalInverse(ginzburg9, [ 180,   0], [877.74,     250]);
        assert.equalInverse(ginzburg9, [-179,  15], [ 92.158925, 197.003182]);
        assert.equalInverse(ginzburg9, [-179,  80], [250.610739,  -3.220862]);
        assert.equalInverse(ginzburg9, [   1,   1], [482.209480, 247.381976]);
      }
    }
  }
});

suite.export(module);
