var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.hill");

suite.addBatch({
  "hill": {
    topic: load("hill"),
    "default": {
      topic: function(geo) { return geo.hill(); },
      "projections and inverse projections": function(hill) {
        assert.equalInverse(hill, [   0,   0], [480,        250]);
        assert.equalInverse(hill, [   0, -90], [480,        416.823782]);
        assert.equalInverse(hill, [   0,  90], [480,         18.873653]);
        assert.equalInverse(hill, [   0, -45], [480,        364.499449]);
        assert.equalInverse(hill, [   0,  45], [480,        113.253357]);
        assert.equalInverse(hill, [-180,   0], [122.993559,  59.760268]);
        assert.equalInverse(hill, [ 180,   0], [837.006440,  59.760268]);
        assert.equalInverse(hill, [-179,  15], [154.461200,  25.636205]);
        assert.equalInverse(hill, [   1,   1], [482.330467, 247.058682]);
        assert.equalInverse(hill, [  45,  87], [508.223694,  17.762871]);
      }
    }
  }
});

suite.export(module);
