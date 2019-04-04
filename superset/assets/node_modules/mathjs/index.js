var core = require('./core');

/**
 * math.js factory function. Creates a new instance of math.js
 *
 * @param {Object} [config] Available configuration options:
 *                            {number} epsilon
 *                              Minimum relative difference between two
 *                              compared values, used by all comparison functions.
 *                            {string} matrix
 *                              A string 'matrix' (default) or 'array'.
 *                            {string} number
 *                              A string 'number' (default), 'bignumber', or
 *                              'fraction'
 *                            {number} precision
 *                              The number of significant digits for BigNumbers.
 *                              Not applicable for Numbers.
 *                            {boolean} predictable
 *                              Predictable output type of functions. When true,
 *                              output type depends only on the input types. When
 *                              false (default), output type can vary depending
 *                              on input values. For example `math.sqrt(-4)`
 *                              returns `complex('2i')` when predictable is false, and
 *                              returns `NaN` when true.
 */
function create (config) {
  // create a new math.js instance
  var math = core.create(config);
  math.create = create;

  // import data types, functions, constants, expression parser, etc.
  math['import'](require('./lib'));

  return math;
}

// return a new instance of math.js
module.exports = create();
