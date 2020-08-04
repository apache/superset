'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Calculate the secant of a value, defined as `sec(x) = 1/cos(x)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.sec(x)
   *
   * Examples:
   *
   *    math.sec(2);      // returns number -2.4029979617223822
   *    1 / math.cos(2);  // returns number -2.4029979617223822
   *
   * See also:
   *
   *    cos, csc, cot
   *
   * @param {number | Complex | Unit | Array | Matrix} x  Function input
   * @return {number | Complex | Array | Matrix} Secant of x
   */
  var sec = typed('sec', {
    'number': function (x) {
      return 1 / Math.cos(x);
    },

    'Complex': function (x) {
      return x.sec();
    },

    'BigNumber': function (x) {
      return new type.BigNumber(1).div(x.cos());
    },

    'Unit': function (x) {
      if (!x.hasBase(type.Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function sec is no angle');
      }
      return sec(x.value);
    },

    'Array | Matrix': function (x) {
      return deepMap(x, sec);
    }
  });

  sec.toTex = {1: '\\sec\\left(${args[0]}\\right)'};

  return sec;
}

exports.name = 'sec';
exports.factory = factory;
