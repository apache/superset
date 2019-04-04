'use strict';

var deepForEach = require('../../utils/collection/deepForEach');
var reduce = require('../../utils/collection/reduce');
var containsCollections = require('../../utils/collection/containsCollections');

function factory (type, config, load, typed) {
  var larger = load(require('../relational/larger'));

  /**
   * Compute the maximum value of a matrix or a  list with values.
   * In case of a multi dimensional array, the maximum of the flattened array
   * will be calculated. When `dim` is provided, the maximum over the selected
   * dimension will be calculated. Parameter `dim` is zero-based.
   *
   * Syntax:
   *
   *     math.max(a, b, c, ...)
   *     math.max(A)
   *     math.max(A, dim)
   *
   * Examples:
   *
   *     math.max(2, 1, 4, 3);                  // returns 4
   *     math.max([2, 1, 4, 3]);                // returns 4
   *
   *     // maximum over a specified dimension (zero-based)
   *     math.max([[2, 5], [4, 3], [1, 7]], 0); // returns [4, 7]
   *     math.max([[2, 5], [4, 3]], [1, 7], 1); // returns [5, 4, 7]
   *
   *     math.max(2.7, 7.1, -4.5, 2.0, 4.1);    // returns 7.1
   *     math.min(2.7, 7.1, -4.5, 2.0, 4.1);    // returns -4.5
   *
   * See also:
   *
   *    mean, median, min, prod, std, sum, var
   *
   * @param {... *} args  A single matrix or or multiple scalar values
   * @return {*} The maximum value
   */
  var max = typed('max', {
    // max([a, b, c, d, ...])
    'Array | Matrix': _max,

    // max([a, b, c, d, ...], dim)
    'Array | Matrix, number | BigNumber': function (array, dim) {
      return reduce(array, dim.valueOf(), _largest);
    },

    // max(a, b, c, d, ...)
    '...': function (args) {
      if (containsCollections(args)) {
        throw new TypeError('Scalar values expected in function max');
      }

      return _max(args);
    }
  });

  max.toTex = '\\max\\left(${args}\\right)';

  return max;

  /**
   * Return the largest of two values
   * @param {*} x
   * @param {*} y
   * @returns {*} Returns x when x is largest, or y when y is largest
   * @private
   */
  function _largest(x, y){
    return larger(x, y) ? x : y;
  }

  /**
   * Recursively calculate the maximum value in an n-dimensional array
   * @param {Array} array
   * @return {number} max
   * @private
   */
  function _max(array) {
    var max = undefined;

    deepForEach(array, function (value) {
      if (max === undefined || larger(value, max)) {
        max = value;
      }
    });

    if (max === undefined) {
      throw new Error('Cannot calculate max of an empty array');
    }

    return max;
  }
}

exports.name = 'max';
exports.factory = factory;
