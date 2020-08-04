'use strict';

function factory (type, config, load, typed) {
  var latex = require('../../utils/latex');

  var matrix = load(require('../../type/matrix/function/matrix'));
  var zeros = load(require('../matrix/zeros'));
  var not = load(require('./not'));
  var isZero = load(require('../utils/isZero'));

  var algorithm02 = load(require('../../type/matrix/utils/algorithm02'));
  var algorithm06 = load(require('../../type/matrix/utils/algorithm06'));
  var algorithm11 = load(require('../../type/matrix/utils/algorithm11'));
  var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
  var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

  /**
   * Logical `and`. Test whether two values are both defined with a nonzero/nonempty value.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.and(x, y)
   *
   * Examples:
   *
   *    math.and(2, 4);   // returns true
   *
   *    a = [2, 0, 0];
   *    b = [3, 7, 0];
   *    c = 0;
   *
   *    math.and(a, b);   // returns [true, false, false]
   *    math.and(a, c);   // returns [false, false, false]
   *
   * See also:
   *
   *    not, or, xor
   *
   * @param  {number | BigNumber | Complex | Unit | Array | Matrix} x First value to check
   * @param  {number | BigNumber | Complex | Unit | Array | Matrix} y Second value to check
   * @return {boolean | Array | Matrix}
   *            Returns true when both inputs are defined with a nonzero/nonempty value.
   */
  var and = typed('and', {

    'number, number': function (x, y) {
      return !!(x && y);
    },

    'Complex, Complex': function (x, y) {
      return (x.re !== 0 || x.im !== 0) && (y.re !== 0 || y.im !== 0);
    },

    'BigNumber, BigNumber': function (x, y) {
      return !x.isZero() && !y.isZero() && !x.isNaN() && !y.isNaN();
    },

    'Unit, Unit': function (x, y) {
      return and(x.value, y.value);
    },
    
    'Matrix, Matrix': function (x, y) {
      // result
      var c;

      // process matrix storage
      switch (x.storage()) {
        case 'sparse':
          switch (y.storage()) {
            case 'sparse':
              // sparse & sparse
              c = algorithm06(x, y, and, false);
              break;
            default:
              // sparse & dense
              c = algorithm02(y, x, and, true);
              break;
          }
          break;
        default:
          switch (y.storage()) {
            case 'sparse':
              // dense & sparse
              c = algorithm02(x, y, and, false);
              break;
            default:
              // dense & dense
              c = algorithm13(x, y, and);
              break;
          }
          break;
      }
      return c;
    },

    'Array, Array': function (x, y) {
      // use matrix implementation
      return and(matrix(x), matrix(y)).valueOf();
    },

    'Array, Matrix': function (x, y) {
      // use matrix implementation
      return and(matrix(x), y);
    },

    'Matrix, Array': function (x, y) {
      // use matrix implementation
      return and(x, matrix(y));
    },

    'Matrix, any': function (x, y) {
      // check scalar
      if (not(y)) {
        // return zero matrix
        return zeros(x.size(), x.storage());
      }
      // result
      var c;
      // check storage format
      switch (x.storage()) {
        case 'sparse':
          c = algorithm11(x, y, and, false);
          break;
        default:
          c = algorithm14(x, y, and, false);
          break;
      }
      return c;
    },

    'any, Matrix': function (x, y) {
      // check scalar
      if (not(x)) {
        // return zero matrix
        return zeros(x.size(), x.storage());
      }
      // result
      var c;
      // check storage format
      switch (y.storage()) {
        case 'sparse':
          c = algorithm11(y, x, and, true);
          break;
        default:
          c = algorithm14(y, x, and, true);
          break;
      }
      return c;
    },

    'Array, any': function (x, y) {
      // use matrix implementation
      return and(matrix(x), y).valueOf();
    },

    'any, Array': function (x, y) {
      // use matrix implementation
      return and(x, matrix(y)).valueOf();
    }
  });

  and.toTex = {
    2: '\\left(${args[0]}' + latex.operators['and'] + '${args[1]}\\right)'
  };

  return and;
}

exports.name = 'and';
exports.factory = factory;
