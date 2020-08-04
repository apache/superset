var assert = require('assert');
var math = require('../../../../index');
var unit = math.unit;
var Unit = math.type.Unit;

describe('unit', function() {

  it ('should construct a unit', function () {
    var u = unit('5 cm');
    assert.deepEqual(u, new Unit(5, 'cm'));
  });

  it('should parse a valid string to a unit', function() {
    assert.deepEqual(unit('5 cm').toString(), '5 cm');
    assert.deepEqual(unit('5000 cm').toString(), '50 m');
    assert.deepEqual(unit('10 kg').toString(), '10 kg');
  });

  it('should clone a unit', function() {
    var a = math.unit('5cm');
    var b = math.unit(a);
    assert.deepEqual(b.toString(), '5 cm');
  });

  it('should create units from all elements in an array', function() {
    assert.deepEqual(math.unit(['5 cm', '3kg']), [math.unit('5cm'), math.unit('3kg')]);
  });

  it('should create units from all elements in an array', function() {
    assert.deepEqual(math.unit(math.matrix(['5 cm', '3kg'])), math.matrix([math.unit('5cm'), math.unit('3kg')]));
  });

  it('should throw an error if called with an invalid string', function() {
    assert.throws(function () {unit('invalid unit')}, SyntaxError);
  });

  it('should throw an error if called with a number', function() {
    assert.throws(function () {unit(2)}, /SyntaxError: "2" contains no units/);
  });

  it('should throw an error if called with a complex', function() {
    assert.throws(function () {unit(math.complex(2,3))}, TypeError);
  });

  it('should take a number as the quantity and a string as the unit', function() {
    assert.deepEqual(unit(5, 'cm').toString(), '5 cm');
    assert.deepEqual(unit(10, 'kg').toString(), '10 kg');
  });

  it('should take a bignumber as the quantity and a string as the unit', function() {
    assert.deepEqual(unit(math.bignumber(5).plus(1e-24), 'cm').toString(), '5.000000000000000000000001 cm');
  });

  it('should take a fraction as the quantity and a string as the unit', function() {
    assert.deepEqual(unit(math.fraction(1,3), 'cm').toString(), '1/3 cm');
  });

  it('should convert a string to number with 2 strings', function() {
    assert.deepEqual(unit('5', 'cm').toString(), '5 cm');
  });

  it('should throw an error if called with an invalid argument', function() {
    assert.throws(function () {unit(2, math.complex(2,3))}, TypeError);
    assert.throws(function () {unit(true)}, TypeError);
  });

  it('should throw an error if called with no argument', function() {
    assert.throws(function () {unit()}, /TypeError: Too few arguments/);
  });

  it('should throw an error if called with an invalid number of arguments', function() {  
    assert.throws(function () {unit(1,'cm',3)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX unit', function () {
    var expr1 = math.parse('unit(cm)');
    var expr2 = math.parse('unit(1,cm)');

    assert.equal(expr1.toTex(), '\\left(\\mathrm{cm}\\right)');
    assert.equal(expr2.toTex(), '\\left(\\left(1\\right)\\mathrm{cm}\\right)');
  });
});
