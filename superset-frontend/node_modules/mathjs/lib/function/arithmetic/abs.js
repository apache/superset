'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Calculate the absolute value of a number. For matrices, the function is
   * evaluated element wise.
   *
   * Syntax:
   *
   *    math.abs(x)
   *
   * Examples:
   *
   *    math.abs(3.5);                // returns number 3.5
   *    math.abs(-4.2);               // returns number 4.2
   *
   *    math.abs([3, -5, -1, 0, 2]);  // returns Array [3, 5, 1, 0, 2]
   *
   * See also:
   *
   *    sign
   *
   * @param  {number | BigNumber | Fraction | Complex | Array | Matrix | Unit} x
   *            A number or matrix for which to get the absolute value
   * @return {number | BigNumber | Fraction | Complex | Array | Matrix | Unit}
   *            Absolute value of `x`
   */
  var abs = typed('abs', {
    'number': Math.abs,

    'Complex': function (x) {
      return x.abs();
    },

    'BigNumber': function (x) {
      return x.abs();
    },

    'Fraction': function (x) {
      return x.abs();
    },

    'Array | Matrix': function (x) {
      // deep map collection, skip zeros since abs(0) = 0
      return deepMap(x, abs, true);
    },

    'Unit': function(x) {
      return x.abs();
    }
  });

  abs.toTex = {1: '\\left|${args[0]}\\right|'};

  return abs;
}

exports.name = 'abs';
exports.factory = factory;
