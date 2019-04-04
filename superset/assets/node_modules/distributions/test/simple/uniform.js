
var test = require('tap').test;
var distributions = require('../../distributions.js');
var equals = require('../equal.js');

test('testing standard uniform density function', function (t) {
  var uniform = distributions.Uniform();

  var c = [
    [-1.0,  0.0],
    [+0.0,  1.0],
    [+0.5,  1.0],
    [+1.0,  1.0],
    [+2.0,  0.0]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: uniform.pdf.bind(uniform),
    limit: 0.0000005
  });

  t.end();
});

test('testing standard uniform cumulative function', function (t) {
  var uniform = distributions.Uniform();

  var c = [
    [-1.0,  0.0],
    [+0.0,  0.0],
    [+0.5,  0.5],
    [+1.0,  1.0],
    [+2.0,  1.0]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: uniform.cdf.bind(uniform),
    limit: 0.0000005
  });

  t.end();
});

test('testing standard uniform inverse function', function (t) {
  var uniform = distributions.Uniform();

  var c = [
    [-1.0,  NaN],
    [+0.0,  0.0],
    [+0.5,  0.5],
    [+1.0,  1.0],
    [+2.0,  NaN]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: uniform.inv.bind(uniform),
    limit: 0.0000005
  });

  t.end();
});

test('testing standard uniform key values', function (t) {
  var uniform = distributions.Uniform();

  t.equal(uniform.median(), 0.5);
  t.equal(uniform.mean(), 0.5);
  t.equal(uniform.variance(), 1/12);

  t.end();
});

test('testing none standard uniform density function', function (t) {
  var uniform = distributions.Uniform(-2, 2);

  var c = [
    [-3.0,  0.0],
    [-2.0,  0.25],
    [+0.0,  0.25],
    [+0.5,  0.25],
    [+1.0,  0.25],
    [+2.0,  0.25],
    [+3.0,  0.0]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: uniform.pdf.bind(uniform),
    limit: 0.0000005
  });

  t.end();
});

test('testing none standard uniform cumulative function', function (t) {
  var uniform = distributions.Uniform(-2, 2);

  var c = [
    [-3.0,  0.0],
    [-2.0,  0.0],
    [+0.0,  0.5],
    [+0.5,  0.625],
    [+1.0,  0.75],
    [+2.0,  1.0],
    [+3.0,  1.0]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: uniform.cdf.bind(uniform),
    limit: 0.0000005
  });

  t.end();
});

test('testing none standard uniform inverse function', function (t) {
  var uniform = distributions.Uniform(-2, 2);

  var c = [
    [-1.0,   NaN],
    [+0.0,  -2.0],
    [+0.5,   0.0],
    [+1.0,  +2.0],
    [+2.0,   NaN]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: uniform.inv.bind(uniform),
    limit: 0.0000005
  });

  t.end();
});

test('testing node standard uniform key values', function (t) {
  var uniform = distributions.Uniform(-2, 2);

  t.equal(uniform.median(), 0);
  t.equal(uniform.mean(), 0);
  t.equal(uniform.variance(), 16/12);

  t.end();
});

