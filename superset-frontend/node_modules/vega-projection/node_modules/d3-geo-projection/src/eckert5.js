import {geoProjection as projection} from "d3-geo";
import {cos, pi, sqrt} from "./math.js";

export function eckert5Raw(lambda, phi) {
  return [
    lambda * (1 + cos(phi)) / sqrt(2 + pi),
    2 * phi / sqrt(2 + pi)
  ];
}

eckert5Raw.invert = function(x, y) {
  var k = sqrt(2 + pi),
      phi = y * k / 2;
  return [
    k * x / (1 + cos(phi)),
    phi
  ];
};

export default function() {
  return projection(eckert5Raw)
      .scale(173.044);
}
