'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {

  /**
   * Calculate the inverse cosine of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.acos(x)
   *
   * Examples:
   *
   *    math.acos(0.5);           // returns number 1.0471975511965979
   *    math.acos(math.cos(1.5)); // returns number 1.5
   *
   *    math.acos(2);             // returns Complex 0 + 1.3169578969248166 i
   *
   * See also:
   *
   *    cos, atan, asin
   *
   * @param {number | BigNumber | Complex | Array | Matrix} x  Function input
   * @return {number | BigNumber | Complex | Array | Matrix} The arc cosine of x
   */
  var acos = typed('acos', {
    'number': function (x) {
      if ((x >= -1 && x <= 1) || config.predictable) {
        return Math.acos(x);
      }
      else {
        return new type.Complex(x, 0).acos();
      }
    },

    'Complex': function (x) {
      return x.acos();
    },

    'BigNumber': function (x) {
      return x.acos();
    },

    'Array | Matrix': function (x) {
      return deepMap(x, acos);
    }
  });

  acos.toTex = {1: '\\cos^{-1}\\left(${args[0]}\\right)'};

  return acos;
}

exports.name = 'acos';
exports.factory = factory;
