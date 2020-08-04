'use strict';

/**
 * Compares two BigNumbers.
 * @param {BigNumber} x       First value to compare
 * @param {BigNumber} y       Second value to compare
 * @param {number} [epsilon]  The maximum relative difference between x and y
 *                            If epsilon is undefined or null, the function will
 *                            test whether x and y are exactly equal.
 * @return {boolean} whether the two numbers are nearly equal
 */
module.exports = function nearlyEqual(x, y, epsilon) {
  // if epsilon is null or undefined, test whether x and y are exactly equal
  if (epsilon == null) {
    return x.eq(y);
  }


  // use "==" operator, handles infinities
  if (x.eq(y)) {
    return true;
  }

  // NaN
  if (x.isNaN() || y.isNaN()) {
    return false;
  }

  // at this point x and y should be finite
  if(x.isFinite() && y.isFinite()) {
    // check numbers are very close, needed when comparing numbers near zero
    var diff = x.minus(y).abs();
    if (diff.isZero()) {
      return true;
    }
    else {
      // use relative error
      var max = x.constructor.max(x.abs(), y.abs());
      return diff.lte(max.times(epsilon));
    }
  }

  // Infinite and Number or negative Infinite and positive Infinite cases
  return false;
};
