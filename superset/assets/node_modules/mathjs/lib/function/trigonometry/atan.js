'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {

  /**
   * Calculate the inverse tangent of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.atan(x)
   *
   * Examples:
   *
   *    math.atan(0.5);           // returns number 0.4636476090008061
   *    math.atan(math.tan(1.5)); // returns number 1.5
   *
   *    math.atan(2);             // returns Complex 1.5707963267948966 -1.3169578969248166 i
   *
   * See also:
   *
   *    tan, asin, acos
   *
   * @param {number | BigNumber | Complex | Array | Matrix} x   Function input
   * @return {number | BigNumber | Complex | Array | Matrix} The arc tangent of x
   */
  var atan = typed('atan', {
    'number': function (x) {
      return Math.atan(x);
    },

    'Complex': function (x) {
      return x.atan();
    },

    'BigNumber': function (x) {
      return x.atan();
    },

    'Array | Matrix': function (x) {
      // deep map collection, skip zeros since atan(0) = 0
      return deepMap(x, atan, true);
    }
  });

  atan.toTex = {1: '\\tan^{-1}\\left(${args[0]}\\right)'};

  return atan;
}

exports.name = 'atan';
exports.factory = factory;
