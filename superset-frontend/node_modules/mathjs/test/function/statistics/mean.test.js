var assert = require('assert');
var math = require('../../../index');
var BigNumber = math.type.BigNumber;
var Complex = math.type.Complex;
var DenseMatrix = math.type.DenseMatrix;
var Unit = math.type.Unit;
var mean = math.mean;

describe('mean', function() {
  it('should return the mean value of some numbers', function() {
    assert.equal(mean(5), 5);
    assert.equal(mean(3,1), 2);
    assert.equal(mean(0,3), 1.5);
    assert.equal(mean(1,3,5,2,-5), 1.2);
    assert.equal(mean(0,0,0,0), 0);
  });

  it('should return the mean of big numbers', function() {
    assert.deepEqual(mean(new BigNumber(1),new BigNumber(3),new BigNumber(5),new BigNumber(2),new BigNumber(-5)),
        new math.type.BigNumber(1.2));
  });

  it('should return the mean value for complex values', function() {
    assert.deepEqual(mean(new Complex(2,3), new Complex(2,1)), new Complex(2,2));
    assert.deepEqual(mean(new Complex(2,3), new Complex(2,5)), new Complex(2,4));
  });

  it('should return the mean value for mixed real and complex values', function() {
    assert.deepEqual(mean(new Complex(2,4), 4), new Complex(3,2));
    assert.deepEqual(mean(4, new Complex(2,4)), new Complex(3,2));
  });

  it('should return the mean value from an array', function() {
    assert.equal(mean([5]), 5);
    assert.equal(mean([1,3,5,2,-5]), 1.2);
  });

  it('should return the mean value from a 1d matrix', function() {
    assert.equal(mean(new DenseMatrix([5])), 5);
    assert.equal(mean(new DenseMatrix([1,3,5,2,-5])), 1.2);
  });

  it('should return the mean for each vector on the last dimension', function() {
    assert.deepEqual(mean([
      [ 2, 4],
      [ 6, 8]
    ]), 5);
    assert.deepEqual(mean(new DenseMatrix([
      [ 2, 4],
      [ 6, 8]
    ])), 5);
  });

  var inputMatrix = [ // this is a 4x3x2 matrix, full test coverage
          [ [10,20], [30,40], [50,60] ],
          [ [70,80], [90,100], [110,120] ],
          [ [130,140], [150,160], [170,180] ],
          [ [190,200], [210,220], [230,240]]
        ];

  it('should return the mean value along a dimension on a matrix', function() {
    assert.deepEqual(mean([
        [2, 6],
        [4, 10]], 1), [4, 7]);
    assert.deepEqual(mean([
        [2, 6],
        [4, 10]], 0), [3, 8]);
    assert.deepEqual(mean(inputMatrix, 0),
      [ [100, 110], [120, 130], [140,150] ]);
    assert.deepEqual(mean(inputMatrix, 1),
      [ [30, 40], [90,100], [150,160], [210,220]]);
    assert.deepEqual(mean(inputMatrix, 2),
      [[15, 35, 55],[75,95,115],[135,155,175],[195, 215, 235]]);
  });

  it('should throw an error if called with invalid number of arguments', function() {
    assert.throws(function() {mean()});
    assert.throws(function() {mean([], 2, 3)});
  });

  it('should throw an error when called multiple arrays or matrices', function() {
    assert.throws(function () {mean([1,2], [3,4])}, /Scalar values expected/);
    assert.throws(function () {mean(math.matrix([1,2]), math.matrix([3,4]))}, /Scalar values expected/);
  });

  it('should throw an error if called a dimension out of range', function() {
    assert.throws(function() {mean([1,2,3], -1)}, /IndexError: Index out of range \(-1 < 0\)/);
    assert.throws(function() {mean([1,2,3], 1)}, /IndexError: Index out of range \(1 > 0\)/);
  });

  it('should throw an error if called with an empty array', function() {
    assert.throws(function() {mean([])});
  });

  it('should LaTeX mean', function () {
    var expression = math.parse('mean(1,2,3,4)');
    assert.equal(expression.toTex(), '\\mathrm{mean}\\left(1,2,3,4\\right)');
  });

});
