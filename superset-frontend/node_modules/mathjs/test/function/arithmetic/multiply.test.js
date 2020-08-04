// test multiply
var assert = require('assert'),
    math = require('../../../index'),
    approx = require('../../../tools/approx'),
    market = require('../../../tools/matrixmarket'),
    multiply = math.multiply,
    divide = math.divide,
    matrix = math.matrix,
    complex = math.complex,
    bignumber = math.bignumber,
    i = math.i,
    unit = math.unit;

describe('multiply', function() {

  describe('Scalar', function () {

    it('should multiply two numbers correctly', function() {
      approx.equal(multiply(2, 3), 6);
      approx.equal(multiply(-2, 3), -6);
      approx.equal(multiply(-2, -3), 6);
      approx.equal(multiply(5, 0), 0);
      approx.equal(multiply(0, 5), 0);
      approx.deepEqual(multiply(0, Infinity), NaN);
      approx.deepEqual(multiply(2, Infinity), Infinity);
      approx.deepEqual(multiply(-2, Infinity), -Infinity);
    });

    it('should multiply booleans', function() {
      assert.equal(multiply(true, true), 1);
      assert.equal(multiply(true, false), 0);
      assert.equal(multiply(false, true), 0);
      assert.equal(multiply(false, false), 0);
    });

    it('should multiply mixed numbers and booleans', function() {
      assert.equal(multiply(2, true), 2);
      assert.equal(multiply(2, false), 0);
      assert.equal(multiply(true, 2), 2);
      assert.equal(multiply(false, 2), 0);
    });

    it('should multiply numbers and null', function () {
      assert.equal(multiply(1, null), 0);
      assert.equal(multiply(null, 1), 0);
    });

    it('should multiply bignumbers', function() {
      assert.deepEqual(multiply(bignumber(1.5), bignumber(0.2)), bignumber(0.3));
      assert.deepEqual(multiply(bignumber('1.3e5000'), bignumber('2')), bignumber('2.6e5000'));
    });

    it('should multiply mixed numbers and bignumbers', function() {
      assert.deepEqual(multiply(bignumber(1.5), 0.2), bignumber(0.3));
      assert.deepEqual(multiply(1.5, bignumber(0.2)), bignumber(0.3));
      assert.deepEqual(multiply(bignumber('1.3e5000'), 2), bignumber('2.6e5000'));

      assert.throws(function () {multiply(1/3, bignumber(1).div(3));}, /Cannot implicitly convert a number with >15 significant digits to BigNumber/);
      assert.throws(function () {multiply(bignumber(1).div(3), 1/3);}, /Cannot implicitly convert a number with >15 significant digits to BigNumber/);
    });

    it('should throw an error when multipling mixed fractions and bignumbers', function() {
      assert.throws(function () {multiply(math.bignumber('2'), math.fraction(1,3))}, /Cannot implicitly convert a Fraction to BigNumber/);
      assert.throws(function () {multiply(math.fraction(1,3), math.bignumber('2'))}, /Cannot implicitly convert a Fraction to BigNumber/);
    });

    it('should multiply mixed booleans and bignumbers', function() {
      assert.deepEqual(multiply(bignumber(0.3), true), bignumber(0.3));
      assert.deepEqual(multiply(bignumber(0.3), false), bignumber(0));
      assert.deepEqual(multiply(false, bignumber('2')), bignumber(0));
      assert.deepEqual(multiply(true, bignumber('2')), bignumber(2));
    });

    it('should multiply two complex numbers correctly', function() {
      approx.deepEqual(multiply(complex(2, 3), 2), complex(4, 6));
      approx.deepEqual(multiply(complex(2, -3), -2), complex(-4, 6));
      approx.deepEqual(multiply(complex(2, -3), 2), complex(4, -6));
      approx.deepEqual(multiply(complex(-2, 3), 2), complex(-4, 6));
      approx.deepEqual(multiply(complex(-2, -3), 2), complex(-4, -6));
      approx.deepEqual(multiply(2, complex(2, 3)), complex(4, 6));
      approx.deepEqual(multiply(i, complex(2, 3)), complex(-3, 2));
      approx.deepEqual(multiply(complex(0, 1), complex(2, 3)), complex(-3, 2));
      approx.deepEqual(multiply(complex(1, 1), complex(2, 3)), complex(-1, 5));
      approx.deepEqual(multiply(complex(2, 3), complex(1, 1)), complex(-1, 5));
      approx.deepEqual(multiply(complex(2, 3), complex(2, 3)), complex(-5, 12));
      approx.deepEqual(divide(complex(-5, 12), complex(2, 3)), complex(2, 3));
      approx.deepEqual(multiply(complex(2, 3), 0), complex(0, 0));
      approx.deepEqual(multiply(complex(0, 3), complex(0, -4)), complex(12, 0));
      approx.deepEqual(multiply(multiply(3, i), multiply(-4, i)), complex(12, 0));
      approx.deepEqual(multiply(math.i, Infinity), complex(NaN, Infinity));
      approx.deepEqual(multiply(Infinity, math.i), complex(NaN, Infinity));

      approx.deepEqual(multiply(complex(2,0), complex(0,2)), complex(0, 4));
      approx.deepEqual(multiply(complex(0,2), complex(0,2)), -4);
      approx.deepEqual(multiply(complex(2,2), complex(0,2)), complex(-4, 4));
      approx.deepEqual(multiply(complex(2,0), complex(2,2)), complex(4, 4));
      approx.deepEqual(multiply(complex(0,2), complex(2,2)), complex(-4, 4));
      approx.deepEqual(multiply(complex(2,2), complex(2,2)), complex(0, 8));
      approx.deepEqual(multiply(complex(2,0), complex(2,0)), 4);
      approx.deepEqual(multiply(complex(0,2), complex(2,0)), complex(0, 4));
      approx.deepEqual(multiply(complex(2,2), complex(2,0)), complex(4, 4));

      approx.deepEqual(multiply(complex(2, 3), complex(4, 5)), complex(-7, 22));
      approx.deepEqual(multiply(complex(2, 3), complex(4, -5)), complex(23, 2));
      approx.deepEqual(multiply(complex(2, 3), complex(-4, 5)), complex(-23, -2));
      approx.deepEqual(multiply(complex(2, 3), complex(-4, -5)), complex(7, -22));
      approx.deepEqual(multiply(complex(2, -3), complex(4, 5)), complex(23, -2));
      approx.deepEqual(multiply(complex(2, -3), complex(4, -5)), complex(-7, -22));
      approx.deepEqual(multiply(complex(2, -3), complex(-4, 5)), complex(7, 22));
      approx.deepEqual(multiply(complex(2, -3), complex(-4, -5)), complex(-23, 2));
      approx.deepEqual(multiply(complex(-2, 3), complex(4, 5)), complex(-23, 2));
      approx.deepEqual(multiply(complex(-2, 3), complex(4, -5)), complex(7, 22));
      approx.deepEqual(multiply(complex(-2, 3), complex(-4, 5)), complex(-7, -22));
      approx.deepEqual(multiply(complex(-2, 3), complex(-4, -5)), complex(23, -2));
      approx.deepEqual(multiply(complex(-2, -3), complex(4, 5)), complex(7, -22));
      approx.deepEqual(multiply(complex(-2, -3), complex(4, -5)), complex(-23, -2));
      approx.deepEqual(multiply(complex(-2, -3), complex(-4, 5)), complex(23, 2));
      approx.deepEqual(multiply(complex(-2, -3), complex(-4, -5)), complex(-7, 22));
    });

    it('should multiply mixed complex numbers and numbers', function() {
      assert.deepEqual(multiply(math.complex(6, -4), 2), math.complex(12, -8));
      assert.deepEqual(multiply(2, math.complex(2, 4)), math.complex(4, 8));
    });

    it('should multiply mixed complex numbers and big numbers', function() {
      assert.deepEqual(multiply(math.complex(6, -4), math.bignumber(2)), math.complex(12, -8));
      assert.deepEqual(multiply(math.bignumber(2), math.complex(2, 4)), math.complex(4, 8));
    });

    it('should multiply two fractions', function() {
      var a = math.fraction(1,4);
      assert.equal(multiply(a, math.fraction(1,2)).toString(), '0.125');
      assert.equal(a.toString(), '0.25');

      assert.equal(multiply(math.fraction(2), math.fraction(1,3)).toString(), '0.(6)');
    });

    it('should multiply mixed fractions and numbers', function() {
      assert.deepEqual(multiply(2, math.fraction(1,3)), math.fraction(2,3));
      assert.deepEqual(multiply(math.fraction(1,3), 2), math.fraction(2,3));
    });

    it('should multiply a number and a unit correctly', function() {
      assert.equal(multiply(2, unit('5 mm')).toString(), '10 mm');
      assert.equal(multiply(2, unit('5 mm')).toString(), '10 mm');
      assert.equal(multiply(10, unit('celsius')).toString(), '10 celsius');
      assert.equal(multiply(unit('5 mm'), 2).toString(), '10 mm');
      assert.equal(multiply(unit('5 mm'), 0).toString(), '0 mm');
      assert.equal(multiply(unit('celsius'), 10).toString(), '10 celsius');

      assert.equal(multiply(unit(math.fraction(1,4), 'm'), 3).toString(), '3/4 m');
      assert.equal(multiply(3, unit(math.fraction(1,4), 'm')).toString(), '3/4 m');
      assert.equal(multiply(math.fraction(1,4), unit(3, 'm')).toString(), '3/4 m');
      assert.equal(multiply(unit(3, 'm'), math.fraction(1,4)).toString(), '3/4 m');

      assert.equal(multiply(unit(math.complex(9, 8), 'm'), 2).toString(), '(18 + 16i) m');
      assert.equal(math.format(multiply(unit(math.complex(2, 3), 'g'), math.complex(4, 5)), 14), '(-7 + 22i) g');
    });

    it('should multiply a number and a unit without value correctly', function() {
      assert.equal(multiply(2, unit('mm')).toString(), '2 mm');
      assert.equal(multiply(2, unit('km')).toString(), '2 km');
      assert.equal(multiply(2, unit('inch')).toString(), '2 inch');
      assert.equal(multiply(unit('mm'), 2).toString(), '2 mm');
      assert.equal(multiply(unit('km'), 2).toString(), '2 km');
      assert.equal(multiply(unit('inch'), 2).toString(), '2 inch');
    });

    it('should multiply two units correctly', function() {
      assert.equal(multiply(unit('2 m'), unit('4 m')).toString(), '8 m^2');
      assert.equal(multiply(unit('2 ft'), unit('4 ft')).toString(), '8 ft^2');
      assert.equal(multiply(unit('65 mi/h'), unit('2 h')).to('mi').toString(), '130 mi');
      assert.equal(multiply(unit('2 L'), unit('1 s^-1')).toString(), '2 L / s');
      assert.equal(multiply(unit('2 m/s'), unit('0.5 s/m')).toString(), '1');
      assert.equal(multiply(unit(math.complex(3,-4), 'N'), unit(math.complex(7,-2), 'm')).toString(), '(13 - 34i) J');
    });

    it('should multiply valueless units correctly', function() {
      assert.equal(multiply(unit('m'), unit('4 m')).toString(), '4 m^2');
      assert.equal(multiply(unit('ft'), unit('4 ft')).format(5), '4 ft^2');
      assert.equal(multiply(unit('65 mi/h'), unit('h')).to('mi').toString(), '65 mi');
      assert.equal(multiply(unit('2 L'), unit('s^-1')).toString(), '2 L / s');
      assert.equal(multiply(unit('m/s'), unit('h/m')).toString(), '(m h) / (s m)');
    });

    // TODO: cleanup once decided to not downgrade BigNumber to number
    it.skip('should multiply a bignumber and a unit correctly', function() {
      assert.equal(multiply(bignumber(2), unit('5 mm')).toString(), '10 mm');
      assert.equal(multiply(bignumber(2), unit('5 mm')).toString(), '10 mm');
      assert.equal(multiply(unit('5 mm'), bignumber(2)).toString(), '10 mm');
      assert.equal(multiply(unit('5 mm'), bignumber(0)).toString(), '0 m');
    });

    // TODO: cleanup once decided to not downgrade BigNumber to number
    it.skip('should multiply a bignumber and a unit without value correctly', function() {
      assert.equal(multiply(bignumber(2), unit('mm')).toString(), '2 mm');
      assert.equal(multiply(bignumber(2), unit('km')).toString(), '2 km');
      assert.equal(multiply(bignumber(2), unit('inch')).toString(), '2 inch');
      assert.equal(multiply(unit('mm'), bignumber(2)).toString(), '2 mm');
      assert.equal(multiply(unit('km'), bignumber(2)).toString(), '2 km');
      assert.equal(multiply(unit('inch'), bignumber(2)).toString(), '2 inch');
    });

    it('should throw an error in case of unit non-numeric argument', function() {
      // Multiplying two units is supported now
      //assert.throws(function () {multiply(math.unit('5cm'), math.unit('4cm'));}, /TypeError: Unexpected type/);
      // Complex units are supported now
      //assert.throws(function () {multiply(math.unit('5cm'), math.complex('2+3i'));}, /TypeError: Unexpected type/);
      //assert.throws(function () {multiply(math.complex('2+3i'), math.unit('5cm'));}, /TypeError: Unexpected type/);
    });


    it('should throw an error if used with strings', function() {
      assert.throws(function () {multiply("hello", "world");});
      assert.throws(function () {multiply("hello", 2);});
    });
  });

  it('should multiply mixed array and matrix', function () {
    var a = [[1, 2], [3, 4]];
    var b = [[2, 0], [0, 2]];

    approx.deepEqual(multiply(a, matrix(b)), matrix([[2, 4], [6, 8]]));
    approx.deepEqual(multiply(matrix(a), b), matrix([[2, 4], [6, 8]]));

    // test with vectors, returning a scalar
    var c = [1, 2, 3];
    var d = [4, 5, 6];

    assert.strictEqual(multiply(c, matrix(d)), 32);
    assert.strictEqual(multiply(matrix(c), d), 32);
  });

  describe('squeeze', function () {
    // math.js v1 and v2 did squeeze output being a vector. Changed in v3

    it ('should NOT squeeze scalar results of matrix * matrix', function () {
      var a = [[1, 2, 3]];
      var b = [[4], [5], [6]];
      assert.deepEqual(multiply(a, b), [[32]]);
    });

    it ('should NOT squeeze scalar results of vector * matrix', function () {
      var a = [1, 2, 3];
      var b = [[4], [5], [6]];
      assert.deepEqual(multiply(a, b), [32]);
    });

    it ('should NOT squeeze scalar results of matrix * vector', function () {
      var a = [[1, 2, 3]];
      var b = [4, 5, 6];
      assert.deepEqual(multiply(a, b), [32]);
    });
  });

  it('should throw an error when multiplying matrices with incompatible sizes', function() {
    // vector * vector
    assert.throws(function () {multiply([1,1], [1,1, 1]);});

    // matrix * matrix
    assert.throws(function () {multiply([[1,1]], [[1,1]]);});
    assert.throws(function () {multiply([[1,1]], [[1,1], [1,1], [1,1]]);});

    // matrix * vector
    assert.throws(function () {multiply([[1,1], [1,1]], [1,1,1]);});

    // vector * matrix
    assert.throws(function () {multiply([1,1,1], [[1,1], [1,1]]);});
  });

  it('should throw an error when multiplying multi dimensional matrices', function() {
    assert.throws(function () {multiply([[[1]]], [1]);});
    assert.throws(function () {multiply([[[1]]], [[1]]);});
    assert.throws(function () {multiply([1], [[[1]]]);});
    assert.throws(function () {multiply([[1]], [[[1]]]);});
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {multiply(1);}, /TypeError: Too few arguments/);
  });

  describe('Vector', function () {

    it('should multiply vectors correctly (dot product)', function () {
      var a = [1, 2, 3];
      var b = [4, 5, 6];

      approx.deepEqual(multiply(a, b), 32);
      approx.deepEqual(multiply(matrix(a), matrix(b)), 32);
    });

    it('should multiply row vector x column vector', function () {
      var v = [[1, 2, 3, 0, 0, 5, 6]];

      var r = multiply(v, [[3], [4], [6], [0], [1], [2], [0]]);
      assert.deepEqual(r, [[39]]);

      r = multiply(v, math.matrix([[3], [4], [6], [0], [1], [2], [0]], 'dense'));
      assert.deepEqual(r, math.matrix([[39]], 'dense'));

      r = multiply(v, math.matrix([[3], [4], [6], [0], [1], [2], [0]], 'sparse'));
      assert.deepEqual(r, math.matrix([[39]], 'sparse'));
    });

    it('should multiply dense row vector x column vector', function () {
      var v = math.matrix([[1, 2, 3, 0, 0, 5, 6]], 'dense');

      var r = multiply(v, [[3], [4], [6], [0], [1], [2], [0]]);
      assert.deepEqual(r, math.matrix([[39]]));

      r = multiply(v, math.matrix([[3], [4], [6], [0], [1], [2], [0]], 'dense'));
      assert.deepEqual(r, math.matrix([[39]]));

      r = multiply(v, math.matrix([[3], [4], [6], [0], [1], [2], [0]], 'sparse'));
      assert.deepEqual(r, math.matrix([[39]], 'sparse'));
    });

    it('should throw an error when multiplying empty vectors', function () {
      assert.throws(function () {multiply([], []);}, /Cannot multiply two empty vectors/);
    });

    it('should multiply a vector with a matrix correctly', function () {
      var a = [1, 2, 3];
      var b = [
        [8, 1, 6],
        [3, 5, 7],
        [4, 9, 2]
      ];

      approx.deepEqual(multiply(a, b), [26, 38, 26]);
      approx.deepEqual(multiply(b, a), [28, 34, 28]);

      approx.deepEqual(multiply(matrix(a), matrix(b)), matrix([26, 38, 26]));
      approx.deepEqual(multiply(matrix(b), matrix(a)), matrix([28, 34, 28]));
    });
  });

  describe('Dense Matrix', function () {

    it('should multiply matrix x scalar', function() {
      var m = math.matrix([
        [2, 0],
        [4, 0]
      ]);

      var r = multiply(m, 3);
      assert.deepEqual(r._size, m._size);
      assert.deepEqual(r._data, [[6, 0], [12, 0]]);

      r = multiply(m, math.complex(3, 3));
      assert.deepEqual(r._size, m._size);
      assert.deepEqual(r._data, [[math.complex(6, 6), math.complex(0, 0)], [math.complex(12, 12), math.complex(0, 0)]]);

      r = multiply(m, math.bignumber(3));
      assert.deepEqual(r._size, m._size);
      assert.deepEqual(r._data, [[math.bignumber(6), math.bignumber(0)], [math.bignumber(12), math.bignumber(0)]]);

      r = multiply(m, true);
      assert.deepEqual(r._size, m._size);
      assert.deepEqual(r._data, [[2, 0], [4, 0]]);

      r = multiply(m, false);
      assert.deepEqual(r._size, m._size);
      assert.deepEqual(r._data, [[0, 0], [0, 0]]);
    });

    it('should multiply matrix x matrix with zeros', function() {
      var m = math.matrix([
        [2, 0],
        [4, 0]
      ]);

      var r = multiply(m, math.matrix([
        [2, 0],
        [4, 0]
      ]));
      assert.deepEqual(
        r.valueOf(),
        [
          [4, 0],
          [8, 0]
        ]);

      r = multiply(m, math.matrix([
        [2, 0],
        [4, 0]
      ], 'sparse'));
      assert.deepEqual(
        r.valueOf(),
        [
          [4, 0],
          [8, 0]
        ]);
    });

    it('should multiply matrix x matrix', function() {
      var m = math.matrix([[1, 2], [3, 4]], 'dense');

      var r = multiply(m, math.matrix([[5, 6], [7, 8]], 'sparse'));
      assert.deepEqual(
        r.valueOf(),
        [
          [19, 22],
          [43, 50]
        ]);

      r = multiply(m, math.matrix([[5, 6], [7, 8]], 'dense'));
      assert.deepEqual(
        r.valueOf(),
        [
          [19, 22],
          [43, 50]
        ]);
    });

    it('should multiply matrix x matrix, number datatype', function() {
      var m1 = math.matrix([[1, 2], [3, 4]], 'dense', 'number');
      var m2 = math.matrix([[5, 6], [7, 8]], 'dense', 'number');

      var r = multiply(m1, m2);
      assert(r.datatype() === 'number');
      assert.deepEqual(
        r.valueOf(),
        [
          [19, 22],
          [43, 50]
        ]);
    });

    it('should multiply matrix x array', function() {
      var m = math.matrix([
        [2, 0],
        [4, 0]
      ]);

      var r = multiply(
        m,
        [
          [2, 0],
          [4, 0]
        ]);
      assert.deepEqual(
        r.valueOf(),
        [
          [4, 0],
          [8, 0]
        ]);

      r = multiply(
        m,
        [
          [2, 0, 1],
          [4, 0, 1]
        ]);
      assert.deepEqual(
        r.valueOf(),
        [
          [4, 0, 2],
          [8, 0, 4]
        ]);
    });

    it('should multiply matrix x vector array', function() {
      var m = math.matrix([
        [2, 0],
        [4, 0]
      ]);

      var r = multiply(
        m,
        [
          [2],
          [4]
        ]);
      assert.deepEqual(
        r.valueOf(),
        [
          [4],
          [8]
        ]);
    });

    it ('should NOT squeeze scalar results of matrix * matrix', function () {
      var a = math.matrix(
        [
          [1, 2, 3]
        ]);
      var b = math.matrix(
        [
          [4], 
          [5], 
          [6]
        ]);
      assert.deepEqual(multiply(a, b), math.matrix([[32]]));
    });

    it ('should NOT squeeze scalar results of matrix * vector', function () {
      var a = math.matrix(
        [
          [1, 2, 3]
        ]);
      var b = [4, 5, 6];
      assert.deepEqual(multiply(a, b), math.matrix([32]));
    });

    it('should throw an error when multiplying matrices with incompatible sizes', function() {
      // vector * vector
      assert.throws(function () {multiply(math.matrix([1,1], 'dense'), [1, 1, 1]);});

      // matrix * matrix
      assert.throws(function () {multiply(math.matrix([[1,1]], 'dense'), [[1,1]]);});
      assert.throws(function () {multiply(math.matrix([[1,1]], 'dense'), [[1,1], [1,1], [1,1]]);});

      // matrix * vector
      assert.throws(function () {multiply(math.matrix([[1,1], [1,1]], 'dense'), [1,1,1]);});

      // vector * matrix
      assert.throws(function () {multiply(math.matrix([1,1,1], 'dense'), [[1,1], [1,1]]);});
    });

    it('should multiply triangular matrices', function () {
      var l = [
        [1, 0, 0, 0],
        [-0.5, 1, 0, 0],  
        [0, -0.7, 1, 0],  
        [0.0666667, -0.4, -0.5714286, 1]
      ];
      var u = [
        [240, -2700, 6480, -4200],
        [0, -150, 540, -420],
        [0, 0, -42, 56],
        [0, 0, 0, 4]
      ];

      var r = multiply(l, u);

      approx.deepEqual(
        r.valueOf(),
        [
          [240, -2700, 6480, -4200],
          [-120, 1200, -2700, 1680],
          [0, 105, -420, 350],
          [16, -120, 240, -140]
        ]);
    });

    var a = matrix([[1,2],[3,4]]);
    var b = matrix([[5,6],[7,8]]);
    var c = matrix([[5],[6]]);
    var d = matrix([[5,6]]);

    it('should perform element-wise multiplication if multiplying a matrix and a number', function() {
      approx.deepEqual(multiply(a, 3), matrix([[3,6],[9,12]]));
      approx.deepEqual(multiply(3, a), matrix([[3,6],[9,12]]));
    });

    it('should perform matrix multiplication', function () {
      approx.deepEqual(multiply(a, b), matrix([[19,22],[43,50]]));
      approx.deepEqual(multiply(a, c), matrix([[17],[39]]));
      approx.deepEqual(multiply(d, a), matrix([[23,34]]));
      approx.deepEqual(multiply(d, b), matrix([[67,78]]));
      approx.deepEqual(multiply(d, c), matrix([[61]]));
      approx.deepEqual(multiply([[1,2],[3,4]], [[5,6],[7,8]]), [[19,22],[43,50]]);
      approx.deepEqual(multiply([1,2,3,4], 2), [2, 4, 6, 8]);
      approx.deepEqual(multiply(matrix([1,2,3,4]), 2), matrix([2, 4, 6, 8]));
    });
  });

  describe('Sparse Matrix', function () {

    it('should multiply matrix x scalar', function() {
      var m = math.matrix([[2, 0], [4, 0]], 'sparse');

      var r = multiply(m, 3);
      assert.deepEqual(r._size, m._size);
      assert.deepEqual(r._values, [6, 12]);
      assert.deepEqual(r._index, m._index);
      assert.deepEqual(r._ptr, m._ptr);

      r = multiply(m, math.complex(3, 3));
      assert.deepEqual(r._size, m._size);
      assert.deepEqual(r._values, [math.complex(6, 6), math.complex(12, 12)]);
      assert.deepEqual(r._index, m._index);
      assert.deepEqual(r._ptr, m._ptr);

      r = multiply(m, math.bignumber(3));
      assert.deepEqual(r._size, m._size);
      assert.deepEqual(r._values, [math.bignumber(6), math.bignumber(12)]);
      assert.deepEqual(r._index, m._index);
      assert.deepEqual(r._ptr, m._ptr);

      r = multiply(m, true);
      assert.deepEqual(r._size, m._size);
      assert.deepEqual(r._values, [2, 4]);
      assert.deepEqual(r._index, m._index);
      assert.deepEqual(r._ptr, m._ptr);

      r = multiply(m, false);
      assert.deepEqual(r._size, m._size);
      assert.deepEqual(r._values, []);
      assert.deepEqual(r._index, []);
      assert.deepEqual(r._ptr, [0, 0, 0]);
    });

    it('should multiply matrix x matrix with zeros', function() {
      var m = math.matrix([[2, 0], [4, 0]], 'sparse');

      var r = multiply(m, math.matrix([[2, 0], [4, 0]], 'sparse'));
      assert.deepEqual(
        r.valueOf(),
        [
          [4, 0],
          [8, 0]
        ]);

      r = multiply(m, math.matrix([[2, 0], [4, 0]], 'dense'));
      assert.deepEqual(
        r.valueOf(),
        [
          [4, 0],
          [8, 0]
        ]);
    });

    it('should multiply matrix x matrix', function() {
      var m = math.matrix([[1, 2], [3, 4]], 'sparse');

      var r = multiply(m, math.matrix([[5, 6], [7, 8]], 'sparse'));
      assert.deepEqual(
        r.valueOf(),
        [
          [19, 22],
          [43, 50]
        ]);

      r = multiply(m, math.matrix([[5, 6], [7, 8]], 'dense'));
      assert.deepEqual(
        r.valueOf(),
        [
          [19, 22],
          [43, 50]
        ]);
    });
    
    it('should multiply matrix x matrix, number datatype', function() {
      var m1 = math.matrix([[1, 2], [3, 4]], 'sparse', 'number');
      var m2 = math.matrix([[5, 6], [7, 8]], 'sparse', 'number');
      
      var r = multiply(m1, m2);
      assert(r.datatype() === 'number');
      assert.deepEqual(
        r.valueOf(),
        [
          [19, 22],
          [43, 50]
        ]);
    });

    it('should multiply matrix x array', function() {
      var m = math.matrix([[2, 0], [4, 0]], 'sparse');

      var r = multiply(m, 
                       [
        [2, 0],
        [4, 0]
      ]);
      assert.deepEqual(
        r.valueOf(),
        [
          [4, 0],
          [8, 0]
        ]);

      r = multiply(m, 
                   [
        [2, 0, 1],
        [4, 0, 1]
      ]);
      assert.deepEqual(
        r.valueOf(),
        [
          [4, 0, 2],
          [8, 0, 4]
        ]);
    });

    it('should multiply matrix x vector array', function() {
      var m = math.matrix([[2, 0], [4, 0]], 'sparse');

      var r = multiply(m, 
                       [
        [2],
        [4]
      ]);
      assert.deepEqual(
        r.valueOf(),
        [
          [4],
          [8]
        ]);
    });

    it ('should NOT squeeze scalar results of matrix * matrix', function () {
      var a = math.matrix([[1, 2, 3]], 'sparse');
      var b = math.matrix([[4], [5], [6]], 'sparse');
      assert.deepEqual(multiply(a, b), math.matrix([[32]], 'sparse'));
    });

    it ('should NOT squeeze scalar results of matrix * vector', function () {
      var a = math.matrix([[1, 2, 3]], 'sparse');
      var b = [4, 5, 6];
      assert.deepEqual(multiply(a, b), math.matrix([32], 'sparse'));
    });

    it('should throw an error when multiplying matrices with incompatible sizes', function() {
      // vector * vector
      assert.throws(function () {math.matrix([1,1], 'sparse').multiply([1, 1, 1]);});

      // matrix * matrix
      assert.throws(function () {math.matrix([[1,1]], 'sparse').multiply([[1,1]]);});
      assert.throws(function () {math.matrix([[1,1]], 'sparse').multiply([[1,1], [1,1], [1,1]]);});

      // matrix * vector
      assert.throws(function () {math.matrix([[1,1], [1,1]], 'sparse').multiply([1,1,1]);});

      // vector * matrix
      assert.throws(function () {math.matrix([1,1,1], 'sparse').multiply([[1,1], [1,1]]);});
    });

    it('should multiply triangular matrices', function () {
      var l = math.matrix([
        [1, 0, 0, 0],
        [-0.5, 1, 0, 0],  
        [0, -0.7, 1, 0],  
        [0.0666667, -0.4, -0.5714286, 1]
      ], 'sparse');
      var u = math.matrix([
        [240, -2700, 6480, -4200],
        [0, -150, 540, -420],
        [0, 0, -42, 56],
        [0, 0, 0, 4]
      ], 'sparse');

      var r = multiply(l, u);
      
      assert(r.storage(), 'sparse');
      approx.deepEqual(
        r.valueOf(),
        [
          [240, -2700, 6480, -4200],
          [-120, 1200, -2700, 1680],
          [0, 105, -420, 350],
          [16, -120, 240, -140]
        ]);
    });

    var a = matrix([[1,2],[3,4]], 'sparse');
    var b = matrix([[5,6],[7,8]], 'sparse');
    var c = matrix([[5],[6]], 'sparse');
    var d = matrix([[5,6]], 'sparse');

    it('should perform element-wise multiplication if multiplying a matrix and a number', function() {
      approx.deepEqual(multiply(a, 3), matrix([[3,6],[9,12]], 'sparse'));
      approx.deepEqual(multiply(3, a), matrix([[3,6],[9,12]], 'sparse'));
    });

    it('should perform matrix multiplication', function () {
      approx.deepEqual(multiply(a, b), matrix([[19,22],[43,50]], 'sparse'));
      approx.deepEqual(multiply(a, c), matrix([[17],[39]], 'sparse'));
      approx.deepEqual(multiply(d, a), matrix([[23,34]], 'sparse'));
      approx.deepEqual(multiply(d, b), matrix([[67,78]], 'sparse'));
      approx.deepEqual(multiply(d, c), matrix([[61]], 'sparse'));
    });
    
    it('should multiply two pattern matrices correctly', function() {

      var a = new math.type.SparseMatrix({
        values: undefined,
        index: [0, 1, 2, 0],
        ptr: [0, 2, 3, 4],
        size: [3, 3]
      });

      var b = new math.type.SparseMatrix({
        values: undefined,
        index: [0, 1, 2, 1],
        ptr: [0, 3, 3, 4],
        size: [3, 3]
      });

      var c = multiply(a, b);

      assert.deepEqual(
        c.valueOf(),
        [
          [1, 0, 0],
          [1, 0, 0],
          [1, 0, 1]
        ]);
    });

    it('should multiply pattern and value matrices correctly', function() {

      var a = new math.type.SparseMatrix({
        values: undefined,
        index: [0, 1, 2, 0],
        ptr: [0, 2, 3, 4],
        size: [3, 3]
      });

      var b = new math.type.SparseMatrix({
        values: [1, 2, 3, 4],
        index: [0, 1, 2, 1],
        ptr: [0, 3, 3, 4],
        size: [3, 3]
      });

      var c = multiply(a, b);

      assert.deepEqual(
        c.valueOf(),
        [
          [1, 0, 0],
          [1, 0, 0],
          [1, 0, 1]
        ]);
    });

    it('should multiply value and pattern matrices correctly', function() {

      var a = new math.type.SparseMatrix({
        values: [1, 2, 3, 4],
        index: [0, 1, 2, 0],
        ptr: [0, 2, 3, 4],
        size: [3, 3]
      });

      var b = new math.type.SparseMatrix({
        values: undefined,
        index: [0, 1, 2, 1],
        ptr: [0, 3, 3, 4],
        size: [3, 3]
      });

      var c = multiply(a, b);

      assert.deepEqual(
        c.valueOf(),
        [
          [1, 0, 0],
          [1, 0, 0],
          [1, 0, 1]
        ]);
    });
  });

  describe('Matrix Market', function () {

    it('should multiply matrix x matrix 1220 x 1220, Matrix Market, sparse x sparse', function (done) {
      // import matrix
      market.import('tools/matrices/fpga_dcop_01.tar.gz', ['fpga_dcop_01/fpga_dcop_01.mtx'])
        .then(function (matrices) {
          // matrix
          var m = matrices[0];
          // multiply matrices, used to compare performance in different implementations
          math.multiply(m, m);
          // indicate test has completed
          done();
        })
        .fail(function (error) {
          // indicate test has completed
          done(error);
        });
    });
  });


  describe ('multiple arguments', function () {

    it ('should multiply more than two arguments', function () {
      assert.deepEqual(multiply(2, 3, 4), 24);
      assert.deepEqual(multiply(2, 3, [5,6]), [30,36]);

      assert.deepEqual(multiply([[2,2],[2,2]], [[3,3],[3,3]], [[4,4],[4,4]]), [[96,96],[96,96]]);
      assert.deepEqual(multiply([[2,2],[2,2]], [[3,3],[3,3]], 4), [[48,48],[48,48]]);
      assert.deepEqual(multiply([[2,2],[2,2]], 3, 4), [[24,24],[24,24]]);

      assert.deepEqual(multiply(math.matrix([[2,2],[2,2]]), math.matrix([[3,3],[3,3]]), math.matrix([[4,4],[4,4]])), math.matrix([[96,96],[96,96]]));
      assert.deepEqual(multiply(math.matrix([[2,2],[2,2]]), math.matrix([[3,3],[3,3]]), 4), math.matrix([[48,48],[48,48]]));
      assert.deepEqual(multiply(math.matrix([[2,2],[2,2]]), 3, 4), math.matrix([[24,24],[24,24]]));
    });

  });

  it('should LaTeX multiply', function () {
    var expression = math.parse('multiply(2,3)');
    assert.equal(expression.toTex(), '\\left(2\\cdot3\\right)');
  });
});
