var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.mtFlatPolarSinusoidal");

suite.addBatch({
  "mtFlatPolarSinusoidal": {
    topic: load("mt-flat-polar-sinusoidal"),
    "default": {
      topic: function(geo) { return geo.mtFlatPolarSinusoidal(); },
      "projections and inverse projections": function(mtFlatPolarSinusoidal) {
        assert.equalInverse(mtFlatPolarSinusoidal, [   0,   0], [480,        250]);
        assert.equalInverse(mtFlatPolarSinusoidal, [   0, -90], [480,        465.967909]);
        assert.equalInverse(mtFlatPolarSinusoidal, [   0,  90], [480,         34.032090]);
        assert.equalInverse(mtFlatPolarSinusoidal, [   0, -45], [480,        377.345812]);
        assert.equalInverse(mtFlatPolarSinusoidal, [   0,  45], [480,        122.654187]);
        assert.equalInverse(mtFlatPolarSinusoidal, [-180,   0], [ 48.064181, 250]);
        assert.equalInverse(mtFlatPolarSinusoidal, [ 180,   0], [911.935818, 250]);
        assert.equalInverse(mtFlatPolarSinusoidal, [-179,  15], [ 64.236235, 207.185461]);
        assert.equalInverse(mtFlatPolarSinusoidal, [   1,   1], [482.399298, 247.143795]);
      }
    }
  }
});

suite.export(module);
