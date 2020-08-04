// test rightLogShift
var assert = require('assert'),
    math = require('../../../index'),
    matrix = math.matrix,
    sparse = math.sparse,
    rightLogShift = math.rightLogShift;

describe('rightLogShift', function () {

  it('should right logically shift a number by a given amount', function () {
    assert.equal(rightLogShift(0, 1000), 0);
    assert.equal(rightLogShift(2, 0), 2);
    assert.equal(rightLogShift(12, 3), 1);
    assert.equal(rightLogShift(32, 4), 2);
    assert.equal(rightLogShift(-1, 1000), 16777215);
    assert.equal(rightLogShift(-12, 2), 1073741821);
    assert.equal(rightLogShift(122, 3), 15);
    assert.equal(rightLogShift(-13, 2), 1073741820);
    assert.equal(rightLogShift(-13, 3), 536870910);
  });

  it('should right logically shift booleans by a boolean amount', function () {
    assert.equal(rightLogShift(true, true), 0);
    assert.equal(rightLogShift(true, false), 1);
    assert.equal(rightLogShift(false, true), 0);
    assert.equal(rightLogShift(false, false), 0);
  });

  it('should right logically shift with a mix of numbers and booleans', function () {
    assert.equal(rightLogShift(2, true), 1);
    assert.equal(rightLogShift(2, false), 2);
    assert.equal(rightLogShift(true, 0), 1);
    assert.equal(rightLogShift(true, 1), 0);
    assert.equal(rightLogShift(false, 2), 0);
  });

  it('should right logically shift numbers and null', function () {
    assert.equal(rightLogShift(1, null), 1);
    assert.equal(rightLogShift(null, 1), 0);
  });

  it('should throw an error if the parameters are not integers', function () {
    assert.throws(function () {
      rightLogShift(1.1, 1);
    }, /Integers expected in function rightLogShift/);
    assert.throws(function () {
      rightLogShift(1, 1.1);
    }, /Integers expected in function rightLogShift/);
    assert.throws(function () {
      rightLogShift(1.1, 1.1);
    }, /Integers expected in function rightLogShift/);
  });

  it('should throw an error if used with a unit', function() {
    assert.throws(function () {rightLogShift(math.unit('5cm'), 2);}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {rightLogShift(2, math.unit('5cm'));}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {rightLogShift(math.unit('2cm'), math.unit('5cm'));}, /TypeError: Unexpected type of argument/);
  });

  describe('Array', function () {

    it('should right arithmetically shift array - scalar', function () {
      assert.deepEqual(rightLogShift([[4, 8], [8, 0]], 2), [[1, 2], [2, 0]]);
      assert.deepEqual(rightLogShift([[4, 8], [12, 16]], 2), [[1, 2], [3, 4]]);
      assert.deepEqual(rightLogShift(2, [[1, 2], [8, 0]]), [[1, 0], [0, 2]]);
    });

    it('should right arithmetically shift array - array', function () {
      assert.deepEqual(rightLogShift([[1, 2], [8, 0]], [[4, 8], [32, 0]]), [[0, 0], [8, 0]]);
      assert.deepEqual(rightLogShift([[4, 8], [32, 0]], [[1, 2], [8, 0]]), [[2, 2], [0, 0]]);
    });

    it('should right arithmetically shift array - dense matrix', function () {
      assert.deepEqual(rightLogShift([[1, 2], [8, 0]], matrix([[4, 8], [32, 0]])), matrix([[0, 0], [8, 0]]));
      assert.deepEqual(rightLogShift([[4, 8], [32, 0]], matrix([[1, 2], [8, 0]])), matrix([[2, 2], [0, 0]]));
    });

    it('should right arithmetically shift array - sparse matrix', function () {
      assert.deepEqual(rightLogShift([[1, 2], [8, 0]], sparse([[4, 8], [32, 0]])), matrix([[0, 0], [8, 0]]));
      assert.deepEqual(rightLogShift([[4, 8], [32, 0]], sparse([[1, 2], [8, 0]])), matrix([[2, 2], [0, 0]]));
    });
  });
  
  describe('DenseMatrix', function () {

    it('should right arithmetically shift dense matrix - scalar', function () {
      assert.deepEqual(rightLogShift(matrix([[4, 8], [8, 0]]), 2), matrix([[1, 2], [2, 0]]));
      assert.deepEqual(rightLogShift(matrix([[4, 8], [12, 16]]), 2), matrix([[1, 2], [3, 4]]));
      assert.deepEqual(rightLogShift(2, matrix([[1, 2], [8, 0]])), matrix([[1, 0], [0, 2]]));
    });

    it('should right arithmetically shift dense matrix - array', function () {
      assert.deepEqual(rightLogShift(matrix([[1, 2], [8, 0]]), [[4, 8], [32, 0]]), matrix([[0, 0], [8, 0]]));
      assert.deepEqual(rightLogShift(matrix([[4, 8], [32, 0]]), [[1, 2], [8, 0]]), matrix([[2, 2], [0, 0]]));
    });

    it('should right arithmetically shift dense matrix - dense matrix', function () {
      assert.deepEqual(rightLogShift(matrix([[1, 2], [8, 0]]), matrix([[4, 8], [32, 0]])), matrix([[0, 0], [8, 0]]));
      assert.deepEqual(rightLogShift(matrix([[4, 8], [32, 0]]), matrix([[1, 2], [8, 0]])), matrix([[2, 2], [0, 0]]));
    });

    it('should right arithmetically shift dense matrix - sparse matrix', function () {
      assert.deepEqual(rightLogShift(matrix([[1, 2], [8, 0]]), sparse([[4, 8], [32, 0]])), matrix([[0, 0], [8, 0]]));
      assert.deepEqual(rightLogShift(matrix([[4, 8], [32, 0]]), sparse([[1, 2], [8, 0]])), matrix([[2, 2], [0, 0]]));
    });
  });

  describe('SparseMatrix', function () {

    it('should right arithmetically shift sparse matrix - scalar', function () {
      assert.deepEqual(rightLogShift(sparse([[4, 8], [8, 0]]), 2), sparse([[1, 2], [2, 0]]));
      assert.deepEqual(rightLogShift(sparse([[4, 8], [12, 16]]), 2), sparse([[1, 2], [3, 4]]));
      assert.deepEqual(rightLogShift(2, sparse([[1, 2], [8, 0]])), matrix([[1, 0], [0, 2]]));
    });

    it('should right arithmetically shift sparse matrix - array', function () {
      assert.deepEqual(rightLogShift(sparse([[1, 2], [8, 0]]), [[4, 8], [32, 0]]), sparse([[0, 0], [8, 0]]));
      assert.deepEqual(rightLogShift(sparse([[4, 8], [32, 0]]), [[1, 2], [8, 0]]), sparse([[2, 2], [0, 0]]));
    });

    it('should right arithmetically shift sparse matrix - dense matrix', function () {
      assert.deepEqual(rightLogShift(sparse([[1, 2], [8, 0]]), matrix([[4, 8], [32, 0]])), sparse([[0, 0], [8, 0]]));
      assert.deepEqual(rightLogShift(sparse([[4, 8], [32, 0]]), matrix([[1, 2], [8, 0]])), sparse([[2, 2], [0, 0]]));
    });

    it('should right arithmetically shift sparse matrix - sparse matrix', function () {
      assert.deepEqual(rightLogShift(sparse([[1, 2], [8, 0]]), sparse([[4, 8], [32, 0]])), sparse([[0, 0], [8, 0]]));
      assert.deepEqual(rightLogShift(sparse([[4, 8], [32, 0]]), sparse([[1, 2], [8, 0]])), sparse([[2, 2], [0, 0]]));
    });
  });

  it('should throw an error if used with wrong number of arguments', function () {
    assert.throws(function () {rightLogShift(1);}, /TypeError: Too few arguments/);
    assert.throws(function () {rightLogShift(1, 2, 3);}, /TypeError: Too many arguments/);
  });

  it('should throw an error in case of invalid type of arguments', function () {
    assert.throws(function () {rightLogShift(new Date(), true);}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {rightLogShift(true, new Date());}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {rightLogShift(true, undefined);}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {rightLogShift(undefined, true);}, /TypeError: Unexpected type of argument/);
  });

  it('should LaTeX rightLogShift', function () {
    var expression = math.parse('rightLogShift(1,2)');
    assert.equal(expression.toTex(), '\\left(1>>>2\\right)');
  });

});
