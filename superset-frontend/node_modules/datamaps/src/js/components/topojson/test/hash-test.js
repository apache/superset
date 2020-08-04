var vows = require("vows"),
    assert = require("assert"),
    hash = require("../lib/topojson/hash");

var suite = vows.describe("topojson.hash");

suite.addBatch({
  "hash": {
    topic: function() {
      return hash(16);
    },
    "returns an integer in the range [0, n - 1]": function(hash) {
      for (var i = 0; i < 100; ++i) {
        var code = hash([Math.random() * 100, Math.random() * 100]);
        assert(0 <= code < 16);
        assert.equal(code, code | 0);
      }
    },
    "returns zero for the point [0, 0]": function(hash) {
      assert.deepEqual(hash([0, 0]), 0);
    },
    "returns the expected value for a few test cases": function(hash) {
      assert.deepEqual(hash([0, 1]), 15);
      assert.deepEqual(hash([1, 2]), 15);
    }
  }
});

suite.export(module);
