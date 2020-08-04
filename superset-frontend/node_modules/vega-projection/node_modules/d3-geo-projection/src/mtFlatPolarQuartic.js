import {geoProjection as projection} from "d3-geo";
import {abs, asin, cos, epsilon, sin, sqrt, sqrt1_2, sqrt2} from "./math.js";

export function mtFlatPolarQuarticRaw(lambda, phi) {
  var k = (1 + sqrt1_2) * sin(phi),
      theta = phi;
  for (var i = 0, delta; i < 25; i++) {
    theta -= delta = (sin(theta / 2) + sin(theta) - k) / (0.5 * cos(theta / 2) + cos(theta));
    if (abs(delta) < epsilon) break;
  }
  return [
    lambda * (1 + 2 * cos(theta) / cos(theta / 2)) / (3 * sqrt2),
    2 * sqrt(3) * sin(theta / 2) / sqrt(2 + sqrt2)
  ];
}

mtFlatPolarQuarticRaw.invert = function(x, y) {
  var sinTheta_2 = y * sqrt(2 + sqrt2) / (2 * sqrt(3)),
      theta = 2 * asin(sinTheta_2);
  return [
    3 * sqrt2 * x / (1 + 2 * cos(theta) / cos(theta / 2)),
    asin((sinTheta_2 + sin(theta)) / (1 + sqrt1_2))
  ];
};

export default function() {
  return projection(mtFlatPolarQuarticRaw)
      .scale(188.209);
}
