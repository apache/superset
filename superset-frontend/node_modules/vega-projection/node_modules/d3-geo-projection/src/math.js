export var abs = Math.abs;
export var atan = Math.atan;
export var atan2 = Math.atan2;
export var ceil = Math.ceil;
export var cos = Math.cos;
export var exp = Math.exp;
export var floor = Math.floor;
export var log = Math.log;
export var max = Math.max;
export var min = Math.min;
export var pow = Math.pow;
export var round = Math.round;
export var sign = Math.sign || function(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; };
export var sin = Math.sin;
export var tan = Math.tan;

export var epsilon = 1e-6;
export var epsilon2 = 1e-12;
export var pi = Math.PI;
export var halfPi = pi / 2;
export var quarterPi = pi / 4;
export var sqrt1_2 = Math.SQRT1_2;
export var sqrt2 = sqrt(2);
export var sqrtPi = sqrt(pi);
export var tau = pi * 2;
export var degrees = 180 / pi;
export var radians = pi / 180;

export function sinci(x) {
  return x ? x / Math.sin(x) : 1;
}

export function asin(x) {
  return x > 1 ? halfPi : x < -1 ? -halfPi : Math.asin(x);
}

export function acos(x) {
  return x > 1 ? 0 : x < -1 ? pi : Math.acos(x);
}

export function sqrt(x) {
  return x > 0 ? Math.sqrt(x) : 0;
}

export function tanh(x) {
  x = exp(2 * x);
  return (x - 1) / (x + 1);
}

export function sinh(x) {
  return (exp(x) - exp(-x)) / 2;
}

export function cosh(x) {
  return (exp(x) + exp(-x)) / 2;
}

export function arsinh(x) {
  return log(x + sqrt(x * x + 1));
}

export function arcosh(x) {
  return log(x + sqrt(x * x - 1));
}
