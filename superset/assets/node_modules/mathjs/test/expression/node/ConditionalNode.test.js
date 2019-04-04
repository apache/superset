// test ConditionalNode
var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var Node = math.expression.node.Node;
var ConstantNode = math.expression.node.ConstantNode;
var SymbolNode = math.expression.node.SymbolNode;
var AssignmentNode = math.expression.node.AssignmentNode;
var ConditionalNode = math.expression.node.ConditionalNode;

describe('ConditionalNode', function() {
  var condition = new ConstantNode(true);
  var zero = new ConstantNode(0);
  var one = new ConstantNode(1);
  var two = new ConstantNode(2);
  var three = new ConstantNode(3);
  var a = new AssignmentNode(new SymbolNode('a'), two);
  var b = new AssignmentNode(new SymbolNode('b'), three);

  it ('should create a ConditionalNode', function () {
    var n = new ConditionalNode(condition, a, b);
    assert(n instanceof ConditionalNode);
    assert(n instanceof Node);
    assert.equal(n.type, 'ConditionalNode');
  });

  it ('should have isConditionalNode', function () {
    var node = new ConditionalNode(condition, a, b);
    assert(node.isConditionalNode);
  });

  it ('should throw an error when calling without new operator', function () {
    assert.throws(function () {ConditionalNode()}, SyntaxError);
  });

  it ('should throw an error when creating without arguments', function () {
    assert.throws(function () {new ConditionalNode()}, TypeError);
    assert.throws(function () {new ConditionalNode(condition)}, TypeError);
    assert.throws(function () {new ConditionalNode(condition, a)}, TypeError);
    assert.throws(function () {new ConditionalNode(condition, null, b)}, TypeError);
  });

  it ('should lazy evaluate a ConditionalNode', function () {
    var n = new ConditionalNode(condition, a, b);
    var expr = n.compile();
    var scope = {};
    assert.equal(expr.eval(scope), 2);
    assert.deepEqual(scope, {a: 2});
  });

  describe('evaluate', function () {
    var condition = new ConditionalNode(new SymbolNode('a'), one, zero);

    it('should evaluate boolean conditions', function() {
      assert.equal(condition.compile().eval({a: true}), 1);
      assert.equal(condition.compile().eval({a: false}), 0);
    });

    it('should evaluate number conditions', function() {
      assert.equal(condition.compile().eval({a: 1}), 1);
      assert.equal(condition.compile().eval({a: 4}), 1);
      assert.equal(condition.compile().eval({a: -1}), 1);
      assert.equal(condition.compile().eval({a: 0}), 0);
    });

    it('should evaluate bignumber conditions', function() {
      assert.equal(condition.compile().eval({a: math.bignumber(1)}), 1);
      assert.equal(condition.compile().eval({a: math.bignumber(4)}), 1);
      assert.equal(condition.compile().eval({a: math.bignumber(-1)}), 1);
      assert.equal(condition.compile().eval({a: math.bignumber(0)}), 0);
    });

    it('should evaluate complex number conditions', function() {
      assert.equal(condition.compile().eval({a: math.complex(2, 3)}), 1);
      assert.equal(condition.compile().eval({a: math.complex(2, 0)}), 1);
      assert.equal(condition.compile().eval({a: math.complex(0, 3)}), 1);
      assert.equal(condition.compile().eval({a: math.complex(0, 0)}), 0);
    });

    it('should evaluate string conditions', function() {
      assert.equal(condition.compile().eval({a: 'hello'}), 1);
      assert.equal(condition.compile().eval({a: ''}), 0);
    });

    it('should evaluate unit conditions', function() {
      assert.equal(condition.compile().eval({a: math.unit('5cm')}), 1);
      assert.equal(condition.compile().eval({a: math.unit('0 inch')}), 0);
      assert.equal(condition.compile().eval({a: math.unit('meter')}), 0);
    });

    it('should evaluate null conditions', function() {
      assert.equal(condition.compile().eval({a: null}), 0);
    });

    it('should evaluate undefined conditions', function() {
      assert.equal(condition.compile().eval({a: undefined}), 0);
    });

    it('should throw an error in case of unsupported type of conditions', function() {
      assert.throws(function () {condition.compile().eval({a: {}})});
      assert.throws(function () {condition.compile().eval({a: []})});
      assert.throws(function () {condition.compile().eval({a: math.matrix()})});
    });
  });

  it ('should filter a ConditionalNode', function () {
    var n = new ConditionalNode(condition, a, b);

    assert.deepEqual(n.filter(function (node) {return node instanceof ConditionalNode}),  [n]);
    assert.deepEqual(n.filter(function (node) {return node instanceof ConstantNode}),  [condition, two, three]);
    assert.deepEqual(n.filter(function (node) {return node instanceof ConstantNode && node.value == '2'}),  [two]);
  });

  it ('should run forEach on a ConditionalNode', function () {
    var condition = new ConstantNode(1);
    var a = new ConstantNode(2);
    var b = new ConstantNode(3);
    var n = new ConditionalNode(condition, a, b);

    var nodes = [];
    var paths = [];
    n.forEach(function (node, path, parent) {
      nodes.push(node);
      paths.push(path);
      assert.strictEqual(parent, n);
    });

    assert.equal(nodes.length, 3);
    assert.strictEqual(nodes[0], condition);
    assert.strictEqual(nodes[1], a);
    assert.strictEqual(nodes[2], b);
    assert.deepEqual(paths, ['condition', 'trueExpr', 'falseExpr']);
  });

  it ('should map a ConditionalNode', function () {
    var condition = new ConstantNode(1);
    var a = new ConstantNode(2);
    var b = new ConstantNode(3);
    var n = new ConditionalNode(condition, a, b);

    var nodes = [];
    var paths = [];
    var e = new ConstantNode(4);
    var f = n.map(function (node, path, parent) {
      nodes.push(node);
      paths.push(path);
      assert.strictEqual(parent, n);

      return node instanceof ConstantNode && node.value == '1' ? e : node;
    });

    assert.equal(nodes.length, 3);
    assert.strictEqual(nodes[0], condition);
    assert.strictEqual(nodes[1], a);
    assert.strictEqual(nodes[2], b);
    assert.deepEqual(paths, ['condition', 'trueExpr', 'falseExpr']);

    assert.notStrictEqual(f, n);
    assert.strictEqual(f.condition,  e);
    assert.strictEqual(f.trueExpr,  a);
    assert.strictEqual(f.falseExpr,  b);
  });

  it ('should throw an error when the map callback does not return a node', function () {
    var condition = new ConstantNode(1);
    var a = new ConstantNode(2);
    var b = new ConstantNode(3);
    var n = new ConditionalNode(condition, a, b);

    assert.throws(function () {
      n.map(function () {});
    }, /Callback function must return a Node/)
  });

  it ('should transform a ConditionalNodes condition', function () {
    var condition = new ConstantNode(1);
    var a = new ConstantNode(2);
    var b = new ConstantNode(3);
    var n = new ConditionalNode(condition, a, b);

    var e = new ConstantNode(4);
    var f = n.transform(function (node) {
      return node instanceof ConstantNode && node.value == '1' ? e : node;
    });

    assert.notStrictEqual(f, n);
    assert.deepEqual(f.condition, e);
    assert.deepEqual(f.trueExpr, a);
    assert.deepEqual(f.falseExpr, b);
  });

  it ('should transform a ConditionalNodes trueExpr', function () {
    var condition = new ConstantNode(1);
    var a = new ConstantNode(2);
    var b = new ConstantNode(3);
    var n = new ConditionalNode(condition, a, b);

    var e = new ConstantNode(4);
    var f = n.transform(function (node) {
      return node instanceof ConstantNode && node.value == '2' ? e : node;
    });

    assert.notStrictEqual(f, n);
    assert.deepEqual(f.condition, condition);
    assert.deepEqual(f.trueExpr, e);
    assert.deepEqual(f.falseExpr, b);
  });

  it ('should transform a ConditionalNodes falseExpr', function () {
    var condition = new ConstantNode(1);
    var a = new ConstantNode(2);
    var b = new ConstantNode(3);
    var n = new ConditionalNode(condition, a, b);

    var e = new ConstantNode(4);
    var f = n.transform(function (node) {
      return node instanceof ConstantNode && node.value == '3' ? e : node;
    });

    assert.notStrictEqual(f, n);
    assert.deepEqual(f.condition, condition);
    assert.deepEqual(f.trueExpr, a);
    assert.deepEqual(f.falseExpr, e);
  });

  it ('should transform a ConditionalNode itself', function () {
    var condition = new ConstantNode(1);
    var a = new ConstantNode(2);
    var b = new ConstantNode(3);
    var n = new ConditionalNode(condition, a, b);

    var e = new ConstantNode(5);
    var f = n.transform(function (node) {
      return node instanceof ConditionalNode ? e : node;
    });

    assert.notStrictEqual(f, n);
    assert.deepEqual(f, e);
  });

  it ('should clone a ConditionalNode itself', function () {
    var condition = new ConstantNode(1);
    var a = new ConstantNode(2);
    var b = new ConstantNode(3);
    var c = new ConditionalNode(condition, a, b);

    var d = c.clone();

    assert(d instanceof ConditionalNode);
    assert.deepEqual(d, c);
    assert.notStrictEqual(d, c);
    assert.strictEqual(d.condition, c.condition);
    assert.strictEqual(d.trueExpr, c.trueExpr);
    assert.strictEqual(d.falseExpr, c.falseExpr);
  });

  it ('test equality another Node', function () {
    var a = new ConditionalNode(new ConstantNode(1), new ConstantNode(2), new ConstantNode(3));
    var b = new ConditionalNode(new ConstantNode(1), new ConstantNode(2), new ConstantNode(3));
    var c = new ConditionalNode(new SymbolNode('x'), new ConstantNode(2), new ConstantNode(3));
    var d = new ConditionalNode(new ConstantNode(1), new ConstantNode(5), new ConstantNode(3));
    var e = new ConditionalNode(new ConstantNode(1), new ConstantNode(2), new ConstantNode(55));

    assert.strictEqual(a.equals(null), false);
    assert.strictEqual(a.equals(undefined), false);
    assert.strictEqual(a.equals(b), true);
    assert.strictEqual(a.equals(c), false);
    assert.strictEqual(a.equals(d), false);
    assert.strictEqual(a.equals(e), false);
  });

  it ('should respect the \'all\' parenthesis option', function () {
    assert.equal(math.parse('a?b:c').toString({parenthesis: 'all'}), '(a) ? (b) : (c)');
  });

  it ('should stringify a ConditionalNode', function () {
    var n = new ConditionalNode(condition, a, b);

    assert.equal(n.toString(), 'true ? (a = 2) : (b = 3)');
  });

  it ('should stringify a ConditionalNode with custom toString', function () {
    //Also checks if the custom functions get passed on to the children
    var customFunction = function (node, options) {
      if (node.type === 'ConditionalNode') {
        return 'if ' + node.condition.toString(options)
          + ' then ' + node.trueExpr.toString(options)
          + ' else ' + node.falseExpr.toString(options);
      }
      else if (node.type === 'ConstantNode') {
        return 'const(' + node.value + ', ' + node.valueType + ')'
      }
    };

    var a = new ConstantNode(1);
    var b = new ConstantNode(2);
    var c = new ConstantNode(3);

    var n = new ConditionalNode(a, b, c);

    assert.equal(n.toString({handler: customFunction}), 'if const(1, number) then const(2, number) else const(3, number)');
  });

  it ('should LaTeX a ConditionalNode', function () {
    var n = new ConditionalNode(condition, a, b);

    // note that b is enclosed in \\mathrm{...} since it's a unit
    assert.equal(n.toTex(), '\\begin{cases} { a:=2}, &\\quad{\\text{if }\\;true}\\\\{\\mathrm{b}:=3}, &\\quad{\\text{otherwise}}\\end{cases}');
  });

  it ('should LaTeX a ConditionalNode with custom toTex', function () {
    //Also checks if the custom functions get passed on to the children
    var customFunction = function (node, options) {
      if (node.type === 'ConditionalNode') {
        return 'if ' + node.condition.toTex(options)
          + ' then ' + node.trueExpr.toTex(options)
          + ' else ' + node.falseExpr.toTex(options);
      }
      else if (node.type === 'ConstantNode') {
        return 'const\\left(' + node.value + ', ' + node.valueType + '\\right)'
      }
    };

    var a = new ConstantNode(1);
    var b = new ConstantNode(2);
    var c = new ConstantNode(3);

    var n = new ConditionalNode(a, b, c);

    assert.equal(n.toTex({handler: customFunction}), 'if const\\left(1, number\\right) then const\\left(2, number\\right) else const\\left(3, number\\right)');
  });

});
