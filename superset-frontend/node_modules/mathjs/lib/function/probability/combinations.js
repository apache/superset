'use strict';

var isInteger = require('../../utils/number').isInteger;

function factory (type, config, load, typed) {
  /**
   * Compute the number of ways of picking `k` unordered outcomes from `n`
   * possibilities.
   *
   * Combinations only takes integer arguments.
   * The following condition must be enforced: k <= n.
   *
   * Syntax:
   *
   *     math.combinations(n, k)
   *
   * Examples:
   *
   *    math.combinations(7, 5); // returns 21
   *
   * See also:
   *
   *    permutations, factorial
   *
   * @param {number | BigNumber} n    Total number of objects in the set
   * @param {number | BigNumber} k    Number of objects in the subset
   * @return {number | BigNumber}     Number of possible combinations.
   */
  var combinations = typed('combinations', {
    'number, number': function (n, k) {
      var max, result, i;

      if (!isInteger(n) || n < 0) {
        throw new TypeError('Positive integer value expected in function combinations');
      }
      if (!isInteger(k) || k < 0) {
        throw new TypeError('Positive integer value expected in function combinations');
      }
      if (k > n) {
        throw new TypeError('k must be less than or equal to n');
      }

      max = Math.max(k, n - k);
      result = 1;
      for (i = 1; i <= n - max; i++) {
        result = result * (max + i) / i;
      }

      return result;
    },

    'BigNumber, BigNumber': function (n, k) {
      var max, result, i, ii;
      var one = new type.BigNumber(1);

      if (!isPositiveInteger(n) || !isPositiveInteger(k)) {
        throw new TypeError('Positive integer value expected in function combinations');
      }
      if (k.gt(n)) {
        throw new TypeError('k must be less than n in function combinations');
      }

      max = n.minus(k);
      if (k.lt(max)) max = k;
      result = one;
      for (i = one, ii = n.minus(max); i.lte(ii); i = i.plus(1)) {
        result = result.times(max.plus(i)).dividedBy(i);
      }

      return result;
    }

    // TODO: implement support for collection in combinations
  });

  combinations.toTex = {2: '\\binom{${args[0]}}{${args[1]}}'};

  return combinations;
}

/**
 * Test whether BigNumber n is a positive integer
 * @param {BigNumber} n
 * @returns {boolean} isPositiveInteger
 */
function isPositiveInteger(n) {
  return n.isInteger() && n.gte(0);
}

exports.name = 'combinations';
exports.factory = factory;
