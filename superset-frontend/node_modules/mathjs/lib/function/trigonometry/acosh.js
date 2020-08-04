'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {

  /**
   * Calculate the hyperbolic arccos of a value,
   * defined as `acosh(x) = ln(sqrt(x^2 - 1) + x)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.acosh(x)
   *
   * Examples:
   *
   *    math.acosh(1.5);       // returns 0.9624236501192069
   *
   * See also:
   *
   *    cosh, asinh, atanh
   *
   * @param {number | Complex | Unit | Array | Matrix} x  Function input
   * @return {number | Complex | Array | Matrix} Hyperbolic arccosine of x
   */
  var acosh = typed('acosh', {
    'number': function (x) {
      if (x >= 1 || config.predictable) {
        return _acosh(x);
      }
      if (x <= -1) {
        return new type.Complex(Math.log(Math.sqrt(x*x - 1) - x), Math.PI);
      }
      return new type.Complex(x, 0).acosh();
    },

    'Complex': function (x) {
      return x.acosh();
    },

    'BigNumber': function (x) {
      return x.acosh();
    },

    'Array | Matrix': function (x) {
      return deepMap(x, acosh);
    }
  });

  acosh.toTex = {1: '\\cosh^{-1}\\left(${args[0]}\\right)'};

  return acosh;
}

/**
 * Calculate the hyperbolic arccos of a number
 * @param {number} x
 * @return {number}
 * @private
 */
var _acosh = Math.acosh || function (x) {
  return Math.log(Math.sqrt(x*x - 1) + x)
};

exports.name = 'acosh';
exports.factory = factory;
