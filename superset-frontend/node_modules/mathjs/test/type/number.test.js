var assert = require('assert'),
    error = require('../../lib/error/index'),
    math = require('../../index'),
    approx = require('../../tools/approx'),
    number = math.number;

describe('number', function() {

  it('should be 0 if called with no argument', function() {
    approx.equal(number(), 0);
  });

  it('should convert a boolean to a number', function() {
    approx.equal(number(true), 1);
    approx.equal(number(false), 0);
  });

  it('should convert null to a number', function() {
    approx.equal(number(null), 0);
  });

  it('should convert a bignumber to a number', function() {
    approx.equal(number(math.bignumber(0.1)), 0.1);
    approx.equal(number(math.bignumber('1.3e500')), Infinity);
  });

  it('should convert a fraction to a number', function() {
    approx.equal(number(math.fraction(2,5)), 0.4);
  });

  it('should accept a number as argument', function() {
    approx.equal(number(3), 3);
    approx.equal(number(-3), -3);
  });

  it('should convert a unit to a number', function() {
    approx.equal(number(math.unit('52cm'), 'm'), 0.52);
  });

  it('should parse the string if called with a valid string', function() {
    approx.equal(number('2.1e3'), 2100);
    approx.equal(number(' 2.1e-3 '), 0.0021);
    approx.equal(number(''), 0);
    approx.equal(number(' '), 0);
  });

  it('should throw an error if called with an invalid string', function() {
    assert.throws(function () {number('2.3.4')}, SyntaxError);
    assert.throws(function () {number('23a')}, SyntaxError);
  });

  it('should convert the elements of a matrix to numbers', function() {
    assert.deepEqual(number(math.matrix(['123',true])), math.matrix([123, 1]));
  });

  it('should convert the elements of an array to numbers', function() {
    assert.deepEqual(number(['123',true]), [123, 1]);
  });

  it('should throw an error if called with a wrong number of arguments', function() {
    assert.throws(function () {number(1,2,3)}, /TypeError: Too many arguments/);
  });

  it('should throw an error if called with a complex number', function() {
    assert.throws(function () {number(math.complex(2,3))}, TypeError);
  });

  it('should throw an error with wrong type of arguments', function() {
    assert.throws(function () {number(math.unit('5cm'))}, /Second argument with valueless unit expected/);
    //assert.throws(function () {number(math.unit('5cm'), 2)}, TypeError); // FIXME: this should also throw an error
    assert.throws(function () {number(math.unit('5cm'), new Date())}, TypeError);
    assert.throws(function () {number('23', 2)}, TypeError);
  });

  it('should LaTeX number', function () {
    var expr1 = math.parse('number()');
    var expr2 = math.parse('number(1)');
    var expr3 = math.parse('number(1,cm)');

    assert.equal(expr1.toTex(), '0');
    assert.equal(expr2.toTex(), '\\left(1\\right)');
    assert.equal(expr3.toTex(), '\\left(\\left(1\\right)\\mathrm{cm}\\right)');
  });
});

