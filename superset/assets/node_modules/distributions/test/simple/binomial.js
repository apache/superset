
var test = require('tap').test;
var distributions = require('../../distributions.js');
var equals = require('../equal.js');

test('testing binomial density function', function (t) {
  var binomial = distributions.Binomial(0.4, 100);

  var c = [
    [0,   6.533186e-23],
    [10 , 1.961179e-11],
    [30,  1.000750e-02],
    [40,  8.121914e-02],
    [50,  1.033751e-02],
    [60,  2.442492e-05],
    [70,  9.050560e-10],
    [100, 1.606938e-40]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: binomial.pdf.bind(binomial),
    limit: 0.0000005
  });

  t.end();
});

test('testing none standard binomial cumulative function', function (t) {
  var binomial = distributions.Binomial(0.4, 100);

  var c = [
    [0,   6.533186e-23],
    [10,  2.338762e-11],
    [30,  2.478282e-02],
    [40,  5.432945e-01],
    [50,  9.832383e-01],
    [60,  9.999820e-01],
    [70,  1.000000e+00],
    [100, 1.000000e+00]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: binomial.cdf.bind(binomial),
    limit: 0.0000005
  });

  t.end();
});

test('testing node standard binomial key values', function (t) {
  var binomial = distributions.Binomial(0.4, 100);

  t.equal(binomial.median(), 40);
  t.equal(binomial.mean(), 40);
  t.equal(binomial.variance(), 24);

  t.end();
});
