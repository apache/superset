// test sign
var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var bignumber = math.bignumber;
var fraction = math.fraction;
var complex = math.complex;

describe('sign', function() {
  it('should calculate the sign of a boolean', function () {
    assert.equal(math.sign(true), 1);
    assert.equal(math.sign(false), 0);
  });

  it('should calculate the sign of null', function () {
    assert.equal(math.sign(null), 0);
  });

  it('should calculate the sign of a number', function() {
    assert.equal(math.sign(3), 1);
    assert.equal(math.sign(-3), -1);
    assert.equal(math.sign(0), 0);
  });

  it('should calculate the sign of a big number', function() {
    assert.deepEqual(math.sign(bignumber(3)), bignumber(1));
    assert.deepEqual(math.sign(bignumber(-3)), bignumber(-1));
    assert.deepEqual(math.sign(bignumber(0)), bignumber(0));
  });

  it('should calculate the sign of a fraction', function() {
    var a = fraction(0.5);
    assert(math.sign(a) instanceof math.type.Fraction);
    assert.equal(math.sign(a).toString(), '1');
    assert.equal(math.sign(fraction(-0.5)).toString(), '-1');
    assert.equal(a.toString(), '0.5');
  });

  it('should calculate the sign of a complex value', function() {
    approx.deepEqual(math.sign(math.complex(2,-3)), math.complex(0.554700196225229, -0.832050294337844));
  });

  it('should calculate the sign of a unit', function() {
    assert.equal(math.sign(math.unit('5 cm')), 1);
    assert.equal(math.sign(math.unit('-5 kg')), -1);
    assert.equal(math.sign(math.unit('0 mol/s')), 0);
    assert.equal(math.sign(math.unit('-283.15 degC')), -1);
    assert.equal(math.sign(math.unit('-273.15 degC')), 0);
    assert.equal(math.sign(math.unit('-263.15 degC')), 1);

    assert.deepEqual(math.sign(math.unit(bignumber(5), 'cm')), bignumber(1));
    assert.deepEqual(math.sign(math.unit(bignumber(-5), 'cm')), bignumber(-1));
    assert.deepEqual(math.sign(math.unit(fraction(5), 'cm')), fraction(1));
    assert.deepEqual(math.sign(math.unit(fraction(-5), 'cm')), fraction(-1));

    assert.deepEqual(math.sign(math.unit(complex(3,4), 'mi')), complex(0.6,0.8));
  });

  it('should throw an error when used with a string', function() {
    assert.throws(function () { math.sign("hello world"); });
  });

  it('should return a matrix of the signs of each elements in the given array', function() {
    assert.deepEqual(math.sign([-2,-1,0,1,2]), [-1,-1,0,1,1]);
  });

  it('should return a matrix of the signs of each elements in the given matrix', function() {
    assert.deepEqual(math.sign(math.matrix([-2,-1,0,1,2])), math.matrix([-1,-1,0,1,1]));
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {math.sign()}, /TypeError: Too few arguments/);
    assert.throws(function () {math.sign(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX sign', function () {
    var expression = math.parse('sign(-4)');
    assert.equal(expression.toTex(), '\\mathrm{sign}\\left(-4\\right)');
  });

});
