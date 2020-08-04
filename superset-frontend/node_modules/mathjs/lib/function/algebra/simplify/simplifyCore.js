'use strict';

function factory(type, config, load, typed, math) {
  var ConstantNode = math.expression.node.ConstantNode;
  var OperatorNode = math.expression.node.OperatorNode;
  var FunctionNode = math.expression.node.FunctionNode;
  var ParenthesisNode = math.expression.node.ParenthesisNode;

  var node0 = new ConstantNode(0);
  var node1 = new ConstantNode(1);

  /**
   * simplifyCore() performs single pass simplification suitable for
   * applications requiring ultimate performance. In contrast, simplify()
   * extends simplifyCore() with additional passes to provide deeper
   * simplification.
   *
   * Syntax:
   *
   *     simplify.simplifyCore(expr)
   *
   * Examples:
   *
   *     var f = math.parse('2 * 1 * x ^ (2 - 1)');
   *     math.simplify.simpifyCore(f);                          // Node {2 * x}
   *     math.simplify('2 * 1 * x ^ (2 - 1)', [math.simplify.simpifyCore]); // Node {2 * x};
   *
   * See also:
   *
   *     derivative
   *
   * @param {Node} node
   *     The expression to be simplified
   */
  function simplifyCore(node) {
    if (type.isOperatorNode(node) && node.args.length <= 2) {
      var a0 = simplifyCore(node.args[0]);
      var a1 = node.args[1] && simplifyCore(node.args[1]);
      if (node.op === "+") {
          if (node.args.length === 1) {
            return node.args[0];
          }
          if (type.isConstantNode(a0)) {
              if (a0.value === "0") {
                  return a1;
              } else if (type.isConstantNode(a1) && a0.value && a0.value.length < 5 && a1.value && a1.value.length < 5) {
                  return new ConstantNode(Number(a0.value) + Number(a1.value));
              }
          }
          if (type.isConstantNode(a1) && a1.value === "0") {
              return a0;
          }
          if (node.args.length === 2 && type.isOperatorNode(a1) && a1.op === '-' && a1.fn === 'unaryMinus') {
              return new OperatorNode('-', 'subtract', [a0,a1.args[0]]);
          }
          return new OperatorNode(node.op, node.fn, a1 ? [a0,a1] : [a0]);
      } else if (node.op === "-") {
          if (type.isConstantNode(a0) && a1) {
              if (type.isConstantNode(a1) && a0.value && a0.value.length < 5 && a1.value && a1.value.length < 5) {
                  return new ConstantNode(Number(a0.value) - Number(a1.value));
              } else if (a0.value === "0") {
                  return new OperatorNode("-", "unaryMinus", [a1]);
              }
          }
          if (node.fn === "subtract" && node.args.length === 2) {
              if (type.isConstantNode(a1) && a1.value === "0") {
                  return a0;
              }
              if (type.isOperatorNode(a1) && a1.fn === "unaryMinus") {
                  return simplifyCore(new OperatorNode("+", "add", [a0, a1.args[0]]));
              }
              return new OperatorNode(node.op, node.fn, [a0,a1]);
          } else if (node.fn === "unaryMinus") {
              if (type.isOperatorNode(a0)) {
                  if (a0.fn === 'unaryMinus') {
                      return a0.args[0];
                  } else if (a0.fn === 'subtract') {
                      return new OperatorNode('-', 'subtract', [a0.args[1], a0.args[0]]);
                  }
              }
              return new OperatorNode(node.op, node.fn, [a0]);
          }
          throw new Error('never happens');
      } else if (node.op === "*") {
          if (type.isConstantNode(a0)) {
              if (a0.value === "0") {
                  return node0;
              } else if (a0.value === "1") {
                  return a1;
              } else if (type.isConstantNode(a1) && a0.value && a0.value.length < 5 && a1.value && a1.value.length < 5) {
                  return new ConstantNode(Number(a0.value) * Number(a1.value));
              }
          }
          if (type.isConstantNode(a1)) {
              if (a1.value === "0") {
                  return node0;
              } else if (a1.value === "1") {
                  return a0;
              } else if (type.isOperatorNode(a0) && a0.op === node.op) {
                  var a00 = a0.args[0];
                  if (type.isConstantNode(a00) && a1.value && a1.value.length < 5 && a00.value && a00.value.length < 5) {
                      var a00_a1 =  new ConstantNode(Number(a0.args[0].value) * Number(a1.value));
                      return new OperatorNode(node.op, node.fn, [a00_a1, a0.args[1]]); // constants on left
                  }
              }
              return new OperatorNode(node.op, node.fn, [a1, a0]); // constants on left
          }
          return new OperatorNode(node.op, node.fn, [a0, a1]);
      } else if (node.op === "/") {
          if (type.isConstantNode(a0)) {
              if (a0.value === "0") {
                  return node0;
              } else if (type.isConstantNode(a1) && a0.value && a0.value.length < 5 && (a1.value === "1" || a1.value==="2" || a1.value==="4")) {
                  return new ConstantNode(Number(a0.value) / Number(a1.value));
              }
          }
          return new OperatorNode(node.op, node.fn, [a0, a1]);
      } else if (node.op === "^") {
          if (type.isConstantNode(a1)) {
              if (a1.value === "0") {
                  return node1;
              } else if (a1.value === "1") {
                  return a0;
              } else {
                  if (type.isConstantNode(a0) && 
                      a0.value && a0.value.length < 5 && 
                      a1.value && a1.value.length < 2) { 
                      // fold constant
                      return new ConstantNode(
                          math.pow(Number(a0.value), Number(a1.value)));
                  } else if (type.isOperatorNode(a0) && a0.op === "^") {
                      var a01 = a0.args[1];
                      if (type.isConstantNode(a01)) {
                          return new OperatorNode(node.op, node.fn, [
                              a0.args[0], 
                              new ConstantNode(a01.value * a1.value)
                          ]);
                      }
                  }
              }
          }
          return new OperatorNode(node.op, node.fn, [a0, a1]);
      }
    } else if (type.isParenthesisNode(node)) {
        var c = simplifyCore(node.content);
        if (type.isParenthesisNode(c) || type.isSymbolNode(c) || type.isConstantNode(c)) {
            return c;
        }
        return new ParenthesisNode(c);
    } else if (type.isFunctionNode(node)) {
          var args = node.args.map(simplifyCore);
          if (args.length === 1) {
              if (type.isParenthesisNode(args[0])) {
                  args[0] = args[0].content;
              }
          }
          return new FunctionNode(simplifyCore(node.fn), args);
    } else {
        // cannot simplify
    }
    return node;
  }

  return simplifyCore;
}

exports.math = true;
exports.name = 'simplifyCore';
exports.path = 'algebra.simplify';
exports.factory = factory;
