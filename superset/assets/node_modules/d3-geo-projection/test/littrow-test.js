var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.littrow");

suite.addBatch({
  "littrow": {
    topic: load("littrow"),
    "default": {
      topic: function(geo) { return geo.littrow(); },
      "projections and inverse projections": function(littrow) {
        assert.equalInverse(littrow, [  0,   0], [480,        250]);
        assert.equalInverse(littrow, [  0, -45], [480,        400]);
        assert.equalInverse(littrow, [  0,  45], [480,        100]);
        assert.equalInverse(littrow, [-90,   0], [330,        250]);
        assert.equalInverse(littrow, [ 90,   0], [630,        250]);
        assert.equalInverse(littrow, [-80,  15], [327.067798, 243.020666]);
        assert.equalInverse(littrow, [  1,   1], [482.618259, 247.382139]);
        assert.equalInverse(littrow, [ 15,  45], [534.903810, 105.111126]);
      }
    }
  }
});

suite.export(module);
