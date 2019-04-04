var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.peirceQuincuncial");

suite.addBatch({
  "peirceQuincuncial": {
    topic: load("peirce-quincuncial"),
    "default": {
      topic: function(geo) { return geo.peirceQuincuncial(); },
      "projections and inverse projections": function(peirceQuincuncial) {
        assert.inDelta(peirceQuincuncial([0, 90]), [480, 250], 1e-6);
        assert.equalInverse(peirceQuincuncial, [  0,   0], [480,        585.709], 1e-2);
        assert.equalInverse(peirceQuincuncial, [-90,   0], [144.290082, 250], 1e-5);
        assert.equalInverse(peirceQuincuncial, [ 90,   0], [815.709915, 250], 1e-1);
        assert.equalInverse(peirceQuincuncial, [ 45,   0], [647.854958, 417.854958]);
        assert.equalInverse(peirceQuincuncial, [-80,  15], [282.302142, 290.470613]);
        assert.equalInverse(peirceQuincuncial, [  1,   1], [495.393500, 548.541114]);
        assert.equalInverse(peirceQuincuncial, [ 15,  45], [507.756185, 352.529945]);
      }
    }
  }
});

suite.export(module);
