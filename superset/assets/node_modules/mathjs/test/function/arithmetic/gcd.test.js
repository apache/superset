// test gcd
var assert = require('assert'),
    math = require('../../../index'),
    matrix = math.matrix,
    sparse = math.sparse,
    gcd = math.gcd;

describe('gcd', function() {

  it('should find the greatest common divisor of two or more numbers', function() {
    assert.strictEqual(gcd(12, 8), 4);
    assert.strictEqual(gcd(8, 12), 4);
    assert.strictEqual(gcd(8, -12), 4);
    assert.strictEqual(gcd(-12, 8), 4);
    assert.strictEqual(gcd(12, -8), 4);
    assert.strictEqual(gcd(15, 3), 3);
    assert.strictEqual(gcd(25, 15, -10, 30), 5);
  });

  it ('should calculate gcd for edge cases around zero', function () {
    assert.strictEqual(gcd(3, 0), 3);
    assert.strictEqual(gcd(-3, 0), 3);
    assert.strictEqual(gcd(0, 3), 3);
    assert.strictEqual(gcd(0, -3), 3);
    assert.strictEqual(gcd(0, 0), 0);

    assert.strictEqual(gcd(1, 1), 1);
    assert.strictEqual(gcd(1, 0), 1);
    assert.strictEqual(gcd(1, -1), 1);
    assert.strictEqual(gcd(-1, 1), 1);
    assert.strictEqual(gcd(-1, 0), 1);
    assert.strictEqual(gcd(-1, -1), 1);
    assert.strictEqual(gcd(0, 1), 1);
    assert.strictEqual(gcd(0, -1), 1);
    assert.strictEqual(gcd(0, 0), 0);
  });

  it ('should calculate gcd for edge cases with negative values', function () {
    assert.deepEqual(1, gcd(2, 5));
    assert.deepEqual(1, gcd(2, -5));
    assert.deepEqual(1, gcd(-2, 5));
    assert.deepEqual(1, gcd(-2, -5));

    assert.deepEqual(2, gcd(2, 6));
    assert.deepEqual(2, gcd(2, -6));
    assert.deepEqual(2, gcd(-2, 6));
    assert.deepEqual(2, gcd(-2, -6));
  });

  it('should calculate gcd for BigNumbers', function() {
    assert.deepEqual(gcd(math.bignumber(12), math.bignumber(8)), math.bignumber(4));
    assert.deepEqual(gcd(math.bignumber(8), math.bignumber(12)), math.bignumber(4));
  });

  it('should calculate gcd for mixed BigNumbers and Numbers', function() {
    assert.deepEqual(gcd(math.bignumber(12), 8), math.bignumber(4));
    assert.deepEqual(gcd(8, math.bignumber(12)), math.bignumber(4));
  });

  it('should find the greatest common divisor of fractions', function () {
    var a = math.fraction(5,8);
    assert.equal(gcd(a, math.fraction(3,7)).toString(), '0.017(857142)');
    assert.equal(a.toString(), '0.625');
  });

  it('should find the greatest common divisor of mixed numbers and fractions', function () {
    assert.deepEqual(gcd(math.fraction(12), 8), math.fraction(4));
    assert.deepEqual(gcd(12, math.fraction(8)), math.fraction(4));
  });

  it('should find the greatest common divisor of booleans', function() {
    assert.equal(gcd(true, true), 1);
    assert.equal(gcd(true, false), 1);
    assert.equal(gcd(false, true), 1);
    assert.equal(gcd(false, false), 0);
  });

  it('should find the greatest common divisor of numbers and null', function () {
    assert.equal(gcd(1, null), 1);
    assert.equal(gcd(null, 1), 1);
    assert.equal(gcd(null, null), 0);
  });

  it('should throw an error if only one argument', function() {
    assert.throws(function () {gcd(1); }, /TypeError: Too few arguments/);
  });

  it('should throw an error for non-integer numbers', function() {
    assert.throws(function () {gcd(2, 4.1); }, /Parameters in function gcd must be integer numbers/);
    assert.throws(function () {gcd(2.3, 4); }, /Parameters in function gcd must be integer numbers/);
  });

  it('should throw an error with complex numbers', function() {
    assert.throws(function () {gcd(math.complex(1,3),2); }, /TypeError: Unexpected type of argument/);
  });

  it('should convert strings to numbers', function() {
    assert.strictEqual(gcd('12', '8'), 4);
    assert.strictEqual(gcd(12, '8'), 4);
    assert.strictEqual(gcd('12', 8), 4);

    assert.throws(function () {gcd('a', 8); }, /Cannot convert "a" to a number/);
  });

  it('should throw an error with units', function() {
    assert.throws(function () { gcd(math.unit('5cm'), 2); }, /TypeError: Unexpected type of argument/);
  });
  
  describe('Array', function () {
    
    it('should find the greatest common divisor array - scalar', function() {
      assert.deepEqual(gcd([5, 18, 3], 3), [1, 3, 3]);
      assert.deepEqual(gcd(3, [5, 18, 3]), [1, 3, 3]);
    });
    
    it('should find the greatest common divisor array - array', function() {
      assert.deepEqual(gcd([5, 2, 3], [25, 3, 6]), [5, 1, 3]);
    });
    
    it('should find the greatest common divisor array - dense matrix', function() {
      assert.deepEqual(gcd([5, 2, 3], matrix([25, 3, 6])), matrix([5, 1, 3]));
    });

    it('should find the greatest common divisor array - sparse matrix', function() {
      assert.deepEqual(gcd([[5, 2, 3], [3, 2, 5]], sparse([[0, 3, 6], [6, 0, 25]])), matrix([[5, 1, 3], [3, 2, 5]]));
    });
  });
  
  describe('DenseMatrix', function () {

    it('should find the greatest common divisor dense matrix - scalar', function() {
      assert.deepEqual(gcd(matrix([5, 18, 3]), 3), matrix([1, 3, 3]));
      assert.deepEqual(gcd(3, matrix([5, 18, 3])), matrix([1, 3, 3]));
    });

    it('should find the greatest common divisor dense matrix - array', function() {
      assert.deepEqual(gcd(matrix([5, 2, 3]), [25, 3, 6]), matrix([5, 1, 3]));
    });

    it('should find the greatest common divisor dense matrix - dense matrix', function() {
      assert.deepEqual(gcd(matrix([5, 2, 3]), matrix([25, 3, 6])), matrix([5, 1, 3]));
    });

    it('should find the greatest common divisor dense matrix - sparse matrix', function() {
      assert.deepEqual(gcd(matrix([[5, 2, 3], [3, 2, 5]]), sparse([[0, 3, 6], [6, 0, 25]])), matrix([[5, 1, 3], [3, 2, 5]]));
    });
  });
  
  describe('SparseMatrix', function () {

    it('should find the greatest common divisor sparse matrix - scalar', function() {
      assert.deepEqual(gcd(sparse([[5, 0, 3], [0, 18, 0]]), 3), matrix([[1, 3, 3], [3, 3, 3]]));
      assert.deepEqual(gcd(3, sparse([[5, 0, 3], [0, 18, 0]])), matrix([[1, 3, 3], [3, 3, 3]]));
    });

    it('should find the greatest common divisor sparse matrix - array', function() {
      assert.deepEqual(gcd(sparse([[5, 2, 3], [3, 2, 5]]), [[0, 3, 6], [6, 0, 25]]), matrix([[5, 1, 3], [3, 2, 5]]));
    });

    it('should find the greatest common divisor sparse matrix - dense matrix', function() {
      assert.deepEqual(gcd(sparse([[5, 2, 3], [3, 2, 5]]), matrix([[0, 3, 6], [6, 0, 25]])), matrix([[5, 1, 3], [3, 2, 5]]));
    });

    it('should find the greatest common divisor sparse matrix - sparse matrix', function() {
      assert.deepEqual(gcd(sparse([[5, 2, 3], [3, 2, 5]]), sparse([[0, 3, 6], [6, 0, 25]])), sparse([[5, 1, 3], [3, 2, 5]]));
    });
  });

  it('should LaTeX gcd', function () {
    var expression = math.parse('gcd(2,3)');
    assert.equal(expression.toTex(), '\\gcd\\left(2,3\\right)');
  });
});
