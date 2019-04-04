'use strict';

var isInteger = require('../../utils/number').isInteger;

function factory (type, config, load, typed) {
  var matrix = load(require('../../type/matrix/function/matrix'));

  /**
   * Calculate the extended greatest common divisor for two values.
   * See http://en.wikipedia.org/wiki/Extended_Euclidean_algorithm.
   *
   * Syntax:
   *
   *    math.xgcd(a, b)
   *
   * Examples:
   *
   *    math.xgcd(8, 12);             // returns [4, -1, 1]
   *    math.gcd(8, 12);              // returns 4
   *    math.xgcd(36163, 21199);      // returns [1247, -7, 12]
   *
   * See also:
   *
   *    gcd, lcm
   *
   * @param {number | BigNumber} a  An integer number
   * @param {number | BigNumber} b  An integer number
   * @return {Array}              Returns an array containing 3 integers `[div, m, n]`
   *                              where `div = gcd(a, b)` and `a*m + b*n = div`
   */
  var xgcd = typed('xgcd', {
    'number, number': _xgcd,
    'BigNumber, BigNumber': _xgcdBigNumber
    // TODO: implement support for Fraction
  });

  xgcd.toTex = undefined; // use default template

  return xgcd;

  /**
   * Calculate xgcd for two numbers
   * @param {number} a
   * @param {number} b
   * @return {number} result
   * @private
   */
  function _xgcd (a, b) {
    // source: http://en.wikipedia.org/wiki/Extended_Euclidean_algorithm
    var t, // used to swap two variables
        q, // quotient
        r, // remainder
        x = 0, lastx = 1,
        y = 1, lasty = 0;

    if (!isInteger(a) || !isInteger(b)) {
      throw new Error('Parameters in function xgcd must be integer numbers');
    }

    while (b) {
      q = Math.floor(a / b);
      r = a - q*b;

      t = x;
      x = lastx - q * x;
      lastx = t;

      t = y;
      y = lasty - q * y;
      lasty = t;

      a = b;
      b = r;
    }

    var res;
    if (a < 0) {
      res = [-a, -lastx, -lasty];
    }
    else {
      res = [a, a ? lastx : 0, lasty];
    }
    return (config.matrix === 'Array') ? res : matrix(res);
  }

  /**
   * Calculate xgcd for two BigNumbers
   * @param {BigNumber} a
   * @param {BigNumber} b
   * @return {BigNumber[]} result
   * @private
   */
  function _xgcdBigNumber(a, b) {
    // source: http://en.wikipedia.org/wiki/Extended_Euclidean_algorithm
    var t, // used to swap two variables
        q, // quotient
        r, // remainder
        zero = new type.BigNumber(0),
        one = new type.BigNumber(1),
        x = zero,
        lastx = one,
        y = one,
        lasty = zero;

    if (!a.isInt() || !b.isInt()) {
      throw new Error('Parameters in function xgcd must be integer numbers');
    }

    while (!b.isZero()) {
      q = a.div(b).floor();
      r = a.mod(b);

      t = x;
      x = lastx.minus(q.times(x));
      lastx = t;

      t = y;
      y = lasty.minus(q.times(y));
      lasty = t;

      a = b;
      b = r;
    }

    var res;
    if (a.lt(zero)) {
      res = [a.neg(), lastx.neg(), lasty.neg()];
    }
    else {
      res = [a, !a.isZero() ? lastx : 0, lasty];
    }
    return (config.matrix === 'Array') ? res : matrix(res);
  }
}

exports.name = 'xgcd';
exports.factory = factory;
