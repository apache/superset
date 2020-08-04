// test sqrt
var assert = require('assert');
var approx = require('../../../tools/approx');
var error = require('../../../lib/error/index');
var math = require('../../../index');
var mathPredictable = math.create({predictable: true});
var sqrt = math.sqrt;
var bignumber = math.bignumber;

describe('sqrt', function() {
  it('should return the square root of a boolean', function () {
    assert.equal(sqrt(true), 1);
    assert.equal(sqrt(false), 0);
  });

  it('should return the square root of null', function () {
    assert.equal(sqrt(null), 0);
  });

  it('should return the square root of a positive number', function() {
    assert.equal(sqrt(0), 0);
    assert.equal(sqrt(1), 1);
    assert.equal(sqrt(4), 2);
    assert.equal(sqrt(9), 3);
    assert.equal(sqrt(16), 4);
    assert.equal(sqrt(25), 5);
  });

  it('should return the square root of a negative number', function() {
    assert.deepEqual(sqrt(-4), math.complex(0, 2));
    assert.deepEqual(sqrt(-16), math.complex(0, 4));
  });

  it('should return the square root of a negative number when predictable:true', function() {
    assert.strictEqual(mathPredictable.sqrt(4), 2);
    assert(typeof mathPredictable.sqrt(-4), 'number');
    assert(isNaN(mathPredictable.sqrt(-4)));
  });

  it('should return the square root of a positive bignumber', function() {
    assert.deepEqual(sqrt(bignumber(0)), bignumber(0));
    assert.deepEqual(sqrt(bignumber(1)), bignumber(1));
    assert.deepEqual(sqrt(bignumber(4)), bignumber(2));
    assert.deepEqual(sqrt(bignumber(9)), bignumber(3));
    assert.deepEqual(sqrt(bignumber(16)), bignumber(4));
    assert.deepEqual(sqrt(bignumber(25)), bignumber(5));

    // validate whether we are really working at high precision
    var bigmath = math.create({precision: 100});
    assert.deepEqual(bigmath.sqrt(bigmath.bignumber(2)), bigmath.bignumber('1.414213562373095048801688724209698078569671875376948073176679737990732478462107038850387534327641573'));
  });

  it('should return the square root of a negative bignumber', function() {
    assert.deepEqual(sqrt(bignumber(-4)), math.complex(0, 2));
  });

  it('should return the square root of a negative bignumber when predictable:true', function() {
    assert.deepEqual(mathPredictable.sqrt(bignumber(4)), bignumber(2));
    assert.ok(mathPredictable.sqrt(bignumber(-4)).isNaN());
  });

  it('should return the square root of a complex number', function() {
    assert.deepEqual(sqrt(math.complex(3, -4)), math.complex(2, -1));
    assert.deepEqual(sqrt(math.complex(1e10, 1e-10)), math.complex(1e5, 5e-16));
  });

  it('should return the square root of a unit', function() {
    assert.equal(sqrt(math.unit('25 m^2/s^2')).toString(), '5 m / s');
    assert.equal(sqrt(math.unit('4 kg')).toString(), '2 kg^0.5');
  });

  it('should return a Unit with a Complex value when computing the square root of a negative unit', function() {
    // Update this when support for complex units is added
    //assert.equal(sqrt(math.unit('-25 m^2/s^2')).toString(), 'NaN m / s');
    assert.equal(math.format(sqrt(math.unit('-25 m^2/s^2')), 14), '(5i) m / s');
  });

  it('should throw an error when used with a string', function() {
    assert.throws(function () {
      sqrt('a string');
    });
  });

  it('should return the square root of each element of a matrix', function() {
    assert.deepEqual(sqrt([4,9,16,25]), [2,3,4,5]);
    assert.deepEqual(sqrt([[4,9],[16,25]]), [[2,3],[4,5]]);
    assert.deepEqual(sqrt(math.matrix([[4,9],[16,25]])), math.matrix([[2,3],[4,5]]));
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {sqrt()}, /TypeError: Too few arguments/);
    assert.throws(function () {sqrt(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX sqrt', function () {
    var expression = math.parse('sqrt(2)');
    assert.equal(expression.toTex(), '\\sqrt{2}');
  });

});
