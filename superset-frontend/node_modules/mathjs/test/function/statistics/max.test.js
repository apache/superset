var assert = require('assert');
var math = require('../../../index');
var BigNumber = math.type.BigNumber;
var Complex = math.type.Complex;
var DenseMatrix = math.type.DenseMatrix;
var Unit = math.type.Unit;
var max = math.max;

describe('max', function() {

  it('should return the max of numbers', function() {
    assert.equal(max(5), 5);
    assert.equal(max(3,1), 3);
    assert.equal(max(1,3), 3);
    assert.equal(max(1,3,5,2,-5), 5);
    assert.equal(max(0,0,0,0), 0);
  });

  it('should return the max of big numbers', function() {
    assert.deepEqual(max(new BigNumber(1),new BigNumber(3),new BigNumber(5),new BigNumber(2),new BigNumber(-5)),
        new BigNumber(5));
  });

  it('should return the max string following lexical order', function() {
    assert.equal(max('A', 'C', 'D', 'B'), 'D');
  });

  it('should return the max element from a vector', function() {
    assert.equal(max(new DenseMatrix([1,3,5,2,-5])), 5);
  });

  it('should return the max element from a 2d matrix', function() {
    assert.deepEqual(max([
      [ 1, 4,  7],
      [ 3, 0,  5],
      [-1, 11, 9]
    ]), 11);
    assert.deepEqual(max(new DenseMatrix([
      [ 1, 4,  7],
      [ 3, 0,  5],
      [-1, 11, 9]
    ])), 11);
  });

  it('should return a reduced n-1 matrix from a n matrix', function() {
    assert.deepEqual(max([
      [ 1, 2, 3],
      [ 4, 5, 6],
      [ 7, 8, 9]
    ], 0), [7, 8, 9]);

    assert.deepEqual(max([
      [ 1, 2, 3],
      [ 4, 5, 6],
      [ 7, 8, 9]
    ], 1), [3, 6, 9]);

    assert.deepEqual(max([
      [ 1, 2, 3],
      [ 6, 5, 4],
      [ 8, 7, 9]
    ], 1), [3, 6, 9]);

    assert.deepEqual(max([
      [ [1,2], [3,4], [5,6]],
      [ [6,7], [8,9], [10,11]]
    ], 2),
        [[2, 4, 6], [7, 9, 11]]);
  });

  it('should throw an error when called with complex numbers', function() {
    assert.throws(function () {max(new Complex(2,3), new Complex(2,1))}, TypeError);
    assert.throws(function () {max(new Complex(2,3), new Complex(2,5))}, TypeError);

    assert.throws(function () {max(new Complex(3,4), 4)}, TypeError);
    assert.throws(function () {max(new Complex(3,4), 5)}, TypeError);
    assert.throws(function () {max(5, new Complex(3,4))}, TypeError);
    assert.throws(function () {max(new Complex(3,4), 6)}, TypeError);
  });

  it('should throw an error when called multiple arrays or matrices', function() {
    assert.throws(function () {max([1,2], [3,4])}, /Scalar values expected/);
    assert.throws(function () {max(math.matrix([1,2]), math.matrix([3,4]))}, /Scalar values expected/);
  });

  it('should throw an error if called a dimension out of range', function() {
    assert.throws(function() {max([1,2,3], -1)}, /IndexError: Index out of range \(-1 < 0\)/);
    assert.throws(function() {max([1,2,3], 1)}, /IndexError: Index out of range \(1 > 0\)/);
  });

  it('should throw an error if called with invalid number of arguments', function() {
    assert.throws(function() {max()});
    assert.throws(function() {max([], 2, 3)});
  });

  it('should return undefined if called with an empty array', function() {
    assert.throws(function() {max([])});
  });

  it('should LaTeX max', function () {
    var expression = math.parse('max(1,2,3)');
    assert.equal(expression.toTex(), '\\max\\left(1,2,3\\right)');
  });

});
