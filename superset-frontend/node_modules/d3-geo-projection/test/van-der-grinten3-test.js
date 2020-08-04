var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.vanDerGrinten3");

suite.addBatch({
  "vanDerGrinten3": {
    topic: load("van-der-grinten3"),
    "default": {
      topic: function(geo) { return geo.vanDerGrinten3(); },
      "projections and inverse projections": function(vanDerGrinten3) {
        assert.equalInverse(vanDerGrinten3, [  0,   0], [480,        250]);
        assert.equalInverse(vanDerGrinten3, [  0, -45], [480,        376.268082]);
        assert.equalInverse(vanDerGrinten3, [  0,  45], [480,        123.731917]);
        assert.equalInverse(vanDerGrinten3, [-90,   0], [244.380550, 250]);
        assert.equalInverse(vanDerGrinten3, [ 90,   0], [715.619449, 250]);
        assert.equalInverse(vanDerGrinten3, [-80,  15], [271.793387, 210.453529]);
        assert.equalInverse(vanDerGrinten3, [  1,   1], [482.617913, 247.381925]);
        assert.equalInverse(vanDerGrinten3, [ 15,  45], [516.468521, 123.731917]);
      }
    }
  }
});

suite.export(module);
