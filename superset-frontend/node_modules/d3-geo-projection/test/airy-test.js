var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.airy");

suite.addBatch({
  "airy": {
    topic: load("airy"),
    "default": {
      topic: function(geo) { return geo.airy(); },
      "projections and inverse projections": function(airy) {
        assert.equalInverse(airy, [   0,   0], [480,         250]);
        assert.equalInverse(airy, [ 180, -90], [480,         457.944154]);
        assert.equalInverse(airy, [ 180,  90], [480,          42.055845]);
        assert.equalInverse(airy, [   0, -45], [480,         350.409232]);
        assert.equalInverse(airy, [   0,  45], [480,         149.590767]);
        assert.equalInverse(airy, [   1,   1], [482.216112,  247.783550]);
        assert.equalInverse(airy, [  45,  87], [487.496494,   47.708572]);
      }
    }
  }
});

suite.export(module);
