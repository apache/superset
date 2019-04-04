'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  var parse = load(require('../parse'));

  /**
   * Evaluate an expression.
   *
   * Note the evaluating arbitrary expressions may involve security risks,
   * see [http://mathjs.org/docs/expressions/security.html](http://mathjs.org/docs/expressions/security.html) for more information.
   *
   * Syntax:
   *
   *     math.eval(expr)
   *     math.eval(expr, scope)
   *     math.eval([expr1, expr2, expr3, ...])
   *     math.eval([expr1, expr2, expr3, ...], scope)
   *
   * Example:
   *
   *     math.eval('(2+3)/4');                // 1.25
   *     math.eval('sqrt(3^2 + 4^2)');        // 5
   *     math.eval('sqrt(-4)');               // 2i
   *     math.eval(['a=3', 'b=4', 'a*b']);,   // [3, 4, 12]
   *
   *     var scope = {a:3, b:4};
   *     math.eval('a * b', scope);           // 12
   *
   * See also:
   *
   *    parse, compile
   *
   * @param {string | string[] | Matrix} expr   The expression to be evaluated
   * @param {Object} [scope]                    Scope to read/write variables
   * @return {*} The result of the expression
   * @throws {Error}
   */
  return typed('compile', {
    'string': function (expr) {
      var scope = {};
      return parse(expr).compile().eval(scope);
    },

    'string, Object': function (expr, scope) {
      return parse(expr).compile().eval(scope);
    },

    'Array | Matrix': function (expr) {
      var scope = {};
      return deepMap(expr, function (entry) {
        return parse(entry).compile().eval(scope);
      });
    },

    'Array | Matrix, Object': function (expr, scope) {
      return deepMap(expr, function (entry) {
        return parse(entry).compile().eval(scope);
      });
    }
  });
}

exports.name = 'eval';
exports.factory = factory;