var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.laskowski");

suite.addBatch({
  "laskowski": {
    topic: load("laskowski"),
    "default": {
      topic: function(geo) { return geo.laskowski(); },
      "projections and inverse projections": function(laskowski) {
        assert.equalInverse(laskowski, [   0,   0], [480,        250]);
        assert.equalInverse(laskowski, [   0, -90], [480,        474.160635]);
        assert.equalInverse(laskowski, [   0,  90], [480,         25.839364]);
        assert.equalInverse(laskowski, [   0, -45], [480,        373.320127]);
        assert.equalInverse(laskowski, [   0,  45], [480,        126.679872]);
        assert.equalInverse(laskowski, [-180,   0], [ 20.290432, 250]);
        assert.equalInverse(laskowski, [ 180,   0], [939.709567, 250]);
        assert.equalInverse(laskowski, [-179,  15], [ 31.276812, 179.551316]);
        assert.equalInverse(laskowski, [   1,   1], [482.553846, 247.371809]);
        assert.equalInverse(laskowski, [  45,  87], [525.904925,  26.307624]);
      }
    }
  }
});

suite.export(module);
