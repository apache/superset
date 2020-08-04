var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.eisenlohr");

suite.addBatch({
  "eisenlohr": {
    topic: load("eisenlohr"),
    "default": {
      topic: function(geo) { return geo.eisenlohr(); },
      "projections and inverse projections": function(eisenlohr) {
        assert.equalInverse(eisenlohr, [  0,   0], [480,         250]);
        assert.equalInverse(eisenlohr, [  0, -45], [480,         377.392745]);
        assert.equalInverse(eisenlohr, [  0,  45], [480,         122.607254]);
        assert.equalInverse(eisenlohr, [  0,  90], [480,        -125.237349]);
        assert.equalInverse(eisenlohr, [  0,  80], [480,         -35.291289]);
        assert.equalInverse(eisenlohr, [-90,   0], [211.729605,  250]);
        assert.equalInverse(eisenlohr, [ 90,   0], [748.270394,  250]);
        assert.equalInverse(eisenlohr, [-80,  15], [251.382362,  196.991404]);
        assert.equalInverse(eisenlohr, [  1,   1], [482.617916,  247.381795]);
        assert.equalInverse(eisenlohr, [ 15,  80], [497.624439,  -36.694591]);
        assert.equalInverse(eisenlohr, [100,  50], [728.016830,   33.813625]);
        assert.equalInverse(eisenlohr, [179,  80], [562.029382, -249.246945]);
        assert.equalInverse(eisenlohr, [179,  89], [482.929745, -140.157928]);
        assert.equalInverse(eisenlohr, [180,   0], [1411.685689, 250]);
        assert.equalInverse(eisenlohr, [180,  60], [842.900816, -348.742594]);
        assert.equalInverse(eisenlohr, [180,  80], [560.323951, -251.261143]);
        assert.equalInverse(eisenlohr, [180,  89], [482.673656, -140.229826]);
        assert.inDelta(eisenlohr.invert([480 + 6 * 3, 250 - 126 * 3]), [108.053239, 88.652617], 1e-6);
      }
    }
  }
});

suite.export(module);
