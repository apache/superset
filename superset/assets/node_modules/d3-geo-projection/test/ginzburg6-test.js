var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.ginzburg6");

suite.addBatch({
  "ginzburg6": {
    topic: load("ginzburg6"),
    "default": {
      topic: function(geo) { return geo.ginzburg6(); },
      "projections and inverse projections": function(ginzburg6) {
        assert.equalInverse(ginzburg6, [   0,   0], [480,        250]);
        assert.equalInverse(ginzburg6, [   0, -90], [480,        511.780994], 1e-4);
        assert.equalInverse(ginzburg6, [   0,  90], [480,        -11.780994], 1e-4);
        assert.equalInverse(ginzburg6, [   0, -45], [480,        371.079917], 1e-5);
        assert.equalInverse(ginzburg6, [   0,  45], [480,        128.920082], 1e-5);
        assert.equalInverse(ginzburg6, [-180,   0], [ 87.300918, 250]);
        assert.equalInverse(ginzburg6, [ 180,   0], [872.699081, 250]);
        assert.equalInverse(ginzburg6, [-179,  15], [ 95.906977, 197.310730]);
        assert.equalInverse(ginzburg6, [-179,  80], [291.096338,  -9.687754]);
        assert.equalInverse(ginzburg6, [   1,   1], [482.181510, 247.381942]);
      }
    }
  }
});

suite.export(module);
