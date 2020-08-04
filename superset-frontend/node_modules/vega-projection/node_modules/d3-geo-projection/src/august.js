import {geoProjection as projection} from "d3-geo";
import {abs, arcosh, arsinh, asin, atan2, cos, cosh, sign, sin, sinh, sqrt, tan} from "./math.js";

export function augustRaw(lambda, phi) {
  var tanPhi = tan(phi / 2),
      k = sqrt(1 - tanPhi * tanPhi),
      c = 1 + k * cos(lambda /= 2),
      x = sin(lambda) * k / c,
      y = tanPhi / c,
      x2 = x * x,
      y2 = y * y;
  return [
    4 / 3 * x * (3 + x2 - 3 * y2),
    4 / 3 * y * (3 + 3 * x2 - y2)
  ];
}

augustRaw.invert = function(x, y) {
  x *= 3 / 8, y *= 3 / 8;
  if (!x && abs(y) > 1) return null;
  var x2 = x * x,
      y2 = y * y,
      s = 1 + x2 + y2,
      sin3Eta = sqrt((s - sqrt(s * s - 4 * y * y)) / 2),
      eta = asin(sin3Eta) / 3,
      xi = sin3Eta ? arcosh(abs(y / sin3Eta)) / 3 : arsinh(abs(x)) / 3,
      cosEta = cos(eta),
      coshXi = cosh(xi),
      d = coshXi * coshXi - cosEta * cosEta;
  return [
    sign(x) * 2 * atan2(sinh(xi) * cosEta, 0.25 - d),
    sign(y) * 2 * atan2(coshXi * sin(eta), 0.25 + d)
  ];
};

export default function() {
  return projection(augustRaw)
      .scale(66.1603);
}
