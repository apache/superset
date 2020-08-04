/**
 * The expression parser of math.js has support for letting functions
 * parse and evaluate arguments themselves, instead of calling them with
 * evaluated arguments.
 *
 * By adding a property `raw` with value true to a function, the function
 * will be invoked with unevaluated arguments, allowing the function
 * to process the arguments in a customized way.
 */
var math = require('../../index');

/**
 * Calculate the numeric integration of a function
 * @param {Function} f
 * @param {number} start
 * @param {number} end
 * @param {number} [step=0.01]
 */
function integrate(f, start, end, step) {
  var total = 0;
  step = step || 0.01;
  for (var x = start; x < end; x += step) {
    total += f(x + step / 2) * step;
  }
  return total;
}

/**
 * A transformation for the integrate function. This transformation will be
 * invoked when the function is used via the expression parser of math.js.
 *
 * Syntax:
 *
 *     integrate(integrand, variable, start, end)
 *     integrate(integrand, variable, start, end, step)
 *
 * Usage:
 *
 *     math.eval('integrate(2*x, x, 0, 2)')
 *     math.eval('integrate(2*x, x, 0, 2, 0.01)')
 *
 * @param {Array.<math.expression.node.Node>} args
 *            Expects the following arguments: [f, x, start, end, step]
 * @param {Object} math
 * @param {Object} [scope]
 */
integrate.transform = function (args, math, scope) {
  // determine the variable name
  if (args[1] instanceof math.expression.node.SymbolNode) {
    var variable = args[1].name;
  }
  else {
    throw new Error('Second argument must be a symbol');
  }

  // evaluate start, end, and step
  var start = args[2].compile().eval(scope);
  var end   = args[3].compile().eval(scope);
  var step  = args[4] && args[4].compile().eval(scope); // step is optional

  // create a new scope, linked to the provided scope. We use this new scope
  // to apply the variable.
  var fnScope = Object.create(scope);

  // construct a function which evaluates the first parameter f after applying
  // a value for parameter x.
  var fnCode = args[0].compile();
  var f = function (x) {
    fnScope[variable] = x;
    return fnCode.eval(fnScope);
  };

  // execute the integration
  return integrate(f, start, end, step);
};

// mark the transform function with a "rawArgs" property, so it will be called
// with uncompiled, unevaluated arguments.
integrate.transform.rawArgs = true;

// import the function into math.js. Raw functions must be imported in the
// math namespace, they can't be used via `eval(scope)`.
math.import({
  integrate: integrate
});

// use the function in JavaScript
function f(x) {
  return math.pow(x, 0.5);
}
console.log(math.integrate(f, 0, 1));                       // outputs 0.6667254718034714

// use the function via the expression parser
console.log(math.eval('integrate(x^0.5, x, 0, 1)'));        // outputs 0.6667254718034714

// use the function via the expression parser (2)
var scope = {};
math.eval('f(x) = 2 * x', scope);
console.log(math.eval('integrate(f(x), x, 0, 2)', scope));  // outputs 4.000000000000003
