import {geoProjection as projection} from "d3-geo";
import {abs, acos, cos, epsilon, halfPi, sin, pi, sqrt, sqrt2} from "./math.js";

var pi_sqrt2 = pi / sqrt2;

export function larriveeRaw(lambda, phi) {
  return [
    lambda * (1 + sqrt(cos(phi))) / 2,
    phi / (cos(phi / 2) * cos(lambda / 6))
  ];
}

larriveeRaw.invert = function(x, y) {
  var x0 = abs(x),
      y0 = abs(y),
      lambda = epsilon,
      phi = halfPi;
  if (y0 < pi_sqrt2) phi *= y0 / pi_sqrt2;
  else lambda += 6 * acos(pi_sqrt2 / y0);
  for (var i = 0; i < 25; i++) {
    var sinPhi = sin(phi),
        sqrtcosPhi = sqrt(cos(phi)),
        sinPhi_2 = sin(phi / 2),
        cosPhi_2 = cos(phi / 2),
        sinLambda_6 = sin(lambda / 6),
        cosLambda_6 = cos(lambda / 6),
        f0 = 0.5 * lambda * (1 + sqrtcosPhi) - x0,
        f1 = phi / (cosPhi_2 * cosLambda_6) - y0,
        df0dPhi = sqrtcosPhi ? -0.25 * lambda * sinPhi / sqrtcosPhi : 0,
        df0dLambda = 0.5 * (1 + sqrtcosPhi),
        df1dPhi = (1 + 0.5 * phi * sinPhi_2 / cosPhi_2) / (cosPhi_2 * cosLambda_6),
        df1dLambda = (phi / cosPhi_2) * (sinLambda_6 / 6) / (cosLambda_6 * cosLambda_6),
        denom = df0dPhi * df1dLambda - df1dPhi * df0dLambda,
        dPhi = (f0 * df1dLambda - f1 * df0dLambda) / denom,
        dLambda = (f1 * df0dPhi - f0 * df1dPhi) / denom;
    phi -= dPhi;
    lambda -= dLambda;
    if (abs(dPhi) < epsilon && abs(dLambda) < epsilon) break;
  }
  return [x < 0 ? -lambda : lambda, y < 0 ? -phi : phi];
};

export default function() {
  return projection(larriveeRaw)
      .scale(97.2672);
}
