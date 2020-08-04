var bitNot = require('./bitNot');

/**
 * Applies bitwise function to numbers
 * @param {BigNumber} x
 * @param {BigNumber} y
 * @param {function (a, b)} func
 * @return {BigNumber}
 */
module.exports = function bitwise(x, y, func) {
  var BigNumber = x.constructor;

  var xBits, yBits;
  var xSign = +(x.s < 0);
  var ySign = +(y.s < 0);
  if (xSign) {
    xBits = decCoefficientToBinaryString(bitNot(x));
    for (var i = 0; i < xBits.length; ++i) {
      xBits[i] ^= 1;
    }
  } else {
    xBits = decCoefficientToBinaryString(x);
  }
  if (ySign) {
    yBits = decCoefficientToBinaryString(bitNot(y));
    for (var i = 0; i < yBits.length; ++i) {
      yBits[i] ^= 1;
    }
  } else {
    yBits = decCoefficientToBinaryString(y);
  }

  var minBits, maxBits, minSign;
  if (xBits.length <= yBits.length) {
    minBits = xBits;
    maxBits = yBits;
    minSign = xSign;
  } else {
    minBits = yBits;
    maxBits = xBits;
    minSign = ySign;
  }

  var shortLen = minBits.length;
  var longLen = maxBits.length;
  var expFuncVal = func(xSign, ySign) ^ 1;
  var outVal = new BigNumber(expFuncVal ^ 1);
  var twoPower = new BigNumber(1);
  var two = new BigNumber(2);

  var prevPrec = BigNumber.precision;
  BigNumber.config({precision: 1E9});

  while (shortLen > 0) {
    if (func(minBits[--shortLen], maxBits[--longLen]) == expFuncVal) {
      outVal = outVal.plus(twoPower);
    }
    twoPower = twoPower.times(two);
  }
  while (longLen > 0) {
    if (func(minSign, maxBits[--longLen]) == expFuncVal) {
      outVal = outVal.plus(twoPower);
    }
    twoPower = twoPower.times(two);
  }

  BigNumber.config({precision: prevPrec});

  if (expFuncVal == 0) {
    outVal.s = -outVal.s;
  }
  return outVal;
};

/* Extracted from decimal.js, and edited to specialize. */
function decCoefficientToBinaryString (x) {
  // Convert to string
  var a = x.d; // array with digits
  var r = a[0] + '';

  for (var i = 1; i < a.length; ++i) {
    var s = a[i] + '';
    for (var z = 7 - s.length; z--; ) {
      s = '0' + s;
    }

    r += s;
  }

  var j;
  for (j = r.length - 1; r.charAt(j) == '0'; --j);

  var xe = x.e;
  var str = r.slice(0, j + 1 || 1);
  var strL = str.length;
  if (xe > 0) {
    if (++xe > strL) {
      // Append zeros.
      for (xe -= strL; xe--; str += '0');
    } else if (xe < strL) {
      str = str.slice(0, xe) + '.' + str.slice(xe);
    }
  }

  // Convert from base 10 (decimal) to base 2
  var arr = [0];
  for (var i = 0; i < str.length; ) {
    for (var arrL = arr.length; arrL--; arr[arrL] *= 10);

    arr[0] += str.charAt(i++) << 0;  // convert to int
    for (var j = 0; j < arr.length; ++j) {
      if (arr[j] > 1) {
        if (arr[j + 1] == null) {
          arr[j + 1] = 0;
        }

        arr[j + 1] += arr[j] >> 1;
        arr[j] &= 1;
      }
    }
  }

  return arr.reverse();
}
