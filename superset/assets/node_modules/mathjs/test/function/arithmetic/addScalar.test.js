// test add
var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var BigNumber = require('decimal.js');
var add = math.add;

// TODO: make unit tests independent of math
describe('add', function() {

  it('should add two numbers', function() {
    assert.equal(add(2, 3), 5);
    assert.equal(add(-2, 3), 1);
    assert.equal(add(2, -3), -1);
    assert.equal(add(-5, -3), -8);
  });

  it('should add booleans', function() {
    assert.equal(add(true, true), 2);
    assert.equal(add(true, false), 1);
    assert.equal(add(false, true), 1);
    assert.equal(add(false, false), 0);
  });

  it('should add numbers and null', function () {
    assert.equal(math.add(null, null), 0);
    assert.equal(math.add(null, 1), 1);
    assert.equal(math.add(1, null), 1);
  });

  it('should add mixed numbers and booleans', function() {
    assert.equal(add(2, true), 3);
    assert.equal(add(2, false), 2);
    assert.equal(add(true, 2), 3);
    assert.equal(add(false, 2), 2);
  });

  it('should add BigNumbers', function() {
    assert.deepEqual(add(new BigNumber(0.1), new BigNumber(0.2)), new BigNumber(0.3));
    assert.deepEqual(add(new BigNumber('2e5001'), new BigNumber('3e5000')), new BigNumber('2.3e5001'));
    assert.deepEqual(add(new BigNumber('9999999999999999999'), new BigNumber('1')), new BigNumber('1e19'));
  });

  it('should add mixed numbers and BigNumbers', function() {
    assert.deepEqual(add(new BigNumber(0.1), 0.2), new BigNumber(0.3));
    assert.deepEqual(add(0.1, new BigNumber(0.2)), new math.type.BigNumber(0.3));

    assert.throws(function () {add(1/3, new BigNumber(1));}, /Cannot implicitly convert a number with >15 significant digits to BigNumber/);
    assert.throws(function () {add(new BigNumber(1), 1/3);}, /Cannot implicitly convert a number with >15 significant digits to BigNumber/);
  });

  it('should add mixed booleans and BigNumbers', function() {
    assert.deepEqual(add(new BigNumber(0.1), true), new BigNumber(1.1));
    assert.deepEqual(add(new BigNumber(0.1), false), new BigNumber(0.1));
    assert.deepEqual(add(false, new BigNumber(0.2)), new math.type.BigNumber(0.2));
    assert.deepEqual(add(true, new BigNumber(0.2)), new math.type.BigNumber(1.2));
  });

  it('should add mixed complex numbers and BigNumbers', function() {
    assert.deepEqual(add(math.complex(3, -4), new BigNumber(2)), math.complex(5, -4));
    assert.deepEqual(add(new BigNumber(2), math.complex(3, -4)), math.complex(5, -4));
  });

  it('should add two complex numbers', function() {
    assert.equal(add(math.complex(3, -4), math.complex(8, 2)), '11 - 2i');
    assert.equal(add(math.complex(3, -4), 10), '13 - 4i');
    assert.equal(add(10, math.complex(3, -4)), '13 - 4i');
  });

  it('should add two fractions', function() {
    var a = math.fraction(1,3);
    assert.equal(add(a, math.fraction(1,6)).toString(), '0.5');
    assert.equal(a.toString(), '0.(3)');
    assert.equal(add(math.fraction(1,5), math.fraction(2,5)).toString(), '0.6');
    assert.equal(add(math.fraction(1), math.fraction(1,3)).toString(), '1.(3)');
  });

  it('should add mixed fractions and numbers', function() {
    assert.deepEqual(add(1, math.fraction(1,3)), math.fraction(4,3));
    assert.deepEqual(add(math.fraction(1,3), 1), math.fraction(4,3));
  });

  it('should throw an error when converting a number to a fraction that is not an exact representation', function() {
    assert.throws(function () {
      add(math.pi, math.fraction(1,3))
    }, /Cannot implicitly convert a number to a Fraction when there will be a loss of precision/);
  });

  it('should add strings to numbers', function() {
    assert.strictEqual(add('2', '3'), 5);
    assert.strictEqual(add(2, '3'), 5);
    assert.strictEqual(add('2', 3), 5);
  });

  it('should add strings to BigNumbers', function() {
    assert.deepEqual(add('2', math.bignumber(3)), math.bignumber(5));
    assert.deepEqual(add(math.bignumber(3), '2'), math.bignumber(5));
    assert.throws(function () { add('foo', math.bignumber(3)) }, /Error: Cannot convert "foo" to BigNumber/)
  });

  it('should add strings to Fractions', function() {
    assert.deepEqual(add('2', math.fraction(3)), math.fraction(5));
    assert.deepEqual(add(math.fraction(3), '2'), math.fraction(5));
    assert.throws(function () { add('foo', math.fraction(3)) }, /Error: Cannot convert "foo" to Fraction/)
  });

  it('should add strings to Complex numbers', function() {
    assert.deepEqual(add('2', math.complex(0, 3)), math.complex(2, 3));
    assert.deepEqual(add(math.complex(0, 3), '2'), math.complex(2, 3));
    assert.throws(function () { add('foo', math.complex(0, 3)) }, /Error: Cannot convert "foo" to Complex/)
  });

  it('should add two measures of the same unit', function() {
    approx.deepEqual(add(math.unit(5, 'km'), math.unit(100, 'mile')), math.unit(165.93, 'km'));

    approx.deepEqual(add(math.unit(math.fraction(1,3), 'm'), math.unit(math.fraction(1,3), 'm')).toString(), '2/3 m');

    approx.deepEqual(add(math.unit(math.complex(-3, 2), 'g'), math.unit(math.complex(5, -6), 'g')).toString(), '(2 - 4i) g');
  });

  it('should throw an error for two measures of different units', function() {
    assert.throws(function () {
      add(math.unit(5, 'km'), math.unit(100, 'gram'));
    });
  });

  it('should throw an error when one of the two units has undefined value', function() {
    assert.throws(function () {
      add(math.unit('km'), math.unit('5gram'));
    }, /Parameter x contains a unit with undefined value/);
    assert.throws(function () {
      add(math.unit('5 km'), math.unit('gram'));
    }, /Parameter y contains a unit with undefined value/);
  });

  it('should throw an error in case of a unit and non-unit argument', function() {
    assert.throws(function () {add(math.unit('5cm'), 2);}, /TypeError: Unexpected type of argument in function add/);
    assert.throws(function () {add(math.unit('5cm'), new Date());}, /TypeError: Unexpected type of argument in function add/);
    assert.throws(function () {add(new Date(), math.unit('5cm'));}, /TypeError: Unexpected type of argument in function add/);
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {add(1);}, /TypeError: Too few arguments/);
  });

  it('should LaTeX add', function () {
    var expression = math.parse('add(1,2)');
    assert.equal(expression.toTex(), '\\left(1+2\\right)');
  });

});
