var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    approx = require('../../../tools/approx'),
    pi = math.pi,
    complex = math.complex,
    matrix = math.matrix,
    unit = math.unit,
    csc = math.csc,
    bigmath = math.create({number: 'BigNumber', precision: 20}),
    biggermath = math.create({number: 'BigNumber', precision: 21});

describe('csc', function() {
  it('should return the cosecant of a boolean', function () {
    approx.equal(csc(true), 1.18839510577812);
    approx.equal(csc(false), Infinity);
  });

  it('should return the cosecant of null', function () {
    approx.equal(csc(null), Infinity);
  });

  it('should return the cosecant of a number', function() {
    approx.equal(1 / csc(0), 0);
    approx.equal(1 / csc(pi*1/4), 0.707106781186548);
    approx.equal(1 / csc(pi*1/8), 0.382683432365090);
    approx.equal(1 / csc(pi*2/4), 1);
    approx.equal(1 / csc(pi*3/4), 0.707106781186548);
    approx.equal(1 / csc(pi*4/4), 0);
    approx.equal(1 / csc(pi*5/4), -0.707106781186548);
    approx.equal(1 / csc(pi*6/4), -1);
    approx.equal(1 / csc(pi*7/4), -0.707106781186548);
    approx.equal(1 / csc(pi*8/4), 0);
    approx.equal(1 / csc(pi/4), math.sqrt(2)/2);
  });

  it('should return the cosecant of a bignumber', function() {
    var Big = bigmath.bignumber;
    var bigPi = bigmath.pi;
    var sqrt2 = bigmath.SQRT2.toString();

    assert.deepEqual(bigmath.csc(Big(0)).toString(), 'Infinity');
    assert.deepEqual(bigmath.csc(bigPi.div(8)).toString(), '2.6131259297527530557');
    assert.deepEqual(bigmath.csc(bigPi.div(4)).toString(), sqrt2);
    assert.deepEqual(bigmath.csc(bigPi.div(2)).toString(), '1');
    assert.deepEqual(bigmath.csc(bigPi), Big('-26769019461318409709')); // large number (about infinity)
    assert.deepEqual(bigmath.csc(bigPi.times(3).div(2)).toString(), '-1');
  });

  it('should return the cosecant of a complex number', function() {
    var re = 0.0904732097532074;
    var im = 0.0412009862885741;
    approx.deepEqual(csc(complex('2+3i')), complex(re, im));
    approx.deepEqual(csc(complex('2-3i')), complex(re, -im));
    approx.deepEqual(csc(complex('-2+3i')), complex(-re, im));
    approx.deepEqual(csc(complex('-2-3i')), complex(-re, -im));
    approx.deepEqual(csc(complex('i')), complex(0, -0.850918128239322));
    approx.deepEqual(csc(complex('1')), complex(1.18839510577812, 0));
    approx.deepEqual(csc(complex('1+i')), complex(0.621518017170428, -0.303931001628426));
  });

  it('should return the cosecant of an angle', function() {
    approx.equal(csc(unit('45deg')), 1.41421356237310);
    approx.equal(csc(unit('-45deg')), -1.41421356237310);

    assert(math.type.isBigNumber(csc(unit(math.bignumber(45), 'deg'))));
    approx.equal(csc(unit(math.bignumber(45), 'deg')).toNumber(), 1.41421356237310);

    approx.deepEqual(csc(unit(complex('1+i'), 'rad')), complex(0.621518017170428, -0.303931001628426));
  });

  it('should throw an error if called with an invalid unit', function() {
    assert.throws(function () {csc(unit('5 celsius'))});
  });

  it('should throw an error if called with a string', function() {
    assert.throws(function () {csc('string')});
  });

  var csc123 = [1.18839510577812, 1.09975017029462, 7.08616739573719];

  it('should return the cosecant of each element of an array', function() {
    approx.deepEqual(csc([1,2,3]), csc123);
  });

  it('should return the cosecant of each element of a matrix', function() {
    approx.deepEqual(csc(matrix([1,2,3])), matrix(csc123));
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {csc()}, /TypeError: Too few arguments/);
    assert.throws(function () {csc(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX csc', function () {
    var expression = math.parse('csc(1)');
    assert.equal(expression.toTex(), '\\csc\\left(1\\right)');
  });

});
