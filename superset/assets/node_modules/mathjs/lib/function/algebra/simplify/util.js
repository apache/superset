'use strict';

function factory(type, config, load, typed, math) {
  var FunctionNode = math.expression.node.FunctionNode;
  var OperatorNode = math.expression.node.OperatorNode;
  var SymbolNode = math.expression.node.SymbolNode;

  // TODO commutative/associative properties rely on the arguments
  // e.g. multiply is not commutative for matrices
  // The properties should be calculated from an argument to simplify, or possibly something in math.config
  // the other option is for typed() to specify a return type so that we can evaluate the type of arguments
  var commutative = {
    'add': true,
    'multiply': true
  }
  var associative = {
    'add': true,
    'multiply': true
  }


  function isCommutative(node, context) {
    if (!type.isOperatorNode(node)) {
      return true;
    }
    var name = node.fn.toString();
    if (context && context.hasOwnProperty(name) && context[name].hasOwnProperty('commutative')) {
      return context[name].commutative;
    }
    return commutative[name] || false;
  }

  function isAssociative(node, context) {
    if (!type.isOperatorNode(node)) {
      return false;
    }
    var name = node.fn.toString();
    if (context && context.hasOwnProperty(name) && context[name].hasOwnProperty('associative')) {
      return context[name].associative;
    }
    return associative[name] || false;
  }

  /**
   * Flatten all associative operators in an expression tree.
   * Assumes parentheses have already been removed.
   */
  function flatten(node) {
    if (!node.args || node.args.length === 0) {
      return node;
    }
    node.args = allChildren(node);
    for (var i=0; i<node.args.length; i++) {
      flatten(node.args[i]);
    }
  }

  /**
   * Get the children of a node as if it has been flattened.
   * TODO implement for FunctionNodes
   */
  function allChildren(node) {
    var op;
    var children = [];
    var findChildren = function(node) {
      for (var i = 0; i < node.args.length; i++) {
        var child = node.args[i];
        if (type.isOperatorNode(child) && op === child.op) {
          findChildren(child);
        }
        else {
          children.push(child);
        }
      }
    };

    if (isAssociative(node)) {
      op = node.op;
      findChildren(node);
      return children;
    }
    else {
      return node.args;
    }
  }

  /**
   *  Unflatten all flattened operators to a right-heavy binary tree.
   */
  function unflattenr(node) {
    if (!node.args || node.args.length === 0) {
      return;
    }
    var makeNode = createMakeNodeFunction(node);
    var l = node.args.length;
    for (var i = 0; i < l; i++) {
      unflattenr(node.args[i])
    }
    if (l > 2 && isAssociative(node)) {
      var curnode = node.args.pop();
      while (node.args.length > 0) {
        curnode = makeNode([node.args.pop(), curnode]);
      }
      node.args = curnode.args;
    }
  }

  /**
   *  Unflatten all flattened operators to a left-heavy binary tree.
   */
  function unflattenl(node) {
    if (!node.args || node.args.length === 0) {
      return;
    }
    var makeNode = createMakeNodeFunction(node);
    var l = node.args.length;
    for (var i = 0; i < l; i++) {
      unflattenl(node.args[i])
    }
    if (l > 2 && isAssociative(node)) {
      var curnode = node.args.shift();
      while (node.args.length > 0) {
        curnode = makeNode([curnode, node.args.shift()]);
      }
      node.args = curnode.args;
    }
  }

  function createMakeNodeFunction(node) {
    if (type.isOperatorNode(node)) {
      return function(args){
        try{
          return new OperatorNode(node.op, node.fn, args);
        } catch(err){
          console.error(err);
          return [];
        }
      };
    }
    else {
      return function(args){
        return new FunctionNode(new SymbolNode(node.name), args);
      };
    }
  }
  return {
    createMakeNodeFunction: createMakeNodeFunction,
    isCommutative: isCommutative,
    isAssociative: isAssociative,
    flatten: flatten,
    allChildren: allChildren,
    unflattenr: unflattenr,
    unflattenl: unflattenl
  };
}

exports.factory = factory;
exports.math = true;