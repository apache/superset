var assert          = require('assert')
  , approx          = require('../../../tools/approx')
  , error           = require('../../../lib/error/index')
  , math            = require('../../../index')
  , bigUtil         = require('../../../lib/utils/index').bignumber
  , bignumber       = math.bignumber
  , subtract        = math.subtract
  , abs             = math.abs
  , smaller         = math.smaller
  , erf             = math.erf
  , actualErfValues = require('./erf.values.json');

var DIFF_THRESH = 5e-16;

describe('erf', function () {

  it('should calculate erf(x), |x| < 0.46875', function () {
    var i, diff, actual, expected;
    for (i = -4; i <= 4; i += 1) {
      actual = erf(i / 10);
      expected = actualErfValues[(i / 10).toFixed(1)];
      diff = Math.abs(actual - expected);
      assert.ok(diff < DIFF_THRESH, [i, actual, expected, diff]);
    }
  });

  it('should calculate erf(x), 0.46875 <= |x| <= 4', function () {
    var i, diff, actual, expected;
    for (i = -40; i < -4; i += 1) {
      actual = erf(i / 10);
      expected = actualErfValues[(i / 10).toFixed(1)];
      diff = Math.abs(actual - expected);
      assert.ok(diff < DIFF_THRESH, [i, actual, expected, diff]);
    }
    for (i = 5; i <= 40; i += 1) {
      actual = erf(i / 10);
      expected = actualErfValues[(i / 10).toFixed(1)];
      diff = Math.abs(actual - expected);
      assert.ok(diff < DIFF_THRESH, [i, actual, expected, diff]);
    }
  });

  it('should calculate erf(x), |x| > 4', function () {
    var i, diff, actual, expected;
    for (i = -70; i < -40; i += 1) {
      actual = erf(i / 10);
      expected = actualErfValues[(i / 10).toFixed(1)];
      diff = Math.abs(actual - expected);
      assert.ok(diff < DIFF_THRESH, [i, actual, expected, diff]);
    }
    for (i = 41; i < 70; i += 1) {
      actual = erf(i / 10);
      expected = actualErfValues[(i / 10).toFixed(1)];
      diff = Math.abs(actual - expected);
      assert.ok(diff < DIFF_THRESH, [i, actual, expected, diff]);
    }
  });

  it('should calculate the erf of a nonpositive integer', function () {
    assert.ok(Math.abs(erf(-1) - actualErfValues['-1.0']) < DIFF_THRESH);
    assert.ok(Math.abs(erf(-2) - actualErfValues['-2.0']) < DIFF_THRESH);
    assert.ok(Math.abs(erf(-3) - actualErfValues['-3.0']) < DIFF_THRESH);
  });

  it('should calculate the erf of a rational bignumber', function () {
    assert.ok(smaller(
      abs(subtract(erf(bignumber(0.1)), bignumber(actualErfValues['0.1']))),
      DIFF_THRESH
    ));
    assert.ok(smaller(
      abs(subtract(erf(bignumber(0.2)), bignumber(actualErfValues['0.2']))),
      DIFF_THRESH
    ));
    assert.ok(smaller(
      abs(subtract(erf(bignumber(0.3)), bignumber(actualErfValues['0.3']))),
      DIFF_THRESH
    ));
    assert.ok(smaller(
      abs(subtract(erf(bignumber(1.5)), bignumber(actualErfValues['1.5']))),
      DIFF_THRESH
    ));
    assert.ok(smaller(
      abs(subtract(erf(bignumber(2.5)), bignumber(actualErfValues['2.5']))),
      DIFF_THRESH
    ));

    var bigmath = math.create({ precision: 15 });
    assert.ok(smaller(
      abs(subtract(bigmath.erf(bignumber(-1.5)), bigmath.bignumber(actualErfValues['-1.5']))),
      DIFF_THRESH
    ));
    bigmath.config({ precision: 13 });
    assert.ok(smaller(
      abs(subtract(bigmath.erf(bignumber(-1.5)), bigmath.bignumber(actualErfValues['-1.5']))),
      DIFF_THRESH
    ));
  });

  it('should calculate the erf of a boolean (true = 1, false = 0)', function () {
    assert.ok(Math.abs(erf(true) - actualErfValues['1.0']) < DIFF_THRESH);
    assert.ok(Math.abs(erf(false) - actualErfValues['0.0']) < DIFF_THRESH);
  });

  it('should calculate the erf of null (0)', function () {
    assert.ok(Math.abs(erf(null) - actualErfValues['0.0']) < DIFF_THRESH);
  });

  it('should calculate the erf of each element in a matrix', function () {
    math.subtract(
      erf(math.matrix([0,1,2,3,4,5])),
      math.matrix([0,1,2,3,4,5].map(function (x) {
        return actualErfValues[x.toFixed(1)];
      }))
    ).forEach(function (diff) {
      assert.ok(diff < DIFF_THRESH);
    });
  });

  it('should calculate the erf of each element in an array', function () {
    math.subtract(
      erf(math.matrix([0,1,2,3,4,5])),
      math.matrix([0,1,2,3,4,5].map(function (x) {
        return actualErfValues[x.toFixed(1)];
      }))
    ).forEach(function (diff) {
      assert.ok(diff < DIFF_THRESH);
    });
  });

  it('should throw en error if called with invalid number of arguments', function() {
    assert.throws(function () { erf(); });
    assert.throws(function () { erf(1,3); });
  });

  it('should throw en error if called with invalid type of argument', function() {
    assert.throws(function () { erf(new Date()); });
    assert.throws(function () { erf('a string'); });
  });

  it('should LaTeX erf', function () {
    var expression = math.parse('erf(2.5)');
    assert.equal(expression.toTex(), 'erf\\left(2.5\\right)');
  });

  it('should return 1 for numbers greater than 2**53 (including Infinity)', function () {
    assert.equal(erf(Math.pow(2, 53)), 1);
    assert.equal(erf(Infinity), 1);
  });

  it('should return -1 for numbers less than -2**53 (including -Infinity)', function () {
    assert.equal(erf(-Math.pow(2, 53)), -1);
    assert.equal(erf(-Infinity), -1);
  });

  // TODO: Test with nums really close to 0
  // TODO: Once this works for complex numbers and imaginary units, test

});
