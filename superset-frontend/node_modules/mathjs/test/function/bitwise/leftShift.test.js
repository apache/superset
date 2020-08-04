// test leftShift
var assert = require('assert'),
    math = require('../../../index'),
    matrix = math.matrix,
    sparse = math.sparse,
    bignumber = math.bignumber,
    leftShift = math.leftShift;

describe('leftShift', function () {

  it('should left shift a number by a given amount', function () {
    assert.equal(leftShift(0, 1000), 0);
    assert.equal(leftShift(2, 0), 2);
    assert.equal(leftShift(2, 3), 16);
    assert.equal(leftShift(2, 4), 32);
    assert.equal(leftShift(-2, 2), -8);
    assert.equal(leftShift(3, 3), 24);
    assert.equal(leftShift(-3, 2), -12);
    assert.equal(leftShift(-3, 3), -24);
  });

  it('should left shift booleans by a boolean amount', function () {
    assert.equal(leftShift(true, true), 2);
    assert.equal(leftShift(true, false), 1);
    assert.equal(leftShift(false, true), 0);
    assert.equal(leftShift(false, false), 0);
  });

  it('should left shift with a mix of numbers and booleans', function () {
    assert.equal(leftShift(2, true), 4);
    assert.equal(leftShift(2, false), 2);
    assert.equal(leftShift(true, 2), 4);
    assert.equal(leftShift(false, 2), 0);
  });

  it('should left shift numbers and null', function () {
    assert.equal(leftShift(1, null), 1);
    assert.equal(leftShift(null, 1), 0);
  });

  it('should left shift bignumbers', function () {
    assert.deepEqual(leftShift(bignumber(2), bignumber(3)), bignumber(16));
    assert.deepEqual(leftShift(bignumber(500), bignumber(100)), bignumber('633825300114114700748351602688000'));
    assert.deepEqual(leftShift(bignumber(-1), bignumber(2)), bignumber(-4));
    assert.equal(leftShift(bignumber(0), bignumber(-2)).isNaN(), true);
    assert.deepEqual(leftShift(bignumber(Infinity), bignumber(2)).toString(), 'Infinity');
    assert.equal(leftShift(bignumber(Infinity), bignumber(Infinity)).isNaN(), true);
  });

  it('should left shift mixed numbers and bignumbers', function () {
    assert.deepEqual(leftShift(bignumber(2), 3), bignumber(16));
    assert.deepEqual(leftShift(bignumber(500), 100), bignumber('633825300114114700748351602688000'));
    assert.deepEqual(leftShift(2, bignumber(3)), bignumber(16));
    assert.deepEqual(leftShift(-1, bignumber(2)), bignumber(-4));
    assert.deepEqual(leftShift(bignumber(-1), 2), bignumber(-4));
    assert.equal(leftShift(bignumber(0), -2).isNaN(), true);
    assert.equal(leftShift(bignumber(Infinity), Infinity).isNaN(), true);
  });

  it('should left shift mixed booleans and bignumbers', function () {
    assert.deepEqual(leftShift(true, bignumber(3)), bignumber(8));
    assert.deepEqual(leftShift(false, bignumber(3)), bignumber(0));
    assert.deepEqual(leftShift(bignumber(3), false), bignumber(3));
    assert.deepEqual(leftShift(bignumber(3), true), bignumber(6));
  });

  it('should throw an error if used with a unit', function() {
    assert.throws(function () {leftShift(math.unit('5cm'), 2);}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {leftShift(2, math.unit('5cm'));}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {leftShift(math.unit('2cm'), math.unit('5cm'));}, /TypeError: Unexpected type of argument/);
  });

  it('should throw an error if the parameters are not integers', function () {
    assert.throws(function () {
      leftShift(1.1, 1);
    }, /Integers expected in function leftShift/);
    assert.throws(function () {
      leftShift(1, 1.1);
    }, /Integers expected in function leftShift/);
    assert.throws(function () {
      leftShift(1.1, 1.1);
    }, /Integers expected in function leftShift/);
    assert.throws(function () {
      leftShift(bignumber(1.1), 1);
    }, /Integers expected in function leftShift/);
    assert.throws(function () {
      leftShift(1, bignumber(1.1));
    }, /Integers expected in function leftShift/);
    assert.throws(function () {
      leftShift(bignumber(1.1), bignumber(1));
    }, /Integers expected in function leftShift/);
    assert.throws(function () {
      leftShift(bignumber(1), bignumber(1.1));
    }, /Integers expected in function leftShift/);
  });

  describe('Array', function () {
    
    it('should left shift array and scalar', function () {
      assert.deepEqual(leftShift([[1, 2], [8, 0]], 2), [[4, 8], [32, 0]]);
      assert.deepEqual(leftShift(2, [[1, 2], [8, 0]]), [[4, 8], [512, 2]]);
    });
    
    it('should left shift array - array', function () {
      assert.deepEqual(leftShift([[1, 2], [8, 0]], [[4, 8], [32, 0]]), [[16, 512], [8, 0]]);
      assert.deepEqual(leftShift([[4, 8], [32, 0]], [[1, 2], [8, 0]]), [[8, 32], [8192, 0]]);
    });
    
    it('should left shift array - dense matrix', function () {
      assert.deepEqual(leftShift([[1, 2], [8, 0]], matrix([[4, 8], [32, 0]])), matrix([[16, 512], [8, 0]]));
      assert.deepEqual(leftShift([[4, 8], [32, 0]], matrix([[1, 2], [8, 0]])), matrix([[8, 32], [8192, 0]]));
    });

    it('should left shift array - sparse matrix', function () {
      assert.deepEqual(leftShift([[1, 2], [8, 0]], sparse([[4, 8], [32, 0]])), matrix([[16, 512], [8, 0]]));
      assert.deepEqual(leftShift([[4, 8], [32, 0]], sparse([[1, 2], [8, 0]])), matrix([[8, 32], [8192, 0]]));
    });
  });
  
  describe('DenseMatrix', function () {

    it('should left shift dense matrix and scalar', function () {
      assert.deepEqual(leftShift(matrix([[1, 2], [8, 0]]), 2), matrix([[4, 8], [32, 0]]));
      assert.deepEqual(leftShift(2, matrix([[1, 2], [8, 0]])), matrix([[4, 8], [512, 2]]));
    });

    it('should left shift dense matrix - array', function () {
      assert.deepEqual(leftShift(matrix([[1, 2], [8, 0]]), [[4, 8], [32, 0]]), matrix([[16, 512], [8, 0]]));
      assert.deepEqual(leftShift(matrix([[4, 8], [32, 0]]), [[1, 2], [8, 0]]), matrix([[8, 32], [8192, 0]]));
    });

    it('should left shift dense matrix - dense matrix', function () {
      assert.deepEqual(leftShift(matrix([[1, 2], [8, 0]]), matrix([[4, 8], [32, 0]])), matrix([[16, 512], [8, 0]]));
      assert.deepEqual(leftShift(matrix([[4, 8], [32, 0]]), matrix([[1, 2], [8, 0]])), matrix([[8, 32], [8192, 0]]));
    });

    it('should left shift dense matrix - sparse matrix', function () {
      assert.deepEqual(leftShift(matrix([[1, 2], [8, 0]]), sparse([[4, 8], [32, 0]])), matrix([[16, 512], [8, 0]]));
      assert.deepEqual(leftShift(matrix([[4, 8], [32, 0]]), sparse([[1, 2], [8, 0]])), matrix([[8, 32], [8192, 0]]));
    });
  });

  describe('SparseMatrix', function () {

    it('should left shift sparse matrix and scalar', function () {
      assert.deepEqual(leftShift(sparse([[1, 2], [8, 0]]), 2), sparse([[4, 8], [32, 0]]));
      assert.deepEqual(leftShift(2, sparse([[1, 2], [8, 0]])), matrix([[4, 8], [512, 2]]));
    });

    it('should left shift sparse matrix - array', function () {
      assert.deepEqual(leftShift(sparse([[1, 2], [8, 0]]), [[4, 8], [32, 0]]), sparse([[16, 512], [8, 0]]));
      assert.deepEqual(leftShift(sparse([[4, 8], [32, 0]]), [[1, 2], [8, 0]]), sparse([[8, 32], [8192, 0]]));
    });

    it('should left shift sparse matrix - dense matrix', function () {
      assert.deepEqual(leftShift(sparse([[1, 2], [8, 0]]), matrix([[4, 8], [32, 0]])), sparse([[16, 512], [8, 0]]));
      assert.deepEqual(leftShift(sparse([[4, 8], [32, 0]]), matrix([[1, 2], [8, 0]])), sparse([[8, 32], [8192, 0]]));
    });

    it('should left shift sparse matrix - sparse matrix', function () {
      assert.deepEqual(leftShift(sparse([[1, 2], [8, 0]]), sparse([[4, 8], [32, 0]])), sparse([[16, 512], [8, 0]]));
      assert.deepEqual(leftShift(sparse([[4, 8], [32, 0]]), sparse([[1, 2], [8, 0]])), sparse([[8, 32], [8192, 0]]));
    });
  });

  it('should throw an error if used with wrong number of arguments', function () {
    assert.throws(function () {leftShift(1);}, /TypeError: Too few arguments/);
    assert.throws(function () {leftShift(1, 2, 3);}, /TypeError: Too many arguments/);
  });

  it('should throw an error in case of invalid type of arguments', function () {
    assert.throws(function () {leftShift(new Date(), true);}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {leftShift(true, new Date());}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {leftShift(true, undefined);}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {leftShift(undefined, true);}, /TypeError: Unexpected type of argument/);
  });

  it('should LaTeX leftShift', function () {
    var expression = math.parse('leftShift(2,3)');
    assert.equal(expression.toTex(), '\\left(2<<3\\right)');
  });
});
