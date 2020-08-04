var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.berghaus");

suite.addBatch({
  "berghaus": {
    topic: load("berghaus"),
    "default": {
      topic: function(geo) { return geo.berghaus(); },
      "projections and inverse projections": function(berghaus) {
        assert.equalInverse(berghaus, [  0,   0], [480,        250]);
        assert.equalInverse(berghaus, [  0, -45], [480,        367.809724]);
        assert.equalInverse(berghaus, [  0,  45], [480,        132.190275]);
        assert.equalInverse(berghaus, [-90,   0], [244.380550, 250]);
        assert.equalInverse(berghaus, [ 90,   0], [715.619449, 250]);
        assert.equalInverse(berghaus, [-80,  15], [277.038148, 194.777583]);
        assert.equalInverse(berghaus, [  1,   1], [482.617728, 247.381873]);
        assert.equalInverse(berghaus, [ 15,  45], [510.778518, 131.080938]);
        assert.equalInverse(berghaus, [120,  30], [750.967904, 114.867516]);
        assert.equalInverse(berghaus, [110,  10], [759.454234, 183.963114]);
      }
    }
  }
});

suite.export(module);
