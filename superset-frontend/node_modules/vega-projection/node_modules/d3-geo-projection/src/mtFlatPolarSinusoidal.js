import {geoProjection as projection} from "d3-geo";
import {abs, asin, cos, epsilon, halfPi, pi, sin, sqrt} from "./math.js";

export function mtFlatPolarSinusoidalRaw(lambda, phi) {
  var A = sqrt(6 / (4 + pi)),
      k = (1 + pi / 4) * sin(phi),
      theta = phi / 2;
  for (var i = 0, delta; i < 25; i++) {
    theta -= delta = (theta / 2 + sin(theta) - k) / (0.5 + cos(theta));
    if (abs(delta) < epsilon) break;
  }
  return [
    A * (0.5 + cos(theta)) * lambda / 1.5,
    A * theta
  ];
}

mtFlatPolarSinusoidalRaw.invert = function(x, y) {
  var A = sqrt(6 / (4 + pi)),
      theta = y / A;
  if (abs(abs(theta) - halfPi) < epsilon) theta = theta < 0 ? -halfPi : halfPi;
  return [
    1.5 * x / (A * (0.5 + cos(theta))),
    asin((theta / 2 + sin(theta)) / (1 + pi / 4))
  ];
};

export default function() {
  return projection(mtFlatPolarSinusoidalRaw)
      .scale(166.518);
}
