var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.craster");

suite.addBatch({
  "craster": {
    topic: load("craster"),
    "default": {
      topic: function(geo) { return geo.craster(); },
      "projections and inverse projections": function(craster) {
        assert.equalInverse(craster, [   0,   0], [480,        250]);
        assert.equalInverse(craster, [   0, -90], [480,        480.248509]);
        assert.equalInverse(craster, [   0,  90], [480,         19.751490]);
        assert.equalInverse(craster, [   0, -45], [480,        369.185398]);
        assert.equalInverse(craster, [   0,  45], [480,        130.814601]);
        assert.equalInverse(craster, [-180,   0], [ 19.502981, 250]);
        assert.equalInverse(craster, [ 180,   0], [940.497018, 250]);
        assert.equalInverse(craster, [-179,  15], [ 35.975533, 209.865040]);
        assert.equalInverse(craster, [   1,   1], [482.557970, 247.320952]);
      }
    }
  }
});

suite.export(module);
