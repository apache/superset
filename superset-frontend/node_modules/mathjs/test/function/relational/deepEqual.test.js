// test deepEqual
var assert = require('assert'),
    math = require('../../../index'),
    bignumber = math.bignumber,
    complex = math.complex,
    matrix = math.matrix,
    unit = math.unit,
    deepEqual = math.deepEqual;

describe('deepEqual', function() {

  it('should compare scalars correctly', function() {
    assert.equal(deepEqual(2, 3), false);
    assert.equal(deepEqual(2, 2), true);
    assert.equal(deepEqual(0, 0), true);
    assert.equal(deepEqual(-2, 2), false);
    assert.equal(deepEqual(true, 1), true);
  });

  it('should compare two matrices', function() {
    assert.deepEqual(deepEqual([1,4,5], [3,4,5]), false);
    assert.deepEqual(deepEqual([1,4,5], [1,4,5]), true);
    assert.deepEqual(deepEqual([1,4,5], [1,4]), false);
    assert.deepEqual(deepEqual([1,4], [1,4,5]), false);
    assert.deepEqual(deepEqual([1,4,5], matrix([3,4,5])), false);
    assert.deepEqual(deepEqual([1,4,5], matrix([1,4,5])), true);
    assert.deepEqual(deepEqual(matrix([1,4,5]), matrix([1,4,5])), true);

    assert.deepEqual(deepEqual(matrix([[1,2], [3,4]]), matrix([[1,2], [3,4]])), true);
    assert.deepEqual(deepEqual(matrix([[1,2], [3,4]]), matrix([[1,2], [3,5]])), false);
    assert.deepEqual(deepEqual(matrix([[1,2], [3,4]]), matrix([[1,2], [3,4], [5,6]])), false);
    assert.deepEqual(deepEqual(matrix([[1,2], [3,4], [5,6]]), matrix([[1,2], [3,4]])), false);
  });

  it('should compare mixed scalars and matrices', function() {
    assert.deepEqual(deepEqual([1,2,3], 2), false);
    assert.deepEqual(deepEqual(2, [1,2,3]), false);
    assert.deepEqual(deepEqual(matrix([1,2,3]), 2), false);
    assert.deepEqual(deepEqual(2, matrix([1,2,3])), false);
  });

  it('should compare two matrices with mixed types', function() {
    assert.deepEqual(deepEqual([1,4,5], [true,4,5]), true);
    assert.deepEqual(deepEqual([2,3], [2, bignumber(3)]), true);
    assert.deepEqual(deepEqual([2,3], [2, bignumber(4)]), false);
    assert.deepEqual(deepEqual([complex(2,3),3], [complex(2,3),3]), true);
    assert.deepEqual(deepEqual([complex(2,3),3], [complex(2,4),3]), false);
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {deepEqual(1)}, /TypeError: Too few arguments/);
    assert.throws(function () {deepEqual(1, 2, 3)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX deepEqual', function () {
    var expression = math.parse('deepEqual([1,2],[1,3])');
    assert.equal(expression.toTex(), '\\mathrm{deepEqual}\\left(\\begin{bmatrix}1\\\\2\\\\\\end{bmatrix},\\begin{bmatrix}1\\\\3\\\\\\end{bmatrix}\\right)');
  });

});
