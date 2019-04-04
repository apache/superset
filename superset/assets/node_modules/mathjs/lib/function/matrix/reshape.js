'use strict';

var DimensionError = require('../../error/DimensionError');

var isInteger = require('../../utils/number').isInteger;
var array = require('../../utils/array');

function factory (type, config, load, typed) {
  var matrix = load(require('../../type/matrix/function/matrix'));

  /**
   * Reshape a multi dimensional array to fit the specified dimensions
   *
   * Syntax:
   *
   *     math.reshape(x, sizes)
   *
   * Examples:
   *
   *     math.reshape([1, 2, 3, 4, 5, 6], [2, 3]);
   *     // returns Array  [[1, 2, 3], [4, 5, 6]]
   *
   *     math.reshape([[1, 2], [3, 4]], [1, 4]);
   *     // returns Array  [[1, 2, 3, 4]]
   *
   *     math.reshape([[1, 2], [3, 4]], [4]);
   *     // returns Array [1, 2, 3, 4]
   *
   *     var x = math.matrix([1, 2, 3, 4, 5, 6, 7, 8]);
   *     math.reshape(x, [2, 2, 2]);
   *     // returns Matrix [[[1, 2], [3, 4]], [[5, 6], [7, 8]]]
   *
   * See also:
   *
   *     size, squeeze, resize
   *
   * @param {Array | Matrix | *} x  Matrix to be reshaped
   * @param {number[]} sizes        One dimensional array with integral sizes for
   *                                each dimension
   *
   * @return {* | Array | Matrix}   A reshaped clone of matrix `x`
   *
   * @throws {TypeError}            If `sizes` does not contain solely integers
   * @throws {DimensionError}       If the product of the new dimension sizes does
   *                                not equal that of the old ones
   */
  var reshape = typed('reshape', {

    'Matrix, Array': function (x, sizes) {
      if(x.reshape) {
        return x.reshape(sizes);
      } else {
        return matrix(array.reshape(x.valueOf(), sizes));
      }
    },

    'Array, Array': function (x, sizes) {
      sizes.forEach(function (size) {
        if (!isInteger(size)) {
          throw new TypeError('Invalid size for dimension: ' + size);
        }
      });
      return array.reshape(x, sizes);
    }

  });

  reshape.toTex = undefined; // use default template

  return reshape;
}

exports.name = 'reshape';
exports.factory = factory;
