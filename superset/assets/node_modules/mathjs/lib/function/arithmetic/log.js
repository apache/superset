'use strict';

var deepMap = require('../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  var divideScalar = load(require('./divideScalar'));

  /**
   * Calculate the logarithm of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.log(x)
   *    math.log(x, base)
   *
   * Examples:
   *
   *    math.log(3.5);                  // returns 1.252762968495368
   *    math.exp(math.log(2.4));        // returns 2.4
   *
   *    math.pow(10, 4);                // returns 10000
   *    math.log(10000, 10);            // returns 4
   *    math.log(10000) / math.log(10); // returns 4
   *
   *    math.log(1024, 2);              // returns 10
   *    math.pow(2, 10);                // returns 1024
   *
   * See also:
   *
   *    exp, log10
   *
   * @param {number | BigNumber | Complex | Array | Matrix} x
   *            Value for which to calculate the logarithm.
   * @param {number | BigNumber | Complex} [base=e]
   *            Optional base for the logarithm. If not provided, the natural
   *            logarithm of `x` is calculated.
   * @return {number | BigNumber | Complex | Array | Matrix}
   *            Returns the logarithm of `x`
   */
  var log = typed('log', {
    'number': function (x) {
      if (x >= 0 || config.predictable) {
        return Math.log(x);
      }
      else {
        // negative value -> complex value computation
        return new type.Complex(x, 0).log();
      }
    },

    'Complex': function (x) {
      return x.log();
    },

    'BigNumber': function (x) {
      if (!x.isNegative() || config.predictable) {
        return x.ln();
      }
      else {
        // downgrade to number, return Complex valued result
        return new type.Complex(x.toNumber(), 0).log();
      }
    },

    'Array | Matrix': function (x) {
      return deepMap(x, log);
    },

    'any, any': function (x, base) {
      // calculate logarithm for a specified base, log(x, base)
      return divideScalar(log(x), log(base));
    }
  });

  log.toTex = {
    1: '\\ln\\left(${args[0]}\\right)',
    2: '\\log_{${args[1]}}\\left(${args[0]}\\right)'
  };

  return log;
}

exports.name = 'log';
exports.factory = factory;
