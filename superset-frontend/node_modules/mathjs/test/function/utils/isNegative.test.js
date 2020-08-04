var assert = require('assert');
var math = require('../../../index');
var isNegative = math.isNegative;
var bignumber = math.bignumber;
var fraction = math.fraction;
var complex = math.complex;
var unit = math.unit;

describe('isNegative', function() {

  it('should test whether a number is negative', function() {
    assert.strictEqual(isNegative(0), false);
    assert.strictEqual(isNegative(-0), false);
    assert.strictEqual(isNegative(2), false);
    assert.strictEqual(isNegative(-3), true);
    assert.strictEqual(isNegative(Infinity), false);
    assert.strictEqual(isNegative(-Infinity), true);
    assert.strictEqual(isNegative(NaN), false);
  });

  it('should test whether a boolean is negative', function() {
    assert.strictEqual(isNegative(true), false);
    assert.strictEqual(isNegative(false), false);
  });

  it('should test whether a BigNumber is negative', function() {
    assert.strictEqual(isNegative(bignumber(0)), false);
    assert.strictEqual(isNegative(bignumber(-0)), false);
    assert.strictEqual(isNegative(bignumber(2)), false);
    assert.strictEqual(isNegative(bignumber(-3)), true);
    assert.strictEqual(isNegative(bignumber(Infinity)), false);
    assert.strictEqual(isNegative(bignumber(-Infinity)), true);
    assert.strictEqual(isNegative(bignumber(NaN)), false);
  });

  it('should test whether a Fraction is negative', function() {
    assert.strictEqual(isNegative(fraction(2)), false);
    assert.strictEqual(isNegative(fraction(-3)), true);
    assert.strictEqual(isNegative(fraction(0)), false);
    assert.strictEqual(isNegative(fraction(-0)), false);
  });

  it('should test whether a unit is negative', function() {
    assert.strictEqual(isNegative(unit('0 m')), false);
    assert.strictEqual(isNegative(unit('0 kB')), false);
    assert.strictEqual(isNegative(unit('5 cm')), false);
    assert.strictEqual(isNegative(unit('-3 inch')), true);
  });

  it('should test whether a string contains a negative value', function() {
    assert.strictEqual(isNegative('2'), false);
    assert.strictEqual(isNegative('-2'), true);
    assert.strictEqual(isNegative('0'), false);
  });

  it('should test isNegative element wise on an Array', function() {
    assert.deepEqual(isNegative([0, 5, 0, -3]), [false, false, false, true]);
  });

  it('should test isNegative element wise on a Matrix', function() {
    assert.deepEqual(isNegative(math.matrix([0, 5, 0, -3])), math.matrix([false, false, false, true]));
  });

  it('should throw an error in case of unsupported data types', function() {
    assert.throws(function () {isNegative(complex(2, 3))}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {isNegative(new Date())}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {isNegative({})}, /TypeError: Unexpected type of argument/);
  });

});
