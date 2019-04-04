'use strict';

var latex = require('../../utils/latex');
var operators = require('../operators');

function factory (type, config, load, typed) {
  var register = load(require('./compile')).register;
  var compile = load(require('./compile')).compile;
  var Node = load(require('./Node'));

  /**
   * A lazy evaluating conditional operator: 'condition ? trueExpr : falseExpr'
   *
   * @param {Node} condition   Condition, must result in a boolean
   * @param {Node} trueExpr    Expression evaluated when condition is true
   * @param {Node} falseExpr   Expression evaluated when condition is true
   *
   * @constructor ConditionalNode
   * @extends {Node}
   */
  function ConditionalNode(condition, trueExpr, falseExpr) {
    if (!(this instanceof ConditionalNode)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }
    if (!type.isNode(condition)) throw new TypeError('Parameter condition must be a Node');
    if (!type.isNode(trueExpr))  throw new TypeError('Parameter trueExpr must be a Node');
    if (!type.isNode(falseExpr)) throw new TypeError('Parameter falseExpr must be a Node');

    this.condition = condition;
    this.trueExpr = trueExpr;
    this.falseExpr = falseExpr;
  }

  ConditionalNode.prototype = new Node();

  ConditionalNode.prototype.type = 'ConditionalNode';

  ConditionalNode.prototype.isConditionalNode = true;

  /**
   * Compile the node to javascript code
   * @param {ConditionalNode} node  The node to be compiled
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
  function compileConditionalNode(node, defs, args) {
    if (!(node instanceof ConditionalNode)) {
      throw new TypeError('No valid ConditionalNode')
    }

    /**
     * Test whether a condition is met
     * @param {*} condition
     * @returns {boolean} true if condition is true or non-zero, else false
     */
    defs.testCondition = function (condition) {
      if (typeof condition === 'number'
          || typeof condition === 'boolean'
          || typeof condition === 'string') {
        return condition ? true : false;
      }

      if (condition) {
        if (type.isBigNumber(condition)) {
          return condition.isZero() ? false : true;
        }

        if (type.isComplex(condition)) {
          return (condition.re || condition.im) ? true : false;
        }

        if (type.isUnit(condition)) {
          return condition.value ? true : false;
        }
      }

      if (condition === null || condition === undefined) {
        return false;
      }

      throw new TypeError('Unsupported type of condition "' + defs.math['typeof'](condition) + '"');
    };

    return (
      'testCondition(' + compile(node.condition, defs, args) + ') ? ' +
      '( ' + compile(node.trueExpr, defs, args) + ') : ' +
      '( ' + compile(node.falseExpr, defs, args) + ')'
    );
  }

  // register the compile function
  register(ConditionalNode.prototype.type, compileConditionalNode);

  /**
   * Execute a callback for each of the child nodes of this node
   * @param {function(child: Node, path: string, parent: Node)} callback
   */
  ConditionalNode.prototype.forEach = function (callback) {
    callback(this.condition, 'condition', this);
    callback(this.trueExpr, 'trueExpr', this);
    callback(this.falseExpr, 'falseExpr', this);
  };

  /**
   * Create a new ConditionalNode having it's childs be the results of calling
   * the provided callback function for each of the childs of the original node.
   * @param {function(child: Node, path: string, parent: Node): Node} callback
   * @returns {ConditionalNode} Returns a transformed copy of the node
   */
  ConditionalNode.prototype.map = function (callback) {
    return new ConditionalNode(
        this._ifNode(callback(this.condition, 'condition', this)),
        this._ifNode(callback(this.trueExpr, 'trueExpr', this)),
        this._ifNode(callback(this.falseExpr, 'falseExpr', this))
    );
  };

  /**
   * Create a clone of this node, a shallow copy
   * @return {ConditionalNode}
   */
  ConditionalNode.prototype.clone = function () {
    return new ConditionalNode(this.condition, this.trueExpr, this.falseExpr);
  };

  /**
   * Get string representation
   * @param {Object} options
   * @return {string} str
   */
  ConditionalNode.prototype._toString = function (options) {
    var parenthesis = (options && options.parenthesis) ? options.parenthesis : 'keep';
    var precedence = operators.getPrecedence(this, parenthesis);

    //Enclose Arguments in parentheses if they are an OperatorNode
    //or have lower or equal precedence
    //NOTE: enclosing all OperatorNodes in parentheses is a decision
    //purely based on aesthetics and readability
    var condition = this.condition.toString(options);
    var conditionPrecedence = operators.getPrecedence(this.condition, parenthesis);
    if ((parenthesis === 'all')
        || (this.condition.type === 'OperatorNode')
        || ((conditionPrecedence !== null) && (conditionPrecedence <= precedence))) {
      condition = '(' + condition + ')';
    }

    var trueExpr = this.trueExpr.toString(options);
    var truePrecedence = operators.getPrecedence(this.trueExpr, parenthesis);
    if ((parenthesis === 'all')
        || (this.trueExpr.type === 'OperatorNode')
        || ((truePrecedence !== null) && (truePrecedence <= precedence))) {
      trueExpr = '(' + trueExpr + ')';
    }

    var falseExpr = this.falseExpr.toString(options);
    var falsePrecedence = operators.getPrecedence(this.falseExpr, parenthesis);
    if ((parenthesis === 'all')
        || (this.falseExpr.type === 'OperatorNode')
        || ((falsePrecedence !== null) && (falsePrecedence <= precedence))) {
      falseExpr = '(' + falseExpr + ')';
    }
    return condition + ' ? ' + trueExpr + ' : ' + falseExpr;
  };

  /**
   * Get HTML representation
   * @param {Object} options
   * @return {string} str
   */
  ConditionalNode.prototype.toHTML = function (options) {
    var parenthesis = (options && options.parenthesis) ? options.parenthesis : 'keep';
    var precedence = operators.getPrecedence(this, parenthesis);

    //Enclose Arguments in parentheses if they are an OperatorNode
    //or have lower or equal precedence
    //NOTE: enclosing all OperatorNodes in parentheses is a decision
    //purely based on aesthetics and readability
    var condition = this.condition.toHTML(options);
    var conditionPrecedence = operators.getPrecedence(this.condition, parenthesis);
    if ((parenthesis === 'all')
        || (this.condition.type === 'OperatorNode')
        || ((conditionPrecedence !== null) && (conditionPrecedence <= precedence))) {
      condition = '<span class="math-parenthesis math-round-parenthesis">(</span>' + condition + '<span class="math-parenthesis math-round-parenthesis">)</span>';
    }

    var trueExpr = this.trueExpr.toHTML(options);
    var truePrecedence = operators.getPrecedence(this.trueExpr, parenthesis);
    if ((parenthesis === 'all')
        || (this.trueExpr.type === 'OperatorNode')
        || ((truePrecedence !== null) && (truePrecedence <= precedence))) {
      trueExpr = '<span class="math-parenthesis math-round-parenthesis">(</span>' + trueExpr + '<span class="math-parenthesis math-round-parenthesis">)</span>';
    }

    var falseExpr = this.falseExpr.toHTML(options);
    var falsePrecedence = operators.getPrecedence(this.falseExpr, parenthesis);
    if ((parenthesis === 'all')
        || (this.falseExpr.type === 'OperatorNode')
        || ((falsePrecedence !== null) && (falsePrecedence <= precedence))) {
      falseExpr = '<span class="math-parenthesis math-round-parenthesis">(</span>' + falseExpr + '<span class="math-parenthesis math-round-parenthesis">)</span>';
    }
    return condition + '<span class="math-operator math-conditional-operator">?</span>' + trueExpr + '<span class="math-operator math-conditional-operator">:</span>' + falseExpr;
  };

  /**
   * Get LaTeX representation
   * @param {Object} options
   * @return {string} str
   */
  ConditionalNode.prototype._toTex = function (options) {
    return '\\begin{cases} {'
        + this.trueExpr.toTex(options) + '}, &\\quad{\\text{if }\\;'
        + this.condition.toTex(options)
        + '}\\\\{' + this.falseExpr.toTex(options)
        + '}, &\\quad{\\text{otherwise}}\\end{cases}';
  };

  return ConditionalNode;
}

exports.name = 'ConditionalNode';
exports.path = 'expression.node';
exports.factory = factory;
