'use strict';

function factory (type, config, load, typed) {

  var matrix = load(require('../../type/matrix/function/matrix'));
  var pow = load(require('./pow'));
  var latex = require('../../utils/latex');

  var algorithm03 = load(require('../../type/matrix/utils/algorithm03'));
  var algorithm07 = load(require('../../type/matrix/utils/algorithm07'));
  var algorithm11 = load(require('../../type/matrix/utils/algorithm11'));
  var algorithm12 = load(require('../../type/matrix/utils/algorithm12'));
  var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
  var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

  /**
   * Calculates the power of x to y element wise.
   *
   * Syntax:
   *
   *    math.dotPow(x, y)
   *
   * Examples:
   *
   *    math.dotPow(2, 3);            // returns number 8
   *
   *    var a = [[1, 2], [4, 3]];
   *    math.dotPow(a, 2);            // returns Array [[1, 4], [16, 9]]
   *    math.pow(a, 2);               // returns Array [[9, 8], [16, 17]]
   *
   * See also:
   *
   *    pow, sqrt, multiply
   *
   * @param  {number | BigNumber | Complex | Unit | Array | Matrix} x  The base
   * @param  {number | BigNumber | Complex | Unit | Array | Matrix} y  The exponent
   * @return {number | BigNumber | Complex | Unit | Array | Matrix}                     The value of `x` to the power `y`
   */
  var dotPow = typed('dotPow', {
    
    'any, any': pow,
    
    'Matrix, Matrix': function (x, y) {
      // result
      var c;

      // process matrix storage
      switch (x.storage()) {
        case 'sparse':
          switch (y.storage()) {
            case 'sparse':
              // sparse .^ sparse
              c = algorithm07(x, y, pow, false);
              break;
            default:
              // sparse .^ dense
              c = algorithm03(y, x, pow, true);
              break;
          }
          break;
        default:
          switch (y.storage()) {
            case 'sparse':
              // dense .^ sparse
              c = algorithm03(x, y, pow, false);
              break;
            default:
              // dense .^ dense
              c = algorithm13(x, y, pow);
              break;
          }
          break;
      }
      return c;
    },

    'Array, Array': function (x, y) {
      // use matrix implementation
      return dotPow(matrix(x), matrix(y)).valueOf();
    },

    'Array, Matrix': function (x, y) {
      // use matrix implementation
      return dotPow(matrix(x), y);
    },

    'Matrix, Array': function (x, y) {
      // use matrix implementation
      return dotPow(x, matrix(y));
    },

    'Matrix, any': function (x, y) {
      // result
      var c;
      // check storage format
      switch (x.storage()) {
        case 'sparse':
          c = algorithm11(x, y, dotPow, false);
          break;
        default:
          c = algorithm14(x, y, dotPow, false);
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
          c = algorithm12(y, x, dotPow, true);
          break;
        default:
          c = algorithm14(y, x, dotPow, true);
          break;
      }
      return c;
    },

    'Array, any': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(x), y, dotPow, false).valueOf();
    },

    'any, Array': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(y), x, dotPow, true).valueOf();
    }
  });

  dotPow.toTex = {
    2: '\\left(${args[0]}' + latex.operators['dotPow'] + '${args[1]}\\right)'
  };
  
  return dotPow;
}

exports.name = 'dotPow';
exports.factory = factory;
