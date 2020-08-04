// test AssignmentNode
var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var Node = math.expression.node.Node;
var AccessorNode = math.expression.node.AccessorNode;
var ConstantNode = math.expression.node.ConstantNode;
var SymbolNode = math.expression.node.SymbolNode;
var RangeNode = math.expression.node.RangeNode;
var ArrayNode = math.expression.node.ArrayNode;
var AssignmentNode = math.expression.node.AssignmentNode;
var OperatorNode = math.expression.node.OperatorNode;
var IndexNode = math.expression.node.IndexNode;

describe('AssignmentNode', function() {

  it ('should create an AssignmentNode', function () {
    var n = new AssignmentNode(new SymbolNode('a'), new Node());
    assert(n instanceof AssignmentNode);
    assert(n instanceof Node);
    assert.equal(n.type, 'AssignmentNode');
  });

  it ('should have property isAssignmentNode', function () {
    var node = new AssignmentNode(new SymbolNode('a'), new Node());
    assert(node.isAssignmentNode);
  });

  it ('should throw an error when calling without new operator', function () {
    assert.throws(function () {AssignmentNode(new SymbolNode('a'), new Node())}, SyntaxError);
  });

  it ('should throw an error when creating an AssignmentNode with a reserved keyword', function () {
    assert.throws(function () {
      new AssignmentNode(new SymbolNode('end'), new Node());
    }, /Cannot assign to symbol "end"/)
  });

  it ('should throw an error on wrong constructor arguments', function () {
    assert.throws(function () {new AssignmentNode()}, TypeError );
    assert.throws(function () {new AssignmentNode(new Node(), new Node())}, TypeError );
    assert.throws(function () {new AssignmentNode('a', new Node())}, TypeError );
    assert.throws(function () {new AssignmentNode(2, new Node())}, TypeError );
    assert.throws(function () {new AssignmentNode(new Node(), new Node(), new Node())}, TypeError );
  });

  it ('should get the name of an AssignmentNode', function () {
    var n = new AssignmentNode(new SymbolNode('a'), new ConstantNode(1));
    assert.equal(n.name, 'a');

    var n2 = new AccessorNode(new SymbolNode('a'), new IndexNode([new ConstantNode('b')]));
    var n3 = new AssignmentNode(n2, new ConstantNode(1));
    assert.equal(n3.name, 'b');

    var n4 = new AssignmentNode(new SymbolNode('a'), new IndexNode([new ConstantNode('b')]), new ConstantNode(1));
    assert.equal(n4.name, 'b');

    var n5 = new AssignmentNode(new SymbolNode('a'), new IndexNode([new ConstantNode(1)]), new ConstantNode(1));
    assert.equal(n5.name, '');
  });

  it ('should compile an AssignmentNode without index', function () {
    var n = new AssignmentNode(new SymbolNode('b'), new ConstantNode(3));

    var expr = n.compile();

    var scope = {};
    assert.equal(expr.eval(scope), 3);
    assert.equal(scope.b, 3);
  });

  it ('should compile an AssignmentNode with property index', function () {
    var object = new SymbolNode('a');
    var index = new IndexNode([new ConstantNode('b')]);
    var value = new ConstantNode(3);
    var n = new AssignmentNode(object, index, value);

    var expr = n.compile();

    var scope = {
      a: {}
    };
    assert.equal(expr.eval(scope), 3);
    assert.deepEqual(scope, {a: {b: 3}});
  });

  it ('should compile an AssignmentNode with nested property index', function () {
    var a = new SymbolNode('a');
    var object = new AccessorNode(a, new IndexNode([new ConstantNode('b')]));
    var index = new IndexNode([new ConstantNode('c')]);
    var value = new ConstantNode(3);
    var n = new AssignmentNode(object, index, value);

    var expr = n.compile();

    var scope = {
      a: {
        b: {}
      }
    };
    assert.equal(expr.eval(scope), 3);
    assert.deepEqual(scope, {a: {b: {c: 3}}});
  });

  it ('should compile an AssignmentNode with matrix index', function () {
    var object = new SymbolNode('a');
    var index = new IndexNode([
      new ConstantNode(2),
      new ConstantNode(1)
    ]);
    var value = new ConstantNode(5);
    var n = new AssignmentNode(object, index, value);
    var expr = n.compile();

    var scope = {
      a: [[0, 0], [0, 0]]
    };
    assert.strictEqual(expr.eval(scope), 5);
    assert.deepEqual(scope, {
      a: [[0, 0], [5, 0]]
    });
  });

  it ('should compile an AssignmentNode with range and context parameters', function () {
    var object = new SymbolNode('a');
    var index = new IndexNode([
      new ConstantNode(2),
      new RangeNode(
          new ConstantNode(1),
          new SymbolNode('end')
      )
    ]);
    var value = new SymbolNode('b');
    var n = new AssignmentNode(object, index, value);
    var expr = n.compile();

    var scope = {
      a: [[0, 0], [0, 0]],
      b: [5, 6]
    };
    assert.deepEqual(expr.eval(scope), [5, 6]);
    assert.deepEqual(scope, {
      a: [[0, 0], [5, 6]],
      b: [5, 6]
    });
  });

  it ('should compile an AssignmentNode with bignumber setting', function () {
    var bigmath = math.create({number: 'BigNumber'});

    var object = new bigmath.expression.node.SymbolNode('a');
    var index = new bigmath.expression.node.IndexNode([
      new bigmath.expression.node.ConstantNode(2),
      new bigmath.expression.node.ConstantNode(1)
    ]);
    var value = new bigmath.expression.node.ConstantNode(5);
    var n = new bigmath.expression.node.AssignmentNode(object, index, value);
    var expr = n.compile();

    var scope = {
      a: [[0, 0], [0, 0]]
    };
    assert.deepEqual(expr.eval(scope), bigmath.bignumber(5));
    assert.deepEqual(scope, {
      a: [[0, 0], [bigmath.bignumber(5), 0]]
    });
  });

  it ('should throw an error when applying an index onto a scalar', function () {
    var a = new SymbolNode('a');
    var index = new IndexNode([new ConstantNode(4)]);
    var value = new ConstantNode(2);
    var n = new AssignmentNode(a, index, value);
    var expr = n.compile();

    var scope = {
      a: 42
    };
    assert.throws(function () { expr.eval(scope) }, /Cannot apply index: unsupported type of object/);
  });

  it ('should filter an AssignmentNode', function () {
    var a = new SymbolNode('a');
    var b = new ConstantNode(2);
    var c = new ConstantNode(1);
    var i = new IndexNode([b, c]);
    var v = new ConstantNode(2);
    var n = new AssignmentNode(a, i, v);

    assert.deepEqual(n.filter(function (node) {return node.isAssignmentNode}), [n]);
    assert.deepEqual(n.filter(function (node) {return node.isSymbolNode}),     [a]);
    assert.deepEqual(n.filter(function (node) {return node.isConstantNode}),   [b, c, v]);
    assert.deepEqual(n.filter(function (node) {return node.value ===  '1'}),   [c]);
    assert.deepEqual(n.filter(function (node) {return node.value === '2'}),    [b, v]);
    assert.deepEqual(n.filter(function (node) {return node.name === 'q'}),     []);
  });

  it ('should filter an AssignmentNode without index', function () {
    var a = new SymbolNode('a');
    var v = new ConstantNode(2);
    var n = new AssignmentNode(a, v);

    assert.deepEqual(n.filter(function (node) {return node.isAssignmentNode}), [n]);
    assert.deepEqual(n.filter(function (node) {return node.isSymbolNode}),     [a]);
    assert.deepEqual(n.filter(function (node) {return node.isConstantNode}),   [v]);
    assert.deepEqual(n.filter(function (node) {return node.value === '2'}),    [v]);
    assert.deepEqual(n.filter(function (node) {return node.name === 'q'}),     []);
  });

  it ('should run forEach on an AssignmentNode', function () {
    // A[1, x] = 3
    var a = new SymbolNode('A');
    var b = new ConstantNode(2);
    var c = new SymbolNode('x');
    var i = new IndexNode([b, c]);
    var v = new ConstantNode(3);
    var n = new AssignmentNode(a, i, v);

    var nodes = [];
    var paths = [];
    n.forEach(function (node, path, parent) {
      nodes.push(node);
      paths.push(path);
      assert.strictEqual(parent, n);
    });

    assert.equal(nodes.length, 3);
    assert.strictEqual(nodes[0], a);
    assert.strictEqual(nodes[1], i);
    assert.strictEqual(nodes[2], v);
    assert.deepEqual(paths, ['object', 'index', 'value']);
  });

  it ('should run forEach on an AssignmentNode without index', function () {
    // A[1, x] = 3
    var a = new SymbolNode('A');
    var v = new ConstantNode(3);
    var n = new AssignmentNode(a, v);

    var nodes = [];
    var paths = [];
    n.forEach(function (node, path, parent) {
      nodes.push(node);
      paths.push(path);
      assert.strictEqual(parent, n);
    });

    assert.equal(nodes.length, 2);
    assert.strictEqual(nodes[0], a);
    assert.strictEqual(nodes[1], v);
    assert.deepEqual(paths, ['object', 'value']);
  });

  it ('should map an AssignmentNode', function () {
    // A[1, x] = 3
    var a = new SymbolNode('A');
    var b = new ConstantNode(2);
    var c = new SymbolNode('x');
    var i = new IndexNode([b, c]);
    var v = new ConstantNode(3);
    var n = new AssignmentNode(a, i, v);

    var nodes = [];
    var paths = [];
    var e = new ConstantNode(4);
    var f = n.map(function (node, path, parent) {
      nodes.push(node);
      paths.push(path);
      assert.strictEqual(parent, n);

      return node instanceof SymbolNode && node.name == 'x' ? e : node;
    });

    assert.equal(nodes.length, 3);
    assert.strictEqual(nodes[0], a);
    assert.strictEqual(nodes[1], i);
    assert.strictEqual(nodes[2], v);
    assert.deepEqual(paths, ['object', 'index', 'value']);

    assert.notStrictEqual(f, n);
    assert.deepEqual(f.object,  a);
    assert.deepEqual(f.index.dimensions[0],  b);
    assert.deepEqual(f.index.dimensions[1],  c); // not replaced, is nested
    assert.deepEqual(f.value, v);
  });

  it ('should map an AssignmentNode without index', function () {
    // a = x + 2
    var a = new SymbolNode('a');
    var x = new SymbolNode('x');
    var d = new AssignmentNode(a, x);

    var e = new ConstantNode(3);
    var nodes = [];
    var paths = [];
    var f = d.map(function (node, path, parent) {
      nodes.push(node);
      paths.push(path);
      assert.strictEqual(parent, d);
      return node instanceof SymbolNode && node.name == 'x' ? e : node;
    });

    assert.equal(nodes.length, 2);
    assert.strictEqual(nodes[0], a);
    assert.strictEqual(nodes[1], x);
    assert.deepEqual(paths, ['object', 'value']);

    assert.notStrictEqual(f, d);
    assert.strictEqual(d.value,  x);
    assert.strictEqual(f.value,  e);
  });

  it ('should throw an error when the map callback does not return a node', function () {
    // A[1, x] = 3
    var a = new SymbolNode('A');
    var b = new ConstantNode(2);
    var c = new SymbolNode('x');
    var i = new IndexNode([b, c]);
    var v = new ConstantNode(3);
    var n = new AssignmentNode(a, i, v);

    assert.throws(function () {
      n.map(function () {});
    }, /Callback function must return a Node/)
  });

  it ('should transform an AssignmentNodes (nested) parameters', function () {
    // a = x + 2
    var object = new SymbolNode('a');
    var x = new SymbolNode('x');
    var index = new IndexNode([x]);
    var b = new ConstantNode(2);
    var value = new OperatorNode('+', 'add', [x, b]);
    var d = new AssignmentNode(object, index, value);

    var e = new ConstantNode(3);
    var f = d.transform(function (node) {
      return node.isSymbolNode && node.name == 'x' ? e : node;
    });

    assert.notStrictEqual(f, d);
    assert.deepEqual(f.index.dimensions[0], e);
    assert.deepEqual(f.value.args[0], e);
    assert.deepEqual(f.value.args[1], b);
  });

  it ('should transform an AssignmentNode itself', function () {
    // a = x + 2
    var object = new SymbolNode('a');
    var x = new SymbolNode('x');
    var b = new ConstantNode(2);
    var c = new OperatorNode('+', 'add', [x, b]);
    var d = new AssignmentNode(object, c);

    var e = new ConstantNode(5);
    var f = d.transform(function (node) {
      return node instanceof AssignmentNode ? e : node;
    });

    assert.notStrictEqual(f, d);
    assert.deepEqual(f, e);
  });

  it ('should traverse an AssignmentNode', function () {
    var object = new SymbolNode('a');
    var i = new IndexNode([]);
    var value = new ConstantNode(2);
    var a = new AssignmentNode(object, i, value);

    var count = 0;
    a.traverse(function (node, index, parent) {
      count++;

      switch(count) {
        case 1:
          assert.strictEqual(node, a);
          assert.strictEqual(index, null);
          assert.strictEqual(parent, null);
          break;

        case 2:
          assert.strictEqual(node, object);
          assert.strictEqual(index, 'object');
          assert.strictEqual(parent, a);
          break;

        case 3:
          assert.strictEqual(node, i);
          assert.strictEqual(index, 'index');
          assert.strictEqual(parent, a);
          break;

        case 4:
          assert.strictEqual(node, value);
          assert.strictEqual(index, 'value');
          assert.strictEqual(parent, a);
          break;
      }
    });

    assert.equal(count, 4);
  });

  it ('should clone an AssignmentNode without index', function () {
    var object = new SymbolNode('a');
    var value = new ConstantNode(2);
    var a = new AssignmentNode(object, value);

    var b = a.clone();
    assert(b instanceof AssignmentNode);
    assert.deepEqual(b, a);
    assert.notStrictEqual(b, a);
    assert.strictEqual(b.object, a.object);
    assert.strictEqual(b.index, a.index);
    assert.strictEqual(b.value, a.value);
  });

  it ('should clone an AssignmentNode', function () {
    // A[1, x] = 3
    var a = new SymbolNode('A');
    var b = new ConstantNode(2);
    var c = new SymbolNode('x');
    var i = new IndexNode([b, c]);
    var v = new ConstantNode(3);
    var d = new AssignmentNode(a, i, v);

    var e = d.clone();

    assert(e instanceof AssignmentNode);
    assert.deepEqual(e, d);
    assert.notStrictEqual(e, d);
    assert.strictEqual(e.object, d.object);
    assert.strictEqual(e.index, d.index);
    assert.strictEqual(e.value, d.value);
  });

  it ('test equality another Node', function () {
    var a = new AssignmentNode(
        new SymbolNode('A'),
        new IndexNode([new ConstantNode(2), new SymbolNode('x')]),
        new ConstantNode(3));
    var b = new AssignmentNode(
        new SymbolNode('A'),
        new IndexNode([new ConstantNode(2), new SymbolNode('x')]),
        new ConstantNode(3));
    var c = new AssignmentNode(
        new SymbolNode('B'),
        new IndexNode([new ConstantNode(2), new SymbolNode('x')]),
        new ConstantNode(3));
    var d = new AssignmentNode(
        new SymbolNode('A'),
        new IndexNode([new ConstantNode(2)]),
        new ConstantNode(3));
    var e = new AssignmentNode(
        new SymbolNode('A'),
        new IndexNode([new ConstantNode(2), new SymbolNode('x')]),
        new ConstantNode(4));

    assert.strictEqual(a.equals(null), false);
    assert.strictEqual(a.equals(undefined), false);
    assert.strictEqual(a.equals(b), true);
    assert.strictEqual(a.equals(c), false);
    assert.strictEqual(a.equals(d), false);
    assert.strictEqual(a.equals(e), false);
  });

  it ('should respect the \'all\' parenthesis option', function () {
    var object = new SymbolNode('a');
    var value = new ConstantNode(1);
    var n = new AssignmentNode(object, value);

    assert.equal(n.toString({parenthesis: 'all'}), 'a = (1)');
    assert.equal(n.toTex({parenthesis: 'all'}), ' a:=\\left(1\\right)');
  });

  it ('should stringify a AssignmentNode', function () {
    var object = new SymbolNode('b');
    var value = new ConstantNode(3);
    var n = new AssignmentNode(object, value);

    assert.equal(n.toString(), 'b = 3');
  });

  it ('should stringify an AssignmentNode containing an AssignmentNode', function () {
    var value = new ConstantNode(2);
    var a = new AssignmentNode(new SymbolNode('a'), value);
    var n = new AssignmentNode(new SymbolNode('b'), a);

    assert.equal(n.toString(), 'b = (a = 2)');
  });

  it ('should stringify an AssignmentNode with custom toString', function () {
    //Also checks if custom funcions get passed to the children
    var customFunction = function (node, options) {
      if (node.type === 'AssignmentNode') {
        return node.object.toString(options) +
            (node.index ? node.index.toString(options) : '') +
            ' equals ' + node.value.toString(options);
      }
      else if (node.type === 'ConstantNode') {
        return 'const(' + node.value + ', ' + node.valueType + ')'
      }
    };

    var object = new SymbolNode('a');
    var value = new ConstantNode(1);
    var n = new AssignmentNode(object, value);

    assert.equal(n.toString({handler: customFunction}), 'a equals const(1, number)');
  });

  it ('should LaTeX a AssignmentNode', function () {
    var value = new ConstantNode(2);
    var a = new AssignmentNode(new SymbolNode('a'), value);

    assert.equal(a.toTex(), ' a:=2');
  });

  it ('should LaTeX an AssignmentNode containing an AssignmentNode', function () {
    var value = new ConstantNode(2);
    var a = new AssignmentNode(new SymbolNode('a'), value);
    var q = new AssignmentNode(new SymbolNode('q'), a);

    assert.equal(q.toTex(), ' q:=\\left( a:=2\\right)');
  });

  it ('should LaTeX an AssignmentNode with custom toTex', function () {
    //Also checks if custom funcions get passed to the children
    var customFunction = function (node, options) {
      if (node.isAssignmentNode) {
        return node.object.toTex(options) +
            (node.index ? node.index.toTex(options) : '') +
            '\\mbox{equals}' + node.value.toTex(options);
      }
      else if (node.type === 'ConstantNode') {
        return 'const\\left(' + node.value + ', ' + node.valueType + '\\right)'
      }
    };

    var object = new SymbolNode('a');
    var value = new ConstantNode(1);
    var n = new AssignmentNode(object, value);

    assert.equal(n.toTex({handler: customFunction}), ' a\\mbox{equals}const\\left(1, number\\right)');
  });

});
