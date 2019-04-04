var assert = require('assert');
var math = require('../../../index');
var isPrime = math.isPrime;
var bignumber = math.bignumber;
var complex = math.complex;

describe('isPrime', function() {

  it('should test whether a number is prime', function() {
    assert.strictEqual(isPrime(0), false);
    assert.strictEqual(isPrime(-0), false);
    assert.strictEqual(isPrime(-1), false);
    assert.strictEqual(isPrime(1), false);
    assert.strictEqual(isPrime(2), true);
    assert.strictEqual(isPrime(3), true);
    assert.strictEqual(isPrime(5), true);
    assert.strictEqual(isPrime(7), true);
    assert.strictEqual(isPrime(4), false);
    assert.strictEqual(isPrime(100), false);
    assert.strictEqual(isPrime(102), false);
    assert.strictEqual(isPrime(999), false);
  });

  it('should test whether a BigNumber is prime', function() {
    assert.strictEqual(isPrime(bignumber(0)), false);
    assert.strictEqual(isPrime(bignumber(-0)), false);
    assert.strictEqual(isPrime(bignumber(-1)), false);
    assert.strictEqual(isPrime(bignumber(1)), false);
    assert.strictEqual(isPrime(bignumber(2)), true);
    assert.strictEqual(isPrime(bignumber(3)), true);
    assert.strictEqual(isPrime(bignumber(5)), true);
    assert.strictEqual(isPrime(bignumber(7)), true);
    assert.strictEqual(isPrime(bignumber(4)), false);
    assert.strictEqual(isPrime(bignumber(100)), false);
    assert.strictEqual(isPrime(bignumber(102)), false);
    assert.strictEqual(isPrime(bignumber(999)), false);
  });

  it('should test isPrime element wise on an Array', function() {
    assert.deepEqual(isPrime([0, 1, 2, 5, 9]), [false, false, true, true, false]);
  });

  it('should throw an error in case of unsupported data types', function() {
    assert.throws(function () {isPrime(complex(2, 3))}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {isPrime(new Date())}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {isPrime({})}, /TypeError: Unexpected type of argument/);
  });

});
