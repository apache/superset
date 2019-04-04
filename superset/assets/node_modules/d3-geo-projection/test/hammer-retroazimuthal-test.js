var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.hammerRetroazimuthal");

suite.addBatch({
  "hammerRetroazimuthal": {
    topic: load("hammer-retroazimuthal"),
    "0° parallel": {
      topic: function(geo) { return geo.hammerRetroazimuthal(); },
      "projections and inverse projections": function(hammerRetroazimuthal) {
        assert.equalInverse(hammerRetroazimuthal, [  0,   0], [480,        250]);
        assert.equalInverse(hammerRetroazimuthal, [  0, -45], [480,        367.809724]);
        assert.equalInverse(hammerRetroazimuthal, [  0,  45], [480,        132.190275]);
        assert.equalInverse(hammerRetroazimuthal, [-80,  15], [269.878429, 240.410727]);
        assert.equalInverse(hammerRetroazimuthal, [  1,   1], [482.618126, 247.382271]);
        assert.equalInverse(hammerRetroazimuthal, [ 15,  45], [523.527397, 135.133006]);
        assert.equalInverse(hammerRetroazimuthal, [120,  30], [770.915361, 166.019968]);
      }
    },
    "30° parallel": {
      topic: function(geo) {
        return geo.hammerRetroazimuthal().parallel(30);
      },
      "projections and inverse projections": function(hammerRetroazimuthal) {
        assert.equalInverse(hammerRetroazimuthal, [  0,   0], [480,        328.539816]);
        assert.equalInverse(hammerRetroazimuthal, [  0, -45], [480,        446.349540]);
        assert.equalInverse(hammerRetroazimuthal, [  0,  45], [480,        210.730091]);
        assert.equalInverse(hammerRetroazimuthal, [-80,  15], [308.029420, 339.535421]);
        assert.equalInverse(hammerRetroazimuthal, [  1,   1], [482.367018, 325.925728]);
        assert.equalInverse(hammerRetroazimuthal, [ 15,  45], [514.251164, 213.638684]);
        assert.equalInverse(hammerRetroazimuthal, [120,  30], [672.322402,  83.443914]);
      }
    }
  }
});

suite.export(module);
