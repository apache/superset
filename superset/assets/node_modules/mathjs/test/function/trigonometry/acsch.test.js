var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    approx = require('../../../tools/approx'),
    pi = math.pi,
    acsch = math.acsch,
    csch = math.csch,
    complex = math.complex,
    matrix = math.matrix,
    unit = math.unit,
    bigmath = math.create({number: 'BigNumber', precision: 20}),
    acschBig = bigmath.acsch,
    Big = bigmath.bignumber;

describe('acsch', function() {
  it('should return the hyperbolic arccsc of a boolean', function () {
    approx.equal(acsch(true), 0.8813735870195430);
    assert.equal(acsch(false), Infinity);
  });

  it('should return the hyperbolic arccsc of null', function () {
    assert.equal(acsch(null), Infinity);
  });

  it('should return the hyperbolic arccsc of a number', function() {
    approx.equal(acsch(-2), -0.48121182505960344749775891342437);
    approx.equal(acsch(-1), -0.88137358701954302523260932497979);
    assert.equal(acsch(0), Infinity);
    approx.equal(acsch(1), 0.88137358701954302523260932497979);
    approx.equal(acsch(2), 0.48121182505960344749775891342437);
    approx.equal(acsch(pi), 0.3131658804508683758718693082657);
  });

  it('should return the hyperbolic arccsc of a bignumber', function() {
    var arg = Big(-2);
    assert.deepEqual(acschBig(arg), Big('-0.4812118250596034475'));
    assert.deepEqual(acschBig(Big(-1)), Big('-0.88137358701954302523'));
    assert.deepEqual(acschBig(Big(0)).toString(), 'Infinity');
    assert.deepEqual(acschBig(Big(1)), Big('0.88137358701954302523'));
    assert.deepEqual(acschBig(Big(2)), Big('0.4812118250596034475'));
    assert.deepEqual(acschBig(bigmath.pi).toString(), '0.31316588045086837586');

    //Make sure arg was not changed
    assert.deepEqual(arg, Big(-2));
  });

  it('should be the inverse function of hyperbolic csc', function() {
    approx.equal(acsch(csch(-1)), -1);
    approx.equal(acsch(csch(0)), 0);
    approx.equal(acsch(csch(0.1)), 0.1);
    approx.equal(acsch(csch(0.5)), 0.5);
    approx.equal(acsch(csch(2)), 2);
  });

  it('should be the inverse function of bignumber csch', function() {
    assert.deepEqual(acschBig(bigmath.csch(Big(-2))), Big(-2));
    assert.deepEqual(acschBig(bigmath.csch(Big(-0.5))), Big(-0.5));
    assert.deepEqual(acschBig(bigmath.csch(Big(-0.1))), Big('-0.099999999999999999996'));
    assert.deepEqual(acschBig(bigmath.csch(Big(0))), Big(0));
    assert.deepEqual(acschBig(bigmath.csch(Big(0.1))), Big('0.099999999999999999996'));
    assert.deepEqual(acschBig(bigmath.csch(Big(0.5))), Big(0.5));
    assert.deepEqual(acschBig(bigmath.csch(Big(2))), Big(2));
  });

  it('should return the arccsch of a complex number', function() {
    approx.deepEqual(acsch(complex('2+3i')), complex(0.157355498844985, -0.229962902377208));
    approx.deepEqual(acsch(complex('2-3i')), complex(0.157355498844985, 0.229962902377208));
    approx.deepEqual(acsch(complex('-2+3i')), complex(-0.157355498844985, -0.229962902377208));
    approx.deepEqual(acsch(complex('-2-3i')), complex(-0.157355498844985, 0.229962902377208));
    approx.deepEqual(acsch(complex('1+i')), complex(0.530637530952517826, -0.45227844715119068));
    approx.deepEqual(acsch(complex('i')), complex(0, -pi / 2));
    approx.deepEqual(acsch(complex('1')), complex(0.881373587019543025, 0));
    assert.deepEqual(acsch(complex('0')), complex(Infinity, 0));
  });

  it('should throw an error if called with a unit', function() {
    assert.throws(function () {acsch(unit('45deg'))});
    assert.throws(function () {acsch(unit('5 celsius'))});
  });

  it('should throw an error if called with a string', function() {
    assert.throws(function () {acsch('string')});
  });

  it('should calculate the arccsc element-wise for arrays and matrices', function() {
    var acsch123 = [0.881373587019543025, 0.481211825059603447, 0.32745015023725844];
    approx.deepEqual(acsch([1,2,3]), acsch123);
    approx.deepEqual(acsch(matrix([1,2,3])), matrix(acsch123));
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {acsch()}, /TypeError: Too few arguments/);
    assert.throws(function () {acsch(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX acsch', function () {
    var expression = math.parse('acsch(2)');
    assert.equal(expression.toTex(), '\\mathrm{csch}^{-1}\\left(2\\right)');
  });

});
