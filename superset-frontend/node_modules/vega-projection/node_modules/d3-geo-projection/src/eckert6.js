import {geoProjection as projection} from "d3-geo";
import {abs, asin, cos, epsilon, halfPi, pi, sin, sqrt} from "./math.js";

export function eckert6Raw(lambda, phi) {
  var k = (1 + halfPi) * sin(phi);
  for (var i = 0, delta = Infinity; i < 10 && abs(delta) > epsilon; i++) {
    phi -= delta = (phi + sin(phi) - k) / (1 + cos(phi));
  }
  k = sqrt(2 + pi);
  return [
    lambda * (1 + cos(phi)) / k,
    2 * phi / k
  ];
}

eckert6Raw.invert = function(x, y) {
  var j = 1 + halfPi,
      k = sqrt(j / 2);
  return [
    x * 2 * k / (1 + cos(y *= k)),
    asin((y + sin(y)) / j)
  ];
};

export default function() {
  return projection(eckert6Raw)
      .scale(173.044);
}
