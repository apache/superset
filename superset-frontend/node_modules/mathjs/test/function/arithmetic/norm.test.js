// test norm
var assert = require('assert'),
    math = require('../../../index');

describe('norm', function () {

  it('should return the absolute value of a boolean', function () {
    assert.equal(math.norm(true), 1);
    assert.equal(math.norm(true, 10), 1);
    assert.equal(math.norm(false), 0);
    assert.equal(math.norm(false, 10), 0);
  });

  it('should return the absolute value of null', function () {
    assert.equal(math.norm(null), 0);
    assert.equal(math.norm(null, 10), 0);
  });

  it('should return the absolute value of a number', function () {
    assert.equal(math.norm(-4.2), 4.2);
    assert.equal(math.norm(-3.5), 3.5);
    assert.equal(math.norm(100), 100);
    assert.equal(math.norm(0), 0);
    assert.equal(math.norm(100, 10), 100);
  });

  it('should return the absolute value of a big number', function () {
    assert.deepEqual(math.norm(math.bignumber(-2.3)), math.bignumber(2.3));
    assert.deepEqual(math.norm(math.bignumber('5e500')), math.bignumber('5e500'));
    assert.deepEqual(math.norm(math.bignumber('-5e500')), math.bignumber('5e500'));
  });

  it('should return the norm of a complex number', function () {
    assert.equal(math.norm(math.complex(3, -4)), 5);
    assert.equal(math.norm(math.complex(1e200, -4e200)), 4.12310562561766e+200);
    assert.equal(math.norm(math.complex(-4e200, 1e200)), 4.12310562561766e+200);
  });

  it('should return the norm of a vector', function () {
    // empty vector
    assert.equal(math.norm([]), 0.0);
    assert.equal(math.norm(math.matrix([])), 0.0);
    // p = Infinity
    assert.equal(math.norm([1, 2, -3], Number.POSITIVE_INFINITY), 3);
    assert.equal(math.norm(math.matrix([1, 2, -3]), Number.POSITIVE_INFINITY), 3);
    assert.equal(math.norm([1, 2, -3], 'inf'), 3);
    assert.equal(math.norm(math.matrix([1, 2, -3]), 'inf'), 3);
    // p = -Infinity
    assert.equal(math.norm([1, 2, -3], Number.NEGATIVE_INFINITY), 1);
    assert.equal(math.norm(math.matrix([1, 2, -3]), Number.NEGATIVE_INFINITY), 1);
    assert.equal(math.norm([1, 2, -3], '-inf'), 1);
    assert.equal(math.norm(math.matrix([1, 2, -3]), '-inf'), 1);
    // p == 1
    assert.equal(math.norm([-3, -4], 1), 7.0);
    assert.equal(math.norm(math.matrix([-3, -4]), 1), 7.0);
    // p - positive
    assert.equal(math.norm([3, 4], 2), 5.0);
    assert.equal(math.norm(math.matrix([3, 4]), 2), 5.0);
    // p - negative
    assert.equal(math.norm([3, 4], -2), 2.4);
    assert.equal(math.norm(math.matrix([3, 4]), -2), 2.4);
    // missing p (defaults to 2)
    assert.equal(math.norm([3, 4]), 5.0);
    assert.equal(math.norm(math.matrix([3, 4])), 5.0);
    // p == 'fro'
    assert.equal(math.norm([3, 4], 'fro'), 5.0);
    assert.equal(math.norm(math.matrix([3, 4]), 'fro'), 5.0);
    // p == 0
    assert.equal(math.norm([3, 4], 0), Number.POSITIVE_INFINITY);
    assert.equal(math.norm(math.matrix([3, 4]), 0), Number.POSITIVE_INFINITY);
  });

  it('should return the norm of a matrix', function () {
    // p = 1
    assert.equal(math.norm([[1, 2], [3, 4]], 1), 6);
    assert.equal(math.norm(math.matrix([[1, 2], [3, 4]]), 1), 6);
    assert.equal(math.norm(math.matrix([[1, 2], [3, 4]], 'sparse'), 1), 6);
    // p = Infinity
    assert.equal(math.norm([[1, 2], [3, 4]], Number.POSITIVE_INFINITY), 7);
    assert.equal(math.norm(math.matrix([[1, 2], [3, 4]]), Number.POSITIVE_INFINITY), 7);
    assert.equal(math.norm(math.matrix([[1, 2], [3, 4]], 'sparse'), Number.POSITIVE_INFINITY), 7);
    assert.equal(math.norm([[1, 2], [3, 4]], 'inf'), 7);
    assert.equal(math.norm(math.matrix([[1, 2], [3, 4]]), 'inf'), 7);
    assert.equal(math.norm(math.matrix([[1, 2], [3, 4]], 'sparse'), 'inf'), 7);
    // p = 'fro'
    assert.equal(math.norm([[1, 2], [-3, -4]], 'fro'), math.sqrt(30));
    assert.equal(math.norm(math.matrix([[1, 2], [-3, -4]]), 'fro'), math.sqrt(30));
    assert.equal(math.norm(math.matrix([[1, 2], [-3, -4]], 'sparse'), 'fro'), math.sqrt(30));
    // p - not implemented yet!
    assert.throws(function() {
      math.norm(math.norm([[1, 2], [3, 4]], 2), 6);
    });
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {math.norm();}, /TypeError: Too few arguments/);
    assert.throws(function () {math.norm(1, 2, 3);}, /TypeError: Too many arguments/);
  });

  it('should throw an error with a string', function () {
    assert.throws(function () {
      math.norm('a string');
    });
  });

  it('should LaTeX norm', function () {
    var expr1 = math.parse('norm(a)');
    var expr2 = math.parse("norm(a,2)");

    assert.equal(expr1.toTex(), '\\left\\| a\\right\\|');
    assert.equal(expr2.toTex(), '\\mathrm{norm}\\left( a,2\\right)');
  });
});
