// test unary minus
var assert = require('assert');
var math = require('../../../index');
var bignumber = math.bignumber;
var fraction = math.fraction;
var complex = math.complex;

describe('unaryMinus', function() {
  it('should return unary minus of a boolean', function () {
    assert.equal(math.unaryMinus(true), -1);
    assert.equal(math.unaryMinus(false), 0);
  });

  // TODO: unary minus should return bignumber on boolean input when configured for bignumber
  it.skip('should return bignumber unary minus of a boolean', function () {
    var bigmath = math.create({number: 'BigNumber'});
    assert.deepEqual(bigmath.unaryMinus(true), bigmath.bignumber(-1));
    assert.deepEqual(bigmath.unaryMinus(false), bigmath.bignumber(0));
  });

  it('should return unary minus of null', function () {
    assert.equal(math.unaryMinus(null), 0);
  });

  it('should perform unary minus of a number', function() {
    assert.deepEqual(math.unaryMinus(2), -2);
    assert.deepEqual(math.unaryMinus(-2), 2);
    assert.deepEqual(math.unaryMinus(0), 0);
  });

  it('should perform unary minus of a big number', function() {
    assert.deepEqual(math.unaryMinus(bignumber(2)), bignumber(-2));
    assert.deepEqual(math.unaryMinus(bignumber(-2)), bignumber(2));
    assert.deepEqual(math.unaryMinus(bignumber(0)).toString(), '0');
  });

  it('should perform unary minus of a fraction', function() {
    var a = fraction(0.5);
    assert(math.unaryMinus(a) instanceof math.type.Fraction);
    assert.equal(a.toString(), '0.5');

    assert.equal(math.unaryMinus(fraction(0.5)).toString(), '-0.5');
    assert.equal(math.unaryMinus(fraction(-0.5)).toString(), '0.5');
  });

  it('should perform unary minus of a complex number', function() {
    assert.equal(math.unaryMinus(math.complex(3, 2)), '-3 - 2i');
    assert.equal(math.unaryMinus(math.complex(3, -2)), '-3 + 2i');
    assert.equal(math.unaryMinus(math.complex(-3, 2)), '3 - 2i');
    assert.equal(math.unaryMinus(math.complex(-3, -2)), '3 + 2i');
  });

  it('should perform unary minus of a unit', function() {
    assert.equal(math.unaryMinus(math.unit(5, 'km')).toString(), '-5 km');
    assert.equal(math.unaryMinus(math.unit(fraction(2/3), 'km')).toString(), '-2/3 km');
    assert.equal(math.unaryMinus(math.unit(complex(2,-4), 'gal')).toString(), '(-2 + 4i) gal');
  });

  it('should perform element-wise unary minus on a matrix', function() {
    a2 = math.matrix([[1,2],[3,4]]);
    var a7 = math.unaryMinus(a2);
    assert.ok(a7 instanceof math.type.Matrix);
    assert.deepEqual(a7.size(), [2,2]);
    assert.deepEqual(a7.valueOf(), [[-1,-2],[-3,-4]]);
    assert.deepEqual(math.unaryMinus([[1,2],[3,4]]), [[-1,-2],[-3,-4]]);
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {math.unaryMinus()}, /TypeError: Too few arguments/);
    assert.throws(function () {math.unaryMinus(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should throw an error in case of invalid type of argument', function() {
    assert.throws(function () {math.unaryMinus(new Date())}, /TypeError: Unexpected type of argument/);
  });

  it('should LaTeX unaryMinus', function () {
    var expression = math.parse('unaryMinus(1)');
    assert.equal(expression.toTex(), '-\\left(1\\right)');
  });

});
