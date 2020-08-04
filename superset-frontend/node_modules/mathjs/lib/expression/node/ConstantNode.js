'use strict';

var getType = require('../../utils/types').type;
var stringify = require('../../utils/string').stringify;
var escape = require('../../utils/string').escape;
var escapeLatex = require('../../utils/latex').escape;

function factory (type, config, load, typed) {
  var register = load(require('./compile')).register;
  var compile = load(require('./compile')).compile;
  var Node = load(require('./Node'));

  /**
   * A ConstantNode holds a constant value like a number or string. A ConstantNode
   * stores a stringified version of the value and uses this to compile to
   * JavaScript.
   *
   * In case of a stringified number as input, this may be compiled to a BigNumber
   * when the math instance is configured for BigNumbers.
   *
   * Usage:
   *
   *     // stringified values with type
   *     new ConstantNode('2.3', 'number');
   *     new ConstantNode('true', 'boolean');
   *     new ConstantNode('hello', 'string');
   *
   *     // non-stringified values, type will be automatically detected
   *     new ConstantNode(2.3);
   *     new ConstantNode('hello');
   *
   * @param {string | number | boolean | null | undefined} value
   *                            When valueType is provided, value must contain
   *                            an uninterpreted string representing the value.
   *                            When valueType is undefined, value can be a
   *                            number, string, boolean, null, or undefined, and
   *                            the type will be determined automatically.
   * @param {string} [valueType]  The type of value. Choose from 'number', 'string',
   *                              'boolean', 'undefined', 'null'
   * @constructor ConstantNode
   * @extends {Node}
   */
  function ConstantNode(value, valueType) {
    if (!(this instanceof ConstantNode)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    if (valueType) {
      if (typeof valueType !== 'string') {
        throw new TypeError('String expected for parameter "valueType"');
      }
      if (typeof value !== 'string') {
        throw new TypeError('String expected for parameter "value"');
      }

      this.value = value;
      this.valueType = valueType;
    }
    else {
      // stringify the value and determine the type
      this.value = value + '';
      this.valueType = getType(value);
    }

    if (!SUPPORTED_TYPES[this.valueType]) {
      throw new TypeError('Unsupported type of value "' + this.valueType + '"');
    }
  }

  var SUPPORTED_TYPES = {
    'number': true,
    'string': true,
    'boolean': true,
    'undefined': true,
    'null': true
  };

  ConstantNode.prototype = new Node();

  ConstantNode.prototype.type = 'ConstantNode';

  ConstantNode.prototype.isConstantNode = true;

  /**
   * Compile the node to javascript code
   * @param {ConstantNode} node The node to be compiled
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
  function compileConstantNode(node, defs, args) {
    if (!(node instanceof ConstantNode)) {
      throw new TypeError('No valid ConstantNode')
    }

    switch (node.valueType) {
      case 'number':
        if (config.number === 'BigNumber') {
          return 'math.bignumber(' + stringify(node.value) + ')';
        }
        else if (config.number === 'Fraction') {
          return 'math.fraction(' + stringify(node.value) + ')';
        }
        else {
          // remove leading zeros like '003.2' which are not allowed by JavaScript
          validateNumericValue(node.value);
          return node.value.replace(/^(0*)[0-9]/, function (match, zeros) {
            return match.substring(zeros.length);
          });
        }

      case 'string':
        // Important to escape unescaped double quotes in the string
        return stringify(node.value);

      case 'boolean':
        // prevent invalid values
        return String(node.value) === 'true' ? 'true' : 'false';

      case 'undefined':
        return 'undefined';

      case 'null':
        return 'null';

      default:
        // TODO: move this error to the constructor?
        throw new TypeError('Unsupported type of constant "' + node.valueType + '"');
    }
  }

  /**
   * Test whether value is a string containing a numeric value
   * @param {String} value
   * @return {boolean} Returns true when ok
   */
  function validateNumericValue (value) {
    // The following regexp is relatively permissive
    if (typeof value !== 'string' ||
        !/^[\-+]?((\d+\.?\d*)|(\d*\.?\d+))([eE][+\-]?\d+)?$/.test(value)) {
      throw new Error('Invalid numeric value "' + value + '"');
    }
  }

  // register the compile function
  register(ConstantNode.prototype.type, compileConstantNode);

  /**
   * Execute a callback for each of the child nodes of this node
   * @param {function(child: Node, path: string, parent: Node)} callback
   */
  ConstantNode.prototype.forEach = function (callback) {
    // nothing to do, we don't have childs
  };


  /**
   * Create a new ConstantNode having it's childs be the results of calling
   * the provided callback function for each of the childs of the original node.
   * @param {function(child: Node, path: string, parent: Node) : Node} callback
   * @returns {ConstantNode} Returns a clone of the node
   */
  ConstantNode.prototype.map = function (callback) {
    return this.clone();
  };

  /**
   * Create a clone of this node, a shallow copy
   * @return {ConstantNode}
   */
  ConstantNode.prototype.clone = function () {
    return new ConstantNode(this.value, this.valueType);
  };

  /**
   * Get string representation
   * @param {Object} options
   * @return {string} str
   */
  ConstantNode.prototype._toString = function (options) {
    switch (this.valueType) {
      case 'string':
        return stringify(this.value);

      default:
        return this.value;
    }
  };

  /**
   * Get HTML representation
   * @param {Object} options
   * @return {string} str
   */
  ConstantNode.prototype.toHTML = function (options) {
	var value = escape(this.value);
    switch (this.valueType) {
	  case 'number':
	    return '<span class="math-number">' + value + '</span>';
      case 'string':
	    return '<span class="math-string">' + value + '</span>';
      case 'boolean':
	    return '<span class="math-boolean">' + value + '</span>';
      case 'null':
	    return '<span class="math-null-symbol">' + value + '</span>';
      case 'undefined':
	    return '<span class="math-undefined">' + value + '</span>';

      default:
        return '<span class="math-symbol">' + value + '</span>';
    }
  };

  /**
   * Get LaTeX representation
   * @param {Object} options
   * @return {string} str
   */
  ConstantNode.prototype._toTex = function (options) {
    var value = this.value,
        index;
    switch (this.valueType) {
      case 'string':
        return '\\mathtt{' + escapeLatex(stringify(value)) + '}';

      case 'number':
        index = value.toLowerCase().indexOf('e');
        if (index !== -1) {
          return value.substring(0, index) + '\\cdot10^{' +
              value.substring(index + 1) + '}';
        }
        return value;

      default:
        return value;
    }
  };

  return ConstantNode;
}

exports.name = 'ConstantNode';
exports.path = 'expression.node';
exports.factory = factory;
