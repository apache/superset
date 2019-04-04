'use strict';

var digits = require('./../../../utils/number').digits;
// TODO this could be improved by simplifying seperated constants under associative and commutative operators
function factory(type, config, load, typed, math) {
  var util = load(require('./util'));
  var isCommutative = util.isCommutative;
  var isAssociative = util.isAssociative;
  var allChildren = util.allChildren;
  var createMakeNodeFunction = util.createMakeNodeFunction;
  var ConstantNode = math.expression.node.ConstantNode;
  var OperatorNode = math.expression.node.OperatorNode;
  var FunctionNode = math.expression.node.FunctionNode;

  function simplifyConstant(expr) {
    var res = foldFraction(expr);
    return type.isNode(res) ? res : _toNode(res);
  }

  function _eval(fnname, args) {
    try {
      return _toNumber(math[fnname].apply(null, args));
    }
    catch (ignore) {
      // sometimes the implicit type conversion causes the evaluation to fail, so we'll try again after removing Fractions
      args = args.map(function(x){
        if (type.isFraction(x)) {
          return x.valueOf();
        }
        return x;
      });
      return _toNumber(math[fnname].apply(null, args));
    }
  }

  var _toNode = typed({
    'Fraction': _fractionToNode,
    'number': function(n) {
      if (n < 0) {
        return unaryMinusNode(new ConstantNode(-n));
      }
      return new ConstantNode(n);
    },
    'BigNumber': function(n) {
      if (n < 0) {
        return unaryMinusNode(new ConstantNode(n.negated().toString(), 'number'));
      }
      return new ConstantNode(n.toString(), 'number');
    },
    'Complex': function(s) {
      throw 'Cannot convert Complex number to Node';
    }
  });

  // convert a number to a fraction only if it can be expressed exactly
  function _exactFraction(n) {
    if (isFinite(n)) {
      var f = math.fraction(n);
      if (f.valueOf() === n) {
        return f;
      }
    }
    return n;
  }

  // Convert numbers to a preferred number type in preference order: Fraction, number, Complex
  // BigNumbers are left alone
  var _toNumber = typed({
    'string': function(s) {
      if (config.number === 'BigNumber') {
        return math.bignumber(s);
      }
      else if (config.number === 'Fraction') {
        return math.fraction(s);
      }
      else {
        return _exactFraction(parseFloat(s));
      }
    },

    'Fraction': function(s) { return s; },

    'BigNumber': function(s) { return s; },

    'number': function(s) {
      return _exactFraction(s);
    },

    'Complex': function(s) {
      if (s.im !== 0) {
        return s;
      }
      return _exactFraction(s.re);
    },
  });

  function unaryMinusNode(n) {
    return new OperatorNode('-', 'unaryMinus', [n]);
  }

  function _fractionToNode(f) {
    var n;
    var vn = f.s*f.n;
    if (vn < 0) {
      n = new OperatorNode('-', 'unaryMinus', [new ConstantNode(-vn)])
    }
    else {
      n = new ConstantNode(vn);
    }

    if (f.d === 1) {
      return n;
    }
    return new OperatorNode('/', 'divide', [n, new ConstantNode(f.d)]);
  }

  /*
   * Create a binary tree from a list of Fractions and Nodes.
   * Tries to fold Fractions by evaluating them until the first Node in the list is hit, so
   * `args` should be sorted to have the Fractions at the start (if the operator is commutative).
   * @param args - list of Fractions and Nodes
   * @param fn - evaluator for the binary operation evaluator that accepts two Fractions
   * @param makeNode - creates a binary OperatorNode/FunctionNode from a list of child Nodes
   * if args.length is 1, returns args[0]
   * @return - Either a Node representing a binary expression or Fraction
   */
  function foldOp(fn, args, makeNode) {
    return args.reduce(function(a, b) {
      if (!type.isNode(a) && !type.isNode(b)) {
        try {
          return _eval(fn, [a,b]);
        }
        catch (ignoreandcontinue) {}
        a = _toNode(a);
        b = _toNode(b);
      }
      else if (!type.isNode(a)) {
        a = _toNode(a);
      }
      else if (!type.isNode(b)) {
        b = _toNode(b);
      }

      return makeNode([a, b]);
    });
  }

  // destroys the original node and returns a folded one
  function foldFraction(node) {
    switch(node.type) {
      case 'SymbolNode':
        return node;
      case 'ConstantNode':
        if (node.valueType === 'number') {
          return _toNumber(node.value);
        }
        return node;
      case 'FunctionNode':
        if (math[node.name] && math[node.name].rawArgs) {
          return node;
        }

        // Process operators as OperatorNode
        var operatorFunctions = [ 'add', 'multiply' ];
        if (operatorFunctions.indexOf(node.name) === -1) {
          var args = node.args.map(foldFraction);

          // If all args are numbers
          if (!args.some(type.isNode)) {
            try {
              return _eval(node.name, args);
            }
            catch (ignoreandcontine) {}
          }

          // Convert all args to nodes and construct a symbolic function call
          args = args.map(function(arg) {
            return type.isNode(arg) ? arg : _toNode(arg);
          });
          return new FunctionNode(node.name, args);
        }
        else {
          // treat as operator
        }
        /* falls through */
      case 'OperatorNode':
        var fn = node.fn.toString();
        var args;
        var res;
        var makeNode = createMakeNodeFunction(node);
        if (node.args.length === 1) {
          args = [foldFraction(node.args[0])];
          if (!type.isNode(args[0])) {
            res = _eval(fn, args);
          }
          else {
            res = makeNode(args);
          }
        }
        else if (isAssociative(node)) {
          args = allChildren(node);
          args = args.map(foldFraction);

          if (isCommutative(fn)) {
            // commutative binary operator
            var consts = [], vars = [];

            for (var i=0; i < args.length; i++) {
              if (!type.isNode(args[i])) {
                consts.push(args[i]);
              }
              else {
                vars.push(args[i]);
              }
            }

            if (consts.length > 1) {
              res = foldOp(fn, consts, makeNode);
              vars.unshift(res);
              res = foldOp(fn, vars, makeNode);
            }
            else {
              // we won't change the children order since it's not neccessary
              res = foldOp(fn, args, makeNode);
            }
          }
          else {
            // non-commutative binary operator
            res = foldOp(fn, args, makeNode);
          }
        }
        else {
          // non-associative binary operator
          args = node.args.map(foldFraction);
          res = foldOp(fn, args, makeNode);
        }
        return res;
      case 'ParenthesisNode':
        // remove the uneccessary parenthesis
        return foldFraction(node.content);
      case 'AccessorNode':
        /* falls through */
      case 'ArrayNode':
        /* falls through */
      case 'AssignmentNode':
        /* falls through */
      case 'BlockNode':
        /* falls through */
      case 'FunctionAssignmentNode':
        /* falls through */
      case 'IndexNode':
        /* falls through */
      case 'ObjectNode':
        /* falls through */
      case 'RangeNode':
        /* falls through */
      case 'UpdateNode':
        /* falls through */
      case 'ConditionalNode':
        /* falls through */
      default:
        throw 'Unimplemented node type in simplifyConstant: '+node.type;
    }
  }

  return simplifyConstant;
}

exports.math = true;
exports.name = 'simplifyConstant';
exports.path = 'algebra.simplify';
exports.factory = factory;
