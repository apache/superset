
var test = require('tap').test;
var distributions = require('../../distributions.js');
var equals = require('../equal.js');

test('testing standard normal density function', function (t) {
  var normal = distributions.Normal();

  var c = [
    [-3.0,  0.004431848],
    [-2.5,  0.017528300],
    [-2.0,  0.053990967],
    [-1.5,  0.129517596],
    [-1.0,  0.241970725],
    [-0.5,  0.352065327],
    [ 0.0,  0.398942280],
    [+0.5,  0.352065327],
    [+1.0,  0.241970725],
    [+1.5,  0.129517596],
    [+2.0,  0.053990967],
    [+2.5,  0.017528300],
    [+3.0,  0.004431848]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: normal.pdf.bind(normal),
    limit: 0.0000005
  });

  t.end();
});

test('testing standard normal cumulative function', function (t) {
  var normal = distributions.Normal();

  var c = [
    [-3.0,  0.001349898],
    [-2.5,  0.006209665],
    [-2.0,  0.022750132],
    [-1.5,  0.066807201],
    [-1.0,  0.158655254],
    [-0.5,  0.308537539],
    [ 0.0,  0.500000000],
    [+0.5,  0.691462461],
    [+1.0,  0.841344746],
    [+1.5,  0.933192799],
    [+2.0,  0.977249868],
    [+2.5,  0.993790335],
    [+3.0,  0.998650102]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: normal.cdf.bind(normal),
    limit: 0.0000005
  });

  t.end();
});

test('testing standard normal inverse function', function (t) {
  var normal = distributions.Normal();

  var c = [
    [+0.0,  -Infinity],
    [+0.1,  -1.2815516],
    [+0.2,  -0.8416212],
    [+0.3,  -0.5244005],
    [+0.4,  -0.2533471],
    [+0.5,   0.0],
    [+0.6,  +0.2533471],
    [+0.7,  +0.5244005],
    [+0.8,  +0.8416212],
    [+0.9,  +1.2815516],
    [+1.0,  +Infinity]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: normal.inv.bind(normal),
    limit: 0.0000005
  });

  t.end();
});

test('testing standard normal key values', function (t) {
  var normal = distributions.Normal();

  t.equal(normal.median(), 0);
  t.equal(normal.mean(), 0);
  t.equal(normal.variance(), 1);

  t.end();
});

test('testing none standard normal density function', function (t) {
  var normal = distributions.Normal(1, 2);

  var c = [
    [-2.0,  0.0647588],
    [-1.0,  0.1209854],
    [ 0.0,  0.1760327],
    [+1.0,  0.1994711],
    [+2.0,  0.1760327],
    [+3.0,  0.1209854],
    [+4.0,  0.0647588]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: normal.pdf.bind(normal),
    limit: 0.0000005
  });

  t.end();
});

test('testing none standard normal cumulative function', function (t) {
  var normal = distributions.Normal(1, 2);

  var c = [
    [-2.0,  0.0668072],
    [-1.0,  0.1586553],
    [ 0.0,  0.3085375],
    [+1.0,  0.5000000],
    [+2.0,  0.6914625],
    [+3.0,  0.8413447],
    [+4.0,  0.9331928]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: normal.cdf.bind(normal),
    limit: 0.0000005
  });

  t.end();
});

test('testing none standard normal inverse function', function (t) {
  var normal = distributions.Normal(1, 2);

  var c = [
    [+0.0,  -Infinity],
    [+0.2,  -0.6832425],
    [+0.4,  +0.4933058],
    [+0.5,   1.0],
    [+0.6,  +1.5066942],
    [+0.8,  +2.6832425],
    [+1.0,  +Infinity]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: normal.inv.bind(normal),
    limit: 0.0000005
  });

  t.end();
});

test('testing none standard normal key values', function (t) {
  var normal = distributions.Normal(1, 2);

  t.equal(normal.median(), 1);
  t.equal(normal.mean(), 1);
  t.equal(normal.variance(), 4);
  
  t.end();
});
