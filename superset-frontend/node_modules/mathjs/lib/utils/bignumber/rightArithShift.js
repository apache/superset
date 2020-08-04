/*
 * Special Cases:
 *   n >> -n =  N
 *   n >>  N =  N
 *   N >>  n =  N
 *   I >>  I =  N
 *   n >>  0 =  n
 *   I >>  n =  I
 *  -I >>  n = -I
 *  -I >>  I = -I
 *   n >>  I =  I
 *  -n >>  I = -1
 *   0 >>  n =  0
 *
 * @param {BigNumber} value
 * @param {BigNumber} value
 * @return {BigNumber} Result of `x` >> `y`
 *
 */
module.exports = function rightArithShift (x, y) {
  if ((x.isFinite() && !x.isInteger()) || (y.isFinite() && !y.isInteger())) {
    throw new Error('Integers expected in function rightArithShift');
  }

  var BigNumber = x.constructor;
  if (x.isNaN() || y.isNaN() || (y.isNegative() && !y.isZero())) {
    return new BigNumber(NaN);
  }
  if (x.isZero() || y.isZero()) {
    return x;
  }
  if (!y.isFinite()) {
    if (x.isNegative()) {
      return new BigNumber(-1);
    }
    if (!x.isFinite()) {
      return new BigNumber(NaN);
    }
    return new BigNumber(0);
  }

  // Math.pow(2, y) is fully precise for y < 55, and fast
  if (y.lt(55)) {
    return x.div(Math.pow(2, y.toNumber()) + '').floor();
  }
  return x.div(new BigNumber(2).pow(y)).floor();
};
