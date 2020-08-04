
/**
 * Bitwise left shift
 *
 * Special Cases:
 *  n << -n = N
 *  n <<  N = N
 *  N <<  n = N
 *  n <<  0 = n
 *  0 <<  n = 0
 *  I <<  I = N
 *  I <<  n = I
 *  n <<  I = I
 *
 * @param {BigNumber} x
 * @param {BigNumber} y
 * @return {BigNumber} Result of `x` << `y`
 *
 */
module.exports = function leftShift (x, y) {
  if ((x.isFinite() && !x.isInteger()) || (y.isFinite() && !y.isInteger())) {
    throw new Error('Integers expected in function leftShift');
  }

  var BigNumber = x.constructor;
  if (x.isNaN() || y.isNaN() || (y.isNegative() && !y.isZero())) {
    return new BigNumber(NaN);
  }
  if (x.isZero() || y.isZero()) {
    return x;
  }
  if (!x.isFinite() && !y.isFinite()) {
    return new BigNumber(NaN);
  }

  // Math.pow(2, y) is fully precise for y < 55, and fast
  if (y.lt(55)) {
    return x.times(Math.pow(2, y.toNumber()) + '');
  }
  return x.times(new BigNumber(2).pow(y));
};
