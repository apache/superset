
var test = require('tap').test;
var mathfn = require('../../mathfn.js');
var equals = require('../equal.js');

test('testing beta function', function (t) {
  var c = [
    [+0.0, +2.0,  Infinity],
    [+2.0, +0.0,  Infinity],
    [+0.0, +0.0,  NaN],
    [+1.0, +1.0,  1.0],
    [+0.8, +0.8,  1.516964232792923],
    [+0.5, +0.5,  3.141592653589793],
    [+0.2, +0.2,  9.501501389884366]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: mathfn.beta,
    limit: 0.0000005
  });

  t.end();
});

test('testing logarithmic beta function', function (t) {
  var c = [
    [+0.0, +2.0,  Infinity],
    [+2.0, +0.0,  Infinity],
    [+0.0, +0.0,  NaN],
    [+1.0, +1.0,  0],
    [+0.8, +0.8,  0.416711122496431],
    [+0.5, +0.5,  1.144729885849400],
    [+0.2, +0.2,  2.251449827159785]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: mathfn.logBeta,
    limit: 0.0000005
  });

  t.end();
});

test('testing incomplete beta function', function (t) {
  var c = [
    [+0.0, +0.0, +0.0,  NaN],
    [+1.0, +0.0, +0.0,  NaN],
    [+1.0, +1.0, +1.0,  1.0],
    [+0.5, +0.5, +0.5,  1.57080],
    [+0.5, +0.2, +0.7,  4.48844],
    [+0.5, +0.7, +0.2,  1.08802],
    [+0.2, +1.0, +100,  0.009999999997963156],
    [+0.8, +100, +1.0,  2.037035976334455e-12]
  ];

 equals.absoluteEqual({
    test: t,
    map: c,
    fn: mathfn.incBeta,
    limit: 0.00005
  });

  t.end();
});

test('testing inverse incomplete beta function', function (t) {
  var c = [
    [+0.0, +0.0, +0.0,  0.0],
    [+1.0, +0.0, +0.0,  1.0],
    [+1.0, +1.0, +1.0,  1.0],
    [+0.5, +0.5, +0.5,  0.5],
    [+0.5, +0.2, +0.7,  0.053200302901278],
    [+0.5, +0.7, +0.2,  0.946799697098722],
    [+0.2, +1.0, +100,  0.002228947711718],
    [+0.8, +100, +1.0,  0.997771052288282]
  ];

 equals.absoluteEqual({
    test: t,
    map: c,
    fn: mathfn.invIncBeta,
    limit: 0.0000005
  });

  t.end();
});
