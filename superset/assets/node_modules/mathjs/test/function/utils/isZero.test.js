var assert = require('assert');
var math = require('../../../index');
var isZero = math.isZero;
var bignumber = math.bignumber;
var fraction = math.fraction;
var complex = math.complex;
var unit = math.unit;

describe('isZero', function() {

  it('should test whether a number is zero', function() {
    assert.strictEqual(isZero(0), true);
    assert.strictEqual(isZero(-0), true);

    assert.strictEqual(isZero(2), false);
    assert.strictEqual(isZero(-3), false);
    assert.strictEqual(isZero(-0.5), false);
    assert.strictEqual(isZero(Infinity), false);
    assert.strictEqual(isZero(-Infinity), false);
    assert.strictEqual(isZero(NaN), false);
  });

  it('should test whether a boolean is zero', function() {
    assert.strictEqual(isZero(true), false);
    assert.strictEqual(isZero(false), true);
  });

  it('should test whether a BigNumber is zero', function() {
    assert.strictEqual(isZero(bignumber(0)), true);
    assert.strictEqual(isZero(bignumber(-0)), true);

    assert.strictEqual(isZero(bignumber(2)), false);
    assert.strictEqual(isZero(bignumber(-3)), false);
    assert.strictEqual(isZero(bignumber(-0.5)), false);
    assert.strictEqual(isZero(bignumber(Infinity)), false);
    assert.strictEqual(isZero(bignumber(-Infinity)), false);
    assert.strictEqual(isZero(bignumber(NaN)), false);
  });

  it('should test whether a Fraction is zero', function() {
    assert.strictEqual(isZero(fraction(0)), true);
    assert.strictEqual(isZero(fraction(-0)), true);

    assert.strictEqual(isZero(fraction(2)), false);
    assert.strictEqual(isZero(fraction(-3)), false);
  });

  it('should test whether a string contains a zero value', function() {
    assert.strictEqual(isZero('0'), true);
    assert.strictEqual(isZero('-0'), true);

    assert.strictEqual(isZero('2'), false);
    assert.strictEqual(isZero('-3'), false);
  });

  it('should test whether a complex number is zero', function() {
    assert.strictEqual(isZero(complex(0, 0)), true);
    assert.strictEqual(isZero(complex(0, 1)), false);
    assert.strictEqual(isZero(complex(2, 0)), false);
    assert.strictEqual(isZero(complex(2, 4)), false);
  });

  it('should test whether a unit is zero', function() {
    assert.strictEqual(isZero(unit('0 m')), true);
    assert.strictEqual(isZero(unit('0 kB')), true);

    assert.strictEqual(isZero(unit('5 cm')), false);
    assert.strictEqual(isZero(unit('-3 inch')), false);
  });

  it('should test isZero element wise on an Array', function() {
    assert.deepEqual(isZero([0, 5, 0, -3]), [true, false, true, false]);
  });

  it('should test isZero element wise on a Matrix', function() {
    assert.deepEqual(isZero(math.matrix([0, 5, 0, -3])), math.matrix([true, false, true, false]));
  });

  it('should throw an error in case of unsupported data types', function() {
    assert.throws(function () {isZero(new Date())}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {isZero({})}, /TypeError: Unexpected type of argument/);
  });

});
