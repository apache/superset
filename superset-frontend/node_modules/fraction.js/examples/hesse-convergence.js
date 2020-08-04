/**
 * @license Fraction.js v2.4.1 01/06/2015
 * http://www.xarg.org/2014/03/rational-numbers-in-javascript/
 *
 * Copyright (c) 2015, Robert Eisele (robert@xarg.org)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 **/

var Fraction = require('../fraction.min.js');

/*
We have the polynom f(x) = 1/3x_1^2 + x_2^2 + x_1 * x_2 + 3

The gradient of f(x):

grad(x) = | x_1^2+x_2 |
          | 2x_2+x_1  |

And thus the Hesse-Matrix H:
| 2x_1  1 |
|  1    2 |

The inverse Hesse-Matrix H^-1 is
| -2 / (1-4x_1)    1 / (1 - 4x_1)     |
| 1 / (1 - 4x_1)   -2x_1 / (1 - 4x_1) |

We now want to find lim ->oo x[n], with the starting element of (3 2)^T

*/

// Get the Hesse Matrix
function H(x) {

  var z = new Fraction(1).sub(new Fraction(4).mul(x[0]));

  return [
  new Fraction(-2).div(z),
  new Fraction(1).div(z),
  new Fraction(1).div(z),
  new Fraction(-2).mul(x[0]).div(z),
  ];
}

// Get the gradient of f(x)
function grad(x) {

  return [
  new Fraction(x[0]).mul(x[0]).add(x[1]),
  new Fraction(2).mul(x[1]).add(x[0])
  ];
}

// A simple matrix multiplication helper
function matrMult(m, v) {

  return [
  new Fraction(m[0]).mul(v[0]).add(new Fraction(m[1]).mul(v[1])),
  new Fraction(m[2]).mul(v[0]).add(new Fraction(m[3]).mul(v[1]))
  ];
}

// A simple vector subtraction helper
function vecSub(a, b) {

  return [
  new Fraction(a[0]).sub(b[0]),
  new Fraction(a[1]).sub(b[1])
  ];
}

// Main function, gets a vector and the actual index
function run(V, j) {

  var t = H(V);
  //console.log("H(X)");
  for (var i in t) {

    //	console.log(t[i].toFraction());
  }

  var s = grad(V);
  //console.log("vf(X)");
  for (var i in s) {

    //	console.log(s[i].toFraction());
  }

  //console.log("multiplikation");
  var r = matrMult(t, s);
  for (var i in r) {

    //	console.log(r[i].toFraction());
  }

  var R = (vecSub(V, r));

  console.log("X"+j);
  console.log(R[0].toFraction(), "= "+R[0].valueOf());
  console.log(R[1].toFraction(), "= "+R[1].valueOf());
  console.log("\n");

  return R;
}


// Set the starting vector
var v = [3, 2];

for (var i = 0; i < 15; i++) {

  v = run(v, i);
}
