var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.polyconic");

suite.addBatch({
  "polyconic": {
    topic: load("polyconic"),
    "default": {
      topic: function(geo) { return geo.polyconic(); },
      "projections and inverse projections": function(polyconic) {
        assert.equalInverse(polyconic, [  0,   0], [480,        250]);
        assert.equalInverse(polyconic, [  0, -45], [480,        367.809724]);
        assert.equalInverse(polyconic, [  0,  45], [480,        132.190275]);
        assert.equalInverse(polyconic, [-90,   0], [244.380550, 250]);
        assert.equalInverse(polyconic, [ 90,   0], [715.619449, 250]);
        assert.equalInverse(polyconic, [-80,  15], [282.071605, 174.572089]);
        assert.equalInverse(polyconic, [120,  15], [768.810227, 130.477707]);
        assert.equalInverse(polyconic, [  1,   1], [482.617595, 247.381607]);
        assert.equalInverse(polyconic, [ 15,  45], [507.609690, 129.627397]);
        assert.equalInverse(polyconic,[-179,  45], [359.533865,-107.184834]);
      }
    }
  }
});

suite.export(module);
