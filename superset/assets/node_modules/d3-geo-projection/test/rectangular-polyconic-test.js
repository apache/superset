var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.rectangularPolyconic");

suite.addBatch({
  "rectangularPolyconic": {
    topic: load("rectangular-polyconic"),
    "0° parallel": {
      topic: function(geo) { return geo.rectangularPolyconic(); },
      "projections and inverse projections": function(rectangularPolyconic) {
        assert.equalInverse(rectangularPolyconic, [  0,   0], [480,        250]);
        assert.equalInverse(rectangularPolyconic, [  0, -45], [480,        367.809724]);
        assert.equalInverse(rectangularPolyconic, [  0,  45], [480,        132.190275]);
        assert.equalInverse(rectangularPolyconic, [-90,   0], [244.380550, 250]);
        assert.equalInverse(rectangularPolyconic, [ 90,   0], [715.619449, 250]);
        assert.equalInverse(rectangularPolyconic, [-80,  15], [284.093092, 175.331715]);
        assert.equalInverse(rectangularPolyconic, [  1,   1], [482.617595, 247.381607]);
        assert.equalInverse(rectangularPolyconic, [ 15,  45], [507.532140, 129.641898]);
        assert.equalInverse(rectangularPolyconic, [120,  45], [623.475113,  25.949753]);
        assert.equalInverse(rectangularPolyconic, [150,   5], [866.178341, 192.852256]);
        assert.equalInverse(rectangularPolyconic, [179,   5], [938.342281, 174.509780]);
        assert.equalInverse(rectangularPolyconic, [179,  85], [491.937069,   8.894941]);
      }
    },
    "30° parallel": {
      topic: function(geo) {
        return geo.rectangularPolyconic().parallel(30);
      },
      "projections and inverse projections": function(rectangularPolyconic) {
        assert.equalInverse(rectangularPolyconic, [  0,   0], [480,        250]);
        assert.equalInverse(rectangularPolyconic, [  0, -45], [480,        367.809724]);
        assert.equalInverse(rectangularPolyconic, [  0,  45], [480,        132.190275]);
        assert.equalInverse(rectangularPolyconic, [-90,   0], [231.471862, 250]);
        assert.equalInverse(rectangularPolyconic, [ 90,   0], [728.528137, 250]);
        assert.equalInverse(rectangularPolyconic, [-80,  15], [276.290019, 172.350142]);
        assert.equalInverse(rectangularPolyconic, [  1,   1], [482.617611, 247.381607]);
        assert.equalInverse(rectangularPolyconic, [ 15,  45], [507.570850, 129.634665]);
        assert.equalInverse(rectangularPolyconic, [120,  45], [626.969384,  12.190275]);
        assert.equalInverse(rectangularPolyconic, [150,   5], [930.583263, 176.642758]);
        assert.equalInverse(rectangularPolyconic, [179,   5],[1055.344304, 137.492301]);
      }
    }
  }
});

suite.export(module);
