// test xor
var assert = require('assert'),
    math = require('../../../index'),
    bignumber = math.bignumber,
    complex = math.complex,
    matrix = math.matrix,
    sparse = math.sparse,
    unit = math.unit,
    xor = math.xor;

describe('xor', function () {

  it('should xor two numbers correctly', function () {
    assert.strictEqual(xor(1, 1), false);
    assert.strictEqual(xor(-1, 1), false);
    assert.strictEqual(xor(-1, -1), false);
    assert.strictEqual(xor(0, -1), true);
    assert.strictEqual(xor(1, 0), true);
    assert.strictEqual(xor(1, NaN), true);
    assert.strictEqual(xor(NaN, 1), true);
    assert.strictEqual(xor(1e10, 0.019209), false);
    assert.strictEqual(xor(-1.0e-100, 1.0e-100), false);
    assert.strictEqual(xor(Infinity, -Infinity), false);
    assert.strictEqual(xor(NaN, NaN), false);
    assert.strictEqual(xor(NaN, 0), false);
    assert.strictEqual(xor(0, NaN), false);
    assert.strictEqual(xor(0, 0), false);
  });

  it('should xor two complex numbers', function () {
    assert.strictEqual(xor(complex(1, 1), complex(1, 1)), false);
    assert.strictEqual(xor(complex(0, 1), complex(1, 1)), false);
    assert.strictEqual(xor(complex(1, 0), complex(1, 1)), false);
    assert.strictEqual(xor(complex(1, 1), complex(0, 1)), false);
    assert.strictEqual(xor(complex(1, 1), complex(1, 0)), false);
    assert.strictEqual(xor(complex(1, 0), complex(1, 0)), false);
    assert.strictEqual(xor(complex(0, 1), complex(0, 1)), false);
    assert.strictEqual(xor(complex(0, 0), complex(1, 1)), true);
    assert.strictEqual(xor(complex(0, 0), complex(0, 1)), true);
    assert.strictEqual(xor(complex(0, 0), complex(1, 0)), true);
    assert.strictEqual(xor(complex(1, 1), complex(0, 0)), true);
    assert.strictEqual(xor(complex(0, 1), complex(0, 0)), true);
    assert.strictEqual(xor(complex(1, 0), complex(0, 0)), true);
    assert.strictEqual(xor(complex(), complex(1, 1)), true);
    assert.strictEqual(xor(complex(0), complex(1, 1)), true);
    assert.strictEqual(xor(complex(1), complex(1, 1)), false);
    assert.strictEqual(xor(complex(1, 1), complex()), true);
    assert.strictEqual(xor(complex(1, 1), complex(0)), true);
    assert.strictEqual(xor(complex(1, 1), complex(1)), false);
    assert.strictEqual(xor(complex(0, 0), complex(0, 0)), false);
    assert.strictEqual(xor(complex(), complex()), false);
  });

  it('should xor mixed numbers and complex numbers', function () {
    assert.strictEqual(xor(complex(1, 1), 1), false);
    assert.strictEqual(xor(complex(1, 1), 0), true);
    assert.strictEqual(xor(1, complex(1, 1)), false);
    assert.strictEqual(xor(0, complex(1, 1)), true);
    assert.strictEqual(xor(complex(0, 0), 1), true);
    assert.strictEqual(xor(1, complex(0, 0)), true);
    assert.strictEqual(xor(0, complex(0, 0)), false);
    assert.strictEqual(xor(complex(0, 0), 0), false);
  });

  it('should xor two booleans', function () {
    assert.strictEqual(xor(true, true), false);
    assert.strictEqual(xor(true, false), true);
    assert.strictEqual(xor(false, true), true);
    assert.strictEqual(xor(false, false), false);
  });

  it('should xor mixed numbers and booleans', function () {
    assert.strictEqual(xor(2, true), false);
    assert.strictEqual(xor(2, false), true);
    assert.strictEqual(xor(0, true), true);
    assert.strictEqual(xor(true, 2), false);
    assert.strictEqual(xor(false, 2), true);
    assert.strictEqual(xor(false, 0), false);
  });

  it('should xor mixed numbers and null', function () {
    assert.strictEqual(xor(2, null), true);
    assert.strictEqual(xor(null, 2), true);
  });

  it('should xor bignumbers', function () {
    assert.strictEqual(xor(bignumber(1), bignumber(1)), false);
    assert.strictEqual(xor(bignumber(-1), bignumber(1)), false);
    assert.strictEqual(xor(bignumber(-1), bignumber(-1)), false);
    assert.strictEqual(xor(bignumber(0), bignumber(-1)), true);
    assert.strictEqual(xor(bignumber(1), bignumber(0)), true);
    assert.strictEqual(xor(bignumber(1), bignumber(NaN)), true);
    assert.strictEqual(xor(bignumber(NaN), bignumber(1)), true);
    assert.strictEqual(xor(bignumber('1e+10'), bignumber(0.19209)), false);
    assert.strictEqual(xor(bignumber('-1.0e-400'), bignumber('1.0e-400')), false);
    assert.strictEqual(xor(bignumber(Infinity), bignumber(-Infinity)), false);
    assert.strictEqual(xor(bignumber(NaN), bignumber(NaN)), false);
    assert.strictEqual(xor(bignumber(NaN), bignumber(0)), false);
    assert.strictEqual(xor(bignumber(0), bignumber(NaN)), false);
    assert.strictEqual(xor(bignumber(0), bignumber(0)), false);
  });

  it('should xor mixed numbers and bignumbers', function () {
    assert.strictEqual(xor(bignumber(2), 3), false);
    assert.strictEqual(xor(2, bignumber(2)), false);
    assert.strictEqual(xor(0, bignumber(2)), true);
    assert.strictEqual(xor(2, bignumber(0)), true);
    assert.strictEqual(xor(bignumber(0), 2), true);
    assert.strictEqual(xor(bignumber(2), 0), true);
    assert.strictEqual(xor(bignumber(0), 0), false);
  });

  it('should xor two units', function () {
    assert.strictEqual(xor(unit('100cm'), unit('10inch')), false);
    assert.strictEqual(xor(unit('100cm'), unit('0 inch')), true);
    assert.strictEqual(xor(unit('0cm'), unit('1m')), true);
    assert.strictEqual(xor(unit('m'), unit('1m')), true);
    assert.strictEqual(xor(unit('1dm'), unit('m')), true);
    assert.strictEqual(xor(unit('-100cm'), unit('-10inch')), false);
    assert.strictEqual(xor(unit(5, 'km'), unit(100, 'gram')), false);
    assert.strictEqual(xor(unit(5, 'km'), unit(0, 'gram')), true);
    assert.strictEqual(xor(unit(0, 'km'), unit(100, 'gram')), true);
    assert.strictEqual(xor(unit(0, 'km'), unit(0, 'gram')), false);

    assert.strictEqual(xor(unit(bignumber(0), 'm'), unit(bignumber(0), 'm')), false);
    assert.strictEqual(xor(unit(bignumber(1), 'm'), unit(bignumber(0), 'm')), true);
    assert.strictEqual(xor(unit(bignumber(0), 'm'), unit(bignumber(1), 'm')), true);
    assert.strictEqual(xor(unit(bignumber(1), 'm'), unit(bignumber(1), 'm')), false);
  });

  it('should xor two arrays', function () {
    assert.deepEqual(xor([0, 1, 0, 12], [0, 0, 1, 22]), [false, true, true, false]);
    assert.deepEqual(xor([], []), []);
  });

  describe('Array', function () {

    it('should xor array - scalar', function () {
      assert.deepEqual(xor(10, [0, 2]), [true, false]);
      assert.deepEqual(xor([0, 2], 10), [true, false]);
    });

    it('should xor array - array', function () {
      assert.deepEqual(xor([0, 1, 0, 12], [0, 0, 1, 22]), [false, true, true, false]);
      assert.deepEqual(xor([], []), []);
    });

    it('should xor array - dense matrix', function () {
      assert.deepEqual(xor([0, 1, 0, 12], matrix([0, 0, 1, 22])), matrix([false, true, true, false]));
      assert.deepEqual(xor([], matrix([])), matrix([]));
    });

    it('should xor array - sparse matrix', function () {
      assert.deepEqual(xor([[0, 1], [0, 12]], sparse([[0, 0], [1, 22]])), matrix([[false, true], [true, false]]));
    });
  });

  describe('DenseMatrix', function () {

    it('should xor dense matrix - scalar', function () {
      assert.deepEqual(xor(10, matrix([0, 2])), matrix([true, false]));
      assert.deepEqual(xor(matrix([0, 2]), 10), matrix([true, false]));
    });

    it('should xor dense matrix - array', function () {
      assert.deepEqual(xor(matrix([0, 1, 0, 12]), [0, 0, 1, 22]), matrix([false, true, true, false]));
      assert.deepEqual(xor(matrix([]), []), matrix([]));
    });

    it('should xor dense matrix - dense matrix', function () {
      assert.deepEqual(xor(matrix([0, 1, 0, 12]), matrix([0, 0, 1, 22])), matrix([false, true, true, false]));
      assert.deepEqual(xor(matrix([]), matrix([])), matrix([]));
    });

    it('should xor dense matrix - sparse matrix', function () {
      assert.deepEqual(xor(matrix([[0, 1], [0, 12]]), sparse([[0, 0], [1, 22]])), matrix([[false, true], [true, false]]));
    });
  });

  describe('SparseMatrix', function () {

    it('should xor sparse matrix - scalar', function () {
      assert.deepEqual(xor(10, sparse([[0], [2]])), matrix([[true], [false]]));
      assert.deepEqual(xor(sparse([[0], [2]]), 10), matrix([[true], [false]]));
    });

    it('should xor sparse matrix - array', function () {
      assert.deepEqual(xor(sparse([[0, 1], [0, 12]]), [[0, 0], [1, 22]]), matrix([[false, true], [true, false]]));
    });

    it('should xor sparse matrix - dense matrix', function () {
      assert.deepEqual(xor(sparse([[0, 1], [0, 12]]), matrix([[0, 0], [1, 22]])), matrix([[false, true], [true, false]]));
    });

    it('should xor sparse matrix - sparse matrix', function () {
      assert.deepEqual(xor(sparse([[0, 1], [0, 12]]), sparse([[0, 0], [1, 22]])), matrix([[false, true], [true, false]]));
    });
  });

  it('should throw an error in case of invalid number of arguments', function () {
    assert.throws(function () {xor(1)}, /TypeError: Too few arguments/);
    assert.throws(function () {xor(1, 2, 3)}, /TypeError: Too many arguments/);
  });

  it('should throw an error in case of invalid type of arguments', function () {
    assert.throws(function () {xor(new Date(), true)}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {xor(true, new Date())}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {xor(true, undefined)}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {xor(undefined, true)}, /TypeError: Unexpected type of argument/);
  });

  it('should LaTeX xor', function () {
    var expression = math.parse('xor(1,2)');
    assert.equal(expression.toTex(), '\\left(1\\veebar2\\right)');
  });
});
