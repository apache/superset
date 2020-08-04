// test dotMultiply (element-wise multiply)
var assert = require('assert'),
    math = require('../../../index'),
    approx = require('../../../tools/approx'),
    error = require('../../../lib/error/index'),
    dotMultiply = math.dotMultiply,
    divide = math.divide,
    matrix = math.matrix,
    sparse = math.sparse,
    complex = math.complex,
    range = math.range,
    i = math.i,
    unit = math.unit;

describe('dotMultiply', function() {

  it('should multiply 2 numbers', function() {
    // number
    approx.equal(dotMultiply(2, 3), 6);
    approx.equal(dotMultiply(-2, 3), -6);
    approx.equal(dotMultiply(-2, -3), 6);
    approx.equal(dotMultiply(5, 0), 0);
    approx.equal(dotMultiply(0, 5), 0);
  });

  it('should multiply booleans', function() {
    assert.equal(dotMultiply(true, true), 1);
    assert.equal(dotMultiply(true, false), 0);
    assert.equal(dotMultiply(false, true), 0);
    assert.equal(dotMultiply(false, false), 0);
  });

  it('should multiply mixed numbers and booleans', function() {
    assert.equal(dotMultiply(2, true), 2);
    assert.equal(dotMultiply(2, false), 0);
    assert.equal(dotMultiply(true, 2), 2);
    assert.equal(dotMultiply(false, 2), 0);
  });

  it('should multiply numbers and null', function () {
    assert.equal(dotMultiply(1, null), 0);
    assert.equal(dotMultiply(null, 1), 0);
  });

  it('should multiply 2 complex numbers', function() {
    // complex
    approx.deepEqual(dotMultiply(complex(2, 3), 2), complex(4, 6));
    approx.deepEqual(dotMultiply(complex(2, -3), 2), complex(4, -6));
    approx.deepEqual(dotMultiply(complex(0, 1), complex(2, 3)), complex(-3, 2));
    approx.deepEqual(dotMultiply(complex(2, 3), complex(2, 3)), complex(-5, 12));
    approx.deepEqual(dotMultiply(2, complex(2, 3)), complex(4, 6));
    approx.deepEqual(divide(complex(-5, 12), complex(2, 3)), complex(2, 3));
  });

  it('should multiply a unit by a number', function() {
    // unit
    assert.equal(dotMultiply(2, unit('5 mm')).toString(), '10 mm');
    assert.equal(dotMultiply(2, unit('5 mm')).toString(), '10 mm');
    assert.equal(dotMultiply(unit('5 mm'), 2).toString(), '10 mm');
    assert.equal(dotMultiply(unit('5 mm'), 0).toString(), '0 mm');
  });

  it('should throw an error with strings', function() {
    // string
    assert.throws(function () {dotMultiply("hello", "world")});
    assert.throws(function () {dotMultiply("hello", 2)});
  });

  describe('Array', function () {
  
    var a = [[1,0],[3,4]];
    var b = [[5,6],[0,8]];
    var c = [[5],[6]];
    var d = [[5,6]];
    
    it('should multiply a all elements in a array by a number', function() {
      // matrix, array, range
      approx.deepEqual(dotMultiply(a, 3), [[3,0],[9,12]]);
      approx.deepEqual(dotMultiply(3, a), [[3,0],[9,12]]);
      approx.deepEqual(dotMultiply([1,2,3,4], 2), [2, 4, 6, 8]);
      approx.deepEqual(dotMultiply(2, [1,2,3,4]), [2, 4, 6, 8]);
    });
    
    it('should perform element-wise (array .* array) multiplication', function() {
      approx.deepEqual(dotMultiply(a, b), [[5,0],[0,32]]);
      approx.deepEqual(dotMultiply([[1,2],[3,4]], [[5,6],[7,8]]), [[5,12],[21,32]]);      
    });
    
    it('should perform element-wise (array .* dense matrix) multiplication', function() {
      approx.deepEqual(dotMultiply([[1,2],[3,4]], matrix([[5,6],[7,8]])), matrix([[5,12],[21,32]]));
    });
    
    it('should perform element-wise (array .* sparse matrix) multiplication', function() {
      approx.deepEqual(dotMultiply([[1,2],[3,4]], sparse([[5,6],[7,8]])), sparse([[5,12],[21,32]]));
    });
    
    it('should throw an error if arrays are of different sizes', function() {
      assert.throws(function () {dotMultiply(a, c)});
      assert.throws(function () {dotMultiply(d, a)});
      assert.throws(function () {dotMultiply(d, b)});
      assert.throws(function () {dotMultiply(d, c)});
      assert.throws(function () {dotMultiply(c, b)});
    });
  });
  
  describe('DenseMatrix', function () {

    var a = matrix([[1,0],[3,4]]);
    var b = matrix([[5,6],[0,8]]);
    var c = matrix([[5],[6]]);
    var d = matrix([[5,6]]);

    it('should multiply a all elements in a dense matrix by a number', function() {
      // matrix, array, range
      approx.deepEqual(dotMultiply(a, 3), matrix([[3,0],[9,12]]));
      approx.deepEqual(dotMultiply(3, a), matrix([[3,0],[9,12]]));
      approx.deepEqual(dotMultiply(matrix([1,2,3,4]), 2), matrix([2, 4, 6, 8]));
      approx.deepEqual(dotMultiply(2, matrix([1,2,3,4])), matrix([2, 4, 6, 8]));
    });

    it('should perform element-wise (dense matrix .* array) multiplication', function() {
      approx.deepEqual(dotMultiply(a, [[5,6],[0,8]]), matrix([[5,0],[0,32]]));
      approx.deepEqual(dotMultiply(matrix([[1,2],[3,4]]), [[5,6],[7,8]]), matrix([[5,12],[21,32]]));
    });

    it('should perform element-wise (dense matrix .* dense matrix) multiplication', function() {
      approx.deepEqual(dotMultiply(matrix([[1,2],[3,4]]), matrix([[5,6],[7,8]])), matrix([[5,12],[21,32]]));
    });

    it('should perform element-wise (dense matrix .* sparse matrix) multiplication', function() {
      approx.deepEqual(dotMultiply(matrix([[1,2],[3,4]]), sparse([[5,6],[7,8]])), sparse([[5,12],[21,32]]));
    });

    it('should throw an error if arrays are of different sizes', function() {
      assert.throws(function () {dotMultiply(a, c)});
      assert.throws(function () {dotMultiply(d, a)});
      assert.throws(function () {dotMultiply(d, b)});
      assert.throws(function () {dotMultiply(d, c)});
      assert.throws(function () {dotMultiply(c, b)});
    });
  });
  
  describe('SparseMatrix', function () {

    var a = sparse([[1,0],[3,4]]);
    var b = sparse([[5,6],[0,8]]);
    var c = sparse([[5],[6]]);
    var d = sparse([[5,6]]);

    it('should multiply a all elements in a sparse matrix by a number', function() {
      // matrix, array, range
      approx.deepEqual(dotMultiply(a, 3), sparse([[3,0],[9,12]]));
      approx.deepEqual(dotMultiply(3, a), sparse([[3,0],[9,12]]));
      approx.deepEqual(dotMultiply(sparse([1,2,3,4]), 2), sparse([2, 4, 6, 8]));
      approx.deepEqual(dotMultiply(2, sparse([1,2,3,4])), sparse([2, 4, 6, 8]));
    });

    it('should perform element-wise (sparse matrix .* array) multiplication', function() {
      approx.deepEqual(dotMultiply(a, [[5,6],[0,8]]), sparse([[5,0],[0,32]]));
      approx.deepEqual(dotMultiply(sparse([[1,2],[3,4]]), [[5,6],[7,8]]), sparse([[5,12],[21,32]]));
    });

    it('should perform element-wise (sparse matrix .* dense matrix) multiplication', function() {
      approx.deepEqual(dotMultiply(sparse([[1,2],[3,4]]), matrix([[5,6],[7,8]])), sparse([[5,12],[21,32]]));
    });

    it('should perform element-wise (sparse matrix .* sparse matrix) multiplication', function() {
      approx.deepEqual(dotMultiply(sparse([[0,2],[3,4]]), sparse([[5,6],[0,8]])), sparse([[0,12],[0,32]]));
    });

    it('should throw an error if arrays are of different sizes', function() {
      assert.throws(function () {dotMultiply(a, c)});
      assert.throws(function () {dotMultiply(d, a)});
      assert.throws(function () {dotMultiply(d, b)});
      assert.throws(function () {dotMultiply(d, c)});
      assert.throws(function () {dotMultiply(c, b)});
    });
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {dotMultiply(1)}, /TypeError: Too few arguments/);
    assert.throws(function () {dotMultiply(1, 2, 3)}, /TypeError: Too many arguments/);
  });
  
  it('should LaTeX dotMultiply', function () {
    var expression = math.parse('dotMultiply([1,2],[3,4])');
    assert.equal(expression.toTex(), '\\left(\\begin{bmatrix}1\\\\2\\\\\\end{bmatrix}.\\cdot\\begin{bmatrix}3\\\\4\\\\\\end{bmatrix}\\right)');
  });
});
