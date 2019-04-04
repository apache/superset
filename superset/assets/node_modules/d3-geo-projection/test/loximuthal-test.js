var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.loximuthal");

suite.addBatch({
  "loximuthal": {
    topic: load("loximuthal"),
    "default": {
      topic: function(geo) { return geo.loximuthal(); },
      "projections and inverse projections": function(loximuthal) {
        assert.equalInverse(loximuthal, [   0,   0], [480,        250]);
        assert.equalInverse(loximuthal, [   0, -90], [480,        485.619449]);
        assert.equalInverse(loximuthal, [   0,  90], [480,         14.380550]);
        assert.equalInverse(loximuthal, [   0, -45], [480,        367.809724]);
        assert.equalInverse(loximuthal, [   0,  45], [480,        132.190275]);
        assert.equalInverse(loximuthal, [-180,   0], [ 48.773559, 250]);
        assert.equalInverse(loximuthal, [ 180,   0], [911.226440, 250]);
        assert.equalInverse(loximuthal, [-179,  15], [ 69.464314, 210.730091]);
        assert.equalInverse(loximuthal, [   1,   1], [482.390500, 247.382006]);
      }
    }
  }
});

suite.export(module);
