/*
 * A gamma function implementation based on Lanczos Approximation
 * https://en.wikipedia.org/wiki/Lanczos_approximation
 */

var Complex = require('../complex');

var P = [Complex(0.99999999999980993),
  Complex(676.5203681218851), Complex(-1259.1392167224028), Complex(771.32342877765313),
  Complex(-176.61502916214059), Complex(12.507343278686905), Complex(-0.13857109526572012),
  Complex(9.9843695780195716e-6), Complex(1.5056327351493116e-7)];

var SQRT2PI = Complex(Math.sqrt(2 * Math.PI));

function gamma(z) {

  z = z.sub(1);

  var x = P[0];
  var t = z.add(7.5);
  for (var i = 1; i < P.length; i++) {
    x = x.add(P[i].div(z.add(i)));
  }
  return SQRT2PI.mul(t.pow(z.add(0.5))).mul(t.neg().exp()).mul(x);
}

var fac = 1;
for (var i = 1; i <= 10; i++) {
  console.log(fac, gamma(Complex(i)));
  fac *= i;
}
