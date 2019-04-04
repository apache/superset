var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.hatano");

suite.addBatch({
  "hatano": {
    topic: load("hatano"),
    "default": {
      topic: function(geo) { return geo.hatano(); },
      "projections and inverse projections": function(hatano) {
        assert.equalInverse(hatano, [   0,   0], [480,        250]);
        assert.equalInverse(hatano, [   0, -90], [480,        441.538303]);
        assert.equalInverse(hatano, [   0,  90], [480,         53.383198]);
        assert.equalInverse(hatano, [   0, -45], [480,        379.209449]);
        assert.equalInverse(hatano, [   0,  45], [480,        119.704758]);
        assert.equalInverse(hatano, [-180,   0], [ 79.446936, 250]);
        assert.equalInverse(hatano, [ 180,   0], [880.553063, 250]);
        assert.equalInverse(hatano, [-179,  15], [87.7505160, 204.093101]);
        assert.equalInverse(hatano, [   1,   1], [482.225143, 246.920082]);
      }
    }
  }
});

suite.export(module);
