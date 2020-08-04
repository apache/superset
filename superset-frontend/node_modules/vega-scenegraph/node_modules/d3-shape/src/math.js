export var abs = Math.abs;
export var atan2 = Math.atan2;
export var cos = Math.cos;
export var max = Math.max;
export var min = Math.min;
export var sin = Math.sin;
export var sqrt = Math.sqrt;

export var epsilon = 1e-12;
export var pi = Math.PI;
export var halfPi = pi / 2;
export var tau = 2 * pi;

export function acos(x) {
  return x > 1 ? 0 : x < -1 ? pi : Math.acos(x);
}

export function asin(x) {
  return x >= 1 ? halfPi : x <= -1 ? -halfPi : Math.asin(x);
}
