var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.hammer");

suite.addBatch({
  "hammer": {
    topic: load("hammer"),
    "quarticAuthalic": {
      topic: function(geo) {
        return geo.hammer().coefficient(Infinity);
      },
      "projections and inverse projections": function(quarticAuthalic) {
        assert.equalInverse(quarticAuthalic, [   0,   0], [480,        250]);
        assert.equalInverse(quarticAuthalic, [   0, -90], [480,        462.132034]);
        assert.equalInverse(quarticAuthalic, [   0,  90], [480,         37.867965]);
        assert.equalInverse(quarticAuthalic, [   0, -45], [480,        364.805029]);
        assert.equalInverse(quarticAuthalic, [   0,  45], [480,        135.194970]);
        assert.equalInverse(quarticAuthalic, [-180,   0], [  8.761101, 250]);
        assert.equalInverse(quarticAuthalic, [ 180,   0], [951.238898, 250]);
        assert.equalInverse(quarticAuthalic, [-179,  15], [ 23.441040, 210.842142]);
        assert.equalInverse(quarticAuthalic, [   1,   1], [482.617694, 247.382039]);
      }
    }
  }
});

suite.export(module);
