var assert = require('assert');
var math = require('../../../index');

describe('im', function() {

  it('should return the imaginary part of a complex number', function() {
    assert.equal(math.im(math.complex(2,3)), 3);
    assert.equal(math.im(math.complex(-2,-3)), -3);
    assert.equal(math.im(math.i), 1);
  });

  it('should return the imaginary part of a real number', function() {
    assert.equal(math.im(2), 0);
  });

  it('should return the imaginary part of a big number', function() {
    assert.deepEqual(math.im(math.bignumber(2)), math.bignumber(0));
  });

  it('should return the imaginary part of a boolean', function() {
    assert.equal(math.im(true), 0);
    assert.equal(math.im(false), 0);
  });

  it('should return the imaginary part of null', function() {
    assert.equal(math.im(null), 0);
  });

  it('should return the imaginary part of a boolean', function() {
    assert.equal(math.im(true), 0);
    assert.equal(math.im(false), 0);
  });

  it('should return the imaginary part for each element in a matrix', function() {
    assert.deepEqual(math.im([2, math.complex('3-6i')]), [0, -6]);
    assert.deepEqual(math.im(math.matrix([2, math.complex('3-6i')])).valueOf(), [0, -6]);
  });

  it('should throw an error when called with an unsupported type of argument', function() {
    assert.throws(function () {math.im(new Date())}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {math.im(math.unit('5cm'))}, /TypeError: Unexpected type of argument/);
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {math.im()}, /TypeError: Too few arguments/);
    assert.throws(function () {math.im(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX im', function () {
    var expression = math.parse('im(1+i)');
    assert.equal(expression.toTex(), '\\Im\\left\\lbrace1+ i\\right\\rbrace');
  });

});
