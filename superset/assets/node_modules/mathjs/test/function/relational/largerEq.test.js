// test largerEq
var assert = require('assert'),
    math = require('../../../index'),
    bignumber = math.bignumber,
    complex = math.complex,
    matrix = math.matrix,
    sparse = math.sparse,
    unit = math.unit,
    largerEq = math.largerEq;

describe('largerEq', function() {

  it('should compare two numbers correctly', function() {
    assert.equal(largerEq(2, 3), false);
    assert.equal(largerEq(2, 2), true);
    assert.equal(largerEq(2, 1), true);
    assert.equal(largerEq(0, 0), true);
    assert.equal(largerEq(-2, 2), false);
    assert.equal(largerEq(-2, -3), true);
    assert.equal(largerEq(-3, -2), false);
  });

  it('should compare two floating point numbers correctly', function() {
    // Infinity
    assert.equal(largerEq(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY), true);
    assert.equal(largerEq(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY), true);
    assert.equal(largerEq(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY), true);
    assert.equal(largerEq(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY), false);
    assert.equal(largerEq(Number.POSITIVE_INFINITY, 2.0), true);
    assert.equal(largerEq(2.0, Number.POSITIVE_INFINITY), false);
    assert.equal(largerEq(Number.NEGATIVE_INFINITY, 2.0), false);
    assert.equal(largerEq(2.0, Number.NEGATIVE_INFINITY), true);
    // floating point numbers
    assert.equal(largerEq(0.3 - 0.2, 0.1), true);
  });

  it('should compare two booleans', function() {
    assert.equal(largerEq(true, true), true);
    assert.equal(largerEq(true, false), true);
    assert.equal(largerEq(false, true), false);
    assert.equal(largerEq(false, false), true);
  });

  it('should compare mixed numbers and booleans', function() {
    assert.equal(largerEq(2, true), true);
    assert.equal(largerEq(0, true), false);
    assert.equal(largerEq(true, 2), false);
    assert.equal(largerEq(true, 1), true);
    assert.equal(largerEq(false, 0), true);
  });

  it('should compare mixed numbers and null', function() {
    assert.equal(largerEq(1, null), true);
    assert.equal(largerEq(0, null), true);
    assert.equal(largerEq(null, 1), false);
    assert.equal(largerEq(null, 0), true);
  });

  it('should compare bignumbers', function() {
    assert.equal(largerEq(bignumber(2), bignumber(3)), false);
    assert.equal(largerEq(bignumber(2), bignumber(2)), true);
    assert.equal(largerEq(bignumber(3), bignumber(2)), true);
    assert.equal(largerEq(bignumber(0), bignumber(0)), true);
    assert.equal(largerEq(bignumber(-2), bignumber(2)), false);
  });

  it('should compare mixed numbers and bignumbers', function() {
    assert.equal(largerEq(bignumber(2), 3), false);
    assert.equal(largerEq(2, bignumber(2)), true);

    assert.throws(function () {largerEq(1/3, bignumber(1).div(3));}, /TypeError: Cannot implicitly convert a number with >15 significant digits to BigNumber/);
    assert.throws(function () {largerEq(bignumber(1).div(3), 1/3);}, /TypeError: Cannot implicitly convert a number with >15 significant digits to BigNumber/);
  });

  it('should compare mixed booleans and bignumbers', function() {
    assert.equal(largerEq(bignumber(0.1), true), false);
    assert.equal(largerEq(bignumber(1), true), true);
    assert.equal(largerEq(bignumber(1), false), true);
    assert.equal(largerEq(false, bignumber(0)), true);
    assert.equal(largerEq(true, bignumber(0)), true);
    assert.equal(largerEq(true, bignumber(1)), true);
  });

  it('should compare two fractions', function() {
    assert.strictEqual(largerEq(math.fraction(3), math.fraction(2)).valueOf(), true);
    assert.strictEqual(largerEq(math.fraction(2), math.fraction(3)).valueOf(), false);
    assert.strictEqual(largerEq(math.fraction(3), math.fraction(3)).valueOf(), true);
  });

  it('should compare mixed fractions and numbers', function() {
    assert.strictEqual(largerEq(1, math.fraction(1,3)), true);
    assert.strictEqual(largerEq(math.fraction(2), 2), true);
  });

  it('should compare two units correctly', function() {
    assert.equal(largerEq(unit('100cm'), unit('10inch')), true);
    assert.equal(largerEq(unit('99cm'), unit('1m')), false);
    //assert.equal(largerEq(unit('100cm'), unit('1m')), true); // dangerous, round-off errors
    assert.equal(largerEq(unit('101cm'), unit('1m')), true);
  });

  it('should apply configuration option epsilon', function() {
    var mymath = math.create();
    assert.equal(mymath.largerEq(1, 1.01), false);
    assert.equal(mymath.largerEq(math.bignumber(1), math.bignumber(1.01)), false);

    mymath.config({epsilon: 1e-2});
    assert.equal(mymath.largerEq(1, 1.01), true);
    assert.equal(mymath.largerEq(math.bignumber(1), math.bignumber(1.01)), true);
  });

  it('should throw an error if comparing a unit with a number', function() {
    assert.throws(function () {largerEq(unit('100cm'), 22);});
  });

  it('should throw an error for two measures of different units', function() {
    assert.throws(function () {largerEq(math.unit(5, 'km'), math.unit(100, 'gram')); });
  });

  it('should throw an error if comparing a unit with a bignumber', function() {
    assert.throws(function () {largerEq(unit('100cm'), bignumber(22));});
  });

  it('should perform lexical comparison for 2 strings', function() {
    assert.equal(largerEq('0', 0), true);
    assert.equal(largerEq('abd', 'abc'), true);
    assert.equal(largerEq('abc', 'abc'), true);
    assert.equal(largerEq('abc', 'abd'), false);
  });

  describe('Array', function () {

    it('should compare array - scalar', function () {
      assert.deepEqual(largerEq('B', ['A', 'B', 'C']), [true, true, false]);
      assert.deepEqual(largerEq(['A', 'B', 'C'], 'B'), [false, true, true]);
    });

    it('should compare array - array', function () {
      assert.deepEqual(largerEq([[1, 2, 0], [-1, 0, 2]], [[1, -1, 0], [-1, 1, 0]]), [[true, true, true], [true, false, true]]);
    });

    it('should compare array - dense matrix', function () {
      assert.deepEqual(largerEq([[1, 2, 0], [-1, 0, 2]], matrix([[1, -1, 0], [-1, 1, 0]])), matrix([[true, true, true], [true, false, true]]));
    });

    it('should compare array - sparse matrix', function () {
      assert.deepEqual(largerEq([[1, 2, 0], [-1, 0, 2]], sparse([[1, -1, 0], [-1, 1, 0]])), matrix([[true, true, true], [true, false, true]]));
    });

    it('should throw an error if arrays have different sizes', function() {
      assert.throws(function () {largerEq([1,4,5], [3,4]);});
    });
  });

  describe('DenseMatrix', function () {

    it('should compare dense matrix - scalar', function () {
      assert.deepEqual(largerEq('B', matrix(['A', 'B', 'C'])), matrix([true, true, false]));
      assert.deepEqual(largerEq(matrix(['A', 'B', 'C']), 'B'), matrix([false, true, true]));
    });

    it('should compare dense matrix - array', function () {
      assert.deepEqual(largerEq(matrix([[1, 2, 0], [-1, 0, 2]]), [[1, -1, 0], [-1, 1, 0]]), matrix([[true, true, true], [true, false, true]]));
    });

    it('should compare dense matrix - dense matrix', function () {
      assert.deepEqual(largerEq(matrix([[1, 2, 0], [-1, 0, 2]]), matrix([[1, -1, 0], [-1, 1, 0]])), matrix([[true, true, true], [true, false, true]]));
    });

    it('should compare dense matrix - sparse matrix', function () {
      assert.deepEqual(largerEq(matrix([[1, 2, 0], [-1, 0, 2]]), sparse([[1, -1, 0], [-1, 1, 0]])), matrix([[true, true, true], [true, false, true]]));
    });
  });

  describe('SparseMatrix', function () {

    it('should compare sparse matrix - scalar', function () {
      assert.deepEqual(largerEq('B', sparse([['A', 'B'], ['C', 'D']])), matrix([[true, true], [false, false]]));
      assert.deepEqual(largerEq(sparse([['A', 'B'], ['C', 'D']]), 'B'), matrix([[false, true], [true, true]]));
    });

    it('should compare sparse matrix - array', function () {
      assert.deepEqual(largerEq(sparse([[1, 2, 0], [-1, 0, 2]]), [[1, -1, 0], [-1, 1, 0]]), matrix([[true, true, true], [true, false, true]]));
    });

    it('should compare sparse matrix - dense matrix', function () {
      assert.deepEqual(largerEq(sparse([[1, 2, 0], [-1, 0, 2]]), matrix([[1, -1, 0], [-1, 1, 0]])), matrix([[true, true, true], [true, false, true]]));
    });

    it('should compare sparse matrix - sparse matrix', function () {
      assert.deepEqual(largerEq(sparse([[1, 2, 0], [-1, 0, 2]]), sparse([[1, -1, 0], [-1, 1, 0]])), matrix([[true, true, true], [true, false, true]]));
    });
  });

  it('should throw an error when comparing complex numbers', function() {
    assert.throws(function () {largerEq(complex(1,1), complex(1,2));}, TypeError);
    assert.throws(function () {largerEq(complex(2,1), 3);}, TypeError);
    assert.throws(function () {largerEq(3, complex(2,4));}, TypeError);
    assert.throws(function () {largerEq(math.bignumber(3), complex(2,4));}, TypeError);
    assert.throws(function () {largerEq(complex(2,4), math.bignumber(3));}, TypeError);
  });

  it('should throw an error if comparing two matrices of different sizes', function() {
    assert.throws(function () {largerEq([1,4,6], [3,4]);});
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {largerEq(1);}, /TypeError: Too few arguments/);
    assert.throws(function () {largerEq(1, 2, 3);}, /TypeError: Too many arguments/);
  });

  it('should LaTeX largerEq', function () {
    var expression = math.parse('largerEq(1,2)');
    assert.equal(expression.toTex(), '\\left(1\\geq2\\right)');
  });

});
