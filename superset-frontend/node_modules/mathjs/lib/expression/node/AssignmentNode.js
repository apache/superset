'use strict';

var latex = require('../../utils/latex');
var stringify = require('../../utils/string').stringify;
var getSafeProperty = require('../../utils/customs').getSafeProperty;
var setSafeProperty = require('../../utils/customs').setSafeProperty;

function factory (type, config, load, typed) {
  var register = load(require('./compile')).register;
  var compile = load(require('./compile')).compile;
  var Node = load(require('./Node'));
  var ArrayNode = load(require('./ArrayNode'));
  var matrix = load(require('../../type/matrix/function/matrix'));
  var assign = load(require('./utils/assign'));
  var access = load(require('./utils/access'));

  var keywords = require('../keywords');
  var operators = require('../operators');

  /**
   * @constructor AssignmentNode
   * @extends {Node}
   *
   * Define a symbol, like `a=3.2`, update a property like `a.b=3.2`, or
   * replace a subset of a matrix like `A[2,2]=42`.
   *
   * Syntax:
   *
   *     new AssignmentNode(symbol, value)
   *     new AssignmentNode(object, index, value)
   *
   * Usage:
   *
   *    new AssignmentNode(new SymbolNode('a'), new ConstantNode(2));                      // a=2
   *    new AssignmentNode(new SymbolNode('a'), new IndexNode('b'), new ConstantNode(2))   // a.b=2
   *    new AssignmentNode(new SymbolNode('a'), new IndexNode(1, 2), new ConstantNode(3))  // a[1,2]=3
   *
   * @param {SymbolNode | AccessorNode} object  Object on which to assign a value
   * @param {IndexNode} [index=null]            Index, property name or matrix
   *                                            index. Optional. If not provided
   *                                            and `object` is a SymbolNode,
   *                                            the property is assigned to the
   *                                            global scope.
   * @param {Node} value                        The value to be assigned
   */
  function AssignmentNode(object, index, value) {
    if (!(this instanceof AssignmentNode)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    this.object = object;
    this.index = value ? index : null;
    this.value = value ? value : index;

    // validate input
    if (!type.isSymbolNode(object) && !type.isAccessorNode(object)) {
      throw new TypeError('SymbolNode or AccessorNode expected as "object"');
    }
    if (type.isSymbolNode(object) && object.name === 'end') {
      throw new Error('Cannot assign to symbol "end"');
    }
    if (this.index && !type.isIndexNode(this.index)) { // index is optional
      throw new TypeError('IndexNode expected as "index"');
    }
    if (!type.isNode(this.value)) {
      throw new TypeError('Node expected as "value"');
    }

    // readonly property name
    Object.defineProperty(this, 'name', {
      get: function () {
        if (this.index) {
          return (this.index.isObjectProperty())
              ? this.index.getObjectProperty()
              : '';
        }
        else {
          return this.object.name || '';
        }
      }.bind(this),
      set: function () {
        throw new Error('Cannot assign a new name, name is read-only');
      }
    });
  }

  AssignmentNode.prototype = new Node();

  AssignmentNode.prototype.type = 'AssignmentNode';

  AssignmentNode.prototype.isAssignmentNode = true;

  /**
   * Compile the node to javascript code
   * @param {AssignmentNode} node The node to be compiled
   * @param {Object} defs     Object which can be used to define functions
   *                          or constants globally available for the compiled
   *                          expression
   * @param {Object} args     Object with local function arguments, the key is
   *                          the name of the argument, and the value is `true`.
   *                          The object may not be mutated, but must be
   *                          extended instead.
   * @private
   */
  function compileAssignmentNode (node, defs, args) {
    if (!(node instanceof AssignmentNode)) {
      throw new TypeError('No valid AssignmentNode')
    }

    defs.assign = assign;
    defs.access = access;
    defs.getSafeProperty = getSafeProperty;
    defs.setSafeProperty = setSafeProperty;

    var size;
    var object = compile(node.object, defs, args);
    var index = node.index ? compile(node.index, defs, args) : null;
    var value = compile(node.value, defs, args);
    var jsName = stringify(node.object.name);

    if (!node.index) {
      // apply a variable to the scope, for example `a=2`
      if (!type.isSymbolNode(node.object)) {
        throw new TypeError('SymbolNode expected as object');
      }

      return 'setSafeProperty(scope, ' + jsName + ', ' + value + ')';
    }
    else if (node.index.isObjectProperty()) {
      // apply an object property for example `a.b=2`
      var jsProp = stringify(node.index.getObjectProperty());
      return 'setSafeProperty(' + object + ', ' + jsProp + ', ' + value + ')';
    }
    else if (type.isSymbolNode(node.object)) {
      // update a matrix subset, for example `a[2]=3`
      size = node.index.needsSize() ? 'var size = math.size(object).valueOf();' : '';

      // apply updated object to scope
      return '(function () {' +
          '  var object = ' + object + ';' +
          '  var value = ' + value + ';' +
          '  ' + size +
          '  setSafeProperty(scope, ' + jsName + ', assign(object, ' + index + ', value));' +
          '  return value;' +
          '})()';
    }
    else { // type.isAccessorNode(node.object) === true
      // update a matrix subset, for example `a.b[2]=3`
      size = node.index.needsSize() ? 'var size = math.size(object).valueOf();' : '';

      // we will not use the compile function of the AccessorNode, but compile it
      // ourselves here as we need the parent object of the AccessorNode:
      // wee need to apply the updated object to parent object
      var parentObject = compile(node.object.object, defs, args);

      if (node.object.index.isObjectProperty()) {
        var jsParentProperty = stringify(node.object.index.getObjectProperty());
        return '(function () {' +
            '  var parent = ' + parentObject + ';' +
            '  var object = getSafeProperty(parent, ' + jsParentProperty + ');' + // parentIndex is a property
            '  var value = ' + value + ';' +
            size +
            '  setSafeProperty(parent, ' + jsParentProperty + ', assign(object, ' + index + ', value));' +
            '  return value;' +
            '})()';
      }
      else {
        // if some parameters use the 'end' parameter, we need to calculate the size
        var parentSize = node.object.index.needsSize() ? 'var size = math.size(parent).valueOf();' : '';
        var parentIndex = compile(node.object.index, defs, args);

        return '(function () {' +
            '  var parent = ' + parentObject + ';' +
            '  ' + parentSize +
            '  var parentIndex = ' + parentIndex + ';' +
            '  var object = access(parent, parentIndex);' +
            '  var value = ' + value + ';' +
            '  ' + size +
            '  assign(parent, parentIndex, assign(object, ' + index + ', value));' +
            '  return value;' +
            '})()';
      }
    }
  }

  // register the compile function
  register(AssignmentNode.prototype.type, compileAssignmentNode);

  /**
   * Execute a callback for each of the child nodes of this node
   * @param {function(child: Node, path: string, parent: Node)} callback
   */
  AssignmentNode.prototype.forEach = function (callback) {
    callback(this.object, 'object', this);
    if (this.index) {
      callback(this.index, 'index', this);
    }
    callback(this.value, 'value', this);
  };

  /**
   * Create a new AssignmentNode having it's childs be the results of calling
   * the provided callback function for each of the childs of the original node.
   * @param {function(child: Node, path: string, parent: Node): Node} callback
   * @returns {AssignmentNode} Returns a transformed copy of the node
   */
  AssignmentNode.prototype.map = function (callback) {
    var object = this._ifNode(callback(this.object, 'object', this));
    var index = this.index
        ? this._ifNode(callback(this.index, 'index', this))
        : null;
    var value = this._ifNode(callback(this.value, 'value', this));

    return new AssignmentNode(object, index, value);
  };

  /**
   * Create a clone of this node, a shallow copy
   * @return {AssignmentNode}
   */
  AssignmentNode.prototype.clone = function() {
    return new AssignmentNode(this.object, this.index, this.value);
  };

  /*
   * Is parenthesis needed?
   * @param {node} node
   * @param {string} [parenthesis='keep']
   * @private
   */
  function needParenthesis(node, parenthesis) {
    if (!parenthesis) {
      parenthesis = 'keep';
    }

    var precedence = operators.getPrecedence(node, parenthesis);
    var exprPrecedence = operators.getPrecedence(node.value, parenthesis);
    return (parenthesis === 'all')
      || ((exprPrecedence !== null) && (exprPrecedence <= precedence));
  }

  /**
   * Get string representation
   * @param {Object} options
   * @return {string}
   */
  AssignmentNode.prototype._toString = function(options) {
    var object = this.object.toString(options);
    var index = this.index ? this.index.toString(options) : '';
    var value = this.value.toString(options);
    if (needParenthesis(this, options && options.parenthesis)) {
      value = '(' + value + ')';
    }

    return object + index + ' = ' + value;
  };

  /**
   * Get HTML representation
   * @param {Object} options
   * @return {string}
   */
  AssignmentNode.prototype.toHTML = function(options) {
    var object = this.object.toHTML(options);
    var index = this.index ? this.index.toHTML(options) : '';
    var value = this.value.toHTML(options);
    if (needParenthesis(this, options && options.parenthesis)) {
      value = '<span class="math-paranthesis math-round-parenthesis">(</span>' + value + '<span class="math-paranthesis math-round-parenthesis">)</span>';
    }

    return object + index + '<span class="math-operator math-assignment-operator math-variable-assignment-operator math-binary-operator">=</span>' + value;
  };

  /**
   * Get LaTeX representation
   * @param {Object} options
   * @return {string}
   */
  AssignmentNode.prototype._toTex = function(options) {
    var object = this.object.toTex(options);
    var index = this.index ? this.index.toTex(options) : '';
    var value = this.value.toTex(options);
    if (needParenthesis(this, options && options.parenthesis)) {
      value = '\\left(' + value + '\\right)';
    }

    return object + index + ':=' + value;
  };

  return AssignmentNode;
}

exports.name = 'AssignmentNode';
exports.path = 'expression.node';
exports.factory = factory;
