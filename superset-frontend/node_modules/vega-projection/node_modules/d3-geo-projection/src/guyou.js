import {geoProjection as projection} from "d3-geo";
import {ellipticF, ellipticFi, ellipticJi} from "./elliptic.js";
import {abs, atan, atan2, cos, exp, halfPi, log, pi, sin, sqrt, sqrt2, tan} from "./math.js";
import squareRaw from "./square.js";

export function guyouRaw(lambda, phi) {
  var k_ = (sqrt2 - 1) / (sqrt2 + 1),
      k = sqrt(1 - k_ * k_),
      K = ellipticF(halfPi, k * k),
      f = -1,
      psi = log(tan(pi / 4 + abs(phi) / 2)),
      r = exp(f * psi) / sqrt(k_),
      at = guyouComplexAtan(r * cos(f * lambda), r * sin(f * lambda)),
      t = ellipticFi(at[0], at[1], k * k);
  return [-t[1], (phi >= 0 ? 1 : -1) * (0.5 * K - t[0])];
}

function guyouComplexAtan(x, y) {
  var x2 = x * x,
      y_1 = y + 1,
      t = 1 - x2 - y * y;
  return [
   0.5 * ((x >= 0 ? halfPi : -halfPi) - atan2(t, 2 * x)),
    -0.25 * log(t * t + 4 * x2) +0.5 * log(y_1 * y_1 + x2)
  ];
}

function guyouComplexDivide(a, b) {
  var denominator = b[0] * b[0] + b[1] * b[1];
  return [
    (a[0] * b[0] + a[1] * b[1]) / denominator,
    (a[1] * b[0] - a[0] * b[1]) / denominator
  ];
}

guyouRaw.invert = function(x, y) {
  var k_ = (sqrt2 - 1) / (sqrt2 + 1),
      k = sqrt(1 - k_ * k_),
      K = ellipticF(halfPi, k * k),
      f = -1,
      j = ellipticJi(0.5 * K - y, -x, k * k),
      tn = guyouComplexDivide(j[0], j[1]),
      lambda = atan2(tn[1], tn[0]) / f;
  return [
    lambda,
    2 * atan(exp(0.5 / f * log(k_ * tn[0] * tn[0] + k_ * tn[1] * tn[1]))) - halfPi
  ];
};

export default function() {
  return projection(squareRaw(guyouRaw))
      .scale(151.496);
}
