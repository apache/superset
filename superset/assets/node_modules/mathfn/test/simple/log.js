
var test = require('tap').test;
var mathfn = require('../../mathfn.js');
var equals = require('../equal.js');

test('testing log(1 + x) function', function (t) {
  var c = [
    [0.1,     0.09531017980],
    [+5e-7,   4.99999875e-7],
    [-5e-7,  -5.000001250E-7],
    [-0.1,   -0.1053605157]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: mathfn.log1p,
    limit: 0.0000005
  });

  t.end();
});

test('testing log(x!) function', function (t) {
  var c = [
    [0,     0.0],
    [1,     0.0],
    [10,    15.10441257],
    [100,   363.7393756],
    [1000,  5912.128178],
    [10000, 82108.92784]
  ];

  equals.relativeEqual({
    test: t,
    map: c,
    fn: mathfn.logFactorial,
    limit: 0.0000005
  });

  t.end();
});
