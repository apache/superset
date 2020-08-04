// test Node
var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var Node = math.expression.node.Node;

describe('Node', function() {
  function MyNode (value) {
    this.value = value;
  }
  MyNode.prototype = new Node();
  MyNode.prototype.forEach = function () {};
  MyNode.prototype.map = function () {
    return new MyNode(this.value);
  };

  it ('should create a Node', function () {
    var n = new Node();
    assert(n instanceof Node);
  });

  it ('should have isNode', function () {
    var node = new Node();
    assert(node.isNode);
  });

  it ('should throw an error when calling without new operator', function () {
    assert.throws(function () {Node()}, SyntaxError);
  });

  it ('should filter a Node', function () {
    var n = new MyNode(2);

    assert.deepEqual(n.filter(function () {return true}), [n]);
    assert.deepEqual(n.filter(function (node) {return node instanceof Node}), [n]);
    assert.deepEqual(n.filter(function (node) {return node instanceof Date}), []);
  });

  it ('should transform a Node', function () {
    var a = new MyNode(2);
    var b = new MyNode(3);
    var c = a.transform(function (node) {
      return b;
    });
    assert.deepEqual(c, b);

    // no match
    a = new MyNode(2);
    b = new MyNode(3);
    c = a.transform(function (node) {
      return node;
    });
    assert.deepEqual(c, a);
  });

  it ('should transform a Node using a replacement function', function () {
    var a = new MyNode(2);
    var b = new MyNode(3);
    var c = a.transform(function (node) {
      assert.deepEqual(node, a);
      return b;
    });
    assert.deepEqual(c, b);
  });

  it ('should throw an error when cloning a Node interface', function () {
    assert.throws(function () {
      var a = new Node();
      a.clone();
    }, /Cannot clone a Node interface/);
  });

  it ('should shallow clone the content of a Node', function () {
    var a = new math.expression.node.ConstantNode(1);
    var b = new math.expression.node.ConstantNode(2);
    var c = new math.expression.node.OperatorNode('+', 'add', [a, b]);

    var clone = c.clone();

    assert.deepEqual(c, clone);
    assert.notStrictEqual(c, clone);
    assert.strictEqual(clone.args[0], c.args[0]);
    assert.strictEqual(clone.args[1], c.args[1]);
  });

  it ('should deepClone the content of a Node', function () {
    var a = new math.expression.node.ConstantNode(1);
    var b = new math.expression.node.ConstantNode(2);
    var c = new math.expression.node.OperatorNode('+', 'add', [a, b]);

    var clone = c.cloneDeep();

    assert.deepEqual(c, clone);
    assert.notStrictEqual(c, clone);
    assert.notStrictEqual(clone.args[0], c.args[0]);
    assert.notStrictEqual(clone.args[1], c.args[1]);
  });

  it ('test equality with another Node', function () {
    assert.strictEqual(new Node().equals(new Node()), true);
    assert.strictEqual(new Node().equals(null), false);
    assert.strictEqual(new Node().equals(undefined), false);
    assert.strictEqual(new Node().equals({}), false);
  });

  it ('should throw an error when stringifying a Node interface', function () {
    assert.throws(function () {
      var node = new Node();
      node.toString();
    }, /_toString not implemented for Node/);
  });

  it ('should throw an error when calling _toTex', function () {
    assert.throws(function () {
      var node = new Node();
      node._toTex();
    }, /_toTex not implemented for Node/);
  });

  it ('should ignore custom toString if it returns nothing', function () {
    var callback1 = function (node, callback) {};
    var callback2 = {
      bla: function (node, callbacks) {}
    };
    var mymath = math.create();
    mymath.expression.node.Node.prototype._toString = function () {
      return 'default';
    };
    var n1 = new mymath.expression.node.Node();
    var s = new mymath.expression.node.SymbolNode('bla');
    var n2 = new mymath.expression.node.FunctionNode(s, []);
    
    assert.equal(n1.toString(callback1), 'default');
    assert.equal(n2.toString(callback2), 'bla()');
  });


  it ('should ignore custom toTex if it returns nothing', function () {
    var callback1 = function (node, callback) {};
    var callback2 = {
      bla: function (node, callbacks) {}
    };
    var mymath = math.create();
    mymath.expression.node.Node.prototype._toTex = function () {
      return 'default';
    };
    var n1 = new mymath.expression.node.Node();
    var s = new mymath.expression.node.SymbolNode('bla');
    var n2 = new mymath.expression.node.FunctionNode(s, []);
    
    assert.equal(n1.toTex(callback1), 'default');
    assert.equal(n2.toTex(callback2), '\\mathrm{bla}\\left(\\right)');
  });

  it ('should throw an error when compiling an abstract node', function () {
    var node = new Node();
    assert.throws(function () {
      node.compile()
    }, /Cannot compile node: unknown type "Node"/);
  });

  it ('should have an identifier', function () {
    var node = new Node();

    assert.equal(node.getIdentifier(), 'Node');
  });

  it ('should get the content of a Node', function () {
    var c = new math.expression.node.ConstantNode(1);

    assert.equal(c.getContent(), c);
    assert.deepEqual(c.getContent(), c);
  });
});
