var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.mtFlatPolarQuartic");

suite.addBatch({
  "mtFlatPolarQuartic": {
    topic: load("mt-flat-polar-quartic"),
    "default": {
      topic: function(geo) { return geo.mtFlatPolarQuartic(); },
      "projections and inverse projections": function(mtFlatPolarQuartic) {
        assert.equalInverse(mtFlatPolarQuartic, [   0,   0], [480,        250]);
        assert.equalInverse(mtFlatPolarQuartic, [   0, -90], [480,        448.848144]);
        assert.equalInverse(mtFlatPolarQuartic, [   0,  90], [480,         51.151855]);
        assert.equalInverse(mtFlatPolarQuartic, [   0, -45], [480,        371.001020]);
        assert.equalInverse(mtFlatPolarQuartic, [   0,  45], [480,        128.998979]);
        assert.equalInverse(mtFlatPolarQuartic, [-180,   0], [146.783779, 250]);
        assert.equalInverse(mtFlatPolarQuartic, [ 180,   0], [813.216220, 250]);
        assert.equalInverse(mtFlatPolarQuartic, [-179,  15], [155.997702, 208.275733]);
        assert.equalInverse(mtFlatPolarQuartic, [   1,   1], [481.851018, 247.207163]);
      }
    }
  }
});

suite.export(module);
