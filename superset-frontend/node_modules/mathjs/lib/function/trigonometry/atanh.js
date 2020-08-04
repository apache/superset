'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Calculate the hyperbolic arctangent of a value,
   * defined as `atanh(x) = ln((1 + x)/(1 - x)) / 2`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.atanh(x)
   *
   * Examples:
   *
   *    math.atanh(0.5);       // returns 0.5493061443340549
   *
   * See also:
   *
   *    acosh, asinh
   *
   * @param {number | Complex | Array | Matrix} x  Function input
   * @return {number | Complex | Array | Matrix} Hyperbolic arctangent of x
   */
  var atanh = typed('atanh', {
    'number': function (x) {
      if ((x <= 1 && x >= -1) || config.predictable) {
        return _atanh(x);
      }
      return new type.Complex(x, 0).atanh();
    },

    'Complex': function (x) {
      return x.atanh();
    },

    'BigNumber': function (x) {
      return x.atanh();
    },

    'Array | Matrix': function (x) {
      // deep map collection, skip zeros since atanh(0) = 0
      return deepMap(x, atanh, true);
    }
  });

  atanh.toTex = {1: '\\tanh^{-1}\\left(${args[0]}\\right)'};

  return atanh;
}

/**
 * Calculate the hyperbolic arctangent of a number
 * @param {number} x
 * @return {number}
 * @private
 */
var _atanh = Math.atanh || function (x) {
  return Math.log((1 + x)/(1 - x)) / 2
};

exports.name = 'atanh';
exports.factory = factory;
