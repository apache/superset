'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Calculate the hyperbolic sine of a value,
   * defined as `sinh(x) = 1/2 * (exp(x) - exp(-x))`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.sinh(x)
   *
   * Examples:
   *
   *    math.sinh(0.5);       // returns number 0.5210953054937474
   *
   * See also:
   *
   *    cosh, tanh
   *
   * @param {number | BigNumber | Complex | Unit | Array | Matrix} x  Function input
   * @return {number | BigNumber | Complex | Array | Matrix} Hyperbolic sine of x
   */
  var sinh = typed('sinh', {
    'number': _sinh,

    'Complex': function (x) {
      return x.sinh();
    },

    'BigNumber': function (x) {
      return x.sinh();
    },

    'Unit': function (x) {
      if (!x.hasBase(type.Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function sinh is no angle');
      }
      return sinh(x.value);
    },

    'Array | Matrix': function (x) {
      // deep map collection, skip zeros since sinh(0) = 0
      return deepMap(x, sinh, true);
    }
  });

  sinh.toTex = {1: '\\sinh\\left(${args[0]}\\right)'};

  return sinh;
}

/**
 * Calculate the hyperbolic sine of a number
 * @param {number} x
 * @returns {number}
 * @private
 */
var _sinh = Math.sinh || function (x) {
  return (Math.exp(x) - Math.exp(-x)) / 2;
};

exports.name = 'sinh';
exports.factory = factory;
