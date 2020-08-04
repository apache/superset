import {abs, acos, asin, atan, cos, epsilon, pi, sin, tan} from "./math.js";
import parallel1 from "./parallel1.js";

export function rectangularPolyconicRaw(phi0) {
  var sinPhi0 = sin(phi0);

  function forward(lambda, phi) {
    var A = sinPhi0 ? tan(lambda * sinPhi0 / 2) / sinPhi0 : lambda / 2;
    if (!phi) return [2 * A, -phi0];
    var E = 2 * atan(A * sin(phi)),
        cotPhi = 1 / tan(phi);
    return [
      sin(E) * cotPhi,
      phi + (1 - cos(E)) * cotPhi - phi0
    ];
  }

  // TODO return null for points outside outline.
  forward.invert = function(x, y) {
    if (abs(y += phi0) < epsilon) return [sinPhi0 ? 2 * atan(sinPhi0 * x / 2) / sinPhi0 : x, 0];
    var k = x * x + y * y,
        phi = 0,
        i = 10, delta;
    do {
      var tanPhi = tan(phi),
          secPhi = 1 / cos(phi),
          j = k - 2 * y * phi + phi * phi;
      phi -= delta = (tanPhi * j + 2 * (phi - y)) / (2 + j * secPhi * secPhi + 2 * (phi - y) * tanPhi);
    } while (abs(delta) > epsilon && --i > 0);
    var E = x * (tanPhi = tan(phi)),
        A = tan(abs(y) < abs(phi + 1 / tanPhi) ? asin(E) * 0.5 : acos(E) * 0.5 + pi / 4) / sin(phi);
    return [
      sinPhi0 ? 2 * atan(sinPhi0 * A) / sinPhi0 : 2 * A,
      phi
    ];
  };

  return forward;
}

export default function() {
  return parallel1(rectangularPolyconicRaw)
      .scale(131.215);
}
