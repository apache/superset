// test inv
var assert = require('assert'),
    approx = require('../../../tools/approx'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    inv = math.inv;

describe('inv', function() {

  it('should return the inverse of a number', function() {
    assert.deepEqual(inv(4), 1/4);
    assert.deepEqual(inv(math.bignumber(4)), math.bignumber(1/4));
  });

  it('should return the inverse of a matrix with just one value', function() {
    assert.deepEqual(inv([4]), [1/4]);
    assert.deepEqual(inv([[4]]), [[1/4]]);
  });

  it('should return the inverse for each element in an array', function() {
    assert.deepEqual(inv([4]), [1/4]);
    assert.deepEqual(inv([[4]]), [[1/4]]);

    approx.deepEqual(inv([
      [ 1, 4,  7],
      [ 3, 0,  5],
      [-1, 9, 11]
    ]), [
      [ 5.625, -2.375, -2.5],
      [ 4.75,  -2.25,  -2],
      [-3.375,  1.625,  1.5]
    ]);

    approx.deepEqual(inv([
      [ 2, -1,  0],
      [-1,  2, -1],
      [ 0, -1,  2]
    ]), [
      [3/4, 1/2, 1/4],
      [1/2, 1,   1/2],
      [1/4, 1/2, 3/4]
    ]);

    // the following will force swapping of empty rows in the middle of the matrix
    approx.deepEqual(inv([
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 0]
    ]), [
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 0]
    ]);
  });

  it('should return the inverse for each element in a matrix', function() {
    assert.deepEqual(inv(math.matrix([4])), math.matrix([1/4]));
    assert.deepEqual(inv(math.matrix([[4]])), math.matrix([[1/4]]));
    assert.deepEqual(inv(math.matrix([[4]], 'sparse')), math.matrix([[1/4]], 'sparse'));
    assert.deepEqual(inv(math.matrix([[1,2],[3,4]], 'sparse')), math.matrix([[-2, 1],[1.5, -0.5]], 'sparse'));
  });

  it('should throw an error in case of non-square matrices', function() {
    assert.throws(function () {inv([1,2,3])}, /Matrix must be square/);
    assert.throws(function () {inv([[1,2,3], [4,5,6]])}, /Matrix must be square/);
  });

  it('should throw an error in case of multi dimensional matrices', function() {
    assert.throws(function () {inv([[[1,2,3], [4,5,6]]])}, /Matrix must be two dimensional/);
  });

  it('should throw an error in case of non-invertable matrices', function() {
    assert.throws(function () {inv([[0]])}, /Cannot calculate inverse, determinant is zero/);
    assert.throws(function () {inv([[1,0], [0,0]])}, /Cannot calculate inverse, determinant is zero/);
    assert.throws(function () {inv([[1,1,1], [1,0,0], [0,0,0]])}, /Cannot calculate inverse, determinant is zero/);
  });

  it('should throw an error in case of wrong number of arguments', function() {
    assert.throws(function () {inv()}, /TypeError: Too few arguments/);
    assert.throws(function () {inv([], [])}, /TypeError: Too many arguments/);
  });

  it('should throw an error in case of invalid type of arguments', function() {
    assert.throws(function () {math.concat(inv(new Date()))}, /TypeError: Unexpected type of argument/);
  });

  it('should  LaTeX inv', function () {
    var expression = math.parse('inv([[1,2],[3,4]])');
    assert.equal(expression.toTex(), '\\left(\\begin{bmatrix}1&2\\\\3&4\\\\\\end{bmatrix}\\right)^{-1}');
  });

});
