var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.modifiedStereographic");

suite.addBatch({
  "modifiedStereographic": {
    topic: load("modified-stereographic"),
    "default": {
      topic: function(geo) { return geo.modifiedStereographic(); },
      "projections and inverse projections": function(modifiedStereographic) {
        assert.equalInverse(modifiedStereographic, [  0,   0], [480,        250]);
        assert.equalInverse(modifiedStereographic, [  0, -45], [480,        363.225114]);
        assert.equalInverse(modifiedStereographic, [  0,  45], [480,        136.774885]);
        assert.equalInverse(modifiedStereographic, [-90,   0], [179.334000, 250]);
        assert.equalInverse(modifiedStereographic, [ 90,   0], [780.666000, 250]);
        assert.equalInverse(modifiedStereographic, [-80,  15], [244.261692, 178.493228]);
        assert.equalInverse(modifiedStereographic, [  1,   1], [482.420181, 247.579387]);
        assert.equalInverse(modifiedStereographic, [ 15,  45], [508.846677, 134.854913]);
      }
    }
  }
});

suite.export(module);
