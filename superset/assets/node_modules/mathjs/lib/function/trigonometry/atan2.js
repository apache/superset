'use strict';

function factory (type, config, load, typed) {

  var matrix = load(require('../../type/matrix/function/matrix'));

  var algorithm02 = load(require('../../type/matrix/utils/algorithm02'));
  var algorithm03 = load(require('../../type/matrix/utils/algorithm03'));
  var algorithm09 = load(require('../../type/matrix/utils/algorithm09'));
  var algorithm11 = load(require('../../type/matrix/utils/algorithm11'));
  var algorithm12 = load(require('../../type/matrix/utils/algorithm12'));
  var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
  var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

  /**
   * Calculate the inverse tangent function with two arguments, y/x.
   * By providing two arguments, the right quadrant of the computed angle can be
   * determined.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.atan2(y, x)
   *
   * Examples:
   *
   *    math.atan2(2, 2) / math.pi;       // returns number 0.25
   *
   *    var angle = math.unit(60, 'deg'); // returns Unit 60 deg
   *    var x = math.cos(angle);
   *    var y = math.sin(angle);
   *
   *    math.atan(2);             // returns Complex 1.5707963267948966 -1.3169578969248166 i
   *
   * See also:
   *
   *    tan, atan, sin, cos
   *
   * @param {number | Array | Matrix} y  Second dimension
   * @param {number | Array | Matrix} x  First dimension
   * @return {number | Array | Matrix} Four-quadrant inverse tangent
   */
  var atan2 = typed('atan2', {

    'number, number': Math.atan2,

    // Complex numbers doesn't seem to have a reasonable implementation of
    // atan2(). Even Matlab removed the support, after they only calculated
    // the atan only on base of the real part of the numbers and ignored the imaginary.

    'BigNumber, BigNumber': function (y, x) {
      return type.BigNumber.atan2(y, x);
    },

    'Matrix, Matrix': function (x, y) {
      // result
      var c;

      // process matrix storage
      switch (x.storage()) {
        case 'sparse':
          switch (y.storage()) {
            case 'sparse':
              // sparse .* sparse
              c = algorithm09(x, y, atan2, false);
              break;
            default:
              // sparse .* dense
              c = algorithm02(y, x, atan2, true);
              break;
          }
          break;
        default:
          switch (y.storage()) {
            case 'sparse':
              // dense .* sparse
              c = algorithm03(x, y, atan2, false);
              break;
            default:
              // dense .* dense
              c = algorithm13(x, y, atan2);
              break;
          }
          break;
      }
      return c;
    },

    'Array, Array': function (x, y) {
      // use matrix implementation
      return atan2(matrix(x), matrix(y)).valueOf();
    },

    'Array, Matrix': function (x, y) {
      // use matrix implementation
      return atan2(matrix(x), y);
    },

    'Matrix, Array': function (x, y) {
      // use matrix implementation
      return atan2(x, matrix(y));
    },

    'Matrix, number | BigNumber': function (x, y) {
      // result
      var c;
      // check storage format
      switch (x.storage()) {
        case 'sparse':
          c = algorithm11(x, y, atan2, false);
          break;
        default:
          c = algorithm14(x, y, atan2, false);
          break;
      }
      return c;
    },

    'number | BigNumber, Matrix': function (x, y) {
      // result
      var c;
      // check storage format
      switch (y.storage()) {
        case 'sparse':
          c = algorithm12(y, x, atan2, true);
          break;
        default:
          c = algorithm14(y, x, atan2, true);
          break;
      }
      return c;
    },

    'Array, number | BigNumber': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(x), y, atan2, false).valueOf();
    },

    'number | BigNumber, Array': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(y), x, atan2, true).valueOf();
    }
  });

  atan2.toTex = {2: '\\mathrm{atan2}\\left(${args}\\right)'};

  return atan2;
}

exports.name = 'atan2';
exports.factory = factory;
