'use strict';

var latex = require('../../utils/latex');
var map = require('../../utils/array').map;
var join = require('../../utils/array').join;
var stringify = require('../../utils/string').stringify;
var escape = require('../../utils/string').escape;
var isSafeMethod = require('../../utils/customs').isSafeMethod;
var operators = require('../operators');

function factory (type, config, load, typed) {
  var register = load(require('./compile')).register;
  var compile = load(require('./compile')).compile;
  var Node         = load(require('./Node'));
  var ConstantNode = load(require('./ConstantNode'));
  var SymbolNode   = load(require('./SymbolNode'));
  var FunctionNode = load(require('./FunctionNode'));

  /**
   * @constructor OperatorNode
   * @extends {Node}
   * An operator with two arguments, like 2+3
   *
   * @param {string} op           Operator name, for example '+'
   * @param {string} fn           Function name, for example 'add'
   * @param {Node[]} args         Operator arguments
   * @param {boolean} [implicit]  Is this an implicit multiplication?
   */
  function OperatorNode(op, fn, args, implicit) {
    if (!(this instanceof OperatorNode)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    //validate input
    if (typeof op !== 'string') {
      throw new TypeError('string expected for parameter "op"');
    }
    if (typeof fn !== 'string') {
      throw new TypeError('string expected for parameter "fn"');
    }
    if (!Array.isArray(args) || !args.every(type.isNode)) {
      throw new TypeError('Array containing Nodes expected for parameter "args"');
    }

    this.implicit = (implicit === true);
    this.op = op;
    this.fn = fn;
    this.args = args || [];
  }

  OperatorNode.prototype = new Node();

  OperatorNode.prototype.type = 'OperatorNode';

  OperatorNode.prototype.isOperatorNode = true;

  /**
   * Compile the node to javascript code
   * @param {OperatorNode} node The node to be compiled
   * @param {Object} defs     Object which can be used to define functions
   *                          or constants globally available for the compiled
   *                          expression
   * @param {Object} args     Object with local function arguments, the key is
   *                          the name of the argument, and the value is `true`.
   *                          The object may not be mutated, but must be
   *                          extended instead.
   * @return {string} js
   * @private
   */
  function compileOperatorNode(node, defs, args) {
    if (!(node instanceof OperatorNode)) {
      throw new TypeError('No valid OperatorNode')
    }

    // validate fn
    if (typeof node.fn !== 'string' || !isSafeMethod(defs.math, node.fn)) {
      if (!defs.math[node.fn]) {
        throw new Error('Function ' + node.fn + ' missing in provided namespace "math"');
      }
      else {
        throw new Error('No access to function "' + node.fn + '"');
      }
    }

    var jsArgs = map(node.args, function (arg) {
      return compile(arg, defs, args);
    });

    return 'math[' + stringify(node.fn) + '](' + join(jsArgs, ', ') + ')';
  }

  // register the compile function
  register(OperatorNode.prototype.type, compileOperatorNode);

  /**
   * Execute a callback for each of the child nodes of this node
   * @param {function(child: Node, path: string, parent: Node)} callback
   */
  OperatorNode.prototype.forEach = function (callback) {
    for (var i = 0; i < this.args.length; i++) {
      callback(this.args[i], 'args[' + i + ']', this);
    }
  };

  /**
   * Create a new OperatorNode having it's childs be the results of calling
   * the provided callback function for each of the childs of the original node.
   * @param {function(child: Node, path: string, parent: Node): Node} callback
   * @returns {OperatorNode} Returns a transformed copy of the node
   */
  OperatorNode.prototype.map = function (callback) {
    var args = [];
    for (var i = 0; i < this.args.length; i++) {
      args[i] = this._ifNode(callback(this.args[i], 'args[' + i + ']', this));
    }
    return new OperatorNode(this.op, this.fn, args, this.implicit);
  };

  /**
   * Create a clone of this node, a shallow copy
   * @return {OperatorNode}
   */
  OperatorNode.prototype.clone = function () {
    return new OperatorNode(this.op, this.fn, this.args.slice(0), this.implicit);
  };

  /**
   * Calculate which parentheses are necessary. Gets an OperatorNode
   * (which is the root of the tree) and an Array of Nodes
   * (this.args) and returns an array where 'true' means that an argument
   * has to be enclosed in parentheses whereas 'false' means the opposite.
   *
   * @param {OperatorNode} root
   * @param {string} parenthesis
   * @param {Node[]} args
   * @param {boolean} latex
   * @return {boolean[]}
   * @private
   */
  function calculateNecessaryParentheses(root, parenthesis, implicit, args, latex) {
    //precedence of the root OperatorNode
    var precedence = operators.getPrecedence(root, parenthesis);
    var associativity = operators.getAssociativity(root, parenthesis);

    if ((parenthesis === 'all') || ((args.length > 2) && (root.getIdentifier() !== 'OperatorNode:add') && (root.getIdentifier() !== 'OperatorNode:multiply'))) {
      var parens = args.map(function (arg) {
        switch (arg.getContent().type) { //Nodes that don't need extra parentheses
          case 'ArrayNode':
          case 'ConstantNode':
          case 'SymbolNode':
          case 'ParenthesisNode':
            return false;
            break;
          default:
            return true;
        }
      });
      return parens;
    }

    var result = undefined;
    switch (args.length) {
      case 0:
        result = [];
        break;

      case 1: //unary operators
        //precedence of the operand
        var operandPrecedence = operators.getPrecedence(args[0], parenthesis);

        //handle special cases for LaTeX, where some of the parentheses aren't needed
        if (latex && (operandPrecedence !== null)) {
          var operandIdentifier;
          var rootIdentifier;
          if (parenthesis === 'keep') {
            operandIdentifier = args[0].getIdentifier();
            rootIdentifier = root.getIdentifier();
          }
          else {
            //Ignore Parenthesis Nodes when not in 'keep' mode
            operandIdentifier = args[0].getContent().getIdentifier();
            rootIdentifier = root.getContent().getIdentifier();
          }
          if (operators.properties[precedence][rootIdentifier].latexLeftParens === false) {
            result = [false];
            break;
          }

          if (operators.properties[operandPrecedence][operandIdentifier].latexParens === false) {
            result = [false];
            break;
          }
        }

        if (operandPrecedence === null) {
          //if the operand has no defined precedence, no parens are needed
          result = [false];
          break;
        }

        if (operandPrecedence <= precedence) {
          //if the operands precedence is lower, parens are needed
          result = [true];
          break;
        }

        //otherwise, no parens needed
        result = [false];
        break;

      case 2: //binary operators
        var lhsParens; //left hand side needs parenthesis?
        //precedence of the left hand side
        var lhsPrecedence = operators.getPrecedence(args[0], parenthesis);
        //is the root node associative with the left hand side
        var assocWithLhs = operators.isAssociativeWith(root, args[0], parenthesis);

        if (lhsPrecedence === null) {
          //if the left hand side has no defined precedence, no parens are needed
          //FunctionNode for example
          lhsParens = false;
        }
        else if ((lhsPrecedence === precedence) && (associativity === 'right') && !assocWithLhs) {
          //In case of equal precedence, if the root node is left associative
          // parens are **never** necessary for the left hand side.
          //If it is right associative however, parens are necessary
          //if the root node isn't associative with the left hand side
          lhsParens = true;
        }
        else if (lhsPrecedence < precedence) {
          lhsParens = true;
        }
        else {
          lhsParens = false;
        }

        var rhsParens; //right hand side needs parenthesis?
        //precedence of the right hand side
        var rhsPrecedence = operators.getPrecedence(args[1], parenthesis);
        //is the root node associative with the right hand side?
        var assocWithRhs = operators.isAssociativeWith(root, args[1], parenthesis);

        if (rhsPrecedence === null) {
          //if the right hand side has no defined precedence, no parens are needed
          //FunctionNode for example
          rhsParens = false;
        }
        else if ((rhsPrecedence === precedence) && (associativity === 'left') && !assocWithRhs) {
          //In case of equal precedence, if the root node is right associative
          // parens are **never** necessary for the right hand side.
          //If it is left associative however, parens are necessary
          //if the root node isn't associative with the right hand side
          rhsParens = true;
        }
        else if (rhsPrecedence < precedence) {
          rhsParens = true;
        }
        else {
          rhsParens = false;
        }

        //handle special cases for LaTeX, where some of the parentheses aren't needed
        if (latex) {
          var rootIdentifier;
          var lhsIdentifier;
          var rhsIdentifier;
          if (parenthesis === 'keep') {
            rootIdentifier = root.getIdentifier();
            lhsIdentifier = root.args[0].getIdentifier();
            rhsIdentifier = root.args[1].getIdentifier();
          }
          else {
            //Ignore ParenthesisNodes when not in 'keep' mode
            rootIdentifier = root.getContent().getIdentifier();
            lhsIdentifier = root.args[0].getContent().getIdentifier();
            rhsIdentifier = root.args[1].getContent().getIdentifier();
          }

          if (lhsPrecedence !== null) {
            if (operators.properties[precedence][rootIdentifier].latexLeftParens === false) {
              lhsParens = false;
            }

            if (operators.properties[lhsPrecedence][lhsIdentifier].latexParens === false) {
              lhsParens = false;
            }
          }

          if (rhsPrecedence !== null) {
            if (operators.properties[precedence][rootIdentifier].latexRightParens === false) {
              rhsParens = false;
            }

            if (operators.properties[rhsPrecedence][rhsIdentifier].latexParens === false) {
              rhsParens = false;
            }
          }
        }

        result = [lhsParens, rhsParens];
        break;

      default:
        if ((root.getIdentifier() === 'OperatorNode:add') || (root.getIdentifier() === 'OperatorNode:multiply')) {
          var result = args.map(function (arg) {
            var argPrecedence = operators.getPrecedence(arg, parenthesis);
            var assocWithArg = operators.isAssociativeWith(root, arg, parenthesis);
            var argAssociativity = operators.getAssociativity(arg, parenthesis);
            if (argPrecedence === null) {
              //if the argument has no defined precedence, no parens are needed
              return false;
            } else if ((precedence === argPrecedence) && (associativity === argAssociativity) && !assocWithArg) {
              return true;
            } else if (argPrecedence < precedence) {
              return true;
            }

            return false;
          });
        }
        break;
    }

    //handles an edge case of 'auto' parentheses with implicit multiplication of ConstantNode
    //In that case print parentheses for ParenthesisNodes even though they normally wouldn't be
    //printed.
    if ((args.length >= 2) && (root.getIdentifier() === 'OperatorNode:multiply') && root.implicit && (parenthesis === 'auto') && (implicit === 'hide')) {
      result = args.map(function (arg, index) {
        var isParenthesisNode = (arg.getIdentifier() === 'ParenthesisNode');
        if (result[index] || isParenthesisNode) { //put in parenthesis?
          return true;
        }

        return false;
      });
    }

    return result;
  }

  /**
   * Get string representation.
   * @param {Object} options
   * @return {string} str
   */
  OperatorNode.prototype._toString = function (options) {
    var parenthesis = (options && options.parenthesis) ? options.parenthesis : 'keep';
    var implicit = (options && options.implicit) ? options.implicit : 'hide';
    var args = this.args;
    var parens = calculateNecessaryParentheses(this, parenthesis, implicit, args, false);

    if (args.length === 1) { //unary operators
      var assoc = operators.getAssociativity(this, parenthesis);

      var operand = args[0].toString(options);
      if (parens[0]) {
        operand = '(' + operand + ')';
      }

      if (assoc === 'right') { //prefix operator
        return this.op + operand;
      }
      else if (assoc === 'left') { //postfix
        return operand + this.op;
      }

      //fall back to postfix
      return operand + this.op;
    } else if (args.length == 2) {
      var lhs = args[0].toString(options); //left hand side
      var rhs = args[1].toString(options); //right hand side
      if (parens[0]) { //left hand side in parenthesis?
        lhs = '(' + lhs + ')';
      }
      if (parens[1]) { //right hand side in parenthesis?
        rhs = '(' + rhs + ')';
      }

      if (this.implicit && (this.getIdentifier() === 'OperatorNode:multiply') && (implicit == 'hide')) {
        return lhs + ' ' + rhs;
      }

      return lhs + ' ' + this.op + ' ' + rhs;
    } else if ((args.length > 2) && ((this.getIdentifier() === 'OperatorNode:add') || (this.getIdentifier() === 'OperatorNode:multiply'))) {
      var stringifiedArgs = args.map(function (arg, index) {
        arg = arg.toString(options);
        if (parens[index]) { //put in parenthesis?
          arg = '(' + arg + ')';
        }

        return arg;
      });

      if (this.implicit && (this.getIdentifier() === 'OperatorNode:multiply') && (implicit === 'hide')) {
        return stringifiedArgs.join(' ');
      }

      return stringifiedArgs.join(' ' + this.op + ' ');
    } else {
      //fallback to formatting as a function call
      return this.fn + '(' + this.args.join(', ') + ')';
    }
  };

  /**
   * Get HTML representation.
   * @param {Object} options
   * @return {string} str
   */
  OperatorNode.prototype.toHTML = function (options) {
    var parenthesis = (options && options.parenthesis) ? options.parenthesis : 'keep';
    var implicit = (options && options.implicit) ? options.implicit : 'hide';
    var args = this.args;
    var parens = calculateNecessaryParentheses(this, parenthesis, implicit, args, false);

    if (args.length === 1) { //unary operators
      var assoc = operators.getAssociativity(this, parenthesis);

      var operand = args[0].toHTML(options);
      if (parens[0]) {
        operand = '<span class="math-parenthesis math-round-parenthesis">(</span>' + operand + '<span class="math-parenthesis math-round-parenthesis">)</span>';
      }

      if (assoc === 'right') { //prefix operator
        return '<span class="math-operator math-unary-operator math-lefthand-unary-operator">' + escape(this.op) + '</span>' + operand;
      }
      else if (assoc === 'left') { //postfix
        return '<span class="math-operator math-unary-operator math-righthand-unary-operator">' + escape(this.op) + '</span>' + operand;
      }

      //fall back to postfix
      return '<span class="math-operator math-unary-operator math-righthand-unary-operator">' + escape(this.op) + '</span>' + operand;
    }
	else if (args.length == 2) { // binary operatoes
      var lhs = args[0].toHTML(options); //left hand side
      var rhs = args[1].toHTML(options); //right hand side
      if (parens[0]) { //left hand side in parenthesis?
        lhs = '<span class="math-parenthesis math-round-parenthesis">(</span>' + lhs + '<span class="math-parenthesis math-round-parenthesis">)</span>';
      }
      if (parens[1]) { //right hand side in parenthesis?
        rhs = '<span class="math-parenthesis math-round-parenthesis">(</span>' + rhs + '<span class="math-parenthesis math-round-parenthesis">)</span>';
      }
	  
	  if (this.implicit && (this.getIdentifier() === 'OperatorNode:multiply') && (implicit == 'hide')) {
	    return lhs + '<span class="math-operator math-binary-operator math-implicit-binary-operator"></span>' + rhs;
	  }
      
	  return lhs + '<span class="math-operator math-binary-operator math-explicit-binary-operator">' + escape(this.op) + '</span>' + rhs;
    }
	else if ((args.length > 2) && ((this.getIdentifier() === 'OperatorNode:add') || (this.getIdentifier() === 'OperatorNode:multiply'))) {
      var stringifiedArgs = args.map(function (arg, index) {
        arg = arg.toHTML(options);
        if (parens[index]) { //put in parenthesis?
          arg = '<span class="math-parenthesis math-round-parenthesis">(</span>' + arg + '<span class="math-parenthesis math-round-parenthesis">)</span>';
        }

        return arg;
      });

      if (this.implicit && (this.getIdentifier() === 'OperatorNode:multiply') && (implicit === 'hide')) {
        return stringifiedArgs.join('<span class="math-operator math-binary-operator math-implicit-binary-operator"></span>');
      }

      return stringifiedArgs.join('<span class="math-operator math-binary-operator math-explicit-binary-operator">' + escape(this.op) + '</span>');
    } else {
      //fallback to formatting as a function call
      return '<span class="math-function">' + escape(this.fn) + '</span><span class="math-paranthesis math-round-parenthesis">(</span>' + stringifiedArgs.join('<span class="math-separator">,</span>') + '<span class="math-paranthesis math-round-parenthesis">)</span>';
    }
  };

  /**
   * Get LaTeX representation
   * @param {Object} options
   * @return {string} str
   */
  OperatorNode.prototype._toTex = function (options) {
    var parenthesis = (options && options.parenthesis) ? options.parenthesis : 'keep';
    var implicit = (options && options.implicit) ? options.implicit : 'hide';
    var args = this.args;
    var parens = calculateNecessaryParentheses(this, parenthesis, implicit, args, true);
    var op = latex.operators[this.fn];
    op = typeof op === 'undefined' ? this.op : op; //fall back to using this.op

    if (args.length === 1) { //unary operators
      var assoc = operators.getAssociativity(this, parenthesis);

      var operand = args[0].toTex(options);
      if (parens[0]) {
        operand = '\\left(' + operand + '\\right)';
      }

      if (assoc === 'right') { //prefix operator
        return op + operand;
      }
      else if (assoc === 'left') { //postfix operator
        return operand + op;
      }

      //fall back to postfix
      return operand + op;
    } else if (args.length === 2) { //binary operators
      var lhs = args[0]; //left hand side
      var lhsTex = lhs.toTex(options);
      if (parens[0]) {
        lhsTex = '\\left(' + lhsTex + '\\right)';
      }

      var rhs = args[1]; //right hand side
      var rhsTex = rhs.toTex(options);
      if (parens[1]) {
        rhsTex = '\\left(' + rhsTex + '\\right)';
      }

      //handle some exceptions (due to the way LaTeX works)
      var lhsIdentifier;
      if (parenthesis === 'keep') {
        lhsIdentifier = lhs.getIdentifier();
      }
      else {
        //Ignore ParenthesisNodes if in 'keep' mode
        lhsIdentifier = lhs.getContent().getIdentifier();
      }
      switch (this.getIdentifier()) {
        case 'OperatorNode:divide':
          //op contains '\\frac' at this point
          return op + '{' + lhsTex + '}' + '{' + rhsTex + '}';
        case 'OperatorNode:pow':
          lhsTex = '{' + lhsTex + '}';
          rhsTex = '{' + rhsTex + '}';
          switch (lhsIdentifier) {
            case 'ConditionalNode': //
            case 'OperatorNode:divide':
              lhsTex = '\\left(' + lhsTex + '\\right)';
          }
        case 'OperatorNode:multiply':
          if (this.implicit && (implicit === 'hide')) {
            return lhsTex + '~' + rhsTex;
          }
      }
      return lhsTex + op + rhsTex;
    } else if ((args.length > 2) && ((this.getIdentifier() === 'OperatorNode:add') || (this.getIdentifier() === 'OperatorNode:multiply'))) {
      var texifiedArgs = args.map(function (arg, index) {
        arg = arg.toTex(options);
        if (parens[index]) {
          arg = '\\left(' + arg + '\\right)';
        }
        return arg;
      });

      if ((this.getIdentifier() === 'OperatorNode:multiply') && this.implicit) {
        return texifiedArgs.join('~');
      }

      return texifiedArgs.join(op)
    } else {
      //fall back to formatting as a function call
      //as this is a fallback, it doesn't use
      //fancy function names
      return '\\mathrm{' + this.fn + '}\\left('
          + args.map(function (arg) {
            return arg.toTex(options);
          }).join(',') + '\\right)';
    }
  };

  /**
   * Get identifier.
   * @return {string}
   */
  OperatorNode.prototype.getIdentifier = function () {
    return this.type + ':' + this.fn;
  };

  return OperatorNode;
}

exports.name = 'OperatorNode';
exports.path = 'expression.node';
exports.factory = factory;
