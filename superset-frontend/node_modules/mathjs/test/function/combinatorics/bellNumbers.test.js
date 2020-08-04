var assert = require('assert'),
error = require('../../../lib/error/index'),
math = require('../../../index'),
bellNumbers = math.bellNumbers;

describe('bellNumbers', function() {

  it('should calculate the number of partitions of a set', function() {
    assert.equal(bellNumbers(3), 5);
    assert.equal(bellNumbers(0), 1);
    assert.equal(bellNumbers(8), 4140);
  });

  it('should calculate the bellNumbers of n items with BigNumbers', function(){
    assert.deepEqual(bellNumbers(math.bignumber(2)), math.bignumber(2));
    assert.deepEqual(bellNumbers(math.bignumber(3)), math.bignumber(5));
  });

  it('should not work with non-integer and negative input', function() {
    assert.throws(function() {bellNumbers(0.5)}, TypeError);
    assert.throws(function() {bellNumbers(-1)}, TypeError);
    assert.throws(function() {bellNumbers(math.bignumber(-3))}, TypeError);
    assert.throws(function() {bellNumbers(math.bignumber(3.5))}, TypeError);
  });

  it('should throw an error in case of non-integer input', function() {
    assert.throws(function() {bellNumbers(5.2)}, /Non-negative integer value expected/);
  });

  it('should throw an error in case of negative input', function() {
    assert.throws(function() {bellNumbers(-2)}, /Non-negative integer value expected/);
  });

  it('should throw an error in case of wrong number or type of arguments', function() {
    assert.throws(function() {bellNumbers(5, 3, 2)});
    assert.throws(function() {bellNumbers(true, "hello world")});
  });

  it('should LaTeX bellNumbers', function () {
    var expression = math.parse('bellNumbers(3)');
    assert.equal(expression.toTex(), '\\mathrm{B}_{3}');
  });

});
