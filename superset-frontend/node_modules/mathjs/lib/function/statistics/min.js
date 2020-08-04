'use strict';

var deepForEach = require('../../utils/collection/deepForEach');
var reduce = require('../../utils/collection/reduce');
var containsCollections = require('../../utils/collection/containsCollections');

function factory (type, config, load, typed) {
  var smaller = load(require('../relational/smaller'));
  
  /**
   * Compute the maximum value of a matrix or a  list of values.
   * In case of a multi dimensional array, the maximum of the flattened array
   * will be calculated. When `dim` is provided, the maximum over the selected
   * dimension will be calculated. Parameter `dim` is zero-based.
   *
   * Syntax:
   *
   *     math.min(a, b, c, ...)
   *     math.min(A)
   *     math.min(A, dim)
   *
   * Examples:
   *
   *     math.min(2, 1, 4, 3);                  // returns 1
   *     math.min([2, 1, 4, 3]);                // returns 1
   *
   *     // maximum over a specified dimension (zero-based)
   *     math.min([[2, 5], [4, 3], [1, 7]], 0); // returns [1, 3]
   *     math.min([[2, 5], [4, 3], [1, 7]], 1); // returns [2, 3, 1]
   *
   *     math.max(2.7, 7.1, -4.5, 2.0, 4.1);    // returns 7.1
   *     math.min(2.7, 7.1, -4.5, 2.0, 4.1);    // returns -4.5
   *
   * See also:
   *
   *    mean, median, max, prod, std, sum, var
   *
   * @param {... *} args  A single matrix or or multiple scalar values
   * @return {*} The minimum value
   */
  var min = typed('min', {
    // min([a, b, c, d, ...])
    'Array | Matrix': _min,

    // min([a, b, c, d, ...], dim)
    'Array | Matrix, number | BigNumber': function (array, dim) {
      return reduce(array, dim.valueOf(), _smallest);
    },

    // min(a, b, c, d, ...)
    '...': function (args) {
      if (containsCollections(args)) {
        throw new TypeError('Scalar values expected in function min');
      }

      return _min(args);
    }
  });

  min.toTex = '\\min\\left(${args}\\right)';

  return min;

  /**
   * Return the smallest of two values
   * @param {*} x
   * @param {*} y
   * @returns {*} Returns x when x is smallest, or y when y is smallest
   * @private
   */
  function _smallest(x, y) {
    return smaller(x, y) ? x : y;
  }

  /**
   * Recursively calculate the minimum value in an n-dimensional array
   * @param {Array} array
   * @return {number} min
   * @private
   */
  function _min(array) {
    var min = undefined;

    deepForEach(array, function (value) {
      if (min === undefined || smaller(value, min)) {
        min = value;
      }
    });

    if (min === undefined) {
      throw new Error('Cannot calculate min of an empty array');
    }

    return min;
  }
}

exports.name = 'min';
exports.factory = factory;
