// test or
var assert = require('assert'),
    math = require('../../../index'),
    bignumber = math.bignumber,
    complex = math.complex,
    matrix = math.matrix,
    sparse = math.sparse,
    unit = math.unit,
    or = math.or;

describe('or', function () {

  it('should or two numbers correctly', function () {
    assert.strictEqual(or(1, 1), true);
    assert.strictEqual(or(-1, 1), true);
    assert.strictEqual(or(-1, -1), true);
    assert.strictEqual(or(0, -1), true);
    assert.strictEqual(or(1, 0), true);
    assert.strictEqual(or(1, NaN), true);
    assert.strictEqual(or(NaN, 1), true);
    assert.strictEqual(or(1e10, 0.019209), true);
    assert.strictEqual(or(-1.0e-100, 1.0e-100), true);
    assert.strictEqual(or(Infinity, -Infinity), true);
    assert.strictEqual(or(NaN, NaN), false);
    assert.strictEqual(or(NaN, 0), false);
    assert.strictEqual(or(0, NaN), false);
    assert.strictEqual(or(0, 0), false);
  });

  it('should or two complex numbers', function () {
    assert.strictEqual(or(complex(1, 1), complex(1, 1)), true);
    assert.strictEqual(or(complex(0, 1), complex(1, 1)), true);
    assert.strictEqual(or(complex(1, 0), complex(1, 1)), true);
    assert.strictEqual(or(complex(1, 1), complex(0, 1)), true);
    assert.strictEqual(or(complex(1, 1), complex(1, 0)), true);
    assert.strictEqual(or(complex(1, 0), complex(1, 0)), true);
    assert.strictEqual(or(complex(0, 1), complex(0, 1)), true);
    assert.strictEqual(or(complex(0, 0), complex(1, 1)), true);
    assert.strictEqual(or(complex(0, 0), complex(0, 1)), true);
    assert.strictEqual(or(complex(0, 0), complex(1, 0)), true);
    assert.strictEqual(or(complex(1, 1), complex(0, 0)), true);
    assert.strictEqual(or(complex(0, 1), complex(0, 0)), true);
    assert.strictEqual(or(complex(1, 0), complex(0, 0)), true);
    assert.strictEqual(or(complex(), complex(1, 1)), true);
    assert.strictEqual(or(complex(0), complex(1, 1)), true);
    assert.strictEqual(or(complex(1), complex(1, 1)), true);
    assert.strictEqual(or(complex(1, 1), complex()), true);
    assert.strictEqual(or(complex(1, 1), complex(0)), true);
    assert.strictEqual(or(complex(1, 1), complex(1)), true);
    assert.strictEqual(or(complex(0, 0), complex(0, 0)), false);
    assert.strictEqual(or(complex(), complex()), false);
  });

  it('should or mixed numbers and complex numbers', function () {
    assert.strictEqual(or(complex(1, 1), 1), true);
    assert.strictEqual(or(complex(1, 1), 0), true);
    assert.strictEqual(or(1, complex(1, 1)), true);
    assert.strictEqual(or(0, complex(1, 1)), true);
    assert.strictEqual(or(complex(0, 0), 1), true);
    assert.strictEqual(or(1, complex(0, 0)), true);
    assert.strictEqual(or(0, complex(0, 0)), false);
    assert.strictEqual(or(complex(0, 0), 0), false);
  });

  it('should or two booleans', function () {
    assert.strictEqual(or(true, true), true);
    assert.strictEqual(or(true, false), true);
    assert.strictEqual(or(false, true), true);
    assert.strictEqual(or(false, false), false);
  });

  it('should or mixed numbers and booleans', function () {
    assert.strictEqual(or(2, true), true);
    assert.strictEqual(or(2, false), true);
    assert.strictEqual(or(0, true), true);
    assert.strictEqual(or(0, false), false);
    assert.strictEqual(or(true, 2), true);
    assert.strictEqual(or(false, 2), true);
    assert.strictEqual(or(false, 0), false);
  });

  it('should or mixed numbers and null', function () {
    assert.strictEqual(or(2, null), true);
    assert.strictEqual(or(null, 2), true);
    assert.strictEqual(or(null, null), false);
  });

  it('should or bignumbers', function () {
    assert.strictEqual(or(bignumber(1), bignumber(1)), true);
    assert.strictEqual(or(bignumber(-1), bignumber(1)), true);
    assert.strictEqual(or(bignumber(-1), bignumber(-1)), true);
    assert.strictEqual(or(bignumber(0), bignumber(-1)), true);
    assert.strictEqual(or(bignumber(1), bignumber(0)), true);
    assert.strictEqual(or(bignumber(1), bignumber(NaN)), true);
    assert.strictEqual(or(bignumber(NaN), bignumber(1)), true);
    assert.strictEqual(or(bignumber('1e+10'), bignumber(0.19209)), true);
    assert.strictEqual(or(bignumber('-1.0e-100'), bignumber('1.0e-100')), true);
    assert.strictEqual(or(bignumber(Infinity), bignumber(-Infinity)), true);
    assert.strictEqual(or(bignumber(NaN), bignumber(NaN)), false);
    assert.strictEqual(or(bignumber(NaN), bignumber(0)), false);
    assert.strictEqual(or(bignumber(0), bignumber(NaN)), false);
    assert.strictEqual(or(bignumber(0), bignumber(0)), false);
  });

  it('should or mixed numbers and bignumbers', function () {
    assert.strictEqual(or(bignumber(2), 3), true);
    assert.strictEqual(or(2, bignumber(2)), true);
    assert.strictEqual(or(0, bignumber(2)), true);
    assert.strictEqual(or(2, bignumber(0)), true);
    assert.strictEqual(or(bignumber(0), 2), true);
    assert.strictEqual(or(bignumber(0), 0), false);
    assert.strictEqual(or(bignumber(2), 0), true);
    assert.strictEqual(or(bignumber(0), 0), false);
  });

  it('should or two units', function () {
    assert.strictEqual(or(unit('100cm'), unit('10inch')), true);
    assert.strictEqual(or(unit('100cm'), unit('0 inch')), true);
    assert.strictEqual(or(unit('0cm'), unit('1m')), true);
    assert.strictEqual(or(unit('m'), unit('1m')), true);
    assert.strictEqual(or(unit('1dm'), unit('m')), true);
    assert.strictEqual(or(unit('dm'), unit('m')), false);
    assert.strictEqual(or(unit('-100cm'), unit('-10inch')), true);
    assert.strictEqual(or(unit(5, 'km'), unit(100, 'gram')), true);
    assert.strictEqual(or(unit(5, 'km'), unit(0, 'gram')), true);
    assert.strictEqual(or(unit(0, 'km'), unit(100, 'gram')), true);
    assert.strictEqual(or(unit(0, 'km'), unit(0, 'gram')), false);

    assert.strictEqual(or(unit(bignumber(0), 'm'), unit(bignumber(0), 'm')), false);
    assert.strictEqual(or(unit(bignumber(1), 'm'), unit(bignumber(0), 'm')), true);
    assert.strictEqual(or(unit(bignumber(0), 'm'), unit(bignumber(1), 'm')), true);
    assert.strictEqual(or(unit(bignumber(1), 'm'), unit(bignumber(1), 'm')), true);
  });

  it('should or two arrays', function () {
    assert.deepEqual(or([0, 1, 0, 12], [0, 0, 1, 22]), [false, true, true, true]);
    assert.deepEqual(or([], []), []);
  });

  it('should or mixed numbers and arrays', function () {
    assert.deepEqual(or(10, [0, 2]), [true, true]);
    assert.deepEqual(or([0, 2], 10), [true, true]);
    assert.deepEqual(or(0, [0, 2]), [false, true]);
    assert.deepEqual(or([0, 2], 0), [false, true]);
  });

  describe('Array', function () {

    it('should or array - scalar', function () {
      assert.deepEqual(or(10, [0, 2]), [true, true]);
      assert.deepEqual(or([0, 2], 10), [true, true]);
    });

    it('should or array - array', function () {
      assert.deepEqual(or([0, 1, 0, 12], [0, 0, 1, 22]), [false, true, true, true]);
      assert.deepEqual(or([], []), []);
    });

    it('should or array - dense matrix', function () {
      assert.deepEqual(or([0, 1, 0, 12], matrix([0, 0, 1, 22])), matrix([false, true, true, true]));
      assert.deepEqual(or([], matrix([])), matrix([]));
    });

    it('should or array - sparse matrix', function () {
      assert.deepEqual(or([[0, 1], [0, 12]], sparse([[0, 0], [1, 22]])), matrix([[false, true], [true, true]]));
    });
  });

  describe('DenseMatrix', function () {

    it('should or dense matrix - scalar', function () {
      assert.deepEqual(or(10, matrix([0, 2])), matrix([true, true]));
      assert.deepEqual(or(matrix([0, 2]), 10), matrix([true, true]));
    });

    it('should or dense matrix - array', function () {
      assert.deepEqual(or(matrix([0, 1, 0, 12]), [0, 0, 1, 22]), matrix([false, true, true, true]));
      assert.deepEqual(or(matrix([]), []), matrix([]));
    });

    it('should or dense matrix - dense matrix', function () {
      assert.deepEqual(or(matrix([0, 1, 0, 12]), matrix([0, 0, 1, 22])), matrix([false, true, true, true]));
      assert.deepEqual(or(matrix([]), matrix([])), matrix([]));
    });

    it('should or dense matrix - sparse matrix', function () {
      assert.deepEqual(or(matrix([[0, 1], [0, 12]]), sparse([[0, 0], [1, 22]])), matrix([[false, true], [true, true]]));
    });
  });

  describe('SparseMatrix', function () {

    it('should or sparse matrix - scalar', function () {
      assert.deepEqual(or(10, sparse([[0], [2]])), matrix([[true], [true]]));
      assert.deepEqual(or(sparse([[0], [2]]), 10), matrix([[true], [true]]));
    });

    it('should or sparse matrix - array', function () {
      assert.deepEqual(or(sparse([[0, 1], [0, 12]]), [[0, 0], [1, 22]]), matrix([[false, true], [true, true]]));
    });

    it('should or sparse matrix - dense matrix', function () {
      assert.deepEqual(or(sparse([[0, 1], [0, 12]]), matrix([[0, 0], [1, 22]])), matrix([[false, true], [true, true]]));
    });

    it('should or sparse matrix - sparse matrix', function () {
      assert.deepEqual(or(sparse([[0, 1], [0, 12]]), sparse([[0, 0], [1, 22]])), sparse([[false, true], [true, true]]));
    });
  });

  it('should throw an error in case of invalid number of arguments', function () {
    assert.throws(function () {or(1);}, /TypeError: Too few arguments/);
    assert.throws(function () {or(1, 2, 3);}, /TypeError: Too many arguments/);
  });

  it('should throw an error in case of invalid type of arguments', function () {
    assert.throws(function () {or(new Date(), true);}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {or(true, new Date());}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {or(true, undefined);}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {or(undefined, true);}, /TypeError: Unexpected type of argument/);
  });

  it('should LaTeX or', function () {
    var expression = math.parse('or(1,2)');
    assert.equal(expression.toTex(), '\\left(1\\vee2\\right)');
  });
});
