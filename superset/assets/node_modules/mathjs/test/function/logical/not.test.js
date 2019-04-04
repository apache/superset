// test not
var assert = require('assert');
var math = require('../../../index');
var bignumber = math.bignumber;
var complex = math.complex;
var matrix = math.matrix;
var unit = math.unit;
var not = math.not;
var FunctionNode = math.expression.node.FunctionNode;
var ConstantNode = math.expression.node.ConstantNode;
var SymbolNode = math.expression.node.SymbolNode;

describe('not', function () {

  it('should not numbers correctly', function () {
    assert.strictEqual(not(1), false);
    assert.strictEqual(not(-1), false);
    assert.strictEqual(not(1.23e+100), false);
    assert.strictEqual(not(-1.0e-100), false);
    assert.strictEqual(not(1.0e-100), false);
    assert.strictEqual(not(Infinity), false);
    assert.strictEqual(not(-Infinity), false);
    assert.strictEqual(not(0), true);
    assert.strictEqual(not(NaN), true);
  });

  it('should not complex numbers', function () {
    assert.strictEqual(not(complex(1, 1)), false);
    assert.strictEqual(not(complex(0, 1)), false);
    assert.strictEqual(not(complex(1, 0)), false);
    assert.strictEqual(not(complex(0, 0)), true);
    assert.strictEqual(not(complex()), true);
    assert.strictEqual(not(complex(0)), true);
    assert.strictEqual(not(complex(1)), false);
  });

  it('should not booleans', function () {
    assert.strictEqual(not(true), false);
    assert.strictEqual(not(false), true);
  });

  it('should not null', function () {
    assert.strictEqual(not(null), true);
  });

  it('should not bignumbers', function () {
    assert.strictEqual(not(bignumber(1)), false);
    assert.strictEqual(not(bignumber(-1)), false);
    assert.strictEqual(not(bignumber(0)), true);
    assert.strictEqual(not(bignumber(NaN)), true);
    assert.strictEqual(not(bignumber('1e+10')), false);
    assert.strictEqual(not(bignumber('-1.0e-100')), false);
    assert.strictEqual(not(bignumber('1.0e-100')), false);
    assert.strictEqual(not(bignumber(Infinity)), false);
    assert.strictEqual(not(bignumber(-Infinity)), false);
  });

  it('should not units', function () {
    assert.strictEqual(not(unit('100cm')), false);
    assert.strictEqual(not(unit('0 inch')), true);
    assert.strictEqual(not(unit('1m')), false);
    assert.strictEqual(not(unit('m')), true);
    assert.strictEqual(not(unit('-10inch')), false);

    assert.strictEqual(not(unit(bignumber(1), 'm')), false);
    assert.strictEqual(not(unit(bignumber(0), 'm')), true);
  });

  it('should not arrays', function () {
    assert.deepEqual(not([0, 10]), [true, false]);
    assert.deepEqual(not([]), []);
  });

  it('should not matrices', function () {
    assert.deepEqual(not(matrix([0, 10])), matrix([true, false]));
    assert.deepEqual(not(matrix([])), matrix([]));
  });

  it('should throw an error in case of invalid number of arguments', function () {
    assert.throws(function () {not()}, /TypeError: Too few arguments/);
    assert.throws(function () {not(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should throw an error in case of invalid type if arguments', function () {
    assert.throws(function () {not(new Date())}, /TypeError: Unexpected type of argument/);
    assert.throws(function () {not({})}, /TypeError: Unexpected type of argument/);
  });

  it('should LaTeX not', function () {
    var c = new ConstantNode(1);
    var node = new FunctionNode(new SymbolNode('not'), [c]);
    assert.equal(node.toTex(), '\\neg\\left(1\\right)');
  });

});
