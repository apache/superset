// test SymbolNode
var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var Node = math.expression.node.Node;
var ConstantNode = math.expression.node.ConstantNode;
var SymbolNode = math.expression.node.SymbolNode;
var OperatorNode = math.expression.node.OperatorNode;

describe('SymbolNode', function() {

  it ('should create a SymbolNode', function () {
    var n = new SymbolNode('sqrt');
    assert(n instanceof SymbolNode);
    assert(n instanceof Node);
    assert.equal(n.type, 'SymbolNode');
  });

  it ('should have isSymbolNode', function () {
    var node = new SymbolNode('a');
    assert(node.isSymbolNode);
  });

  it ('should throw an error when calling without new operator', function () {
    assert.throws(function () {SymbolNode('sqrt')}, SyntaxError);
  });

  it ('should throw an error when calling with wrong arguments', function () {
    assert.throws(function () {new SymbolNode()}, TypeError);
    assert.throws(function () {new SymbolNode(2)}, TypeError);
  });

  it ('should throw an error when evaluating an undefined symbol', function () {
    var scope = {};
    var s = new SymbolNode('foo');
    assert.throws(function () {s.compile().eval(scope)}, Error);
  });

  it ('should compile a SymbolNode', function () {
    var s = new SymbolNode('a');

    var expr = s.compile();
    var scope = {a: 5};
    assert.equal(expr.eval(scope), 5);
    assert.throws(function () {expr.eval({})}, Error);

    var s2 = new SymbolNode('sqrt');
    var expr2 = s2.compile();
    var scope2 = {};
    assert.strictEqual(expr2.eval(scope2), math.sqrt);
  });

  it ('should filter a SymbolNode', function () {
    var n = new SymbolNode('x');
    assert.deepEqual(n.filter(function (node) {return node instanceof SymbolNode}),  [n]);
    assert.deepEqual(n.filter(function (node) {return node.name == 'x'}),  [n]);
    assert.deepEqual(n.filter(function (node) {return node.name == 'q'}),  []);
    assert.deepEqual(n.filter(function (node) {return node instanceof ConstantNode}),  []);
  });

  it ('should run forEach on a SymbolNode', function () {
    var a = new SymbolNode('a');
    a.forEach(function () {
      assert.ok(false, 'should not execute, symbol has no childs')
    });
  });

  it ('should map a SymbolNode', function () {
    var a = new SymbolNode('a');
    var c = new SymbolNode('c');
    var b = a.map(function () {
      assert.ok(false, 'should not execute, symbol has no childs')
    });

    assert.notStrictEqual(b, a);
    assert.deepEqual(b, a);
  });

  it ('should transform a SymbolNode', function () {
    var a = new SymbolNode('x');
    var b = new SymbolNode('y');
    var c = a.transform(function (node) {
      return node instanceof SymbolNode && node.name == 'x' ? b : node;
    });
    assert.deepEqual(c,  b);

    // no match should leave the symbol as is
    var d = a.transform(function (node) {
      return node instanceof SymbolNode && node.name == 'q' ? b : node;
    });
    assert.deepEqual(d,  a);
  });

  it ('should clone a SymbolNode', function () {
    var a = new SymbolNode('x');
    var b = a.clone();

    assert(b instanceof SymbolNode);
    assert.deepEqual(a, b);
    assert.notStrictEqual(a, b);
    assert.equal(a.name, b.name);
  });

  it ('test equality another Node', function () {
    var a = new SymbolNode('a');
    var b = new SymbolNode('b');
    var aEqual = new SymbolNode('a');
    var aFake = {
      name: 'a'
    };

    assert.strictEqual(a.equals(null), false);
    assert.strictEqual(a.equals(undefined), false);
    assert.strictEqual(a.equals(aEqual), true);
    assert.strictEqual(a.equals(b), false);
    assert.strictEqual(a.equals(aFake), false);
    assert.strictEqual(a.equals(new ConstantNode(2)), false);
  });

  it ('should stringify a SymbolNode', function () {
    var s = new SymbolNode('foo');

    assert.equal(s.toString(), 'foo');
  });

  it ('should stringigy a SymbolNode with custom toString', function () {
    //Also checks if the custom functions get passed on to the children
    var customFunction = function (node, options) {
      if (node.type === 'SymbolNode') {
        return 'symbol(' + node.name + ')';
      }
    };

    var n = new SymbolNode('a');

    assert.equal(n.toString({handler: customFunction}), 'symbol(a)');
  });

  it ('should LaTeX a SymbolNode', function () {
    var s = new SymbolNode('foo');

    assert.equal(s.toTex(), ' foo');
  });

  it ('should LaTeX a SymbolNode with custom toTex', function () {
    //Also checks if the custom functions get passed on to the children
    var customFunction = function (node, options) {
      if (node.type === 'SymbolNode') {
        return 'symbol(' + node.name + ')';
      }
    };

    var n = new SymbolNode('a');

    assert.equal(n.toTex({handler: customFunction}), 'symbol(a)');
  });

  it ('should LaTeX a SymbolNode without breaking \\cdot', function () {
    var a = new ConstantNode(1);
    var b = new SymbolNode('Epsilon');

    var mult = new OperatorNode('*', 'multiply', [a,b]);

    assert.equal(mult.toTex(), '1\\cdot E');
  });

});
