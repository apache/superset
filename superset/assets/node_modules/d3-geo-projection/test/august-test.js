var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.august");

suite.addBatch({
  "august": {
    topic: load("august"),
    "default": {
      topic: function(geo) { return geo.august(); },
      "projections and inverse projections": function(august) {
        assert.equalInverse(august, [  0,   0], [480,        250]);
        assert.equalInverse(august, [  0, -45], [480,        378.067905]);
        assert.equalInverse(august, [  0,  45], [480,        121.932094]);
        assert.equalInverse(august, [  0,  90], [480,       -150]);
        assert.equalInverse(august, [  0,  80], [480,        -43.976545]);
        assert.equalInverse(august, [-90,   0], [217.258300, 250]);
        assert.equalInverse(august, [ 90,   0], [742.741699, 250]);
        assert.equalInverse(august, [-80,  15], [254.414080, 199.297313]);
        assert.equalInverse(august, [  1,   1], [482.617927, 247.381806]);
        assert.equalInverse(august, [ 15,  80], [499.471722, -45.366200]);
        assert.equalInverse(august, [100,  50], [732.424769,  43.602745]);
      }
    }
  }
});

suite.export(module);
