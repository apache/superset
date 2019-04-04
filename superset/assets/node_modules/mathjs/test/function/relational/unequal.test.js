// test unequal
var assert = require('assert'),
    math = require('../../../index'),
    bignumber = math.bignumber,
    complex = math.complex,
    matrix = math.matrix,
    sparse = math.sparse,
    unit = math.unit,
    unequal = math.unequal;

describe('unequal', function() {

  it('should compare two numbers correctly', function() {
    assert.equal(unequal(2, 3), true);
    assert.equal(unequal(2, 2), false);
    assert.equal(unequal(0, 0), false);
    assert.equal(unequal(-2, 2), true);
    assert.equal(unequal(true, 1), false);
  });

  it('should compare two floating point numbers correctly', function() {
    // NaN
    assert.equal(unequal(Number.NaN, Number.NaN), true);
    // Infinity
    assert.equal(unequal(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY), false);
    assert.equal(unequal(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY), false);
    assert.equal(unequal(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY), true);
    assert.equal(unequal(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY), true);
    assert.equal(unequal(Number.POSITIVE_INFINITY, 2.0), true);
    assert.equal(unequal(2.0, Number.POSITIVE_INFINITY), true);
    assert.equal(unequal(Number.NEGATIVE_INFINITY, 2.0), true);
    assert.equal(unequal(2.0, Number.NEGATIVE_INFINITY), true);
    assert.equal(unequal(Number.NaN, Number.POSITIVE_INFINITY), true);
    assert.equal(unequal(Number.POSITIVE_INFINITY, Number.NaN), true);
    assert.equal(unequal(Number.NaN, Number.NEGATIVE_INFINITY), true);
    assert.equal(unequal(Number.NEGATIVE_INFINITY, Number.NaN), true);
    // floating point numbers
    assert.equal(unequal(0.3 - 0.2, 0.1), false);
  });

  it('should compare two booleans', function() {
    assert.equal(unequal(true, true), false);
    assert.equal(unequal(true, false), true);
    assert.equal(unequal(false, true), true);
    assert.equal(unequal(false, false), false);
  });

  it('should compare mixed numbers and booleans', function() {
    assert.equal(unequal(2, true), true);
    assert.equal(unequal(1, true), false);
    assert.equal(unequal(0, true), true);
    assert.equal(unequal(true, 2), true);
    assert.equal(unequal(true, 1), false);
    assert.equal(unequal(false, 2), true);
    assert.equal(unequal(false, 0), false);
  });

  it('should compare bignumbers', function() {
    assert.deepEqual(unequal(bignumber(2), bignumber(3)), true);
    assert.deepEqual(unequal(bignumber(2), bignumber(2)), false);
    assert.deepEqual(unequal(bignumber(3), bignumber(2)), true);
    assert.deepEqual(unequal(bignumber(0), bignumber(0)), false);
    assert.deepEqual(unequal(bignumber(-2), bignumber(2)), true);
  });

  it('should compare mixed numbers and bignumbers', function() {
    assert.deepEqual(unequal(bignumber(2), 3), true);
    assert.deepEqual(unequal(2, bignumber(2)), false);

    assert.throws(function () {unequal(1/3, bignumber(1).div(3));}, /TypeError: Cannot implicitly convert a number with >15 significant digits to BigNumber/);
    assert.throws(function () {unequal(bignumber(1).div(3), 1/3);}, /TypeError: Cannot implicitly convert a number with >15 significant digits to BigNumber/);
  });

  it('should compare mixed booleans and bignumbers', function() {
    assert.deepEqual(unequal(bignumber(0.1), true), true);
    assert.deepEqual(unequal(bignumber(1), true), false);
    assert.deepEqual(unequal(bignumber(1), false), true);
    assert.deepEqual(unequal(bignumber(0), false), false);
    assert.deepEqual(unequal(false, bignumber(0)), false);
    assert.deepEqual(unequal(true, bignumber(0)), true);
    assert.deepEqual(unequal(true, bignumber(1)), false);
  });

  it('should compare two complex numbers correctly', function() {
    assert.equal(unequal(complex(2,3), complex(2,4)), true);
    assert.equal(unequal(complex(2,3), complex(2,3)), false);
    assert.equal(unequal(complex(1,3), complex(2,3)), true);
    assert.equal(unequal(complex(1,3), complex(2,4)), true);
    assert.equal(unequal(complex(2,0), 2), false);
    assert.equal(unequal(complex(2,1), 2), true);
    assert.equal(unequal(2, complex(2, 0)), false);
    assert.equal(unequal(2, complex(2, 1)), true);
    assert.equal(unequal(complex(2,0), 3), true);
  });

  it('should compare mixed complex numbers and bignumbers (downgrades to numbers)', function() {
    assert.deepEqual(unequal(math.complex(6, 0), bignumber(6)), false);
    assert.deepEqual(unequal(math.complex(6, -2), bignumber(6)), true);
    assert.deepEqual(unequal(bignumber(6), math.complex(6, 0)), false);
    assert.deepEqual(unequal(bignumber(6), math.complex(6, 4)), true);
  });

  it('should compare two fractions', function() {
    assert.strictEqual(unequal(math.fraction(3), math.fraction(2)).valueOf(), true);
    assert.strictEqual(unequal(math.fraction(2), math.fraction(3)).valueOf(), true);
    assert.strictEqual(unequal(math.fraction(3), math.fraction(3)).valueOf(), false);
  });

  it('should compare mixed fractions and numbers', function() {
    assert.strictEqual(unequal(1, math.fraction(1,3)), true);
    assert.strictEqual(unequal(math.fraction(2), 2), false);
  });

  it('should compare two quantitites of the same unit correctly', function() {
    assert.equal(unequal(unit('100cm'), unit('10inch')), true);
    assert.equal(unequal(unit('100cm'), unit('1m')), false);
    //assert.equal(unequal(unit('12inch'), unit('1foot')), false); // round-off error :(
    //assert.equal(unequal(unit('2.54cm'), unit('1inch')), false); // round-off error :(
  });

  it('should compare null', function() {
    assert.equal(unequal(null, null), false);
    assert.equal(unequal(null, undefined), true);
    assert.equal(unequal(0, null), true);
    assert.equal(unequal('null', null), true);
  });

  it('should compare undefined', function() {
    assert.equal(unequal(undefined, undefined), false);
    assert.equal(unequal(undefined, 'undefined'), true);
    assert.equal(unequal(undefined, null), true);
    assert.equal(unequal(2, undefined), true);
  });

  it('should apply configuration option epsilon', function() {
    var mymath = math.create();
    assert.equal(mymath.unequal(1, 0.991), true);
    assert.equal(mymath.unequal(math.bignumber(1), math.bignumber(0.991)), true);

    mymath.config({epsilon: 1e-2});
    assert.equal(mymath.unequal(1, 0.991), false);
    assert.equal(mymath.unequal(math.bignumber(1), math.bignumber(0.991)), false);
  });

  it('should throw an error when comparing numbers and units', function() {
    assert.throws(function () {unequal(unit('100cm'), 22);});
    assert.throws(function () {unequal(22, unit('100cm'));});
  });

  it('should throw an error when comparing bignumbers and units', function() {
    assert.throws(function () {unequal(unit('100cm'), bignumber(22));});
    assert.throws(function () {unequal(bignumber(22), unit('100cm'));});
  });

  it('should throw an error for two measures of different units', function() {
    assert.throws(function () {unequal(math.unit(5, 'km'), math.unit(100, 'gram'));});
  });

  it('should compare two strings correctly', function() {
    assert.equal(unequal('0', 0), false);
    assert.equal(unequal('Hello', 'hello'), true);
    assert.equal(unequal('hello', 'hello'), false);
  });

  describe('Array', function () {

    it('should compare array - scalar', function () {
      assert.deepEqual(unequal('B', ['A', 'B', 'C']), [true, false, true]);
      assert.deepEqual(unequal(['A', 'B', 'C'], 'B'), [true, false, true]);
    });

    it('should compare array - array', function () {
      assert.deepEqual(unequal([[1, 2, 0], [-1, 0, 2]], [[1, -1, 0], [-1, 1, 0]]), [[false, true, false], [false, true, true]]);
    });

    it('should compare array - dense matrix', function () {
      assert.deepEqual(unequal([[1, 2, 0], [-1, 0, 2]], matrix([[1, -1, 0], [-1, 1, 0]])), matrix([[false, true, false], [false, true, true]]));
    });

    it('should compare array - sparse matrix', function () {
      assert.deepEqual(unequal([[1, 2, 0], [-1, 0, 2]], sparse([[1, -1, 0], [-1, 1, 0]])), matrix([[false, true, false], [false, true, true]]));
    });

    it('should throw an error if arrays have different sizes', function() {
      assert.throws(function () {unequal([1,4,5], [3,4]);});
    });
  });

  describe('DenseMatrix', function () {

    it('should compare dense matrix - scalar', function () {
      assert.deepEqual(unequal('B', matrix(['A', 'B', 'C'])), matrix([true, false, true]));
      assert.deepEqual(unequal(matrix(['A', 'B', 'C']), 'B'), matrix([true, false, true]));
    });

    it('should compare dense matrix - array', function () {
      assert.deepEqual(unequal(matrix([[1, 2, 0], [-1, 0, 2]]), [[1, -1, 0], [-1, 1, 0]]), matrix([[false, true, false], [false, true, true]]));
    });

    it('should compare dense matrix - dense matrix', function () {
      assert.deepEqual(unequal(matrix([[1, 2, 0], [-1, 0, 2]]), matrix([[1, -1, 0], [-1, 1, 0]])), matrix([[false, true, false], [false, true, true]]));
    });

    it('should compare dense matrix - sparse matrix', function () {
      assert.deepEqual(unequal(matrix([[1, 2, 0], [-1, 0, 2]]), sparse([[1, -1, 0], [-1, 1, 0]])), matrix([[false, true, false], [false, true, true]]));
    });
  });

  describe('SparseMatrix', function () {

    it('should compare sparse matrix - scalar', function () {
      assert.deepEqual(unequal('B', sparse([['A', 'B'], ['C', 'D']])), matrix([[true, false], [true, true]]));
      assert.deepEqual(unequal(sparse([['A', 'B'], ['C', 'D']]), 'B'), matrix([[true, false], [true, true]]));
    });

    it('should compare sparse matrix - array', function () {
      assert.deepEqual(unequal(sparse([[1, 2, 0], [-1, 0, 2]]), [[1, -1, 0], [-1, 1, 0]]), matrix([[false, true, false], [false, true, true]]));
    });

    it('should compare sparse matrix - dense matrix', function () {
      assert.deepEqual(unequal(sparse([[1, 2, 0], [-1, 0, 2]]), matrix([[1, -1, 0], [-1, 1, 0]])), matrix([[false, true, false], [false, true, true]]));
    });

    it('should compare sparse matrix - sparse matrix', function () {
      assert.deepEqual(unequal(sparse([[1, 2, 0], [-1, 0, 2]]), sparse([[1, -1, 0], [-1, 1, 0]])), matrix([[false, true, false], [false, true, true]]));
    });
  });

  it('should throw an error if matrices have different sizes', function() {
    assert.throws(function () {unequal([1,4,5], [3,4]);});
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {unequal(1);}, /TypeError: Too few arguments/);
    assert.throws(function () {unequal(1, 2, 3);}, /TypeError: Too many arguments/);
  });

  it('should LaTeX unequal', function () {
    var expression = math.parse('unequal(1,0)');
    assert.equal(expression.toTex(), '\\left(1\\neq0\\right)');
  });

});
