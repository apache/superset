var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    approx = require('../../../tools/approx'),
    pi = math.pi,
    complex = math.complex,
    matrix = math.matrix,
    unit = math.unit,
    tan = math.tan,
    piBigmath = math.create({number: 'BigNumber', precision: 21}),
    bigmath = math.create({precision: 20}),
    Big = bigmath.bignumber,
    bigTan = bigmath.tan;

describe('tan', function() {
  it('should return the tangent of a boolean', function () {
    approx.equal(tan(true), 1.55740772465490);
    approx.equal(tan(false), 0);
  });

  it('should return the tangent of null', function () {
    approx.equal(tan(null), 0);
  });

  it('should return the tangent of a number', function() {
    approx.equal(tan(0), 0);
    approx.equal(tan(pi*1/4), 1);
    approx.equal(tan(pi*1/8), 0.414213562373095);
    assert.ok(tan(pi*2/4) > 1e10);
    approx.equal(tan(pi*3/4), -1);
    approx.equal(tan(pi*4/4), 0);
    approx.equal(tan(pi*5/4), 1);
    assert.ok(tan(pi*6/4) > 1e10);
    approx.equal(tan(pi*7/4), -1);
    approx.equal(tan(pi*8/4), 0);
  });

  it('should return the tangent of a bignumber', function() { 
    var bigPi = piBigmath.pi;

    assert.deepEqual(bigTan(Big(0)), Big(0));
    assert.deepEqual(bigTan(Big(-1)), Big('-1.5574077246549022305'));

    assert.deepEqual(bigTan(bigPi.div(8)).toString(), '0.414213562373095048802');
    // Wolfram:                                        0.414213562373095048801688724209698078569671875376948073176
    assert.deepEqual(bigTan(bigPi.div(4)).toString(), '0.999999999999999999999');
  });

  it('should return the tangent of a complex number', function() {
    var re = 0.00376402564150425,
        im = 1.00323862735360980;
    approx.deepEqual(tan(complex('2+3i')), complex(-re, im));
    approx.deepEqual(tan(complex('2-3i')), complex(-re, -im));
    approx.deepEqual(tan(complex('-2+3i')), complex(re, im));
    approx.deepEqual(tan(complex('-2-3i')), complex(re, -im));
    approx.deepEqual(tan(complex('i')), complex(0, 0.761594155955765));
    approx.deepEqual(tan(complex('1')), complex(1.55740772465490, 0));
    approx.deepEqual(tan(complex('1+i')), complex(0.271752585319512, 1.083923327338695));
  });

  it('should return the tangent of an angle', function() {
    approx.equal(tan(unit(' 60deg')), math.sqrt(3));
    approx.equal(tan(unit('-135deg')), 1);

    assert(math.type.isBigNumber(tan(unit(math.bignumber(60), 'deg'))));
    approx.equal(tan(unit(math.bignumber(60), 'deg')).toNumber(), math.sqrt(3));

    approx.deepEqual(tan(unit(complex('1+i'), 'rad')), complex(0.271752585319512, 1.083923327338695));
  });

  it('should throw an error if called with an invalid unit', function() {
    assert.throws(function () {tan(unit('5 celsius'))});
  });

  it('should throw an error if called with a string', function() {
    assert.throws(function () {tan('string')});
  });

  var tan123 = [1.557407724654902, -2.185039863261519, -0.142546543074278];

  it('should return the tan of each element of an array', function() {
    approx.deepEqual(tan([1,2,3]), tan123);
  });

  it('should return the tan of each element of a matrix', function() {
    approx.deepEqual(tan(matrix([1,2,3])), matrix(tan123));
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {tan()}, /TypeError: Too few arguments/);
    assert.throws(function () {tan(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX tan', function () {
    var expression = math.parse('tan(1)');
    assert.equal(expression.toTex(), '\\tan\\left(1\\right)');
  });

});
