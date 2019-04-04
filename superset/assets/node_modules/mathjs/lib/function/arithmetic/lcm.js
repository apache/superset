'use strict';

var isInteger = require('../../utils/number').isInteger;

function factory (type, config, load, typed) {
  
  var matrix = load(require('../../type/matrix/function/matrix'));

  var algorithm02 = load(require('../../type/matrix/utils/algorithm02'));
  var algorithm06 = load(require('../../type/matrix/utils/algorithm06'));
  var algorithm11 = load(require('../../type/matrix/utils/algorithm11'));
  var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
  var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

  /**
   * Calculate the least common multiple for two or more values or arrays.
   *
   * lcm is defined as:
   *
   *     lcm(a, b) = abs(a * b) / gcd(a, b)
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.lcm(a, b)
   *    math.lcm(a, b, c, ...)
   *
   * Examples:
   *
   *    math.lcm(4, 6);               // returns 12
   *    math.lcm(6, 21);              // returns 42
   *    math.lcm(6, 21, 5);           // returns 210
   *
   *    math.lcm([4, 6], [6, 21]);    // returns [12, 42]
   *
   * See also:
   *
   *    gcd, xgcd
   *
   * @param {... number | BigNumber | Array | Matrix} args  Two or more integer numbers
   * @return {number | BigNumber | Array | Matrix}                           The least common multiple
   */
  var lcm = typed('lcm', {
    'number, number': _lcm,

    'BigNumber, BigNumber': _lcmBigNumber,

    'Fraction, Fraction': function (x, y) {

      return x.lcm(y);
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
              c = algorithm06(x, y, lcm);
              break;
            default:
              // sparse + dense
              c = algorithm02(y, x, lcm, true);
              break;
          }
          break;
        default:
          switch (y.storage()) {
            case 'sparse':
              // dense + sparse
              c = algorithm02(x, y, lcm, false);
              break;
            default:
              // dense + dense
              c = algorithm13(x, y, lcm);
              break;
          }
          break;
      }
      return c;
    },

    'Array, Array': function (x, y) {
      // use matrix implementation
      return lcm(matrix(x), matrix(y)).valueOf();
    },

    'Array, Matrix': function (x, y) {
      // use matrix implementation
      return lcm(matrix(x), y);
    },

    'Matrix, Array': function (x, y) {
      // use matrix implementation
      return lcm(x, matrix(y));
    },

    'Matrix, number | BigNumber': function (x, y) {
      // result
      var c;
      // check storage format
      switch (x.storage()) {
        case 'sparse':
          c = algorithm11(x, y, lcm, false);
          break;
        default:
          c = algorithm14(x, y, lcm, false);
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
          c = algorithm11(y, x, lcm, true);
          break;
        default:
          c = algorithm14(y, x, lcm, true);
          break;
      }
      return c;
    },

    'Array, number | BigNumber': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(x), y, lcm, false).valueOf();
    },

    'number | BigNumber, Array': function (x, y) {
      // use matrix implementation
      return algorithm14(matrix(y), x, lcm, true).valueOf();
    },

    // TODO: need a smarter notation here
    'Array | Matrix | number | BigNumber, Array | Matrix | number | BigNumber, ...Array | Matrix | number | BigNumber': function (a, b, args) {
      var res = lcm(a, b);
      for (var i = 0; i < args.length; i++) {
        res = lcm(res, args[i]);
      }
      return res;
    }
  });

  lcm.toTex = undefined;  // use default template

  return lcm;

  /**
   * Calculate lcm for two BigNumbers
   * @param {BigNumber} a
   * @param {BigNumber} b
   * @returns {BigNumber} Returns the least common multiple of a and b
   * @private
   */
  function _lcmBigNumber(a, b) {
    if (!a.isInt() || !b.isInt()) {
      throw new Error('Parameters in function lcm must be integer numbers');
    }

    if (a.isZero() || b.isZero()) {
      return new type.BigNumber(0);
    }

    // http://en.wikipedia.org/wiki/Euclidean_algorithm
    // evaluate lcm here inline to reduce overhead
    var prod = a.times(b);
    while (!b.isZero()) {
      var t = b;
      b = a.mod(t);
      a = t;
    }
    return prod.div(a).abs();
  }
}

/**
 * Calculate lcm for two numbers
 * @param {number} a
 * @param {number} b
 * @returns {number} Returns the least common multiple of a and b
 * @private
 */
function _lcm (a, b) {
  if (!isInteger(a) || !isInteger(b)) {
    throw new Error('Parameters in function lcm must be integer numbers');
  }

  if (a == 0 || b == 0) {
    return 0;
  }

  // http://en.wikipedia.org/wiki/Euclidean_algorithm
  // evaluate lcm here inline to reduce overhead
  var t;
  var prod = a * b;
  while (b != 0) {
    t = b;
    b = a % t;
    a = t;
  }
  return Math.abs(prod / a);
}

exports.name = 'lcm';
exports.factory = factory;
