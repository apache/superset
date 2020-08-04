'use strict';

var isInteger = require('../../utils/number').isInteger;
var bigBitOr = require('../../utils/bignumber/bitOr');

function factory (type, config, load, typed) {
  var latex = require('../../utils/latex');

  var matrix = load(require('../../type/matrix/function/matrix'));

  var algorithm01 = load(require('../../type/matrix/utils/algorithm01'));
  var algorithm04 = load(require('../../type/matrix/utils/algorithm04'));
  var algorithm10 = load(require('../../type/matrix/utils/algorithm10'));
  var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
  var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));
  
  /**
   * Bitwise OR two values, `x | y`.
   * For matrices, the function is evaluated element wise.
   * For units, the function is evaluated on the lowest print base.
   *
   * Syntax:
   *
   *    math.bitOr(x, y)
   *
   * Examples:
   *
   *    math.bitOr(1, 2);               // returns number 3
   *
   *    math.bitOr([1, 2, 3], 4);       // returns Array [5, 6, 7]
   *
   * See also:
   *
   *    bitAnd, bitNot, bitXor, leftShift, rightArithShift, rightLogShift
   *
   * @param  {number | BigNumber | Array | Matrix} x First value to or
   * @param  {number | BigNumber | Array | Matrix} y Second value to or
   * @return {number | BigNumber | Array | Matrix} OR of `x` and `y`
   */
  var bitOr = typed('bitOr', {

    'number, number': function (x, y) {
      if (!isInteger(x) || !isInteger(y)) {
        throw new Error('Integers expected in function bitOr');
      }

      return x | y;
    },

    'BigNumber, BigNumber': bigBitOr,

    'Matrix, Matrix': function (x, y) {
      // result
      var c;

      // process matrix storage
      switch (x.storage()) {
        case 'sparse':
          switch (y.storage()) {
            case 'sparse':
              // sparse + sparse
              c = algorithm04(x, y, bitOr);
              break;
            default:
              // sparse + dense
              c = algorithm01(y, x, bitOr, true);
              break;
          }
          break;
        default:
          switch (y.storage()) {
            case 'sparse':
              // dense + sparse
              c = algorithm01(x, y, bitOr, false);
              break;
            default:
              c = algorithm13(x, y, bitOr);
              break;
          }
          break;
      }
      return c;
    },

    'Array, Array': function (x, y) {
      // use matrix implementation
      return bitOr(matrix(x), matrix(y)).valueOf();
    },

    'Array, Matrix': function (x, y) {
      // use matrix implementation
      return bitOr(matrix(x), y);
    },

    'Matrix, Array': function (x, y) {
      // use matrix implementation
      return bitOr(x, matrix(y));
    },

    'Matrix, any': function (x, y) {
      // result
      var c;
      // check storage format
      switch (x.storage()) {
        case 'sparse':
          c = algorithm10(x, y, bitOr, false);
          break;
        default:
          c = algorithm14(x, y, bitOr, false);
          break;
      }
      return c;
    },

    'any, Matrix': function (x, y) {
      // result
      var c;
      // check storage format
      switch (y.storage()) {
        case 'sparse':
          c = algorithm10(y, x, bitOr, true);
          break;
        default:
          c = algorithm14(y, x, bitOr, true);
          break;
      }
      return c;
    },

    'Array, any': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(x), y, bitOr, false).valueOf();
    },

    'any, Array': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(y), x, bitOr, true).valueOf();
    }
  });

  bitOr.toTex = {
    2: '\\left(${args[0]}' + latex.operators['bitOr'] + '${args[1]}\\right)'
  };

  return bitOr;
}

exports.name = 'bitOr';
exports.factory = factory;
