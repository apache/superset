var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    approx = require('../../../tools/approx'),
    pi = math.pi,
    complex = math.complex,
    matrix = math.matrix,
    unit = math.unit,
    acot = math.acot,
    cot = math.cot,
    bigmath = math.create({number: 'BigNumber', precision: 20}),
    acotBig = bigmath.acot,
    cotBig = bigmath.cot,
    Big = bigmath.bignumber;

describe('acot', function() {
  it('should return the arccot of a boolean', function () {
    approx.equal(acot(true), pi / 4);
    assert.equal(acot(false), pi / 2);
  });

  it('should return the arccot of null', function () {
    assert.equal(acot(null), pi / 2);
  });

  it('should return the arccot of a number', function() {
    approx.equal(acot(-1) / pi, -0.25);
    approx.equal(acot(-0.5), -1.107148717794);
    assert.equal(acot(0), pi / 2);
    approx.equal(acot(0.5), 1.107148717794);
    approx.equal(acot(1) / pi, 0.25);

    assert.equal(acot(-Infinity), 0);
    assert.equal(acot(Infinity), 0);
  });

  it('should return the arccot of a bignumber', function() {
    var arg2 = Big(-1);
    var arg3 = Big(-0.5);
    var arg4 = Big(0);
    var arg7 = Big(2);
    var arg8 = Big(Infinity);

    assert.deepEqual(acotBig(Big(-2)), Big('-0.46364760900080611621'));
    assert.deepEqual(acotBig(arg2), Big('-0.78539816339744830962'));
    assert.deepEqual(acotBig(arg3), Big('-1.107148717794090503'));
    assert.deepEqual(acotBig(arg4).toString(), '1.5707963267948966192');
    assert.deepEqual(acotBig(Big(1)), Big('0.78539816339744830962'));
    assert.deepEqual(acotBig(arg7), Big('0.46364760900080611621'));
    assert.deepEqual(acotBig(arg8), Big(0));

    // Ensure the arguments where not changed
    assert.deepEqual(arg2, Big(-1));
    assert.deepEqual(arg3, Big(-0.5));
    assert.deepEqual(arg4, Big(0));
    assert.deepEqual(arg7, Big(2));
    assert.deepEqual(arg8.toString(), 'Infinity');

    // Hit Newton's method case
    bigmath.config({precision: 61});
    assert.deepEqual(acotBig(Big(1.1)), Big('0.7378150601204649138136281298033902035827333552504444896340492'));
  });

  it('should be the inverse function of cot', function() {
    approx.equal(acot(cot(-1)), -1);
    approx.equal(acot(cot(0)), 0);
    approx.equal(acot(cot(0.1)), 0.1);
    approx.equal(acot(cot(0.5)), 0.5);
    approx.equal(acot(cot(2)), -1.14159265358979);
  });

  it('should be the inverse function of bignumber cot', function() {
    bigmath.config({precision: 20});
    assert.deepEqual(acotBig(cotBig(Big(-1))), Big(-1));
    assert.deepEqual(acotBig(cotBig(Big(0))), Big(0));
    assert.deepEqual(acotBig(cotBig(Big(0.1))), Big(0.1));
    assert.deepEqual(acotBig(cotBig(Big(0.5))), Big(0.5));
    assert.deepEqual(acotBig(cotBig(Big(2))), Big('-1.1415926535897932385'));
    assert.deepEqual(acotBig(cotBig(bigmath.pi.div(2).minus(1e-10))).toString(), '1.5707963266948966193');
    assert.deepEqual(acotBig(cotBig(bigmath.pi.div(2))).toString(), '-1.570796326794895205');
  });

  it('should return the arccot of a complex number', function() {
    var re = 0.160875277198321;
    var im = 0.229072682968539;
    approx.deepEqual(acot(complex('2+3i')), complex(re, -im));
    approx.deepEqual(acot(complex('2-3i')), complex(re, im));
    approx.deepEqual(acot(complex('-2+3i')), complex(-re, -im));
    approx.deepEqual(acot(complex('-2-3i')), complex(-re, im));
    assert.deepEqual(acot(complex('i')), complex(0, -Infinity));
    approx.deepEqual(acot(complex('1')), complex(pi / 4, 0));
    approx.deepEqual(acot(complex('1+i')), complex(0.553574358897, -0.4023594781085));
  });

  it('should throw an error if called with a unit', function() {
    assert.throws(function () {acot(unit('45deg'))});
    assert.throws(function () {acot(unit('5 celsius'))});
  });

  it('should throw an error if called with a string', function() {
    assert.throws(function () {acot('string')});
  });

  it('should calculate the arccot element-wise for arrays and matrices', function() {
    // matrix, array, range
    var acot123 = [pi / 4, 0.4636476090008, 0.3217505543966];
    approx.deepEqual(acot([1,2,3]), acot123);
    approx.deepEqual(acot(matrix([1,2,3])), matrix(acot123));
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {acot()}, /TypeError: Too few arguments/);
    assert.throws(function () {acot(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX acot', function () {
    var expression = math.parse('acot(2)');
    assert.equal(expression.toTex(), '\\cot^{-1}\\left(2\\right)');
  });

});
