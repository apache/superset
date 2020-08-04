'use strict';

var map = require('../../utils/array').map;
var join = require('../../utils/array').join;

function factory (type, config, load, typed) {
  var register = load(require('./compile')).register;
  var compile = load(require('./compile')).compile;
  var Node = load(require('./Node'));
  var ResultSet = load(require('../../type/resultset/ResultSet'));

  /**
   * @constructor BlockNode
   * @extends {Node}
   * Holds a set with blocks
   * @param {Array.<{node: Node} | {node: Node, visible: boolean}>} blocks
   *            An array with blocks, where a block is constructed as an Object
   *            with properties block, which is a Node, and visible, which is
   *            a boolean. The property visible is optional and is true by default
   */
  function BlockNode(blocks) {
    if (!(this instanceof BlockNode)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    // validate input, copy blocks
    if (!Array.isArray(blocks)) throw new Error('Array expected');
    this.blocks = blocks.map(function (block) {
      var node = block && block.node;
      var visible = block && block.visible !== undefined ? block.visible : true;

      if (!type.isNode(node)) throw new TypeError('Property "node" must be a Node');
      if (typeof visible !== 'boolean') throw new TypeError('Property "visible" must be a boolean');

      return {
        node: node,
        visible: visible
      }
    });
  }

  BlockNode.prototype = new Node();

  BlockNode.prototype.type = 'BlockNode';

  BlockNode.prototype.isBlockNode = true;

  /**
   * Compile the node to javascript code
   * @param {BlockNode} node  The node to be compiled
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
  function compileBlockNode (node, defs, args) {
    if (!(node instanceof BlockNode)) {
      throw new TypeError('No valid BlockNode')
    }

    defs.ResultSet = ResultSet;
    var blocks = map(node.blocks, function (param) {
      var js = compile(param.node, defs, args);
      if (param.visible) {
        return 'results.push(' + js + ');';
      }
      else {
        return js + ';';
      }
    });

    return '(function () {' +
        'var results = [];' +
        join(blocks, '') +
        'return new ResultSet(results);' +
        '})()';
  }

  // register the compile function
  register(BlockNode.prototype.type, compileBlockNode);

  /**
   * Execute a callback for each of the child blocks of this node
   * @param {function(child: Node, path: string, parent: Node)} callback
   */
  BlockNode.prototype.forEach = function (callback) {
    for (var i = 0; i < this.blocks.length; i++) {
      callback(this.blocks[i].node, 'blocks[' + i + '].node', this);
    }
  };

  /**
   * Create a new BlockNode having it's childs be the results of calling
   * the provided callback function for each of the childs of the original node.
   * @param {function(child: Node, path: string, parent: Node): Node} callback
   * @returns {BlockNode} Returns a transformed copy of the node
   */
  BlockNode.prototype.map = function (callback) {
    var blocks = [];
    for (var i = 0; i < this.blocks.length; i++) {
      var block = this.blocks[i];
      var node = this._ifNode(callback(block.node, 'blocks[' + i + '].node', this));
      blocks[i] = {
        node: node,
        visible: block.visible
      };
    }
    return new BlockNode(blocks);
  };

  /**
   * Create a clone of this node, a shallow copy
   * @return {BlockNode}
   */
  BlockNode.prototype.clone = function () {
    var blocks = this.blocks.map(function (block) {
      return {
        node: block.node,
        visible: block.visible
      };
    });

    return new BlockNode(blocks);
  };

  /**
   * Get string representation
   * @param {Object} options
   * @return {string} str
   * @override
   */
  BlockNode.prototype._toString = function (options) {
    return this.blocks.map(function (param) {
      return param.node.toString(options) + (param.visible ? '' : ';');
    }).join('\n');
  };

  /**
   * Get HTML representation
   * @param {Object} options
   * @return {string} str
   * @override
   */
  BlockNode.prototype.toHTML = function (options) {
    return this.blocks.map(function (param) {
      return param.node.toHTML(options) + (param.visible ? '' : '<span class="math-separator">;</span>');
    }).join('<span class="math-separator"><br /></span>');
  };

  /**
   * Get LaTeX representation
   * @param {Object} options
   * @return {string} str
   */
  BlockNode.prototype._toTex = function (options) {
    return this.blocks.map(function (param) {
      return param.node.toTex(options) + (param.visible ? '' : ';');
    }).join('\\;\\;\n');
  };

  return BlockNode;
}

exports.name = 'BlockNode';
exports.path = 'expression.node';
exports.factory = factory;
