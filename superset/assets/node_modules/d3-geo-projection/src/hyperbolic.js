import "math";

function tanh(x) {
  x = Math.exp(2 * x);
  return (x - 1) / (x + 1);
}

function sinh(x) {
  return .5 * (Math.exp(x) - Math.exp(-x));
}

function cosh(x) {
  return .5 * (Math.exp(x) + Math.exp(-x));
}

function arsinh(x) {
  return Math.log(x + asqrt(x * x + 1));
}

function arcosh(x) {
  return Math.log(x + asqrt(x * x - 1));
}
