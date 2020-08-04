var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.wiechel");

suite.addBatch({
  "wiechel": {
    topic: load("wiechel"),
    "default": {
      topic: function(geo) { return geo.wiechel(); },
      "projections and inverse projections": function(wiechel) {
        assert.equalInverse(wiechel, [  0,   0], [480,        250]);
        assert.equalInverse(wiechel, [  0, -45], [436.066017, 356.066017]);
        assert.equalInverse(wiechel, [  0,  45], [523.933982, 143.933982]);
        assert.equalInverse(wiechel, [-90,   0], [330,        100]);
        assert.equalInverse(wiechel, [ 90,   0], [630,        400]);
        assert.equalInverse(wiechel, [-80,  15], [370.087700,  90.716040]);
        assert.equalInverse(wiechel, [  1,   1], [482.649770, 247.414442]);
        assert.equalInverse(wiechel, [ 15,  45], [553.483232, 155.847766]);
      }
    }
  }
});

suite.export(module);
