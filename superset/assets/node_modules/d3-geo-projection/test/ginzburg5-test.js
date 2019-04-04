var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.ginzburg5");

suite.addBatch({
  "ginzburg5": {
    topic: load("ginzburg5"),
    "default": {
      topic: function(geo) { return geo.ginzburg5(); },
      "projections and inverse projections": function(ginzburg5) {
        assert.equalInverse(ginzburg5, [   0,   0], [480,        250]);
        assert.equalInverse(ginzburg5, [   0, -90], [480,        485.619449]);
        assert.equalInverse(ginzburg5, [   0,  90], [480,         14.380550]);
        assert.equalInverse(ginzburg5, [   0, -45], [480,        367.809724]);
        assert.equalInverse(ginzburg5, [   0,  45], [480,        132.190275]);
        assert.equalInverse(ginzburg5, [-180,   0], [92.4271500, 250]);
        assert.equalInverse(ginzburg5, [ 180,   0], [867.572850, 250]);
        assert.equalInverse(ginzburg5, [-179,  15], [103.000122, 190.710455]);
        assert.equalInverse(ginzburg5, [-179,  80], [283.164027,  29.027751]);
        assert.equalInverse(ginzburg5, [   1,   1], [482.152989, 247.381962]);
      }
    }
  }
});

suite.export(module);
