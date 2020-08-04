var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.eckert4");

suite.addBatch({
  "eckert4": {
    topic: load("eckert4"),
    "default": {
      topic: function(geo) { return geo.eckert4(); },
      "projections and inverse projections": function(eckert4) {
        assert.equalInverse(eckert4, [  0,   0], [480,        250]);
        assert.equalInverse(eckert4, [  0, -45], [480,        380.658311]);
        assert.equalInverse(eckert4, [  0,  45], [480,        119.341688]);
        assert.equalInverse(eckert4, [-90,   0], [281.024935, 250]);
        assert.equalInverse(eckert4, [ 90,   0], [678.975064, 250]);
        assert.equalInverse(eckert4, [-80,  15], [305.548179, 203.818280]);
        assert.equalInverse(eckert4, [  1,   1], [482.210699, 246.899956]);
        assert.equalInverse(eckert4, [ 15,  45], [509.086665, 119.341688]);
      }
    }
  }
});

suite.export(module);
