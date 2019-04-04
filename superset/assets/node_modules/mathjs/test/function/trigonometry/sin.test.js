var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    approx = require('../../../tools/approx'),
    pi = math.pi,
    complex = math.complex,
    matrix = math.matrix,
    unit = math.unit,
    sin = math.sin,
    bigmath = math.create({precision: 242});

describe('sin', function() {
  it('should return the sine of a boolean', function () {
    approx.equal(sin(true), 0.841470984807897);
    approx.equal(sin(false), 0);
  });

  it('should return the sine of null', function () {
    approx.equal(sin(null), 0);
  });

  it('should return the sine of a number', function() {
    approx.equal(sin(0), 0);
    approx.equal(sin(pi/8), 0.382683432365090);
    approx.equal(sin(pi/4), Math.SQRT1_2);
    approx.equal(sin(pi/2), 1);
    approx.equal(sin(pi*3/4), 0.707106781186548);
    approx.equal(sin(pi), 0);
    approx.equal(sin(pi*5/4), -0.707106781186548);
    approx.equal(sin(pi*3/2), -1);
    approx.equal(sin(pi*7/4), -0.707106781186548);
    approx.equal(sin(pi*2), 0);
  });

  it('should return the sine of a bignumber', function() {
    var Big = bigmath.bignumber;
    assert.deepEqual(bigmath.sin(Big(0)), Big(0));

    // 103.64 % tau = 3.109... <- pretty close to the pi boundary
    var result_val = bigmath.sin(Big(103.64));
    assert.deepEqual(result_val, Big('0.0325518169566161584427313159942672130512044591216893328934710' +
                                        '307148043832988055013958395123418887322610809247793661058554' +
                                        '935758353628919004205593985094895305777198408601067175226892' +
                                        '4960612126026291341865833521451170868744460464214033460336158'));

    var arg = Big(-103.64);
    result_val = bigmath.sin(arg);
    assert.deepEqual(arg, Big(-103.64));   // Make sure arg wasn't changed
    assert.deepEqual(result_val, Big('-0.0325518169566161584427313159942672130512044591216893328934710' +
                                        '3071480438329880550139583951234188873226108092477936610585549' +
                                        '3575835362891900420559398509489530577719840860106717522689249' +
                                        '60612126026291341865833521451170868744460464214033460336158'));
    bigmath.config({number: 'BigNumber', precision: 15});

    // we've had a bug in reducing the period, affecting integer values around multiples of tau (like 6, 7)
    for (var x = -20; x < 20; x += 1) {
      approx.equal(bigmath.sin(bigmath.bignumber(x)).toNumber(), Math.sin(x));
    }

    var bigPi = bigmath.pi;
    assert.deepEqual(bigmath.sin(bigPi.div(8)).toString(), '0.38268343236509');
    assert.deepEqual(bigmath.sin(bigPi.div(4)).toString(), '0.707106781186547');
    assert.deepEqual(bigmath.sin(bigPi.div(2)).toString(), '1');
    assert.deepEqual(bigmath.sin(bigPi.times(3).div(4)).toString(), '0.707106781186551');
    assert.ok(bigmath.sin(bigPi).lt(1e-14));
    assert.deepEqual(bigmath.sin(bigPi.times(5).div(4)).toString(), '-0.707106781186554');
    assert.deepEqual(bigmath.sin(bigPi.times(3).div(2)).toString(), '-1');
    assert.deepEqual(bigmath.sin(bigPi.times(7).div(4)).toString(), '-0.707106781186553');
    assert.ok(bigmath.sin(bigPi.times(2)).lt(1e-13));
    assert.ok(bigmath.sin(bigmath.tau).lt(1e-14));
    assert.ok(bigmath.sin(bigmath.tau.times(2)).lt(1e-13));
  });

  it('should return the sine of a complex number', function() {
    var re = 9.15449914691143,
        im = 4.16890695996656;
    approx.deepEqual(sin(complex('2+3i')), complex(re, -im));
    approx.deepEqual(sin(complex('2-3i')), complex(re, im));
    approx.deepEqual(sin(complex('-2+3i')), complex(-re, -im));
    approx.deepEqual(sin(complex('-2-3i')), complex(-re, im));
    approx.deepEqual(sin(complex('i')), complex(0, 1.175201193643801));
    approx.deepEqual(sin(complex('1')), complex(0.841470984807897, 0));
    approx.deepEqual(sin(complex('1+i')), complex(1.298457581415977, 0.634963914784736));
    approx.deepEqual(sin(complex('1e-10i')), complex('1e-10i'));
  });

  it('should return the sine of an angle', function() {
    approx.equal(sin(unit('45deg')), 0.707106781186548);
    approx.equal(sin(unit('-45deg')), -0.707106781186548);

    assert(math.type.isBigNumber(sin(unit(math.bignumber(45), 'deg'))));
    approx.equal(sin(unit(math.bignumber(45), 'deg')).toNumber(), 0.707106781186548);

    approx.deepEqual(sin(unit(complex('1+i'), 'rad')), complex(1.298457581415977, 0.634963914784736));
  });

  it('should throw an error if called with an invalid unit', function() {
    assert.throws(function () {sin(unit('5 celsius'))});
  });

  it('should throw an error if called with a string', function() {
    assert.throws(function () {sin('string')});
  });

  var sin123 = [0.84147098480789, 0.909297426825682, 0.141120008059867];

  it('should return the sin of each element of an array', function() {
    approx.deepEqual(sin([1,2,3]), sin123);
  });

  it('should return the sin of each element of a matrix', function() {
    approx.deepEqual(sin(matrix([1,2,3])), matrix(sin123));
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {sin()}, /TypeError: Too few arguments/);
    assert.throws(function () {sin(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX sin', function () {
    var expression = math.parse('sin(0.5)');
    assert.equal(expression.toTex(), '\\sin\\left(0.5\\right)');
  });

});
