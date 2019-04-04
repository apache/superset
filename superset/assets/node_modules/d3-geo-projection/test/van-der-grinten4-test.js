var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.vanDerGrinten4");

suite.addBatch({
  "vanDerGrinten4": {
    topic: load("van-der-grinten4"),
    "default": {
      topic: function(geo) { return geo.vanDerGrinten4(); },
      "doesn't generate NaNs": function(vanDerGrinten4) {
        assert.inDelta(vanDerGrinten4([20, 1e-7]), [532.359877, 250], 1e-6);
        assert.inDelta(vanDerGrinten4([180.0000000000001, -90.00000000000003]), [480, 485.619449], 1e-6);
        assert.inDelta(vanDerGrinten4([-180, -90.00000000000003]), [480, 485.619449], 1e-6);
      },
      "projections and inverse projections": function(vanDerGrinten4) {
        assert.equalInverse(vanDerGrinten4, [  0,   0], [480,        250]);
        assert.equalInverse(vanDerGrinten4, [  0, -45], [480,        367.809724]);
        assert.equalInverse(vanDerGrinten4, [  0,  45], [480,        132.190275]);
        assert.equalInverse(vanDerGrinten4, [-90,   0], [244.380550, 250]);
        assert.equalInverse(vanDerGrinten4, [ 90,   0], [715.619449, 250]);
        assert.equalInverse(vanDerGrinten4, [-80,  15], [274.023642, 209.610498]);
        assert.equalInverse(vanDerGrinten4, [  1,   1], [482.617670, 247.382005]);
        assert.equalInverse(vanDerGrinten4, [ 15,  45], [509.605158, 131.892658]);
        assert.equalInverse(vanDerGrinten4, [-180, 15], [ 12.226093, 204.955105]);
      }
    }
  }
});

suite.export(module);
