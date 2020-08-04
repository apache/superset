var assert = require('assert'),
    math = require('../../../index'),
    matrix = math.matrix,
    sparse = math.sparse,
    lcm = math.lcm;

describe('lcm', function() {

  it('should find the lowest common multiple of two or more numbers', function() {
    assert.equal(lcm(4, 6), 12);
    assert.equal(lcm(4, -6), 12);
    assert.equal(lcm(6, 4), 12);
    assert.equal(lcm(-6, 4), 12);
    assert.equal(lcm(-6, -4), 12);
    assert.equal(lcm(21, 6), 42);
    assert.equal(lcm(3, -4, 24), 24);

    assert.throws(function () {lcm(1); }, /TypeError: Too few arguments/);
  });

  it ('should calculate lcm for edge cases around zero', function () {
    assert.equal(lcm(3, 0), 0);
    assert.equal(lcm(-3, 0), 0);
    assert.equal(lcm(0, 3), 0);
    assert.equal(lcm(0, -3), 0);
    assert.equal(lcm(0, 0), 0);

    assert.equal(lcm(1, 1), 1);
    assert.equal(lcm(1, 0), 0);
    assert.equal(lcm(1, -1), 1);
    assert.equal(lcm(-1, 1), 1);
    assert.equal(lcm(-1, 0), 0);
    assert.equal(lcm(-1, -1), 1);
    assert.equal(lcm(0, 1), 0);
    assert.equal(lcm(0, -1), 0);
    assert.equal(lcm(0, 0), 0);
  });

  it('should calculate lcm for BigNumbers', function() {
    assert.deepEqual(lcm(math.bignumber(4), math.bignumber(6)), math.bignumber(12));
    assert.deepEqual(lcm(math.bignumber(4), math.bignumber(6)), math.bignumber(12));
  });

  it('should calculate lcm for mixed BigNumbers and Numbers', function() {
    assert.deepEqual(lcm(math.bignumber(4), 6), math.bignumber(12));
    assert.deepEqual(lcm(4, math.bignumber(6)), math.bignumber(12));
  });

  it('should find the lowest common multiple of booleans', function() {
    assert.equal(lcm(true, true), 1);
    assert.equal(lcm(true, false), 0);
    assert.equal(lcm(false, true), 0);
    assert.equal(lcm(false, false), 0);
  });

  it('should find the lowest common multiple of numbers and null', function () {
    assert.equal(lcm(1, null), 0);
    assert.equal(lcm(null, 1), 0);
    assert.equal(lcm(null, null), 0);
  });

  it('should throw an error for non-integer numbers', function() {
    assert.throws(function () {lcm(2, 4.1); }, /Parameters in function lcm must be integer numbers/);
    assert.throws(function () {lcm(2.3, 4); }, /Parameters in function lcm must be integer numbers/);
  });

  it('should throw an error with complex numbers', function() {
    assert.throws(function () {lcm(math.complex(1,3),2); }, TypeError, 'Function lcm(complex, number) not supported');
  });

  it('should convert strings to numbers', function() {
    assert.equal(lcm('4', '6'), 12);
    assert.equal(lcm('4', 6), 12);
    assert.equal(lcm(4, '6'), 12);


    assert.throws(function () {lcm('a', 2); }, /Cannot convert "a" to a number/);
  });

  it('should find the least common multiple of fractions', function () {
    var a = math.fraction(5,8);
    assert.equal(lcm(a, math.fraction(3,7)).toString(), '15');
    assert.equal(a.toString(), '0.625');
  });

  it('should find the least common multiple of mixed numbers and fractions', function () {
    assert.deepEqual(lcm(math.fraction(12), 8), math.fraction(24));
    assert.deepEqual(lcm(12, math.fraction(8)), math.fraction(24));
  });
  
  it('should find the least common even for edge cases', function () {
    assert.deepEqual(lcm(math.fraction(-3), math.fraction(3)), math.fraction(3));
    assert.deepEqual(lcm(math.fraction(3), math.fraction(-3)), math.fraction(3));
    assert.deepEqual(lcm(math.fraction(0), math.fraction(3)), math.fraction(0));
    assert.deepEqual(lcm(math.fraction(3), math.fraction(0)), math.fraction(0));
    assert.deepEqual(lcm(math.fraction(0), math.fraction(0)), math.fraction(0));
    assert.deepEqual(lcm(math.fraction(200), math.fraction(333)), math.fraction(66600));
    assert.deepEqual(lcm(math.fraction(9999), math.fraction(8888)), math.fraction(79992));
  });

  it('should throw an error with units', function() {
    assert.throws(function () { lcm(math.unit('5cm'), 2); }, TypeError, 'Function lcm(unit, number) not supported');
  });

  describe('Array', function () {

    it('should find the greatest common divisor array - scalar', function() {
      assert.deepEqual(lcm([5, 18, 3], 3), [15, 18, 3]);
      assert.deepEqual(lcm(3, [5, 18, 3]), [15, 18, 3]);
    });

    it('should find the greatest common divisor array - array', function() {
      assert.deepEqual(lcm([5, 2, 3], [25, 3, 6]), [25, 6, 6]);
    });

    it('should find the greatest common divisor array - dense matrix', function() {
      assert.deepEqual(lcm([5, 2, 3], matrix([25, 3, 6])), matrix([25, 6, 6]));
    });

    it('should find the greatest common divisor array - sparse matrix', function() {
      assert.deepEqual(lcm([[5, 2, 3], [3, 2, 5]], sparse([[0, 3, 6], [6, 0, 25]])), sparse([[0, 6, 6], [6, 0, 25]]));
    });
  });
  
  describe('DenseMatrix', function () {

    it('should find the greatest common divisor dense matrix - scalar', function() {
      assert.deepEqual(lcm(matrix([5, 18, 3]), 3), matrix([15, 18, 3]));
      assert.deepEqual(lcm(3, matrix([5, 18, 3])), matrix([15, 18, 3]));
    });

    it('should find the greatest common divisor dense matrix - array', function() {
      assert.deepEqual(lcm(matrix([5, 2, 3]), [25, 3, 6]), matrix([25, 6, 6]));
    });

    it('should find the greatest common divisor dense matrix - dense matrix', function() {
      assert.deepEqual(lcm(matrix([5, 2, 3]), matrix([25, 3, 6])), matrix([25, 6, 6]));
    });

    it('should find the greatest common divisor dense matrix - sparse matrix', function() {
      assert.deepEqual(lcm(matrix([[5, 2, 3], [3, 2, 5]]), sparse([[0, 3, 6], [6, 0, 25]])), sparse([[0, 6, 6], [6, 0, 25]]));
    });
  });

  describe('SparseMatrix', function () {

    it('should find the greatest common divisor sparse matrix - scalar', function() {
      assert.deepEqual(lcm(sparse([[5, 0, 3], [0, 18, 0]]), 3), sparse([[15, 0, 3], [0, 18, 0]]));
      assert.deepEqual(lcm(3, sparse([[5, 0, 3], [0, 18, 0]])), sparse([[15, 0, 3], [0, 18, 0]]));
    });

    it('should find the greatest common divisor sparse matrix - array', function() {
      assert.deepEqual(lcm(sparse([[5, 2, 3], [3, 2, 5]]), [[0, 3, 6], [6, 0, 25]]), sparse([[0, 6, 6], [6, 0, 25]]));
    });

    it('should find the greatest common divisor sparse matrix - dense matrix', function() {
      assert.deepEqual(lcm(sparse([[5, 2, 3], [3, 2, 5]]), matrix([[0, 3, 6], [6, 0, 25]])), sparse([[0, 6, 6], [6, 0, 25]]));
    });

    it('should find the greatest common divisor sparse matrix - sparse matrix', function() {
      assert.deepEqual(lcm(sparse([[5, 2, 3], [3, 2, 5]]), sparse([[0, 3, 6], [6, 0, 25]])), sparse([[0, 6, 6], [6, 0, 25]]));
    });
  });

  it('should LaTeX lcm', function () {
    var expression = math.parse('lcm(2,3)');
    assert.equal(expression.toTex(), '\\mathrm{lcm}\\left(2,3\\right)');
  });
});
