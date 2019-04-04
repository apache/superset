var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.mtFlatPolarParabolic");

suite.addBatch({
  "mtFlatPolarParabolic": {
    topic: load("mt-flat-polar-parabolic"),
    "default": {
      topic: function(geo) { return geo.mtFlatPolarParabolic(); },
      "projections and inverse projections": function(mtFlatPolarParabolic) {
        assert.equalInverse(mtFlatPolarParabolic, [   0,   0], [480,        250]);
        assert.equalInverse(mtFlatPolarParabolic, [   0, -90], [480,        458.309522]);
        assert.equalInverse(mtFlatPolarParabolic, [   0,  90], [480,         41.690477]);
        assert.equalInverse(mtFlatPolarParabolic, [   0, -45], [480,        374.430617]);
        assert.equalInverse(mtFlatPolarParabolic, [   0,  45], [480,        125.569382]);
        assert.equalInverse(mtFlatPolarParabolic, [-180,   0], [ 43.717556, 250]);
        assert.equalInverse(mtFlatPolarParabolic, [ 180,   0], [916.282443, 250]);
        assert.equalInverse(mtFlatPolarParabolic, [-179,  15], [ 58.080254, 207.678319]);
        assert.equalInverse(mtFlatPolarParabolic, [   1,   1], [482.423493, 247.172271]);
      }
    }
  }
});

suite.export(module);
