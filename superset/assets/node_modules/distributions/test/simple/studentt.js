
var test = require('tap').test;
var distributions = require('../../distributions.js');
var equals = require('../equal.js');

test('testing student t density function', function (t) {
  var studentt = distributions.Studentt(15);

  var c = [
    [-3.0,  0.009135184],
    [-2.5,  0.024184424],
    [-2.0,  0.059207732],
    [-1.5,  0.128260945],
    [-1.0,  0.234124773],
    [-0.5,  0.343754570],
    [ 0.0,  0.392353163],
    [+0.5,  0.343754570],
    [+1.0,  0.234124773],
    [+1.5,  0.128260945],
    [+2.0,  0.059207732],
    [+2.5,  0.024184424],
    [+3.0,  0.009135184]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: studentt.pdf.bind(studentt),
    limit: 0.0000005
  });

  t.end();
});

test('testing student t cumulative function', function (t) {
  var studentt = distributions.Studentt(15);

  var c = [
    [-3.0,  0.004486369],
    [-2.5,  0.012252902],
    [-2.0,  0.031972504],
    [-1.5,  0.077183330],
    [-1.0,  0.166585068],
    [-0.5,  0.312165057],
    [ 0.0,  0.500000000],
    [+0.5,  0.687834943],
    [+1.0,  0.833414932],
    [+1.5,  0.922816670],
    [+2.0,  0.968027496],
    [+2.5,  0.987747098],
    [+3.0,  0.995513631]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: studentt.cdf.bind(studentt),
    limit: 0.0000005
  });

  t.end();
});

test('testing student t inverse function', function (t) {
  var studentt = distributions.Studentt(15);

  var c = [
    [+0.0,  -Infinity],
    [+0.1,  -1.3406056],
    [+0.2,  -0.8662450],
    [+0.3,  -0.5357291],
    [+0.4,  -0.2578853],
    [+0.5,   0.0],
    [+0.6,  +0.2578853],
    [+0.7,  +0.5357291],
    [+0.8,  +0.8662450],
    [+0.9,  +1.3406056],
    [+1.0,  +Infinity]
  ];

  equals.absoluteEqual({
    test: t,
    map: c,
    fn: studentt.inv.bind(studentt),
    limit: 0.0000005
  });

  t.end();
});

test('testing student t key values', function (t) {
  var studentt = distributions.Studentt(15);

  t.equal(studentt.median(), 0);
  t.equal(studentt.mean(), 0);
  t.equal(studentt.variance(), 15/13);

  t.end();
});
