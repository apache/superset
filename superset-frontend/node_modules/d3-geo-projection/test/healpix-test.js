var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.healpix");

suite.addBatch({
  "healpix": {
    topic: load("healpix"),
    "default": {
      topic: function(geo) { return geo.healpix(); },
      "projections and inverse projections": function(healpix) {
        assert.equalInverse(healpix, [  0,   0], [480,        250]);
        assert.equalInverse(healpix, [  1, -45], [487.454782, 356.202278]);
        assert.equalInverse(healpix, [  1,  45], [487.454782, 143.797721]);
        assert.equalInverse(healpix, [-90,   0], [362.190275, 250]);
        assert.equalInverse(healpix, [ 90,   0], [597.809724, 250]);
        assert.equalInverse(healpix, [-80,  15], [375.280244, 211.177143]);
        assert.equalInverse(healpix, [  1,   1], [481.308996, 247.382139]);
        assert.equalInverse(healpix, [ 15,  45], [504.813987, 143.797721]);
      }
    }
  }
});

suite.export(module);
