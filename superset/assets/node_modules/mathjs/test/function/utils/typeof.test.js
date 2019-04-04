// test typeof
var assert = require('assert');
var math = require('../../../index');
var Index = math.type.Index;
var Range = math.type.Range;
var Matrix = math.type.Matrix;
var Help = math.type.Help;
var Unit = math.type.Unit;
var Complex = math.type.Complex;
var Fraction = math.type.Fraction;

describe('typeof', function() {

  it('should return number type for a number', function() {
    assert.equal(math.typeof(2), 'number');
    assert.equal(math.typeof(new Number(2)), 'number');
  });

  it('should return bignumber type for a bignumber', function() {
    assert.equal(math.typeof(math.bignumber(0.1)), 'BigNumber');
    assert.equal(math.typeof(new math.type.BigNumber('0.2')), 'BigNumber');
  });

  it('should return string type for a string', function() {
    assert.equal(math.typeof('hello there'), 'string');
    assert.equal(math.typeof(new String('hello there')), 'string');
  });

  it('should return complex type for a complex number', function() {
    assert.equal(math.typeof(new Complex(2,3)), 'Complex');
    assert.equal(math.typeof(math.complex(2,3)), 'Complex');
  });

  it('should return complex type for a fraction', function() {
    assert.equal(math.typeof(new Fraction(2,3)), 'Fraction');
    assert.equal(math.typeof(math.fraction(2,3)), 'Fraction');
  });

  it('should return array type for an array', function() {  
    assert.equal(math.typeof([1,2,3]), 'Array');
    assert.equal(math.typeof(new Array()), 'Array');
  });

  it('should return array type for an array', function() {
    assert.equal(math.typeof([1,2,3]), 'Array');
    assert.equal(math.typeof(new Array()), 'Array');
  });

  it('should return matrix type for a matrix', function() {  
    assert.equal(math.typeof(math.matrix()), 'Matrix');
    assert.equal(math.typeof(math.matrix()), 'Matrix');
  });

  it('should return unit type for a unit', function() {
    assert.equal(math.typeof(new Unit(5, 'cm')), 'Unit');
    assert.equal(math.typeof(math.unit('5cm')), 'Unit');
  });

  it('should return boolean type for a boolean', function() {  
    assert.equal(math.typeof(true), 'boolean');
    assert.equal(math.typeof(false), 'boolean');
    assert.equal(math.typeof(new Boolean(true)), 'boolean');
  });

  it('should return null type for null', function() {  
    assert.equal(math.typeof(null), 'null');
  });

  it('should return undefined type for undefined', function() {  
    assert.equal(math.typeof(undefined), 'undefined');
  });

  it('should return date type for a Date', function() {  
    assert.equal(math.typeof(new Date()), 'Date');
  });

  it('should return function type for a function', function() {  
    assert.equal(math.typeof(function () {}), 'Function');
    assert.equal(math.typeof(new Function ()), 'Function');
  });

  it('should return function type for a chain', function() {
    assert.equal(math.typeof(math.chain(3)), 'Chain');
  });

  it('should return function type for an index', function() {
    assert.equal(math.typeof(new Index([0, 10])), 'Index');
  });

  it('should return function type for a range', function() {
    assert.equal(math.typeof(new Range(0, 10)), 'Range');
  });

  it('should return function type for a help object', function() {
    assert.equal(math.typeof(new Help({}, {})), 'Help');
  });

  it('should return object type for an object', function() {  
    assert.equal(math.typeof({}), 'Object');
    assert.equal(math.typeof(new Object()), 'Object');
  });

  it('should throw an error if called with a wrong number of arguments', function() {
    assert.throws(function() {math.typeof(); });
    assert.throws(function() {math.typeof(1,2); });
  });

  it('should LaTeX typeof', function () {
    var expression = math.parse('typeof(1)');
    assert.equal(expression.toTex(), '\\mathrm{typeof}\\left(1\\right)');
  });

});
