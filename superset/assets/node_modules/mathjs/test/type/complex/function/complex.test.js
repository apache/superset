var assert = require('assert');
var error = require('../../../../lib/error/index');
var math = require('../../../../index');
var complex = math.complex;

describe('complex', function() {

  it('should return 0 + 0i if called with no argument', function() {
    assert.deepEqual(complex(), new math.type.Complex(0, 0));
    assert.ok(complex() instanceof math.type.Complex);
  });

  it('should parse a valid string and create the complex number accordingly', function() {
    assert.deepEqual(complex('2+3i'), new math.type.Complex(2, 3));
    assert.deepEqual(complex('2-3i'), new math.type.Complex(2, -3));
    assert.ok(complex('2+3i') instanceof math.type.Complex);
  });

  it('should convert a real number into a complex value', function() {
    assert.deepEqual(complex(123), new math.type.Complex(123, 0));
  });

  it('should convert a fraction into a complex value', function() {
    assert.deepEqual(complex(math.fraction(123)), new math.type.Complex(123, 0));
  });

  it('should convert a big number into a complex value (downgrades to number', function() {
    assert.deepEqual(complex(math.bignumber(123)), new math.type.Complex(123, 0));
    assert.deepEqual(complex(math.bignumber(2), math.bignumber(3)), new math.type.Complex(2, 3));
  });

  it('should clone a complex value', function() {
    var b = complex(complex(2,3));
    assert.deepEqual(b, new math.type.Complex(2,3));
  });

  it('should convert the elements of a matrix or array to complex values', function() {
    var result = [
      new math.type.Complex(2, 0),
      new math.type.Complex(1, 0),
      new math.type.Complex(2, 3)
    ];
    assert.deepEqual(complex(math.matrix([2, 1, complex(2, 3)])), math.matrix(result));
    assert.deepEqual(complex([2, 1, complex(2, 3)]), result);
  });

  it('should accept polar coordinates as input', function() {
    var polar = complex({r: 1, phi: 1});
    assert.deepEqual(polar, new math.type.Complex.fromPolar(1, 1));
  });

  it('should accept an object with im and re as keys', function() {
    assert.deepEqual(complex({re: 1, im: 2}), new math.type.Complex(1, 2));
  });

  it('should throw an error if called with a string', function() {
    assert.throws(function () {complex('no valid complex number')}, SyntaxError);
  });

  it('should create a complex value from a boolean', function() {
    assert.deepEqual(complex(true), new math.type.Complex(1, 0));
  });

  it('should throw an error if called with a unit', function() {
    assert.throws(function () {complex(math.unit('5cm'))}, /Error: Expected object with either properties re and im, or properties r and phi./);
  });

  it('should accept two numbers as arguments', function() {
    assert.deepEqual(complex(2, 3), new math.type.Complex(2, 3));
    assert.deepEqual(complex(2, -3), new math.type.Complex(2, -3));
    assert.deepEqual(complex(-2, 3), new math.type.Complex(-2, 3));
    assert.ok(complex(2, 3) instanceof math.type.Complex);
  });

  it('should throw an error if passed two argument, one is invalid', function() {
    assert.throws(function () {complex(new Date(), 2)}, TypeError);
    assert.throws(function () {complex(2, new Date())}, TypeError);
  });

  it('should throw an error if called with more than 2 arguments', function() {
    assert.throws(function () {complex(2,3,4)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX complex', function () {
    var expr1 = math.parse('complex()');
    var expr2 = math.parse('complex(1)');
    var expr3 = math.parse('complex(1,2)');

    assert.equal(expr1.toTex(), '0');
    assert.equal(expr2.toTex(), '\\left(1\\right)');
    assert.equal(expr3.toTex(), '\\left(\\left(1\\right)+i\\cdot\\left(2\\right)\\right)');
  });
});
