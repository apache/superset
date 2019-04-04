var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var arg = math.arg;

describe('arg', function() {
  it('should compute the argument of a boolean', function () {
    assert.equal(arg(true), 0);
    assert.equal(arg(false), 0);
  });

  it('should compute the argument of null', function () {
    assert.equal(arg(null), 0);
  });

  it('should compute the argument of a number', function () {
    assert.equal(arg(1), 0);
    assert.equal(arg(2), 0);
    assert.equal(arg(0), 0);
    approx.equal(arg(-2), 3.141592653589793);
  });

  it('should compute the argument of a bignumber', function () {
    assert.deepEqual(arg(math.bignumber(1)), math.bignumber(0));
    assert.deepEqual(arg(math.bignumber(-2)),
        math.bignumber('3.141592653589793238462643383279502884197169399375105820974944592'));
  });

  it('should compute the argument of a complex number correctly', function() {
    assert.equal(arg(math.complex('0')) / math.pi, 0);
    assert.equal(arg(math.complex('1 + 0i')) / math.pi, 0);
    assert.equal(arg(math.complex('1 + i')) / math.pi, 0.25);
    assert.equal(arg(math.complex('0 + i')) / math.pi, 0.5);
    assert.equal(arg(math.complex('-1 + i')) / math.pi, 0.75);
    assert.equal(arg(math.complex('-1 + 0i')) / math.pi, 1);
    assert.equal(arg(math.complex('-1 - i')) / math.pi, -0.75);
    assert.equal(arg(math.complex('0 - i')) / math.pi, -0.5);
    assert.equal(arg(math.complex('1 - i')) / math.pi, -0.25);
    assert.equal(arg(math.i) / math.pi, 0.5);
  });

  it('should calculate the argument for each element in a matrix', function() {
    assert.deepEqual(math.divide(arg([
      math.i, math.unaryMinus(math.i), math.add(1,math.i)
    ]), math.pi), [
      0.5, -0.5, 0.25
    ]);
    assert.deepEqual(math.matrix(math.divide(arg([
      math.i, math.unaryMinus(math.i), math.add(1,math.i)
    ]), math.pi)).valueOf(), [
      0.5, -0.5, 0.25
    ]);
  });

  it('should compute the argument of a real number correctly', function() {
    assert.equal(arg(2) / math.pi, 0);
    assert.equal(arg(-2) / math.pi, 1);
  });

  it('should throw an error if used with a string', function() {
    assert.throws(function () {arg('string')});
  });

  it('should throw an error if used with a unit', function() {
    assert.throws(function () {arg(math.unit('5cm'))});
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {arg()}, /TypeError: Too few arguments/);
    assert.throws(function () {arg(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX arg', function () {
    var expression = math.parse('arg(1+i)');
    assert.equal(expression.toTex(), '\\arg\\left(1+ i\\right)');
  });

});
