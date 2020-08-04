var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load");

var suite = vows.describe("d3.geo.lagrange");

suite.addBatch({
  "lagrange": {
    topic: load("lagrange"),
    "spacing(.5)": {
      topic: function(geo) { return geo.lagrange(); },
      "projections and inverse projections": function(lagrange) {
        assert.equalInverse(lagrange, [  0,   0], [480,        250]);
        assert.equalInverse(lagrange, [  0, -45], [480,        315.053600]);
        assert.equalInverse(lagrange, [  0,  45], [480,        184.946399]);
        assert.equalInverse(lagrange, [  0,  90], [480,        -50]);
        assert.equalInverse(lagrange, [  0,  80], [480,         86.960158]);
        assert.equalInverse(lagrange, [-90,   0], [355.735931, 250]);
        assert.equalInverse(lagrange, [ 90,   0], [604.264068, 250]);
        assert.equalInverse(lagrange, [-80,  15], [371.349124, 227.551283]);
        assert.equalInverse(lagrange, [  1,   1], [481.308980, 248.690919]);
        assert.equalInverse(lagrange, [ 15,  45], [498.734660, 184.680127]);
        assert.equalInverse(lagrange, [ 15,  80], [493.837895,  86.467244]);
        assert.equalInverse(lagrange, [ 15,  89], [486.127550,   0.928863]);
        assert.equalInverse(lagrange, [ 45,  89], [498.157041,  -1.732667]);
        assert.equalInverse(lagrange, [150,  89], [531.217097, -31.323054]);
        assert.equalInverse(lagrange, [-150, 89], [428.782902, -31.323054]);
        assert.equalInverse(lagrange, [-179, 89], [424.526070, -44.333441]);
        assert.equalInverse(lagrange, [0,  89.9], [480,        -32.784034]);
      }
    },
    "spacing(.25)": {
      topic: function(geo) {
        return geo.lagrange().spacing(.25);
      },
      "projections and inverse projections": function(lagrange) {
        assert.equalInverse(lagrange, [  0,   0], [480,        250]);
        assert.equalInverse(lagrange, [  0, -45], [480,        282.918431]);
        assert.equalInverse(lagrange, [  0,  45], [480,        217.081568]);
        assert.equalInverse(lagrange, [  0,  90], [480,        -50]);
        assert.equalInverse(lagrange, [  0,  80], [480,        161.363985]);
        assert.equalInverse(lagrange, [-90,   0], [420.326289, 250]);
        assert.equalInverse(lagrange, [ 90,   0], [539.673710, 250]);
        assert.equalInverse(lagrange, [-80,  15], [427.161636, 239.763718]);
        assert.equalInverse(lagrange, [  1,   1], [480.654496, 249.345466]);
        assert.equalInverse(lagrange, [ 15,  45], [489.702610, 217.046715]);
        assert.equalInverse(lagrange, [ 15,  80], [488.962844, 161.277295]);
        assert.equalInverse(lagrange, [ 15,  89], [487.041237,  90.333761]);
        assert.equalInverse(lagrange, [ 45,  89], [501.132716,  89.349438]);
        assert.equalInverse(lagrange, [150,  89], [550.729469,  77.687845]);
        assert.equalInverse(lagrange, [-150, 89], [409.270530,  77.687845]);
        assert.equalInverse(lagrange, [-179, 89], [395.481107,  71.952986]);
        assert.equalInverse(lagrange, [0,  89.9], [480,         37.999854]);
      }
    }
  }
});

suite.export(module);
