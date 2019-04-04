'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Calculate the exponent of a value.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.exp(x)
   *
   * Examples:
   *
   *    math.exp(2);                  // returns number 7.3890560989306495
   *    math.pow(math.e, 2);          // returns number 7.3890560989306495
   *    math.log(math.exp(2));        // returns number 2
   *
   *    math.exp([1, 2, 3]);
   *    // returns Array [
   *    //   2.718281828459045,
   *    //   7.3890560989306495,
   *    //   20.085536923187668
   *    // ]
   *
   * See also:
   *
   *    log, pow
   *
   * @param {number | BigNumber | Complex | Array | Matrix} x  A number or matrix to exponentiate
   * @return {number | BigNumber | Complex | Array | Matrix} Exponent of `x`
   */
  var exp = typed('exp', {
    'number': Math.exp,

    'Complex': function (x) {
      return x.exp();
    },

    'BigNumber': function (x) {
      return x.exp();
    },

    'Array | Matrix': function (x) {
      // TODO: exp(sparse) should return a dense matrix since exp(0)==1
      return deepMap(x, exp);
    }
  });

  exp.toTex = {1: '\\exp\\left(${args[0]}\\right)'};

  return exp;
}

exports.name = 'exp';
exports.factory = factory;
