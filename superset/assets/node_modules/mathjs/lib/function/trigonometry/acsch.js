'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {

  /**
   * Calculate the hyperbolic arccosecant of a value,
   * defined as `acsch(x) = asinh(1/x) = ln(1/x + sqrt(1/x^2 + 1))`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.acsch(x)
   *
   * Examples:
   *
   *    math.acsch(0.5);       // returns 1.4436354751788103
   *
   * See also:
   *
   *    asech, acoth
   *
   * @param {number | Complex | Array | Matrix} x  Function input
   * @return {number | Complex | Array | Matrix} Hyperbolic arccosecant of x
   */
  var acsch = typed('acsch', {
    'number': function (x) {
      x = 1 / x;
      return Math.log(x + Math.sqrt(x*x + 1));
    },

    'Complex': function (x) {
      return x.acsch();
    },

    'BigNumber': function (x) {
      return new type.BigNumber(1).div(x).asinh();
    },

    'Array | Matrix': function (x) {
      return deepMap(x, acsch);
    }
  });

  acsch.toTex = {1: '\\mathrm{csch}^{-1}\\left(${args[0]}\\right)'};

  return acsch;
}

exports.name = 'acsch';
exports.factory = factory;
