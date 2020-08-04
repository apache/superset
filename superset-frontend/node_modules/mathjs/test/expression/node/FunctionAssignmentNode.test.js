// test FunctionAssignmentNode
var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index').create();
var Node = math.expression.node.Node;
var ConstantNode = math.expression.node.ConstantNode;
var SymbolNode = math.expression.node.SymbolNode;
var AssignmentNode = math.expression.node.AssignmentNode;
var ConditionalNode = math.expression.node.ConditionalNode;
var OperatorNode = math.expression.node.OperatorNode;
var FunctionNode = math.expression.node.FunctionNode;
var FunctionAssignmentNode = math.expression.node.FunctionAssignmentNode;
var RangeNode = math.expression.node.RangeNode;

describe('FunctionAssignmentNode', function() {

  it ('should create a FunctionAssignmentNode', function () {
    var n = new FunctionAssignmentNode('f', ['x'], new ConstantNode(2));
    assert(n instanceof FunctionAssignmentNode);
    assert(n instanceof Node);
    assert.equal(n.type, 'FunctionAssignmentNode');
  });

  it ('should have isFunctionAssignmentNode', function () {
    var node = new FunctionAssignmentNode('f', ['x'], new ConstantNode(2));
    assert(node.isFunctionAssignmentNode);
  });

  it ('should throw an error when calling without new operator', function () {
    assert.throws(function () {FunctionAssignmentNode('f', ['x'], new ConstantNode(2))}, SyntaxError);
  });

  it ('should throw an error on wrong constructor arguments', function () {
    assert.throws(function () {new FunctionAssignmentNode()}, TypeError);
    assert.throws(function () {new FunctionAssignmentNode('a')}, TypeError);
    assert.throws(function () {new FunctionAssignmentNode('a', ['x'])}, TypeError);
    assert.throws(function () {new FunctionAssignmentNode(null, ['x'], new ConstantNode(2))}, TypeError);
  });

  it ('should compile a FunctionAssignmentNode', function () {
    var a = new ConstantNode(2);
    var x = new SymbolNode('x');
    var o = new OperatorNode('+', 'add', [a, x]);
    var n = new FunctionAssignmentNode('f', ['x'], o);

    var expr = n.compile();
    var scope = {};
    var f = expr.eval(scope);
    assert.equal(typeof scope.f, 'function');
    assert.equal(scope.f(3), 5);
    assert.equal(scope.f(5), 7);

  });

  it ('should compile a typed FunctionAssignmentNode', function () {
    var a = new ConstantNode(2);
    var x = new SymbolNode('x');
    var o = new OperatorNode('+', 'add', [a, x]);
    var n = new FunctionAssignmentNode('f', [{name: 'x', type: 'number' }], o);

    var expr = n.compile();
    var scope = {};
    var f = expr.eval(scope);
    assert.equal(typeof scope.f, 'function');
    assert.equal(scope.f(3), 5);
    assert.equal(scope.f(5), 7);
    assert.throws(function () { scope.f(new Date())}, /Unexpected type of argument in function f/);
    assert.throws(function () { scope.f(2, 2)}, /Too many arguments in function f/);
    assert.throws(function () { scope.f()}, /Too few arguments in function f/);
  });

  it ('should eval a recursive FunctionAssignmentNode', function () {
    var x = new SymbolNode('x');
    var one = new ConstantNode(1);
    var condition = new OperatorNode('<=', 'smallerEq', [x, one]);
    var truePart = one;
    var falsePart = new OperatorNode('*', 'multiply', [
      x,
      new FunctionNode(new SymbolNode('factorial'), [
        new OperatorNode('-', 'subtract', [
          x,
          one
        ])
      ])
    ]);
    var n1 = new ConditionalNode(condition, truePart, falsePart);

    var n2 = new FunctionAssignmentNode('factorial', ['x'], n1);

    var expr = n2.compile();
    var scope = {};
    var factorial = expr.eval(scope);
    assert.equal(typeof scope.factorial, 'function');
    assert.equal(factorial(3), 6);
    assert.equal(factorial(5), 120);
  });

  it ('should eval a recursive FunctionAssignmentNode with two recursive calls', function () {
    var x = new SymbolNode('x');
    var zero = new ConstantNode(0);
    var one = new ConstantNode(1);
    var two = new ConstantNode(2);

    var n1 = new ConditionalNode(
        new OperatorNode('<=', 'smallerEq', [x, zero]),
        zero,
        new ConditionalNode(
            new OperatorNode('<=', 'smallerEq', [x, two]),
            one,
            new OperatorNode('+', 'add', [
              new FunctionNode(new SymbolNode('fib'), [
                new OperatorNode('-', 'subtract', [ x, one ])
              ]),
              new FunctionNode(new SymbolNode('fib'), [
                new OperatorNode('-', 'subtract', [ x, two ])
              ])
            ])
        )
    );

    var n2 = new FunctionAssignmentNode('fib', ['x'], n1);
    //var n2 = math.parse('fib(x) = (x <= 0) ? 0 : ((x <= 2) ? 1 : (fib(x - 1) + f(fib - 2)))');

    var expr = n2.compile();
    var scope = {};
    var fib = expr.eval(scope);

    assert.equal(typeof fib, 'function');
    assert.equal(fib(0), 0);
    assert.equal(fib(1), 1);
    assert.equal(fib(2), 1);
    assert.equal(fib(3), 2);
    assert.equal(fib(4), 3);
    assert.equal(fib(5), 5);
    assert.equal(fib(6), 8);
    assert.equal(fib(7), 13);
    assert.equal(fib(8), 21);
  });

  it ('should pass function arguments in scope to functions with rawArgs', function () {
    var outputScope = function (args, math, scope) {
      return scope;
    }
    outputScope.rawArgs = true;
    math.import({ outputScope: outputScope }, { override: true });

    // f(x) = outputScope(x)
    var x = new SymbolNode('x');
    var o = new FunctionNode('outputScope', [x]);
    var n = new FunctionAssignmentNode('f', ['x'], o);

    var scope = {a: 2};
    var f = n.eval(scope);
    assert.deepEqual(f(3), {a: 2, f: f, x: 3});
  });

  it ('should pass function arguments in scope to functions with rawArgs returned by another function', function () {
    var outputScope = function (args, math, scope) {
      return scope;
    }

    outputScope.rawArgs = true;
    var returnOutputScope = function () {
      return outputScope
    }

    math.import({
      outputScope: outputScope,
      returnOutputScope: returnOutputScope
    }, { override: true });

    // f(x, y) = returnOutputScope(x)(y)
    var a = new FunctionNode('returnOutputScope', [new SymbolNode('x')]);
    var b = new FunctionNode(a, [new SymbolNode('y')]);
    var n = new FunctionAssignmentNode('f', ['x', 'y'], b);

    var scope = {a: 2};
    var f = n.eval(scope);
    assert.deepEqual(f(3, 4), {a: 2, f: f, x: 3, y: 4});
  });

  it ('should pass function arguments in scope to functions with rawArgs and transform', function () {
    var outputScope = function (x) {
      return 'should not occur'
    }
    outputScope.transform = function (args, math, scope) {
      return scope;
    }
    outputScope.transform.rawArgs = true;
    math.import({ outputScope: outputScope }, { override: true });

    // f(x) = outputScope(x)
    var x = new SymbolNode('x');
    var o = new FunctionNode('outputScope', [x]);
    var n = new FunctionAssignmentNode('f', ['x'], o);

    var scope = {a: 2};
    var f = n.eval(scope);
    assert.deepEqual(f(3), {a: 2, f: f, x: 3});
  });

  it ('should filter a FunctionAssignmentNode', function () {
    var a = new ConstantNode(2);
    var x = new SymbolNode('x');
    var o = new OperatorNode('+', 'add', [a, x]);
    var n = new FunctionAssignmentNode('f', ['x'], o);

    assert.deepEqual(n.filter(function (node) {return node instanceof FunctionAssignmentNode}),  [n]);
    assert.deepEqual(n.filter(function (node) {return node instanceof SymbolNode}),    [x]);
    assert.deepEqual(n.filter(function (node) {return node instanceof RangeNode}),     []);
    assert.deepEqual(n.filter(function (node) {return node instanceof ConstantNode}),  [a]);
    assert.deepEqual(n.filter(function (node) {return node instanceof ConstantNode && node.value == '2'}),  [a]);
    assert.deepEqual(n.filter(function (node) {return node instanceof ConstantNode && node.value == '4'}),  []);
  });

  it ('should throw an error when creating a FunctionAssignmentNode with a reserved keyword', function () {
    assert.throws(function () {
      new FunctionAssignmentNode('end', ['x'], new ConstantNode(2));
    }, /Illegal function name/)
  });

  it ('should filter a FunctionAssignmentNode without expression', function () {
    var e = new FunctionAssignmentNode('f', ['x'], new ConstantNode(2));

    assert.deepEqual(e.filter(function (node) {return node instanceof FunctionAssignmentNode}),  [e]);
    assert.deepEqual(e.filter(function (node) {return node instanceof SymbolNode}),    []);
  });

  it ('should run forEach on a FunctionAssignmentNode', function () {
    var a = new ConstantNode(2);
    var n = new FunctionAssignmentNode('f', ['x'], a);

    var nodes = [];
    var paths = [];
    n.forEach(function (node, path, parent) {
      nodes.push(node);
      paths.push(path);
      assert.strictEqual(parent, n);
    });

    assert.equal(nodes.length, 1);
    assert.strictEqual(nodes[0], a);
    assert.deepEqual(paths, ['expr']);
  });

  it ('should map a FunctionAssignmentNode', function () {
    var a = new ConstantNode(2);
    var n = new FunctionAssignmentNode('f', ['x'], a);

    var nodes = [];
    var paths = [];
    var e = new ConstantNode(3);
    var f = n.map(function (node, path, parent) {
      nodes.push(node);
      paths.push(path);
      assert.strictEqual(parent, n);

      return node instanceof SymbolNode && node.name == 'x' ? e : node;
    });

    assert.equal(nodes.length, 1);
    assert.strictEqual(nodes[0], a);
    assert.deepEqual(paths, ['expr']);

    assert.notStrictEqual(f, n);
    assert.deepEqual(f.expr, a);
  });

  it ('should throw an error when the map callback does not return a node', function () {
    var a = new ConstantNode(2);
    var n = new FunctionAssignmentNode('f', ['x'], a);

    assert.throws(function () {
      n.map(function () {});
    }, /Callback function must return a Node/)
  });

  it ('should transform a FunctionAssignmentNodes (nested) parameters', function () {
    // f(x) = 2 + x
    var a = new ConstantNode(2);
    var x = new SymbolNode('x');
    var c = new OperatorNode('+', 'add', [a, x]);
    var n = new FunctionAssignmentNode('f', ['x'], c);

    var e = new ConstantNode(3);
    var f = n.transform(function (node) {
      return node instanceof SymbolNode && node.name == 'x' ? e : node;
    });

    assert.notStrictEqual(f, n);
    assert.deepEqual(f.expr.args[0], a);
    assert.deepEqual(f.expr.args[1], e);
  });

  it ('should transform a FunctionAssignmentNode itself', function () {
    // f(x) = 2 + x
    var a = new ConstantNode(2);
    var x = new SymbolNode('x');
    var c = new OperatorNode('+', 'add', [a, x]);
    var n = new FunctionAssignmentNode('f', ['x'], c);

    var e = new ConstantNode(5);
    var f = n.transform(function (node) {
      return node instanceof FunctionAssignmentNode ? e : node;
    });

    assert.notStrictEqual(f, n);
    assert.deepEqual(f, e);
  });

  it ('should clone a FunctionAssignmentNode', function () {
    // f(x) = 2 + x
    var a = new ConstantNode(2);
    var x = new SymbolNode('x');
    var c = new OperatorNode('+', 'add', [a, x]);
    var d = new FunctionAssignmentNode('f', ['x'], c);

    var e = d.clone();
    assert(e instanceof FunctionAssignmentNode);
    assert.deepEqual(e, d);
    assert.notStrictEqual(e, d);
    assert.strictEqual(e.expr, d.expr);
  });

  it ('test equality another Node', function () {
    var a = new FunctionAssignmentNode('f', ['x'],
        new OperatorNode('+', 'add', [new ConstantNode(2), new SymbolNode('x')]));
    var b = new FunctionAssignmentNode('f', ['x'],
        new OperatorNode('+', 'add', [new ConstantNode(2), new SymbolNode('x')]));
    var c = new FunctionAssignmentNode('g', ['x'],
        new OperatorNode('+', 'add', [new ConstantNode(2), new SymbolNode('x')]));
    var d = new FunctionAssignmentNode('f', ['y'],
        new OperatorNode('+', 'add', [new ConstantNode(2), new SymbolNode('x')]));
    var e = new FunctionAssignmentNode('f', ['x'],
        new OperatorNode('+', 'add', [new ConstantNode(3), new SymbolNode('x')]));
    var f = new SymbolNode('add');

    assert.strictEqual(a.equals(null), false);
    assert.strictEqual(a.equals(undefined), false);
    assert.strictEqual(a.equals(b), true);
    assert.strictEqual(a.equals(c), false);
    assert.strictEqual(a.equals(d), false);
    assert.strictEqual(a.equals(e), false);
    assert.strictEqual(a.equals(f), false);
  });

  it ('should respect the \'all\' parenthesis option', function () {
    var expr = math.parse('f(x)=x+1');
    assert.equal(expr.toString({parenthesis: 'all'}), 'f(x) = (x + 1)');
    assert.equal(expr.toTex({parenthesis: 'all'}), '\\mathrm{f}\\left(x\\right):=\\left( x+1\\right)');
  });

  it ('should stringify a FunctionAssignmentNode', function () {
    var a = new ConstantNode(2);
    var x = new SymbolNode('x');
    var o = new OperatorNode('+', 'add', [a, x]);
    var n = new FunctionAssignmentNode('f', ['x'], o);

    assert.equal(n.toString(), 'f(x) = 2 + x');
  });

  it ('should stringify a FunctionAssignmentNode conataining an AssignmentNode', function () {
    var a = new ConstantNode(2);

    var n1 = new AssignmentNode(new SymbolNode('a'), a);
    var n = new FunctionAssignmentNode('f', ['x'], n1);

    assert.equal(n.toString(), 'f(x) = (a = 2)');
  });

  it ('should stringify a FunctionAssignmentNode with custom toString', function () {
    //Also checks if the custom functions get passed on to the children
    var customFunction = function (node, options) {
      if (node.type === 'FunctionAssignmentNode') {
        var string = '[' + node.name + '](';
        node.params.forEach(function (param) {
          string += param + ', ';
        });

        string += ')=' + node.expr.toString(options);
        return string;
      }
      else if (node.type === 'ConstantNode') {
        return 'const(' + node.value + ', ' + node.valueType + ')'
      }
    };

    var a = new ConstantNode(1);

    var n = new FunctionAssignmentNode('func', ['x'], a);

    assert.equal(n.toString({handler: customFunction}), '[func](x, )=const(1, number)');
  });

  it ('should LaTeX a FunctionAssignmentNode', function() {
    var a = new ConstantNode(2);
    var x = new SymbolNode('x');
    var o = new OperatorNode('/', 'divide', [x, a]);
    var p = new OperatorNode('^', 'pow', [o, a]);
    var n = new FunctionAssignmentNode('f', ['x'], p);

    assert.equal(n.toTex(), '\\mathrm{f}\\left(x\\right):=\\left({\\frac{ x}{2}}\\right)^{2}');
  });

  it ('should LaTeX a FunctionAssignmentNode containing an AssignmentNode', function () {
    var a = new ConstantNode(2);

    var n1 = new AssignmentNode(new SymbolNode('a'), a);
    var n = new FunctionAssignmentNode('f', ['x'], n1);

    assert.equal(n.toTex(), '\\mathrm{f}\\left(x\\right):=\\left( a:=2\\right)');
  });

  it ('should LaTeX a FunctionAssignmentNode with custom toTex', function () {
    //Also checks if the custom functions get passed on to the children
    var customFunction = function (node, options) {
      if (node.type === 'FunctionAssignmentNode') {
        var latex = '\\mbox{' + node.name + '}\\left(';
        node.params.forEach(function (param) {
          latex += param + ', ';
        });

        latex += '\\right)=' + node.expr.toTex(options);
        return latex;
      }
      else if (node.type === 'ConstantNode') {
        return 'const\\left(' + node.value + ', ' + node.valueType + '\\right)'
      }
    };

    var a = new ConstantNode(1);

    var n = new FunctionAssignmentNode('func', ['x'], a);

    assert.equal(n.toTex({handler: customFunction}), '\\mbox{func}\\left(x, \\right)=const\\left(1, number\\right)');
  });

});
