var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.twoPointEquidistant");

suite.addBatch({
  "twoPointEquidistant": {
    topic: load("two-point-equidistant"),
    "default": {
      topic: function(geo) {
        return geo.twoPointEquidistant().points([[-158, 21.5], [-77, 39]]);
      },
      "projections and inverse projections": function(twoPointEquidistant) {
        assert.equalInverse(twoPointEquidistant, [  0,   0], [779.584187, 227.923736]);
        assert.equalInverse(twoPointEquidistant, [  0, -45], [681.938143, 512.400576]);
        assert.equalInverse(twoPointEquidistant, [  0,  45], [651.469553, 129.175958]);
        assert.equalInverse(twoPointEquidistant, [-80,  15], [570.636740, 313.204406]);
        assert.equalInverse(twoPointEquidistant, [  1,   1], [778.820119, 219.170442]);
        assert.equalInverse(twoPointEquidistant, [ 15,  45], [641.328901,  95.403073]);
      }
    },
    "points ordering is respected": {
      "[[-30, 0], [30, 0]]": {
        topic: function(geo) { return geo.twoPointEquidistant().points([[-30, 0], [30, 0]]); },
        "projections and inverse projections": function(twoPointEquidistant) {
          assert.equalInverse(twoPointEquidistant, [-30,   0], [401.460183, 250]);
          assert.equalInverse(twoPointEquidistant, [ 30,   0], [558.539816, 250]);
          assert.equalInverse(twoPointEquidistant, [  0,  30], [480, 175.272126]);
          assert.equalInverse(twoPointEquidistant, [  0, -30], [480, 324.727873]);
        }
      },
      "[[30, 0], [-30, 0]]": {
        topic: function(geo) { return geo.twoPointEquidistant().points([[30, 0], [-30, 0]]); },
        "projections and inverse projections": function(twoPointEquidistant) {
          assert.equalInverse(twoPointEquidistant, [ 30,   0], [401.460183, 250]);
          assert.equalInverse(twoPointEquidistant, [-30,   0], [558.539816, 250]);
          assert.equalInverse(twoPointEquidistant, [  0, -30], [480, 175.272126]);
          assert.equalInverse(twoPointEquidistant, [  0,  30], [480, 324.727873]);
        }
      }
    }
  }
});

suite.export(module);
