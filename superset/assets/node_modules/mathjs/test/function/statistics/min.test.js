var assert = require('assert');
var math = require('../../../index');
var BigNumber = math.type.BigNumber;
var Complex = math.type.Complex;
var DenseMatrix = math.type.DenseMatrix;
var Unit = math.type.Unit;
var min = math.min;

describe('min', function() {

  it('should return the min between several numbers', function() {
    assert.equal(min(5), 5);
    assert.equal(min(1,3), 1);
    assert.equal(min(3,1), 1);
    assert.equal(min(1,3,5,-5,2), -5);
    assert.equal(min(0,0,0,0), 0);
  });

  it('should return the min string following lexical order', function() {
    assert.equal(min('A', 'C', 'D', 'B'), 'A');
  });

  it('should return the min element from a vector', function() {
    assert.equal(min([1,3,5,-5,2]), -5);
  });

  it('should return the min of big numbers', function() {
    assert.deepEqual(min(new BigNumber(1),new BigNumber(3),new BigNumber(5),new BigNumber(2),new BigNumber(-5)),
        new BigNumber(-5));
  });

  it('should return the min element from a vector array', function() {
    assert.equal(min(new DenseMatrix([1,3,5,-5,2])), -5);
  });

  it('should return the max element from a 2d matrix', function() {
    assert.deepEqual(min([
      [ 1, 4,  7],
      [ 3, 0,  5],
      [-1, 9, 11]
    ]), -1);
    assert.deepEqual(min(new DenseMatrix([
      [ 1, 4,  7],
      [ 3, 0,  5],
      [-1, 9, 11]
    ])), -1);
  });

  it('should return a reduced n-1 matrix from a n matrix', function() {
    assert.deepEqual(min([
        [ 1, 2, 3],
        [ 4, 5, 6],
        [ 7, 8, 9]], 0), [1, 2, 3]);
    assert.deepEqual(min([
        [ 1, 2, 3],
        [ 4, 5, 6],
        [ 7, 8, 9]], 1), [1, 4, 7]);

    assert.deepEqual(min([
        [ 1, 2, 3],
        [ 6, 5, 4],
        [ 8, 7, 9]], 1), [1, 4, 7]);

    assert.deepEqual(min([
        [ [1,2], [3,4], [5,6]],
        [ [6,7], [8,9], [10,11]]], 2),
      [[1, 3, 5], [6, 8, 10]]);

    assert.deepEqual(min([
        [ [1,2], [3,4], [5,6]],
        [ [6,7], [8,9], [10,11]]], 1),
      [[1, 2], [6,7]]);

    assert.deepEqual(min([
        [ [1,2], [3,4], [5,6]],
        [ [6,7], [8,9], [10,11]]], 0),
      [[1, 2], [3,4], [5,6]]);
  });

  it('should throw an error when called with complex numbers', function() {
    assert.throws(function () {min(new Complex(2,3), new Complex(2,1))}, TypeError);
    assert.throws(function () {min(new Complex(2,3), new Complex(2,5))}, TypeError);

    assert.throws(function () {min(new Complex(3,4), 4)}, TypeError);
    assert.throws(function () {min(new Complex(3,4), 5)}, TypeError);
    assert.throws(function () {min(5, new Complex(3,4))}, TypeError);
    assert.throws(function () {min(new Complex(3,4), 6)}, TypeError);
  });

  it('should throw an error when called multiple arrays or matrices', function() {
    assert.throws(function () {min([1,2], [3,4])}, /Scalar values expected/);
    assert.throws(function () {min(math.matrix([1,2]), math.matrix([3,4]))}, /Scalar values expected/);
  });

  it('should throw an error if called a dimension out of range', function() {
    assert.throws(function() {min([1,2,3], -1)}, /IndexError: Index out of range \(-1 < 0\)/);
    assert.throws(function() {min([1,2,3], 1)}, /IndexError: Index out of range \(1 > 0\)/);
  });

  it('should throw an error if called with invalid number of arguments', function() {
    assert.throws(function() {min()});
    assert.throws(function() {min([], 2, 3)});
  });

  it('should throw an error if called with an empty array', function() {
    assert.throws(function() {min([])});
  });

  it('should LaTeX min', function () {
    var expression = math.parse('min(1,2,3)');
    assert.equal(expression.toTex(), '\\min\\left(1,2,3\\right)');
  });

});
