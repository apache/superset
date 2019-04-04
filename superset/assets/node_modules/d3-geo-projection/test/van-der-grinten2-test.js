var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.vanDerGrinten2");

suite.addBatch({
  "vanDerGrinten2": {
    topic: load("van-der-grinten2"),
    "default": {
      topic: function(geo) { return geo.vanDerGrinten2(); },
      "projections and inverse projections": function(vanDerGrinten2) {
        assert.equalInverse(vanDerGrinten2, [  0,   0], [480,        250]);
        assert.equalInverse(vanDerGrinten2, [  0, -45], [480,        376.268082]);
        assert.equalInverse(vanDerGrinten2, [  0,  45], [480,        123.731917]);
        assert.equalInverse(vanDerGrinten2, [-90,   0], [244.380550, 250]);
        assert.equalInverse(vanDerGrinten2, [ 90,   0], [715.619449, 250]);
        assert.equalInverse(vanDerGrinten2, [-80,  15], [272.324393, 202.707670]);
        assert.equalInverse(vanDerGrinten2, [  1,   1], [482.617913, 247.381844]);
        assert.equalInverse(vanDerGrinten2, [ 15,  45], [516.432290, 122.918417]);
      }
    }
  }
});

suite.export(module);
