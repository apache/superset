var vows = require("vows"),
    assert = require("assert");

var shp = require("../shp");

var suite = vows.describe("shp");

suite.addBatch({
  "The header of a simple shapefile": {
    topic: readHeader("./test/boolean-property.shp"),
    "has the expected values": function(header) {
      assert.deepEqual(header, {
        fileCode: 9994,
        version: 1000,
        shapeType: 1,
        box: [1, 2, 17, 18]
      });
    }
  },

  "The header of an empty shapefile": {
    topic: readHeader("./test/empty.shp"),
    "has the expected values": function(header) {
      assert.deepEqual(header, {
        fileCode: 9994,
        version: 1000,
        shapeType: 3,
        box: [0, 0, 0, 0]
      });
    }
  },

  "The records of an empty shapefile": {
    topic: readRecords("./test/empty.shp"),
    "have the expected values": function(records) {
      assert.deepEqual(records, []);
    }
  },

  "The records of a shapefile of points": {
    topic: readRecords("./test/points.shp"),
    "have the expected values": function(records) {
      assert.deepEqual(records, [
        {shapeType: 1, x: 1, y: 2},
        {shapeType: 1, x: 3, y: 4},
        {shapeType: 1, x: 5, y: 6},
        {shapeType: 1, x: 7, y: 8},
        {shapeType: 1, x: 9, y: 10},
        {shapeType: 1, x: 11, y: 12},
        {shapeType: 1, x: 13, y: 14},
        {shapeType: 1, x: 15, y: 16},
        {shapeType: 1, x: 17, y: 18}
      ]);
    }
  },

  "The records of a shapefile of multipoints": {
    topic: readRecords("./test/multipoints.shp"),
    "have the expected values": function(records) {
      assert.deepEqual(records, [
        {shapeType: 8, box: [1, 2, 9, 10], points: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]},
        {shapeType: 8, box: [11, 12, 19, 20], points: [[11, 12], [13, 14], [15, 16], [17, 18], [19, 20]]}
      ]);
    }
  },

  "The records of a shapefile of polylines": {
    topic: readRecords("./test/polylines.shp"),
    "have the expected values": function(records) {
      assert.deepEqual(records, [
        {shapeType: 3, box: [1, 2, 9, 10], parts: [0], points: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]},
        {shapeType: 3, box: [11, 12, 19, 20], parts: [0, 2], points: [[11, 12], [13, 14], [15, 16], [17, 18], [19, 20]]}
      ]);
    }
  },

  "The records of a shapefile of polygons": {
    topic: readRecords("./test/polygons.shp"),
    "have the expected values": function(records) {
      assert.deepEqual(records, [
        {shapeType: 5, box: [0, 0, 1, 1], parts: [0], points: [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]},
        {shapeType: 5, box: [0, 0, 4, 4], parts: [0, 5], points: [[0, 0], [0, 4], [4, 4], [4, 0], [0, 0], [1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]},
        {shapeType: 5, box: [2, 2, 5, 5], parts: [0, 5], points: [[2, 2], [2, 3], [3, 3], [3, 2], [2, 2], [4, 4], [4, 5], [5, 5], [5, 4], [4, 4]]}
      ]);
    }
  },

  "The records of a shapefile with null features": {
    topic: readRecords("./test/null.shp"),
    "have the expected values": function(records) {
      assert.deepEqual(records, [
        {shapeType: 1, x: 1, y: 2},
        null,
        {shapeType: 1, x: 5, y: 6},
        null,
        null,
        {shapeType: 1, x: 11, y: 12},
        {shapeType: 1, x: 13, y: 14},
        null,
        {shapeType: 1, x: 17, y: 18}
      ]);
    }
  }
});

function readHeader(path, encoding) {
  return function() {
    var callback = this.callback;
    shp.read(path, encoding, function(error, header, records) {
      callback(error, header);
    });
  };
}

function readRecords(path, encoding) {
  return function() {
    var callback = this.callback;
    shp.read(path, encoding, function(error, header, records) {
      callback(error, records);
    });
  };
}

suite.export(module);
