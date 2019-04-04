// test unary plus
var assert = require('assert');
var math = require('../../../index');
var error = require('../../../lib/error/index');
var bignumber = math.bignumber;
var fraction = math.fraction;

describe('unaryPlus', function() {
  it('should return unary plus of a boolean', function () {
    assert.equal(math.unaryPlus(true), 1);
    assert.equal(math.unaryPlus(false), 0);
  });

  it('should return unary plus of null', function () {
    assert.equal(math.unaryPlus(null), 0);
  });

  it.skip('should return bignumber unary plus of a boolean', function () {
    var bigmath = math.create({number: 'BigNumber'});
    assert.deepEqual(bigmath.unaryPlus(true), bigmath.bignumber(1));
    assert.deepEqual(bigmath.unaryPlus(false), bigmath.bignumber(0));
  });

  // TODO: this is temporary until the test above works again
  it('should return bignumber unary plus of a boolean', function () {
    var bigmath = math.create({number: 'BigNumber'});
    var a = bigmath.unaryPlus(true);
    assert(a instanceof math.type.BigNumber);
    assert.deepEqual(a.toString(), '1');

    var b = bigmath.unaryPlus(false);
    assert(b instanceof math.type.BigNumber);
    assert.deepEqual(b.toString(), '0');
  });

  it('should return unary plus on a string', function() {
    assert.equal(math.unaryPlus('2'), 2);
    assert.equal(math.unaryPlus('-2'), -2);
  });

  it.skip('should return bignumber unary plus on a string', function() {
    var bigmath = math.create({number: 'BigNumber'});
    assert.deepEqual(bigmath.unaryPlus('2'), bigmath.bignumber(2));
    assert.deepEqual(bigmath.unaryPlus('-2'), bigmath.bignumber(-2));
  });

  // TODO: this is temporary until the test above works again
  it('should return bignumber unary plus on a string', function() {
    var bigmath = math.create({number: 'BigNumber'});
    var a = bigmath.unaryPlus('2');
    assert(a instanceof math.type.BigNumber);
    assert.deepEqual(a.toString(), '2');

    var b = bigmath.unaryPlus('-2');
    assert(b instanceof math.type.BigNumber);
    assert.deepEqual(b.toString(), '-2');
  });

  it('should perform unary plus of a number', function() {
    assert.deepEqual(math.unaryPlus(2), 2);
    assert.deepEqual(math.unaryPlus(-2), -2);
    assert.deepEqual(math.unaryPlus(0), 0);
  });

  it('should perform unary plus of a big number', function() {
    assert.deepEqual(math.unaryPlus(bignumber(2)), bignumber(2));
    assert.deepEqual(math.unaryPlus(bignumber(-2)), bignumber(-2));
    assert.deepEqual(math.unaryPlus(bignumber(0)).valueOf(), bignumber(0).valueOf());
  });

  it('should perform unary plus of a fraction', function() {
    var a = fraction(0.5);
    assert(math.unaryPlus(a) instanceof math.type.Fraction);
    assert.equal(a.toString(), '0.5');

    assert.equal(math.unaryPlus(fraction(0.5)).toString(), '0.5');
    assert.equal(math.unaryPlus(fraction(-0.5)).toString(), '-0.5');
  });

  it('should perform unary plus of a complex number', function() {
    assert.equal(math.unaryPlus(math.complex(3, 2)), '3 + 2i');
    assert.equal(math.unaryPlus(math.complex(3, -2)), '3 - 2i');
    assert.equal(math.unaryPlus(math.complex(-3, 2)), '-3 + 2i');
    assert.equal(math.unaryPlus(math.complex(-3, -2)), '-3 - 2i');
  });

  it('should perform unary plus of a unit', function() {
    assert.equal(math.unaryPlus(math.unit(5, 'km')).toString(), '5 km');
  });

  it('should perform element-wise unary plus on a matrix', function() {
    a2 = math.matrix([[1,2],[3,4]]);
    var a7 = math.unaryPlus(a2);
    assert.ok(a7 instanceof math.type.Matrix);
    assert.deepEqual(a7.size(), [2,2]);
    assert.deepEqual(a7.valueOf(), [[1,2],[3,4]]);
    assert.deepEqual(math.unaryPlus([[1,2],[3,4]]), [[1,2],[3,4]]);
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {math.unaryPlus()}, /TypeError: Too few arguments/);
    assert.throws(function () {math.unaryPlus(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should throw an error in case of invalid type of argument', function() {
    assert.throws(function () {math.unaryPlus(new Date())}, /TypeError: Unexpected type of argument/);
  });

  it('should LaTeX unaryPlus', function () {
    var expression = math.parse('unaryPlus(1)');
    assert.equal(expression.toTex(), '+\\left(1\\right)');
  });

});
