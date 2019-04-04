// test ConstantNode
var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var bigmath = require('../../../index').create({number: 'BigNumber'});
var Node = math.expression.node.Node;
var ConstantNode = math.expression.node.ConstantNode;
var SymbolNode = math.expression.node.SymbolNode;

describe('ConstantNode', function() {

  it ('should create a ConstantNode with value type', function () {
    var a = new ConstantNode('3', 'number');
    assert(a instanceof Node);
    assert.equal(a.type, 'ConstantNode');
  });

  it ('should create a ConstantNode without value type', function () {
    var a = new ConstantNode(3);
    assert(a instanceof Node);
    assert.equal(a.type, 'ConstantNode');
    // TODO: extensively test each of the supported types

    assert.deepEqual(new ConstantNode(3), new ConstantNode('3', 'number'));
    assert.deepEqual(new ConstantNode('hello'), new ConstantNode('hello', 'string'));
    assert.deepEqual(new ConstantNode(true), new ConstantNode('true', 'boolean'));
    assert.deepEqual(new ConstantNode(false), new ConstantNode('false', 'boolean'));
    assert.deepEqual(new ConstantNode(null), new ConstantNode('null', 'null'));
    assert.deepEqual(new ConstantNode(undefined), new ConstantNode('undefined', 'undefined'));
  });

  it ('should have isConstantNode', function () {
    var node = new ConstantNode(1);
    assert(node.isConstantNode);
  });

  it ('should throw an error when calling without new operator', function () {
    assert.throws(function () {ConstantNode('3', 'number')}, SyntaxError);
  });

  it ('should throw an error in case of wrong construction arguments', function () {
    assert.throws(function () {new ConstantNode(3, 'number');}, TypeError);
    assert.throws(function () {new ConstantNode(new Date());}, TypeError);
    assert.throws(function () {new ConstantNode('3', Number);}, TypeError);
  });

  it ('should throw an error in case of unknown type of constant', function () {
    assert.throws(function () {new ConstantNode('3', 'bla').compile();}, TypeError);
  });

  it ('should compile a ConstantNode', function () {
    var expr = new ConstantNode('2.3', 'number').compile();
    assert.strictEqual(expr.eval(), 2.3);

    expr = new ConstantNode('002.3', 'number').compile();
    assert.strictEqual(expr.eval(), 2.3);

    expr = new ConstantNode('hello', 'string').compile();
    assert.strictEqual(expr.eval(), 'hello');

    expr = new ConstantNode('true', 'boolean').compile();
    assert.strictEqual(expr.eval(), true);

    expr = new ConstantNode('undefined', 'undefined').compile();
    assert.strictEqual(expr.eval(), undefined);

    expr = new ConstantNode('null', 'null').compile();
    assert.strictEqual(expr.eval(), null);

  });

  it ('should compile a ConstantNode with bigmath', function () {
    var expr = new bigmath.expression.node.ConstantNode('2.3', 'number').compile();
    assert.deepEqual(expr.eval(), new bigmath.type.BigNumber(2.3));
  });

  it ('should find a ConstantNode', function () {
    var a = new ConstantNode('2', 'number');
    assert.deepEqual(a.filter(function (node) {return node instanceof ConstantNode}),  [a]);
    assert.deepEqual(a.filter(function (node) {return node instanceof SymbolNode}), []);
  });

  it ('should throw an error when compiling an invalid value', function () {
    var clone = math.create();
    clone.config({number: 'number'});
    assert.throws(function () { new ConstantNode('console.log("foo")', 'number').compile() }, /Invalid numeric value/)
    clone.config({number: 'BigNumber'});
    assert.throws(function () { new ConstantNode('console.log("foo")', 'number').compile() }, /Invalid numeric value/)
    clone.config({number: 'Fraction'});
    assert.throws(function () { new ConstantNode('console.log("foo")', 'number').compile() }, /Invalid numeric value/)
  });

  it ('should escape quotes in strings', function () {
    assert.strictEqual( new ConstantNode('"+foo+"', 'string').compile().eval.toString(),
        'function (scope) {    if (scope) _validateScope(scope);    scope = scope || {};    return "\\"+foo+\\"";  }')

    assert.strictEqual( new ConstantNode('\\"escaped\\"', 'string').compile().eval.toString(),
        'function (scope) {    if (scope) _validateScope(scope);    scope = scope || {};    return "\\"escaped\\"";  }')
  });

  it ('should find a ConstantNode', function () {
    var a = new ConstantNode('2', 'number');
    assert.deepEqual(a.filter(function (node) {return node instanceof ConstantNode}),  [a]);
    assert.deepEqual(a.filter(function (node) {return node instanceof SymbolNode}), []);
  });

  it ('should run forEach on a ConstantNode', function () {
    var a = new ConstantNode(2);
    a.forEach(function () {
      assert.ok(false, 'should not execute, constant has no childs')
    });
  });

  it ('should map a ConstantNode', function () {
    var a = new ConstantNode(2);
    var b = a.map(function () {
      assert.ok(false, 'should not execute, constant has no childs')
    });

    assert.notStrictEqual(b, a);
    assert.deepEqual(b, a);
  });

  it ('should transform a ConstantNode', function () {
    var a = new ConstantNode(2);
    var b = new ConstantNode(3);
    var c = a.transform(function (node) {
      return node instanceof ConstantNode && node.value == '2' ? b : node;
    });
    assert.deepEqual(c,  b);

    // no match should leave the node as is
    var d = a.transform(function (node) {
      return node instanceof ConstantNode && node.value == '99' ? b : node;
    });
    assert.notStrictEqual(d, a);
    assert.deepEqual(d,  a);
  });

  it ('should clone a ConstantNode', function () {
    var a = new ConstantNode(2);
    var b = a.clone();

    assert(b instanceof ConstantNode);
    assert.deepEqual(a, b);
    assert.notStrictEqual(a, b);
    assert.equal(a.value, b.value);
    assert.equal(a.valueType, b.valueType);
  });

  it ('test equality another Node', function () {
    var a = new ConstantNode(2);

    assert.strictEqual(a.equals(null), false);
    assert.strictEqual(a.equals(undefined), false);
    assert.strictEqual(a.equals(new ConstantNode(2)), true);
    assert.strictEqual(a.equals(new ConstantNode(3)), false);
    assert.strictEqual(a.equals(new ConstantNode('2', 'number')), true);
    assert.strictEqual(a.equals(new ConstantNode('2', 'string')), false);
    assert.strictEqual(a.equals(new SymbolNode('2')), false);
    assert.strictEqual(a.equals({value:2, valueType: 'number'}), false);
  });

  it ('should stringify a ConstantNode', function () {
    assert.equal(new ConstantNode('3', 'number').toString(), '3');
    assert.deepEqual(new ConstantNode('3', 'number').toString(), '3');
    assert.equal(new ConstantNode('hi', 'string').toString(), '"hi"');
    assert.equal(new ConstantNode('true', 'boolean').toString(), 'true');
    assert.equal(new ConstantNode('false', 'boolean').toString(), 'false');
    assert.equal(new ConstantNode('undefined', 'undefined').toString(), 'undefined');
    assert.equal(new ConstantNode('null', 'null').toString(), 'null');
  });

  it ('should stringify a ConstantNode with custom toString', function () {
    //Also checks if the custom functions get passed on to the children
    var customFunction = function (node, options) {
      if (node.type === 'ConstantNode') {
        return 'const(' + node.value + ', ' + node.valueType + ')'
      }
    };

    var n = new ConstantNode(1);

    assert.equal(n.toString({handler: customFunction}), 'const(1, number)');
  });

  it ('should LaTeX a ConstantNode', function () {
    assert.equal(new ConstantNode('3', 'number').toTex(), '3');
    assert.deepEqual(new ConstantNode('3', 'number').toTex(), '3');
    assert.equal(new ConstantNode('hi', 'string').toTex(), '\\mathtt{"hi"}');
    assert.equal(new ConstantNode('true', 'boolean').toTex(), 'true');
    assert.equal(new ConstantNode('false', 'boolean').toTex(), 'false');
    assert.equal(new ConstantNode('undefined', 'undefined').toTex(), 'undefined');
    assert.equal(new ConstantNode('null', 'null').toTex(), 'null');
  });

  it ('should LaTeX a ConstantNode in exponential notation', function () {
    var n = new ConstantNode('1e10', 'number');
    assert.equal(n.toTex(), '1\\cdot10^{10}');
  });

  it ('should LaTeX a ConstantNode with custom toTex', function () {
    //Also checks if the custom functions get passed on to the children
    var customFunction = function (node, options) {
      if (node.type === 'ConstantNode') {
        return 'const\\left(' + node.value + ', ' + node.valueType + '\\right)'
      }
    };

    var n = new ConstantNode(1);

    assert.equal(n.toTex({handler: customFunction}), 'const\\left(1, number\\right)');
  });

  it('should escape strings in toTex', function () {
    var n = new ConstantNode('space tab\tunderscore_bla$/', 'string');

    assert.equal(n.toTex(), '\\mathtt{"space~tab\\qquad{}underscore\\_bla\\$/"}');
  });

});
