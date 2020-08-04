import {geoProjection as projection} from "d3-geo";
import {abs, cos, halfPi, pi, sign, sin, sqrt} from "./math.js";
import {solve} from "./newton.js";

// Based on Torben Jansen's implementation
// https://beta.observablehq.com/@toja/nicolosi-globular-projection
// https://beta.observablehq.com/@toja/nicolosi-globular-inverse

export function nicolosiRaw(lambda, phi) {
  var sinPhi = sin(phi),
    q = cos(phi),
    s = sign(lambda);

  if (lambda === 0 || abs(phi) === halfPi) return [0, phi];
  else if (phi === 0) return [lambda, 0];
  else if (abs(lambda) === halfPi) return [lambda * q, halfPi * sinPhi];

  var b = pi / (2 * lambda) - (2 * lambda) / pi,
    c = (2 * phi) / pi,
    d = (1 - c * c) / (sinPhi - c);

  var b2 = b * b,
    d2 = d * d,
    b2d2 = 1 + b2 / d2,
    d2b2 = 1 + d2 / b2;

  var M = ((b * sinPhi) / d - b / 2) / b2d2,
    N = ((d2 * sinPhi) / b2 + d / 2) / d2b2,
    m = M * M + (q * q) / b2d2,
    n = N * N - ((d2 * sinPhi * sinPhi) / b2 + d * sinPhi - 1) / d2b2;

  return [
    halfPi * (M + sqrt(m) * s),
    halfPi * (N + sqrt(n < 0 ? 0 : n) * sign(-phi * b) * s)
  ];
}

nicolosiRaw.invert = function(x, y) {

  x /= halfPi;
  y /= halfPi;

  var x2 = x * x,
    y2 = y * y,
    x2y2 = x2 + y2,
    pi2 = pi * pi;

  return [
    x ? (x2y2 -1 + sqrt((1 - x2y2) * (1 - x2y2) + 4 * x2)) / (2 * x) * halfPi : 0,
    solve(function(phi) {
      return (
        x2y2 * (pi * sin(phi) - 2 * phi) * pi +
        4 * phi * phi * (y - sin(phi)) +
        2 * pi * phi -
        pi2 * y
      );
    }, 0)
  ];
};

export default function() {
  return projection(nicolosiRaw)
    .scale(127.267);
}
