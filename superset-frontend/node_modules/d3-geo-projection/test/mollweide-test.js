var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.mollweide");

suite.addBatch({
  "mollweide": {
    topic: load("mollweide"),
    "default": {
      topic: function(geo) { return geo.mollweide(); },
      "projections and inverse projections": function(mollweide) {
        assert.equalInverse(mollweide, [   0,   0], [480,        250]);
        assert.equalInverse(mollweide, [   0, -90], [480,        462.132034]);
        assert.equalInverse(mollweide, [   0,  90], [480,         37.867965]);
        assert.equalInverse(mollweide, [   0, -45], [480,        375.591020]);
        assert.equalInverse(mollweide, [   0,  45], [480,        124.408979]);
        assert.equalInverse(mollweide, [-180,   0], [ 55.735931, 250]);
        assert.equalInverse(mollweide, [ 180,   0], [904.264068, 250]);
        assert.equalInverse(mollweide, [-179,  15], [ 67.028260, 206.573390]);
        assert.equalInverse(mollweide, [   1,   1], [482.356801, 247.092196]);
        assert.equalInverse(mollweide, [  45,  87], [495.642877,  40.187699]);
      }
    }
  }
});

suite.export(module);
