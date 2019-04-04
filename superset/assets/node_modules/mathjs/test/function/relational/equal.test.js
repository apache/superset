// test equal
var assert = require('assert'),
    math = require('../../../index'),
    bignumber = math.bignumber,
    complex = math.complex,
    matrix = math.matrix,
    sparse = math.sparse,
    unit = math.unit,
    equal = math.equal;

describe('equal', function() {

  it('should compare two numbers correctly', function() {
    assert.equal(equal(2, 3), false);
    assert.equal(equal(2, 2), true);
    assert.equal(equal(0, 0), true);
    assert.equal(equal(-2, 2), false);
  });

  it('should compare two floating point numbers correctly', function() {
    // NaN
    assert.equal(equal(Number.NaN, Number.NaN), false);
    // Infinity
    assert.equal(equal(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY), true);
    assert.equal(equal(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY), true);
    assert.equal(equal(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY), false);
    assert.equal(equal(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY), false);
    assert.equal(equal(Number.POSITIVE_INFINITY, 2.0), false);
    assert.equal(equal(2.0, Number.POSITIVE_INFINITY), false);
    assert.equal(equal(Number.NEGATIVE_INFINITY, 2.0), false);
    assert.equal(equal(2.0, Number.NEGATIVE_INFINITY), false);
    assert.equal(equal(Number.NaN, Number.POSITIVE_INFINITY), false);
    assert.equal(equal(Number.POSITIVE_INFINITY, Number.NaN), false);
    assert.equal(equal(Number.NaN, Number.NEGATIVE_INFINITY), false);
    assert.equal(equal(Number.NEGATIVE_INFINITY, Number.NaN), false);
    // floating point numbers
    assert.equal(equal(0.3 - 0.2, 0.1), true);
  });

  it('should compare two booleans', function() {
    assert.equal(equal(true, true), true);
    assert.equal(equal(true, false), false);
    assert.equal(equal(false, true), false);
    assert.equal(equal(false, false), true);
  });

  it('should compare mixed numbers and booleans', function() {
    assert.equal(equal(2, true), false);
    assert.equal(equal(1, true), true);
    assert.equal(equal(0, true), false);
    assert.equal(equal(true, 2), false);
    assert.equal(equal(true, 1), true);
    assert.equal(equal(false, 2), false);
    assert.equal(equal(false, 0), true);
  });

  it('should compare bignumbers', function() {
    assert.equal(equal(bignumber(2), bignumber(3)), false);
    assert.equal(equal(bignumber(2), bignumber(2)), true);
    assert.equal(equal(bignumber(3), bignumber(2)), false);
    assert.equal(equal(bignumber(0), bignumber(0)), true);
    assert.equal(equal(bignumber(-2), bignumber(2)), false);
  });

  it('should compare mixed numbers and bignumbers', function() {
    assert.deepEqual(equal(bignumber(2), 3), false);
    assert.deepEqual(equal(2, bignumber(2)), true);

    assert.throws(function () {equal(1/3, bignumber(1).div(3));}, /Cannot implicitly convert a number with >15 significant digits to BigNumber/);
    assert.throws(function () {equal(bignumber(1).div(3), 1/3);}, /Cannot implicitly convert a number with >15 significant digits to BigNumber/);
  });

  it('should compare mixed booleans and bignumbers', function() {
    assert.equal(equal(bignumber(0.1), true), false);
    assert.equal(equal(bignumber(1), true), true);
    assert.equal(equal(bignumber(1), false), false);
    assert.equal(equal(false, bignumber(0)), true);
    assert.equal(equal(true, bignumber(0)), false);
  });

  it('should compare two complex numbers correctly', function() {
    assert.equal(equal(complex(2,3), complex(2,4)), false);
    assert.equal(equal(complex(2,3), complex(2,3)), true);
    assert.equal(equal(complex(1,3), complex(2,3)), false);
    assert.equal(equal(complex(1,3), complex(2,4)), false);
    assert.equal(equal(complex(2,0), 2), true);
    assert.equal(equal(complex(2,1), 2), false);
    assert.equal(equal(2, complex(2, 0)), true);
    assert.equal(equal(2, complex(2, 1)), false);
    assert.equal(equal(complex(2,0), 3), false);
  });

  it('should compare mixed complex numbers and bignumbers (downgrades to numbers)', function() {
    assert.deepEqual(equal(math.complex(6, 0), bignumber(6)), true);
    assert.deepEqual(equal(math.complex(6, -2), bignumber(6)), false);
    assert.deepEqual(equal(bignumber(6), math.complex(6, 0)), true);
    assert.deepEqual(equal(bignumber(6), math.complex(6, 4)), false);
  });

  it('should compare two fractions', function() {
    var a = math.fraction(3);
    assert.strictEqual(equal(a, math.fraction(2)).valueOf(), false);
    assert.equal(a.toString(), '3');

    assert.strictEqual(equal(math.fraction(2), math.fraction(3)).valueOf(), false);
    assert.strictEqual(equal(math.fraction(3), math.fraction(3)).valueOf(), true);

    assert.strictEqual(equal(math.add(math.fraction(0.1), math.fraction(0.2)), math.fraction(0.3)).valueOf(), true); // this would fail with numbers
  });

  it('should compare mixed fractions and numbers', function() {
    assert.strictEqual(equal(1, math.fraction(1,3)), false);
    assert.strictEqual(equal(math.fraction(2), 2), true);
  });

  it('should compare two units correctly', function() {
    assert.equal(equal(unit('100cm'), unit('10inch')), false);
    assert.equal(equal(unit('100cm'), unit('1m')), true);
    assert.equal(equal(unit('12inch'), unit('1foot')), true); // round-off error should be no issue
    assert.equal(equal(unit('2.54cm'), unit('1inch')), true); // round-off error should be no issue
  });

  it('should compare null', function() {
    assert.equal(equal(null, null), true);
    assert.equal(equal(null, undefined), false);
    assert.equal(equal(undefined, null), false);
    assert.equal(equal(0, null), false);
    assert.equal(equal(null, 0), false);
    assert.equal(equal('null', null), false);
  });

  it('should compare undefined', function() {
    assert.equal(equal(undefined, undefined), true);
    assert.equal(equal(undefined, 'undefined'), false);
    assert.equal(equal(undefined, null), false);
    assert.equal(equal(undefined, 0), false);
    assert.equal(equal(2, undefined), false);
  });

  it('should apply configuration option epsilon', function() {
    var mymath = math.create();
    assert.equal(mymath.equal(1, 0.991), false);
    assert.equal(mymath.equal(math.bignumber(1), math.bignumber(0.991)), false);

    mymath.config({epsilon: 1e-2});
    assert.equal(mymath.equal(1, 0.991), true);
    assert.equal(mymath.equal(math.bignumber(1), math.bignumber(0.991)), true);
  });

  it('should throw an error when comparing a unit with a big number', function() {
    assert.throws( function () {equal(math.unit('5 m'), bignumber(10)).toString(); });
  });

  it('should throw an error when comparing a unit with a number', function() {
    assert.throws(function () {equal(unit('100cm'), 22);});
  });

  it('should throw an error for two measures of different units', function() {
    assert.throws(function () {equal(math.unit(5, 'km'), math.unit(100, 'gram'));});
  });

  it('should compare two strings correctly', function() {
    assert.equal(equal('0', 0), true);
    assert.equal(equal('Hello', 'hello'), false);
    assert.equal(equal('hello', 'hello'), true);
  });

  describe('Array', function () {

    it('should compare array - scalar', function () {
      assert.deepEqual(equal('B', ['A', 'B', 'C']), [false, true, false]);
      assert.deepEqual(equal(['A', 'B', 'C'], 'B'), [false, true, false]);
    });

    it('should compare array - array', function () {
      assert.deepEqual(equal([[1, 2, 0], [-1, 0, 2]], [[1, -1, 0], [-1, 1, 0]]), [[true, false, true], [true, false, false]]);
    });

    it('should compare array - dense matrix', function () {
      assert.deepEqual(equal([[1, 2, 0], [-1, 0, 2]], matrix([[1, -1, 0], [-1, 1, 0]])), matrix([[true, false, true], [true, false, false]]));
    });

    it('should compare array - sparse matrix', function () {
      assert.deepEqual(equal([[1, 2, 0], [-1, 0, 2]], sparse([[1, -1, 0], [-1, 1, 0]])), matrix([[true, false, true], [true, false, false]]));
    });
    
    it('should throw an error if arrays have different sizes', function() {
      assert.throws(function () {equal([1,4,5], [3,4]);});
    });
  });
  
  describe('DenseMatrix', function () {

    it('should compare dense matrix - scalar', function () {
      assert.deepEqual(equal('B', matrix(['A', 'B', 'C'])), matrix([false, true, false]));
      assert.deepEqual(equal(matrix(['A', 'B', 'C']), 'B'), matrix([false, true, false]));
    });

    it('should compare dense matrix - array', function () {
      assert.deepEqual(equal(matrix([[1, 2, 0], [-1, 0, 2]]), [[1, -1, 0], [-1, 1, 0]]), matrix([[true, false, true], [true, false, false]]));
    });

    it('should compare dense matrix - dense matrix', function () {
      assert.deepEqual(equal(matrix([[1, 2, 0], [-1, 0, 2]]), matrix([[1, -1, 0], [-1, 1, 0]])), matrix([[true, false, true], [true, false, false]]));
    });

    it('should compare dense matrix - sparse matrix', function () {
      assert.deepEqual(equal(matrix([[1, 2, 0], [-1, 0, 2]]), sparse([[1, -1, 0], [-1, 1, 0]])), matrix([[true, false, true], [true, false, false]]));
    });
  });

  describe('SparseMatrix', function () {

    it('should compare sparse matrix - scalar', function () {
      assert.deepEqual(equal('B', sparse([['A', 'B'], ['C', 'D']])), matrix([[false, true], [false, false]]));
      assert.deepEqual(equal(sparse([['A', 'B'], ['C', 'D']]), 'B'), matrix([[false, true], [false, false]]));
    });

    it('should compare sparse matrix - array', function () {
      assert.deepEqual(equal(sparse([[1, 2, 0], [-1, 0, 2]]), [[1, -1, 0], [-1, 1, 0]]), matrix([[true, false, true], [true, false, false]]));
    });

    it('should compare sparse matrix - dense matrix', function () {
      assert.deepEqual(equal(sparse([[1, 2, 0], [-1, 0, 2]]), matrix([[1, -1, 0], [-1, 1, 0]])), matrix([[true, false, true], [true, false, false]]));
    });

    it('should compare sparse matrix - sparse matrix', function () {
      assert.deepEqual(equal(sparse([[1, 2, 0], [-1, 0, 2]]), sparse([[1, -1, 0], [-1, 1, 0]])), matrix([[true, false, true], [true, false, false]]));
    });
  });
  
  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {equal(1);}, /Too few arguments/);
    assert.throws(function () {equal(1, 2, 3);}, /Too many arguments/);
  });

  it('should LaTeX equal', function () {
    var expression = math.parse('equal(1,2)');
    assert.equal(expression.toTex(), '\\left(1=2\\right)');
  });
});
