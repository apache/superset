import {geoProjection as projection} from "d3-geo";
import {abs, asin, cos, epsilon, halfPi, pi, sin, sqrt} from "./math.js";

export function eckert4Raw(lambda, phi) {
  var k = (2 + halfPi) * sin(phi);
  phi /= 2;
  for (var i = 0, delta = Infinity; i < 10 && abs(delta) > epsilon; i++) {
    var cosPhi = cos(phi);
    phi -= delta = (phi + sin(phi) * (cosPhi + 2) - k) / (2 * cosPhi * (1 + cosPhi));
  }
  return [
    2 / sqrt(pi * (4 + pi)) * lambda * (1 + cos(phi)),
    2 * sqrt(pi / (4 + pi)) * sin(phi)
  ];
}

eckert4Raw.invert = function(x, y) {
  var A = y * sqrt((4 + pi) / pi) / 2,
      k = asin(A),
      c = cos(k);
  return [
    x / (2 / sqrt(pi * (4 + pi)) * (1 + c)),
    asin((k + A * (c + 2)) / (2 + halfPi))
  ];
};

export default function() {
  return projection(eckert4Raw)
      .scale(180.739);
}
