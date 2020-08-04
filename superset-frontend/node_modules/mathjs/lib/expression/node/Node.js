'use strict';

var keywords = require('../keywords');
var deepEqual= require('../../utils/object').deepEqual;
var hasOwnProperty = require('../../utils/object').hasOwnProperty;

function factory (type, config, load, typed, math) {
  var compile = load(require('./compile')).compile;

  /**
   * Node
   */
  function Node() {
    if (!(this instanceof Node)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }
  }

  /**
   * Evaluate the node
   * @param {Object} [scope]  Scope to read/write variables
   * @return {*}              Returns the result
   */
  Node.prototype.eval = function(scope) {
    return this.compile().eval(scope);
  };

  Node.prototype.type = 'Node';

  Node.prototype.isNode = true;

  Node.prototype.comment = '';

  /**
   * Compile the node to javascript code
   * @return {{eval: function}} expr  Returns an object with a function 'eval',
   *                                  which can be invoked as expr.eval([scope]),
   *                                  where scope is an optional object with
   *                                  variables.
   */
  Node.prototype.compile = function () {
    // TODO: calling compile(math) is deprecated since version 2.0.0. Remove this warning some day
    if (arguments.length > 0) {
      throw new Error('Calling compile(math) is deprecated. Call the function as compile() instead.');
    }

    // definitions globally available inside the closure of the compiled expressions
    var defs = {
      math: math.expression.mathWithTransform,
      args: {}, // can be filled with names of FunctionAssignment arguments
      _validateScope: _validateScope
    };

    // will be used to put local function arguments
    var args = {};

    var code = compile(this, defs, args);

    var defsCode = Object.keys(defs).map(function (name) {
      return '    var ' + name + ' = defs["' + name + '"];';
    });

    var factoryCode =
        defsCode.join(' ') +
        'return {' +
        '  "eval": function (scope) {' +
        '    if (scope) _validateScope(scope);' +
        '    scope = scope || {};' +
        '    return ' + code + ';' +
        '  }' +
        '};';

    var factory = new Function('defs', factoryCode);
    return factory(defs);
  };

  /**
   * Execute a callback for each of the child nodes of this node
   * @param {function(child: Node, path: string, parent: Node)} callback
   */
  Node.prototype.forEach = function (callback) {
    // must be implemented by each of the Node implementations
    throw new Error('Cannot run forEach on a Node interface');
  };

  /**
   * Create a new Node having it's childs be the results of calling
   * the provided callback function for each of the childs of the original node.
   * @param {function(child: Node, path: string, parent: Node): Node} callback
   * @returns {OperatorNode} Returns a transformed copy of the node
   */
  Node.prototype.map = function (callback) {
    // must be implemented by each of the Node implementations
    throw new Error('Cannot run map on a Node interface');
  };

  /**
   * Validate whether an object is a Node, for use with map
   * @param {Node} node
   * @returns {Node} Returns the input if it's a node, else throws an Error
   * @protected
   */
  Node.prototype._ifNode = function (node) {
    if (!type.isNode(node)) {
      throw new TypeError('Callback function must return a Node');
    }

    return node;
  };

  /**
   * Recursively traverse all nodes in a node tree. Executes given callback for
   * this node and each of its child nodes.
   * @param {function(node: Node, path: string, parent: Node)} callback
   *          A callback called for every node in the node tree.
   */
  Node.prototype.traverse = function (callback) {
    // execute callback for itself
    callback(this, null, null);

    // recursively traverse over all childs of a node
    function _traverse(node, callback) {
      node.forEach(function (child, path, parent) {
        callback(child, path, parent);
        _traverse(child, callback);
      });
    }

    _traverse(this, callback);
  };

  /**
   * Recursively transform a node tree via a transform function.
   *
   * For example, to replace all nodes of type SymbolNode having name 'x' with a
   * ConstantNode with value 2:
   *
   *     var res = Node.transform(function (node, path, parent) {
   *       if (node && node.isSymbolNode) && (node.name == 'x')) {
   *         return new ConstantNode(2);
   *       }
   *       else {
   *         return node;
   *       }
   *     });
   *
   * @param {function(node: Node, path: string, parent: Node) : Node} callback
   *          A mapping function accepting a node, and returning
   *          a replacement for the node or the original node.
   *          Signature: callback(node: Node, index: string, parent: Node) : Node
   * @return {Node} Returns the original node or its replacement
   */
  Node.prototype.transform = function (callback) {
    // traverse over all childs
    function _transform (node, callback) {
      return node.map(function(child, path, parent) {
        var replacement = callback(child, path, parent);
        return _transform(replacement, callback);
      });
    }

    var replacement = callback(this, null, null);
    return _transform(replacement, callback);
  };

  /**
   * Find any node in the node tree matching given filter function. For example, to
   * find all nodes of type SymbolNode having name 'x':
   *
   *     var results = Node.filter(function (node) {
   *       return (node && node.isSymbolNode) && (node.name == 'x');
   *     });
   *
   * @param {function(node: Node, path: string, parent: Node) : Node} callback
   *            A test function returning true when a node matches, and false
   *            otherwise. Function signature:
   *            callback(node: Node, index: string, parent: Node) : boolean
   * @return {Node[]} nodes       An array with nodes matching given filter criteria
   */
  Node.prototype.filter = function (callback) {
    var nodes = [];

    this.traverse(function (node, path, parent) {
      if (callback(node, path, parent)) {
        nodes.push(node);
      }
    });

    return nodes;
  };

  // TODO: deprecated since version 1.1.0, remove this some day
  Node.prototype.find = function () {
    throw new Error('Function Node.find is deprecated. Use Node.filter instead.');
  };

  // TODO: deprecated since version 1.1.0, remove this some day
  Node.prototype.match = function () {
    throw new Error('Function Node.match is deprecated. See functions Node.filter, Node.transform, Node.traverse.');
  };

  /**
   * Create a shallow clone of this node
   * @return {Node}
   */
  Node.prototype.clone = function () {
    // must be implemented by each of the Node implementations
    throw new Error('Cannot clone a Node interface');
  };

  /**
   * Create a deep clone of this node
   * @return {Node}
   */
  Node.prototype.cloneDeep = function () {
    return this.map(function (node) {
      return node.cloneDeep();
    });
  };

  /**
   * Deep compare this node with another node.
   * @param {Node} other
   * @return {boolean} Returns true when both nodes are of the same type and
   *                   contain the same values (as do their childs)
   */
  Node.prototype.equals = function (other) {
    return other
        ? deepEqual(this, other)
        : false
  };

  /**
   * Get string representation. (wrapper function)
   *
   * This function can get an object of the following form:
   * {
   *    handler: //This can be a callback function of the form
   *             // "function callback(node, options)"or
   *             // a map that maps function names (used in FunctionNodes)
   *             // to callbacks
   *    parenthesis: "keep" //the parenthesis option (This is optional)
   * }
   *
   * @param {Object} [options]
   * @return {string}
   */
  Node.prototype.toString = function (options) {
    var customString;
    if (options && typeof options === 'object') {
        switch (typeof options.handler) {
          case 'object':
          case 'undefined':
            break;
          case 'function':
            customString = options.handler(this, options);
            break;
          default:
            throw new TypeError('Object or function expected as callback');
        }
    }

    if (typeof customString !== 'undefined') {
      return customString;
    }

    return this._toString(options);
  };

  /**
   * Get HTML representation. (wrapper function)
   *
   * This function can get an object of the following form:
   * {
   *    handler: //This can be a callback function of the form
   *             // "function callback(node, options)" or
   *             // a map that maps function names (used in FunctionNodes)
   *             // to callbacks
   *    parenthesis: "keep" //the parenthesis option (This is optional)
   * }
   *
   * @param {Object} [options]
   * @return {string}
   */
  Node.prototype.toHTML = function (options) {
    var customString;
    if (options && typeof options === 'object') {
        switch (typeof options.handler) {
          case 'object':
          case 'undefined':
            break;
          case 'function':
            customString = options.handler(this, options);
            break;
          default:
            throw new TypeError('Object or function expected as callback');
        }
    }

    if (typeof customString !== 'undefined') {
      return customString;
    }

    return this.toHTML(options);
  };

  /**
   * Internal function to generate the string output.
   * This has to be implemented by every Node
   *
   * @throws {Error}
   */
  Node.prototype._toString = function () {
    //must be implemented by each of the Node implementations
    throw new Error('_toString not implemented for ' + this.type);
  };

  /**
   * Get LaTeX representation. (wrapper function)
   *
   * This function can get an object of the following form:
   * {
   *    handler: //This can be a callback function of the form
   *             // "function callback(node, options)"or
   *             // a map that maps function names (used in FunctionNodes)
   *             // to callbacks
   *    parenthesis: "keep" //the parenthesis option (This is optional)
   * }
   *
   * @param {Object} [options]
   * @return {string}
   */
  Node.prototype.toTex = function (options) {
    var customTex;
    if (options && typeof options == 'object') {
      switch (typeof options.handler) {
        case 'object':
        case 'undefined':
          break;
        case 'function':
          customTex = options.handler(this, options);
          break;
        default:
          throw new TypeError('Object or function expected as callback');
      }
    }

    if (typeof customTex !== 'undefined') {
      return customTex;
    }

    return this._toTex(options);
  };

  /**
   * Internal function to generate the LaTeX output.
   * This has to be implemented by every Node
   *
   * @param {Object} [options]
   * @throws {Error}
   */
  Node.prototype._toTex = function (options) {
    //must be implemented by each of the Node implementations
    throw new Error('_toTex not implemented for ' + this.type);
  };

  /**
   * Get identifier.
   * @return {string}
   */
  Node.prototype.getIdentifier = function () {
    return this.type;
  };

  /**
   * Get the content of the current Node.
   * @return {Node} node
   **/
  Node.prototype.getContent = function () {
    return this;
  };

  /**
   * Validate the symbol names of a scope.
   * Throws an error when the scope contains an illegal symbol.
   * @param {Object} scope
   */
  function _validateScope(scope) {
    for (var symbol in scope) {
      if (hasOwnProperty(scope, symbol)) {
        if (symbol in keywords) {
          throw new Error('Scope contains an illegal symbol, "' + symbol + '" is a reserved keyword');
        }
      }
    }
  }

  return Node;
}

exports.name = 'Node';
exports.path = 'expression.node';
exports.math = true; // request access to the math namespace as 5th argument of the factory function
exports.factory = factory;
