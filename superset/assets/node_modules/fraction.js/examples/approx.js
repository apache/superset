/**
 * @license Fraction.js v2.7.0 01/06/2015
 * http://www.xarg.org/2014/03/rational-numbers-in-javascript/
 *
 * Copyright (c) 2015, Robert Eisele (robert@xarg.org)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 **/

// Another rational approximation, not using Farey Sequences but Binary Search using the mediant
function approximate(p, precision) {

  var num1 = Math.floor(p);
  var den1 = 1;

  var num2 = num1 + 1;
  var den2 = 1;

  if (p !== num1) {

    while (den1 <= precision && den2 <= precision) {

      var m = (num1 + num2) / (den1 + den2);

      if (p === m) {

        if (den1 + den2 <= precision) {
          den1 += den2;
          num1 += num2;
          den2 = precision + 1;
        } else if (den1 > den2) {
          den2 = precision + 1;
        } else {
          den1 = precision + 1;
        }
        break;

      } else if (p < m) {
        num2 += num1;
        den2 += den1;
      } else {
        num1 += num2;
        den1 += den2;
      }
    }
  }

  if (den1 > precision) {
    den1 = den2;
    num1 = num2;
  }
  return new Fraction(num1, den1);
}

