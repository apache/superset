import {geoProjection as projection} from "d3-geo";
import {asin, atan2, cos, sin, sqrt} from "./math.js";

export function wiechelRaw(lambda, phi) {
  var cosPhi = cos(phi),
      sinPhi = cos(lambda) * cosPhi,
      sin1_Phi = 1 - sinPhi,
      cosLambda = cos(lambda = atan2(sin(lambda) * cosPhi, -sin(phi))),
      sinLambda = sin(lambda);
  cosPhi = sqrt(1 - sinPhi * sinPhi);
  return [
    sinLambda * cosPhi - cosLambda * sin1_Phi,
    -cosLambda * cosPhi - sinLambda * sin1_Phi
  ];
}

wiechelRaw.invert = function(x, y) {
  var w = (x * x + y * y) / -2,
      k = sqrt(-w * (2 + w)),
      b = y * w + x * k,
      a = x * w - y * k,
      D = sqrt(a * a + b * b);
  return [
    atan2(k * b, D * (1 + w)),
    D ? -asin(k * a / D) : 0
  ];
};

export default function() {
  return projection(wiechelRaw)
      .rotate([0, -90, 45])
      .scale(124.75)
      .clipAngle(180 - 1e-3);
}
