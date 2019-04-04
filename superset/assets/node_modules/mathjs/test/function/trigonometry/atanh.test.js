var assert = require('assert');
var error = require('../../../lib/error/index');
var math = require('../../../index');
var approx = require('../../../tools/approx');
var pi = math.pi;
var atanh = math.atanh;
var tanh = math.tanh;
var complex = math.complex;
var matrix = math.matrix;
var unit = math.unit;
var bigmath = math.create({number: 'BigNumber', precision: 20});
var biggermath = math.create({precision: 21});
var predmath = math.create({predictable: true});
var atanhBig = bigmath.atanh;
var Big = bigmath.bignumber;

describe('atanh', function() {
  it('should return the hyperbolic arctan of a boolean', function () {
    assert.equal(atanh(true), Infinity);
    assert.equal(atanh(false), 0);
  });

  it('should return the hyperbolic arctan of null', function () {
    assert.equal(atanh(null), 0);
  });

  it('should return the hyperbolic arctan of a number', function() {
    approx.deepEqual(atanh(-2), complex(-0.54930614433405485, pi / 2));
    approx.deepEqual(atanh(2),  complex(0.54930614433405485, -pi / 2));
    //assert.ok(isNaN(atanh(-2)));
    //assert.ok(isNaN(atanh(2)));

    approx.equal(atanh(-1), -Infinity);
    approx.equal(atanh(-0.5), -0.54930614433405484569762261846);
    approx.equal(atanh(0), 0);
    approx.equal(atanh(0.5), 0.54930614433405484569762261846);
    approx.equal(atanh(1), Infinity);
  });


  it('should return the hyperbolic arctan of a number when predictable:true', function() {
    assert.equal(typeof predmath.atanh(-2), 'number');
    assert(isNaN(predmath.atanh(-2)));
  });

  it('should return the hyperbolic arctan of a bignumber', function() {
    var arg1 = Big(-1);
    var arg2 = Big(-0.5);
    assert.deepEqual(atanhBig(arg1).toString(), '-Infinity');
    assert.deepEqual(atanhBig(arg2), Big('-0.5493061443340548457')); 
    assert.deepEqual(atanhBig(Big(0)), Big(0));
    assert.deepEqual(atanhBig(Big(0.5)), Big('0.5493061443340548457')); 
    assert.deepEqual(atanhBig(Big(1)).toString(), 'Infinity');

    //Make sure arg was not changed
    assert.deepEqual(arg1, Big(-1));
    assert.deepEqual(arg2, Big(-0.5));
  });

  it('should be the inverse function of hyperbolic tan', function() {
    approx.equal(atanh(tanh(-1)), -1);
    approx.equal(atanh(tanh(0)), 0);
    approx.equal(atanh(tanh(0.1)), 0.1);
    approx.equal(atanh(tanh(0.5)), 0.5);
  });

  it('should be the inverse function of bignumber tanh', function() {
    assert.deepEqual(atanhBig(bigmath.tanh(Big(-0.5))), Big(-0.5));
    assert.deepEqual(atanhBig(bigmath.tanh(Big(0))), Big(0));
    assert.deepEqual(atanhBig(bigmath.tanh(Big(0.5))), Big(0.5));

    /* Pass in more digits to pi. */
    var arg = Big(-1);
    assert.deepEqual(atanhBig(biggermath.tanh(arg)), Big(-1));
    assert.deepEqual(atanhBig(biggermath.tanh(Big(0.1))), Big(0.1));
    assert.deepEqual(arg, Big(-1));

    assert.ok(atanh(Big(1.1)).isNaN());
  });

  it('should return the arctanh of a complex number', function() {
    approx.deepEqual(atanh(complex('2+3i')), complex(0.1469466662255, 1.33897252229449));
    approx.deepEqual(atanh(complex('2-3i')), complex(0.1469466662255, -1.33897252229449));
    approx.deepEqual(atanh(complex('-2+3i')), complex(-0.1469466662255, 1.33897252229449));
    approx.deepEqual(atanh(complex('-2-3i')), complex(-0.1469466662255, -1.33897252229449));
    approx.deepEqual(atanh(complex('1+i')), complex(0.402359478108525, 1.01722196789785137));
    approx.deepEqual(atanh(complex('i')), complex(0, pi / 4));

    approx.deepEqual(atanh(complex('2')), complex(0.54930614433405485, -pi / 2));
    assert.deepEqual(atanh(complex('1')), complex(Infinity, 0));
    assert.deepEqual(atanh(complex('0')), complex(0, 0));
    approx.deepEqual(atanh(complex('-2')), complex(-0.54930614433405485, pi / 2));
  });

  it('should throw an error if called with a unit', function() {
    assert.throws(function () {atanh(unit('45deg'))});
    assert.throws(function () {atanh(unit('5 celsius'))});
  });

  it('should throw an error if called with a string', function() {
    assert.throws(function () {atanh('string')});
  });

  it('should calculate the arctan element-wise for arrays and matrices', function() {
    var atanh101 = [-Infinity, 0, Infinity];
    assert.deepEqual(atanh([-1,0,1]), atanh101);
    assert.deepEqual(atanh(matrix([-1,0,1])), matrix(atanh101));
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {atanh()}, /TypeError: Too few arguments/);
    assert.throws(function () {atanh(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX atanh', function () {
    var expression = math.parse('atanh(0.5)');
    assert.equal(expression.toTex(), '\\tanh^{-1}\\left(0.5\\right)');
  });

});
