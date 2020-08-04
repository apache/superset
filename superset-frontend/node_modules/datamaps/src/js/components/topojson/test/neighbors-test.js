var vows = require("vows"),
    assert = require("assert"),
    topojson = require("../");

var suite = vows.describe("topojson.neighbors");

suite.addBatch({
  "neighbors": {

    "returns an empty array for empty input": function() {
      var topology = topojson.topology({
        ab: {type: "LineString", coordinates: [[0, 0], [1, 0]]},
        cd: {type: "LineString", coordinates: [[0, 1], [1, 1]]}
      }, {quantization: 2});
      assert.deepEqual(topojson.neighbors([]), []);
    },

    //
    // A-----B
    //
    // C-----D
    //
    "returns an empty array for objects with no neighbors": function() {
      var topology = topojson.topology({
        ab: {type: "LineString", coordinates: [[0, 0], [1, 0]]},
        cd: {type: "LineString", coordinates: [[0, 1], [1, 1]]}
      }, {quantization: 2});
      assert.deepEqual(topojson.neighbors([
        topology.objects.ab,
        topology.objects.cd
      ]), [
        [],
        []
      ]);
    },

    //
    // A-----B-----C
    //
    "geometries that only share isolated points are not considered neighbors": function() {
      var topology = topojson.topology({
        ab: {type: "LineString", coordinates: [[0, 0], [1, 0]]},
        bc: {type: "LineString", coordinates: [[1, 0], [2, 0]]}
      }, {quantization: 3});
      assert.deepEqual(topojson.neighbors([
        topology.objects.ab,
        topology.objects.bc
      ]), [
        [],
        []
      ]);
    },

    //
    // A-----B-----C-----D
    //
    "geometries that share arcs are considered neighbors": function() {
      var topology = topojson.topology({
        abc: {type: "LineString", coordinates: [[0, 0], [1, 0], [2, 0]]},
        bcd: {type: "LineString", coordinates: [[1, 0], [2, 0], [3, 0]]}
      }, {quantization: 4});
      assert.deepEqual(topojson.neighbors([
        topology.objects.abc,
        topology.objects.bcd
      ]), [
        [1],
        [0]
      ]);
    },

    //
    // A-----B-----C-----D
    //
    "geometries that share reversed arcs are considered neighbors": function() {
      var topology = topojson.topology({
        abc: {type: "LineString", coordinates: [[0, 0], [1, 0], [2, 0]]},
        dcb: {type: "LineString", coordinates: [[3, 0], [2, 0], [1, 0]]}
      }, {quantization: 4});
      assert.deepEqual(topojson.neighbors([
        topology.objects.abc,
        topology.objects.dcb
      ]), [
        [1],
        [0]
      ]);
    },

    //
    // A-----B-----C-----D-----E-----F
    //
    "neighbors are returned in sorted order by index": function() {
      var topology = topojson.topology({
        abcd: {type: "LineString", coordinates: [[0, 0], [1, 0], [2, 0], [3, 0]]},
        bcde: {type: "LineString", coordinates: [[1, 0], [2, 0], [3, 0], [4, 0]]},
        cdef: {type: "LineString", coordinates: [[2, 0], [3, 0], [4, 0], [5, 0]]},
        dbca: {type: "LineString", coordinates: [[3, 0], [2, 0], [1, 0], [0, 0]]},
        edcb: {type: "LineString", coordinates: [[4, 0], [3, 0], [2, 0], [1, 0]]},
        fedc: {type: "LineString", coordinates: [[5, 0], [4, 0], [3, 0], [2, 0]]}
      }, {quantization: 6});
      assert.deepEqual(topojson.neighbors([
        topology.objects.abcd,
        topology.objects.bcde,
        topology.objects.cdef,
        topology.objects.dbca,
        topology.objects.edcb,
        topology.objects.fedc
      ]), [
        [1, 2, 3, 4, 5],
        [0, 2, 3, 4, 5],
        [0, 1, 3, 4, 5],
        [0, 1, 2, 4, 5],
        [0, 1, 2, 3, 5],
        [0, 1, 2, 3, 4]
      ]);
    },

    //
    // A-----B-----E     G
    // |     |     |     |\
    // |     |     |     | \
    // |     |     |     |  \
    // |     |     |     |   \
    // |     |     |     |    \
    // D-----C-----F     I-----H
    //
    "the polygons ABCDA and BEFCB are neighbors, but GHIG is not": function() {
      var topology = topojson.topology({
        abcda: {type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]},
        befcb: {type: "Polygon", coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]]},
        ghig: {type: "Polygon", coordinates: [[[3, 0], [4, 1], [3, 1], [3, 0]]]}
      }, {quantization: 5});
      assert.deepEqual(topojson.neighbors([
        topology.objects.abcda,
        topology.objects.befcb,
        topology.objects.ghig
      ]), [
        [1],
        [0],
        []
      ]);
    },

    //
    // A-----------B-----------C
    // |           |           |
    // |           |           |
    // |     D-----E-----F     |
    // |     |           |     |
    // |     |           |     |
    // |     G-----H-----I     |
    // |           |           |
    // |           |           |
    // J-----------K-----------L
    //
    "the polygons ABEDGHKJA and BCLKHIFEB are neighbors, and not listed twice": function() {
      var topology = topojson.topology({
        abdeghkja: {type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [2, 2], [2, 3], [0, 3], [0, 0]]]},
        bclkhifeb: {type: "Polygon", coordinates: [[[2, 0], [4, 0], [4, 3], [2, 3], [2, 2], [3, 2], [3, 1], [2, 1], [2, 0]]]}
      }, {quantization: 5});
      assert.deepEqual(topojson.neighbors([
        topology.objects.abdeghkja,
        topology.objects.bclkhifeb
      ]), [
        [1],
        [0]
      ]);
    }  }
});

suite.export(module);
