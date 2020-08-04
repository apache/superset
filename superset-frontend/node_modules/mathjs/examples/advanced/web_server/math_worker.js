var math = require('mathjs');
var workerpool = require('workerpool');

// disable the import function so the math.js instance cannot be changed
function noImport() {
  throw new Error('function import is disabled.');
}
math.import({'import': noImport}, {override: true});

/**
 * Evaluate an expression
 * @param {string} expr
 * @return {string} result
 */
function evaluate (expr) {
  var ans = math.eval(expr);
  return math.format(ans);
}

// create a worker and register public functions
workerpool.worker({
  evaluate: evaluate
});
