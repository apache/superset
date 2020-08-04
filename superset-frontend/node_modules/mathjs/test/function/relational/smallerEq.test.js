// test smaller
var assert = require('assert'),
    math = require('../../../index'),
    bignumber = math.bignumber,
    complex = math.complex,
    matrix = math.matrix,
    sparse = math.sparse,
    unit = math.unit,
    smallerEq = math.smallerEq;

describe('smallerEq', function() {

  it('should compare two numbers correctly', function() {
    assert.equal(smallerEq(2, 3), true);
    assert.equal(smallerEq(2, 2), true);
    assert.equal(smallerEq(2, 1), false);
    assert.equal(smallerEq(0, 0), true);
    assert.equal(smallerEq(-2, 2), true);
    assert.equal(smallerEq(-2, -3), false);
    assert.equal(smallerEq(-2, -2), true);
    assert.equal(smallerEq(-3, -2), true);
  });

  it('should compare two floating point numbers correctly', function() {
    // Infinity
    assert.equal(smallerEq(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY), true);
    assert.equal(smallerEq(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY), true);
    assert.equal(smallerEq(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY), false);
    assert.equal(smallerEq(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY), true);
    assert.equal(smallerEq(Number.POSITIVE_INFINITY, 2.0), false);
    assert.equal(smallerEq(2.0, Number.POSITIVE_INFINITY), true);
    assert.equal(smallerEq(Number.NEGATIVE_INFINITY, 2.0), true);
    assert.equal(smallerEq(2.0, Number.NEGATIVE_INFINITY), false);
    // floating point numbers
    assert.equal(smallerEq(0.3 - 0.2, 0.1), true);
  });

  it('should compare two booleans', function() {
    assert.equal(smallerEq(true, true), true);
    assert.equal(smallerEq(true, false), false);
    assert.equal(smallerEq(false, true), true);
    assert.equal(smallerEq(false, false), true);
  });

  it('should compare mixed numbers and booleans', function() {
    assert.equal(smallerEq(2, true), false);
    assert.equal(smallerEq(1, true), true);
    assert.equal(smallerEq(0, true), true);
    assert.equal(smallerEq(true, 2), true);
    assert.equal(smallerEq(true, 1), true);
    assert.equal(smallerEq(false, 2), true);
  });

  it('should compare mixed numbers and null', function() {
    assert.equal(smallerEq(1, null), false);
    assert.equal(smallerEq(0, null), true);
    assert.equal(smallerEq(null, 1), true);
    assert.equal(smallerEq(null, 0), true);
  });

  it('should compare bignumbers', function() {
    assert.deepEqual(smallerEq(bignumber(2), bignumber(3)), true);
    assert.deepEqual(smallerEq(bignumber(2), bignumber(2)), true);
    assert.deepEqual(smallerEq(bignumber(3), bignumber(2)), false);
    assert.deepEqual(smallerEq(bignumber(0), bignumber(0)), true);
    assert.deepEqual(smallerEq(bignumber(-2), bignumber(2)), true);
  });

  it('should compare mixed numbers and bignumbers', function() {
    assert.deepEqual(smallerEq(bignumber(2), 3), true);
    assert.deepEqual(smallerEq(2, bignumber(2)), true);

    assert.throws(function () {smallerEq(1/3, bignumber(1).div(3));}, /TypeError: Cannot implicitly convert a number with >15 significant digits to BigNumber/);
    assert.throws(function () {smallerEq(bignumber(1).div(3), 1/3);}, /TypeError: Cannot implicitly convert a number with >15 significant digits to BigNumber/);
  });

  it('should compare mixed booleans and bignumbers', function() {
    assert.deepEqual(smallerEq(bignumber(0.1), true), true);
    assert.deepEqual(smallerEq(bignumber(1), true), true);
    assert.deepEqual(smallerEq(bignumber(1), false), false);
    assert.deepEqual(smallerEq(bignumber(0), false), true);
    assert.deepEqual(smallerEq(false, bignumber(0)), true);
    assert.deepEqual(smallerEq(true, bignumber(0)), false);
    assert.deepEqual(smallerEq(true, bignumber(1)), true);
  });

  it('should compare two fractions', function() {
    assert.strictEqual(smallerEq(math.fraction(3), math.fraction(2)).valueOf(), false);
    assert.strictEqual(smallerEq(math.fraction(2), math.fraction(3)).valueOf(), true);
    assert.strictEqual(smallerEq(math.fraction(3), math.fraction(3)).valueOf(), true);
  });

  it('should compare mixed fractions and numbers', function() {
    assert.strictEqual(smallerEq(1, math.fraction(1,3)), false);
    assert.strictEqual(smallerEq(math.fraction(2), 2), true);
  });

  it('should compare two measures of the same unit correctly', function() {
    assert.equal(smallerEq(unit('100cm'), unit('10inch')), false);
    assert.equal(smallerEq(unit('99cm'), unit('1m')), true);
    //assert.equal(smallerEq(unit('100cm'), unit('1m')), true); // dangerous, round-off errors
    assert.equal(smallerEq(unit('101cm'), unit('1m')), false);
  });

  it('should apply configuration option epsilon', function() {
    var mymath = math.create();
    assert.equal(mymath.smallerEq(1.01, 1), false);
    assert.equal(mymath.smallerEq(math.bignumber(1.01), math.bignumber(1)), false);

    mymath.config({epsilon: 1e-2});
    assert.equal(mymath.smallerEq(1.01, 1), true);
    assert.equal(mymath.smallerEq(math.bignumber(1.01), math.bignumber(1)), true);
  });

  it('should throw an error if comparing a unit with a number', function() {
    assert.throws(function () {smallerEq(unit('100cm'), 22);});
    assert.throws(function () {smallerEq(22, unit('100cm'));});
  });

  it('should throw an error for two measures of different units', function() {
    assert.throws(function () {smallerEq(math.unit(5, 'km'), math.unit(100, 'gram'));});
  });

  it('should throw an error if comparing a unit with a bignumber', function() {
    assert.throws(function () {smallerEq(unit('100cm'), bignumber(22));});
    assert.throws(function () {smallerEq(bignumber(22), unit('100cm'));});
  });

  it('should perform lexical comparison of two strings', function() {
    assert.equal(smallerEq('0', 0), true);
    assert.equal(smallerEq('abd', 'abc'), false);
    assert.equal(smallerEq('abc', 'abc'), true);
    assert.equal(smallerEq('abc', 'abd'), true);
  });

  describe('Array', function () {

    it('should compare array - scalar', function () {
      assert.deepEqual(smallerEq('B', ['A', 'B', 'C']), [false, true, true]);
      assert.deepEqual(smallerEq(['A', 'B', 'C'], 'B'), [true, true, false]);
    });

    it('should compare array - array', function () {
      assert.deepEqual(smallerEq([[1, 2, 0], [-1, 0, 2]], [[1, -1, 0], [-1, 1, 0]]), [[true, false, true], [true, true, false]]);
    });

    it('should compare array - dense matrix', function () {
      assert.deepEqual(smallerEq([[1, 2, 0], [-1, 0, 2]], matrix([[1, -1, 0], [-1, 1, 0]])), matrix([[true, false, true], [true, true, false]]));
    });

    it('should compare array - sparse matrix', function () {
      assert.deepEqual(smallerEq([[1, 2, 0], [-1, 0, 2]], sparse([[1, -1, 0], [-1, 1, 0]])), matrix([[true, false, true], [true, true, false]]));
    });

    it('should throw an error if arrays have different sizes', function() {
      assert.throws(function () {smallerEq([1,4,5], [3,4]);});
    });
  });

  describe('DenseMatrix', function () {

    it('should compare dense matrix - scalar', function () {
      assert.deepEqual(smallerEq('B', matrix(['A', 'B', 'C'])), matrix([false, true, true]));
      assert.deepEqual(smallerEq(matrix(['A', 'B', 'C']), 'B'), matrix([true, true, false]));
    });

    it('should compare dense matrix - array', function () {
      assert.deepEqual(smallerEq(matrix([[1, 2, 0], [-1, 0, 2]]), [[1, -1, 0], [-1, 1, 0]]), matrix([[true, false, true], [true, true, false]]));
    });

    it('should compare dense matrix - dense matrix', function () {
      assert.deepEqual(smallerEq(matrix([[1, 2, 0], [-1, 0, 2]]), matrix([[1, -1, 0], [-1, 1, 0]])), matrix([[true, false, true], [true, true, false]]));
    });

    it('should compare dense matrix - sparse matrix', function () {
      assert.deepEqual(smallerEq(matrix([[1, 2, 0], [-1, 0, 2]]), sparse([[1, -1, 0], [-1, 1, 0]])), matrix([[true, false, true], [true, true, false]]));
    });
  });

  describe('SparseMatrix', function () {

    it('should compare sparse matrix - scalar', function () {
      assert.deepEqual(smallerEq('B', sparse([['A', 'B'], ['C', 'D']])), matrix([[false, true], [true, true]]));
      assert.deepEqual(smallerEq(sparse([['A', 'B'], ['C', 'D']]), 'B'), matrix([[true, true], [false, false]]));
    });

    it('should compare sparse matrix - array', function () {
      assert.deepEqual(smallerEq(sparse([[1, 2, 0], [-1, 0, 2]]), [[1, -1, 0], [-1, 1, 0]]), matrix([[true, false, true], [true, true, false]]));
    });

    it('should compare sparse matrix - dense matrix', function () {
      assert.deepEqual(smallerEq(sparse([[1, 2, 0], [-1, 0, 2]]), matrix([[1, -1, 0], [-1, 1, 0]])), matrix([[true, false, true], [true, true, false]]));
    });

    it('should compare sparse matrix - sparse matrix', function () {
      assert.deepEqual(smallerEq(sparse([[1, 2, 0], [-1, 0, 2]]), sparse([[1, -1, 0], [-1, 1, 0]])), matrix([[true, false, true], [true, true, false]]));
    });
  });

  it('should throw an error when comparing complex numbers', function() {
    assert.throws(function () {smallerEq(complex(1,1), complex(1,2));}, TypeError);
    assert.throws(function () {smallerEq(complex(2,1), 3);}, TypeError);
    assert.throws(function () {smallerEq(3, complex(2,4));}, TypeError);
    assert.throws(function () {smallerEq(math.bignumber(3), complex(2,4));}, TypeError);
    assert.throws(function () {smallerEq(complex(2,4), math.bignumber(3));}, TypeError);
  });

  it('should throw an error with two matrices of different sizes', function () {
    assert.throws(function () {smallerEq([1,4,6], [3,4]);});
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {smallerEq(1);}, /TypeError: Too few arguments/);
    assert.throws(function () {smallerEq(1, 2, 3);}, /TypeError: Too many arguments/);
  });

  it('should LaTeX smallerEq', function () {
    var expression = math.parse('smallerEq(1,2)');
    assert.equal(expression.toTex(), '\\left(1\\leq2\\right)');
  });

});
