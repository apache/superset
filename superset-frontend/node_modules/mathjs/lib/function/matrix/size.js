'use strict';

var array = require('../../utils/array');

function factory (type, config, load, typed) {
  var matrix = load(require('../../type/matrix/function/matrix'));

  /**
   * Calculate the size of a matrix or scalar.
   *
   * Syntax:
   *
   *     math.size(x)
   *
   * Examples:
   *
   *     math.size(2.3);                  // returns []
   *     math.size('hello world');        // returns [11]
   *
   *     var A = [[1, 2, 3], [4, 5, 6]];
   *     math.size(A);                    // returns [2, 3]
   *     math.size(math.range(1,6));      // returns [5]
   *
   * See also:
   *
   *     resize, squeeze, subset
   *
   * @param {boolean | number | Complex | Unit | string | Array | Matrix} x  A matrix
   * @return {Array | Matrix} A vector with size of `x`.
   */
  var size = typed('size', {
    'Matrix': function (x) {
      // TODO: return the same matrix type as the input
      return matrix(x.size());
    },

    'Array': array.size,

    'string': function (x) {
      return (config.matrix === 'Array') ? [x.length] : matrix([x.length]);
    },

    'number | Complex | BigNumber | Unit | boolean | null': function (x) {
      // scalar
      return (config.matrix === 'Array') ? [] : matrix([]);
    }
  });

  size.toTex = undefined; // use default template

  return size;
}

exports.name = 'size';
exports.factory = factory;
