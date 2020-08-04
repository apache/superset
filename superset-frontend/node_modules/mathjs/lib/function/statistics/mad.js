'use strict';

var flatten = require('../../utils/array').flatten;

function factory (type, config, load, typed) {
  var abs      = load(require('../arithmetic/abs'));
  var map      = load(require('../matrix/map'));
  var median   = load(require('../statistics/median'));
  var subtract = load(require('../arithmetic/subtract'));

  /**
   * Compute the median absolute deviation of a matrix or a list with values.
   * The median absolute deviation is defined as the median of the absolute
   * deviations from the median.
   *
   * Syntax:
   *
   *     math.mad(a, b, c, ...)
   *     math.mad(A)
   *
   * Examples:
   *
   *     math.mad(10, 20, 30);             // returns 10
   *     math.mad([1, 2, 3]);              // returns 1
   *     math.mad([[1, 2, 3], [4, 5, 6]]); // returns 1.5
   *
   * See also:
   *
   *     median, mean, std, abs
   *
   * @param {Array | Matrix} array
   *                        A single matrix or multiple scalar values.
   * @return {*} The median absolute deviation.
   */
  var mad = typed('mad', {
    // mad([a, b, c, d, ...])
    'Array | Matrix': _mad,

    // mad(a, b, c, d, ...)
    '...': function (args) {
      return _mad(args);
    }
  });

  mad.toTex = undefined; // use default template

  return mad;

  function _mad(array) {
    array = flatten(array.valueOf());

    if (array.length === 0) {
      throw new Error('Cannot calculate median absolute deviation of an empty array');
    }

    var med = median(array);
    return median(map(array, function (value) {
      return abs(subtract(value, med));
    }));
  }
}

exports.name = 'mad';
exports.factory = factory;
