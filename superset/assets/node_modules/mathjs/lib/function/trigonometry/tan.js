'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Calculate the tangent of a value. `tan(x)` is equal to `sin(x) / cos(x)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.tan(x)
   *
   * Examples:
   *
   *    math.tan(0.5);                    // returns number 0.5463024898437905
   *    math.sin(0.5) / math.cos(0.5);    // returns number 0.5463024898437905
   *    math.tan(math.pi / 4);            // returns number 1
   *    math.tan(math.unit(45, 'deg'));   // returns number 1
   *
   * See also:
   *
   *    atan, sin, cos
   *
   * @param {number | BigNumber | Complex | Unit | Array | Matrix} x  Function input
   * @return {number | BigNumber | Complex | Array | Matrix} Tangent of x
   */
  var tan = typed('tan', {
    'number': Math.tan,

    'Complex': function (x) {
        return x.tan();
    },

    'BigNumber': function (x) {
      return x.tan();
    },

    'Unit': function (x) {
      if (!x.hasBase(type.Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function tan is no angle');
      }
      return tan(x.value);
    },

    'Array | Matrix': function (x) {
      // deep map collection, skip zeros since tan(0) = 0
      return deepMap(x, tan, true);
    }
  });

  tan.toTex = {1: '\\tan\\left(${args[0]}\\right)'};

  return tan;
}

exports.name = 'tan';
exports.factory = factory;
