var vows = require("vows"),
    assert = require("./assert"),
    d3 = require("d3");

var suite = vows.describe("d3.geo.equirectangular");

var π = Math.PI;

suite.addBatch({
  "equirectangular": {
    "rotate": {
      "identity": {
        topic: function() {
          return d3.geo.equirectangular().rotate([0, 0]).translate([0, 0]).scale(1);
        },
        "projections and inverse projections": function(projection) {
          assert.equalInverse(projection, [   0,   0], [ 0,  0]);
          assert.equalInverse(projection, [-180,   0], [-π,  0]);
          assert.equalInverse(projection, [ 180,   0], [ π,  0]);
          assert.equalInverse(projection, [   0,  30], [ 0, -π / 6]);
          assert.equalInverse(projection, [   0, -30], [ 0,  π / 6]);
          assert.equalInverse(projection, [  30,  30], [ π / 6, -π / 6]);
          assert.equalInverse(projection, [  30, -30], [ π / 6,  π / 6]);
          assert.equalInverse(projection, [ -30,  30], [-π / 6, -π / 6]);
          assert.equalInverse(projection, [ -30, -30], [-π / 6,  π / 6]);
        }
      },
      "[30, 0]": {
        topic: function() {
          return d3.geo.equirectangular().rotate([30, 0]).translate([0, 0]).scale(1);
        },
        "projections and inverse projections": function(projection) {
          assert.equalInverse(projection, [   0,   0], [ π / 6,  0]);
          assert.equalInverse(projection, [-180,   0], [-5 / 6 * π,  0]);
          assert.inDelta(    projection( [ 180,   0]),[-5 / 6 * π,  0], 1e-6); // inverse is [-180, 0]
          assert.equalInverse(projection, [   0,  30], [ π / 6, -π / 6]);
          assert.equalInverse(projection, [   0, -30], [ π / 6,  π / 6]);
          assert.equalInverse(projection, [  30,  30], [ π / 3, -π / 6]);
          assert.equalInverse(projection, [  30, -30], [ π / 3,  π / 6]);
          assert.equalInverse(projection, [ -30,  30], [ 0    , -π / 6]);
          assert.equalInverse(projection, [ -30, -30], [ 0    ,  π / 6]);
        }
      },
      "[30, 30]": {
        topic: function() {
          return d3.geo.equirectangular().rotate([30, 30]).translate([0, 0]).scale(1);
        },
        "projections and inverse projections": function(projection) {
          assert.equalInverse(projection, [   0,   0], [ 0.5880026035475674, -0.44783239692893245]);
          assert.equalInverse(projection, [-180,   0], [-2.5535900500422257,  0.44783239692893245]);
          assert.inDelta(    projection( [ 180,   0]),[-2.5535900500422257,  0.44783239692893245], 1e-6); // inverse is [-180, 0]
          assert.equalInverse(projection, [   0,  30], [ 0.8256075561643480, -0.94077119517052080]);
          assert.equalInverse(projection, [   0, -30], [ 0.4486429615608479,  0.05804529130778048]);
          assert.equalInverse(projection, [  30,  30], [ 1.4056476493802694, -0.70695172788721770]);
          assert.equalInverse(projection, [  30, -30], [ 0.8760580505981933,  0.21823451436745955]);
          assert.equalInverse(projection, [ -30,  30], [ 0,                  -1.04719755119659760]);
          assert.equalInverse(projection, [ -30, -30], [ 0,                   0]);
        }
      },
      "[0, 0, 30]": {
        topic: function() {
          return d3.geo.equirectangular().rotate([0, 0, 30]).translate([0, 0]).scale(1);
        },
        "projections and inverse projections": function(projection) {
          assert.equalInverse(projection, [   0,   0], [ 0, 0]);
          assert.equalInverse(projection, [-180,   0], [-π, 0]);
          assert.equalInverse(projection, [ 180,   0], [ π, 0]);
          assert.equalInverse(projection, [   0,  30], [-0.2810349015028135, -0.44783239692893245]);
          assert.equalInverse(projection, [   0, -30], [ 0.2810349015028135,  0.44783239692893245]);
          assert.equalInverse(projection, [  30,  30], [ 0.1651486774146268, -0.70695172788721760]);
          assert.equalInverse(projection, [  30, -30], [ 0.6947382761967031,  0.21823451436745964]);
          assert.equalInverse(projection, [ -30,  30], [-0.6947382761967031, -0.21823451436745964]);
          assert.equalInverse(projection, [ -30, -30], [-0.1651486774146268,  0.70695172788721760]);
        }
      },
      "[30, 30, 30]": {
        topic: function() {
          return d3.geo.equirectangular().rotate([30, 30, 30]).translate([0, 0]).scale(1);
        },
        "projections and inverse projections": function(projection) {
          assert.equalInverse(projection, [   0,   0], [ 0.2810349015028135, -0.67513153293703170]);
          assert.equalInverse(projection, [-180,   0], [-2.8605577520869800,  0.67513153293703170]);
          assert.inDelta(    projection( [ 180,   0]),[-2.8605577520869800,  0.67513153293703170], 1e-6); // inverse is [-180, 0]
          assert.equalInverse(projection, [   0,  30], [-0.0724760059270816, -1.15865677086597720]);
          assert.equalInverse(projection, [   0, -30], [ 0.4221351552567053, -0.16704161863132252]);
          assert.equalInverse(projection, [  30,  30], [ 1.2033744221750944, -1.21537512510467320]);
          assert.equalInverse(projection, [  30, -30], [ 0.8811235701944905, -0.18861638617540410]);
          assert.equalInverse(projection, [ -30,  30], [-0.7137243789447654, -0.84806207898148100]);
          assert.equalInverse(projection, [ -30, -30], [ 0,                   0]);
        }
      }
    }
  }
});

suite.export(module);
