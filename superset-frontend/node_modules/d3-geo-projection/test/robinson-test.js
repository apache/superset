var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.robinson");

suite.addBatch({
  "robinson": {
    topic: load("robinson"),
    "default": {
      topic: function(geo) { return geo.robinson(); },
      "projections and inverse projections": function(robinson) {
        assert.equalInverse(robinson, [   1,   1], [482.617847, 247.036246]);
        assert.equalInverse(robinson, [  45,  87], [545.397120,  14.047945]);
        assert.equalInverse(robinson, [   0,   0], [480,        250]);
        assert.equalInverse(robinson, [   0, -90], [480,        489.012369]);
        assert.equalInverse(robinson, [   0,  90], [480,         10.987630]);
        assert.equalInverse(robinson, [   0, -45], [480,        383.153790]);
        assert.equalInverse(robinson, [   0,  45], [480,        116.846209]);
        assert.equalInverse(robinson, [-180,   0], [  8.761101, 250]);
        assert.equalInverse(robinson, [ 180,   0], [951.238898, 250]);
        assert.equalInverse(robinson, [-179,  15], [ 16.065304, 205.543699]);
      }
    }
  }
});

suite.export(module);
