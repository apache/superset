var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.foucaut");

suite.addBatch({
  "foucaut": {
    topic: load("foucaut"),
    "default": {
      topic: function(geo) { return geo.foucaut(); },
      "projections and inverse projections": function(foucaut) {
        assert.equalInverse(foucaut, [  0,   0], [480,        250]);
        assert.equalInverse(foucaut, [  0, -45], [480,        360.126163]);
        assert.equalInverse(foucaut, [  0,  45], [480,        139.873836]);
        assert.equalInverse(foucaut, [-90,   0], [214.131922, 250]);
        assert.equalInverse(foucaut, [ 90,   0], [745.868077, 250]);
        assert.equalInverse(foucaut, [-80,  15], [255.614606, 214.997803]);
        assert.equalInverse(foucaut, [  1,   1], [482.953414, 247.679804]);
        assert.equalInverse(foucaut, [ 15,  45], [506.744263, 139.873836]);
      }
    }
  }
});

suite.export(module);
