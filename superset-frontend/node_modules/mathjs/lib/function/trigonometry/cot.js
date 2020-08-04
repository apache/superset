'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Calculate the cotangent of a value. Defined as `cot(x) = 1 / tan(x)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.cot(x)
   *
   * Examples:
   *
   *    math.cot(2);      // returns number -0.45765755436028577
   *    1 / math.tan(2);  // returns number -0.45765755436028577
   *
   * See also:
   *
   *    tan, sec, csc
   *
   * @param {number | Complex | Unit | Array | Matrix} x  Function input
   * @return {number | Complex | Array | Matrix} Cotangent of x
   */
  var cot = typed('cot', {
    'number': function (x) {
      return 1 / Math.tan(x);
    },

    'Complex': function (x) {
      return x.cot();
    },

    'BigNumber': function (x) {
      return new type.BigNumber(1).div(x.tan());
    },

    'Unit': function (x) {
      if (!x.hasBase(type.Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function cot is no angle');
      }
      return cot(x.value);
    },

    'Array | Matrix': function (x) {
      return deepMap(x, cot);
    }
  });

  cot.toTex = {1: '\\cot\\left(${args[0]}\\right)'};

  return cot;
}

exports.name = 'cot';
exports.factory = factory;
