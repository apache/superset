/**
 * @license Fraction.js v2.7.0 01/06/2015
 * http://www.xarg.org/2014/03/rational-numbers-in-javascript/
 *
 * Copyright (c) 2015, Robert Eisele (robert@xarg.org)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 **/

// Based on http://www.maths.surrey.ac.uk/hosted-sites/R.Knott/Fractions/egyptian.html
function egyptian(a, b) {

  var res = [];

  do {
    var t = Math.ceil(b / a);
    var x = new Fraction(a, b).sub(1, t);
    res.push(t);
    a = x.n;
    b = x.d;
  } while (a !== 0);
  return res;
}
console.log("1 / " + egyptian(521, 1050).join(" + 1 / "));
