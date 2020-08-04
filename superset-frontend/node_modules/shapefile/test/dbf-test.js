process.env.TZ = "America/Los_Angeles";

var vows = require("vows"),
    assert = require("assert");

var dbf = require("../dbf");

var suite = vows.describe("dbf");

suite.addBatch({
  "The header of a simple dBASE file": {
    topic: readHeader("./test/boolean-property.dbf"),
    "has the expected values": function(header) {
      assert.deepEqual(header, {
        count: 9,
        date: new Date(Date.UTC(1995, 6, 26, 7)),
        version: 3,
        fields: [{name: "foo", type: "L", length: 1}]
      });
    }
  },

  "The header of an empty dBASE file": {
    topic: readHeader("./test/empty.dbf"),
    "has the expected values": function(header) {
      assert.deepEqual(header, {
        count: 0,
        date: new Date(Date.UTC(1995, 6, 26, 7)),
        version: 3,
        fields: []
      });
    }
  },

  "The header of a dBASE file with ISO-8859-1 property names": {
    topic: readHeader("./test/latin1-property.dbf"),
    "has the expected values": function(header) {
      assert.deepEqual(header, {
        count: 1,
        date: new Date(Date.UTC(1995, 6, 26, 7)),
        version: 3,
        fields: [{name: "name", type: "C", length: 80}]
      });
    }
  },

  "The records of a dBASE file with ISO-8859-1 property names": {
    topic: readRecords("./test/latin1-property.dbf"),
    "have the expected values": function(records) {
      assert.deepEqual(records, [
        ["México"]
      ]);
    }
  },

  "The header of a dBASE file with UTF-8 property names": {
    topic: readHeader("./test/utf8-property.dbf", "utf8"),
    "has the expected values": function(header) {
      assert.deepEqual(header, {
        count: 1,
        date: new Date(Date.UTC(1995, 6, 26, 7)),
        version: 3,
        fields: [{name: "☃", type: "C", length: 80}]
      });
    }
  },

  "The records of a dBASE file with UTF-8 property names": {
    topic: readRecords("./test/utf8-property.dbf", "utf8"),
    "have the expected values": function(records) {
      assert.deepEqual(records, [
        ["ηελλο ςορλδ"]
      ]);
    }
  },

  "The records of an empty dBASE file": {
    topic: readRecords("./test/empty.dbf"),
    "have the expected values": function(records) {
      assert.deepEqual(records, []);
    }
  },

  "The records of a simple dBASE file": {
    topic: readRecords("./test/boolean-property.dbf"),
    "have the expected values": function(records) {
      assert.deepEqual(records, [
        [null],
        [true],
        [true],
        [false],
        [false],
        [true],
        [true],
        [false],
        [false]
      ]);
    }
  },

  "The records of a dBASE file with a string property": {
    topic: readRecords("./test/string-property.dbf"),
    "have the expected values": function(records) {
      assert.deepEqual(records, [
        [null],
        ["blue"],
        ["green"]
      ]);
    }
  },

  "The records of a dBASE file with a number property": {
    topic: readRecords("./test/number-property.dbf"),
    "have the expected values": function(records) {
      assert.deepEqual(records, [
        [null],
        [42],
        [-4]
      ]);
    }
  },

  "The records of a dBASE file with a date property": {
    topic: readRecords("./test/date-property.dbf"),
    "have the expected values": function(records) {
      assert.deepEqual(records, [
        [new Date(2013, 0, 2)],
        [new Date(2013, 1, 2)],
        [new Date(2013, 0, 3)]
      ]);
    }
  },

  "The records of a dBASE file with multiple properties": {
    topic: readRecords("./test/mixed-properties.dbf"),
    "have the expected values": function(records) {
      assert.deepEqual(records, [
        [null, null],
        [42, null],
        [null, "blue"]
      ]);
    }
  }
});

function readHeader(path, encoding) {
  return function() {
    var callback = this.callback;
    dbf.read(path, encoding, function(error, header, records) {
      callback(error, header);
    });
  };
}

function readRecords(path, encoding) {
  return function() {
    var callback = this.callback;
    dbf.read(path, encoding, function(error, header, records) {
      callback(error, records);
    });
  };
}

suite.export(module);
