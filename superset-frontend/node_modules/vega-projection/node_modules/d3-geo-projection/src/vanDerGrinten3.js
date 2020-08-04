import {geoProjection as projection} from "d3-geo";
import {abs, asin, atan, cos, epsilon, halfPi, pi, sign, sin, sqrt, tan} from "./math.js";

export function vanDerGrinten3Raw(lambda, phi) {
  if (abs(phi) < epsilon) return [lambda, 0];
  var sinTheta = phi / halfPi,
      theta = asin(sinTheta);
  if (abs(lambda) < epsilon || abs(abs(phi) - halfPi) < epsilon) return [0, pi * tan(theta / 2)];
  var A = (pi / lambda - lambda / pi) / 2,
      y1 = sinTheta / (1 + cos(theta));
  return [
    pi * (sign(lambda) * sqrt(A * A + 1 - y1 * y1) - A),
    pi * y1
  ];
}

vanDerGrinten3Raw.invert = function(x, y) {
  if (!y) return [x, 0];
  var y1 = y / pi,
      A = (pi * pi * (1 - y1 * y1) - x * x) / (2 * pi * x);
  return [
    x ? pi * (sign(x) * sqrt(A * A + 1) - A) : 0,
    halfPi * sin(2 * atan(y1))
  ];
};

export default function() {
  return projection(vanDerGrinten3Raw)
        .scale(79.4183);
}
