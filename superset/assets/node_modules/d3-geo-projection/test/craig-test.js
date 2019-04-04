var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.craig");

suite.addBatch({
  "craig": {
    topic: load("craig"),
    "0° parallel": {
      topic: function(geo) { return geo.craig(); },
      "projections and inverse projections": function(craig) {
        assert.equalInverse(craig, [   0,   0], [480,          250]);
        assert.equalInverse(craig, [   0, -90], [480,          400]);
        assert.equalInverse(craig, [   0,  90], [480,          100]);
        assert.equalInverse(craig, [   0, -45], [480,          356.066017]);
        assert.equalInverse(craig, [   0,  45], [480,          143.933982]);
        assert.equalInverse(craig, [-180,   0], [  8.761101,   250]);
        assert.equalInverse(craig, [ 180,   0], [951.238898,   250]);
        assert.equalInverse(craig, [-179,  15], [ 11.3790958, 7198.585721]);
        assert.equalInverse(craig, [   1,   1], [482.617993,   247.382404]);
      }
    },
    "30° parallel": {
      topic: function(geo) {
        return geo.craig().parallel(30);
      },
      "projections and inverse projections": function(craig) {
        assert.equalInverse(craig, [   0,   0], [480,        250]);
        assert.equalInverse(craig, [   0, -30], [480,        313.397459]);
        assert.equalInverse(craig, [   0,  30], [480,        163.397459]);
        assert.equalInverse(craig, [   0, -45], [480,        330.700720]);
        assert.equalInverse(craig, [   0,  45], [480,        118.568686]);
        assert.equalInverse(craig, [   1,   1], [482.617993, 247.373611]);
      }
    }
  }
});

suite.export(module);
