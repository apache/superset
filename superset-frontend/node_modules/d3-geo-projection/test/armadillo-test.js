var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.armadillo");

suite.addBatch({
  "armadillo": {
    topic: load("armadillo"),
    "default": {
      topic: function(geo) { return geo.armadillo(); },
      "projections and inverse projections": function(armadillo) {
        assert.equalInverse(armadillo, [   0,   0], [480,        250]);
        // TODO: needs D3 core support
        // assert.isNaN(armadillo([0, -90])[0]);
        assert.equalInverse(armadillo, [   0,  90], [480,         57.743085]);
        assert.equalInverse(armadillo, [   0, -45], [480,        334.643146]);
        assert.equalInverse(armadillo, [   0,  45], [480,        135.304239]);
        // TODO figure out why the inverse doesn't match exactly.
        // assert.equalInverse(armadillo, [-180,   0], [180, 147.393957]);
        // assert.equalInverse(armadillo, [ 180,   0], [780, 147.393957]);
        assert.equalInverse(armadillo, [-179,  15], [185.122354, 111.792545]);
        assert.equalInverse(armadillo, [   1,   1], [482.617761, 247.528295]);
        assert.equalInverse(armadillo, [  45,  87], [540.406730,  56.511657]);
      }
    }
  }
});

suite.export(module);
