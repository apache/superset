var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.ginzburg4");

suite.addBatch({
  "ginzburg4": {
    topic: load("ginzburg4"),
    "default": {
      topic: function(geo) { return geo.ginzburg4(); },
      "projections and inverse projections": function(ginzburg4) {
        assert.equalInverse(ginzburg4, [   0,   0], [480,        250]);
        assert.equalInverse(ginzburg4, [   0, -90], [480,        485.619449]);
        assert.equalInverse(ginzburg4, [   0,  90], [480,         14.380550]);
        assert.equalInverse(ginzburg4, [   0, -45], [480,        367.809724]);
        assert.equalInverse(ginzburg4, [   0,  45], [480,        132.190275]);
        assert.equalInverse(ginzburg4, [-180,   0], [ 55.74,     250]);
        assert.equalInverse(ginzburg4, [ 180,   0], [904.26,     250]);
        assert.equalInverse(ginzburg4, [-179,  15], [ 74.930232, 182.241971]);
        assert.equalInverse(ginzburg4, [-179,  80], [324.146655,   6.768973]);
        assert.equalInverse(ginzburg4, [   1,   1], [482.356603, 247.381944]);
      }
    }
  }
});

suite.export(module);
