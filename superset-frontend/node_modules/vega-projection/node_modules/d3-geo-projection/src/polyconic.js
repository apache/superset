import {geoProjection as projection} from "d3-geo";
import {abs, acos, asin, cos, epsilon, halfPi, sign, sin, tan} from "./math.js";

export function polyconicRaw(lambda, phi) {
  if (abs(phi) < epsilon) return [lambda, 0];
  var tanPhi = tan(phi),
      k = lambda * sin(phi);
  return [
    sin(k) / tanPhi,
    phi + (1 - cos(k)) / tanPhi
  ];
}

polyconicRaw.invert = function(x, y) {
  if (abs(y) < epsilon) return [x, 0];
  var k = x * x + y * y,
      phi = y * 0.5,
      i = 10, delta;
  do {
    var tanPhi = tan(phi),
        secPhi = 1 / cos(phi),
        j = k - 2 * y * phi + phi * phi;
    phi -= delta = (tanPhi * j + 2 * (phi - y)) / (2 + j * secPhi * secPhi + 2 * (phi - y) * tanPhi);
  } while (abs(delta) > epsilon && --i > 0);
  tanPhi = tan(phi);
  return [
    (abs(y) < abs(phi + 1 / tanPhi) ? asin(x * tanPhi) : sign(y) * sign(x) * (acos(abs(x * tanPhi)) + halfPi)) / sin(phi),
    phi
  ];
};

export default function() {
  return projection(polyconicRaw)
      .scale(103.74);
}
