var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.twoPointAzimuthal");

suite.addBatch({
  "twoPointAzimuthal": {
    topic: load("two-point-azimuthal"),
    "default": {
      topic: function(geo) { return geo.twoPointAzimuthal(); },
      "projections and inverse projections": function(twoPointAzimuthal) {
        assert.equalInverse(twoPointAzimuthal, [  0,   0], [ 480,        250]);
        assert.equalInverse(twoPointAzimuthal, [  0, -45], [ 480,        400]);
        assert.equalInverse(twoPointAzimuthal, [  0,  45], [ 480,        100]);
        assert.equalInverse(twoPointAzimuthal, [-80,  15], [-370.692272,  18.541314]);
        assert.equalInverse(twoPointAzimuthal, [  1,   1], [ 482.618259, 247.381341]);
        assert.equalInverse(twoPointAzimuthal, [ 15,  45], [ 520.192378,  94.708572]);
      }
    },
    "Honolulu, HI ↔ Washington, DC": {
      topic: function(geo) { return geo.twoPointAzimuthal().points([[-158, 21.5], [-77, 39]]); },
      "projections and inverse projections": function(twoPointAzimuthal) {
        assert.equalInverse(twoPointAzimuthal, [-158, 21], [ 393.154103, 251.309973]);
        assert.equalInverse(twoPointAzimuthal, [ -77, 39], [ 565.922652, 250]);
        assert.equalInverse(twoPointAzimuthal, [-121, 37], [ 481.201449, 251.540304]);
      }
    },
    "points ordering is respected": {
      "[[-30, 0], [30, 0]]": {
        topic: function(geo) { return geo.twoPointAzimuthal().points([[-30, 0], [30, 0]]); },
        "projections and inverse projections": function(twoPointAzimuthal) {
          assert.equalInverse(twoPointAzimuthal, [-30,   0], [405, 250]);
          assert.equalInverse(twoPointAzimuthal, [ 30,   0], [555, 250]);
          assert.equalInverse(twoPointAzimuthal, [  0,  30], [480, 163.397459]);
          assert.equalInverse(twoPointAzimuthal, [  0, -30], [480, 336.602540]);
        }
      },
      "[[30, 0], [-30, 0]]": {
        topic: function(geo) { return geo.twoPointAzimuthal().points([[30, 0], [-30, 0]]); },
        "projections and inverse projections": function(twoPointAzimuthal) {
          assert.equalInverse(twoPointAzimuthal, [ 30,   0], [405, 250]);
          assert.equalInverse(twoPointAzimuthal, [-30,   0], [555, 250]);
          assert.equalInverse(twoPointAzimuthal, [  0, -30], [480, 163.397459]);
          assert.equalInverse(twoPointAzimuthal, [  0,  30], [480, 336.602540]);
        }
      }
    }
  }
});

suite.export(module);
