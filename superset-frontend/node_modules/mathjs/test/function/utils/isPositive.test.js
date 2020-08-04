var assert = require('assert');
var math = require('../../../index');
var isPositive = math.isPositive;
var bignumber = math.bignumber;
var fraction = math.fraction;
var complex = math.complex;
var unit = math.unit;

describe('isPositive', function() {

  it('should test whether a number is positive', function() {
    assert.strictEqual(isPositive(0), false);
    assert.strictEqual(isPositive(-0), false);
    assert.strictEqual(isPositive(2), true);
    assert.strictEqual(isPositive(-3), false);
    assert.strictEqual(isPositive(Infinity), true);
    assert.strictEqual(isPositive(-Infinity), false);
    assert.strictEqual(isPositive(NaN), false);
  });

  it('should test whether a boolean is positive', function() {
    assert.strictEqual(isPositive(true), true);
    assert.strictEqual(isPositive(false), false);
  });

  it('should test whether a BigNumber is positive', function() {
    assert.strictEqual(isPositive(bignumber(0)), false);
    assert.strictEqual(isPositive(bignumber(-0)), false);
    assert.strictEqual(isPositive(bignumber(2)), true);
    assert.strictEqual(isPositive(bignumber(-3)), false);
    assert.strictEqual(isPositive(bignumber(Infinity)), true);
    assert.strictEqual(isPositive(bignumber(-Infinity)), false);
    assert.strictEqual(isPositive(bignumber(NaN)), false);
  });

  it('should test whether a Fraction is positive', function() {
    assert.strictEqual(isPositive(fraction(2)), true);
    assert.strictEqual(isPositive(fraction(-3)), false);
    assert.strictEqual(isPositive(fraction(0)), false);
    assert.strictEqual(isPositive(fraction(-0)), false);
  });

  it('should test whether a unit is positive', function() {
    assert.strictEqual(isPositive(unit('0 m')), false);
    assert.strictEqual(isPositive(unit('0 kB')), false);
    assert.strictEqual(isPositive(unit('5 cm')), true);
    assert.strictEqual(isPositive(unit('-3 inch')), false);
  });

  it('should test whether a string contains a positive value', function() {
    assert.strictEqual(isPositive('2'), true);
    assert.strictEqual(isPositive('-2'), false);
    assert.strictEqual(isPositive('0'), false);
  });

  it('should test isPositive element wise on an Array', function() {
    assert.deepEqual(isPositive([0, 5, 0, -3]), [false, true, false, false]);
  });

  it('should test isPositive element wise on a Matrix', function() {
    assert.deepEqual(isPositive(math.matrix([0, 5, 0, -3])), math.matrix([false, true, false, false]));
  });

  it('should throw an error in case of unsupported data types', function() {
    assert.throws(function () {isPositive(complex(2, 3))}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {isPositive(new Date())}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {isPositive({})}, /TypeError: Unexpected type of argument/);
  });

});
