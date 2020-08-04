import {geoProjectionMutator as projectionMutator} from "d3-geo";
import {abs, asin, atan2, cos, epsilon, halfPi, pow, sign, sin} from "./math.js";

export function lagrangeRaw(n) {

  function forward(lambda, phi) {
    if (abs(abs(phi) - halfPi) < epsilon) return [0, phi < 0 ? -2 : 2];
    var sinPhi = sin(phi),
        v = pow((1 + sinPhi) / (1 - sinPhi), n / 2),
        c = 0.5 * (v + 1 / v) + cos(lambda *= n);
    return [
      2 * sin(lambda) / c,
      (v - 1 / v) / c
    ];
  }

  forward.invert = function(x, y) {
    var y0 = abs(y);
    if (abs(y0 - 2) < epsilon) return x ? null : [0, sign(y) * halfPi];
    if (y0 > 2) return null;

    x /= 2, y /= 2;
    var x2 = x * x,
        y2 = y * y,
        t = 2 * y / (1 + x2 + y2); // tanh(nPhi)
    t = pow((1 + t) / (1 - t), 1 / n);
    return [
      atan2(2 * x, 1 - x2 - y2) / n,
      asin((t - 1) / (t + 1))
    ];
  };

  return forward;
}

export default function() {
  var n = 0.5,
      m = projectionMutator(lagrangeRaw),
      p = m(n);

  p.spacing = function(_) {
    return arguments.length ? m(n = +_) : n;
  };

  return p
      .scale(124.75);
}
