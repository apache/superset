
var test = require('tap').test;
var mathfn = require('../../mathfn.js');
var equals = require('../equal.js');

test('testing erf function', function (t) {
  var c = [
    [-3.0,  -0.9999779095],
    [-2.0,  -0.995322265],
    [-1.0,  -0.842700792950],
    [-0.5,  -0.5204998778],
    [ 0.0,  0.0],
    [+0.5,  0.520499877813],
    [+1.0,  0.8427007929],
    [+2.0,  0.995322265],
    [+3.0,  0.9999779095],
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: mathfn.erf,
    limit: 0.0000005
  });

  t.end();
});

test('testing inverse erf function', function (t) {
  var c = [
    [-1.0,  -Infinity],
    [-0.5,  -0.4769362762],
    [ 0.0,  0.0],
    [+0.5,  0.4769362762],
    [+1.0,  +Infinity]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: mathfn.invErf,
    limit: 0.0000005
  });
  
  t.end();
});

test('testing complementary erf function', function (t) {
  var c = [
    [-3.0,  1.99997791],
    [-2.0,  1.995322265],
    [-1.0,  1.842700793],
    [-0.5,  1.520499878],
    [ 0.0,  1.0],
    [+0.5,  0.4795001222],
    [+1.0,  0.1572992071],
    [+2.0,  0.004677734981],
    [+3.0,  0.000022090497]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: mathfn.erfc,
    limit: 0.005
  });

  t.end();
});

test('testing inverse complementary erf function', function (t) {
  var c = [
    [0.0,   Infinity],
    [0.5,   0.4769362762],
    [1.0,   0.0],
    [1.5,  -0.4769362762],
    [2.0,  -Infinity]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: mathfn.invErfc,
    limit: 0.0000005
  });
  
  t.end();
});
