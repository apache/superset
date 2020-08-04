var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    permutations = math.permutations;

describe('permutations', function() {

  it('should calculate the permutations of a number', function() {
    assert.equal(permutations(0), 1);
    assert.equal(permutations(1), 1);
    assert.equal(permutations(2), 2);
    assert.equal(permutations(3), 6);
    assert.equal(permutations(4), 24);
    assert.equal(permutations(5), 120);
  });

  it('should calculate the permutations of a BigNumber', function() {
    assert.deepEqual(permutations(math.bignumber(4)), math.bignumber(24));
    assert.deepEqual(permutations(math.bignumber(5)), math.bignumber(120));
    assert.deepEqual(permutations(math.bignumber(8)), math.bignumber(40320));
  });

  it('should calculate the permutations of a BigNumber, taking k at a time', function() {
    assert.deepEqual(permutations(math.bignumber(5), math.bignumber(4)), math.bignumber(120));
    assert.deepEqual(permutations(math.bignumber(6), math.bignumber(3)), math.bignumber(120));
    assert.deepEqual(permutations(math.bignumber(9), math.bignumber(8)), math.bignumber(362880));
  });

  it('should calculate the permutations of a number, taking k at a time', function() {
    assert.equal(permutations(5, 4), 120);
    assert.equal(permutations(9, 8), 362880);
    assert.equal(permutations(7, 5), 2520);
  });

  it('should fail loudly when k is larger than x', function() {
      assert.throws(function(){permutations(5, 6);}, TypeError);
      assert.throws(function(){permutations(math.bignumber(5), math.bignumber(6));}, TypeError);
  });

  it('should not accept negative or non-integer arguments', function() {
      assert.throws(function(){permutations(12, -6);}, TypeError);
      assert.throws(function(){permutations(-12, 6);}, TypeError);
      assert.throws(function(){permutations(4.5, 2);}, TypeError);
      assert.throws(function(){permutations(4, 0.5);}, TypeError);
      assert.throws(function(){permutations(math.bignumber(-12), -6);}, TypeError);
      assert.throws(function(){permutations(math.bignumber(12.5), math.bignumber(6));}, TypeError);
      assert.throws(function(){permutations(math.bignumber(12.5), math.pi);}, TypeError);
  });

  it('should not accept more than two arguments', function() {
      assert.throws(function(){permutations(12, 6, 13);});
      assert.throws(function(){permutations(-12, 6, 13);});
  });

  it('should not accept arguments of the wrong type', function() {
      assert.throws(function(){permutations("baa baa black sheep", true);});
      assert.throws(function(){permutations(new Array(12));});
  });

  it('should LaTeX permutations', function () {
    var expression = math.parse('permutations(2)');
    assert.equal(expression.toTex(), '\\mathrm{permutations}\\left(2\\right)');
  });

});
