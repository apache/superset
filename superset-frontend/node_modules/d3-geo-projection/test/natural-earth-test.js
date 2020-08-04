var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.naturalEarth");

suite.addBatch({
  "naturalEarth": {
    topic: load("natural-earth"),
    "default": {
      topic: function(geo) { return geo.naturalEarth(); },
      "projections and inverse projections": function(naturalEarth) {
        assert.equalInverse(naturalEarth, [   0,   0], [480,        250]);
        assert.equalInverse(naturalEarth, [   0, -90], [480,        463.358576]);
        assert.equalInverse(naturalEarth, [   0,  90], [480,         36.641423]);
        assert.equalInverse(naturalEarth, [   0, -45], [480,        368.957709]);
        assert.equalInverse(naturalEarth, [   0,  45], [480,        131.042290]);
        assert.equalInverse(naturalEarth, [-180,   0], [ 69.692291, 250]);
        assert.equalInverse(naturalEarth, [ 180,   0], [890.307708, 250]);
        assert.equalInverse(naturalEarth, [-179,  15], [ 76.241138, 210.406263]);
        assert.equalInverse(naturalEarth, [   1,   1], [482.279382, 247.363076]);
        assert.equalInverse(naturalEarth, [  45,  87], [541.511740,  38.772664]);
      }
    }
  }
});

suite.export(module);
