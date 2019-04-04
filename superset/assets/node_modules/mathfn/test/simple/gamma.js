
var test = require('tap').test;
var mathfn = require('../../mathfn.js');
var equals = require('../equal.js');

test('testing gamma function', function (t) {
  var c = [
    [1e-20,              1e+20],
    [2.19824158876e-16,  4.5490905327e+15],
    [2.24265050974e-16,  4.45900953205e+15],
    [0.00099,            1009.52477271],
    [0.00100,            999.423772485],
    [0.00101,            989.522792258],
    [6.1,                142.451944066],
    [11.999,             39819417.4793],
    [12,                 39916800.0],
    [12.001,             40014424.1571],
    [15.2,               149037380723.0]
  ];

  equals.relativeEqual({
    test: t,
    map: c,
    fn: mathfn.gamma,
    limit: 0.000005
  });

  t.end();
});

test('testing logarithmic gamma function', function (t) {
  var c = [
		[1e-12,    27.6310211159],
		[0.9999,   5.77297915613e-05],
		[1.0001,  -5.77133422205e-05],
		[3.1,      0.787375083274],
		[6.3,      5.30734288962],
		[11.9999,  17.5020635801],
		[12,       17.5023078459],
		[12.0001,  17.5025521125],
		[27.4,     62.5755868211]
	];

  equals.relativeEqual({
    test: t,
    map: c,
    fn: mathfn.logGamma,
    limit: 0.0000005
  });

  t.end();
});
