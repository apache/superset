// test nthRoot
var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var matrix = math.matrix;
var sparse = math.sparse;
var unit = math.unit;
var nthRoot = math.nthRoot;
var big = math.bignumber;
var complex = math.complex;


describe('nthRoot', function() {

  it('should return the nthRoot of a boolean value', function () {
    assert.equal(nthRoot(true), 1);
    assert.equal(nthRoot(false), 0);
    assert.equal(nthRoot(1,true), 1);
  });

  it('should return the nthRoot of null', function () {
    assert.equal(nthRoot(null), 0);
  });

  it('should return the nthRoot for numbers', function() {
    approx.equal(nthRoot(4), 2);
    approx.equal(nthRoot(9), 3);
    approx.equal(nthRoot(8, 3), 2);
    approx.equal(nthRoot(64, 3), 4);
    approx.equal(nthRoot(2, 2.5), 1.31950791077289);
    approx.equal(nthRoot(2.5, 2), 1.58113883008419);
    approx.equal(nthRoot(0.1+0.2), 0.5477225575051662); // a value containing a round-off error
    approx.equal(nthRoot(0, 3), 0);
    approx.equal(nthRoot(0, 2), 0);
    approx.equal(nthRoot(0.0001, 3), 0.0464158883361278);
  });

  it('should return the nthRoot for very large numbers', function() {
    approx.equal(nthRoot(2e150 * 2e150), 2e150);
    approx.equal(nthRoot(Math.pow(2, 1000)), 3.273390607896142e+150);
  });

  it('should return the nthRoot for small large numbers', function() {
    approx.equal(nthRoot(4e-300), 2e-150);
  });

  it('should return the nthRoot for negative numbers', function() {
    approx.equal(nthRoot(-64, 3), -4);
    approx.equal(nthRoot(-8, 3), -2);
    // Newton's method fails in this particular case: --ericman314
    approx.equal(nthRoot(-2, 3), -1.2599210498949);
  });

  it('should return the nthRoot for negative roots', function() {
    approx.equal(nthRoot(64, -3), 0.25);
    approx.equal(nthRoot(-64, -3), -0.25);
  });

  it('should return the nthRoot for zero', function() {
    assert.equal(nthRoot(0, 2), 0);
    assert.equal(nthRoot(0, -2), Infinity);
  });

  it('should return the nthRoot for infinity', function() {
    approx.equal(nthRoot(Infinity, 2), Infinity);
    approx.equal(nthRoot(-Infinity, 3), -Infinity);
    approx.equal(nthRoot(Infinity, -3), 0);
  });

  it('should throw an error when n is zero', function() {
    assert.throws(function () {nthRoot(4, 0);}, /Root must be non-zero/);
  });

  it('should throw an error when value is negative and root is even', function() {
    assert.throws(function () {nthRoot(-27, 2);}, /Root must be odd when a is negative/);
    assert.throws(function () {nthRoot(-27, 2.5);}, /Root must be odd when a is negative/);
  });

  it('should throw an error if invalid number of arguments', function() {
    assert.throws(function () {nthRoot();}, /TypeError: Too few arguments/);
    assert.throws(function () {nthRoot(1, 2, 3);}, /TypeError: Too many arguments/);
  });

  it('should return the nthRoot of bignumbers', function() {
    assert.deepEqual(nthRoot(big(4)), big(2));
    assert.deepEqual(nthRoot(big(9)), big(3));
    assert.deepEqual(nthRoot(big(8), big(3)), big(2));
    assert.deepEqual(nthRoot(big(64), big(3)), big(4));
  });

  it('should return the nthRoot of negative bignumber values', function() {
    assert.deepEqual(nthRoot(big(-2), big(3)), big('-1.259921049894873164767210607278228350570251464701507980081975112'));
    assert.deepEqual(nthRoot(big(-64), big(3)), big(-4));
  });

  it('should return the nthRoot of negative bignumber roots', function() {
    assert.deepEqual(nthRoot(big(64), big(-3)), big(0.25));
    assert.deepEqual(nthRoot(big(-64), big(3)), big(-4));
    assert.deepEqual(nthRoot(big(-64), big(-3)), big(-0.25));
  });

  it('should return the nthRoot for bignumber zero', function() {
    assert.deepEqual(nthRoot(big(0), big(2)).toString(), '0');
    assert.deepEqual(nthRoot(big(0), big(-2)).toString(), 'Infinity');
  });

  it('should return the nthRoot for bignumber infinity', function() {
    assert.deepEqual(nthRoot(big(Infinity), big(2)).toString(), 'Infinity');
    assert.deepEqual(nthRoot(big(-Infinity), big(3)).toString(), '-Infinity');
    assert.deepEqual(nthRoot(big(Infinity), big(-3)), big(0));
  });

  it('should return an array of Complex Roots in Polar form', function() {
    var roots = nthRoot(complex("-1"), 6);
    var roots1 = [
      {r: 1, phi: Math.PI/6},
      {r: 1, phi: Math.PI/2},
      {r: 1, phi: (5 * Math.PI)/6},
      {r: 1, phi: (7 * Math.PI)/6},
      {r: 1, phi: (9 * Math.PI)/6},
      {r: 1, phi: (11 * Math.PI)/6}
    ];

    roots.forEach(function (value, index, array) {
      assert.equal(value.r, roots1[index].r);
      assert.equal(value.phi, roots1[index].phi);
    });
  });

  it('should throw an error when used with a complex number and root is less than 0', function() {
    assert.throws(function () {nthRoot(complex("-1"), -1);});
  });

  it('should throw an error when used with a complex number and root is not an integer', function() {
    assert.throws(function() {nthRoot(complex("-1 + 2i"), 0.5);});
  });

  it('should throw an error when used on a unit', function() {
    assert.throws(function () {nthRoot(unit('5cm'));});
  });

  it('should throw an error when used on a string', function() {
    assert.throws(function () {nthRoot('text');});
  });

  describe('Array', function () {
    
    it('should return the nthRoot for array - scalar', function () {
      approx.deepEqual(nthRoot([8, 27,  64], 3), [2, 3, 4]);
      approx.deepEqual(nthRoot(64, [2, 3, 8]), [8, 4, 1.6817928305074290860622509524664]);
    });
    
    it('should return the nthRoot for array - array', function () {
      approx.deepEqual(nthRoot([[64, 3125], [0, -1]], [[3, 5], [1, 3]]), [[4, 5], [0, -1]]);
    });
    
    it('should return the nthRoot for array - dense matrix', function () {
      approx.deepEqual(nthRoot([[64, 3125], [0, -1]], matrix([[3, 5], [1, 3]])), matrix([[4, 5], [0, -1]]));
    });
    
    it('should return the nthRoot for array - sparse matrix', function () {
      approx.deepEqual(nthRoot([[64, 3125], [0, -1]], sparse([[3, 5], [1, 3]])), matrix([[4, 5], [0, -1]]));
    });
  });
  
  describe('DenseMatrix', function () {

    it('should return the nthRoot for dense matrix - scalar', function () {
      approx.deepEqual(nthRoot(matrix([8, 27,  64]), 3), matrix([2, 3, 4]));
      approx.deepEqual(nthRoot(64, matrix([2, 3, 8])), matrix([8, 4, 1.6817928305074290860622509524664]));
    });

    it('should return the nthRoot for dense matrix - array', function () {
      approx.deepEqual(nthRoot(matrix([[64, 3125], [0, -1]]), [[3, 5], [1, 3]]), matrix([[4, 5], [0, -1]]));
    });

    it('should return the nthRoot for dense matrix - dense matrix', function () {
      approx.deepEqual(nthRoot(matrix([[64, 3125], [0, -1]]), matrix([[3, 5], [1, 3]])), matrix([[4, 5], [0, -1]]));
    });

    it('should return the nthRoot for dense matrix - sparse matrix', function () {
      approx.deepEqual(nthRoot(matrix([[64, 3125], [0, -1]]), sparse([[3, 5], [1, 3]])), matrix([[4, 5], [0, -1]]));
    });
  });

  describe('SparseMatrix', function () {

    it('should return the nthRoot for sparse matrix - scalar', function () {
      approx.deepEqual(nthRoot(sparse([[8, 27], [0, 64]]), 3), sparse([[2, 3], [0, 4]]));
      approx.deepEqual(nthRoot(64, sparse([[2, 3], [1, 8]])), sparse([[8, 4], [64, 1.6817928305074290860622509524664]]));
    });

    it('should return the nthRoot for sparse matrix - array', function () {
      approx.deepEqual(nthRoot(sparse([[64, 3125], [0, -1]]), [[3, 5], [1, 3]]), sparse([[4, 5], [0, -1]]));
    });

    it('should return the nthRoot for sparse matrix - dense matrix', function () {
      approx.deepEqual(nthRoot(sparse([[64, 3125], [0, -1]]), matrix([[3, 5], [1, 3]])), sparse([[4, 5], [0, -1]]));
    });

    it('should return the nthRoot for sparse matrix - sparse matrix', function () {
      approx.deepEqual(nthRoot(sparse([[64, 3125], [0, -1]]), sparse([[3, 5], [1, 3]])), sparse([[4, 5], [0, -1]]));
    });
  });

  it('should LaTeX nthRoot', function () {
    var expression = math.parse('nthRoot(8,3)');
    assert.equal(expression.toTex(), '\\sqrt[3]{8}');
  });
});
