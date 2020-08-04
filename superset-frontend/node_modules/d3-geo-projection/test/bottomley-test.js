var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.bottomley");

suite.addBatch({
  "bottomley": {
    topic: load("bottomley"),
    "1/2 fraction": {
      topic: function(geo) {
        return geo.bottomley();
      },
      "projections and inverse projections": function(bottomley) {
        assert.equalInverse(bottomley, [   0,   0], [480.0000000, 250.000000]);
        assert.equalInverse(bottomley, [   0, -90], [480.0000000, 485.619449]);
        assert.equalInverse(bottomley, [   0,  89], [480.0000000,  16.998544]);
        assert.equalInverse(bottomley, [   0, -45], [480.0000000, 367.809724]);
        assert.equalInverse(bottomley, [   0,  45], [480.0000000, 132.190275]);
        assert.equalInverse(bottomley, [-160,   0], [114.1433513, 162.885611]);
        assert.equalInverse(bottomley, [ 150,   0], [828.8001246, 172.813953]);
        assert.equalInverse(bottomley, [-179,  15], [121.1311782,  94.107801]);
        assert.equalInverse(bottomley, [   1,   1], [482.6175813, 247.378330]);
      }
    }
  }
});

suite.export(module);
