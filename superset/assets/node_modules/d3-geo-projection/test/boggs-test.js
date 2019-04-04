var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.boggs");

suite.addBatch({
  "boggs": {
    topic: load("boggs"),
    "default": {
      topic: function(geo) { return geo.boggs(); },
      "projections and inverse projections": function(boggs) {
        assert.equalInverse(boggs, [   0,   0], [480,        250]);
        assert.equalInverse(boggs, [   0, -90], [480,        473.567218]);
        assert.equalInverse(boggs, [   0,  90], [480,         26.432781]);
        assert.equalInverse(boggs, [   0, -45], [480,        371.532657]);
        assert.equalInverse(boggs, [   0,  45], [480,        128.467342]);
        assert.equalInverse(boggs, [-180,   0], [ 32.864228, 250]);
        assert.equalInverse(boggs, [ 180,   0], [927.135771, 250]);
        assert.equalInverse(boggs, [-179,  15], [ 47.500957, 208.708722]);
        assert.equalInverse(boggs, [   1,   1], [482.483785, 247.240908]);
        assert.equalInverse(boggs, [  45,  87], [488.857270,  31.512628]);
      }
    }
  }
});

suite.export(module);
