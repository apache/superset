var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.baker");

suite.addBatch({
  "baker": {
    topic: load("baker"),
    "default": {
      topic: function(geo) { return geo.baker(); },
      "projections and inverse projections": function(baker) {
        assert.equalInverse(baker, [   0,   0], [480,        250]);
        assert.equalInverse(baker, [   0, -90], [480,        583.216220]);
        assert.equalInverse(baker, [   0,  90], [480,        -83.216220]);
        assert.equalInverse(baker, [   0, -45], [480,        382.206038]);
        assert.equalInverse(baker, [   0,  45], [480,        117.793961]);
        assert.equalInverse(baker, [-180,   0], [  8.761101, 250]);
        assert.equalInverse(baker, [ 180,   0], [951.238898, 250]);
        assert.equalInverse(baker, [-179,  15], [ 11.379095, 210.273662]);
        assert.equalInverse(baker, [   1,   1], [482.617993, 247.381873]);
        assert.equalInverse(baker, [  45,  87], [491.265043, -68.859378]);
      }
    }
  }
});

suite.export(module);
