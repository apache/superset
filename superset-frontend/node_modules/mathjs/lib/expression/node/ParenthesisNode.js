'use strict';

function factory (type, config, load, typed) {
  var register = load(require('./compile')).register;
  var compile = load(require('./compile')).compile;
  var Node = load(require('./Node'));

  /**
   * @constructor ParenthesisNode
   * @extends {Node}
   * A parenthesis node describes manual parenthesis from the user input
   * @param {Node} content
   * @extends {Node}
   */
  function ParenthesisNode(content) {
    if (!(this instanceof ParenthesisNode)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    // validate input
    if (!type.isNode(content)) {
      throw new TypeError('Node expected for parameter "content"');
    }

    this.content = content;
  }

  ParenthesisNode.prototype = new Node();

  ParenthesisNode.prototype.type = 'ParenthesisNode';

  ParenthesisNode.prototype.isParenthesisNode = true;

  /**
   * Compile the node to javascript code
   * @param {ParenthesisNode} node The node to be compiled
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
  function compileParenthesisNode(node, defs, args) {
    if (!(node instanceof ParenthesisNode)) {
      throw new TypeError('No valid ParenthesisNode')
    }

    return compile(node.content, defs, args);
  }

  // register the compile function
  register(ParenthesisNode.prototype.type, compileParenthesisNode);

  /**
   * Get the content of the current Node.
   * @return {Node} content
   * @override
   **/
  ParenthesisNode.prototype.getContent = function () {
    return this.content.getContent();
  };

  /**
   * Execute a callback for each of the child nodes of this node
   * @param {function(child: Node, path: string, parent: Node)} callback
   */
  ParenthesisNode.prototype.forEach = function (callback) {
    callback(this.content, 'content', this);
  };

  /**
   * Create a new ParenthesisNode having it's childs be the results of calling
   * the provided callback function for each of the childs of the original node.
   * @param {function(child: Node, path: string, parent: Node) : Node} callback
   * @returns {ParenthesisNode} Returns a clone of the node
   */
  ParenthesisNode.prototype.map = function (callback) {
    var content = callback(this.content, 'content', this);
    return new ParenthesisNode(content);
  };

  /**
   * Create a clone of this node, a shallow copy
   * @return {ParenthesisNode}
   */
  ParenthesisNode.prototype.clone = function() {
    return new ParenthesisNode(this.content);
  };

  /**
   * Get string representation
   * @param {Object} options
   * @return {string} str
   * @override
   */
  ParenthesisNode.prototype._toString = function(options) {
    if ((!options) || (options && !options.parenthesis) || (options && options.parenthesis === 'keep')) {
      return '(' + this.content.toString(options) + ')';
    }
    return this.content.toString(options);
  };

  /**
   * Get HTML representation
   * @param {Object} options
   * @return {string} str
   * @override
   */
  ParenthesisNode.prototype.toHTML = function(options) {
    if ((!options) || (options && !options.parenthesis) || (options && options.parenthesis === 'keep')) {
      return '<span class="math-parenthesis math-round-parenthesis">(</span>' + this.content.toHTML(options) + '<span class="math-parenthesis math-round-parenthesis">)</span>';
    }
    return this.content.toHTML(options);
  };

  /**
   * Get LaTeX representation
   * @param {Object} options
   * @return {string} str
   * @override
   */
  ParenthesisNode.prototype._toTex = function(options) {
    if ((!options) || (options && !options.parenthesis) || (options && options.parenthesis === 'keep')) {
      return '\\left(' + this.content.toTex(options) + '\\right)';
    }
    return this.content.toTex(options);
  };

  return ParenthesisNode;
}

exports.name = 'ParenthesisNode';
exports.path = 'expression.node';
exports.factory = factory;
