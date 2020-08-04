'use strict';

function factory(type, config, load, typed, math) {
  var Node = math.expression.node.Node;
  var OperatorNode = math.expression.node.OperatorNode;
  var FunctionNode = math.expression.node.FunctionNode;
  var ParenthesisNode = math.expression.node.ParenthesisNode;

  /**
   * resolve(expr, scope) replaces variable nodes with their scoped values
   *
   * Syntax:
   *
   *     simplify.resolve(expr, scope)
   *
   * Examples:
   *
   *     math.simplify.resolve('x + y', {x:1, y:2}) // Node {1 + 2}
   *     math.simplify.resolve(math.parse('x+y'), {x:1, y:2}) // Node {1 + 2}
   *     math.simplify('x+y', {x:2, y:'x+x'}).toString(); // "6"
   *
   * @param {Node} node
   *     The expression tree to be simplified
   * @param {Object} scope with variables to be resolved
   */
  function resolve(node, scope) {
    if (!scope) {
        return node;
    }
    if (type.isSymbolNode(node)) {
        var value = scope[node.name];
        if (value instanceof Node) {
            return resolve(value, scope);
        } else if (typeof value === 'number') {
            return math.parse(String(value));
        }
    } else if (type.isOperatorNode(node)) {
        var args = node.args.map(function (arg) {
          return resolve(arg, scope)
        });
        return new OperatorNode(node.op, node.fn, args);
    } else if (type.isParenthesisNode(node)) {
        return new ParenthesisNode(resolve(node.content, scope));
    } else if (type.isFunctionNode(node)) {
        var args = node.args.map(function (arg) {
          return resolve(arg, scope)
        });
        return new FunctionNode(node.name, args);
    }
    return node;
  }

  return resolve;
}

exports.math = true;
exports.name = 'resolve';
exports.path = 'algebra.simplify';
exports.factory = factory;
