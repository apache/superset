'use strict';

var operators = require('../operators');

function factory (type, config, load, typed) {
  var register = load(require('./compile')).register;
  var compile = load(require('./compile')).compile;
  var Node = load(require('./Node'));

  /**
   * @constructor RangeNode
   * @extends {Node}
   * create a range
   * @param {Node} start  included lower-bound
   * @param {Node} end    included upper-bound
   * @param {Node} [step] optional step
   */
  function RangeNode(start, end, step) {
    if (!(this instanceof RangeNode)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    // validate inputs
    if (!type.isNode(start)) throw new TypeError('Node expected');
    if (!type.isNode(end)) throw new TypeError('Node expected');
    if (step && !type.isNode(step)) throw new TypeError('Node expected');
    if (arguments.length > 3) throw new Error('Too many arguments');

    this.start = start;         // included lower-bound
    this.end = end;           // included upper-bound
    this.step = step || null;  // optional step
  }

  RangeNode.prototype = new Node();

  RangeNode.prototype.type = 'RangeNode';

  RangeNode.prototype.isRangeNode = true;

  /**
   * Check whether the RangeNode needs the `end` symbol to be defined.
   * This end is the size of the Matrix in current dimension.
   * @return {boolean}
   */
  RangeNode.prototype.needsEnd = function () {
    // find all `end` symbols in this RangeNode
    var endSymbols = this.filter(function (node) {
      return type.isSymbolNode(node) && (node.name === 'end');
    });

    return endSymbols.length > 0;
  };

  /**
   * Compile the node to javascript code
   *
   * When the range has a symbol `end` defined, the RangeNode requires
   * a variable `end` to be defined in the current closure, which must contain
   * the length of the of the matrix that's being handled in the range's
   * dimension. To check whether the `end` variable is needed, call
   * RangeNode.needsEnd().
   *
   * @param {RangeNode} node  The node to be compiled
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
  function compileRangeNode(node, defs, args) {
    if (!(node instanceof RangeNode)) {
      throw new TypeError('No valid RangeNode')
    }

    return 'math.range(' +
        compile(node.start, defs, args) + ', ' +
        compile(node.end, defs, args) +
        (node.step ? (', ' + compile(node.step, defs, args)) : '') +
        ')';
  }

  // register the compile function
  register(RangeNode.prototype.type, compileRangeNode);

  /**
   * Execute a callback for each of the child nodes of this node
   * @param {function(child: Node, path: string, parent: Node)} callback
   */
  RangeNode.prototype.forEach = function (callback) {
    callback(this.start, 'start', this);
    callback(this.end, 'end', this);
    if (this.step) {
      callback(this.step, 'step', this);
    }
  };

  /**
   * Create a new RangeNode having it's childs be the results of calling
   * the provided callback function for each of the childs of the original node.
   * @param {function(child: Node, path: string, parent: Node): Node} callback
   * @returns {RangeNode} Returns a transformed copy of the node
   */
  RangeNode.prototype.map = function (callback) {
    return new RangeNode(
        this._ifNode(callback(this.start, 'start', this)),
        this._ifNode(callback(this.end, 'end', this)),
        this.step && this._ifNode(callback(this.step, 'step', this))
    );
  };

  /**
   * Create a clone of this node, a shallow copy
   * @return {RangeNode}
   */
  RangeNode.prototype.clone = function () {
    return new RangeNode(this.start, this.end, this.step && this.step);
  };

  /**
   * Calculate the necessary parentheses
   * @param {Node} node
   * @param {string} parenthesis
   * @return {Object} parentheses
   * @private
   */
  function calculateNecessaryParentheses(node, parenthesis) {
    var precedence = operators.getPrecedence(node, parenthesis);
    var parens = {};

    var startPrecedence = operators.getPrecedence(node.start, parenthesis);
    parens.start = ((startPrecedence !== null) && (startPrecedence <= precedence))
      || (parenthesis === 'all');

    if (node.step) {
      var stepPrecedence = operators.getPrecedence(node.step, parenthesis);
      parens.step = ((stepPrecedence !== null) && (stepPrecedence <= precedence))
        || (parenthesis === 'all');
    }

    var endPrecedence = operators.getPrecedence(node.end, parenthesis);
    parens.end = ((endPrecedence !== null) && (endPrecedence <= precedence))
      || (parenthesis === 'all');

    return parens;
  }

  /**
   * Get string representation
   * @param {Object} options
   * @return {string} str
   */
  RangeNode.prototype._toString = function (options) {
    var parenthesis = (options && options.parenthesis) ? options.parenthesis : 'keep';
    var parens = calculateNecessaryParentheses(this, parenthesis);

    //format string as start:step:stop
    var str;

    var start = this.start.toString(options);
    if (parens.start) {
      start = '(' + start + ')';
    }
    str = start;

    if (this.step) {
      var step = this.step.toString(options);
      if (parens.step) {
        step = '(' + step + ')';
      }
      str += ':' + step;
    }

    var end = this.end.toString(options);
    if (parens.end) {
      end = '(' + end + ')';
    }
    str += ':' + end;

    return str;
  };

  /**
   * Get HTML representation
   * @param {Object} options
   * @return {string} str
   */
  RangeNode.prototype.toHTML = function (options) {
    var parenthesis = (options && options.parenthesis) ? options.parenthesis : 'keep';
    var parens = calculateNecessaryParentheses(this, parenthesis);

    //format string as start:step:stop
    var str;

    var start = this.start.toHTML(options);
    if (parens.start) {
      start = '<span class="math-parenthesis math-round-parenthesis">(</span>' + start + '<span class="math-parenthesis math-round-parenthesis">)</span>';
    }
    str = start;

    if (this.step) {
      var step = this.step.toHTML(options);
      if (parens.step) {
        step = '<span class="math-parenthesis math-round-parenthesis">(</span>' + step + '<span class="math-parenthesis math-round-parenthesis">)</span>';
      }
      str += '<span class="math-operator math-range-operator">:</span>' + step;
    }

    var end = this.end.toHTML(options);
    if (parens.end) {
      end = '<span class="math-parenthesis math-round-parenthesis">(</span>' + end + '<span class="math-parenthesis math-round-parenthesis">)</span>';
    }
    str += '<span class="math-operator math-range-operator">:</span>' + end;

    return str;
  };

  /**
   * Get LaTeX representation
   * @params {Object} options
   * @return {string} str
   */
  RangeNode.prototype._toTex = function (options) {
    var parenthesis = (options && options.parenthesis) ? options.parenthesis : 'keep';
    var parens = calculateNecessaryParentheses(this, parenthesis);

    var str = this.start.toTex(options);
    if (parens.start) {
      str = '\\left(' + str + '\\right)';
    }

    if (this.step) {
      var step = this.step.toTex(options);
      if (parens.step) {
        step = '\\left(' + step + '\\right)';
      }
      str += ':' + step;
    }

    var end = this.end.toTex(options);
    if (parens.end) {
      end = '\\left(' + end + '\\right)';
    }
    str += ':' + end;

    return str;
  };

  return RangeNode;
}

exports.name = 'RangeNode';
exports.path = 'expression.node';
exports.factory = factory;
