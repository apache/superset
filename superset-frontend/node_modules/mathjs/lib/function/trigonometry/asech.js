'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  var acosh = typed.find(load(require('./acosh')), ['Complex']);

  /**
   * Calculate the hyperbolic arcsecant of a value,
   * defined as `asech(x) = acosh(1/x) = ln(sqrt(1/x^2 - 1) + 1/x)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.asech(x)
   *
   * Examples:
   *
   *    math.asech(0.5);       // returns 1.3169578969248166
   *
   * See also:
   *
   *    acsch, acoth
   *
   * @param {number | Complex | Array | Matrix} x  Function input
   * @return {number | Complex | Array | Matrix} Hyperbolic arcsecant of x
   */
  var asech = typed('asech', {
    'number': function (x) {
      if ((x <= 1 && x >= -1) || config.predictable) {
        x = 1 / x;

        var ret = Math.sqrt(x*x - 1);
        if (x > 0 || config.predictable) {
          return Math.log(ret + x);
        }

        return new type.Complex(Math.log(ret - x), Math.PI);
      }

      return new type.Complex(x, 0).asech();
    },

    'Complex': function (x) {
      return x.asech()
    },

    'BigNumber': function (x) {
      return new type.BigNumber(1).div(x).acosh();
    },

    'Array | Matrix': function (x) {
      return deepMap(x, asech);
    }
  });

  asech.toTex = {1: '\\mathrm{sech}^{-1}\\left(${args[0]}\\right)'};

  return asech;
}

exports.name = 'asech';
exports.factory = factory;
