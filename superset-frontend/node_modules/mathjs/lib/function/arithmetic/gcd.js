'use strict';

var isInteger = require('../../utils/number').isInteger;

function factory (type, config, load, typed) {

  var matrix = load(require('../../type/matrix/function/matrix'));

  var algorithm01 = load(require('../../type/matrix/utils/algorithm01'));
  var algorithm04 = load(require('../../type/matrix/utils/algorithm04'));
  var algorithm10 = load(require('../../type/matrix/utils/algorithm10'));
  var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
  var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

  /**
   * Calculate the greatest common divisor for two or more values or arrays.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.gcd(a, b)
   *    math.gcd(a, b, c, ...)
   *
   * Examples:
   *
   *    math.gcd(8, 12);              // returns 4
   *    math.gcd(-4, 6);              // returns 2
   *    math.gcd(25, 15, -10);        // returns 5
   *
   *    math.gcd([8, -4], [12, 6]);   // returns [4, 2]
   *
   * See also:
   *
   *    lcm, xgcd
   *
   * @param {... number | BigNumber | Fraction | Array | Matrix} args  Two or more integer numbers
   * @return {number | BigNumber | Fraction | Array | Matrix}                           The greatest common divisor
   */
  var gcd = typed('gcd', {

    'number, number': _gcd,

    'BigNumber, BigNumber': _gcdBigNumber,

    'Fraction, Fraction': function (x, y) {
      return x.gcd(y);
    },

    'Matrix, Matrix': function (x, y) {
      // result
      var c;

      // process matrix storage
      switch (x.storage()) {
        case 'sparse':
          switch (y.storage()) {
            case 'sparse':
              // sparse + sparse
              c = algorithm04(x, y, gcd);
              break;
            default:
              // sparse + dense
              c = algorithm01(y, x, gcd, true);
              break;
          }
          break;
        default:
          switch (y.storage()) {
            case 'sparse':
              // dense + sparse
              c = algorithm01(x, y, gcd, false);
              break;
            default:
              // dense + dense
              c = algorithm13(x, y, gcd);
              break;
          }
          break;
      }
      return c;
    },

    'Array, Array': function (x, y) {
      // use matrix implementation
      return gcd(matrix(x), matrix(y)).valueOf();
    },

    'Array, Matrix': function (x, y) {
      // use matrix implementation
      return gcd(matrix(x), y);
    },

    'Matrix, Array': function (x, y) {
      // use matrix implementation
      return gcd(x, matrix(y));
    },
    
    'Matrix, number | BigNumber': function (x, y) {
      // result
      var c;
      // check storage format
      switch (x.storage()) {
        case 'sparse':
          c = algorithm10(x, y, gcd, false);
          break;
        default:
          c = algorithm14(x, y, gcd, false);
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
          c = algorithm10(y, x, gcd, true);
          break;
        default:
          c = algorithm14(y, x, gcd, true);
          break;
      }
      return c;
    },

    'Array, number | BigNumber': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(x), y, gcd, false).valueOf();
    },

    'number | BigNumber, Array': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(y), x, gcd, true).valueOf();
    },

    // TODO: need a smarter notation here
    'Array | Matrix | number | BigNumber, Array | Matrix | number | BigNumber, ...Array | Matrix | number | BigNumber': function (a, b, args) {
      var res = gcd(a, b);
      for (var i = 0; i < args.length; i++) {
        res = gcd(res, args[i]);
      }
      return res;
    }
  });

  gcd.toTex = '\\gcd\\left(${args}\\right)';

  return gcd;

  /**
   * Calculate gcd for BigNumbers
   * @param {BigNumber} a
   * @param {BigNumber} b
   * @returns {BigNumber} Returns greatest common denominator of a and b
   * @private
   */
  function _gcdBigNumber(a, b) {
    if (!a.isInt() || !b.isInt()) {
      throw new Error('Parameters in function gcd must be integer numbers');
    }

    // http://en.wikipedia.org/wiki/Euclidean_algorithm
    var zero = new type.BigNumber(0);
    while (!b.isZero()) {
      var r = a.mod(b);
      a = b;
      b = r;
    }
    return a.lt(zero) ? a.neg() : a;
  }
}

/**
 * Calculate gcd for numbers
 * @param {number} a
 * @param {number} b
 * @returns {number} Returns the greatest common denominator of a and b
 * @private
 */
function _gcd(a, b) {
  if (!isInteger(a) || !isInteger(b)) {
    throw new Error('Parameters in function gcd must be integer numbers');
  }

  // http://en.wikipedia.org/wiki/Euclidean_algorithm
  var r;
  while (b != 0) {
    r = a % b;
    a = b;
    b = r;
  }
  return (a < 0) ? -a : a;
}

exports.name = 'gcd';
exports.factory = factory;
