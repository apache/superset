// test mod
var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var bignumber = math.bignumber;
var matrix = math.matrix;
var sparse = math.sparse;
var mod = math.mod;

describe('mod', function() {

  it('should calculate the modulus of booleans correctly', function () {
    assert.equal(mod(true, true), 0);
    assert.equal(mod(false, true), 0);
    assert.equal(mod(true, false), 1);
    assert.equal(mod(false, false), 0);
  });

  it('should calculate the modulus of numbers and null', function () {
    assert.equal(mod(null, null), 0);
    assert.equal(mod(null, 1), 0);
    assert.equal(mod(1, null), 1);
  });

  it('should calculate the modulus of two numbers', function() {
    assert.equal(mod(1, 1), 0);
    assert.equal(mod(0, 1), 0);
    assert.equal(mod(1, 0), 1);
    assert.equal(mod(0, 0), 0);
    assert.equal(mod(7, 0), 7);

    approx.equal(mod(7, 2), 1);
    approx.equal(mod(9, 3), 0);
    approx.equal(mod(10, 4), 2);
    approx.equal(mod(-10, 4), 2);
    approx.equal(mod(8.2, 3), 2.2);
    approx.equal(mod(4, 1.5), 1);
    approx.equal(mod(0, 3), 0);
  });

  it('should throw an error if the modulus is negative', function() {
    assert.throws(function () {mod(10, -4);});
  });

  it('should throw an error if used with wrong number of arguments', function() {
    assert.throws(function () {mod(1);}, /TypeError: Too few arguments/);
    assert.throws(function () {mod(1,2,3);}, /TypeError: Too many arguments/);
  });

  it('should throw an error if used with wrong type of arguments', function() {
    assert.throws(function () {mod(1, new Date());}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {mod(new Date(), bignumber(2));}, /TypeError: Unexpected type of argument/);
  });

  it('should calculate the modulus of bignumbers', function() {
    assert.deepEqual(mod(bignumber(7), bignumber(2)), bignumber(1));
    assert.deepEqual(mod(bignumber(7), bignumber(0)), bignumber(7));
    assert.deepEqual(mod(bignumber(0), bignumber(3)), bignumber(0));
    assert.deepEqual(mod(bignumber(7), bignumber(2)), bignumber(1));
    assert.deepEqual(mod(bignumber(8), bignumber(3)).valueOf(), bignumber(2).valueOf());
  });

  it.skip('should calculate the modulus of bignumbers for fractions', function () {
    assert.deepEqual(mod(bignumber(7).div(3), bignumber(1).div(3)), bignumber(0));
  });

  it.skip('should calculate the modulus of bignumbers for negative values', function () {
    assert.deepEqual(mod(bignumber(-10), bignumber(4)), bignumber(2));
  });

  it('should calculate the modulus of mixed numbers and bignumbers', function() {
    assert.deepEqual(mod(bignumber(7), 2), bignumber(1));
    assert.deepEqual(mod(bignumber(7), 0), bignumber(7));
    assert.deepEqual(mod(8, bignumber(3)), bignumber(2));
    assert.deepEqual(mod(7, bignumber(0)), bignumber(7));
    assert.deepEqual(mod(bignumber(0), 3), bignumber(0));
    assert.deepEqual(mod(bignumber(7), 0), bignumber(7));

    assert.throws(function () {mod(7/3, bignumber(2));}, /TypeError: Cannot implicitly convert a number with >15 significant digits to BigNumber/);
    assert.throws(function () {mod(bignumber(7).div(3), 1/3);}, /TypeError: Cannot implicitly convert a number with >15 significant digits to BigNumber/);
  });

  it('should calculate the modulus of mixed booleans and bignumbers', function() {
    assert.deepEqual(mod(bignumber(7), true), bignumber(0));
    assert.deepEqual(mod(bignumber(7), false), bignumber(7));
    assert.deepEqual(mod(true, bignumber(3)), bignumber(1));
    assert.deepEqual(mod(false, bignumber(3)), bignumber(0));
  });

  it('should throw an error if used on complex numbers', function() {
    assert.throws(function () {mod(math.complex(1,2), 3);}, TypeError);
    assert.throws(function () {mod(3, math.complex(1,2));}, TypeError);
    assert.throws(function () {mod(bignumber(3), math.complex(1,2));}, TypeError);
  });

  it('should convert string to number', function() {
    assert.strictEqual(mod('8', '3'), 2);
    assert.strictEqual(mod('8', 3), 2);
    assert.strictEqual(mod(8, '3'), 2);
    assert.throws(function () {mod(5, 'a');}, /Cannot convert "a" to a number/);
  });

  it('should calculate modulus of two fractions', function() {
    var b = math.fraction(8);
    var a = mod(b, math.fraction(3));
    assert.equal(a.toString(), '2');
    assert.equal(b.toString(), '8');
    assert(a instanceof math.type.Fraction);

    assert.equal(mod(math.fraction(4.55), math.fraction(0.05)).toString(), '0');
  });

  it('should calculate modulus of mixed fractions and numbers', function() {
    assert.deepEqual(mod(8, math.fraction(3)), math.fraction(2));
    assert.deepEqual(mod(math.fraction(8), 3), math.fraction(2));
  });

  describe('Array', function () {
    
    it('should perform element-wise modulus on array and scalar', function() {
      approx.deepEqual(mod([[-4, -3, 0, -1], [0, 1, 2, 3]], 3), [[2, 0, 0, 2], [0, 1, 2, 0]]);
      approx.deepEqual(mod(3, [[4, 3], [2, 1]]), [[3, 0], [1, 0]]);
    });
    
    it('should perform element-wise modulus on array and array', function() {
      approx.deepEqual(mod([[-40, -31], [11, -23]], [[3, 7], [1, 3]]), [[2, 4], [0, 1]]);
    });
    
    it('should perform element-wise modulus on array and dense matrix', function() {
      approx.deepEqual(mod([[-40, -31], [11, -23]], matrix([[3, 7], [1, 3]])), matrix([[2, 4], [0, 1]]));
    });

    it('should perform element-wise modulus on array and sparse matrix', function() {
      approx.deepEqual(mod([[-40, -31], [11, -23]], sparse([[3, 7], [1, 3]])), matrix([[2, 4], [0, 1]]));
    });
  });

  describe('DenseMatrix', function () {

    it('should perform element-wise modulus on dense matrix and scalar', function() {
      approx.deepEqual(mod(matrix([[-4, -3, 0, -1], [0, 1, 2, 3]]), 3), matrix([[2, 0, 0, 2], [0, 1, 2, 0]]));
      approx.deepEqual(mod(3, matrix([[4, 3], [2, 1]])), matrix([[3, 0], [1, 0]]));
    });

    it('should perform element-wise modulus on dense matrix and array', function() {
      approx.deepEqual(mod(matrix([[-40, -31], [11, -23]]), [[3, 7], [1, 3]]), matrix([[2, 4], [0, 1]]));
    });

    it('should perform element-wise modulus on dense matrix and dense matrix', function() {
      approx.deepEqual(mod(matrix([[-40, -31], [11, -23]]), matrix([[3, 7], [1, 3]])), matrix([[2, 4], [0, 1]]));
    });

    it('should perform element-wise modulus on dense matrix and sparse matrix', function() {
      approx.deepEqual(mod(matrix([[-40, -31], [11, -23]]), sparse([[3, 7], [1, 3]])), matrix([[2, 4], [0, 1]]));
    });
  });

  describe('SparseMatrix', function () {

    it('should perform element-wise modulus on sparse matrix and scalar', function() {
      approx.deepEqual(mod(sparse([[-4, -3, 0, -1], [0, 1, 2, 3]]), 3), sparse([[2, 0, 0, 2], [0, 1, 2, 0]]));
      approx.deepEqual(mod(3, sparse([[4, 3], [2, 1]])), matrix([[3, 0], [1, 0]]));
    });

    it('should perform element-wise modulus on sparse matrix and array', function() {
      approx.deepEqual(mod(sparse([[-40, -31], [11, -23]]), [[3, 7], [1, 3]]), sparse([[2, 4], [0, 1]]));
    });

    it('should perform element-wise modulus on sparse matrix and dense matrix', function() {
      approx.deepEqual(mod(sparse([[-40, -31], [11, -23]]), matrix([[3, 7], [1, 3]])), sparse([[2, 4], [0, 1]]));
    });

    it('should perform element-wise modulus on sparse matrix and sparse matrix', function() {
      approx.deepEqual(mod(sparse([[-40, -31], [11, -23]]), sparse([[3, 7], [1, 3]])), sparse([[2, 4], [0, 1]]));
    });
  });
  
  it('should LaTeX mod', function () {
    var expression = math.parse('mod(11,2)');
    assert.equal(expression.toTex(), '\\left(11\\mod2\\right)');
  });
});
