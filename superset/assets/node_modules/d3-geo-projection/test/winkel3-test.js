var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.winkel3");

suite.addBatch({
  "winkel3": {
    topic: load("winkel3"),
    "default": {
      topic: function(geo) { return geo.winkel3(); },
      "projections and inverse projections": function(winkel3) {
        assert.equalInverse(winkel3, [   0,   0], [480,        250]);
        assert.equalInverse(winkel3, [   0, -90], [480,        485.619449]);
        assert.equalInverse(winkel3, [   0,  90], [480,         14.380550]);
        assert.equalInverse(winkel3, [   0, -45], [480,        367.809724]);
        assert.equalInverse(winkel3, [   0,  45], [480,        132.190275]);
        assert.equalInverse(winkel3, [-180,   0], [ 94.380550, 250]);
        assert.equalInverse(winkel3, [ 180,   0], [865.619449, 250]);
        assert.equalInverse(winkel3, [-179,  15], [104.464309, 200.036192]);
        assert.equalInverse(winkel3, [   1,   1], [482.142197, 247.381989]);
        assert.equalInverse(winkel3, [  45,  87], [522.079049,  21.958321]);
      }
    }
  }
});

suite.export(module);
