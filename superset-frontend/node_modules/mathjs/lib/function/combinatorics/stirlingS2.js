'use strict';

function factory (type, config, load, typed) {
  var add = load(require('../arithmetic/add'));
  var subtract = load(require('../arithmetic/subtract'));
  var multiply = load(require('../arithmetic/multiply'));
  var divide = load(require('../arithmetic/divide'));
  var pow = load(require('../arithmetic/pow'));
  var factorial = load(require('../probability/factorial'));
  var combinations = load(require('../probability/combinations'));
  var isNegative = load(require('../utils/isNegative'));
  var isInteger = load(require('../utils/isInteger'));
  var larger = load(require('../relational/larger'));

  /**
   * The Stirling numbers of the second kind, counts the number of ways to partition
   * a set of n labelled objects into k nonempty unlabelled subsets.
   * stirlingS2 only takes integer arguments.
   * The following condition must be enforced: k <= n.
   *
   *  If n = k or k = 1, then s(n,k) = 1
   *
   * Syntax:
   *
   *   math.stirlingS2(n, k)
   *
   * Examples:
   *
   *    math.stirlingS2(5, 3); //returns 25
   *
   * See also:
   *
   *    Bell numbers
   *
   * @param {Number | BigNumber} n    Total number of objects in the set
   * @param {Number | BigNumber} k    Number of objects in the subset
   * @return {Number | BigNumber}     S(n,k)
   */
  var stirlingS2 = typed('stirlingS2', {
    'number | BigNumber, number | BigNumber': function (n, k) {
      if (!isInteger(n) || isNegative(n) || !isInteger(k) || isNegative(k)) {
        throw new TypeError('Non-negative integer value expected in function stirlingS2');
      }
      else if (larger(k, n)) {
        throw new TypeError('k must be less than or equal to n in function stirlingS2');
      }

      // 1/k! Sum(i=0 -> k) [(-1)^(k-i)*C(k,j)* i^n]
      var kFactorial = factorial(k);
      var result = 0;
      for(var i = 0; i <= k; i++) {
        var negativeOne = pow(-1, subtract(k,i));
        var kChooseI = combinations(k,i);
        var iPower = pow(i,n);

        result = add(result, multiply(multiply(kChooseI, iPower), negativeOne));
      }

      return divide(result, kFactorial);
    }
  });

  stirlingS2.toTex = {2: '\\mathrm{S}\\left(${args}\\right)'};

  return stirlingS2;
}

exports.name = 'stirlingS2';
exports.factory = factory;
