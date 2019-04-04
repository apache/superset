var vows = require("vows"),
    assert = require("assert"),
    hashtable = require("../lib/topojson/hashtable");

var suite = vows.describe("topojson.hashtable");

suite.addBatch({
  "hashtable": {
    topic: function() {
      return hashtable;
    },
    "rounds size up to the nearest power of two": function(hashtable) {
      assert.equal(hashtable(16).size, 16);
      assert.equal(hashtable(17).size, 32);
    },
    "peek": {
      "returns the array of values for the specified key": function(hashtable) {
        var h = hashtable(16);
        h.get([0, 0]).push(1, 2, 3, 4);
        h.get([0, 1]).push(5);
        h.get([1, 0]).push(7, 6);
        assert.deepEqual(h.peek([0, 0]), [1, 2, 3, 4]);
        assert.deepEqual(h.peek([0, 1]), [5]);
        assert.deepEqual(h.peek([1, 0]), [7, 6]);
      },
      "returns null if there are no values for the specified key": function(hashtable) {
        var h = hashtable(16);
        h.get([0, 0]).push(0);
        assert.isNull(h.peek([0, 1]));
        assert.isNull(h.peek([1, 0]));
      },
      "handles hash collisions correctly": function(hashtable) {
        var h = hashtable(16);
        h.get([0, 1]).push(0);
        h.get([1, 2]).push(2);
        assert.deepEqual(h.peek([0, 1]), [0]);
        assert.deepEqual(h.peek([1, 2]), [2]);
      }
    },
    "get": {
      "returns the array of values for the specified key": function(hashtable) {
        var h = hashtable(16);
        h.get([0, 0]).push(1, 2, 3, 4);
        h.get([0, 1]).push(5);
        h.get([1, 0]).push(7, 6);
        assert.deepEqual(h.get([0, 0]), [1, 2, 3, 4]);
        assert.deepEqual(h.get([0, 1]), [5]);
        assert.deepEqual(h.get([1, 0]), [7, 6]);
      },
      "creates a new array and saves it to the hashtable for new keys": function(hashtable) {
        var h = hashtable(16);
        h.get([0, 0]);
        assert.deepEqual(h.peek([0, 0]), []);
      },
      "handles hash collisions correctly": function(hashtable) {
        var h = hashtable(16);
        h.get([0, 1]).push(0);
        h.get([1, 2]).push(2);
        assert.deepEqual(h.get([0, 1]), [0]);
        assert.deepEqual(h.get([1, 2]), [2]);
      }
    }
  }
});

suite.export(module);
