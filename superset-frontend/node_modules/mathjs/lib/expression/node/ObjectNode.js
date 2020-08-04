'use strict';

var stringify = require('../../utils/string').stringify;
var escape = require('../../utils/string').escape;
var isSafeProperty = require('../../utils/customs').isSafeProperty;
var hasOwnProperty = require('../../utils/object').hasOwnProperty;

function factory (type, config, load, typed) {
  var register = load(require('./compile')).register;
  var compile = load(require('./compile')).compile;
  var Node = load(require('./Node'));

  /**
   * @constructor ObjectNode
   * @extends {Node}
   * Holds an object with keys/values
   * @param {Object.<string, Node>} [properties]   array with key/value pairs
   */
  function ObjectNode(properties) {
    if (!(this instanceof ObjectNode)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    this.properties = properties || {};

    // validate input
    if (properties) {
      if (!(typeof properties === 'object') || !Object.keys(properties).every(function (key) {
            return type.isNode(properties[key]);
          })) {
        throw new TypeError('Object containing Nodes expected');
      }
    }
  }

  ObjectNode.prototype = new Node();

  ObjectNode.prototype.type = 'ObjectNode';

  ObjectNode.prototype.isObjectNode = true;

  /**
   * Compile the node to javascript code
   * @param {ObjectNode} node The node to be compiled
   * @param {Object} defs     Object which can be used to define functions
   *                          or constants globally available for the compiled
   *                          expression
   * @param {Object} args     Object with local function arguments, the key is
   *                          the name of the argument, and the value is `true`.
   *                          The object may not be mutated, but must be
   *                          extended instead.
   * @return {string} code
   * @private
   */
  function compileObjectNode(node, defs, args) {
    if (!(node instanceof ObjectNode)) {
      throw new TypeError('No valid ObjectNode')
    }

    var entries = [];
    for (var key in node.properties) {
      if (hasOwnProperty(node.properties, key)) {
        // we stringify/parse the key here to resolve unicode characters,
        // so you cannot create a key like {"co\\u006Estructor": null} 
        var stringifiedKey = stringify(key)
        var parsedKey = JSON.parse(stringifiedKey)
        if (!isSafeProperty(node.properties, parsedKey)) {
          throw new Error('No access to property "' + parsedKey + '"');
        }

        entries.push(stringifiedKey + ': ' + compile(node.properties[key], defs, args));
      }
    }
    return '{' + entries.join(', ') + '}';
  }

  // register the compile function
  register(ObjectNode.prototype.type, compileObjectNode);

  /**
   * Execute a callback for each of the child nodes of this node
   * @param {function(child: Node, path: string, parent: Node)} callback
   */
  ObjectNode.prototype.forEach = function (callback) {
    for (var key in this.properties) {
      if (this.properties.hasOwnProperty(key)) {
        callback(this.properties[key], 'properties[' + stringify(key) + ']', this);
      }
    }
  };

  /**
   * Create a new ObjectNode having it's childs be the results of calling
   * the provided callback function for each of the childs of the original node.
   * @param {function(child: Node, path: string, parent: Node): Node} callback
   * @returns {ObjectNode} Returns a transformed copy of the node
   */
  ObjectNode.prototype.map = function (callback) {
    var properties = {};
    for (var key in this.properties) {
      if (this.properties.hasOwnProperty(key)) {
        properties[key] = this._ifNode(callback(this.properties[key],
            'properties[' + stringify(key) + ']', this));
      }
    }
    return new ObjectNode(properties);
  };

  /**
   * Create a clone of this node, a shallow copy
   * @return {ObjectNode}
   */
  ObjectNode.prototype.clone = function() {
    var properties = {};
    for (var key in this.properties) {
      if (this.properties.hasOwnProperty(key)) {
        properties[key] = this.properties[key];
      }
    }
    return new ObjectNode(properties);
  };

  /**
   * Get string representation
   * @param {Object} options
   * @return {string} str
   * @override
   */
  ObjectNode.prototype._toString = function(options) {
    var entries = [];
    for (var key in this.properties) {
      if (this.properties.hasOwnProperty(key)) {
        entries.push(stringify(key) + ': ' + this.properties[key].toString(options));
      }
    }
    return '{' + entries.join(', ') + '}';
  };

  /**
   * Get HTML representation
   * @param {Object} options
   * @return {string} str
   * @override
   */
  ObjectNode.prototype.toHTML = function(options) {
    var entries = [];
    for (var key in this.properties) {
      if (this.properties.hasOwnProperty(key)) {
        entries.push('<span class="math-symbol math-property">' + escape(key) + '</span>' + '<span class="math-operator math-assignment-operator math-property-assignment-operator math-binary-operator">:</span>' + this.properties[key].toHTML(options));
      }
    }
    return '<span class="math-parenthesis math-curly-parenthesis">{</span>' + entries.join('<span class="math-separator">,</span>') + '<span class="math-parenthesis math-curly-parenthesis">}</span>';
  };

  /**
   * Get LaTeX representation
   * @param {Object} options
   * @return {string} str
   */
  ObjectNode.prototype._toTex = function(options) {
    var entries = [];
    for (var key in this.properties) {
      if (this.properties.hasOwnProperty(key)) {
        entries.push("\\mathbf{" + key + ':} & ' + this.properties[key].toTex(options) + "\\\\");
      }
    }
    return '\\left\\{\\begin{array}{ll}' + entries.join('\n') + '\\end{array}\\right\\}';
  };

  return ObjectNode;
}

exports.name = 'ObjectNode';
exports.path = 'expression.node';
exports.factory = factory;
