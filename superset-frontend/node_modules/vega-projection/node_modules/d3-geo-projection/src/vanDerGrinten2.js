import {geoProjection as projection} from "d3-geo";
import {abs, asin, atan, atan2, cos, halfPi, epsilon, pi, sign, sin, sqrt, tan} from "./math.js";

export function vanDerGrinten2Raw(lambda, phi) {
  if (abs(phi) < epsilon) return [lambda, 0];
  var sinTheta = abs(phi / halfPi),
      theta = asin(sinTheta);
  if (abs(lambda) < epsilon || abs(abs(phi) - halfPi) < epsilon) return [0, sign(phi) * pi * tan(theta / 2)];
  var cosTheta = cos(theta),
      A = abs(pi / lambda - lambda / pi) / 2,
      A2 = A * A,
      x1 = cosTheta * (sqrt(1 + A2) - A * cosTheta) / (1 + A2 * sinTheta * sinTheta);
  return [
    sign(lambda) * pi * x1,
    sign(phi) * pi * sqrt(1 - x1 * (2 * A + x1))
  ];
}

vanDerGrinten2Raw.invert = function(x, y) {
  if (!x) return [0, halfPi * sin(2 * atan(y / pi))];
  var x1 = abs(x / pi),
      A = (1 - x1 * x1 - (y /= pi) * y) / (2 * x1),
      A2 = A * A,
      B = sqrt(A2 + 1);
  return [
    sign(x) * pi * (B - A),
    sign(y) * halfPi * sin(2 * atan2(sqrt((1 - 2 * A * x1) * (A + B) - x1), sqrt(B + A + x1)))
  ];
};

export default function() {
  return projection(vanDerGrinten2Raw)
      .scale(79.4183);
}
