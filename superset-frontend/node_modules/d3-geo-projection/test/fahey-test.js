var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.fahey");

suite.addBatch({
  "fahey": {
    topic: load("fahey"),
    "default": {
      topic: function(geo) { return geo.fahey(); },
      "projections and inverse projections": function(fahey) {
        assert.equalInverse(fahey, [   0,   0], [480,        250]);
        assert.equalInverse(fahey, [   0, -90], [480,        522.872806]);
        assert.equalInverse(fahey, [   0,  90], [480,        -22.872806]);
        assert.equalInverse(fahey, [   0, -45], [480,        363.027617]);
        assert.equalInverse(fahey, [   0,  45], [480,        136.972382]);
        assert.equalInverse(fahey, [-180,   0], [ 93.983693, 250]);
        assert.equalInverse(fahey, [ 180,   0], [866.016306, 250]);
        assert.equalInverse(fahey, [-179,  15], [ 99.469475, 214.075613]);
        assert.equalInverse(fahey, [   1,   1], [482.144453, 247.618675]);
      }
    }
  }
});

suite.export(module);
