var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    approx = require('../../../tools/approx'),
    pi = math.pi,
    complex = math.complex,
    matrix = math.matrix,
    unit = math.unit,
    sec = math.sec,
    bigmath = math.create({number: 'BigNumber', precision: 20}),
    biggermath = math.create({number: 'BigNumber', precision: 21});

describe('sec', function() {
  it('should return the secant of a boolean', function () {
    approx.equal(sec(true), 1.85081571768093);
    assert.equal(sec(false), 1);
  });

  it('should return the secant of null', function () {
    assert.equal(sec(null), 1);
  });

  it('should return the secant of a number', function() {
    approx.equal(1 / sec(0), 1);
    approx.equal(1 / sec(pi*1/4), 0.707106781186548);
    approx.equal(1 / sec(pi*1/8), 0.923879532511287);
    approx.equal(1 / sec(pi*2/4), 0);
    approx.equal(1 / sec(pi*3/4), -0.707106781186548);
    approx.equal(1 / sec(pi*4/4), -1);
    approx.equal(1 / sec(pi*5/4), -0.707106781186548);
    approx.equal(1 / sec(pi*6/4), 0);
    approx.equal(1 / sec(pi*7/4), 0.707106781186548);
    approx.equal(1 / sec(pi*8/4), 1);
    approx.equal(1 / sec(pi/4), math.sqrt(2)/2);

    approx.equal(math.pow(sec(pi/4), 2), 2);
    approx.equal(sec(0), 1);
    approx.equal(sec(pi), -1);
    approx.equal(sec(-pi), -1);
    approx.equal(math.pow(sec(-pi/4), 2), 2);
    approx.equal(sec(2*pi), 1);
    approx.equal(sec(-2*pi), 1);
  });

  it('should return the secant of a bignumber', function() {
    var Big = bigmath.bignumber;
    var bigPi = bigmath.pi;
    var sqrt2 = bigmath.SQRT2.toString();

    assert.deepEqual(bigmath.sec(Big(0)), Big(1));
    assert.deepEqual(bigmath.sec(bigPi.div(8)).toString(), '1.0823922002923939688');
    assert.deepEqual(bigmath.sec(bigPi.div(4)).toString(), sqrt2);
    assert.deepEqual(bigmath.sec(bigPi).toString(), '-1');
    assert.deepEqual(bigmath.sec(bigPi.times(2)).toString(), '1');
    assert.deepEqual(bigmath.sec(bigmath.tau).toString(), '1');
    assert.deepEqual(bigmath.sec(bigmath.tau.times(-2)).toString(), '1');

    /* Pass in one more digit of pi. */
    bigPi = biggermath.pi;
    assert.deepEqual(bigmath.sec(bigPi.div(2)), Big('756606132568153667460')); // (large number, about infinity)
    assert.deepEqual(bigmath.sec(bigPi.times(3).div(4)).toString(), '-'+sqrt2);
    assert.deepEqual(bigmath.sec(bigPi.times(5).div(4)).toString(), '-'+sqrt2);
  });

  it('should return the secant of a complex number', function() {
    var re = 0.0416749644111443,
        im = 0.0906111371962376;
    approx.deepEqual(sec(complex('2+3i')), complex(-re, im));
    approx.deepEqual(sec(complex('2-3i')), complex(-re, -im));
    approx.deepEqual(sec(complex('-2+3i')), complex(-re, -im));
    approx.deepEqual(sec(complex('-2-3i')), complex(-re, im));
    approx.deepEqual(sec(complex('i')), complex(0.648054273663885, 0));
    approx.deepEqual(sec(complex('1')), complex(1.85081571768093, 0));
    approx.deepEqual(sec(complex('1+i')), complex(0.498337030555187, 0.591083841721045));
  });

  it('should return the secant of an angle', function() {
    approx.equal(sec(unit('45deg')), 1.41421356237310);
    approx.equal(sec(unit('-45deg')), 1.41421356237310);

    assert(math.type.isBigNumber(sec(unit(math.bignumber(45), 'deg'))));
    approx.equal(sec(unit(math.bignumber(45), 'deg')).toNumber(), 1.41421356237310);

    approx.deepEqual(sec(unit(complex('1+i'), 'rad')), complex(0.498337030555187, 0.591083841721045));
  });

  it('should throw an error if called with an invalid unit', function() {
    assert.throws(function () {sec(unit('5 celsius'))});
  });

  it('should throw an error if called with a string', function() {
    assert.throws(function () {sec('string')});
  });

  var sec123 = [1.85081571768093, -2.40299796172238, -1.01010866590799];

  it('should return the secant of each element of an array', function() {
    approx.deepEqual(sec([1,2,3]), sec123);
  });

  it('should return the secant of each element of a matrix', function() {
    approx.deepEqual(sec(matrix([1,2,3])), matrix(sec123));
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {sec()}, /TypeError: Too few arguments/);
    assert.throws(function () {sec(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX sec', function () {
    var expression = math.parse('sec(1)');
    assert.equal(expression.toTex(), '\\sec\\left(1\\right)');
  });

});
