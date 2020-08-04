'use strict';

var extend = require('../utils/object').extend;
var customs = require('../utils/customs');

function factory (type, config, load, typed, math) {
  var _parse = load(require('./parse'));

  /**
   * @constructor Parser
   * Parser contains methods to evaluate or parse expressions, and has a number
   * of convenience methods to get, set, and remove variables from memory. Parser
   * keeps a scope containing variables in memory, which is used for all
   * evaluations.
   *
   * Methods:
   *    var result = parser.eval(expr);    // evaluate an expression
   *    var value = parser.get(name);      // retrieve a variable from the parser
   *    var values = parser.getAll();      // retrieve all defined variables
   *    parser.set(name, value);           // set a variable in the parser
   *    parser.remove(name);               // clear a variable from the
   *                                       // parsers scope
   *    parser.clear();                    // clear the parsers scope
   *
   * Example usage:
   *    var parser = new Parser();
   *    // Note: there is a convenience method which can be used instead:
   *    // var parser = new math.parser();
   *
   *    // evaluate expressions
   *    parser.eval('sqrt(3^2 + 4^2)');         // 5
   *    parser.eval('sqrt(-4)');                // 2i
   *    parser.eval('2 inch in cm');            // 5.08 cm
   *    parser.eval('cos(45 deg)');             // 0.7071067811865476
   *
   *    // define variables and functions
   *    parser.eval('x = 7 / 2');               // 3.5
   *    parser.eval('x + 3');                   // 6.5
   *    parser.eval('function f(x, y) = x^y');  // f(x, y)
   *    parser.eval('f(2, 3)');                 // 8
   *
   *    // get and set variables and functions
   *    var x = parser.get('x');                // 7
   *    var f = parser.get('f');                // function
   *    var g = f(3, 2);                        // 9
   *    parser.set('h', 500);
   *    var i = parser.eval('h / 2');           // 250
   *    parser.set('hello', function (name) {
   *        return 'hello, ' + name + '!';
   *    });
   *    parser.eval('hello("user")');           // "hello, user!"
   *
   *    // clear defined functions and variables
   *    parser.clear();
   *
   */
  function Parser() {
    if (!(this instanceof Parser)) {
      throw new SyntaxError(
          'Constructor must be called with the new operator');
    }
    this.scope = {};
  }

  /**
   * Attach type information
   */
  Parser.prototype.type = 'Parser';
  Parser.prototype.isParser = true;

  /**
   * Parse an expression and return the parsed function node.
   * The node tree can be compiled via `code = node.compile(math)`,
   * and the compiled code can be executed as `code.eval([scope])`
   * @param {string} expr
   * @return {Node} node
   * @throws {Error}
   */
  Parser.prototype.parse = function (expr) {
    throw new Error('Parser.parse is deprecated. Use math.parse instead.');
  };

  /**
   * Parse and compile an expression, return the compiled javascript code.
   * The node can be evaluated via code.eval([scope])
   * @param {string} expr
   * @return {{eval: function}} code
   * @throws {Error}
   */
  Parser.prototype.compile = function (expr) {
    throw new Error('Parser.compile is deprecated. Use math.compile instead.');
  };

  /**
   * Parse and evaluate the given expression
   * @param {string} expr   A string containing an expression, for example "2+3"
   * @return {*} result     The result, or undefined when the expression was empty
   * @throws {Error}
   */
  Parser.prototype.eval = function (expr) {
    // TODO: validate arguments
    return _parse(expr)
        .compile()
        .eval(this.scope);
  };

  /**
   * Get a variable (a function or variable) by name from the parsers scope.
   * Returns undefined when not found
   * @param {string} name
   * @return {* | undefined} value
   */
  Parser.prototype.get = function (name) {
    // TODO: validate arguments
    return name in this.scope
        ? customs.getSafeProperty(this.scope, name)
        : undefined;
  };

  /**
   * Get a map with all defined variables
   * @return {Object} values
   */
  Parser.prototype.getAll = function () {
    return extend({}, this.scope);
  };

  /**
   * Set a symbol (a function or variable) by name from the parsers scope.
   * @param {string} name
   * @param {* | undefined} value
   */
  Parser.prototype.set = function (name, value) {
    // TODO: validate arguments
    return customs.setSafeProperty(this.scope, name, value);
  };

  /**
   * Remove a variable from the parsers scope
   * @param {string} name
   */
  Parser.prototype.remove = function (name) {
    // TODO: validate arguments
    delete this.scope[name];
  };

  /**
   * Clear the scope with variables and functions
   */
  Parser.prototype.clear = function () {
    for (var name in this.scope) {
      if (this.scope.hasOwnProperty(name)) {
        delete this.scope[name];
      }
    }
  };

  return Parser;
}

exports.name = 'Parser';
exports.path = 'expression';
exports.factory = factory;
exports.math = true; // requires the math namespace as 5th argument
