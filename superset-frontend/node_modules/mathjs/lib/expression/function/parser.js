'use strict';

function factory (type, config, load, typed, math) {
  var Parser = load(require('../Parser'));

  /**
   * Create a parser. The function creates a new `math.expression.Parser` object.
   *
   * Syntax:
   *
   *    math.parser()
   *
   * Examples:
   *
   *     var parser = new math.parser();
   *
   *     // evaluate expressions
   *     var a = parser.eval('sqrt(3^2 + 4^2)'); // 5
   *     var b = parser.eval('sqrt(-4)');        // 2i
   *     var c = parser.eval('2 inch in cm');    // 5.08 cm
   *     var d = parser.eval('cos(45 deg)');     // 0.7071067811865476
   *
   *     // define variables and functions
   *     parser.eval('x = 7 / 2');               // 3.5
   *     parser.eval('x + 3');                   // 6.5
   *     parser.eval('function f(x, y) = x^y');  // f(x, y)
   *     parser.eval('f(2, 3)');                 // 8
   *
   *     // get and set variables and functions
   *     var x = parser.get('x');                // 7
   *     var f = parser.get('f');                // function
   *     var g = f(3, 2);                        // 9
   *     parser.set('h', 500);
   *     var i = parser.eval('h / 2');           // 250
   *     parser.set('hello', function (name) {
   *       return 'hello, ' + name + '!';
   *     });
   *     parser.eval('hello("user")');           // "hello, user!"
   *
   *     // clear defined functions and variables
   *     parser.clear();
   *
   * See also:
   *
   *    eval, compile, parse
   *
   * @return {Parser} Parser
   */
  return typed('parser', {
    '': function () {
      return new Parser(math);
    }
  });
}

exports.name = 'parser';
exports.factory = factory;
exports.math = true; // requires the math namespace as 5th argument
