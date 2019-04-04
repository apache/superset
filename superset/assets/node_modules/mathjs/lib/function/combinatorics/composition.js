'use strict';

function factory (type, config, load, typed) {
  var combinations = load(require('../probability/combinations'));
  var add = load(require('../arithmetic/addScalar'));
  var isPositive = load(require('../utils/isPositive'));
  var isInteger = load(require('../utils/isInteger'));
  var larger = load(require('../relational/larger'));

  /**
   * The composition counts of n into k parts.
   *
   * composition only takes integer arguments.
   * The following condition must be enforced: k <= n.
   *
   * Syntax:
   *
   *   math.composition(n, k)
   *
   * Examples:
   *
   *    math.composition(5, 3); // returns 6
   *
   * See also:
   *
   *    combinations
   *
   * @param {Number | BigNumber} n    Total number of objects in the set
   * @param {Number | BigNumber} k    Number of objects in the subset
   * @return {Number | BigNumber}     Returns the composition counts of n into k parts.
   */
  var composition =  typed('composition', {
    'number | BigNumber, number | BigNumber': function (n, k) {
      if (!isInteger(n) || !isPositive(n) || !isInteger(k) || !isPositive(k)) {
        throw new TypeError('Positive integer value expected in function composition');
      }
      else if (larger(k, n)) {
        throw new TypeError('k must be less than or equal to n in function composition');
      }

      return combinations(add(n, -1), add(k, -1));
    }
  });

  composition.toTex = undefined; // use default template

  return composition;
}

exports.name = 'composition';
exports.factory = factory;
